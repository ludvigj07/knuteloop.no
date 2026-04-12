import { SectionCard } from '../components/SectionCard.jsx';

export function ActivityLogPage({ activityLog, onSelectProfile }) {
  const uniqueStudents = new Set(
    activityLog.map((entry) => entry.studentId),
  ).size;
  const totalPoints = activityLog.reduce(
    (sum, entry) => sum + entry.points,
    0,
  );

  return (
    <div className="stack-layout">
      <SectionCard
        title="Aktivitetsoversikt"
        description="Her ser du godkjente knuter og deltakelse i kullet."
      >
        <div className="stats-grid activity-log-summary">
          <article className="stat-card">
            <span>Godkjente knuter</span>
            <strong>{activityLog.length}</strong>
            <p>Samlet feed fra alle profiler i prototypen.</p>
          </article>
          <article className="stat-card">
            <span>Elever i loggen</span>
            <strong>{uniqueStudents}</strong>
            <p>Viser både demo-brukeren og de fake profilene.</p>
          </article>
          <article className="stat-card">
            <span>Registrerte poeng</span>
            <strong>{totalPoints}p</strong>
            <p>Basert på knuter som allerede er godkjent.</p>
          </article>
        </div>
      </SectionCard>

      <SectionCard
        title="Siste aktivitet i feeden"
        description="Trykk deg inn på profiler hvis du vil se mer av historikken."
      >
        {activityLog.length === 0 ? (
          <p className="folder-empty">
            Ingen godkjente knuter er registrert ennå i denne prototypen.
          </p>
        ) : (
          <div className="activity-log-list">
            {activityLog.map((entry) => (
              <article className="activity-log-row" key={entry.id}>
                <div className="activity-log-row__person">
                  {entry.studentPhotoUrl ? (
                    <div className="profile-photo profile-photo--small">
                      <img
                        src={entry.studentPhotoUrl}
                        alt={`${entry.studentName} profilbilde`}
                      />
                    </div>
                  ) : (
                    <div className="profile-avatar profile-avatar--small">
                      {entry.studentIcon}
                    </div>
                  )}
                  <div>
                    <strong>{entry.studentName}</strong>
                    <p>
                      {entry.studentRealName} • {entry.studentGroup}
                    </p>
                  </div>
                </div>

                <div className="activity-log-row__content">
                  <h3>
                    {entry.studentName}: {entry.knotTitle}
                  </h3>
                  <p>
                    {entry.category} • {entry.completedAt}
                  </p>
                </div>

                <div className="activity-log-row__meta">
                  <strong>{entry.points}p</strong>
                  {onSelectProfile ? (
                    <button
                      className="action-button action-button--ghost action-button--compact"
                      type="button"
                      onClick={() => onSelectProfile(entry.studentId)}
                    >
                      Se profil
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

