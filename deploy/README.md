# Hetzner-deploy

Oppsett for produksjonsserver. Kort og praktisk — ikke en fullstendig runbook.

## Forutsetninger

- Hetzner Cloud-VM (CX22 eller større) med Ubuntu 24.04
- DNS for `knuteloop.no` og `www.knuteloop.no` peker (A/AAAA) på serverens IP
- SSH-tilgang som root eller sudo-bruker
- Lokal maskin (Windows): OpenSSH Client + innebygd `tar` (begge finnes på Win 10/11)

Alle **lokale** kommandoer under er for **PowerShell**. Alle **server**-
kommandoer er for **bash**.

## Én-gangs oppsett på serveren (bash)

```bash
# 1. System-pakker
apt update
apt install -y curl git ca-certificates

# 2. Node 22 (LTS)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# 3. Caddy (eget APT-repo)
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install -y caddy

# 4. Dedikert tjenestebruker for Node
useradd --system --create-home --shell /usr/sbin/nologin knuteloop

# 5. Mappestruktur
mkdir -p /opt/knuteloop/{releases,data}
mkdir -p /opt/knuteloop/data/uploads
chown -R knuteloop:knuteloop /opt/knuteloop
```

## Mappestruktur på serveren

```
/opt/knuteloop/
├── current → releases/YYYY-MM-DD-HHMMSS/   (symlink til aktiv release)
├── releases/
│   └── 2026-04-20-120000/
│       ├── index.mjs
│       ├── backend/
│       ├── deploy/              ← unit-fil + env-eksempel + Caddyfile
│       ├── dist/                ← vite build output (Caddy serverer dette)
│       └── node_modules/
└── data/                         ← persistent state (IKKE del av release)
    ├── app-db.json
    ├── auth.sqlite
    ├── auth.sqlite-wal
    ├── auth.sqlite-shm
    └── uploads/
```

Deploys overskriver aldri `data/`.

## Første deploy

### 1. Bygg og pakk (PowerShell, på din Windows-maskin)

```powershell
cd C:\Development\Kampsporthuset\repos\knuteloop.no

npm ci
npm run build

# BSD tar på Windows — alle excludes før -czf for sikker argument-parsing
tar --exclude="backend/data/*" --exclude="backend/uploads/*" --exclude="backend/backups/*" -czf release.tgz index.mjs backend deploy package.json package-lock.json dist

# Kopier release + persistent DB til serveren
scp release.tgz                   ingve@SERVER_IP:/tmp/
scp backend/data/app-db.json      ingve@SERVER_IP:/tmp/
scp backend/data/auth.sqlite      ingve@SERVER_IP:/tmp/
```

### 2. Legg databasen i persistent mappe (bash, på serveren)

```bash
sudo -u knuteloop cp /tmp/app-db.json /opt/knuteloop/data/
sudo -u knuteloop cp /tmp/auth.sqlite /opt/knuteloop/data/
rm /tmp/app-db.json /tmp/auth.sqlite
```

### 3. Pakk ut release og lag symlinker (bash)

```bash
STAMP=$(date +%Y-%m-%d-%H%M%S)
RELEASE=/opt/knuteloop/releases/$STAMP

sudo -u knuteloop mkdir -p "$RELEASE"
sudo tar xzf /tmp/release.tgz -C "$RELEASE"
sudo chown -R knuteloop:knuteloop "$RELEASE"
rm /tmp/release.tgz

sudo -u knuteloop bash <<EOF
cd "$RELEASE"
npm ci --omit=dev

# tar ekskluderer backend/data/* og backend/uploads/*, og mappene blir da
# ikke med i arkivet hvis de kun inneholder ekskluderte filer. Opprett +
# rydd dem før symlinkene:
mkdir -p backend/data
rmdir backend/uploads 2>/dev/null || true

ln -sf /opt/knuteloop/data/app-db.json       backend/data/app-db.json
ln -sf /opt/knuteloop/data/auth.sqlite       backend/data/auth.sqlite
ln -sf /opt/knuteloop/data/auth.sqlite-wal   backend/data/auth.sqlite-wal
ln -sf /opt/knuteloop/data/auth.sqlite-shm   backend/data/auth.sqlite-shm
ln -sfn /opt/knuteloop/data/uploads          backend/uploads
EOF

sudo ln -sfn "$RELEASE" /opt/knuteloop/current
```

### 4. Installer systemd-unit + env-fil (bash, én gang per server)

```bash
sudo cp /opt/knuteloop/current/deploy/knuteloop.env.example /etc/knuteloop.env
sudo chown root:knuteloop /etc/knuteloop.env
sudo chmod 640 /etc/knuteloop.env
sudo nano /etc/knuteloop.env     # sett ALLOWED_ORIGIN=https://knuteloop.no

sudo cp /opt/knuteloop/current/deploy/knuteloop.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now knuteloop
sudo systemctl status knuteloop
# Live-logg: journalctl -u knuteloop -f
```

Unit-en kjører som `knuteloop`-brukeren, restarter på crash (maks 5 ganger
per 60 sek), og får kun skrive til `/opt/knuteloop/data/`. Standard ut/err
går til `journalctl`.

### 5. Installer Caddy (bash, én gang per server)

```bash
sudo cp /opt/knuteloop/current/deploy/Caddyfile /etc/caddy/Caddyfile
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy henter TLS-sertifikat fra Let's Encrypt automatisk første gang den
treffes av `knuteloop.no`.

### 6. Sjekk at alt virker

```bash
curl -sI https://knuteloop.no/api/health
# Forventet: HTTP/2 200, Let's Encrypt-sertifikat

curl -sI https://knuteloop.no/
# Forventet: HTTP/2 200, Cache-Control: no-cache, Content-Type: text/html
```

## Pull-deploy (anbefalt for senere releases)

Istedenfor å bygge lokalt + scp, kan serveren selv hente siste kode fra
GitHub og bygge der. Setter du opp dette én gang, er senere deploys ett
kall: `sudo -u knuteloop /opt/knuteloop/deploy.sh`.

### Engangs-oppsett på serveren

**1. SSH-deploy-key for knuteloop-brukeren** (hopp over hvis repoet er
offentlig):

```bash
sudo -u knuteloop ssh-keygen -t ed25519 -f /home/knuteloop/.ssh/id_ed25519 -N ""
sudo cat /home/knuteloop/.ssh/id_ed25519.pub
```

Kopier output, legg den til som **Deploy Key** i GitHub-repo-settings
(Settings → Deploy keys → Add deploy key). La "Allow write access" stå av —
serveren skal bare lese.

Første clone spør om host-nøkkel-godkjenning. Forhåndsgodkjenn GitHubs:

```bash
sudo -u knuteloop bash -c 'ssh-keyscan github.com >> ~/.ssh/known_hosts'
```

**2. NOPASSWD-regel for systemctl restart**

Deploy-scriptet må kunne restarte Node-tjenesten uten passord-prompt:

```bash
echo 'knuteloop ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart knuteloop' | \
  sudo tee /etc/sudoers.d/knuteloop-deploy
sudo chmod 440 /etc/sudoers.d/knuteloop-deploy
sudo visudo -c   # valider at ingen andre sudoers-filer er ødelagt
```

**3. Installer deploy-scriptet**

Scriptet følger med i release-tarballen (eller git-clonen), så flytt det
på plass én gang:

```bash
sudo cp /opt/knuteloop/current/deploy/deploy.sh /opt/knuteloop/deploy.sh
sudo chown knuteloop:knuteloop /opt/knuteloop/deploy.sh
sudo chmod 755 /opt/knuteloop/deploy.sh
```

### Daglig bruk

Etter hver push til GitHub:

```bash
# Deploy main (standard)
sudo -u knuteloop /opt/knuteloop/deploy.sh

# Deploy en annen branch — f.eks. release-candidate for staging-test
sudo -u knuteloop /opt/knuteloop/deploy.sh release-candidate
```

Scriptet gjør: clone branch → `npm ci` → `npm run build` → slank til prod-
deps → symlink state → bytt `current`-pekeren atomisk → `systemctl restart` →
helsesjekk mot `/api/health`. Det rydder også opp i gamle releases
(beholder de 5 siste).

Hvis Caddyfile eller systemd-unit har endret seg i releasen, skriver
scriptet ut en advarsel med kommandoen for manuell oppgradering — dette
gjøres aldri automatisk, siden det krever root og påvirker hele serveren.

## Fallback: manuell tar-deploy

Hvis pull-deploy ikke fungerer (GitHub nede, nettverk feiler), kan du
fortsatt bruke tar+scp fra del "Første deploy" over. Begge prosedyrer
skriver til samme `releases/`-mappe og er trygge å veksle mellom.

## Endringer i infrastruktur-filer

Hvis du endrer `knuteloop.service`, `Caddyfile` eller `knuteloop.env.example`:

```bash
# Etter at en release med endringen er aktiv (deploy.sh har kjørt):
sudo diff /etc/systemd/system/knuteloop.service /opt/knuteloop/current/deploy/knuteloop.service
sudo diff /etc/caddy/Caddyfile                  /opt/knuteloop/current/deploy/Caddyfile
# Kopier over manuelt om du er enig, og kjør daemon-reload / caddy reload
```

## Daglig backup (engangs-oppsett)

```bash
# 1. Gjør backup-scriptet kjørbart for knuteloop-brukeren
sudo chmod +x /opt/knuteloop/current/deploy/knuteloop-backup.sh

# 2. Installer cron-job
sudo cp /opt/knuteloop/current/deploy/knuteloop-backup.cron /etc/cron.d/knuteloop-backup
sudo chown root:root /etc/cron.d/knuteloop-backup
sudo chmod 644 /etc/cron.d/knuteloop-backup

# 3. Test at det kjører uten feil
sudo -u knuteloop /opt/knuteloop/current/deploy/knuteloop-backup.sh
ls -la /opt/knuteloop/backups/ | head

# (valgfritt) installer sqlite3-cli for tryggere auth.sqlite-backup
sudo apt install -y sqlite3
```

Backups kjører 03:00 hver natt. Beholder 14 dager. app-db.json +
auth.sqlite kopieres til `/opt/knuteloop/backups/`. Logg: `/opt/knuteloop/data/backup.log`.

## Hva som mangler (dekkes i neste steg)

- E-post-sending av invite-koder (pre-launch punkt 2)
- Offsite-backup (Cloudflare R2 / Backblaze B2) — lokal backup dekker
  de fleste feilscenarioer, men hvis hele VM-en går tapt er de også
  borte. Hetzner Backup (€0.90/mnd) er enkleste mellomsteg.
- SQLite-migrering av app-db.json — større refaktor, bedre i senere
  fase når traffikkpåkjenningen øker.
