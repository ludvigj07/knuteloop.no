import { useState } from 'react';
import { SectionCard } from '../components/SectionCard.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { KNOT_FOLDERS, resolveKnotFolder } from '../data/knotFolders.js';

function SubmissionList({ items, canReview, onReviewSubmission }) {
  if (items.length === 0) {
    return (
      <p className="folder-empty">
        {canReview
          ? 'Ingen ventende innsendinger akkurat nå.'
          : 'Ingen ferdigbehandlede innsendinger ennå.'}
      </p>
    );
  }

  return (
    <div className="submission-list">
      {items.map((submission) => (
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
            {canReview ? (
              <>
                <button
                  type="button"
                  className="action-button"
                  onClick={() => onReviewSubmission(submission.id, 'Godkjent')}
                >
                  Godkjenn
                </button>
                <button
                  type="button"
                  className="action-button action-button--ghost"
                  onClick={() => onReviewSubmission(submission.id, 'Avslått')}
                >
                  Avslå
                </button>
              </>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

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
  const [activeAdminTask, setActiveAdminTask] = useState('submissions');

  const pendingSubmissions = submissions.filter(
    (submission) => submission.status === 'Venter',
  );
  const resolvedSubmissions = submissions.filter(
    (submission) => submission.status !== 'Venter',
  );
  const activeDuels = (duelHistory ?? []).filter((duel) => duel.status === 'active');
  const resolvedDuels = (duelHistory ?? []).filter((duel) => duel.status === 'resolved');

  const pendingSubmissionCount = pendingSubmissions.length;
  const resolvedSubmissionCount = resolvedSubmissions.length;
  const activeDuelCount = activeDuels.length;
  const resolvedDuelCount = resolvedDuels.length;
  const totalKnotCount = knots.length;

  const adminTasks = [
    {
      id: 'submissions',
      label: 'Godkjenn innsendinger',
      count: pendingSubmissionCount,
      note: 'Ventende',
    },
    {
      id: 'knots',
      label: 'Knuter',
      count: totalKnotCount,
      note: 'Totalt',
    },
    {
      id: 'duels',
      label: 'Knute-offs',
      count: activeDuelCount,
      note: 'Aktive',
    },
    {
      id: 'overview',
      label: 'Oversikt',
      count: stats.length,
      note: 'Kort',
    },
  ];

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
        title="Adminoppgaver"
        description="Velg hvilken adminjobb du vil jobbe med. Innsendinger er prioritert som standard."
      >
        <div className="admin-task-nav">
          {adminTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              className={`admin-task-button ${
                activeAdminTask === task.id ? 'is-active' : ''
              }`}
              onClick={() => setActiveAdminTask(task.id)}
            >
              <div className="admin-task-button__content">
                <strong>{task.label}</strong>
                <span>{task.note}</span>
              </div>
              <span className="admin-task-button__badge">{task.count}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      {activeAdminTask === 'submissions' ? (
        <SectionCard
          title="Godkjenn innsendinger"
          description="Ventende innsendinger ligger først, slik at admin kan jobbe raskt gjennom elevflyten."
        >
          <div className="admin-section-toolbar">
            <div>
              <strong>{pendingSubmissionCount} venter på vurdering</strong>
              <p>Godkjenn eller avslå først. Historikk ligger under.</p>
            </div>
            <div className="admin-section-toolbar__actions">
              <button
                type="button"
                className="action-button action-button--ghost"
                onClick={() => setActiveAdminTask('overview')}
              >
                Se oversikt
              </button>
              <button
                type="button"
                className="action-button action-button--ghost"
                onClick={() => setActiveAdminTask('duels')}
              >
                Aktive knute-offs
              </button>
            </div>
          </div>

          <div className="admin-task-panel">
            <div className="admin-subsection">
              <div className="section-card__header">
                <h3>Ventende nå</h3>
                <p>Dette er hovedkøen for admin.</p>
              </div>
              <SubmissionList
                items={pendingSubmissions}
                canReview
                onReviewSubmission={onReviewSubmission}
              />
            </div>

            <div className="admin-subsection">
              <div className="section-card__header">
                <h3>Ferdig behandlet</h3>
                <p>{resolvedSubmissionCount} innsendinger er allerede vurdert.</p>
              </div>
              <SubmissionList
                items={resolvedSubmissions}
                canReview={false}
                onReviewSubmission={onReviewSubmission}
              />
            </div>
          </div>
        </SectionCard>
      ) : null}

      {activeAdminTask === 'knots' ? (
        <SectionCard
          title="Knuter"
          description="Knutesjef-oppgaver er samlet her: legg til, organiser og juster poeng."
        >
          <div className="admin-section-toolbar">
            <div>
              <strong>{totalKnotCount} knuter i systemet</strong>
              <p>Importer nye knuter og juster poeng/sletting i samme arbeidsflate.</p>
            </div>
            <div className="admin-section-toolbar__actions">
              <button
                type="button"
                className="action-button action-button--ghost"
                onClick={() => setActiveAdminTask('overview')}
              >
                Se oversikt
              </button>
            </div>
          </div>

          <div className="admin-task-panel">
            <div className="admin-subsection">
              <div className="section-card__header">
                <h3>Importer / legg til</h3>
                <p>Lim inn en knute per linje. Nye knuter legges rett inn i prototypen.</p>
              </div>

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
            </div>

            <div className="admin-subsection">
              <div className="section-card__header">
                <h3>Poeng og sletting</h3>
                <p>Juster poeng eller fjern knuter direkte her.</p>
              </div>

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
            </div>
          </div>
        </SectionCard>
      ) : null}

      {activeAdminTask === 'duels' ? (
        <SectionCard
          title="Knute-offs"
          description="Her styrer admin de små duellene som gir litt ekstra bevegelse i leaderboardet."
        >
          <div className="admin-section-toolbar">
            <div>
              <strong>{activeDuelCount} aktive knute-offs</strong>
              <p>
                Hver duel har {duelSummary?.stake ?? 5} poeng innsats og{' '}
                {duelSummary?.deadlineHours ?? 48} timers frist.
              </p>
            </div>
            <div className="admin-section-toolbar__actions">
              <button
                type="button"
                className="action-button action-button--ghost"
                onClick={() => setActiveAdminTask('submissions')}
              >
                Til innsendinger
              </button>
            </div>
          </div>

          <div className="admin-task-panel">
            <div className="admin-subsection">
              <div className="section-card__header">
                <h3>Aktive knute-offs</h3>
                <p>Marker fullføring og avgjør utfallet med enkel prototype-logikk.</p>
              </div>

              <div className="duel-history-list">
                {activeDuels.length ? (
                  activeDuels.map((duel) => (
                    <article
                      key={duel.id}
                      className="duel-history-row duel-history-row--active"
                    >
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
                          onClick={() =>
                            onMarkDuelCompleted(duel.id, duel.challengerId)
                          }
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

            <div className="admin-subsection">
              <div className="section-card__header">
                <h3>Historikk</h3>
                <p>{resolvedDuelCount} avgjorte knute-offs er logget.</p>
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
          </div>
        </SectionCard>
      ) : null}

      {activeAdminTask === 'overview' ? (
        <SectionCard
          title="Oversikt"
          description="En kort admin-oppsummering med raske hopp til neste oppgave."
        >
          <div className="admin-section-toolbar">
            <div>
              <strong>Adminoversikt</strong>
              <p>Bruk denne som startflate når du vil orientere deg raskt.</p>
            </div>
            <div className="admin-section-toolbar__actions">
              <button
                type="button"
                className="action-button"
                onClick={() => setActiveAdminTask('submissions')}
              >
                Gå til ventende
              </button>
              <button
                type="button"
                className="action-button action-button--ghost"
                onClick={() => setActiveAdminTask('knots')}
              >
                Gå til knuter
              </button>
            </div>
          </div>

          <div className="admin-task-panel">
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

            <div className="admin-quick-grid">
              <button
                type="button"
                className="admin-quick-card"
                onClick={() => setActiveAdminTask('submissions')}
              >
                <strong>Godkjenn innsendinger</strong>
                <p>{pendingSubmissionCount} ventende saker</p>
              </button>
              <button
                type="button"
                className="admin-quick-card"
                onClick={() => setActiveAdminTask('knots')}
              >
                <strong>Administrer knuter</strong>
                <p>{totalKnotCount} knuter i katalogen</p>
              </button>
              <button
                type="button"
                className="admin-quick-card"
                onClick={() => setActiveAdminTask('duels')}
              >
                <strong>Følg knute-offs</strong>
                <p>{activeDuelCount} aktive akkurat nå</p>
              </button>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
import { MobileVideo } from '../components/MobileVideo.jsx';
