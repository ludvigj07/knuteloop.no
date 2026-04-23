import { useEffect, useRef, useState } from 'react';
import { MobileVideo } from '../components/MobileVideo.jsx';
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

function formatAveragePoints(value) {
  if (!Number.isFinite(value)) {
    return '0.0';
  }

  return value.toFixed(1);
}

const MAX_DUEL_NOTE_WORDS = 100;
const SUBMISSION_MODE = {
  REVIEW: 'review',
  FEED: 'feed',
  ANONYMOUS_FEED: 'anonymous-feed',
};
const GENDER_FILTER_LABELS = {
  girl: 'Jenter',
  boy: 'Gutter',
};

function getWordCount(text) {
  const trimmedText = text.trim();

  if (!trimmedText) {
    return 0;
  }

  return trimmedText.split(/\s+/).length;
}

function normalizeSubmissionMode(value) {
  if (
    value === SUBMISSION_MODE.REVIEW ||
    value === SUBMISSION_MODE.FEED ||
    value === SUBMISSION_MODE.ANONYMOUS_FEED
  ) {
    return value;
  }

  return SUBMISSION_MODE.FEED;
}

function revokeObjectUrl(url) {
  if (!url || typeof URL === 'undefined') {
    return;
  }

  URL.revokeObjectURL(url);
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
  genderLeaderboards = {},
  knotTypeLeaderboard = [],
  leaders,
  onMarkDuelCompleted,
  onOpenProfile,
  onStartDuel,
}) {
  const [activeView, setActiveView] = useState('leaderboard');
  const [leaderboardScope, setLeaderboardScope] = useState('school');
  const [genderFilter, setGenderFilter] = useState('girl');
  const [duelFeedback, setDuelFeedback] = useState('');
  const [drafts, setDrafts] = useState({});
  const [expandedSubmissionDuelId, setExpandedSubmissionDuelId] = useState(null);
  const currentLeaderRef = useRef(null);
  const draftsRef = useRef(drafts);
  const activeFeedBan =
    currentUserActiveBans.find((ban) => ban.type === 'feed') ?? null;
  const activeSubmissionBan =
    currentUserActiveBans.find((ban) => ban.type === 'submission') ?? null;
  const activeDuels = (duelHistory ?? []).filter((duel) => duel.status === 'active');
  const recentDuels = (duelHistory ?? []).filter((duel) => duel.status === 'resolved');
  const challengeLeaders = (leaders ?? []).filter((leader) => leader.id !== currentUserId);
  const genderFilterOptions = ['girl', 'boy'];
  const selectedGenderLeaderboard = genderLeaderboards[genderFilter] ?? [];
  const hotMoverIds = buildHotMoverIdSet(leaders ?? [], activityLog);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(
    () => () => {
      Object.values(draftsRef.current).forEach((draft) => {
        revokeObjectUrl(draft.imagePreviewUrl);
        revokeObjectUrl(draft.videoPreviewUrl);
      });
    },
    [],
  );

  async function handleStartDuel(opponentId) {
    const result = await onStartDuel?.(opponentId);

    if (result?.message) {
      setDuelFeedback(result.message);
    }
  }

  function updateDraftNote(duelId, note) {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [duelId]: {
        ...currentDrafts[duelId],
        note,
      },
    }));
  }

  function updateDraftSubmissionMode(duelId, submissionMode) {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [duelId]: {
        ...currentDrafts[duelId],
        submissionMode: normalizeSubmissionMode(submissionMode),
      },
    }));
  }

  function updateDraftFile(duelId, type, file) {
    if (!file || typeof URL === 'undefined') {
      return;
    }

    const previewField = type === 'image' ? 'imagePreviewUrl' : 'videoPreviewUrl';
    const nameField = type === 'image' ? 'imageName' : 'videoName';
    const fileField = type === 'image' ? 'imageFile' : 'videoFile';
    const nextPreviewUrl = URL.createObjectURL(file);

    setDrafts((currentDrafts) => {
      const currentDraft = currentDrafts[duelId] ?? {};
      revokeObjectUrl(currentDraft[previewField]);

      return {
        ...currentDrafts,
        [duelId]: {
          ...currentDraft,
          [nameField]: file.name,
          [fileField]: file,
          [previewField]: nextPreviewUrl,
        },
      };
    });
  }

  function clearDraft(duelId) {
    setDrafts((currentDrafts) => {
      const currentDraft = currentDrafts[duelId] ?? {};
      revokeObjectUrl(currentDraft.imagePreviewUrl);
      revokeObjectUrl(currentDraft.videoPreviewUrl);
      const nextDrafts = { ...currentDrafts };
      delete nextDrafts[duelId];
      return nextDrafts;
    });
  }

  async function handleCompleteDuel(duel, evidence = {}) {
    const wordCount = getWordCount(evidence.note ?? '');

    if (wordCount > MAX_DUEL_NOTE_WORDS) {
      setDuelFeedback(`Hold notatet under ${MAX_DUEL_NOTE_WORDS} ord.`);
      return;
    }

    if (activeSubmissionBan) {
      setDuelFeedback(
        `Du har innsendings-ban i ${activeSubmissionBan.remainingLabel}. Du kan ikke registrere knute-off nå.`,
      );
      return;
    }

    const normalizedSubmissionMode = normalizeSubmissionMode(evidence.submissionMode);
    const effectiveSubmissionMode = activeFeedBan
      ? SUBMISSION_MODE.REVIEW
      : normalizedSubmissionMode;
    const result = await onMarkDuelCompleted?.(duel.id, currentUserId, {
      ...evidence,
      submissionMode: effectiveSubmissionMode,
    });

    if (result?.ok) {
      clearDraft(duel.id);
      setExpandedSubmissionDuelId((current) => (current === duel.id ? null : current));
      setDuelFeedback(
        result.message ??
          'Fullføring er registrert og auto-godkjent. Admin kan reversere hvis beviset ikke holder.',
      );
      return;
    }

    if (result?.message) {
      setDuelFeedback(result.message);
    }
  }

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
          <div className="leaderboard-scope-switch" role="tablist" aria-label="Velg toppliste">
            <button
              type="button"
              className={`leaderboard-scope-switch__button ${
                leaderboardScope === 'school' ? 'is-active' : ''
              }`}
              onClick={() => setLeaderboardScope('school')}
            >
              Skole
            </button>
            <button
              type="button"
              className={`leaderboard-scope-switch__button ${
                leaderboardScope === 'class' ? 'is-active' : ''
              }`}
              onClick={() => setLeaderboardScope('class')}
            >
              Klasse
            </button>
            <button
              type="button"
              className={`leaderboard-scope-switch__button ${
                leaderboardScope === 'knot-types' ? 'is-active' : ''
              }`}
              onClick={() => setLeaderboardScope('knot-types')}
            >
              Knutetyper
            </button>
            <button
              type="button"
              className={`leaderboard-scope-switch__button ${
                leaderboardScope === 'gender' ? 'is-active' : ''
              }`}
              onClick={() => setLeaderboardScope('gender')}
            >
              Kjønn
            </button>
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
                          P
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
                  const isCurrentClass =
                    String(entry.className).trim().toLowerCase() ===
                    String(currentUserClassName).trim().toLowerCase();

                  return (
                    <article
                      key={entry.className}
                      className={`leaderboard-row leaderboard-row--class ${
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
                          <p>
                            {entry.members} elever · {entry.totalCompletedKnots} godkjente knuter
                          </p>
                        </div>
                      </div>
                      <div className="leaderboard-row__details leaderboard-row__details--stacked">
                        <strong>{formatAveragePoints(entry.avgPoints)} snitt</strong>
                        <span>{entry.totalPoints} totalpoeng</span>
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="folder-empty">Ingen klasse-data å vise ennå.</p>
              )}
            </div>
          ) : null}

          {leaderboardScope === 'knot-types' ? (
            <div className="leaderboard-list leaderboard-list--compact leaderboard-list--friendly">
              {knotTypeLeaderboard.length > 0 ? (
                knotTypeLeaderboard.map((entry) => (
                  <article key={entry.category} className="leaderboard-row leaderboard-row--knot-type">
                    <div className={`leaderboard-row__rank ${getRankToneClass(entry.rank)}`}>
                      {getRankDisplay(entry.rank)}
                    </div>
                    <div className="leaderboard-row__person">
                      <div className="profile-avatar profile-avatar--small">KT</div>
                      <div className="leaderboard-row__person-text">
                        <h3>{entry.category}</h3>
                        <p>
                          {entry.approvedCount} godkjente · {entry.participantCount} deltakere
                        </p>
                      </div>
                    </div>
                    <div className="leaderboard-row__details leaderboard-row__details--stacked">
                      <strong>{entry.totalPoints} poeng</strong>
                      <span>Totalt i kategorien</span>
                    </div>
                  </article>
                ))
              ) : (
                <p className="folder-empty">Ingen kategori-data å vise ennå.</p>
              )}
            </div>
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
                            P
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
        <div className="stack-layout">
          <div className="duel-summary-bar duel-summary-bar--friendly">
            <div>
              <strong>Knute-off</strong>
              <p>
                Knute-off er en frivillig ekstraaktivitet. Du kan utfordre innenfor
                {` ${duelSummary?.range ?? 5} `}
                plasseringer, med
                {` ${duelSummary?.stake ?? 10} `}
                poeng i innsats og
                {` ${duelSummary?.deadlineHours ?? 24} `}
                timers frist. Maks {duelSummary?.dailyLimit ?? 1} per dag.
              </p>
            </div>
            <div className="duel-summary-bar__stats">
              <span>{duelSummary?.currentUserDailyCount ?? 0}/1 i dag</span>
              <span>{duelSummary?.currentUserRemaining ?? 0} igjen</span>
            </div>
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
                Innsendings-ban aktiv i {activeSubmissionBan.remainingLabel}. Knuteoff kan ikke
                registreres akkurat nå.
              </p>
            </div>
          ) : null}
          {activeFeedBan ? (
            <div className="inline-feedback">
              <p>
                Feed-ban aktiv i {activeFeedBan.remainingLabel}. Knuteoff registreres uten
                feed-post i perioden.
              </p>
            </div>
          ) : null}

          <div className="duel-history-block">
            <div className="section-card__header">
              <h3>Aktive knute-offer</h3>
              <p>Dere får samme knute og kan levere når det passer.</p>
            </div>

            <div className="duel-history-list">
              {activeDuels.length > 0 ? (
                activeDuels.map((duel) => {
                  const isChallenger = duel.challengerId === currentUserId;
                  const isOpponent = duel.opponentId === currentUserId;
                  const isParticipant = isChallenger || isOpponent;
                  const currentUserCompleted = isChallenger
                    ? Boolean(duel.challengerCompletedAt)
                    : isOpponent
                      ? Boolean(duel.opponentCompletedAt)
                      : false;
                  const draft = drafts[duel.id] ?? {};
                  const noteValue = draft.note ?? '';
                  const noteWordCount = getWordCount(noteValue);
                  const isOverWordLimit = noteWordCount > MAX_DUEL_NOTE_WORDS;
                  const submissionMode = normalizeSubmissionMode(draft.submissionMode);
                  const effectiveSubmissionMode = activeFeedBan
                    ? SUBMISSION_MODE.REVIEW
                    : submissionMode;
                  const shareToFeed = effectiveSubmissionMode === SUBMISSION_MODE.FEED;
                  const shareToAnonymousFeed =
                    effectiveSubmissionMode === SUBMISSION_MODE.ANONYMOUS_FEED;
                  const isSubmissionOpen = expandedSubmissionDuelId === duel.id;

                  return (
                    <article key={duel.id} className="duel-history-row duel-history-row--active duel-history-row--friendly">
                      <div>
                        <strong>{duel.knotTitle}</strong>
                        <p>
                          {duel.challengerName} vs {duel.opponentName} · Frist {duel.deadlineLabel}
                        </p>
                        <p>
                          Utfordrer: {duel.challengerStatusLabel} · Motstander: {duel.opponentStatusLabel}
                        </p>
                      </div>
                      <div className="duel-history-row__actions">
                        <span className="pill pill--warning">Potten er {duel.stake * 2} poeng</span>
                        {isParticipant ? (
                          <button
                            type="button"
                            className="action-button"
                            disabled={currentUserCompleted || Boolean(activeSubmissionBan)}
                            onClick={() =>
                              setExpandedSubmissionDuelId((current) =>
                                current === duel.id ? null : duel.id,
                              )
                            }
                          >
                            {currentUserCompleted
                              ? 'Registrert'
                              : isSubmissionOpen
                                ? 'Skjul registrering'
                                : 'Åpne registrering'}
                          </button>
                        ) : null}
                      </div>

                      {isParticipant && !currentUserCompleted && isSubmissionOpen ? (
                        <div className="submission-form">
                          <label className="field-group">
                            <span>Kort notat</span>
                            <textarea
                              className="text-input text-input--area"
                              placeholder="Hva gjorde du, og hva bør admin se etter?"
                              value={noteValue}
                              onChange={(event) => updateDraftNote(duel.id, event.target.value)}
                            />
                          </label>

                          <div className="submission-form__meta">
                            <span
                              className={`word-counter ${isOverWordLimit ? 'is-invalid' : ''}`}
                            >
                              {noteWordCount}/{MAX_DUEL_NOTE_WORDS} ord
                            </span>
                          </div>

                          <div className="submission-mode-options">
                            <label className="submission-mode-option">
                              <input
                                type="checkbox"
                                checked={shareToFeed}
                                disabled={Boolean(activeFeedBan)}
                                onChange={(event) =>
                                  updateDraftSubmissionMode(
                                    duel.id,
                                    event.target.checked
                                      ? SUBMISSION_MODE.FEED
                                      : SUBMISSION_MODE.REVIEW,
                                  )
                                }
                              />
                              <span>Del i feed</span>
                            </label>
                            <label className="submission-mode-option">
                              <input
                                type="checkbox"
                                checked={shareToAnonymousFeed}
                                disabled={Boolean(activeFeedBan)}
                                onChange={(event) =>
                                  updateDraftSubmissionMode(
                                    duel.id,
                                    event.target.checked
                                      ? SUBMISSION_MODE.ANONYMOUS_FEED
                                      : SUBMISSION_MODE.REVIEW,
                                  )
                                }
                              />
                              <span>Post anonymt i feed</span>
                            </label>
                          </div>
                          <p className="submission-mode-hint">
                            {activeFeedBan
                              ? `Feed-posting er blokkert i ${activeFeedBan.remainingLabel}. Knuteoff registreres uten feed-post.`
                              : 'Lar du begge stå av, registreres knuteoff uten feed-post.'}
                          </p>

                          <div className="submission-upload-grid">
                            <label className="upload-field">
                              <span>Last opp bilde</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(event) => {
                                  updateDraftFile(duel.id, 'image', event.target.files?.[0]);
                                  event.target.value = '';
                                }}
                              />
                              <small>{draft.imageName || 'Valgfritt bildebevis'}</small>
                            </label>

                            <label className="upload-field">
                              <span>Last opp video</span>
                              <input
                                type="file"
                                accept="video/mp4,video/quicktime,video/x-m4v"
                                onChange={(event) => {
                                  updateDraftFile(duel.id, 'video', event.target.files?.[0]);
                                  event.target.value = '';
                                }}
                              />
                              <small>{draft.videoName || 'Valgfritt videobevis'}</small>
                            </label>
                          </div>

                          {draft.imagePreviewUrl || draft.videoPreviewUrl ? (
                            <div className="submission-preview-grid">
                              {draft.imagePreviewUrl ? (
                                <div className="evidence-card">
                                  <span>{draft.imageName || 'Bildebevis'}</span>
                                  <img src={draft.imagePreviewUrl} alt="Valgt duelbilde" />
                                </div>
                              ) : null}
                              {draft.videoPreviewUrl ? (
                                <div className="evidence-card">
                                  <span>{draft.videoName || 'Videobevis'}</span>
                                  <MobileVideo
                                    controls
                                    autoPlay
                                    muted
                                    loop
                                    src={draft.videoPreviewUrl}
                                  />
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          <div className="submission-form__actions">
                            <button
                              type="button"
                              className="action-button"
                              disabled={isOverWordLimit || Boolean(activeSubmissionBan)}
                              onClick={() => handleCompleteDuel(duel, draft)}
                            >
                              Registrer fullført
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <p className="folder-empty">Ingen aktive knute-offer akkurat nå.</p>
              )}
            </div>
          </div>

          <div className="duel-history-block">
            <div className="section-card__header">
              <h3>Utfordre en venn</h3>
              <p>Vises bare når utfordringen er tilgjengelig og innenfor rammene.</p>
            </div>

            <div className="leaderboard-list">
              {challengeLeaders.map((leader) => {
                const duelState = duelAvailability?.byLeaderId?.[leader.id];

                return (
                  <article key={leader.id} className="leaderboard-row">
                    <div
                      className={`leaderboard-row__rank ${getRankToneClass(leader.rank)}`}
                    >
                      #{leader.rank}
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
                      <div className="leaderboard-row__person-text">
                        <h3>{leader.russName ?? leader.name}</h3>
                        <p>
                          #{leader.rank} · {leader.points} poeng
                        </p>
                      </div>
                    </div>
                    <div className="leaderboard-row__details">
                      <p className="leaderboard-row__duel-hint">
                        {duelState?.reason ?? 'Knute-off er ikke tilgjengelig akkurat nå.'}
                      </p>
                      <div className="leaderboard-row__actions">
                        <button
                          type="button"
                          className="action-button action-button--ghost"
                          onClick={() => onOpenProfile(leader.id)}
                        >
                          Se profil
                        </button>
                        <button
                          type="button"
                          className="action-button"
                          disabled={!duelState?.canChallenge}
                          onClick={() => handleStartDuel(leader.id)}
                        >
                          Send utfordring
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="duel-history-block">
            <div className="section-card__header">
              <h3>Siste knute-offer</h3>
              <p>Avsluttede dueller vises her som historikk.</p>
            </div>

            <div className="duel-history-list">
              {recentDuels.slice(0, 5).map((duel) => (
                <article key={duel.id} className="duel-history-row duel-history-row--friendly">
                  <div>
                    <strong>{duel.outcomeTitle}</strong>
                    <p>
                      {duel.challengerName} vs {duel.opponentName} · {duel.resolvedAtLabel}
                    </p>
                    <p>{duel.outcomeDetail}</p>
                  </div>
                  <span className="pill pill--warning">{duel.pointLabel}</span>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
