import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MobileVideo } from '../components/MobileVideo.jsx';
import anonymousFeedJoker from '../assets/anonymous-feed-joker.jpg';
import anonymousFeedMask from '../assets/anonymous-feed-mask.png';
import anonymousFeedWolf from '../assets/anonymous-feed-wolf.png';

const STAR_VALUES = [1, 2, 3, 4, 5];
const REPORT_REASONS = [
  'Spam',
  'Upassende',
  'Juks/falsk bevis',
  'Trakassering',
  'Annet',
];
const ANONYMOUS_FEED_AVATARS = [anonymousFeedJoker, anonymousFeedMask, anonymousFeedWolf];

function formatRatingAverage(value) {
  const numericValue = Number(value) || 0;
  return numericValue.toFixed(1);
}

function getRatingSummaryLabel(average, count) {
  const safeCount = Number(count) || 0;

  if (safeCount <= 0) {
    return 'Ingen vurderinger enda';
  }

  const voteLabel = safeCount === 1 ? 'stemme' : 'stemmer';
  return `Snitt ${formatRatingAverage(average)} av 5 (${safeCount} ${voteLabel})`;
}

function useDesktopFeed(breakpointPx = 901) {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.innerWidth >= breakpointPx;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mediaQuery = window.matchMedia(`(min-width: ${breakpointPx}px)`);
    const syncState = (event) => setIsDesktop(event.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncState);

      return () => {
        mediaQuery.removeEventListener('change', syncState);
      };
    }

    mediaQuery.addListener(syncState);

    return () => {
      mediaQuery.removeListener(syncState);
    };
  }, [breakpointPx]);

  return isDesktop;
}

function FeedLightbox({ entry, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isVideo = entry.mediaType === 'video' && entry.videoPreviewUrl;

  return createPortal(
    <div className="feed-lightbox" onClick={onClose} role="presentation">
      <button
        type="button"
        className="feed-lightbox__close"
        onClick={onClose}
        aria-label="Lukk"
      >
        {'\u00D7'}
      </button>
      <div
        className="feed-lightbox__content"
        data-swipe-lock="true"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideo ? (
          <video
            className="feed-lightbox__video"
            src={entry.videoPreviewUrl}
            controls
            autoPlay
            playsInline
          />
        ) : (
          <img
            className="feed-lightbox__img"
            src={entry.imagePreviewUrl}
            alt={`${entry.studentName} sitt bildebevis for ${entry.knotTitle}`}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}

function FeedMedia({ entry, variant = 'mobile' }) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const isDesktop = variant === 'desktop';
  const mediaWrapClass = isDesktop
    ? 'feed-card-desktop__media-wrap'
    : 'feed-card-v3__media-wrap';
  const mediaClass = isDesktop ? 'feed-card-desktop__media' : 'feed-card-v3__media';
  const placeholderClass = isDesktop
    ? 'feed-card-desktop__media-wrap--placeholder'
    : 'feed-card-v3__media-wrap--placeholder';

  if (entry.mediaType === 'video' && entry.videoPreviewUrl && !videoFailed) {
    return (
      <>
        <div className={mediaWrapClass}>
          <MobileVideo
            className={mediaClass}
            controls
            autoPlay={false}
            loop={false}
            muted={false}
            preload="metadata"
            src={entry.videoPreviewUrl}
            onError={() => setVideoFailed(true)}
          />
          <button
            type="button"
            className="feed-media__fs-btn"
            onClick={() => setLightboxOpen(true)}
            aria-label="Åpne video i fullskjerm"
          >
            {'\u26F6'}
          </button>
        </div>
        {lightboxOpen && (
          <FeedLightbox entry={entry} onClose={() => setLightboxOpen(false)} />
        )}
      </>
    );
  }

  if (entry.mediaType === 'image' && entry.imagePreviewUrl) {
    return (
      <>
        <div
          className={`${mediaWrapClass} feed-media--clickable`}
          role="button"
          tabIndex={0}
          onClick={() => setLightboxOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setLightboxOpen(true);
          }}
          aria-label="Åpne bilde i fullskjerm"
        >
          <img
            className={mediaClass}
            src={entry.imagePreviewUrl}
            alt={`${entry.studentName} sitt bildebevis for ${entry.knotTitle}`}
          />
        </div>
        {lightboxOpen && (
          <FeedLightbox entry={entry} onClose={() => setLightboxOpen(false)} />
        )}
      </>
    );
  }

  return (
    <div className={`${mediaWrapClass} ${placeholderClass}`}>
      <span>{entry.knotTitle}</span>
      <p>Denne posten har ingen media.</p>
    </div>
  );
}

function FeedRatingRow({ entry, isSubmitting, onRate, errorMessage = '' }) {
  if (!entry.submissionId) {
    return null;
  }

  const [hoverRating, setHoverRating] = useState(null);
  const myRating = Number(entry.myRating) || 0;
  const activeRating = hoverRating ?? myRating;
  const ratingAverage = Number(entry.ratingAverage) || 0;
  const ratingCount = Number(entry.ratingCount) || 0;
  const summaryLabel = getRatingSummaryLabel(ratingAverage, ratingCount);

  return (
    <div className="feed-card-v3__reactions" aria-label="Stjernerating">
      <div className="feed-rating">
        <div
          className="feed-rating__stars"
          role="group"
          aria-label="Gi 1 til 5 stjerner"
          onMouseLeave={() => setHoverRating(null)}
        >
          {STAR_VALUES.map((value) => {
            const isActive = value <= activeRating;

            return (
              <button
                key={`${entry.id}-star-${value}`}
                type="button"
                className={`feed-rating-star ${isActive ? 'is-active' : ''}`}
                disabled={isSubmitting}
                onMouseEnter={() => setHoverRating(value)}
                onFocus={() => setHoverRating(value)}
                onBlur={() => setHoverRating(null)}
                onClick={() => {
                  setHoverRating(null);
                  onRate(entry, value);
                }}
                aria-label={`Gi ${value} stjerne${value > 1 ? 'r' : ''}`}
                title={`${value} stjerne${value > 1 ? 'r' : ''}`}
              >
                {'\u2605'}
              </button>
            );
          })}
        </div>
        <p className="feed-rating__summary">{summaryLabel}</p>
        {errorMessage ? <p className="feed-rating__error">{errorMessage}</p> : null}
      </div>
    </div>
  );
}

function FeedDeleteButton({ canDelete, entry, isDeleting, onDelete }) {
  if (!canDelete || !entry.submissionId) {
    return null;
  }

  return (
    <button
      type="button"
      className="feed-card-delete-button"
      onClick={() => onDelete(entry)}
      disabled={isDeleting}
      aria-label="Slett feed-post"
      title="Slett feed-post"
    >
      {isDeleting ? '...' : '\u00D7'}
    </button>
  );
}

function FeedReportButton({ entry, isSubmitting, onReport }) {
  if (!entry?.submissionId || !onReport) {
    return null;
  }

  return (
    <button
      type="button"
      className="action-button action-button--ghost action-button--compact feed-card-report-button"
      onClick={() => onReport(entry)}
      disabled={isSubmitting}
    >
      Rapporter
    </button>
  );
}

function getAnonymousAvatarByEntry(entry) {
  const numericSubmissionId = Number(entry?.submissionId);

  if (Number.isInteger(numericSubmissionId) && numericSubmissionId > 0) {
    return ANONYMOUS_FEED_AVATARS[numericSubmissionId % ANONYMOUS_FEED_AVATARS.length];
  }

  const fallbackKey = String(entry?.id ?? entry?.knotTitle ?? '');
  let hash = 0;

  for (let index = 0; index < fallbackKey.length; index += 1) {
    hash = ((hash << 5) - hash + fallbackKey.charCodeAt(index)) | 0;
  }

  const normalizedHash = Math.abs(hash);
  return ANONYMOUS_FEED_AVATARS[normalizedHash % ANONYMOUS_FEED_AVATARS.length];
}

function FeedProfileAvatar({ entry }) {
  const photoUrl = entry.isAnonymous
    ? getAnonymousAvatarByEntry(entry)
    : entry.studentPhotoUrl;

  if (photoUrl) {
    return (
      <div className="profile-photo profile-photo--small">
        <img
          src={photoUrl}
          alt={entry.isAnonymous ? 'Anonym profilbilde' : `${entry.studentName} profilbilde`}
        />
      </div>
    );
  }

  return <div className="profile-avatar profile-avatar--small">{entry.studentIcon}</div>;
}

function FeedCardMobile({
  canDelete,
  entry,
  index,
  isDeleting,
  isReporting,
  total,
  isSubmitting,
  onDelete,
  onOpenProfile,
  onReport,
  onRate,
  ratingError,
}) {
  return (
    <article className="feed-card-v3">
      <FeedDeleteButton
        canDelete={canDelete}
        entry={entry}
        isDeleting={isDeleting}
        onDelete={onDelete}
      />

      <header className="feed-card-v3__header">
        <button
          type="button"
          className="feed-card-v3__profile"
          onClick={() => onOpenProfile?.(entry.studentId)}
          disabled={!entry.studentId || entry.isAnonymous}
        >
          <FeedProfileAvatar entry={entry} />
          <div className="feed-card-v3__profile-copy">
            <strong>{entry.studentName}</strong>
            <p>{entry.studentGroup}</p>
          </div>
        </button>
        <span className="feed-card-v3__index">
          {index + 1}/{total}
        </span>
      </header>

      <FeedMedia entry={entry} variant="mobile" />

      <div className="feed-card-v3__content">
        <h3>{entry.knotTitle}</h3>
        <p className="feed-card-v3__meta">{entry.points} poeng · {entry.completedAt}</p>
        {entry.note ? <p className="feed-card-v3__note">{entry.note}</p> : null}
        <div className="feed-card-v3__mod-actions">
          <FeedReportButton
            entry={entry}
            isSubmitting={isReporting}
            onReport={onReport}
          />
        </div>
      </div>

      <FeedRatingRow
        entry={entry}
        isSubmitting={isSubmitting}
        onRate={onRate}
        errorMessage={ratingError}
      />
    </article>
  );
}

function FeedCardDesktop({
  canDelete,
  entry,
  index,
  isDeleting,
  isReporting,
  total,
  isSubmitting,
  onDelete,
  onOpenProfile,
  onReport,
  onRate,
  ratingError,
}) {
  return (
    <article className="feed-card-desktop">
      <FeedDeleteButton
        canDelete={canDelete}
        entry={entry}
        isDeleting={isDeleting}
        onDelete={onDelete}
      />

      <header className="feed-card-desktop__header">
        <button
          type="button"
          className="feed-card-v3__profile"
          onClick={() => onOpenProfile?.(entry.studentId)}
          disabled={!entry.studentId || entry.isAnonymous}
        >
          <FeedProfileAvatar entry={entry} />
          <div className="feed-card-v3__profile-copy">
            <strong>{entry.studentName}</strong>
            <p>{entry.studentGroup}</p>
          </div>
        </button>
        <span className="feed-card-v3__index">
          {index + 1}/{total}
        </span>
      </header>

      <div className="feed-card-desktop__body">
        <FeedMedia entry={entry} variant="desktop" />

        <div className="feed-card-desktop__content">
          <h3>{entry.knotTitle}</h3>
          <p className="feed-card-v3__meta">{entry.points} poeng · {entry.completedAt}</p>
          {entry.note ? <p className="feed-card-v3__note">{entry.note}</p> : null}
          <div className="feed-card-v3__mod-actions">
            <FeedReportButton
              entry={entry}
              isSubmitting={isReporting}
              onReport={onReport}
            />
          </div>

          <FeedRatingRow
            entry={entry}
            isSubmitting={isSubmitting}
            onRate={onRate}
            errorMessage={ratingError}
          />
        </div>
      </div>
    </article>
  );
}

export function FeedPage({
  activityLog,
  canDeletePosts = false,
  currentUserActiveBans = [],
  onDeleteSubmission,
  onOpenProfile,
  onReportSubmission,
  onRateSubmission,
}) {
  const [pendingBySubmission, setPendingBySubmission] = useState({});
  const [deletingBySubmission, setDeletingBySubmission] = useState({});
  const [reportingBySubmission, setReportingBySubmission] = useState({});
  const [ratingDraftBySubmission, setRatingDraftBySubmission] = useState({});
  const [ratingErrorBySubmission, setRatingErrorBySubmission] = useState({});
  const [reportModalEntry, setReportModalEntry] = useState(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportNote, setReportNote] = useState('');
  const [reportError, setReportError] = useState('');
  const [reportFeedback, setReportFeedback] = useState('');
  const isDesktop = useDesktopFeed();
  const feedEntries = activityLog.filter((entry) => Boolean(entry.submissionId));

  function clearRatingError(submissionId) {
    setRatingErrorBySubmission((current) => {
      if (!current[submissionId]) {
        return current;
      }

      const next = { ...current };
      delete next[submissionId];
      return next;
    });
  }

  async function handleRate(entry, rating) {
    if (!entry.submissionId || !onRateSubmission) {
      return;
    }

    if (pendingBySubmission[entry.submissionId]) {
      return;
    }

    const previousRating = Number(entry.myRating) || null;
    clearRatingError(entry.submissionId);
    setRatingDraftBySubmission((current) => ({
      ...current,
      [entry.submissionId]: rating,
    }));

    setPendingBySubmission((current) => ({
      ...current,
      [entry.submissionId]: true,
    }));

    try {
      await onRateSubmission(entry.submissionId, rating);
      setRatingDraftBySubmission((current) => {
        const next = { ...current };
        delete next[entry.submissionId];
        return next;
      });
    } catch (error) {
      setRatingDraftBySubmission((current) => ({
        ...current,
        [entry.submissionId]: previousRating,
      }));
      setRatingErrorBySubmission((current) => ({
        ...current,
        [entry.submissionId]:
          error instanceof Error && error.message
            ? error.message
            : 'Kunne ikke lagre rating nå. Prøv igjen.',
      }));
    } finally {
      setPendingBySubmission((current) => {
        const next = { ...current };
        delete next[entry.submissionId];
        return next;
      });
    }
  }

  async function handleDelete(entry) {
    if (!entry.submissionId || !onDeleteSubmission) {
      return;
    }

    if (deletingBySubmission[entry.submissionId]) {
      return;
    }

    const shouldDelete =
      typeof window === 'undefined' ||
      window.confirm('Er du sikker på at du vil slette denne feed-posten?');

    if (!shouldDelete) {
      return;
    }

    setDeletingBySubmission((current) => ({
      ...current,
      [entry.submissionId]: true,
    }));

    try {
      await onDeleteSubmission(entry.submissionId);
    } finally {
      setDeletingBySubmission((current) => {
        const next = { ...current };
        delete next[entry.submissionId];
        return next;
      });
    }
  }

  function openReportModal(entry) {
    if (!entry?.submissionId || !onReportSubmission) {
      return;
    }

    setReportModalEntry(entry);
    setReportReason(REPORT_REASONS[0]);
    setReportNote('');
    setReportError('');
    setReportFeedback('');
  }

  function closeReportModal() {
    setReportModalEntry(null);
    setReportError('');
  }

  async function handleSubmitReport() {
    if (!reportModalEntry?.submissionId || !onReportSubmission) {
      return;
    }

    const submissionId = reportModalEntry.submissionId;
    setReportError('');
    setReportingBySubmission((current) => ({
      ...current,
      [submissionId]: true,
    }));

    try {
      await onReportSubmission(submissionId, reportReason, reportNote.trim());
      setReportFeedback('Rapport sendt. Admin følger opp posten manuelt.');
      setReportModalEntry(null);
    } catch (error) {
      setReportError(
        error instanceof Error && error.message
          ? error.message
          : 'Kunne ikke sende rapport akkurat nå.',
      );
    } finally {
      setReportingBySubmission((current) => {
        const next = { ...current };
        delete next[submissionId];
        return next;
      });
    }
  }

  if (!feedEntries?.length) {
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
    <div className="feed-page feed-page--friendly">
      <div className="feed-page__header">
        <p className="eyebrow">Feed</p>
        <h2>Delte øyeblikk fra knutene</h2>
        <p>Et trygt sted for små og store knuteøyeblikk.</p>
      </div>
      {reportFeedback ? <p className="form-feedback">{reportFeedback}</p> : null}

      <div className="feed-list-v3">
        {feedEntries.map((entry, index) =>
          isDesktop ? (
            <FeedCardDesktop
              key={entry.id}
              canDelete={canDeletePosts}
              entry={{
                ...entry,
                myRating:
                  ratingDraftBySubmission[entry.submissionId] ?? entry.myRating,
              }}
              index={index}
              isDeleting={Boolean(deletingBySubmission[entry.submissionId])}
              isReporting={Boolean(reportingBySubmission[entry.submissionId])}
              total={feedEntries.length}
              isSubmitting={Boolean(pendingBySubmission[entry.submissionId])}
              ratingError={ratingErrorBySubmission[entry.submissionId] ?? ''}
              onDelete={handleDelete}
              onOpenProfile={onOpenProfile}
              onReport={openReportModal}
              onRate={handleRate}
            />
          ) : (
            <FeedCardMobile
              key={entry.id}
              canDelete={canDeletePosts}
              entry={{
                ...entry,
                myRating:
                  ratingDraftBySubmission[entry.submissionId] ?? entry.myRating,
              }}
              index={index}
              isDeleting={Boolean(deletingBySubmission[entry.submissionId])}
              isReporting={Boolean(reportingBySubmission[entry.submissionId])}
              total={feedEntries.length}
              isSubmitting={Boolean(pendingBySubmission[entry.submissionId])}
              ratingError={ratingErrorBySubmission[entry.submissionId] ?? ''}
              onDelete={handleDelete}
              onOpenProfile={onOpenProfile}
              onReport={openReportModal}
              onRate={handleRate}
            />
          ),
        )}
      </div>

      {reportModalEntry ? (
        <div
          className="feed-report-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeReportModal();
            }
          }}
        >
          <div
            className="feed-report-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feed-report-title"
          >
            <h3 id="feed-report-title">Rapporter post</h3>
            <p className="feed-report-modal__subtitle">
              {reportModalEntry.knotTitle}
            </p>

            <label className="field-group">
              <span>Årsak</span>
              <select
                className="text-input"
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
              >
                {REPORT_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group">
              <span>Kommentar (valgfritt)</span>
              <textarea
                className="text-input text-input--area text-input--compact"
                value={reportNote}
                maxLength={300}
                onChange={(event) => setReportNote(event.target.value)}
                placeholder="Kort forklaring til admin."
              />
            </label>

            {reportError ? <p className="feed-rating__error">{reportError}</p> : null}

            <div className="feed-report-modal__actions">
              <button
                type="button"
                className="action-button action-button--ghost"
                onClick={closeReportModal}
              >
                Avbryt
              </button>
              <button
                type="button"
                className="action-button"
                onClick={handleSubmitReport}
                disabled={Boolean(reportingBySubmission[reportModalEntry.submissionId])}
              >
                {reportingBySubmission[reportModalEntry.submissionId]
                  ? 'Sender...'
                  : 'Send rapport'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

