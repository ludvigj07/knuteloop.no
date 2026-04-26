# Audit: Bugs og UX-design

Branch: `audit/bugs-and-ux` (avgrenet fra `origin/main`)
Dato: 2026-04-26
Avgrenset til frontend (frontend/, components/, pages/, lib/, styles/).

## Sammendrag

Frontend er stor (~15 000 linjer JSX) og har generelt rikt feature-sett, men det
er flere alvorlige bugs som bryter sentrale flyter. Den mest kritiske er at
`convertToMp4` kalles fra `App.jsx` uten å være importert — alle innsendinger
med video vil sannsynligvis kaste `ReferenceError` i prod. Det finnes også
subtile state-bugs i profil-redigering og onboarding, og en del dødkode/sider
(`AdminPage.next.jsx`, `AdminPage.v2.jsx`, `LeaderboardPage.next.jsx`,
`FeedPage.jsx`, `LoadingSplash.jsx`, `PwaInstallPrompt.jsx`,
`AchievementsPage.jsx`, `ActivityLogPage.jsx`, `OnboardingModal.jsx`,
`AdminDuelHub.jsx`, `RankUpToast.jsx`, `AchievementCelebration.jsx`,
`ConfettiBurst.jsx`, `DuelPage.jsx`) som aldri brukes fra `App.jsx`/`main.jsx`.
Onboarding-touren har en omvendt-logikk-feil som gjør "Hopp over" usynlig på
alle steg unntatt det første. Tilgjengelighet og russe-tema er stort sett ok,
men det er en del døde knapper, hardkodede klassenavn og inkonsekvent norsk.

Kategorier: **2** kritiske bugs, **9** vanlige bugs, **8** UX høy, **7** UX
lav, **5** tilgjengelighet, **4** tekniske observasjoner.

> Andre agenter jobber på `polish/mobile-ux`, `polish/admin-density`,
> `polish/pwa-perf`. Funn som overlapper er notert men ikke fikset her.

---

## Kritiske bugs (fiks ASAP)

- [ ] **`convertToMp4` er ikke importert — knekker alle video-innsendinger** —
  `frontend/App.jsx:708`. `handleSubmitKnot` kaller
  `await convertToMp4(evidence.videoFile)`, men funksjonen er ikke importert
  fra `./data/api.js` (ligger kun definert i `backend/src/data/api.js`).
  Reproduksjon: logg inn som vanlig bruker → åpne en knute → velg en
  videofil → trykk send. Resultat: `ReferenceError: convertToMp4 is not
  defined`, knuten blir aldri sendt. Fix: legg til `convertToMp4` i listen
  av imports fra `./data/api.js`. Bilde-only og tekst-only-innsendinger
  er ikke påvirket.

- [ ] **Profil-felt kan ikke tømmes — "blir alltid fylt med gammel verdi"**
  — `frontend/pages/ProfilesPage.jsx:346–354`. `handleSaveProfile`
  faller tilbake til `selectedProfile.bio`/`realName`/`className`/etc. når
  draftens trim er tomt. Det betyr at hvis brukeren bevisst sletter sin
  bio og lagrer, kommer den gamle bio-en tilbake. Reproduksjon: rediger
  profil → tøm "Bio" → Lagre → Bio er fortsatt der. Fix: send tom streng
  videre i stedet for fallback til forrige verdi (eller eksplisitt
  bekreft "vil du fjerne?"). Server bør avgjøre standardverdier.

## Vanlige bugs

- [ ] **"Hopp over"-knapp i onboarding-tour er omvendt logikk** —
  `frontend/components/LiveOnboarding.jsx:105`. Koden er
  `{!isFirst ? null : <button>Hopp over</button>}` som betyr at knappen
  *kun* vises på første step. Brukeren har dermed ingen vei ut etter å ha
  klikket "Vis meg!". Spotlight-stegene (linje 240) har egen Hopp-over,
  men modal-stegene (`done`-modalen på slutten) har ingen. Fix: bytt
  `!isFirst` til `isFirst` (skjul kun på første) eller fjern sjekken så
  knappen alltid vises.

- [ ] **`AnimatedPoints` bruker stale closure ved rask endring** —
  `frontend/pages/DashboardPage.jsx:29–46`. `const from = count` og
  effekten er deklarert med `// eslint-disable-next-line react-hooks/
  exhaustive-deps` med kun `[target]`. Hvis `target` skifter to ganger
  raskt (f.eks. silent refresh hver 30 s + brukerhandling), brukes en
  utdatert `from`-verdi og animasjonen "hopper". Fix: les nåværende
  `count` fra ref i stedet for state for å unngå stale value, eller
  legg `count` i deps og restart animasjonen kontrollert.

- [ ] **`handleRate` mister forrige rating ved feil — restorer til null
  hvis bruker ikke hadde stjerner før** —
  `frontend/pages/FeedPageV2.jsx:1564,1586`. `previousRating = Number(
  entry.myRating) || null`. Hvis bruker hadde rating 0 (eller udefinert)
  og endrer fra 3 → feil → fallback setter draft til `null`, som vises
  som ingen stjerner — det er likevel teknisk OK, men hvis nettverket
  feiler, gir UI ingenting tilbake til brukeren utover en error-tekst som
  kan være på engelsk fra backend. Lite issue, men bekreft at fallback
  passer for "rated → fjern rating"-flyten.

- [ ] **Pwa-prompt incrementer visit-count selv om brukeren har avslått**
  — `frontend/components/PwaInstallPrompt.jsx:48–56`. `read
  AndIncrementVisitCount()` kalles uavhengig av `dismissed`. Det er
  ufarlig, men oppblåser localStorage uten grunn. Fix: tidlig-return
  hvis `dismissed`.

- [ ] **`PwaInstallPrompt` viser seg aldri på iOS Safari** — `frontend/
  components/PwaInstallPrompt.jsx:51`. Den er bare hektet på `before
  installprompt`-eventet, som iOS ikke fyrer. Komponenten er forøvrig
  *ikke importert noen steder* — det er dødkode i øyeblikket. Fix:
  enten importer den i `App.jsx` (og legg til iOS-spesifikk fallback),
  eller fjern komponenten helt. (Overlapper med `polish/pwa-perf`.)

- [ ] **`LoadingSplash`-komponenten er aldri brukt** — `frontend/
  components/LoadingSplash.jsx`. Untracked + ubrukt. Vurder å fjerne
  eller faktisk vise den under `isLoadingApp` i stedet for `section.
  section-card` på linje 1138 i `App.jsx`.

- [ ] **`PostActionsMenu` har en disabled "Rediger innlegg"-knapp** —
  `frontend/components/PostActionsMenu.jsx:67–75`. Knappen viser et
  blyant-ikon og "Rediger innlegg" men er hardkodet `disabled`.
  Brukerne ser dette og blir forvirret. Fix: enten implementer
  redigering eller fjern knappen.

- [ ] **`UserAdminPanel` viser passord-reset i klartekst** —
  `frontend/components/UserAdminPanel.jsx:389-395`. Skjemaet for å
  sette nytt passord bruker `type="text"`. Admin kan se passordet, men
  det er også synlig på storskjermer/skuldersurfing/screenshare. Fix:
  bruk `type="password"` eller en visning-toggle.

- [ ] **`UserAdminPanel`: ingen bekreftelse før deaktivering av bruker**
  — `frontend/components/UserAdminPanel.jsx:323`. Ett klikk på
  "Deaktivér" kjører umiddelbart. Burde ha en confirm-dialog (modal,
  ikke `window.confirm`).

- [ ] **`scheduleScrollToKnotResults` cancel-er ikke ved unmount** —
  `frontend/pages/KnotsPage.jsx:1559`. `folderScrollFrameRef.current`
  settes via dobbel rAF, men det er ingen cleanup hvis komponenten
  unmountes mellom de to frames. Lavprio, men kan trigge update på
  unmounted komponent.

## UX-problemer (høy prioritet)

- [ ] **Login-skjema bruker `type="text"` for e-post** —
  `frontend/pages/LoginPage.jsx:31`. Mobil får ikke `@`-nær-tasten,
  ingen spam-validering. Fix: `type="email"` (vi bruker det allerede i
  InvitePage).

- [ ] **Slett konto: kun en in-page-bekreftelse, ingen typing-confirm** —
  `frontend/components/SettingsModal.jsx:201–219`. To-trinn-knapp,
  men ingen krav om å skrive inn brukernavn/e-post for endelig
  bekreftelse. For en destruktiv handling som ikke kan angres, er
  dette tynt.

- [ ] **Achievement-modal lukkes ved klikk hvor som helst, også i
  selve kortet** — `frontend/components/AchievementCelebration.jsx:84`.
  Backdrop lukker. Det står "Trykk hvor som helst for å fortsette"
  som intent, men "Fett!"-CTA-en blir overflødig — fjern den eller
  fjern hint-teksten.

- [ ] **Ingen shared loading-state for silent refresh** — `frontend/
  App.jsx:381–402`. Hvert 30. sek henter den ny data uten noen
  visuell indikator. Hvis backend stopper, ser brukeren stale data
  uten å vite det. UX bør ha en liten "online/offline"-prikk eller
  toast hvis flere refresh feiler etter hverandre.

- [ ] **`window.alert` brukes for delete-account-feil** — `frontend/
  App.jsx:615`. Ellers bruker hele appen `Toast`/inline error-state.
  Inkonsekvent + alert er stygt på mobil. Fix: bruk `showToast`/
  `setPasswordError`-mønsteret.

- [ ] **"Rare"-feedback-melding (10 minutter lang gru-historie) trigges
  med 0,5 % sjanse** — `frontend/pages/KnotsPage.jsx:48,84-112`.
  Konseptuelt artig, men teksten er ekstremt lang og dekker
  høyst sannsynlig hele skjermen i 20 sekunder. På en russe-app som
  brukes hyppig kan dette bli kringlete. Vurder kortere "rare"-pool
  eller la brukeren lukke tidligere.

- [ ] **Hardkodede klassenavn (STA-STH, IBA-IBD)** — `frontend/pages/
  LeaderboardPage.jsx:57–70`. Apper brukes ikke utenfor denne skolen
  uten å redigere kode. Burde komme fra backend/config.

- [ ] **Inkonsistent merging av `studentName`/`russName`** — på tvers
  av komponenter (FeedPageV2, DashboardPage, LeaderboardPage,
  AdminDuelHub) ser man `russName ?? name ?? 'ukjent'`/`'Ukjent'`/
  `'-'`/`'?'`/`'Anonym'` brukt. Brukeren ser forskjellige fallback-
  strenger ulike steder. Definer én konstant.

## UX-problemer (lav prioritet)

- [ ] **Hjem-CTA "Heisann <navn>" bruker 'russ' som fallback** —
  `frontend/App.jsx:972`. Greit, men hvis brukeren har skrevet eget
  russenavn skal det alltid eksistere. Hvis ikke: si heller "Heisann!".

- [ ] **"Du leder topplisten" vises selv om alle brukere har 0 poeng** —
  `frontend/App.jsx:985`. Ikke hyggelig hvis kullet akkurat har starta.
  Fix: legg til check på `pointsBehind`/at det finnes minst 1 leader
  med `points > 0`.

- [ ] **Nedtrykk på "send"-knapper viser ikke disabled-stil tydelig nok**
  — gjelder mange knapper. CSS i blaruss-tema: knapp-disabled har lav
  kontrast. (Overlapper potensielt `polish/mobile-ux`.)

- [ ] **Tekstpost-fallback "- Ukjent"** — `frontend/pages/FeedPageV2.jsx:
  58`. Hvis `studentName` mangler, viser feed "- Ukjent". Vurder en
  hyggeligere fallback ("- en russ").

- [ ] **`shouldIgnoreSwipeStart` mangler `button`/`a`** — `frontend/
  components/SwipeTabsShell.jsx:65–80`. Drag på knapper og lenker
  trigger sidebytte (siden de filtreres bort). Vanligvis ikke et
  problem fordi `setPointerCapture`-toggle skjer ved 10px drag,
  men ekstra trygghet.

- [ ] **DuelPage TODO-kommentar igjen i kode** — `frontend/components/
  DuelEvidenceSheet.jsx:27`. "X-knapp eller swipe ned (TODO)". Lite
  problem, men signaliserer half-finished feature.

- [ ] **Mange `'Ikke valgt'`/`'Ikke satt ennå.'`/`'Ingen sitat lagt til
  ennå.'` defaults** — `frontend/pages/ProfilesPage.jsx:350–354`.
  Disse defaults blir SENDT til server som om de var bruker-input.
  Det forplanter seg til andre profilers visning og leaderboard-tooltips.
  Fix: server burde returnere tomstreng, frontend gjengir placeholder.

## Tilgjengelighet

- [ ] **Login `<input type="text">` for e-post mangler `aria-invalid` /
  feilmeldings-binding** — `frontend/pages/LoginPage.jsx:30`. Når feil
  vises, kobles den ikke til input via `aria-describedby`.

- [ ] **`PostActionsMenu`-trigger har `aria-label="Flere valg for innlegg"`
  men `title="Flere valg"`** — inkonsekvent. Småting, men screenreaders
  vil lese begge.

- [ ] **`feed-rating-star`-knapper har `title` men ingen `aria-pressed`
  state** — `frontend/pages/FeedPageV2.jsx:374-394`. Stjernene fungerer
  som toggle/rating, og bør indikere valgt state via `aria-pressed`
  eller bruke radio-gruppe-mønster.

- [ ] **Mange ikoner uten alt og uten `aria-hidden`** — sjekkpunkter
  i `LiveOnboarding.jsx`-modaler bruker inline emoji uten
  `aria-hidden="true"` (f.eks. linje 110-112 — den har det, OK), men
  flere andre steder (kategorier i FeedPageV2 stjerner viser `★`)
  som lese-uvennlig.

- [ ] **`<img alt="Anonym profilbilde">` er en "presentation" stort sett**
  — `frontend/pages/FeedPageV2.jsx:565,308`. Backdrop-bildet i feed har
  `aria-hidden="true"` (bra), men alt-tekst ellers er ulik fra norsk
  beskrivelse til "profilbilde". Sjekk at alt er konsistent norsk.

## Tekniske observasjoner

- **Frontend importerer direkte fra backend-fil** — `frontend/data/api.js:1`
  er bare `export * from '../../backend/src/data/api.js';`. Det binder
  frontend-bygget hardt til backend-mappen. Dette er en arkitektur-feil,
  men strengt off-limits for denne audit.

- **Mye dødkode**: `frontend/pages/AdminPage.next.jsx`,
  `AdminPage.v2.jsx`, `LeaderboardPage.next.jsx`, `FeedPage.jsx` (V1, ikke
  V2), `AchievementsPage.jsx`, `ActivityLogPage.jsx`, `DuelPage.jsx`
  (704 linjer), og komponenter `AdminDuelHub.jsx` (1097 linjer),
  `RankUpToast.jsx`, `AchievementCelebration.jsx`, `ConfettiBurst.jsx`,
  `OnboardingModal.jsx`, `LoadingSplash.jsx`, `PwaInstallPrompt.jsx`. Til
  sammen ~3500+ linjer som ikke er importert i `App.jsx`/`main.jsx`.
  Vurder en systematisk opprydning — selv om noe er reservert for senere
  innkobling, vokser bundle-størrelsen og det er lett å miste oversikt
  over hva som faktisk kjøres.

- **Bruk av `eslint-disable`-kommentarer for `react-hooks/exhaustive-deps`
  i flere effekter** — `App.jsx:409`, `DashboardPage.jsx:45`,
  `UserAdminPanel.jsx:59`, `SwipeTabsShell.jsx:270`. Hver av dem antyder
  en bug-mulighet. Verdt en gjennomgang.

- **Toast har `key={Date.now()}`-mønster i App** — `App.jsx:159`.
  Funker, men `Date.now()` kan kollidere ved to toasts på samme ms. Bruk
  en counter (`useRef(0)` + increment) i stedet.

---

## Ikke tatt — overlapper med andre branches

- Mobil touch-targets, knappehøyder, padding/spacing — `polish/mobile-ux`.
- Admin-side density (tabeller, kort som er for store) — `polish/admin-density`.
- PWA manifest, ikon-størrelser, service-worker, ytelse — `polish/pwa-perf`.

Se de respektive PR-ene.
