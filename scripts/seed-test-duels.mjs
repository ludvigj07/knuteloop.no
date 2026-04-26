// Skript som legger inn et knippe test-knute-offs i ulike states så
// admin-siden kan testes uten å lage dem manuelt. Idempotent: rydder
// først bort alle eksisterende "duel-test-*"-rader før innsetting.
//
// Kjør: node scripts/seed-test-duels.mjs
//
// Stopp API-serveren først så filen ikke blir overskrevet midt i.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'backend', 'data', 'app-db.json');

const now = Date.now();
const iso = (offsetMs = 0) => new Date(now + offsetMs).toISOString();

// IDer for testen — admin = 12 (L), motstandere fra eksisterende users.
const ADMIN_ID = 12;
const OPP = {
  emil: 2,
  nora: 3,
  jonas: 4,
  leah: 5,
  bob: 7,
  linus: 8,
};
// Annen admin som "har låst" en duell (Sofie, id 1).
const OTHER_ADMIN_ID = 1;

// Bygg seks duells i ulike scenarier.
function buildTestDuels(allKnots) {
  const knots = allKnots.slice(0, 12); // Bruk de første godkjente knutene.
  const pickKnot = (i) => knots[i % knots.length];
  const stake = 10;

  // To duells inkluderer L (admin id 12) — brukes for å se hvordan
  // duells føles fra både bruker- og admin-perspektivet.
  // Resten er mellom andre russ så admin-køen får variasjon.
  const baseFields = (id, challengerId, opponentId, knot, overrides = {}) => ({
    id,
    challengerId,
    opponentId,
    knotId: knot.id,
    knotTitle: knot.title,
    stake,
    createdAt: iso(-2 * 60 * 60 * 1000), // 2t siden
    deadlineAt: iso(22 * 60 * 60 * 1000), // 22t igjen
    challengerCompletedAt: null,
    opponentCompletedAt: null,
    challengerCompletionApproved: null,
    opponentCompletionApproved: null,
    challengerSubmissionId: null,
    opponentSubmissionId: null,
    status: 'active',
    result: null,
    resolvedAt: null,
    challengerNote: '',
    challengerImageName: '',
    challengerImagePreviewUrl: '',
    challengerVideoName: '',
    challengerVideoPreviewUrl: '',
    opponentNote: '',
    opponentImageName: '',
    opponentImagePreviewUrl: '',
    opponentVideoName: '',
    opponentVideoPreviewUrl: '',
    lockedByAdminId: null,
    lockedAt: null,
    lastReviewedByAdminId: null,
    lastReviewedAt: null,
    reviewLog: [],
    cancelledAt: null,
    cancelledByAdminId: null,
    cancelReason: null,
    ...overrides,
  });

  const placeholderImg =
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=70';

  return [
    // 1) KLAR FOR AVGJØRELSE — begge har levert og godkjent.
    //    Du som admin: Auto-knappen vil gi 'split' (begge deler potten).
    baseFields('duel-test-1', OPP.emil, OPP.nora, pickKnot(0), {
      challengerCompletedAt: iso(-90 * 60 * 1000),
      opponentCompletedAt: iso(-30 * 60 * 1000),
      challengerCompletionApproved: true,
      opponentCompletionApproved: true,
      challengerNote:
        'Tok det glatt — film og bilde er lastet opp som bevis. Var ikke så ille som jeg trodde.',
      challengerImageName: 'bevis-utfordrer.jpg',
      challengerImagePreviewUrl: placeholderImg,
      opponentNote: 'Også jeg! Litt nervøs men fikk det til på 30 sek.',
      opponentImageName: 'bevis-motstander.jpg',
      opponentImagePreviewUrl: placeholderImg,
    }),

    // 2) KLAR MED REVERSERT MOTSTANDER — admin har allerede reversert
    //    opponent. Auto-resolve gir nå 'challenger-wins'.
    baseFields('duel-test-2', OPP.jonas, OPP.leah, pickKnot(1), {
      challengerCompletedAt: iso(-3 * 60 * 60 * 1000),
      opponentCompletedAt: iso(-2 * 60 * 60 * 1000),
      challengerCompletionApproved: true,
      opponentCompletionApproved: false,
      challengerNote: 'Kjørt og dokumentert. Kult bevis.',
      opponentNote: 'Glemte å filme — sender bare en mobil-selfie.',
      lastReviewedByAdminId: OTHER_ADMIN_ID,
      lastReviewedAt: iso(-25 * 60 * 1000),
      reviewLog: [
        {
          adminId: OTHER_ADMIN_ID,
          action: 'reverse',
          target: 'opponent',
          timestamp: iso(-25 * 60 * 1000),
        },
      ],
    }),

    // 3) PÅGÅENDE — kun utfordrer har levert.
    baseFields('duel-test-3', OPP.bob, OPP.linus, pickKnot(2), {
      createdAt: iso(-30 * 60 * 1000),
      deadlineAt: iso(23.5 * 60 * 60 * 1000),
      challengerCompletedAt: iso(-10 * 60 * 1000),
      challengerCompletionApproved: true,
      challengerNote: 'Var raskt levert.',
    }),

    // 4) PÅGÅENDE — Du (L) er motstander, har ikke levert. Brukes for
    //    å teste user-vendt "Pågående"-VS-kort på Status/Toppliste.
    baseFields('duel-test-4', OPP.leah, ADMIN_ID, pickKnot(3), {
      createdAt: iso(-15 * 60 * 1000),
      deadlineAt: iso(23.75 * 60 * 60 * 1000),
    }),

    // 5) HASTER — frist om 1t 20m, ingen har levert. Urgent-badge.
    baseFields('duel-test-5', OPP.emil, OPP.bob, pickKnot(4), {
      createdAt: iso(-22.5 * 60 * 60 * 1000),
      deadlineAt: iso(80 * 60 * 1000),
    }),

    // 6) LÅST AV ANNEN ADMIN — Sofie sjekker akkurat nå (1 min siden).
    //    L kan ikke åpne uten å trykke Overstyr i detail-bar.
    baseFields('duel-test-6', OPP.nora, OPP.jonas, pickKnot(5), {
      challengerCompletedAt: iso(-4 * 60 * 60 * 1000),
      opponentCompletedAt: iso(-2 * 60 * 60 * 1000),
      challengerCompletionApproved: true,
      opponentCompletionApproved: true,
      lockedByAdminId: OTHER_ADMIN_ID,
      lockedAt: iso(-60 * 1000), // 1 min siden — innen 5 min TTL
      challengerNote: 'Levert som vanlig, video vedlagt.',
      opponentNote: 'Også levert. Sjekk at video er riktig vinkel.',
    }),
  ];
}

async function main() {
  const raw = await fs.readFile(DB_PATH, 'utf8');
  const db = JSON.parse(raw);

  // Rydd bort tidligere test-duels før innsetting (idempotent).
  const remaining = (db.duels ?? []).filter(
    (duel) => !String(duel.id).startsWith('duel-test-'),
  );
  const removedCount = (db.duels?.length ?? 0) - remaining.length;

  const knots = (db.knots ?? []).filter((k) => k.isActive !== false);
  if (knots.length === 0) {
    throw new Error('Fant ingen aktive knuter — kan ikke seede duells.');
  }

  const newDuels = buildTestDuels(knots);

  db.duels = [...newDuels, ...remaining];

  // Backup originalen før skriving så vi alltid kan rulle tilbake.
  const backupPath = `${DB_PATH}.backup-${Date.now()}`;
  await fs.writeFile(backupPath, raw, 'utf8');

  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf8');

  console.log(`Backup skrevet: ${path.basename(backupPath)}`);
  if (removedCount > 0) {
    console.log(`Rensket ${removedCount} eksisterende test-duells.`);
  }
  console.log(`La inn ${newDuels.length} nye test-duells:`);
  newDuels.forEach((d) => {
    const oppName = Object.entries(OPP).find(([, id]) => id === d.opponentId)?.[0];
    console.log(`  ${d.id} — vs ${oppName} (${d.knotTitle})`);
  });
  console.log(
    '\nDuells er som L (admin id 12). Logg inn som annen admin (Sofie/Admin) for å se dem som eksterne.',
  );
}

main().catch((err) => {
  console.error('Feil under seeding:', err);
  process.exit(1);
});
