// Frontend badge system — Clash Royale-style tiered achievements driven by
// stable knot-folders and general progressions. The backend file
// (backend/src/data/badgeSystem.js) is off-limits, so this module is
// self-contained and exposes the same public surface as before
// (buildAchievements, buildProfileAchievements, getUnlockedAchievements,
// getFeaturedAchievements, isGoldKnot, GOLD_KNOT_POINTS) plus extra fields
// per achievement: `tier`, `tierColor`, `iconType` for richer UI rendering.

import { KNOT_FOLDERS, resolveKnotFolder } from './knotFolders.js';

export const GOLD_KNOT_POINTS = 30;

const TIER_META = [
  { key: 'bronze', label: 'Bronse', tone: 'amber', color: '#cd7f32' },
  { key: 'silver', label: 'Sølv', tone: 'slate', color: '#c0c0c0' },
  { key: 'gold', label: 'Gull', tone: 'gold', color: '#ffd700' },
  { key: 'diamond', label: 'Diamant', tone: 'sky', color: 'diamond' },
];

// Per-folder og total-knuter: prosent-ladder så mappestørrelse spiller
// rolle — 25/50/75/100% av totalen. Tallene regnes ut per mappe i runtime.
const FOLDER_PERCENT_TIERS = [0.25, 0.5, 0.75, 1.0];
const VERSATILE_TIER_TARGETS = [1, 2, 3, 4]; // antall mapper du har truffet
const STREAK_TIER_TARGETS = [3, 7, 14, 30];
const LEADERBOARD_TIER_TARGETS = [10, 5, 3, 1]; // top-N
const GOLD_TIER_TARGETS = [5, 10, 25, 50];

function buildPercentTargets(total) {
  const safeTotal = Math.max(0, Number(total) || 0);
  if (safeTotal <= 0) {
    return FOLDER_PERCENT_TIERS.map(() => 1);
  }
  return FOLDER_PERCENT_TIERS.map((percent) =>
    Math.max(1, Math.ceil(percent * safeTotal)),
  );
}

const FOLDER_ICONS = {
  Generelle: '🪢',
  Dobbelknuter: '👯',
  Alkoholknuter: '🍻',
  Sexknuter: '💋',
  'Fordervett-knuter': '😈',
};

export function isGoldKnot(knot) {
  return Number(knot?.points ?? 0) >= GOLD_KNOT_POINTS;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getTierIndex(progress, targets, totalForFolder) {
  let tierIndex = -1;
  targets.forEach((target, index) => {
    const numericTarget = target === 'all' ? Math.max(1, totalForFolder ?? 1) : target;
    if (progress >= numericTarget) {
      tierIndex = index;
    }
  });
  return tierIndex;
}

function buildTierLedder(targets, totalForFolder) {
  return targets.map((target, index) => ({
    ...TIER_META[index],
    target: target === 'all' ? Math.max(1, totalForFolder ?? 1) : target,
    rawTarget: target,
  }));
}

// Build a single achievement record. All achievements share this shape
// so callers (StatusPage, ProfilesPage, AchievementCelebration) can read
// the same fields no matter the source category.
function buildAchievement({
  id,
  title,
  description,
  category,
  icon,
  iconType = 'emoji',
  targets,
  progress,
  totalForFolder,
}) {
  const tiers = buildTierLedder(targets, totalForFolder);
  const currentTierIndex = getTierIndex(progress, targets, totalForFolder);
  const currentTier = currentTierIndex >= 0 ? tiers[currentTierIndex] : null;
  const nextTier = tiers[currentTierIndex + 1] ?? null;
  const progressTarget = nextTier?.target ?? tiers[tiers.length - 1].target;
  const progressPercent = progressTarget > 0
    ? Math.min(Math.round((progress / progressTarget) * 100), 100)
    : 0;

  return {
    id,
    title,
    description,
    category,
    icon,
    iconType,
    currentProgress: progress,
    currentTier,
    currentTierLabel: currentTier?.label ?? 'Ingen tier',
    currentTierIndex,
    nextTier,
    tiers,
    progressTarget,
    progressPercent,
    isUnlocked: currentTierIndex >= 0,
    isMaxTier: currentTierIndex === tiers.length - 1,
    tone: currentTier?.tone ?? 'muted',
    tier: currentTierIndex + 1, // 1..4 for unlocked, 0 if locked
    tierColor: currentTier?.color ?? '#9ca3af',
    tierKey: currentTier?.key ?? 'locked',
  };
}

function countKnotsByFolder(knots) {
  const counts = new Map();
  for (const knot of knots) {
    const folder = resolveKnotFolder(knot);
    counts.set(folder, (counts.get(folder) ?? 0) + 1);
  }
  return counts;
}

function buildAchievementsFromInputs({
  approvedKnots,
  allKnots,
  folderTotals,
  systemTotalKnots,
  totalPoints,
  leaderboardRank,
  totalLeaderboardCount,
  streakDays,
  duelsWon,
  duelsLost,
  duelsTotal,
  rejectedKnotsCount,
}) {
  const knots = safeArray(approvedKnots);
  const folderCounts = countKnotsByFolder(knots);
  const goldKnotsCount = knots.filter(isGoldKnot).length;
  const folderTotalsMap = folderTotals instanceof Map ? folderTotals : new Map();
  const systemTotal = Math.max(0, Number(systemTotalKnots) || 0);
  const allKnotsArr = safeArray(allKnots);
  const computedRejectedCount = Number.isFinite(rejectedKnotsCount)
    ? rejectedKnotsCount
    : allKnotsArr.filter((k) => k.status === 'Avslått' || k.status === 'Avslaatt').length;
  const wonDuels = Math.max(0, Number(duelsWon) || 0);
  const lostDuels = Math.max(0, Number(duelsLost) || 0);
  const totalDuels = Math.max(0, Number(duelsTotal) || wonDuels + lostDuels);
  const totalLeaderboard = Math.max(0, Number(totalLeaderboardCount) || 0);
  const isLastPlace =
    totalLeaderboard > 1 &&
    Number.isFinite(leaderboardRank) &&
    leaderboardRank === totalLeaderboard;

  const achievements = [];

  // 1) Per-folder mestring — én achievement per stabil mappe.
  //    Tier-mål regnes ut som 25/50/75/100% av total knuter i mappen,
  //    så mapper med få knuter får lavere absolutt-tall enn store mapper.
  KNOT_FOLDERS.forEach((folder) => {
    const progress = folderCounts.get(folder.id) ?? 0;
    const totalKnotsInFolder = folderTotalsMap.get(folder.id) ?? progress;
    const targets = buildPercentTargets(totalKnotsInFolder);
    achievements.push(
      buildAchievement({
        id: `folder:${folder.id}`,
        title: `${folder.id}-mester`,
        description: `Fullfør 25/50/75/100% av knutene i mappen ${folder.id} (${totalKnotsInFolder} stk).`,
        category: folder.id,
        icon: FOLDER_ICONS[folder.id] ?? '🏷️',
        iconType: 'emoji',
        targets,
        progress,
        totalForFolder: totalKnotsInFolder,
      }),
    );
  });

  // 2) Allsidig — antall mapper du har truffet minst én knute i.
  const distinctFolders = folderCounts.size;
  achievements.push(
    buildAchievement({
      id: 'versatile',
      title: 'Allsidig',
      description: 'Ta minst én knute fra ulike mapper for å vise bredde.',
      category: 'Bredde',
      icon: '🎨',
      targets: VERSATILE_TIER_TARGETS,
      progress: distinctFolders,
    }),
  );

  // 3) Streak-konge — N-dagers streak.
  achievements.push(
    buildAchievement({
      id: 'streak-king',
      title: 'Streak-konge',
      description: 'Hold en aktiv streak i mange dager på rad.',
      category: 'Streak',
      icon: '🔥',
      targets: STREAK_TIER_TARGETS,
      progress: Math.max(0, Number(streakDays ?? 0)),
    }),
  );

  // 4) Leaderboard-plassering. Lavere rang = bedre, så vi mapper:
  //    rank<=10 ⇒ tier1, rank<=5 ⇒ tier2, rank<=3 ⇒ tier3, rank===1 ⇒ tier4.
  let leaderboardTierIndex = -1;
  if (Number.isFinite(leaderboardRank) && leaderboardRank > 0) {
    LEADERBOARD_TIER_TARGETS.forEach((target, index) => {
      if (leaderboardRank <= target) {
        leaderboardTierIndex = index;
      }
    });
  }
  // We synthesize a "progress" so the helper builder picks the right tier:
  // pick the highest-tier target that's still <= progress.
  const leaderboardProgress =
    leaderboardTierIndex >= 0 ? LEADERBOARD_TIER_TARGETS[leaderboardTierIndex] : 0;
  achievements.push(
    buildAchievement({
      id: 'leaderboard',
      title: 'Topplass',
      description: 'Klatre opp på leaderboardet — Topp 10, Topp 5, Topp 3, Førsteplassen.',
      category: 'Leaderboard',
      icon: '🏆',
      targets: LEADERBOARD_TIER_TARGETS,
      progress: leaderboardProgress,
    }),
  );

  // 5) Gull-jeger — antall gull-knuter.
  achievements.push(
    buildAchievement({
      id: 'gold-hunter',
      title: 'Gull-jeger',
      description: `Knuter på ${GOLD_KNOT_POINTS}+ poeng er gull verdt.`,
      category: 'Gull',
      icon: '💎',
      targets: GOLD_TIER_TARGETS,
      progress: goldKnotsCount,
    }),
  );

  // 6) Knutesamler — andel av alle knuter i systemet du har godkjent.
  //    Skalerer med faktisk knute-mengde i appen, ikke faste tall.
  achievements.push(
    buildAchievement({
      id: 'total-knots',
      title: 'Knutesamler',
      description: `Fullfør 25/50/75/100% av alle knuter i systemet (${systemTotal} stk).`,
      category: 'Total',
      icon: '🪢',
      targets: buildPercentTargets(systemTotal),
      progress: knots.length,
      totalForFolder: systemTotal,
    }),
  );

  // 7) Poengjager — totalpoeng.
  achievements.push(
    buildAchievement({
      id: 'point-hunter',
      title: 'Poengjager',
      description: 'Total poengsum gir prestisje.',
      category: 'Poeng',
      icon: '⭐',
      targets: [100, 250, 500, 1000],
      progress: Math.max(0, Number(totalPoints ?? 0)),
    }),
  );

  // ── Gøy-merker ──────────────────────────────────────────────────────────
  // Disse er ikke flink-baserte. Mål er å feire *alle* typer russ-erfaringer.

  // 8) Førstegangs-russen — første godkjente knute. 1 tier, varig minne.
  achievements.push(
    buildAchievement({
      id: 'first-knot',
      title: 'Førstegangs-russen',
      description: 'Du tok din aller første knute. Begynnelsen på alt.',
      category: 'Milepæl',
      icon: '🌱',
      targets: [1, 1, 1, 1],
      progress: knots.length > 0 ? 1 : 0,
    }),
  );

  // 9) Sisteplassen — selvironi: vært dønn nederst på topplisten.
  achievements.push(
    buildAchievement({
      id: 'last-place',
      title: 'Sisteplassen',
      description: 'Noen må jo være sist. Du valgte å være best på det.',
      category: 'Anti-prestisje',
      icon: '🐢',
      targets: [1, 1, 1, 1],
      progress: isLastPlace ? 1 : 0,
    }),
  );

  // 10) Knustnukke — antall avslag. Selvironi-pakke.
  achievements.push(
    buildAchievement({
      id: 'rejected',
      title: 'Knustnukke',
      description: 'Avslag bygger karakter. Bevis det.',
      category: 'Karakter',
      icon: '💔',
      targets: [1, 5, 15, 30],
      progress: computedRejectedCount,
    }),
  );

  // 11) Spammer — antall innsendinger totalt (alle statuser unntatt
  //     "Tilgjengelig"). Belønner aktivitet, uavhengig av kvalitet.
  const submittedAtAllCount = allKnotsArr.filter(
    (k) =>
      k.status === 'Godkjent' ||
      k.status === 'Sendt inn' ||
      k.status === 'Avslått' ||
      k.status === 'Avslaatt',
  ).length;
  achievements.push(
    buildAchievement({
      id: 'submitter',
      title: 'Innsender',
      description: 'Du prøver, og det er det som teller.',
      category: 'Aktivitet',
      icon: '📨',
      targets: [3, 10, 25, 60],
      progress: submittedAtAllCount,
    }),
  );

  // 12) Knute-off-vinner — antall vunne dueller.
  achievements.push(
    buildAchievement({
      id: 'duel-winner',
      title: 'Knute-off-konge',
      description: 'Vinn knute-off og bevis hvem som er sjefen.',
      category: 'Knute-off',
      icon: '⚔️',
      targets: [1, 3, 10, 25],
      progress: wonDuels,
    }),
  );

  // 13) Knute-off-taper — selvironi.
  achievements.push(
    buildAchievement({
      id: 'duel-loser',
      title: 'Den gode taper',
      description: 'Tap er bare en mulighet til å bli en bedre forteller.',
      category: 'Knute-off',
      icon: '😅',
      targets: [1, 3, 10, 25],
      progress: lostDuels,
    }),
  );

  // 14) Veteran — totalt antall dueller (vunnet + tapt). Belønner mot.
  achievements.push(
    buildAchievement({
      id: 'duel-veteran',
      title: 'Knute-off-veteran',
      description: 'Du dukker opp uansett resultat. Det krever guts.',
      category: 'Knute-off',
      icon: '🛡️',
      targets: [3, 10, 25, 50],
      progress: totalDuels,
    }),
  );

  // 15) Halvgudd — passert 50% av alle knuter i systemet.
  //     Egen badge selv om det overlapper Knutesamler, fordi 50% er
  //     en stor milestone for de fleste russ.
  const halfThreshold = Math.max(1, Math.ceil(systemTotal / 2));
  achievements.push(
    buildAchievement({
      id: 'halfway',
      title: 'Halvgudd',
      description: 'Halvveis gjennom russetiden, halvveis gjennom knutene.',
      category: 'Milepæl',
      icon: '🌗',
      targets: [halfThreshold, halfThreshold, halfThreshold, halfThreshold],
      progress: knots.length,
    }),
  );

  // 16) Vidunderbarn — på topp-3 på leaderboardet (ulik fra Topplass
  //     siden Topplass har 4 tiers). Dette er en signature-medal for de
  //     som faktisk tar tronen.
  achievements.push(
    buildAchievement({
      id: 'podium',
      title: 'Pallplass',
      description: 'Topp-3 på lista. Folk vet hvem du er.',
      category: 'Topp',
      icon: '🥇',
      targets: [1, 1, 1, 1],
      progress:
        Number.isFinite(leaderboardRank) && leaderboardRank > 0 && leaderboardRank <= 3 ? 1 : 0,
    }),
  );

  // 17) Stahet — minst 1 godkjent knute fra mappen og minst 1 avslag
  //     samtidig. Du gir aldri opp.
  const hasComeback = knots.length > 0 && computedRejectedCount > 0;
  achievements.push(
    buildAchievement({
      id: 'comeback',
      title: 'Aldri-gi-opp',
      description: 'Du har både fått avslag og kommet tilbake. Stahet > talent.',
      category: 'Karakter',
      icon: '🔁',
      targets: [1, 1, 1, 1],
      progress: hasComeback ? 1 : 0,
    }),
  );

  // 18) Heldiggris — vant uten å ha mest poeng (bare hvis duelsWon > 0).
  //     Egentlig en feire-første-duel-medal med skummel undertone.
  achievements.push(
    buildAchievement({
      id: 'first-blood',
      title: 'Førsteblod',
      description: 'Vant din første knute-off. Alle vil møte deg nå.',
      category: 'Milepæl',
      icon: '🩸',
      targets: [1, 1, 1, 1],
      progress: wonDuels > 0 ? 1 : 0,
    }),
  );

  // 19) Klubben for de med lange streaks — egen "fyrverkeri"-badge når
  //     streaken passerer en latterlig høy verdi. Adskilt fra Streak-konge
  //     for å gi noe å strekke seg mot.
  achievements.push(
    buildAchievement({
      id: 'streak-legend',
      title: 'Streak-legende',
      description: 'Brennende streak i 60+ dager. Hvem er du??',
      category: 'Streak',
      icon: '☄️',
      targets: [60, 60, 60, 60],
      progress: Math.max(0, Number(streakDays ?? 0)),
    }),
  );

  return achievements;
}

// Public API — keep the existing signatures so App.jsx, StatusPage and
// ProfilesPage callers keep working untouched.
//
// `knots` skal være _alle_ knuter i systemet (uavhengig av status). Vi
// teller opp totalt-per-mappe og total-i-system fra hele lista, og bruker
// kun status="Godkjent" som "progress" mot tier-målene.
export function buildAchievements(knots, currentLeader, meta = {}) {
  const allKnots = safeArray(knots);
  const approvedKnots = allKnots.filter((knot) => knot.status === 'Godkjent');
  const folderTotals = countKnotsByFolder(allKnots);
  const totalPoints = currentLeader?.points ?? 0;
  const leaderboardRank = Number(currentLeader?.rank);
  const streakDays = Number(meta.streakDays ?? meta.streak ?? currentLeader?.streak ?? 0);

  // Duel-stats
  const duelHistory = safeArray(meta.duelHistory);
  const currentUserId = meta.currentUserId ?? null;
  const myFinishedDuels = duelHistory.filter(
    (d) =>
      d &&
      d.status !== 'active' &&
      (d.challengerId === currentUserId || d.opponentId === currentUserId),
  );
  const duelsWon = myFinishedDuels.filter((d) => d.winnerId === currentUserId).length;
  const duelsLost = myFinishedDuels.length - duelsWon;

  return buildAchievementsFromInputs({
    approvedKnots,
    allKnots,
    folderTotals,
    systemTotalKnots: allKnots.length,
    totalPoints,
    leaderboardRank,
    totalLeaderboardCount: Number(meta.totalLeaderboardCount) || 0,
    streakDays,
    duelsWon,
    duelsLost,
    duelsTotal: myFinishedDuels.length,
  });
}

export function buildProfileAchievements(profile, meta = {}) {
  const profileKnots = safeArray(profile?.knots);
  // Profilsiden ser bare brukerens egne knuter — bruk meta hvis caller har
  // det globale knute-bildet, ellers fall tilbake til profilens egne så
  // achievement-er aldri viser umulige mål.
  const allKnots = safeArray(meta.allKnots ?? profileKnots);
  const folderTotals =
    meta.folderTotals instanceof Map
      ? meta.folderTotals
      : countKnotsByFolder(allKnots);
  const systemTotalKnots = Number.isFinite(meta.systemTotalKnots)
    ? meta.systemTotalKnots
    : allKnots.length;
  const totalPoints = profile?.points ?? 0;
  const leaderboardRank = Number(profile?.rank);
  const streakDays = Number(meta.streakDays ?? meta.streak ?? profile?.streak ?? 0);

  return buildAchievementsFromInputs({
    approvedKnots: profileKnots,
    allKnots,
    folderTotals,
    systemTotalKnots,
    totalPoints,
    leaderboardRank,
    totalLeaderboardCount: Number(meta.totalLeaderboardCount) || 0,
    streakDays,
    duelsWon: Number(meta.duelsWon) || 0,
    duelsLost: Number(meta.duelsLost) || 0,
    duelsTotal: Number(meta.duelsTotal) || 0,
  });
}

export function getUnlockedAchievements(achievements) {
  return safeArray(achievements).filter((achievement) => achievement.isUnlocked);
}

export function getFeaturedAchievements(achievements, count = 3) {
  return [...safeArray(achievements)]
    .filter((achievement) => achievement.currentTierIndex >= 0)
    .sort((left, right) => {
      if (right.currentTierIndex !== left.currentTierIndex) {
        return right.currentTierIndex - left.currentTierIndex;
      }
      if (right.progressPercent !== left.progressPercent) {
        return right.progressPercent - left.progressPercent;
      }
      return right.currentProgress - left.currentProgress;
    })
    .slice(0, count);
}

export { KNOT_FOLDERS };
