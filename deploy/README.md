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

## Senere deploys

Steg 1 (lokalt) og steg 3 (utpakking på serveren), så:

```bash
sudo systemctl restart knuteloop
```

Steg 2, 4 og 5 er engangs-oppsett og trengs ikke.

Hvis du endrer på unit-filen, Caddyfile-en eller env-eksempelet:

```bash
# Etter at steg 3 har kjørt (ny release i /opt/knuteloop/current):
sudo diff /etc/systemd/system/knuteloop.service /opt/knuteloop/current/deploy/knuteloop.service
sudo diff /etc/caddy/Caddyfile /opt/knuteloop/current/deploy/Caddyfile
# Kopier over manuelt om du er enig, og kjør daemon-reload / caddy reload
```

## Hva som mangler (dekkes i neste steg)

- E-post-sending av invite-koder (pre-launch punkt 2)
- Automatiske backup av `data/` til separat sted
