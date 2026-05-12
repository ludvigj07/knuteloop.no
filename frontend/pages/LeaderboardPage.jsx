import { useEffect, useMemo, useRef, useState } from 'react';
import { SectionCard } from '../components/SectionCard.jsx';

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
  genderLeaderboards = {},
  leaders,
  onOpenProfile,
}) {
  const [leaderboardScope, setLeaderboardScope] = useState('school');
  const [genderFilter, setGenderFilter] = useState('girl');
  const [classIndividualFilter, setClassIndividualFilter] = useState('sta');
  const currentLeaderRef = useRef(null);
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
                            src={leader.photoThumbUrl || leader.photoUrl}
                            alt={`${leader.russName ?? leader.name} profilbilde`}
                            loading="lazy"
                            decoding="async"
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
                              src={leader.photoThumbUrl || leader.photoUrl}
                              alt={`${leader.russName ?? leader.name} profilbilde`}
                              loading="lazy"
                              decoding="async"
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
    </SectionCard>
  );
}
