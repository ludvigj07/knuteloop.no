import { MobileVideo } from '../components/MobileVideo.jsx';

function FeedMedia({ entry }) {
  if (entry.videoPreviewUrl) {
    return (
      <MobileVideo
        className="feed-card__media"
        controls
        autoPlay
        muted
        loop
        preload="auto"
        src={entry.videoPreviewUrl}
      />
    );
  }

  if (entry.imagePreviewUrl) {
    return (
      <img
        className="feed-card__media"
        src={entry.imagePreviewUrl}
        alt={`${entry.studentName} sitt bevis for ${entry.knotTitle}`}
      />
    );
  }

  return (
    <div className="feed-card__placeholder">
      <span className="feed-card__placeholder-kicker">Ingen media</span>
      <strong>{entry.knotTitle}</strong>
      <p>Tekst og poeng ligger fortsatt ute i feeden.</p>
    </div>
  );
}

export function FeedPage({ activityLog, onOpenProfile }) {
  if (!activityLog?.length) {
    return (
      <section className="section-card">
        <div className="section-card__header">
          <h3>Feed</h3>
          <p>Ingen godkjente knuter ligger ute ennå.</p>
        </div>
      </section>
    );
  }

  return (
    <div className="feed-page">
      <div className="feed-page__header">
        <div>
          <p className="eyebrow">Feed</p>
          <h2>Knuter som faktisk ble tatt</h2>
          <p>Scroll som en kort-feed og se bilde, tekst og poeng fra godkjente knuter.</p>
        </div>
      </div>

      <div className="feed-reel">
        {activityLog.map((entry, index) => (
          <article key={entry.id} className="feed-card">
            <div className="feed-card__media-wrap">
              <FeedMedia entry={entry} />
            </div>

            <div className="feed-card__content">
              <div className="feed-card__top">
                <div className="feed-card__person">
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
                  <div className="feed-card__person-copy">
                    <strong>{entry.studentName}</strong>
                    <p>
                      {entry.studentRealName} • {entry.studentGroup}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="action-button action-button--ghost action-button--compact"
                  onClick={() => onOpenProfile(entry.studentId)}
                >
                  Profil
                </button>
              </div>

              <div className="feed-card__meta">
                <span className="feed-card__count">
                  Post {index + 1} av {activityLog.length}
                </span>
                <div className="feed-card__badge-row">
                  <span className="pill pill--soft">{entry.category}</span>
                  <span className="pill pill--warning">{entry.points}p</span>
                  <span className="pill pill--muted">{entry.completedAt}</span>
                </div>
              </div>

              <div className="feed-card__body">
                <h3>{entry.knotTitle}</h3>
                <p className="feed-card__body-copy">
                  {entry.note
                    ? 'Dette skrev brukeren da knuten ble sendt inn.'
                    : 'Ingen tekst ble lagt ved denne knuten.'}
                </p>
                {entry.note ? (
                  <p className="feed-card__note">{entry.note}</p>
                ) : (
                  <p className="feed-card__note feed-card__note--muted">
                    Ingen tekst ble lagt ved denne knuten.
                  </p>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
