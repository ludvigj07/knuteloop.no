import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Clock,
  Info,
  Percent,
  Shield,
  Swords,
  Trophy,
  X,
  ChevronRight,
} from 'lucide-react';
import { SectionCard } from '../components/SectionCard.jsx';
import { DuelEvidenceSheet } from '../components/DuelEvidenceSheet.jsx';

function getRankDisplay(rank) {
  return `#${rank}`;
}

function getRankToneClass(rank) {
  if (rank === 1) {
    return 'leaderboard-row__rank--gold';
  }

  if (rank === 2) {
    return 'leaderboard-row__rank--silver';
  }

  if (rank === 3) {
    return 'leaderboard-row__rank--bronze';
  }

  return '';
}

function getPodiumRowClass(rank) {
  if (rank === 1) {
    return 'leaderboard-row--podium-gold';
  }

  if (rank === 2) {
    return 'leaderboard-row--podium-silver';
  }

  if (rank === 3) {
    return 'leaderboard-row--podium-bronze';
  }

  return '';
}

const GENDER_FILTER_LABELS = {
  girl: 'Jenter',
  boy: 'Gutter',
};
const LEADERBOARD_SCOPE_OPTIONS = [
  { value: 'school', label: 'Skole' },
  { value: 'class', label: 'Klasse kamp' },
  { value: 'class-individuals', label: 'Klassens beste' },
  { value: 'gender', label: 'Kjønn' },
];
const CLASS_INDIVIDUAL_FILTER_OPTIONS = [
  { value: 'sta', label: 'STA' },
  { value: 'stb', label: 'STB' },
  { value: 'stc', label: 'STC' },
  { value: 'std', label: 'STD' },
  { value: 'ste', label: 'STE' },
  { value: 'stf', label: 'STF' },
  { value: 'stg', label: 'STG' },
  { value: 'sth', label: 'STH' },
  { value: 'iba', label: 'IBA' },
  { value: 'ibb', label: 'IBB' },
  { value: 'ibc', label: 'IBC' },
  { value: 'ibd', label: 'IBD' },
];


function normalizeClassFilterValue(value) {
  const normalizedValue = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  if (!normalizedValue) {
    return '';
  }

  if (/^[a-h]$/.test(normalizedValue)) {
    return `st${normalizedValue}`;
  }

  if (/^st[a-h]$/.test(normalizedValue)) {
    return normalizedValue;
  }

  const stMatch = normalizedValue.match(/(?:^|[0-9])st([a-h])(?:[0-9]|$)/);
  if (stMatch) {
    return `st${stMatch[1]}`;
  }

  if (/^ib[1-4]$/.test(normalizedValue)) {
    const ibLetter = String.fromCharCode('a'.charCodeAt(0) + Number(normalizedValue[2]) - 1);
    return `ib${ibLetter}`;
  }

  const ibNumberMatch = normalizedValue.match(/(?:^|[0-9])ib([1-4])(?:[0-9]|$)/);
  if (ibNumberMatch) {
    const ibLetter = String.fromCharCode('a'.charCodeAt(0) + Number(ibNumberMatch[1]) - 1);
    return `ib${ibLetter}`;
  }

  if (/^ib[a-d]$/.test(normalizedValue)) {
    return normalizedValue;
  }

  const ibLetterMatch = normalizedValue.match(/(?:^|[0-9])ib([a-d])(?:[0-9]|$)/);
  if (ibLetterMatch) {
    return `ib${ibLetterMatch[1]}`;
  }

  return '';
}

function areSameClass(leftClassName, rightClassName) {
  const normalizedLeft = normalizeClassFilterValue(leftClassName);
  const normalizedRight = normalizeClassFilterValue(rightClassName);

  if (normalizedLeft && normalizedRight) {
    return normalizedLeft === normalizedRight;
  }

  return String(leftClassName ?? '').trim().toLowerCase() ===
    String(rightClassName ?? '').trim().toLowerCase();
}

function getLeaderClassFilterValue(leader) {
  return normalizeClassFilterValue(
    leader?.className ?? leader?.group ?? leader?.profile?.className ?? '',
  );
}

function rankClassIndividuals(leaders = [], classFilterValue = '') {
  return (leaders ?? [])
    .filter((leader) => getLeaderClassFilterValue(leader) === classFilterValue)
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
    .map((leader, index) => ({
      ...leader,
      classRank: index + 1,
    }));
}

function buildHotMoverIdSet(leaders = [], activityLog = []) {
  const momentumByLeader = new Map();
  const recentEntries = (activityLog ?? []).slice(0, 24);

  recentEntries.forEach((entry, index) => {
    const studentId = Number(entry?.studentId);
    const points = Number(entry?.points ?? 0);

    if (!Number.isInteger(studentId) || studentId <= 0 || points <= 0 || entry?.isAnonymous) {
      return;
    }

    const recencyWeight = Math.max(0.35, 1 - index * 0.06);
    const score = points * recencyWeight * (index < 5 ? 1.15 : 1);
    momentumByLeader.set(studentId, (momentumByLeader.get(studentId) ?? 0) + score);
  });

  (leaders ?? []).forEach((leader) => {
    const duelDelta = Number(leader?.duelPointDelta ?? 0);

    if (duelDelta > 0) {
      momentumByLeader.set(
        leader.id,
        (momentumByLeader.get(leader.id) ?? 0) + duelDelta * 0.6,
      );
    }
  });

  const ranked = [...momentumByLeader.entries()].sort((left, right) => right[1] - left[1]);
  const threshold = ranked.length > 0 ? Math.max(12, ranked[0][1] * 0.45) : Infinity;

  return new Set(
    ranked
      .filter(([, score], index) => index < 3 && score >= threshold)
      .map(([leaderId]) => leaderId),
  );
}

export function LeaderboardPage({
  activityLog = [],
  classLeaderboard = [],
  currentUserId,
  currentUserClassName = '',
  currentUserActiveBans = [],
  duelAvailability,
  duelHistory,
  duelSummary,
  duelViewRequest = 0,
  genderLeaderboards = {},
  leaders,
  onMarkDuelCompleted,
  onOpenProfile,
  onStartDuel,
}) {
  const [activeView, setActiveView] = useState('leaderboard');
  const [leaderboardScope, setLeaderboardScope] = useState('school');
  const [genderFilter, setGenderFilter] = useState('girl');
  const [classIndividualFilter, setClassIndividualFilter] = useState('sta');
  const [duelFeedback, setDuelFeedback] = useState('');
  const [activeSheetDuelId, setActiveSheetDuelId] = useState(null);
  const [showDuelRules, setShowDuelRules] = useState(false);
  const [showAllChallengers, setShowAllChallengers] = useState(false);
  const currentLeaderRef = useRef(null);
  const lastSeenDuelViewRequestRef = useRef(0);

  const activeFeedBan =
    currentUserActiveBans.find((ban) => ban.type === 'feed') ?? null;
  const activeSubmissionBan =
    currentUserActiveBans.find((ban) => ban.type === 'submission') ?? null;
  const allActiveDuels = (duelHistory ?? []).filter((duel) => duel.status === 'active');
  const recentDuels = (duelHistory ?? []).filter((duel) => duel.status === 'resolved');
  // Knute-off er en 1/dag-greie, så vi viser bare brukerens egen
  // pågående — ikke andre folks dueller. Tar nyeste hvis det skulle
  // være flere enn én ved en feil.
  const myActiveDuels = allActiveDuels
    .filter(
      (duel) => duel.challengerId === currentUserId || duel.opponentId === currentUserId,
    )
    .sort((a, b) => {
      const aTime = new Date(a.startedAtRaw ?? a.startedAt ?? 0).getTime();
      const bTime = new Date(b.startedAtRaw ?? b.startedAt ?? 0).getTime();
      return bTime - aTime;
    });
  const myCurrentDuel = myActiveDuels[0] ?? null;
  const myFinishedDuels = recentDuels.filter(
    (duel) => duel.challengerId === currentUserId || duel.opponentId === currentUserId,
  );
  const myWonDuels = myFinishedDuels.filter((duel) => duel.winnerId === currentUserId);
  const myWinRate = myFinishedDuels.length > 0
    ? Math.round((myWonDuels.length / myFinishedDuels.length) * 100)
    : 0;
  const myActiveDuelCount = myCurrentDuel ? 1 : 0;
  // canStartNewDuel — brukeren har "tokens" igjen i dag og er ikke
  // allerede i en aktiv knute-off. Dette er det eneste vi gater på
  // frontend-side. (Backend kan i tillegg ha range-regler som blokkerer
  // — i så fall får brukeren feilmelding via toast når de prøver.)
  const canStartNewDuel = !myCurrentDuel && (duelSummary?.currentUserRemaining ?? 0) > 0;
  const challengeLeaders = (leaders ?? []).filter((leader) => leader.id !== currentUserId);
  const genderFilterOptions = ['girl', 'boy'];
  const selectedGenderLeaderboard = genderLeaderboards[genderFilter] ?? [];
  const hotMoverIds = buildHotMoverIdSet(leaders ?? [], activityLog);
  const selectedClassIndividualEntries = useMemo(
    () => rankClassIndividuals(leaders ?? [], classIndividualFilter),
    [leaders, classIndividualFilter],
  );
  const selectedClassLabel =
    CLASS_INDIVIDUAL_FILTER_OPTIONS.find((option) => option.value === classIndividualFilter)
      ?.label ?? classIndividualFilter.toUpperCase();

  useEffect(() => {
    const normalizedCurrentUserClass = normalizeClassFilterValue(currentUserClassName);

    if (normalizedCurrentUserClass) {
      setClassIndividualFilter(normalizedCurrentUserClass);
    }
  }, [currentUserClassName]);

  // Hopper rett inn i duel-view når Status-siden ber om det.
  useEffect(() => {
    if (
      duelViewRequest > 0 &&
      duelViewRequest !== lastSeenDuelViewRequestRef.current
    ) {
      lastSeenDuelViewRequestRef.current = duelViewRequest;
      setActiveView('duel');
    }
  }, [duelViewRequest]);

  async function handleStartDuel(opponentId) {
    const result = await onStartDuel?.(opponentId);

    if (result?.message) {
      setDuelFeedback(result.message);
    }
  }

  // Wrapper som DuelEvidenceSheet kaller når brukeren submitter bevis.
  async function handleCompleteDuel(duel, evidence) {
    const result = await onMarkDuelCompleted?.(duel.id, currentUserId, evidence);
    if (result?.ok) {
      setDuelFeedback(
        result.message ??
          'Fullføring er registrert. Admin kan reversere hvis beviset ikke holder.',
      );
      return { ok: true };
    }
    return { ok: false, message: result?.message ?? 'Noe gikk galt — prøv igjen.' };
  }

  const sheetDuel = activeSheetDuelId
    ? allActiveDuels.find((duel) => duel.id === activeSheetDuelId)
    : null;

  function handleJumpToCurrentUser() {
    if (!currentLeaderRef.current) {
      return;
    }

    currentLeaderRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  return (
    <SectionCard
      title="Toppliste"
      description="En vennlig oversikt over aktivitet og deltakelse i kullet."
    >
      <div className="leaderboard-switch" role="tablist" aria-label="Velg visning i toppliste">
        <button
          type="button"
          className={`leaderboard-switch__button ${
            activeView === 'leaderboard' ? 'is-active' : ''
          }`}
          onClick={() => setActiveView('leaderboard')}
        >
          Toppliste
        </button>
        <button
          type="button"
          className={`leaderboard-switch__button ${activeView === 'duel' ? 'is-active' : ''}`}
          onClick={() => setActiveView('duel')}
        >
          Knute-off
        </button>
      </div>

      {activeView === 'leaderboard' ? (
        <>
          <div className="leaderboard-scope-switch">
            <label className="leaderboard-scope-switch__label" htmlFor="leaderboard-scope-select">
              Statistikktype
            </label>
            <div className="leaderboard-scope-switch__field">
              <select
                id="leaderboard-scope-select"
                className="leaderboard-scope-switch__select"
                value={leaderboardScope}
                onChange={(event) => setLeaderboardScope(event.target.value)}
                aria-label="Velg toppliste"
              >
                {LEADERBOARD_SCOPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {leaderboardScope === 'school' ? (
            <>
              <div className="leaderboard-tools">
                <button
                  type="button"
                  className="action-button action-button--compact"
                  onClick={handleJumpToCurrentUser}
                >
                  Gå til min plass
                </button>
              </div>
              <div className="leaderboard-list leaderboard-list--compact leaderboard-list--friendly">
                {(leaders ?? []).map((leader) => (
                  <article
                    key={leader.id}
                    ref={leader.id === currentUserId ? currentLeaderRef : null}
                    className={`leaderboard-row leaderboard-row--player ${getPodiumRowClass(
                      leader.rank,
                    )} ${
                      leader.id === currentUserId ? 'leaderboard-row--self' : ''
                    }`}
                  >
                    <div
                      className={`leaderboard-row__rank ${getRankToneClass(leader.rank)}`}
                    >
                      {getRankDisplay(leader.rank)}
                    </div>
                    <div className="leaderboard-row__person">
                      {leader.photoUrl ? (
                        <div className="profile-photo profile-photo--small">
                          <img
                            src={leader.photoUrl}
                            alt={`${leader.russName ?? leader.name} profilbilde`}
                          />
                        </div>
                      ) : (
                        <div className="profile-avatar profile-avatar--small">{leader.icon}</div>
                      )}
                      <div className="leaderboard-row__person-text leaderboard-row__person-text--player">
                        <div className="leaderboard-row__name-line">
                          <h3>{leader.russName ?? leader.name}</h3>
                          {hotMoverIds.has(leader.id) ? (
                            <span className="leaderboard-row__hot-mover" title="Mest opp i det siste">
                              🔥
                            </span>
                          ) : null}
                        </div>
                        <p className="leaderboard-row__subtitle">
                          <span className="leaderboard-row__title-pill">{leader.leaderboardTitle}</span>
                        </p>
                      </div>
                    </div>
                    <div className="leaderboard-row__details leaderboard-row__details--player">
                      <span className="leaderboard-row__points-box" aria-label={`${leader.points} poeng`}>
                        <span className="leaderboard-row__points-value">{leader.points}</span>
                        <span className="leaderboard-row__points-icon" aria-hidden="true">
                          p
                        </span>
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : null}

          {leaderboardScope === 'class' ? (
            <div className="leaderboard-list leaderboard-list--compact leaderboard-list--friendly">
              {classLeaderboard.length > 0 ? (
                classLeaderboard.map((entry) => {
                  const isCurrentClass = areSameClass(entry.className, currentUserClassName);

                  return (
                    <article
                      key={entry.className}
                      className={`leaderboard-row leaderboard-row--class ${getPodiumRowClass(
                        entry.rank,
                      )} ${
                        isCurrentClass ? 'leaderboard-row--self' : ''
                      }`}
                    >
                      <div className={`leaderboard-row__rank ${getRankToneClass(entry.rank)}`}>
                        {getRankDisplay(entry.rank)}
                      </div>
                      <div className="leaderboard-row__person">
                        <div className="profile-avatar profile-avatar--small">
                          {entry.className.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="leaderboard-row__person-text">
                          <h3>{entry.className}</h3>
                          <p>{entry.totalCompletedKnots} knuter</p>
                        </div>
                      </div>
                      <div className="leaderboard-row__details leaderboard-row__details--player">
                        <span className="leaderboard-row__points-box" aria-label={`${entry.totalPoints} poeng`}>
                          <span className="leaderboard-row__points-value">{entry.totalPoints}</span>
                          <span className="leaderboard-row__points-icon" aria-hidden="true">
                            p
                          </span>
                        </span>
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="folder-empty">Ingen klasse-data å vise ennå.</p>
              )}
            </div>
          ) : null}

          {leaderboardScope === 'class-individuals' ? (
            <>
              <div
                className="leaderboard-class-filter"
                role="tablist"
                aria-label="Filtrer klasse"
                data-swipe-lock="true"
              >
                {CLASS_INDIVIDUAL_FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`leaderboard-class-filter__button ${
                      classIndividualFilter === option.value ? 'is-active' : ''
                    }`}
                    onClick={() => setClassIndividualFilter(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <p className="leaderboard-class-filter__hint">
                Individliste for klasse {selectedClassLabel}.
              </p>

              <div className="leaderboard-list leaderboard-list--compact leaderboard-list--friendly">
                {selectedClassIndividualEntries.length > 0 ? (
                  selectedClassIndividualEntries.map((leader) => (
                    <article
                      key={`${classIndividualFilter}-${leader.id}`}
                      className={`leaderboard-row leaderboard-row--player ${getPodiumRowClass(
                        leader.classRank,
                      )} ${
                        leader.id === currentUserId ? 'leaderboard-row--self' : ''
                      }`}
                    >
                      <div
                        className={`leaderboard-row__rank ${getRankToneClass(leader.classRank)}`}
                      >
                        {getRankDisplay(leader.classRank)}
                      </div>
                      <div className="leaderboard-row__person">
                        {leader.photoUrl ? (
                          <div className="profile-photo profile-photo--small">
                            <img
                              src={leader.photoUrl}
                              alt={`${leader.russName ?? leader.name} profilbilde`}
                            />
                          </div>
                        ) : (
                          <div className="profile-avatar profile-avatar--small">{leader.icon}</div>
                        )}
                        <div className="leaderboard-row__person-text leaderboard-row__person-text--player">
                          <div className="leaderboard-row__name-line">
                            <h3>{leader.russName ?? leader.name}</h3>
                            {hotMoverIds.has(leader.id) ? (
                              <span className="leaderboard-row__hot-mover" title="Mest opp i det siste">
                                🔥
                              </span>
                            ) : null}
                          </div>
                          <p className="leaderboard-row__subtitle">
                            <span className="leaderboard-row__title-pill">
                              {leader.leaderboardTitle}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="leaderboard-row__details leaderboard-row__details--player">
                        <span className="leaderboard-row__points-box" aria-label={`${leader.points} poeng`}>
                          <span className="leaderboard-row__points-value">{leader.points}</span>
                          <span className="leaderboard-row__points-icon" aria-hidden="true">
                            p
                          </span>
                        </span>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="folder-empty">
                    Ingen synlige elever i klasse «{selectedClassLabel}» ennå.
                  </p>
                )}
              </div>
            </>
          ) : null}
          {leaderboardScope === 'gender' ? (
            <>
              <div className="leaderboard-gender-filter" role="tablist" aria-label="Filtrer kjønnsstatistikk">
                {genderFilterOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`leaderboard-gender-filter__button ${
                      genderFilter === option ? 'is-active' : ''
                    }`}
                    onClick={() => setGenderFilter(option)}
                  >
                    {GENDER_FILTER_LABELS[option]}
                  </button>
                ))}
              </div>

              <p className="leaderboard-gender-filter__hint">
                Gutter og jenter vises i hver sin toppliste.
              </p>

              <div className="leaderboard-list leaderboard-list--compact leaderboard-list--friendly">
                {selectedGenderLeaderboard.length > 0 ? (
                  selectedGenderLeaderboard.map((leader) => (
                    <article
                      key={leader.id}
                      className={`leaderboard-row leaderboard-row--player ${getPodiumRowClass(
                        leader.rank,
                      )} ${
                        leader.id === currentUserId ? 'leaderboard-row--self' : ''
                      }`}
                    >
                      <div
                        className={`leaderboard-row__rank ${getRankToneClass(leader.rank)}`}
                      >
                        {getRankDisplay(leader.rank)}
                      </div>
                      <div className="leaderboard-row__person">
                        {leader.photoUrl ? (
                          <div className="profile-photo profile-photo--small">
                            <img
                              src={leader.photoUrl}
                              alt={`${leader.russName ?? leader.name} profilbilde`}
                            />
                          </div>
                        ) : (
                          <div className="profile-avatar profile-avatar--small">{leader.icon}</div>
                        )}
                        <div className="leaderboard-row__person-text leaderboard-row__person-text--player">
                          <div className="leaderboard-row__name-line">
                            <h3>{leader.russName ?? leader.name}</h3>
                            {hotMoverIds.has(leader.id) ? (
                              <span className="leaderboard-row__hot-mover" title="Mest opp i det siste">
                                🔥
                              </span>
                            ) : null}
                          </div>
                          <p className="leaderboard-row__subtitle">
                            <span className="leaderboard-row__title-pill">
                              {leader.leaderboardTitle}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="leaderboard-row__details leaderboard-row__details--player">
                        <span className="leaderboard-row__points-box" aria-label={`${leader.points} poeng`}>
                          <span className="leaderboard-row__points-value">{leader.points}</span>
                          <span className="leaderboard-row__points-icon" aria-hidden="true">
                            p
                          </span>
                        </span>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="folder-empty">
                    Ingen synlige deltakere i «{GENDER_FILTER_LABELS[genderFilter]}» ennå.
                  </p>
                )}
              </div>
            </>
          ) : null}
        </>
      ) : (
        <div className="duel-v2">
          {/* 1. STATS-BAR */}
          <section className="duel-v2-stats" aria-label="Mine duell-tall">
            <DuelHeroStat
              Icon={Swords}
              value={myWonDuels.length}
              label="vunnet"
              tone="win"
            />
            <DuelHeroStat
              Icon={Percent}
              value={`${myWinRate}%`}
              label="win rate"
              tone="rate"
            />
            <DuelHeroStat
              Icon={Shield}
              value={myActiveDuelCount}
              label="aktive nå"
              tone="active"
            />
          </section>

          <div className="duel-v2-meta">
            <span>
              {duelSummary?.currentUserDailyCount ?? 0}/{duelSummary?.dailyLimit ?? 1} i dag
            </span>
            <button
              type="button"
              className="duel-v2-meta__rules-link"
              onClick={() => setShowDuelRules(true)}
            >
              <Info size={14} strokeWidth={1.8} />
              <span>Regler</span>
            </button>
          </div>

          {duelFeedback ? (
            <div className="inline-feedback">
              <p>{duelFeedback}</p>
              <button
                type="button"
                className="action-button action-button--ghost action-button--compact"
                onClick={() => setDuelFeedback('')}
              >
                Lukk
              </button>
            </div>
          ) : null}
          {activeSubmissionBan ? (
            <div className="inline-feedback">
              <p>
                Innsendings-ban aktiv i {activeSubmissionBan.remainingLabel}. Knute-off
                kan ikke registreres akkurat nå.
              </p>
            </div>
          ) : null}
          {activeFeedBan ? (
            <div className="inline-feedback">
              <p>
                Feed-ban aktiv i {activeFeedBan.remainingLabel}. Knute-off registreres uten
                feed-post i perioden.
              </p>
            </div>
          ) : null}

          {/* 2. AKTIV DUELL — VS-kort (max 1) */}
          <section className="duel-v2-section">
            <header className="duel-v2-section__head">
              <h3>Pågående</h3>
            </header>
            {myCurrentDuel ? (
              <div className="duel-v2-active-list">
                <ActiveDuelVsCard
                  key={myCurrentDuel.id}
                  duel={myCurrentDuel}
                  currentUserId={currentUserId}
                  canRegister={!activeSubmissionBan}
                  onRegister={() => setActiveSheetDuelId(myCurrentDuel.id)}
                  onOpenProfile={onOpenProfile}
                />
              </div>
            ) : (
              <p className="duel-v2-empty">
                Ingen aktiv knute-off akkurat nå. Velg en motstander under.
              </p>
            )}
          </section>

          {/* 3. UTFORDRE-LISTE — alle uansett rank, gate kun på daglig kvote */}
          <section className="duel-v2-section">
            <header className="duel-v2-section__head">
              <h3>Klar til kamp</h3>
              {challengeLeaders.length > 5 ? (
                <button
                  type="button"
                  className="duel-v2-link"
                  onClick={() => setShowAllChallengers((v) => !v)}
                >
                  {showAllChallengers ? 'Skjul' : `Se alle (${challengeLeaders.length})`}
                </button>
              ) : null}
            </header>
            {!canStartNewDuel ? (
              <p className="duel-v2-meta-hint">
                {myCurrentDuel
                  ? 'Du er allerede i en knute-off. Fullfør den før du starter ny.'
                  : 'Du har brukt opp din knute-off i dag.'}
              </p>
            ) : null}
            <div className="duel-v2-challenger-list">
              {(() => {
                const sorted = [...challengeLeaders].sort(
                  (a, b) => (a.rank ?? 999) - (b.rank ?? 999),
                );
                const visible = showAllChallengers ? sorted : sorted.slice(0, 5);
                return visible.map((leader) => (
                  <ChallengerRow
                    key={leader.id}
                    leader={leader}
                    canChallenge={canStartNewDuel}
                    onChallenge={() => handleStartDuel(leader.id)}
                    onOpenProfile={onOpenProfile}
                  />
                ));
              })()}
              {challengeLeaders.length === 0 ? (
                <p className="duel-v2-empty">Ingen mulige motstandere akkurat nå.</p>
              ) : null}
            </div>
          </section>

          {/* 4. HISTORIKK */}
          {recentDuels.length > 0 ? (
            <section className="duel-v2-section">
              <header className="duel-v2-section__head">
                <h3>Historikk</h3>
              </header>
              <div className="duel-v2-history-list">
                {recentDuels.slice(0, 5).map((duel) => (
                  <DuelHistoryRow
                    key={duel.id}
                    duel={duel}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {/* RULES SHEET */}
          {showDuelRules ? (
            <DuelRulesSheet
              duelSummary={duelSummary}
              onClose={() => setShowDuelRules(false)}
            />
          ) : null}

          {/* EVIDENCE SHEET */}
          <DuelEvidenceSheet
            duel={sheetDuel}
            currentUserId={currentUserId}
            isOpen={Boolean(sheetDuel)}
            onClose={() => setActiveSheetDuelId(null)}
            onSubmit={(evidence) => handleCompleteDuel(sheetDuel, evidence)}
            feedBanned={Boolean(activeFeedBan)}
            submissionBanned={Boolean(activeSubmissionBan)}
            submissionBanLabel={activeSubmissionBan?.remainingLabel}
          />
        </div>
      )}
    </SectionCard>
  );
}

// ─── Helper-komponenter for duel-v2 ──────────────────────────────────────

function DuelHeroStat({ Icon, value, label, tone }) {
  return (
    <div className={`duel-v2-stat duel-v2-stat--${tone}`}>
      <span className="duel-v2-stat__icon" aria-hidden="true">
        <Icon size={20} strokeWidth={1.8} />
      </span>
      <strong className="duel-v2-stat__value">{value}</strong>
      <span className="duel-v2-stat__label">{label}</span>
    </div>
  );
}

function ParticipantBlock({ leader, completed, role, onOpenProfile }) {
  const photo = leader?.photoUrl;
  const name = leader?.russName ?? leader?.name ?? '—';
  const isYou = role === 'you';

  return (
    <button
      type="button"
      className="duel-v2-vs-card__participant"
      onClick={() => leader?.id && onOpenProfile?.(leader.id)}
      disabled={!leader?.id}
    >
      {photo ? (
        <div className="duel-v2-vs-card__avatar">
          <img src={photo} alt={`${name} profilbilde`} />
        </div>
      ) : (
        <div className="duel-v2-vs-card__avatar duel-v2-vs-card__avatar--empty">
          {leader?.icon ?? '🪢'}
        </div>
      )}
      <span className="duel-v2-vs-card__name">
        {isYou ? 'Du' : name}
      </span>
      <span
        className={`duel-v2-vs-card__status ${
          completed ? 'is-done' : 'is-pending'
        }`}
      >
        {completed ? 'Levert' : 'Mangler'}
      </span>
    </button>
  );
}

function ActiveDuelVsCard({ duel, currentUserId, canRegister, onRegister, onOpenProfile }) {
  const isChallenger = duel.challengerId === currentUserId;
  const isOpponent = duel.opponentId === currentUserId;
  const isParticipant = isChallenger || isOpponent;
  const myCompleted = isChallenger
    ? Boolean(duel.challengerCompletedAt)
    : isOpponent
      ? Boolean(duel.opponentCompletedAt)
      : false;
  const opponentCompleted = isChallenger
    ? Boolean(duel.opponentCompletedAt)
    : Boolean(duel.challengerCompletedAt);

  // Bygg en lett "leader-aktig" struktur for ParticipantBlock fra duel-feltene.
  const meBlock = {
    id: currentUserId,
    russName: 'Du',
    photoUrl: isChallenger ? duel.challengerPhotoUrl : duel.opponentPhotoUrl,
    icon: isChallenger ? duel.challengerIcon : duel.opponentIcon,
  };
  const opponentBlock = {
    id: isChallenger ? duel.opponentId : duel.challengerId,
    russName: isChallenger ? duel.opponentName : duel.challengerName,
    photoUrl: isChallenger ? duel.opponentPhotoUrl : duel.challengerPhotoUrl,
    icon: isChallenger ? duel.opponentIcon : duel.challengerIcon,
  };

  return (
    <article className="duel-v2-vs-card">
      <div className="duel-v2-vs-card__top">
        <ParticipantBlock
          leader={isParticipant ? meBlock : { russName: duel.challengerName }}
          completed={isChallenger ? myCompleted : Boolean(duel.challengerCompletedAt)}
          role={isParticipant ? 'you' : 'them'}
          onOpenProfile={onOpenProfile}
        />
        <div className="duel-v2-vs-card__vs" aria-hidden="true">
          <Swords size={18} strokeWidth={1.8} />
          <span>VS</span>
        </div>
        <ParticipantBlock
          leader={opponentBlock}
          completed={opponentCompleted}
          role="them"
          onOpenProfile={onOpenProfile}
        />
      </div>
      <div className="duel-v2-vs-card__title">{duel.knotTitle}</div>
      <div className="duel-v2-vs-card__meta">
        <span className="duel-v2-vs-card__deadline">
          <Clock size={14} strokeWidth={1.8} aria-hidden="true" />
          <span>{duel.deadlineLabel}</span>
        </span>
        <span className="duel-v2-vs-card__pot">
          <Trophy size={14} strokeWidth={1.8} aria-hidden="true" />
          <span>{duel.stake * 2}p på spill</span>
        </span>
      </div>
      {isParticipant ? (
        <button
          type="button"
          className="duel-v2-vs-card__cta"
          disabled={myCompleted || !canRegister}
          onClick={onRegister}
        >
          {myCompleted ? '✓ Du har levert' : 'Registrer bevis'}
        </button>
      ) : null}
    </article>
  );
}

function ChallengerRow({ leader, canChallenge, onChallenge, onOpenProfile }) {
  const photo = leader.photoUrl;
  const name = leader.russName ?? leader.name;

  return (
    <article className={`duel-v2-challenger ${canChallenge ? 'is-ready' : 'is-locked'}`}>
      <button
        type="button"
        className="duel-v2-challenger__person"
        onClick={() => onOpenProfile?.(leader.id)}
      >
        {photo ? (
          <div className="duel-v2-challenger__avatar">
            <img src={photo} alt={`${name} profilbilde`} />
          </div>
        ) : (
          <div className="duel-v2-challenger__avatar duel-v2-challenger__avatar--empty">
            {leader.icon}
          </div>
        )}
        <div className="duel-v2-challenger__copy">
          <strong>{name}</strong>
          <span>
            #{leader.rank} · {leader.points}p
          </span>
        </div>
      </button>
      <button
        type="button"
        className="duel-v2-challenger__cta"
        disabled={!canChallenge}
        onClick={onChallenge}
        title={canChallenge ? 'Utfordre' : 'Du har brukt opp din knute-off i dag'}
      >
        {canChallenge ? (
          <>
            <Swords size={16} strokeWidth={1.8} aria-hidden="true" />
            <span>Utfordre</span>
          </>
        ) : (
          <>
            <Shield size={16} strokeWidth={1.8} aria-hidden="true" />
            <span>Sperret</span>
          </>
        )}
      </button>
    </article>
  );
}

function DuelHistoryRow({ duel, currentUserId }) {
  const isWin = duel.winnerId === currentUserId;
  const isLoss = duel.winnerId && duel.winnerId !== currentUserId;
  const isParticipant =
    duel.challengerId === currentUserId || duel.opponentId === currentUserId;
  const opponentName =
    duel.challengerId === currentUserId ? duel.opponentName : duel.challengerName;

  let toneClass = 'duel-v2-history-row--neutral';
  if (isParticipant && isWin) toneClass = 'duel-v2-history-row--win';
  else if (isParticipant && isLoss) toneClass = 'duel-v2-history-row--loss';

  return (
    <div className={`duel-v2-history-row ${toneClass}`}>
      <div className="duel-v2-history-row__main">
        <strong>
          {isParticipant
            ? isWin
              ? `Vant mot ${opponentName}`
              : isLoss
                ? `Tapte mot ${opponentName}`
                : duel.outcomeTitle
            : duel.outcomeTitle}
        </strong>
        <span className="duel-v2-history-row__sub">
          {duel.knotTitle} · {duel.resolvedAtLabel}
        </span>
      </div>
      <span className="duel-v2-history-row__pill">{duel.pointLabel}</span>
    </div>
  );
}

function DuelRulesSheet({ duelSummary, onClose }) {
  return (
    <div
      className="duel-sheet-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className="duel-sheet duel-sheet--rules"
        role="dialog"
        aria-modal="true"
        aria-labelledby="duel-rules-title"
        data-swipe-lock="true"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="duel-sheet__handle" aria-hidden="true" />
        <div className="duel-sheet__header">
          <div>
            <p className="duel-sheet__eyebrow">Regler</p>
            <h3 id="duel-rules-title">Knute-off</h3>
          </div>
          <button
            type="button"
            className="duel-sheet__close"
            onClick={onClose}
            aria-label="Lukk"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>
        <ul className="duel-rules-list">
          <li>
            <Trophy size={16} strokeWidth={1.8} aria-hidden="true" />
            <span>{duelSummary?.stake ?? 10}p på spill (potten blir {(duelSummary?.stake ?? 10) * 2}p)</span>
          </li>
          <li>
            <Clock size={16} strokeWidth={1.8} aria-hidden="true" />
            <span>{duelSummary?.deadlineHours ?? 24}t frist for å registrere bevis</span>
          </li>
          <li>
            <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" />
            <span>Du kan utfordre hvem som helst i kullet</span>
          </li>
          <li>
            <Award size={16} strokeWidth={1.8} aria-hidden="true" />
            <span>Maks {duelSummary?.dailyLimit ?? 1} ny utfordring per dag</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
