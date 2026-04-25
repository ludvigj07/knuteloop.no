import { useEffect, useRef, useState } from 'react';
import { MobileVideo } from '../components/MobileVideo.jsx';
import { SectionCard } from '../components/SectionCard.jsx';

const MAX_DUEL_NOTE_WORDS = 100;
const SUBMISSION_MODE = {
  REVIEW: 'review',
  FEED: 'feed',
  ANONYMOUS_FEED: 'anonymous-feed',
};

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

function getWordCount(text) {
  const trimmedText = text.trim();

  if (!trimmedText) {
    return 0;
  }

  return trimmedText.split(/\s+/).length;
}

function revokeObjectUrl(url) {
  if (!url || typeof URL === 'undefined') {
    return;
  }

  URL.revokeObjectURL(url);
}

function getParticipantRole(duel, leaderId) {
  if (duel.challengerId === leaderId) {
    return 'challenger';
  }

  if (duel.opponentId === leaderId) {
    return 'opponent';
  }

  return null;
}

function getParticipantEvidence(duel, role) {
  if (role === 'challenger') {
    return {
      note: duel.challengerNote ?? '',
      imageName: duel.challengerImageName ?? '',
      imagePreviewUrl: duel.challengerImagePreviewUrl ?? '',
      videoName: duel.challengerVideoName ?? '',
      videoPreviewUrl: duel.challengerVideoPreviewUrl ?? '',
      completedAt: duel.challengerCompletedAt,
    };
  }

  if (role === 'opponent') {
    return {
      note: duel.opponentNote ?? '',
      imageName: duel.opponentImageName ?? '',
      imagePreviewUrl: duel.opponentImagePreviewUrl ?? '',
      videoName: duel.opponentVideoName ?? '',
      videoPreviewUrl: duel.opponentVideoPreviewUrl ?? '',
      completedAt: duel.opponentCompletedAt,
    };
  }

  return {
    note: '',
    imageName: '',
    imagePreviewUrl: '',
    videoName: '',
    videoPreviewUrl: '',
    completedAt: null,
  };
}

function getOpponentMeta(duel, role) {
  if (role === 'challenger') {
    return {
      id: duel.opponentId,
      name: duel.opponentName,
      statusLabel: duel.opponentStatusLabel,
    };
  }

  return {
    id: duel.challengerId,
    name: duel.challengerName,
    statusLabel: duel.challengerStatusLabel,
  };
}

function getResolvedPointsForUser(duel, role) {
  const stake = duel.stake ?? 10;
  const splitReward = stake / 2;
  const noCompletionPenalty = stake / 2;

  if (duel.result === 'split') {
    return splitReward;
  }

  if (duel.result === 'no-completion') {
    return -noCompletionPenalty;
  }

  if (duel.result === 'challenger-wins') {
    return role === 'challenger' ? stake : -stake;
  }

  if (duel.result === 'opponent-wins') {
    return role === 'opponent' ? stake : -stake;
  }

  return 0;
}

function buildUserDuelStats(duels, currentUserId) {
  return duels.reduce(
    (summary, duel) => {
      const role = getParticipantRole(duel, currentUserId);

      if (!role) {
        return summary;
      }

      const pointDelta = getResolvedPointsForUser(duel, role);

      summary.total += 1;

      if (pointDelta > 0) {
        summary.pointsWon += pointDelta;
        summary.wins += 1;
      } else if (pointDelta < 0) {
        summary.pointsLost += Math.abs(pointDelta);

        if (duel.result === 'no-completion') {
          summary.expiries += 1;
        } else {
          summary.losses += 1;
        }
      } else {
        summary.splits += 1;
      }

      return summary;
    },
    {
      total: 0,
      wins: 0,
      losses: 0,
      splits: 0,
      expiries: 0,
      pointsWon: 0,
      pointsLost: 0,
    },
  );
}

function DuelEvidencePreview({ evidence }) {
  if (!evidence.note && !evidence.imagePreviewUrl && !evidence.videoPreviewUrl) {
    return null;
  }

  return (
    <div className="duel-evidence-preview">
      {evidence.note ? <p className="submission-note">{evidence.note}</p> : null}

      {evidence.imagePreviewUrl || evidence.videoPreviewUrl ? (
        <div className="submission-preview-grid">
          {evidence.imagePreviewUrl ? (
            <div className="evidence-card">
              <span>{evidence.imageName || 'Bildebevis'}</span>
              <img src={evidence.imagePreviewUrl} alt="Duelbevis" />
            </div>
          ) : null}

          {evidence.videoPreviewUrl ? (
            <div className="evidence-card">
              <span>{evidence.videoName || 'Videobevis'}</span>
              <MobileVideo
                controls
                autoPlay
                muted
                loop
                src={evidence.videoPreviewUrl}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function DuelPage({
  currentUserId,
  duelAvailability,
  duelHistory,
  duelSummary,
  leaders,
  onMarkDuelCompleted,
  onOpenProfile,
  onStartDuel,
}) {
  const [duelFeedback, setDuelFeedback] = useState('');
  const [drafts, setDrafts] = useState({});
  const draftsRef = useRef(drafts);

  const myActiveDuels = (duelHistory ?? []).filter(
    (duel) =>
      duel.status === 'active' &&
      (duel.challengerId === currentUserId || duel.opponentId === currentUserId),
  );
  const myResolvedDuels = (duelHistory ?? []).filter(
    (duel) =>
      duel.status === 'resolved' &&
      (duel.challengerId === currentUserId || duel.opponentId === currentUserId),
  );
  const availableOpponents = (leaders ?? []).filter(
    (leader) => duelAvailability?.byLeaderId?.[leader.id]?.canChallenge,
  );
  const duelStats = buildUserDuelStats(myResolvedDuels, currentUserId);

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

  async function updateDraftFile(duelId, type, file) {
    if (!file || typeof URL === 'undefined') {
      return;
    }

    const nextFile = file;

    const previewField =
      type === 'image' ? 'imagePreviewUrl' : 'videoPreviewUrl';
    const nameField = type === 'image' ? 'imageName' : 'videoName';
    const fileField = type === 'image' ? 'imageFile' : 'videoFile';
    const nextPreviewUrl = URL.createObjectURL(nextFile);

    setDrafts((currentDrafts) => {
      const currentDraft = currentDrafts[duelId] ?? {};

      revokeObjectUrl(currentDraft[previewField]);

      return {
        ...currentDrafts,
        [duelId]: {
          ...currentDraft,
          [nameField]: nextFile.name,
          [fileField]: nextFile,
          [previewField]: nextPreviewUrl,
        },
      };
    });
  }

  function resetDraft(duelId) {
    setDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };
      delete nextDrafts[duelId];
      return nextDrafts;
    });
  }

  async function handleStartDuel(opponentId) {
    const result = await onStartDuel?.(opponentId);

    if (result?.message) {
      setDuelFeedback(result.message);
    }
  }

  async function handleSubmitEvidence(duel) {
    const draft = drafts[duel.id] ?? {};
    const wordCount = getWordCount(draft.note ?? '');

    if (wordCount > MAX_DUEL_NOTE_WORDS) {
      setDuelFeedback('Hold duel-notatet under 100 ord.');
      return;
    }

    const result = await onMarkDuelCompleted?.(duel.id, currentUserId, {
      ...draft,
      submissionMode: normalizeSubmissionMode(draft.submissionMode),
    });

    if (result?.ok) {
      resetDraft(duel.id);
      setDuelFeedback(
        result.message ??
          `Bevis registrert for "${duel.knotTitle}". Fullføringen er auto-godkjent, men admin kan reversere ved behov.`,
      );
      return;
    }

    setDuelFeedback(
      result?.message ?? 'Kunne ikke registrere knute-off akkurat nå. Prøv igjen.',
    );
  }

  return (
    <div className="stack-layout">
      <SectionCard
        title="Knute-offs"
        description="Egen plass for duellene dine, så du slipper a lete i topplista."
      >
        <div className="duel-summary-bar">
          <div>
            <strong>Fast innsats: {duelSummary?.stake ?? 10} poeng</strong>
            <p>
              Samme knute til begge, {duelSummary?.deadlineHours ?? 24} timers frist
              og maks {duelSummary?.dailyLimit ?? 1} knute-off per dag.
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
      </SectionCard>

      <SectionCard
        title="Duellene dine akkurat nå"
        description="Her ser du hvem du er i duell med, hva utfordringen er, og hvor du laster opp bevis."
      >
        <div className="duel-page-list">
          {myActiveDuels.length > 0 ? (
            myActiveDuels.map((duel) => {
              const role = getParticipantRole(duel, currentUserId);
              const myEvidence = getParticipantEvidence(duel, role);
              const opponent = getOpponentMeta(duel, role);
              const draft = drafts[duel.id] ?? {};
              const noteValue = draft.note ?? '';
              const submissionMode = normalizeSubmissionMode(draft.submissionMode);
              const shareToFeed = submissionMode === SUBMISSION_MODE.FEED;
              const shareToAnonymousFeed =
                submissionMode === SUBMISSION_MODE.ANONYMOUS_FEED;
              const noteWordCount = getWordCount(noteValue);
              const isCompleted = Boolean(myEvidence.completedAt);

              return (
                <article key={duel.id} className="duel-focus-card">
                  <div className="duel-focus-card__header">
                    <div>
                      <strong>{duel.knotTitle}</strong>
                      <p>Mot {opponent.name} | Frist {duel.deadlineLabel}</p>
                    </div>
                    <div className="duel-focus-card__meta">
                      <span className="pill pill--warning">
                        Potten er {(duel.stake ?? 10) * 2}p
                      </span>
                      <button
                        type="button"
                        className="action-button action-button--ghost action-button--compact"
                        onClick={() => onOpenProfile(opponent.id)}
                      >
                        Sjekk profil
                      </button>
                    </div>
                  </div>

                  <div className="duel-focus-card__status">
                    <div className="duel-status-card">
                      <span>Du</span>
                      <strong>
                        {isCompleted ? 'Registrert som fullført' : 'Ikke registrert ennå'}
                      </strong>
                    </div>
                    <div className="duel-status-card">
                      <span>Motstander</span>
                      <strong>{opponent.statusLabel}</strong>
                    </div>
                  </div>

                  <div className="duel-focus-card__body">
                    <div className="duel-focus-card__challenge">
                      <h3>Utfordringen</h3>
                      <p>
                        Begge må levere på samme knute. Last opp bevis innen fristen.
                        Innsendingen blir auto-godkjent, og admin kan reversere ved feil.
                      </p>
                    </div>

                    {isCompleted ? (
                      <div className="duel-focus-card__evidence">
                        <h3>Ditt bevis</h3>
                        <DuelEvidencePreview evidence={myEvidence} />
                      </div>
                    ) : (
                      <div className="duel-focus-card__evidence">
                        <h3>Registrer at du tok den</h3>
                        <div className="field-group">
                          <span>Kort notat</span>
                          <textarea
                            className="text-input text-input--area"
                            placeholder="Hva gjorde du, og hva burde admin se etter?"
                            value={noteValue}
                            onChange={(event) => updateDraftNote(duel.id, event.target.value)}
                          />
                          <small
                            className={`word-counter ${
                              noteWordCount > MAX_DUEL_NOTE_WORDS ? 'is-invalid' : ''
                            }`}
                          >
                            {noteWordCount}/{MAX_DUEL_NOTE_WORDS} ord
                          </small>
                        </div>

                        <div className="submission-mode-options">
                          <label className="submission-mode-option">
                            <input
                              type="checkbox"
                              checked={shareToFeed}
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
                          Lar du begge stå av, blir knuteoff registrert uten feed-post.
                        </p>

                        <div className="submission-upload-grid">
                          <label className="upload-field">
                            <span>Bilde</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(event) => {
                                updateDraftFile(duel.id, 'image', event.target.files?.[0]);
                                event.target.value = '';
                              }}
                            />
                            <small>{draft.imageName || 'Last opp bildebevis'}</small>
                          </label>

                          <label className="upload-field">
                            <span>Video</span>
                            <input
                              type="file"
                              accept="video/mp4,video/quicktime,video/x-m4v,video/*"
                              capture="environment"
                              onChange={(event) => {
                                updateDraftFile(duel.id, 'video', event.target.files?.[0]);
                                event.target.value = '';
                              }}
                            />
                            <small>{draft.videoName || 'Last opp videobevis'}</small>
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

                        <button
                          type="button"
                          className="action-button"
                          disabled={noteWordCount > MAX_DUEL_NOTE_WORDS}
                          onClick={() => handleSubmitEvidence(duel)}
                        >
                          Registrer fullført
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          ) : (
            <p className="folder-empty">
              Ingen aktive knute-offs akkurat nå. Start en ny fra lista under.
            </p>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Klar for en ny duel"
        description="Her er brukerne du faktisk kan utfordre akkurat nå."
      >
        <div className="duel-page-list">
          {availableOpponents.length > 0 ? (
            availableOpponents.slice(0, 5).map((leader) => (
              <article key={leader.id} className="dashboard-rival-row">
                <div className="dashboard-rival-row__person">
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
                    <div className="profile-avatar profile-avatar--small">
                      {leader.icon}
                    </div>
                  )}
                  <div>
                    <h3>{leader.russName ?? leader.name}</h3>
                    <p>
                      #{leader.rank} på lista | {leader.points} poeng
                    </p>
                  </div>
                </div>

                <div className="dashboard-rival-row__meta">
                  <strong>
                    {duelAvailability?.byLeaderId?.[leader.id]?.reason ??
                      'Innenfor rekkevidde'}
                  </strong>
                  <div className="duel-focus-card__meta">
                    <button
                      type="button"
                      className="action-button action-button--ghost action-button--compact"
                      onClick={() => onOpenProfile(leader.id)}
                    >
                      Sjekk profil
                    </button>
                    <button
                      type="button"
                      className="action-button action-button--compact"
                      onClick={() => handleStartDuel(leader.id)}
                    >
                      Start knute-off
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <p className="folder-empty">
              Ingen nye motstandere er tilgjengelige akkurat nå. Prøv igjen i morgen
              eller når aktive knute-offs er avgjort.
            </p>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Statistikk fra tidligere dueller"
        description="Her ser du om knute-offs faktisk har gitt deg edge over tid."
      >
        <div className="stats-grid">
          <article className="stat-card">
            <span>Dueller totalt</span>
            <strong>{duelStats.total}</strong>
            <p>Avgjorte knute-offs så langt</p>
          </article>
          <article className="stat-card">
            <span>Poeng vunnet</span>
            <strong>+{duelStats.pointsWon}</strong>
            <p>Ren gevinst fra duelresultater</p>
          </article>
          <article className="stat-card">
            <span>Poeng tapt</span>
            <strong>-{duelStats.pointsLost}</strong>
            <p>Tap fra nederlag og utløpte dueller</p>
          </article>
          <article className="stat-card">
            <span>Record</span>
            <strong>
              {duelStats.wins}-{duelStats.losses}
            </strong>
            <p>{duelStats.splits} split | {duelStats.expiries} utløpte</p>
          </article>
        </div>
      </SectionCard>

      <SectionCard
        title="Duelhistorikk"
        description="Siste dueller med resultat og hva de faktisk gjorde med poengene dine."
      >
        <div className="duel-history-list">
          {myResolvedDuels.length > 0 ? (
            myResolvedDuels.map((duel) => {
              const role = getParticipantRole(duel, currentUserId);
              const pointDelta = getResolvedPointsForUser(duel, role);
              const pointLabel =
                pointDelta > 0
                  ? `Du vant +${pointDelta}p`
                  : pointDelta < 0
                    ? `Du tapte ${pointDelta}p`
                    : 'Ingen nettoendring';

              return (
                <article key={duel.id} className="duel-history-row">
                  <div>
                    <strong>{duel.outcomeTitle}</strong>
                    <p>
                      {duel.knotTitle} | {duel.resolvedAtLabel}
                    </p>
                    <p>{duel.outcomeDetail}</p>
                  </div>
                  <span className="pill pill--warning">{pointLabel}</span>
                </article>
              );
            })
          ) : (
            <p className="folder-empty">Ingen avgjorte dueller ennå.</p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
