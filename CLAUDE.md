# CLAUDE.md

## Branch-regler (HARDE KRAV)

- **Aldri commit, push eller merge direkte til `main`.**
- **Alt arbeid skjer i en feature-branch** (typisk `claude/...` eller `feat/...`).
- Hvis du blir bedt om noe som ville rørt `main`, stopp og spør først.
- `git push` skal alltid gå til den aktive feature-branchen (`git push -u origin <branch>`).
- Ikke `git checkout main`, `git reset` mot main, eller force-push noe sted uten eksplisitt tillatelse.

## Prosjekt

Knuteloop.no — sosial gamification-plattform for russeknuter. Vite + React (frontend), Node.js + better-sqlite3 (backend, `index.mjs`).
