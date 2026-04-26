# CLAUDE.md

Prosjekt-instruks for Claude Code. Les dette først hver sesjon.

## Hvem og hva

- **Bruker:** Ludvig, ikke-koder, norsk. Kommuniser på norsk.
- **App:** Russeknute (knuteloop.no) — lukket russe-app for St. Olav VGS, kullet 2026.
- **Stack:** React 19 + Vite 8 (frontend), Node + better-sqlite3 (backend), PWA.

## ABSOLUTTE REGLER

Brudd på disse er aldri OK uten eksplisitt OK fra Ludvig:

1. **Aldri rør `backend/`-mappen.** Ikke les for å endre, ikke skriv, ikke slett. Backend-utvikling skjer av en annen person. Hvis du tror noe i backend må endres, si fra — ikke fiks.
2. **Aldri slett runtime-data:** `backend/data/app-db.json`, `backend/data/auth.sqlite*`, `backend/uploads/`. Disse inneholder ekte data.
3. **Aldri rør `main`-branchen.** Ikke checkout, ikke commit, ikke push, ikke merge til. Lokal `main` og `origin/main` kan være ute av sync — det er kjent og ikke noe du fikser.
4. **Aldri force-push, aldri `--no-verify`, aldri `git reset --hard` uten OK.**

## Git-workflow

- **En branch per endring.** Aldri stable flere uavhengige features på samme branch.
- **Commit umiddelbart** når en logisk endring er ferdig. Ikke samle opp.
- **Pull før ny branch:** `git fetch origin && git checkout -b <navn> origin/main`
- **Push branchen** når du er ferdig, men **ikke lag PR** — det gjør Ludvig selv.
- Commit-meldinger på **norsk**.
- Branch-navn: `polish/*`, `fix/*`, `feat/*`, `audit/*`.

### Hvis backend-serveren kjører
SQLite-filer (`backend/data/auth.sqlite*`) er låst når serveren kjører. `git checkout` mellom branches kan da feile. Bruk `git worktree add .claude/worktrees/<navn> <branch>` i stedet for å jobbe på en annen branch uten å stoppe serveren.

### `lokal-test-alle-features`-branchen
Denne brancher er en lokal sandkasse der Ludvig kombinerer features fra flere branches for å teste alt sammen. Ikke alt herfra er ment å merges til main.

## Frontend-konvensjoner

- **Mobil-først.** UI må fungere på 360–414px først. Test mentalt på liten skjerm før noe annet.
- **Admin-siden trenger DENSITY.** Ikke pene kort med padding — kompakte tabeller og lister, power-user-dashboard.
- **Blaruss-temaet** (`frontend/styles/blaruss-refresh.css`) overrider mye. CSS-overrides må bruke `!important` og ofte spesifisitet `.app-theme .admin-page` for å vinne.
- **Hot-reload via Vite** — endringer hot-reloades, du trenger ikke restart for CSS/JSX.

## Vanlige kommandoer

```bash
npm start          # backend (3001) + frontend (5173) parallelt
npm run dev        # bare frontend
npm run server     # bare backend
npm run build      # bygg for prod
npm run lint       # ESLint
```

`vite.config.js` har `host: true` — mobil på samme Wi-Fi når frontend på `http://<lokal-ip>:5173`.

## Stil og samarbeid

- **Autonom modus:** Ta små beslutninger og ship. Spør kun ved destruktive eller kritiske valg.
- **Ikke skriv tester** med mindre Ludvig ber om det.
- **Ikke skriv ekstra dokumentasjon** med mindre Ludvig ber om det.
- **Ikke legg til kommentarer i koden** med mindre WHY er ikke-åpenbart.
- **Pek til kode med `fil.jsx:linje`** når relevant.

## Kjente fallgruver

- Filen `frontend/App.css` er ~12 000 linjer med duplikate regler (særlig nav-knapper rundt linje 251, 2548, 3138). Vær eksplisitt på spesifisitet.
- `AdminPage.jsx` (~1800 linjer) og `FeedPageV2.jsx` (~2000 linjer) er store. Ikke split dem uten Ludvigs OK.
- `frontend/data/api.js` re-eksporterer fra backend — ikke endre re-eksportene.
- Det finnes `*.next.jsx`/`*.v2.jsx`-filer i `frontend/pages/` som kan være død kode. Sjekk før du redigerer at den faktisk brukes.
