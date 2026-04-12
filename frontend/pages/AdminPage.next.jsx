import { useState } from 'react';
import { SectionCard } from '../components/SectionCard.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { KNOT_FOLDERS, resolveKnotFolder } from '../data/knotFolders.js';

export function AdminPage({
  duelHistory,
  duelSummary,
  knots,
  onDeleteKnot,
  onImportKnots,
  onMarkDuelCompleted,
  onResolveDuel,
  onReviewSubmission,
  onUpdateKnotPoints,
  stats,
  submissions,
}) {
  const [bulkInput, setBulkInput] = useState('');
  const [defaultPoints, setDefaultPoints] = useState(20);
  const [defaultFolder, setDefaultFolder] = useState(KNOT_FOLDERS[0].id);
  const [importMessage, setImportMessage] = useState('');
  const activeDuels = (duelHistory ?? []).filter((duel) => duel.status === 'active');
  const resolvedDuels = (duelHistory ?? []).filter((duel) => duel.status === 'resolved');

  function handleImportSubmit() {
    const result = onImportKnots(bulkInput, defaultPoints, defaultFolder);

    if (result.added === 0) {
      setImportMessage('Ingen nye knuter ble lagt til.');
      return;
    }

    setImportMessage(
      `La til ${result.added} knuter${result.skipped ? `, hoppet over ${result.skipped}` : ''}.`,
    );
    setBulkInput('');
  }

  return (
    <div className="stack-layout">
      <SectionCard
        title="Oversikt"
        description="Nøkkeltallene under oppdateres når brukeren sender inn, admin vurderer knuter og knute-offs blir avgjort."
      >
        <div className="stats-grid">
          {stats.map((stat) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              note={stat.note}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Knute-offs"
        description="Admin kan se aktive knute-offs, markere fullføring og avgjøre utfallet i prototypen."
      >
        <div className="duel-admin-meta">
          <article className="stat-card">
            <span>Tellende per uke</span>
            <strong>{duelSummary?.weeklyLimit ?? 2}</strong>
            <p>Per bruker</p>
          </article>
          <article className="stat-card">
            <span>Innsats</span>
            <strong>{duelSummary?.stake ?? 5}p</strong>
            <p>Begge legger inn like mye</p>
          </article>
          <article className="stat-card">
            <span>Aktive nå</span>
            <strong>{duelSummary?.activeCount ?? 0}</strong>
            <p>{duelSummary?.deadlineHours ?? 48} timers frist</p>
          </article>
        </div>

        <div className="duel-history-block">
          <div className="section-card__header">
            <h3>Aktive knute-offs</h3>
            <p>Marker fullføring og avgjør utfallet med enkel prototype-logikk.</p>
          </div>

          <div className="duel-history-list">
            {activeDuels.length ? (
              activeDuels.map((duel) => (
                <article key={duel.id} className="duel-history-row duel-history-row--active">
                  <div>
                    <strong>{duel.knotTitle}</strong>
                    <p>
                      {duel.challengerName} vs {duel.opponentName} | Frist {duel.deadlineLabel}
                    </p>
                    <p>
                      Utfordrer: {duel.challengerStatusLabel} | Motstander:{' '}
                      {duel.opponentStatusLabel}
                    </p>
                  </div>
                  <div className="duel-history-row__actions duel-history-row__actions--admin">
                    <button
                      type="button"
                      className="action-button action-button--ghost"
                      disabled={Boolean(duel.challengerCompletedAt)}
                      onClick={() => onMarkDuelCompleted(duel.id, duel.challengerId)}
                    >
                      Utfordrer fullførte
                    </button>
                    <button
                      type="button"
                      className="action-button action-button--ghost"
                      disabled={Boolean(duel.opponentCompletedAt)}
                      onClick={() => onMarkDuelCompleted(duel.id, duel.opponentId)}
                    >
                      Motstander fullførte
                    </button>
                    <button
                      type="button"
                      className="action-button"
                      onClick={() => onResolveDuel(duel.id)}
                    >
                      Avgjor knute-off
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="folder-empty">Ingen aktive knute-offs akkurat nå.</p>
            )}
          </div>
        </div>

        <div className="duel-history-block">
          <div className="section-card__header">
            <h3>Historikk</h3>
            <p>Resultatet gir bare en liten edge i hovedleaderboardet.</p>
          </div>

          <div className="duel-history-list">
            {resolvedDuels.length ? (
              resolvedDuels.map((duel) => (
                <article key={duel.id} className="duel-history-row">
                  <div>
                    <strong>{duel.outcomeTitle}</strong>
                    <p>
                      {duel.challengerName} vs {duel.opponentName} | {duel.resolvedAtLabel}
                    </p>
                    <p>{duel.outcomeDetail}</p>
                  </div>
                  <span className="pill pill--warning">{duel.pointLabel}</span>
                </article>
              ))
            ) : (
              <p className="folder-empty">Ingen knute-offs er registrert ennå.</p>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Knuteoppsett"
        description="Lim inn en knute per linje. Nye knuter legges rett inn i prototypen."
      >
        <div className="admin-setup">
          <label className="field-group">
            <span>Lim inn knuter</span>
            <textarea
              className="text-input text-input--area"
              placeholder={'Eksempel:\nSpis is med votter\nSyng på bussen\nBytt sko med en venn'}
              value={bulkInput}
              onChange={(event) => setBulkInput(event.target.value)}
            />
          </label>

          <div className="admin-setup__actions">
            <label className="field-group field-group--small">
              <span>Standardpoeng</span>
              <input
                type="number"
                min="0"
                className="text-input"
                value={defaultPoints}
                onChange={(event) => setDefaultPoints(event.target.value)}
              />
            </label>

            <label className="field-group field-group--small">
              <span>Standardmappe</span>
              <select
                className="text-input"
                value={defaultFolder}
                onChange={(event) => setDefaultFolder(event.target.value)}
              >
                {KNOT_FOLDERS.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.id}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="action-button"
              onClick={handleImportSubmit}
            >
              Legg til knuter
            </button>
          </div>

          {importMessage ? <p className="form-feedback">{importMessage}</p> : null}
        </div>
      </SectionCard>

      <SectionCard
        title="Poengsystem"
        description="Juster poeng for hver knute direkte her. Endringer slår ut i prototypen."
      >
        <div className="config-list">
          {knots.map((knot) => (
            <article key={knot.id} className="config-row">
              <div className="config-row__content">
                <h3>{knot.title}</h3>
                <p>
                  {resolveKnotFolder(knot)} | {knot.status}
                </p>
              </div>

              <label className="field-group field-group--small">
                <span>Poeng</span>
                <input
                  type="number"
                  min="0"
                  className="text-input"
                  value={knot.points}
                  onChange={(event) =>
                    onUpdateKnotPoints(knot.id, event.target.value)
                  }
                />
              </label>

              <div className="config-row__actions">
                <button
                  type="button"
                  className="action-button action-button--danger"
                  onClick={() => onDeleteKnot(knot.id)}
                >
                  Slett
                </button>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Innsendte knuter"
        description="Kun submissions med status Venter kan vurderes videre."
      >
        <div className="submission-list">
          {submissions.map((submission) => {
            const canReview = submission.status === 'Venter';

            return (
              <article key={submission.id} className="submission-row">
                <div className="submission-row__content">
                  <h3>{submission.knotTitle}</h3>
                  <p>
                    {submission.student} | {submission.submittedAt}
                  </p>

                  {submission.note ? (
                    <p className="submission-note">{submission.note}</p>
                  ) : null}

                  {submission.imagePreviewUrl || submission.videoPreviewUrl ? (
                    <div className="submission-evidence">
                      {submission.imagePreviewUrl ? (
                        <div className="evidence-card">
                          <span>{submission.imageName || 'Bilde'}</span>
                          <img
                            src={submission.imagePreviewUrl}
                            alt={submission.knotTitle}
                          />
                        </div>
                      ) : null}

                      {submission.videoPreviewUrl ? (
                        <div className="evidence-card">
                          <span>{submission.videoName || 'Video'}</span>
                          <MobileVideo src={submission.videoPreviewUrl} controls autoPlay muted playsInline loop preload="auto" />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="submission-row__actions">
                  <span
                    className={`pill ${
                      submission.status === 'Godkjent'
                        ? 'pill--success'
                        : submission.status === 'Avslått'
                          ? 'pill--danger'
                          : 'pill--warning'
                    }`}
                  >
                    {submission.status}
                  </span>
                  <button
                    type="button"
                    className="action-button"
                    disabled={!canReview}
                    onClick={() => onReviewSubmission(submission.id, 'Godkjent')}
                  >
                    Godkjenn
                  </button>
                  <button
                    type="button"
                    className="action-button action-button--ghost"
                    disabled={!canReview}
                    onClick={() => onReviewSubmission(submission.id, 'Avslått')}
                  >
                    Avslå
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
import { MobileVideo } from '../components/MobileVideo.jsx';
