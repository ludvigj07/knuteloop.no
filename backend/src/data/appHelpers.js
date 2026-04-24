import { normalizeKnotFolder } from './knotFolders.js';

export const DUEL_STAKE = 10;
export const DUEL_RANGE = 5;
export const DUEL_WINDOW_HOURS = 24;
export const DUEL_DAILY_LIMIT = 1;
export const DUEL_LIMITS_DISABLED = true;
export const MODERATION_POLICY = Object.freeze({
  noLimits: true,
  noBotOrAntiSpamLogicNow: true,
  manualFeedModerationFirst: true,
  addMinimalCooldownOnlyIfAbuseAppears: true,
});
export const GENDER_SEGMENTS = Object.freeze({
  GIRL: 'girl',
  BOY: 'boy',
  OTHER: 'other',
});

const GENDER_IDENTITY_ALIASES = Object.freeze({
  girl: GENDER_SEGMENTS.GIRL,
  jente: GENDER_SEGMENTS.GIRL,
  female: GENDER_SEGMENTS.GIRL,
  boy: GENDER_SEGMENTS.BOY,
  gutt: GENDER_SEGMENTS.BOY,
  male: GENDER_SEGMENTS.BOY,
  other: GENDER_SEGMENTS.OTHER,
  annet: GENDER_SEGMENTS.OTHER,
});

function normalizeGenderIdentity(value) {
  if (typeof value !== 'string') {
    return GENDER_SEGMENTS.OTHER;
  }

  const normalizedValue = value.trim().toLowerCase();
  return GENDER_IDENTITY_ALIASES[normalizedValue] ?? GENDER_SEGMENTS.OTHER;
}

export function getLeaderboardTitle(rank) {
  if (!Number.isFinite(rank) || rank < 1) {
    return 'Knutekatastrofen';
  }

  if (rank === 1) {
    return "O' Store Knutemester";
  }

  if (rank <= 3) {
    return 'Knutemester';
  }

  if (rank <= 10) {
    return 'Knutebaron';
  }

  if (rank <= 20) {
    return 'Knuteridder';
  }

  if (rank <= 35) {
    return 'Knutesersjant';
  }

  if (rank <= 55) {
    return 'Knuteknekt';
  }

  if (rank <= 80) {
    return 'Knutelærling';
  }

  if (rank <= 110) {
    return 'Knuteamatør';
  }

  if (rank <= 145) {
    return 'Knuteprøvling';
  }

  if (rank <= 185) {
    return 'Knutetabbe';
  }

  if (rank <= 220) {
    return 'Knutenybegynner';
  }

  return 'Knutekatastrofen';
}

function getDuelAdjustmentMap(duels) {
  return duels.reduce((accumulator, duel) => {
    if (duel.status !== 'resolved') {
      return accumulator;
    }

    const stake = duel.stake ?? DUEL_STAKE;
    const challenger = accumulator[duel.challengerId] ?? {
      points: 0,
      wins: 0,
      losses: 0,
      splits: 0,
      expiries: 0,
    };
    const opponent = accumulator[duel.opponentId] ?? {
      points: 0,
      wins: 0,
      losses: 0,
      splits: 0,
      expiries: 0,
    };

    if (duel.result === 'challenger-wins') {
      accumulator[duel.challengerId] = {
        ...challenger,
        points: challenger.points + stake,
        wins: challenger.wins + 1,
      };
      accumulator[duel.opponentId] = {
        ...opponent,
        points: opponent.points - stake,
        losses: opponent.losses + 1,
      };
      return accumulator;
    }

    if (duel.result === 'opponent-wins') {
      accumulator[duel.challengerId] = {
        ...challenger,
        points: challenger.points - stake,
        losses: challenger.losses + 1,
      };
      accumulator[duel.opponentId] = {
        ...opponent,
        points: opponent.points + stake,
        wins: opponent.wins + 1,
      };
      return accumulator;
    }

    if (duel.result === 'split') {
      const splitReward = stake / 2;
      accumulator[duel.challengerId] = {
        ...challenger,
        points: challenger.points + splitReward,
        splits: challenger.splits + 1,
      };
      accumulator[duel.opponentId] = {
        ...opponent,
        points: opponent.points + splitReward,
        splits: opponent.splits + 1,
      };
      return accumulator;
    }

    if (duel.result === 'no-completion') {
      const noCompletionPenalty = stake / 2;
      accumulator[duel.challengerId] = {
        ...challenger,
        points: challenger.points - noCompletionPenalty,
        expiries: challenger.expiries + 1,
      };
      accumulator[duel.opponentId] = {
        ...opponent,
        points: opponent.points - noCompletionPenalty,
        expiries: opponent.expiries + 1,
      };
    }

    return accumulator;
  }, {});
}

export function buildLeaderboard(
  leaders,
  submissions,
  knots,
  currentUserId,
  duels = [],
) {
  const bonusByLeader = submissions.reduce((accumulator, submission) => {
    if (
      submission.status !== 'Godkjent' ||
      submission.leaderId === currentUserId
    ) {
      return accumulator;
    }

    const existing = accumulator[submission.leaderId] ?? {
      points: 0,
      completedKnots: 0,
    };

    accumulator[submission.leaderId] = {
      points: existing.points + submission.points,
      completedKnots: existing.completedKnots + 1,
    };

    return accumulator;
  }, {});

  const currentUserApprovedKnots = knots.filter(
    (knot) => knot.status === 'Godkjent',
  );
  const currentUserApprovedSubmissions = submissions.filter(
    (submission) =>
      submission.status === 'Godkjent' && submission.leaderId === currentUserId,
  );
  const currentUserApprovedSubmissionKnotIds = new Set(
    currentUserApprovedSubmissions
      .map((submission) => submission.knotId)
      .filter(Boolean),
  );
  const duelAdjustments = getDuelAdjustmentMap(duels);
  const currentUserSubmissionPoints = currentUserApprovedSubmissions.reduce(
    (total, submission) => total + Number(submission.points ?? 0),
    0,
  );
  const currentUserLegacyOnlyPoints = currentUserApprovedKnots
    .filter((knot) => !currentUserApprovedSubmissionKnotIds.has(knot.id))
    .reduce((total, knot) => total + Number(knot.points ?? 0), 0);
  const currentUserPoints = currentUserSubmissionPoints + currentUserLegacyOnlyPoints;
  const currentUserCompletedKnots = currentUserApprovedKnots.length;

  return leaders
    .map((leader) => {
      const bonus = bonusByLeader[leader.id] ?? { points: 0, completedKnots: 0 };
      const duelAdjustment = duelAdjustments[leader.id] ?? {
        points: 0,
        wins: 0,
        losses: 0,
      };

      if (leader.id === currentUserId) {
        return {
          ...leader,
          points: leader.basePoints + currentUserPoints + duelAdjustment.points,
          completedKnots: leader.baseCompletedKnots + currentUserCompletedKnots,
          duelPointDelta: duelAdjustment.points,
          duelWins: duelAdjustment.wins,
          duelLosses: duelAdjustment.losses,
          duelSplits: duelAdjustment.splits,
          duelExpiries: duelAdjustment.expiries,
        };
      }

      return {
        ...leader,
        points: leader.basePoints + bonus.points + duelAdjustment.points,
        completedKnots: leader.baseCompletedKnots + bonus.completedKnots,
        duelPointDelta: duelAdjustment.points,
        duelWins: duelAdjustment.wins,
        duelLosses: duelAdjustment.losses,
        duelSplits: duelAdjustment.splits,
        duelExpiries: duelAdjustment.expiries,
      };
    })
    .sort((left, right) => {
      if (right.points !== left.points) {
        return right.points - left.points;
      }

      return right.completedKnots - left.completedKnots;
    })
    .map((leader, index) => {
      const rank = index + 1;

      return {
        ...leader,
        rank,
        leaderboardTitle: getLeaderboardTitle(rank),
      };
    });
}

function normalizeClassName(leader) {
  const className =
    leader?.className ??
    leader?.group ??
    leader?.profile?.className ??
    '';
  const normalizedToken = String(className)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  if (!normalizedToken) {
    return '';
  }

  if (/^[a-h]$/.test(normalizedToken)) {
    return `st${normalizedToken}`;
  }

  if (/^st[a-h]$/.test(normalizedToken)) {
    return normalizedToken;
  }

  const stMatch = normalizedToken.match(/(?:^|[0-9])st([a-h])(?:[0-9]|$)/);
  if (stMatch) {
    return `st${stMatch[1]}`;
  }

  if (/^ib[1-4]$/.test(normalizedToken)) {
    const ibIndex = Number(normalizedToken.slice(2));
    const ibLetter = ['a', 'b', 'c', 'd'][ibIndex - 1];
    return `ib${ibLetter}`;
  }

  const ibNumberMatch = normalizedToken.match(/(?:^|[0-9])ib([1-4])(?:[0-9]|$)/);
  if (ibNumberMatch) {
    const ibLetter = ['a', 'b', 'c', 'd'][Number(ibNumberMatch[1]) - 1];
    return `ib${ibLetter}`;
  }

  if (/^ib[a-d]$/.test(normalizedToken)) {
    return normalizedToken;
  }

  const ibLetterMatch = normalizedToken.match(/(?:^|[0-9])ib([a-d])(?:[0-9]|$)/);
  if (ibLetterMatch) {
    return `ib${ibLetterMatch[1]}`;
  }

  return '';
}

export function buildClassLeaderboard(leaders = []) {
  const classTokenOrder = [
    'sta',
    'stb',
    'stc',
    'std',
    'ste',
    'stf',
    'stg',
    'sth',
    'iba',
    'ibb',
    'ibc',
    'ibd',
  ];
  const classLabelByToken = {
    sta: 'STA',
    stb: 'STB',
    stc: 'STC',
    std: 'STD',
    ste: 'STE',
    stf: 'STF',
    stg: 'STG',
    sth: 'STH',
    iba: 'IBA',
    ibb: 'IBB',
    ibc: 'IBC',
    ibd: 'IBD',
  };
  const classMap = new Map(
    classTokenOrder.map((token) => [
      classLabelByToken[token],
      {
        className: classLabelByToken[token],
        members: 0,
        totalPoints: 0,
        totalCompletedKnots: 0,
      },
    ]),
  );

  leaders.forEach((leader) => {
    const classToken = normalizeClassName(leader);
    const className = classLabelByToken[classToken];

    if (!className) {
      return;
    }

    const existing = classMap.get(className);

    existing.members += 1;
    existing.totalPoints += Number(leader?.points ?? 0);
    existing.totalCompletedKnots += Number(leader?.completedKnots ?? 0);
    classMap.set(className, existing);
  });

  return [...classMap.values()]
    .map((entry) => ({
      ...entry,
      avgPoints: entry.members > 0 ? entry.totalPoints / entry.members : 0,
    }))
    .sort((left, right) => {
      if (right.avgPoints !== left.avgPoints) {
        return right.avgPoints - left.avgPoints;
      }

      if (right.totalPoints !== left.totalPoints) {
        return right.totalPoints - left.totalPoints;
      }

      if (right.members !== left.members) {
        return right.members - left.members;
      }

      return left.className.localeCompare(right.className, 'nb');
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}

function normalizeCategory(value) {
  const normalized = String(value ?? '').trim();
  return normalized || 'Ukjent';
}

export function buildKnotTypeLeaderboard(submissions = [], knots = []) {
  const knotCategoryById = knots.reduce((accumulator, knot) => {
    accumulator[knot.id] = normalizeCategory(knot.category);
    return accumulator;
  }, {});
  const categoryMap = new Map();

  submissions
    .filter((submission) => submission?.status === 'Godkjent')
    .forEach((submission) => {
      const category = normalizeCategory(
        submission?.knotCategory ?? knotCategoryById[submission?.knotId],
      );
      const existing = categoryMap.get(category) ?? {
        category,
        approvedCount: 0,
        totalPoints: 0,
        participantIds: new Set(),
      };

      existing.approvedCount += 1;
      existing.totalPoints += Number(submission?.points ?? 0);
      if (Number.isInteger(Number(submission?.leaderId))) {
        existing.participantIds.add(Number(submission.leaderId));
      }
      categoryMap.set(category, existing);
    });

  return [...categoryMap.values()]
    .map((entry) => ({
      category: entry.category,
      approvedCount: entry.approvedCount,
      totalPoints: entry.totalPoints,
      participantCount: entry.participantIds.size,
    }))
    .sort((left, right) => {
      if (right.approvedCount !== left.approvedCount) {
        return right.approvedCount - left.approvedCount;
      }

      if (right.totalPoints !== left.totalPoints) {
        return right.totalPoints - left.totalPoints;
      }

      if (right.participantCount !== left.participantCount) {
        return right.participantCount - left.participantCount;
      }

      return left.category.localeCompare(right.category, 'nb');
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}

export function buildGenderLeaderboards(leaders = []) {
  const participants = leaders
    .map((leader) => ({
      ...leader,
      genderIdentity: normalizeGenderIdentity(leader?.genderIdentity),
    }));

  function rankEntries(filteredLeaders) {
    return [...filteredLeaders]
      .sort((left, right) => {
        if ((right.points ?? 0) !== (left.points ?? 0)) {
          return (right.points ?? 0) - (left.points ?? 0);
        }

        if ((right.completedKnots ?? 0) !== (left.completedKnots ?? 0)) {
          return (right.completedKnots ?? 0) - (left.completedKnots ?? 0);
        }

        return (left.russName ?? left.name ?? '').localeCompare(
          right.russName ?? right.name ?? '',
          'nb',
        );
      })
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));
  }

  return {
    [GENDER_SEGMENTS.GIRL]: rankEntries(
      participants.filter((entry) => entry.genderIdentity === GENDER_SEGMENTS.GIRL),
    ),
    [GENDER_SEGMENTS.BOY]: rankEntries(
      participants.filter((entry) => entry.genderIdentity === GENDER_SEGMENTS.BOY),
    ),
    [GENDER_SEGMENTS.OTHER]: rankEntries(
      participants.filter((entry) => entry.genderIdentity === GENDER_SEGMENTS.OTHER),
    ),
  };
}

function getStartOfDay(date = new Date()) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);

  return nextDate;
}

function getDuelEndDate(duel) {
  return new Date(duel.resolvedAt ?? duel.deadlineAt ?? duel.createdAt);
}

function countDailyDuelsForLeader(duels, leaderId, now = new Date()) {
  const dayStart = getStartOfDay(now);

  return duels.filter((duel) => {
    const createdAt = new Date(duel.createdAt);
    const involvesLeader =
      duel.challengerId === leaderId || duel.opponentId === leaderId;

    return involvesLeader && createdAt >= dayStart;
  }).length;
}

function getLatestPairDuel(duels, firstLeaderId, secondLeaderId) {
  const pair = [firstLeaderId, secondLeaderId].sort((left, right) => left - right);

  return duels
    .filter((duel) => {
      const duelPair = [duel.challengerId, duel.opponentId].sort(
        (left, right) => left - right,
      );

      return duelPair[0] === pair[0] && duelPair[1] === pair[1];
    })
    .sort((left, right) => getDuelEndDate(right).getTime() - getDuelEndDate(left).getTime())[0];
}

function formatDuelDate(dateValue) {
  return new Date(dateValue).toLocaleString('nb-NO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCompletionStatus(dateValue, completionApproved) {
  if (!dateValue) {
    return 'Ikke fullført';
  }

  if (completionApproved === false) {
    return `Underkjent av admin (${formatDuelDate(dateValue)})`;
  }

  if (completionApproved === true) {
    return `Godkjent ${formatDuelDate(dateValue)}`;
  }

  return `Fullført ${formatDuelDate(dateValue)}`;
}

function buildDuelOutcomeMeta(duel, challengerName, opponentName) {
  const stake = duel.stake ?? DUEL_STAKE;
  const splitReward = stake / 2;
  const noCompletionPenalty = stake / 2;

  if (duel.result === 'challenger-wins') {
    return {
      title: `${challengerName} vant hele potten`,
      detail: `${challengerName} fullførte før ${opponentName}.`,
      pointLabel: `+${stake} / -${stake}`,
    };
  }

  if (duel.result === 'opponent-wins') {
    return {
      title: `${opponentName} vant hele potten`,
      detail: `${opponentName} fullførte før ${challengerName}.`,
      pointLabel: `+${stake} / -${stake}`,
    };
  }

  if (duel.result === 'split') {
    return {
      title: 'Begge fullførte knuten',
      detail: 'Begge fikk halv pott for fullført knute-off.',
      pointLabel: `+${splitReward} / +${splitReward}`,
    };
  }

  return {
    title: 'Ingen godkjent fullføring',
    detail: 'Begge taper halv innsats i denne knute-offen.',
    pointLabel: `-${noCompletionPenalty} / -${noCompletionPenalty}`,
  };
}

export function pickDuelKnot(knots, duels) {
  const activeKnotIds = new Set(
    duels
      .filter((duel) => duel.status === 'active')
      .map((duel) => duel.knotId),
  );
  const availableKnots = knots
    .filter(
      (knot) =>
        (knot.status === 'Tilgjengelig' || knot.status === 'Avslått') &&
        !activeKnotIds.has(knot.id),
    )
    .sort((left, right) => {
      if (right.points !== left.points) {
        return right.points - left.points;
      }

      return (
        getDifficultyWeight(left.difficulty) -
        getDifficultyWeight(right.difficulty)
      );
    });

  return availableKnots[0] ?? null;
}

export function buildDuelAvailability(
  currentUserId,
  leaders,
  duels,
  now = new Date(),
) {
  const currentLeader = leaders.find((leader) => leader.id === currentUserId);
  const currentUserDailyCount = countDailyDuelsForLeader(
    duels,
    currentUserId,
    now,
  );
  const availabilityByLeaderId = {};
  const dayStart = getStartOfDay(now);
  const thisDayTotal = duels.filter(
    (duel) => new Date(duel.createdAt) >= dayStart,
  ).length;
  const activeDuelForCurrentUser = duels.find(
    (duel) =>
      duel.status === 'active' &&
      (duel.challengerId === currentUserId || duel.opponentId === currentUserId),
  );

  leaders.forEach((leader) => {
    if (leader.id === currentUserId) {
      availabilityByLeaderId[leader.id] = {
        canChallenge: false,
        reason: 'Dette er deg',
      };
      return;
    }

    const rankGap = Math.abs((currentLeader?.rank ?? 0) - leader.rank);
    const opponentDailyCount = countDailyDuelsForLeader(duels, leader.id, now);
    const activeDuelForOpponent = duels.find(
      (duel) =>
        duel.status === 'active' &&
        (duel.challengerId === leader.id || duel.opponentId === leader.id),
    );
    const activePairDuel = duels.find((duel) => {
      const pair = [duel.challengerId, duel.opponentId].sort(
        (left, right) => left - right,
      );
      const currentPair = [currentUserId, leader.id].sort(
        (left, right) => left - right,
      );

      return (
        duel.status === 'active' &&
        pair[0] === currentPair[0] &&
        pair[1] === currentPair[1]
      );
    });

    let reason = `Fast innsats: ${DUEL_STAKE} poeng`;
    let canChallenge = true;

    if (rankGap > DUEL_RANGE) {
      canChallenge = false;
      reason = 'Kan bare utfordre brukere innenfor 5 plasser.';
    } else if (!DUEL_LIMITS_DISABLED && activePairDuel) {
      canChallenge = false;
      reason = 'Dere har allerede en aktiv knute-off.';
    } else if (!DUEL_LIMITS_DISABLED && activeDuelForCurrentUser) {
      canChallenge = false;
      reason = 'Du har allerede en aktiv knute-off.';
    } else if (!DUEL_LIMITS_DISABLED && activeDuelForOpponent) {
      canChallenge = false;
      reason = `${leader.russName ?? leader.name} er allerede i en aktiv knute-off.`;
    } else if (!DUEL_LIMITS_DISABLED && currentUserDailyCount >= DUEL_DAILY_LIMIT) {
      canChallenge = false;
      reason = 'Du har brukt dagens knute-off.';
    } else if (!DUEL_LIMITS_DISABLED && opponentDailyCount >= DUEL_DAILY_LIMIT) {
      canChallenge = false;
      reason = `${leader.russName ?? leader.name} har brukt dagens knute-off.`;
    }

    availabilityByLeaderId[leader.id] = {
      canChallenge,
      reason,
      activeDuelId: activePairDuel?.id ?? null,
      rankGap,
      opponentDailyCount,
    };
  });

  return {
    byLeaderId: availabilityByLeaderId,
    currentUserDailyCount,
    currentUserRemaining: DUEL_LIMITS_DISABLED
      ? Number.MAX_SAFE_INTEGER
      : Math.max(DUEL_DAILY_LIMIT - currentUserDailyCount, 0),
    thisDayTotal,
    currentUserWeeklyCount: currentUserDailyCount,
    thisWeekTotal: thisDayTotal,
  };
}

export function buildDuelHistory(duels, leaders) {
  const leaderById = leaders.reduce((accumulator, leader) => {
    accumulator[leader.id] = leader;
    return accumulator;
  }, {});

  return [...duels]
    .sort(
      (left, right) => getDuelEndDate(right).getTime() - getDuelEndDate(left).getTime(),
    )
    .map((duel) => {
      const challenger = leaderById[duel.challengerId];
      const opponent = leaderById[duel.opponentId];
      const challengerName = challenger?.russName ?? challenger?.name ?? 'Ukjent';
      const opponentName = opponent?.russName ?? opponent?.name ?? 'Ukjent';
      const outcomeMeta =
        duel.status === 'resolved'
          ? buildDuelOutcomeMeta(duel, challengerName, opponentName)
          : null;

      return {
        ...duel,
        challengerName,
        opponentName,
        challengerStatusLabel: formatCompletionStatus(
          duel.challengerCompletedAt,
          duel.challengerCompletionApproved,
        ),
        opponentStatusLabel: formatCompletionStatus(
          duel.opponentCompletedAt,
          duel.opponentCompletionApproved,
        ),
        createdAtLabel: formatDuelDate(duel.createdAt),
        deadlineLabel: formatDuelDate(duel.deadlineAt),
        resolvedAtLabel: duel.resolvedAt ? formatDuelDate(duel.resolvedAt) : '',
        outcomeTitle: outcomeMeta?.title ?? 'Aktiv knute-off',
        outcomeDetail:
          outcomeMeta?.detail ??
          'Venter på fullføring eller avgjøring i admin-prototypen.',
        pointLabel: outcomeMeta?.pointLabel ?? `Potten er ${duel.stake * 2} poeng`,
      };
    });
}

export function buildImportedKnots(
  rawText,
  defaultPoints,
  defaultFolder,
  existingKnots,
  description,
) {
  const seenTitles = new Set(
    existingKnots.map((knot) => knot.title.trim().toLowerCase()),
  );
  const lines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const batchId = Date.now();
  const safePoints = Math.max(0, Number(defaultPoints) || 0);
  const nextKnots = [];
  let skipped = 0;

  lines.forEach((title, index) => {
    const normalizedTitle = title.toLowerCase();

    if (seenTitles.has(normalizedTitle)) {
      skipped += 1;
      return;
    }

    seenTitles.add(normalizedTitle);
    nextKnots.push({
      id: `imported-${batchId}-${index}`,
      title,
      description: description?.trim() ?? '',
      category: 'Egendefinert',
      folder: normalizeKnotFolder(defaultFolder),
      points: safePoints,
      difficulty: 'Valgfri',
      status: 'Tilgjengelig',
    });
  });

  return {
    added: nextKnots.length,
    skipped,
    knots: nextKnots,
  };
}

function getProfileIcon(name, configuredIcon) {
  const trimmedIcon = configuredIcon?.trim();

  if (trimmedIcon) {
    return trimmedIcon.slice(0, 2);
  }

  return name.slice(0, 2).toUpperCase();
}

export function buildProfiles(
  leaders,
  currentUserId,
  knots,
  submissions,
  profileHistory,
  profileDetails,
) {
  return leaders.map((leader) => {
    const baseKnots = (profileHistory[leader.id] ?? []).map((knot) => ({
      ...knot,
      source: 'history',
    }));
    const details = profileDetails[leader.id] ?? {};
    const approvedSubmissions = submissions
      .filter(
        (submission) =>
          submission.leaderId === leader.id && submission.status === 'Godkjent',
      )
      .map((submission) => ({
        id: `submission-${submission.id}`,
        submissionId: submission.id,
        title: submission.knotTitle,
        category: 'Innsendt',
        points: submission.points,
        completedAt: submission.submittedAt,
        source: 'submission',
        submissionMode: submission.submissionMode ?? 'review',
        profileHidden: submission.profileHidden ?? false,
      }));

    const currentUserKnots =
      leader.id === currentUserId
        ? knots
            .filter((knot) => knot.status === 'Godkjent')
            .map((knot) => ({
              id: knot.id,
              title: knot.title,
              category: knot.category,
              points: knot.points,
              completedAt: 'Godkjent i demoen',
              source: 'current-user',
            }))
        : [];

    const seenTitles = new Set();
    const mergedKnots = [...approvedSubmissions, ...currentUserKnots, ...baseKnots]
      .filter((knot) => {
        const key = knot.title.trim().toLowerCase();

        if (seenTitles.has(key)) {
          return false;
        }

        seenTitles.add(key);
        return true;
      });

    const visibleKnots = mergedKnots.filter(
      (knot) => leader.id === currentUserId || !knot.profileHidden,
    );

    return {
      ...leader,
      leaderboardTitle: leader.leaderboardTitle,
      icon: getProfileIcon(details.russName ?? leader.name, details.icon),
      photoUrl: details.photoUrl ?? '',
      russName: details.russName ?? leader.name,
      realName: details.realName ?? leader.name,
      className: details.className ?? leader.group,
      tagline: details.quote ?? details.knownFor ?? 'Ingen tekst lagt til ennå.',
      bio: details.bio ?? 'Ingen bio lagt til ennå.',
      quote: details.quote ?? 'Ingen quote lagt til ennå.',
      knownFor: details.knownFor ?? 'Ikke satt ennå.',
      signatureKnot: details.signatureKnot ?? 'Ingen signaturknute valgt.',
      favoriteCategory: details.favoriteCategory ?? 'Ikke valgt',
      russType: details.russType ?? 'blue',
      genderIdentity: normalizeGenderIdentity(details.genderIdentity),
      knots: visibleKnots,
    };
  });
}

function scoreCompletedAt(completedAt) {
  const normalizedValue = (completedAt ?? '').trim().toLowerCase();

  if (
    normalizedValue.includes('nettopp') ||
    normalizedValue.includes('i dag')
  ) {
    return 4;
  }

  if (normalizedValue.includes('i går')) {
    return 3;
  }

  if (
    normalizedValue.includes('forrige uke') ||
    normalizedValue.includes('godkjent i demoen')
  ) {
    return 2;
  }

  if (normalizedValue) {
    return 1;
  }

  return 0;
}

export function buildActivityLog(profiles, submissions = []) {
  const submissionEntries = submissions
    .filter((submission) => submission.status === 'Godkjent')
    .map((submission, index) => {
      const profile =
        profiles.find((candidate) => candidate.id === submission.leaderId) ?? {};
      const normalizedSubmissionMode =
        submission.submissionMode === 'feed' ||
        submission.submissionMode === 'anonymous-feed' ||
        submission.submissionMode === 'review'
          ? submission.submissionMode
          : submission.isAnonymousFeed
            ? 'anonymous-feed'
            : 'feed';
      const isAnonymous =
        submission.isAnonymousFeed === true ||
        normalizedSubmissionMode === 'anonymous-feed';
      const shareDetails = normalizedSubmissionMode !== 'review';

      return {
        id: `submission-${submission.id}`,
        submissionId: submission.id,
        submittedAtRaw: submission.submittedAtRaw ?? null,
        studentId: submission.leaderId,
        studentName: isAnonymous
          ? 'Anonym'
          : profile.russName ?? submission.student,
        studentRealName: isAnonymous
          ? 'Skjult bruker'
          : profile.realName ?? submission.student,
        studentIcon: isAnonymous ? 'ðŸ‘¤' : profile.icon ?? '',
        studentPhotoUrl: isAnonymous ? '' : profile.photoUrl ?? '',
        studentGroup: isAnonymous
          ? 'Anonym post'
          : profile.className ?? profile.group ?? '',
        knotTitle: submission.knotTitle,
        category: 'Innsendt',
        completedAt: submission.submittedAt ?? 'Godkjent',
        points: submission.points ?? 0,
        note: shareDetails ? submission.note ?? '' : '',
        imagePreviewUrl: shareDetails ? submission.imagePreviewUrl ?? '' : '',
        videoPreviewUrl: shareDetails ? submission.videoPreviewUrl ?? '' : '',
        mediaType: shareDetails
          ? submission.videoPreviewUrl
            ? 'video'
            : submission.imagePreviewUrl
              ? 'image'
              : 'none'
          : 'none',
        imageName: shareDetails ? submission.imageName ?? '' : '',
        videoName: shareDetails ? submission.videoName ?? '' : '',
        hasMedia: shareDetails
          ? Boolean(submission.imagePreviewUrl || submission.videoPreviewUrl)
          : false,
        shareDetails,
        isAnonymous,
        ratingAverage:
          Number.isFinite(Number(submission.ratingAverage))
            ? Number(submission.ratingAverage)
            : 0,
        ratingCount:
          Number.isFinite(Number(submission.ratingCount))
            ? Number(submission.ratingCount)
            : 0,
        myRating:
          Number.isInteger(Number(submission.myRating)) &&
          Number(submission.myRating) >= 1 &&
          Number(submission.myRating) <= 5
            ? Number(submission.myRating)
            : null,
        sortScore: 1000 - index,
      };
    });

  const seenSubmissionKeys = new Set(
    submissionEntries.map(
      (entry) => `${entry.studentId}-${entry.knotTitle.trim().toLowerCase()}`,
    ),
  );
  const fallbackProfileEntries = profiles.flatMap((profile) =>
    profile.knots
      .filter((knot) => {
        if (knot.source && knot.source !== 'history') {
          return false;
        }

        const key = `${profile.id}-${knot.title.trim().toLowerCase()}`;

        return !seenSubmissionKeys.has(key);
      })
      .map((knot, index) => ({
        id: `${profile.id}-${knot.id ?? knot.title}-${index}`,
        submissionId: null,
        submittedAtRaw: null,
        studentId: profile.id,
        studentName: profile.russName ?? profile.name,
        studentRealName: profile.realName ?? profile.name,
        studentIcon: profile.icon,
        studentPhotoUrl: profile.photoUrl ?? '',
        studentGroup: profile.group,
        knotTitle: knot.title,
        category: knot.category,
        completedAt: knot.completedAt ?? 'Godkjent',
        points: knot.points ?? 0,
        note: '',
        imagePreviewUrl: '',
        videoPreviewUrl: '',
        mediaType: 'none',
        imageName: '',
        videoName: '',
        hasMedia: false,
        isAnonymous: false,
        ratingAverage: 0,
        ratingCount: 0,
        myRating: null,
        sortScore: scoreCompletedAt(knot.completedAt),
      })),
  );

  return [...submissionEntries, ...fallbackProfileEntries].sort((left, right) => {
    if (right.sortScore !== left.sortScore) {
      return right.sortScore - left.sortScore;
    }

    if (Number(right.hasMedia) !== Number(left.hasMedia)) {
      return Number(right.hasMedia) - Number(left.hasMedia);
    }

    if (right.points !== left.points) {
      return right.points - left.points;
    }

    return left.studentName.localeCompare(right.studentName, 'nb');
  });
}

const WEEKLY_POST_MIN_RATINGS = 10;
const WEEKLY_POST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function toValidTimestamp(value) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function buildWeeklyTopPost(activityLog, now = Date.now()) {
  const weeklyCutoff = now - WEEKLY_POST_WINDOW_MS;

  const candidates = activityLog
    .filter((entry) => entry?.submissionId)
    .map((entry) => {
      const ratingAverage = Number(entry.ratingAverage) || 0;
      const ratingCount = Number(entry.ratingCount) || 0;

      if (ratingCount < WEEKLY_POST_MIN_RATINGS) {
        return null;
      }

      const submittedAtTimestamp = toValidTimestamp(entry.submittedAtRaw);
      if (submittedAtTimestamp != null && submittedAtTimestamp < weeklyCutoff) {
        return null;
      }

      const score = ratingAverage * Math.log10(ratingCount + 1);

      return {
        ...entry,
        weeklyScore: score,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (right.weeklyScore !== left.weeklyScore) {
        return right.weeklyScore - left.weeklyScore;
      }

      if (right.ratingAverage !== left.ratingAverage) {
        return right.ratingAverage - left.ratingAverage;
      }

      if (right.ratingCount !== left.ratingCount) {
        return right.ratingCount - left.ratingCount;
      }

      return (right.points ?? 0) - (left.points ?? 0);
    });

  const winner = candidates[0] ?? null;

  if (!winner) {
    return null;
  }

  return {
    id: winner.id,
    submissionId: winner.submissionId,
    studentId: winner.studentId,
    studentName: winner.studentName,
    studentPhotoUrl: winner.studentPhotoUrl,
    studentIcon: winner.studentIcon,
    isAnonymous: winner.isAnonymous === true,
    knotTitle: winner.knotTitle,
    note: winner.note ?? '',
    points: winner.points ?? 0,
    completedAt: winner.completedAt,
    ratingAverage: winner.ratingAverage ?? 0,
    ratingCount: winner.ratingCount ?? 0,
    weeklyScore: winner.weeklyScore,
  };
}

function buildRecentActivityItems(activityLog) {
  return activityLog.slice(0, 5).map((entry, index) => ({
    id: `recent-${entry.id}-${index}`,
    title: `${entry.isAnonymous ? 'En anonym bruker' : entry.studentName} fikk godkjent ${entry.knotTitle}`,
    detail: `${entry.points}p • ${entry.completedAt}`,
    profileId: entry.studentId,
    studentName: entry.studentName,
    studentPhotoUrl: entry.studentPhotoUrl,
    studentIcon: entry.studentIcon,
  }));
}

function buildDaySeed(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return Number(`${year}${month}${day}`);
}

export function buildDailyKnot(knots, date = new Date()) {
  const source = [...knots]
    .filter((knot) => knot?.id && knot?.title)
    .sort((left, right) => {
      const idDiff = left.id.localeCompare(right.id, 'nb');

      if (idDiff !== 0) {
        return idDiff;
      }

      return left.title.localeCompare(right.title, 'nb');
    });

  if (source.length === 0) {
    return null;
  }

  const index = buildDaySeed(date) % source.length;

  return source[index];
}

function getDifficultyWeight(difficulty) {
  const normalizedDifficulty = (difficulty ?? '').trim().toLowerCase();

  if (normalizedDifficulty === 'lett' || normalizedDifficulty === 'easy') {
    return 1;
  }

  if (normalizedDifficulty === 'medium') {
    return 2;
  }

  if (normalizedDifficulty === 'hard') {
    return 3;
  }

  return 2;
}

function buildRecommendedKnot(knots, nextRank) {
  const availableKnots = knots.filter(
    (knot) => knot.status === 'Tilgjengelig' || knot.status === 'Avslått',
  );

  if (availableKnots.length === 0) {
    return null;
  }

  if (nextRank?.mode === 'chase') {
    const directJump = [...availableKnots]
      .filter((knot) => knot.points >= nextRank.pointsNeeded)
      .sort((left, right) => {
        if (left.points !== right.points) {
          return left.points - right.points;
        }

        return (
          getDifficultyWeight(left.difficulty) -
          getDifficultyWeight(right.difficulty)
        );
      })[0];

    if (directJump) {
      return {
        ...directJump,
        reason: `Denne kan ta deg forbi ${
          nextRank.rival?.russName ?? nextRank.rival?.name
        }.`,
      };
    }
  }

  const bestMomentumKnot = [...availableKnots].sort((left, right) => {
    if (right.points !== left.points) {
      return right.points - left.points;
    }

    return (
      getDifficultyWeight(left.difficulty) -
      getDifficultyWeight(right.difficulty)
    );
  })[0];

  return {
    ...bestMomentumKnot,
    reason:
      nextRank?.mode === 'chase'
        ? 'Denne gir deg mest fart mot neste plassering.'
        : 'Denne holder tempoet oppe selv om du allerede ligger foran.',
  };
}

function buildRankProgress(currentLeader, leaderAbove, leaderBelow, nextRank) {
  if (!currentLeader) {
    return {
      currentPoints: 0,
      startPoints: 0,
      targetPoints: 1,
      percent: 0,
    };
  }

  if (!leaderAbove) {
    return {
      currentPoints: currentLeader.points,
      startPoints: leaderBelow?.points ?? Math.max(currentLeader.points - 50, 0),
      targetPoints: currentLeader.points,
      percent: 100,
    };
  }

  const targetPoints = leaderAbove.points + 1;
  const fallbackStart = Math.max(
    targetPoints - Math.max(nextRank?.pointsNeeded ?? 1, 1) - 20,
    0,
  );
  const startPoints = leaderBelow?.points ?? fallbackStart;
  const span = Math.max(targetPoints - startPoints, 1);
  const rawPercent = ((currentLeader.points - startPoints) / span) * 100;

  return {
    currentPoints: currentLeader.points,
    startPoints,
    targetPoints,
    percent: Math.min(Math.max(rawPercent, 6), 100),
  };
}

export function buildDashboardData(
  currentUserId,
  leaders,
  achievements,
  activityLog,
  knots,
) {
  const currentIndex = leaders.findIndex((leader) => leader.id === currentUserId);
  const currentLeader = currentIndex >= 0 ? leaders[currentIndex] : null;

  if (!currentLeader) {
    return {
      currentLeader: null,
      messages: [],
      nextAchievement: null,
      nextRank: null,
      rankProgress: null,
      recentActivity: [],
      recommendedKnot: null,
      rivals: [],
      stats: [],
      weeklyTopPost: null,
      weeklyPostMinRatings: WEEKLY_POST_MIN_RATINGS,
    };
  }

  const leaderAbove = currentIndex > 0 ? leaders[currentIndex - 1] : null;
  const leaderBelow =
    currentIndex < leaders.length - 1 ? leaders[currentIndex + 1] : null;

  const nextRank = leaderAbove
    ? {
        mode: 'chase',
        pointsNeeded: Math.max(leaderAbove.points - currentLeader.points + 1, 1),
        rival: leaderAbove,
      }
    : {
        mode: 'lead',
        pointsNeeded: 0,
        rival: leaderBelow,
      };

  const nextAchievement =
    achievements
      .filter(
        (achievement) => !achievement.isMaxTier,
      )
      .map((achievement) => ({
        ...achievement,
        remaining: Math.max(
          (achievement.nextTier?.target ?? achievement.progressTarget) -
            achievement.currentProgress,
          0,
        ),
      }))
      .sort((left, right) => {
        if (left.remaining !== right.remaining) {
          return left.remaining - right.remaining;
        }

        return left.progressTarget - right.progressTarget;
      })[0] ?? null;
  const unlockedAchievements = achievements.filter(
    (achievement) => achievement.isUnlocked,
  ).length;
  const rankProgress = buildRankProgress(
    currentLeader,
    leaderAbove,
    leaderBelow,
    nextRank,
  );
  const recommendedKnot = buildRecommendedKnot(knots, nextRank);
  const weeklyTopPost = buildWeeklyTopPost(activityLog);

  const rivals = leaders
    .filter((leader) => leader.id !== currentUserId)
    .map((leader) => ({
      ...leader,
      pointsGap: leader.points - currentLeader.points,
      rankGap: leader.rank - currentLeader.rank,
    }))
    .sort((left, right) => {
      if (Math.abs(left.rankGap) !== Math.abs(right.rankGap)) {
        return Math.abs(left.rankGap) - Math.abs(right.rankGap);
      }

      return Math.abs(left.pointsGap) - Math.abs(right.pointsGap);
    })
    .slice(0, 3);

  const messages = [];

  if (leaderBelow) {
    messages.push({
      id: 'passed',
      title: `Du passerte ${leaderBelow.russName ?? leaderBelow.name}`,
      detail: `Du ligger ${
        currentLeader.points - leaderBelow.points
      } poeng foran akkurat nå.`,
    });
  }

  if (leaderAbove) {
    messages.push({
      id: 'behind',
      title: `Du er ${leaderAbove.points - currentLeader.points} poeng bak ${
        leaderAbove.russName ?? leaderAbove.name
      }`,
      detail: `Neste godkjente knute kan flytte deg opp til #${leaderAbove.rank}.`,
    });
  } else if (leaderBelow) {
    messages.push({
      id: 'lead',
      title: `Du leder foran ${leaderBelow.russName ?? leaderBelow.name}`,
      detail: `Hold tempoet oppe, du har ${
        currentLeader.points - leaderBelow.points
      } poeng ned til neste rival.`,
    });
  }

  if (nextAchievement) {
    messages.push({
      id: 'achievement',
      title: `${nextAchievement.remaining} igjen til ${nextAchievement.nextTier?.label ?? 'neste tier'}`,
      detail: `${nextAchievement.title} - ${nextAchievement.description}`,
    });
  }

  return {
    currentLeader,
    messages,
    nextAchievement,
    nextRank,
    rankProgress,
    recentActivity: buildRecentActivityItems(activityLog),
    recommendedKnot,
    rivals,
    weeklyTopPost,
    weeklyPostMinRatings: WEEKLY_POST_MIN_RATINGS,
    stats: [
      {
        id: 'approved-knots',
        label: 'Fullførte knuter',
        value: currentLeader.completedKnots,
        note: 'Teller direkte i leaderboardet.',
      },
      {
        id: 'achievements',
        label: 'Achievements',
        value: unlockedAchievements,
        note: `${Math.max(achievements.length - unlockedAchievements, 0)} gjenstar.`,
      },
    ],
  };
}

export const NOTE_MAX_CHARS = 300;

export function limitNoteWords(
  note,
  maxChars = NOTE_MAX_CHARS,
) {
  return typeof note === 'string' ? note.trim().slice(0, maxChars) : '';
}
