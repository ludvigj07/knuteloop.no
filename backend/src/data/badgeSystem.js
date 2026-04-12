export const GOLD_KNOT_POINTS = 30;

const TIER_META = [
  { key: 'bronze', label: 'Bronse', tone: 'amber' },
  { key: 'silver', label: 'Sølv', tone: 'slate' },
  { key: 'gold', label: 'Gull', tone: 'gold' },
  { key: 'diamond', label: 'Diamant', tone: 'sky' },
];

const FOOD_KEYWORDS = [
  'spis',
  'mat',
  'frokost',
  'lunsj',
  'middag',
  'banan',
  'nuggets',
  'sandwich',
  'club',
  'baka',
  'is',
  'pizza',
  'burger',
];

const PARTY_KEYWORDS = [
  'fest',
  'alkohol',
  'ol',
  'shot',
  'drikk',
  'bar',
  'edru',
  'rt',
  'snus',
  'royk',
  'røyk',
];

function normalizeValue(value) {
  return (value ?? '').trim().toLowerCase();
}

function getTierIndex(currentProgress, tiers) {
  let tierIndex = -1;

  tiers.forEach((tier, index) => {
    if (currentProgress >= tier.target) {
      tierIndex = index;
    }
  });

  return tierIndex;
}

function countMatchingKnots(knots, matcher) {
  return knots.filter((knot) => matcher(knot)).length;
}

function includesAnyKeyword(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

export function isGoldKnot(knot) {
  return (knot?.points ?? 0) >= GOLD_KNOT_POINTS;
}

function buildTieredAchievements(metrics) {
  const definitions = [
    {
      id: 'total-knots',
      title: 'Knutesamler',
      description: 'Jo flere godkjente knuter, jo hardere ser profilen din ut.',
      category: 'Totale knuter',
      icon: 'K',
      tiers: [3, 8, 15, 25],
      progress: metrics.totalKnots,
    },
    {
      id: 'point-club',
      title: 'Poengjager',
      description: 'Bygg totalpoeng og klatre mot de tyngste tierene.',
      category: 'Totale knuter',
      icon: 'P',
      tiers: [100, 200, 350, 500],
      progress: metrics.totalPoints,
    },
    {
      id: 'food-run',
      title: 'Matmodus',
      description: 'Samle matknuter og vis at du leverer på de rareste ideene.',
      category: 'Mat',
      icon: 'M',
      tiers: [1, 3, 5, 8],
      progress: metrics.foodKnots,
    },
    {
      id: 'social-run',
      title: 'Sosial motor',
      description: 'Knuter med folk rundt deg teller mot sosial status.',
      category: 'Sosial',
      icon: 'S',
      tiers: [2, 4, 7, 10],
      progress: metrics.socialKnots,
    },
    {
      id: 'school-run',
      title: 'Skolekaos',
      description: 'Skoleknuter bygger rykte når alt skjer i full offentlighet.',
      category: 'Skole',
      icon: 'Sk',
      tiers: [1, 3, 6, 9],
      progress: metrics.schoolKnots,
    },
    {
      id: 'party-run',
      title: 'Festpuls',
      description: 'Festknuter viser at du faktisk er med når ting skjer.',
      category: 'Fest',
      icon: 'F',
      tiers: [1, 2, 4, 6],
      progress: metrics.partyKnots,
    },
    {
      id: 'gold-run',
      title: 'Gullknute-jeger',
      description: `Knuter på ${GOLD_KNOT_POINTS}+ poeng bygger de mest imponerende tierene.`,
      category: 'Totale knuter',
      icon: 'G',
      tiers: [1, 2, 4, 6],
      progress: metrics.goldKnots,
    },
  ];

  return definitions.map((definition) => {
    const tiers = definition.tiers.map((target, index) => ({
      ...TIER_META[index],
      target,
    }));
    const currentTierIndex = getTierIndex(definition.progress, tiers);
    const currentTier = currentTierIndex >= 0 ? tiers[currentTierIndex] : null;
    const nextTier = tiers[currentTierIndex + 1] ?? null;
    const progressTarget = nextTier?.target ?? tiers[tiers.length - 1].target;
    const progressPercent =
      progressTarget > 0
        ? Math.min(Math.round((definition.progress / progressTarget) * 100), 100)
        : 0;

    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      category: definition.category,
      icon: definition.icon,
      currentProgress: definition.progress,
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
    };
  });
}

function buildAchievementMetricsFromKnots(knots, totalPoints) {
  const approvedKnots = knots.filter(Boolean);
  const foodKnots = countMatchingKnots(approvedKnots, (knot) =>
    includesAnyKeyword(
      `${normalizeValue(knot.title)} ${normalizeValue(knot.description)}`,
      FOOD_KEYWORDS,
    ),
  );
  const socialKnots = countMatchingKnots(approvedKnots, (knot) => {
    const combined = `${normalizeValue(knot.title)} ${normalizeValue(knot.description)}`;
    const category = normalizeValue(knot.category);

    return (
      category.includes('sosial') ||
      category.includes('gruppe') ||
      category.includes('event') ||
      combined.includes('klasse') ||
      combined.includes('venn') ||
      combined.includes('gjengen') ||
      combined.includes('medruss')
    );
  });
  const schoolKnots = countMatchingKnots(approvedKnots, (knot) => {
    const combined = `${normalizeValue(knot.title)} ${normalizeValue(knot.description)}`;
    const category = normalizeValue(knot.category);

    return (
      category.includes('skole') ||
      combined.includes('skole') ||
      combined.includes('time') ||
      combined.includes('klasserom') ||
      combined.includes('lærer') ||
      combined.includes('presentasjon')
    );
  });
  const partyKnots = countMatchingKnots(approvedKnots, (knot) =>
    includesAnyKeyword(
      `${normalizeValue(knot.title)} ${normalizeValue(knot.description)} ${normalizeValue(knot.category)}`,
      PARTY_KEYWORDS,
    ),
  );
  const goldKnots = approvedKnots.filter(isGoldKnot).length;

  return {
    totalKnots: approvedKnots.length,
    totalPoints,
    foodKnots,
    socialKnots,
    schoolKnots,
    partyKnots,
    goldKnots,
  };
}

export function buildAchievements(knots, currentLeader) {
  const approvedKnots = knots.filter((knot) => knot.status === 'Godkjent');
  const totalPoints = currentLeader?.points ?? 0;

  return buildTieredAchievements(
    buildAchievementMetricsFromKnots(approvedKnots, totalPoints),
  );
}

export function buildProfileAchievements(profile) {
  const profileKnots = profile?.knots ?? [];
  const totalPoints = profile?.points ?? 0;

  return buildTieredAchievements(
    buildAchievementMetricsFromKnots(profileKnots, totalPoints),
  );
}

export function getUnlockedAchievements(achievements) {
  return achievements.filter((achievement) => achievement.isUnlocked);
}

export function getFeaturedAchievements(achievements, count = 3) {
  return [...achievements]
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
