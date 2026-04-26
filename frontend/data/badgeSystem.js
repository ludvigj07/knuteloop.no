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
  folderTotals,
  systemTotalKnots,
  totalPoints,
  leaderboardRank,
  streakDays,
}) {
  const knots = safeArray(approvedKnots);
  const folderCounts = countKnotsByFolder(knots);
  const goldKnotsCount = knots.filter(isGoldKnot).length;
  const folderTotalsMap = folderTotals instanceof Map ? folderTotals : new Map();
  const systemTotal = Math.max(0, Number(systemTotalKnots) || 0);

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

  return buildAchievementsFromInputs({
    approvedKnots,
    folderTotals,
    systemTotalKnots: allKnots.length,
    totalPoints,
    leaderboardRank,
    streakDays,
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
    folderTotals,
    systemTotalKnots,
    totalPoints,
    leaderboardRank,
    streakDays,
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
