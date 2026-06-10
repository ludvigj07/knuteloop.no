import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MobileVideo } from '../components/MobileVideo.jsx';
import { BackToTopButton } from '../components/BackToTopButton.jsx';
import { PostActionsMenu } from '../components/PostActionsMenu.jsx';
import { PhotoZoomViewer } from '../components/PhotoZoomViewer.jsx';
import {
  ReactionPicker,
  ReactionFlyOverlay,
  REACTION_FLY_DURATION_MS,
} from '../components/ReactionPicker.jsx';
import { playTick } from '../lib/sounds.js';
import anonymousFeedJoker from '../assets/anonymous-feed-joker.jpg';
import anonymousFeedMask from '../assets/anonymous-feed-mask.png';
import anonymousFeedWolf from '../assets/anonymous-feed-wolf.png';

const STAR_VALUES = [1, 2, 3, 4, 5];
const REPORT_REASONS = ['Spam', 'Upassende', 'Juks/falsk bevis', 'Trakassering', 'Annet'];
const ANONYMOUS_FEED_AVATARS = [
  anonymousFeedJoker,
  anonymousFeedMask,
  anonymousFeedWolf,
];
const DELETE_FADE_OUT_MS = 200;
const DELETE_TOAST_MS = 2800;
const COMMENT_SWIPE_THRESHOLD_PX = 44;
const COMMENT_SWIPE_CLOSE_OFFSET_PX = 220;
const COMMENT_REPORT_REASONS = ['Spam', 'Trakassering', 'Upassende', 'Annet'];
// Vindusrendering av mobil-reelen: kort innenfor ±HYDRATION_RADIUS fra aktivt
// kort rendres fullt, resten er tomme skall med samme høyde. Video monteres
// kun innenfor ±VIDEO_RADIUS (nedlasting starter idet elementet monteres).
const MOBILE_HYDRATION_RADIUS = 2;
const MOBILE_VIDEO_RADIUS = 1;
// Desktop-feeden starter med én batch og henter flere når sentinelen nederst
// nærmer seg viewporten.
const DESKTOP_FEED_BATCH_SIZE = 10;

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

function getCommentsCountLabel(count) {
  if (!count) return 'Ingen kommentarer ennå';
  return count === 1 ? '1 kommentar' : `${count} kommentarer`;
}

function getFeedTextPrimary(entry) {
  const note = typeof entry?.note === 'string' ? entry.note.trim() : '';
  const title = typeof entry?.knotTitle === 'string' ? entry.knotTitle.trim() : '';

  return note || title || 'Ren tekstpost';
}

function getFeedTextSecondary(entry) {
  const note = typeof entry?.note === 'string' ? entry.note.trim() : '';
  const title = typeof entry?.knotTitle === 'string' ? entry.knotTitle.trim() : '';

  if (note && title && note.toLowerCase() !== title.toLowerCase()) {
    return `- ${title}`;
  }

  return `- ${entry?.studentName ?? 'Ukjent'}`;
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
      return () => mediaQuery.removeEventListener('change', syncState);
    }

    mediaQuery.addListener(syncState);
    return () => mediaQuery.removeListener(syncState);
  }, [breakpointPx]);

  return isDesktop;
}

function FeedLightbox({ entry, onClose }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

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
        onClick={(event) => event.stopPropagation()}
      >
        {isVideo ? (
          <MobileVideo
            className="feed-lightbox__video"
            src={entry.videoPreviewUrl}
            controls
            autoPlay
            muted={false}
            loop={false}
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

function FeedMedia({
  entry,
  variant = 'mobile',
  isActive = false,
  // Kun kort nær viewporten får montere <video>. Et montert videoelement med
  // autoplay begynner å laste ned videodata umiddelbart — uten denne gaten
  // lastet samtlige videoer i feeden samtidig.
  allowVideoLoad = true,
  audioOn = false,
  onToggleAudio,
}) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState(null);
  const videoRef = useRef(null);
  const isDesktop = variant === 'desktop';
  const mediaClass = isDesktop ? 'feed-card-desktop__media' : 'feed-reel-card__media';
  const isTextOnly = entry.mediaType !== 'video' && entry.mediaType !== 'image';

  function renderDesktopPlaceholder() {
    return (
      <div className="feed-card-desktop__media-wrap--placeholder">
        <div className="feed-card-desktop__text-scene">
          <span className="feed-text-scene__eyebrow">Tekstpost</span>
          <strong>{entry.knotTitle}</strong>
          <p>{entry.note ? entry.note : 'Denne posten har ingen bilde- eller videofil.'}</p>
        </div>
      </div>
    );
  }

  function renderMobileFrame(children, backdrop = null) {
    return (
      <div className="feed-reel-card__media-wrap">
        <div className="feed-reel-card__media-shell">
          {backdrop}
          <div className="feed-reel-card__media-tone" />
          <div className="feed-reel-card__media-frame">{children}</div>
        </div>
      </div>
    );
  }

  if (!isDesktop && isTextOnly) {
    return (
      <div className="feed-reel-card__text-stage">
        <div className="feed-reel-card__text-card">
          <span className="feed-text-scene__eyebrow feed-text-scene__eyebrow--light">
            Kun tekst
          </span>
          <strong>"{getFeedTextPrimary(entry)}"</strong>
          <p>{getFeedTextSecondary(entry)}</p>
        </div>
      </div>
    );
  }

  if (entry.mediaType === 'video' && entry.videoPreviewUrl && !videoFailed) {
    const desktopVideo = (
      <MobileVideo
        ref={videoRef}
        className={mediaClass}
        controls
        autoPlay={false}
        loop={false}
        muted={false}
        playsInline
        preload="metadata"
        src={entry.videoPreviewUrl}
        isActive={false}
        playMode="auto"
        onAutoplayBlocked={(blocked) => setAutoplayBlocked(blocked)}
        onError={() => setVideoFailed(true)}
      />
    );
    const mobileVideo = allowVideoLoad ? (
      <MobileVideo
        ref={videoRef}
        className={mediaClass}
        controls={false}
        autoPlay
        loop
        muted={!audioOn}
        playsInline
        preload="metadata"
        src={entry.videoPreviewUrl}
        isActive={isActive}
        playMode={audioOn ? 'sound-preferred' : 'auto'}
        onAutoplayBlocked={(blocked) => setAutoplayBlocked(blocked)}
        onError={() => setVideoFailed(true)}
      />
    ) : (
      <div className="feed-video-standby" aria-hidden="true">
        <span className="feed-video-standby__icon">{'▶'}</span>
      </div>
    );

    const handleSoundToggle = async () => {
      const willTurnOn = !audioOn;

      if (willTurnOn) {
        const didPlay = await videoRef.current?.playWithAudio?.();
        if (didPlay) {
          onToggleAudio?.(true);
        } else {
          // Browseren blokkerte \u2014 fall tilbake til muted og varsle via fallback-knappen
          await videoRef.current?.playMuted?.();
        }
      } else {
        onToggleAudio?.(false);
      }
    };

    return (
      <>
        {isDesktop ? (
          <div className="feed-card-desktop__media-wrap">
            {desktopVideo}
            <button
              type="button"
              className="feed-media__fs-btn"
              onClick={() => setLightboxOpen(true)}
              aria-label="Apne video i fullskjerm"
            >
              {'\u26F6'}
            </button>
          </div>
        ) : (
          renderMobileFrame(mobileVideo)
        )}
        {!isDesktop && isActive ? (
          <button
            type="button"
            className="feed-video-sound-toggle"
            onClick={handleSoundToggle}
            aria-label={audioOn ? 'Sla av lyd' : 'Sla pa lyd'}
            aria-pressed={audioOn}
          >
            {audioOn ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M3 10v4a1 1 0 0 0 1 1h3l4.3 3.7a1 1 0 0 0 1.7-.8V6.1a1 1 0 0 0-1.7-.8L7 9H4a1 1 0 0 0-1 1Z" />
                <path d="M16.5 8.5a4 4 0 0 1 0 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                <path d="M18.8 5.7a8 8 0 0 1 0 12.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M3 10v4a1 1 0 0 0 1 1h3l4.3 3.7a1 1 0 0 0 1.7-.8V6.1a1 1 0 0 0-1.7-.8L7 9H4a1 1 0 0 0-1 1Z" />
                <path d="M16 9l5 6m0-6-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
              </svg>
            )}
          </button>
        ) : null}
        {!isDesktop && autoplayBlocked && isActive ? (
          <button
            type="button"
            className="feed-video-fallback-button"
            onClick={async () => {
              const didPlay = await videoRef.current?.playWithAudio?.();

              if (didPlay) {
                onToggleAudio?.(true);
              } else {
                await videoRef.current?.playMuted?.();
              }

              setAutoplayBlocked(false);
            }}
          >
            Trykk for lyd og start
          </button>
        ) : null}
        {lightboxOpen ? (
          <FeedLightbox entry={entry} onClose={() => setLightboxOpen(false)} />
        ) : null}
      </>
    );
  }

  if (entry.mediaType === 'image' && entry.imagePreviewUrl) {
    const handleOpenZoom = (event) => {
      const target = event?.currentTarget;
      const imgEl = target?.querySelector?.('img') ?? target;
      const rect = imgEl?.getBoundingClientRect?.();
      if (rect && rect.width > 0 && rect.height > 0) {
        const viewportW = window.innerWidth || rect.width;
        const viewportH = window.innerHeight || rect.height;
        const targetW = Math.min(viewportW, viewportH * (rect.width / rect.height));
        setZoomOrigin({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          scale: Math.max(0.2, rect.width / targetW),
        });
      } else {
        setZoomOrigin({ x: window.innerWidth / 2, y: window.innerHeight / 2, scale: 0.4 });
      }
      setLightboxOpen(true);
    };

    const image = (
      <img
        className={mediaClass}
        src={entry.imageThumbUrl || entry.imagePreviewUrl}
        alt={`${entry.studentName} sitt bildebevis for ${entry.knotTitle}`}
        loading="lazy"
        decoding="async"
      />
    );

    return (
      <>
        {isDesktop ? (
          <div
            className="feed-card-desktop__media-wrap feed-media--clickable"
            role="button"
            tabIndex={0}
            onClick={handleOpenZoom}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                handleOpenZoom(event);
              }
            }}
            aria-label="Apne bilde i fullskjerm"
            data-no-long-press="true"
          >
            {image}
          </div>
        ) : (
          renderMobileFrame(
            <div
              className="feed-reel-card__media-frame-button"
              role="button"
              tabIndex={0}
              onClick={handleOpenZoom}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  handleOpenZoom(event);
                }
              }}
              aria-label="Apne bilde i fullskjerm"
              data-no-long-press="true"
            >
              {image}
            </div>,
          )
        )}
        {lightboxOpen ? (
          <PhotoZoomViewer
            src={entry.imagePreviewUrl}
            alt={`${entry.studentName} sitt bildebevis for ${entry.knotTitle}`}
            origin={zoomOrigin}
            onClose={() => setLightboxOpen(false)}
          />
        ) : null}
      </>
    );
  }

  return isDesktop ? renderDesktopPlaceholder() : null;
}

function FeedRatingRow({
  entry,
  isSubmitting,
  onRate,
  errorMessage = '',
  isDisabled = false,
  disabledReason = '',
  variant = 'default',
}) {
  const [hoverRating, setHoverRating] = useState(null);

  if (!entry.submissionId) {
    return null;
  }

  const myRating = Number(entry.myRating) || 0;
  const activeRating = hoverRating ?? myRating;
  const ratingAverage = Number(entry.ratingAverage) || 0;
  const ratingCount = Number(entry.ratingCount) || 0;
  const summaryLabel = getRatingSummaryLabel(ratingAverage, ratingCount);
  const isOverlay = variant === 'overlay';
  const isInline = variant === 'inline';

  return (
    <div
      className={`feed-card-v3__reactions ${isOverlay ? 'feed-card-v3__reactions--overlay' : ''} ${
        isInline ? 'feed-card-v3__reactions--inline' : ''
      }`}
      aria-label="Stjernerating"
    >
      <div className={`feed-rating ${isOverlay ? 'feed-rating--overlay' : ''} ${isInline ? 'feed-rating--inline' : ''}`}>
        {isOverlay && !isInline ? (
          <p className={`feed-rating__summary ${isOverlay ? 'feed-rating__summary--overlay' : ''}`}>
            {summaryLabel}
          </p>
        ) : null}
        <div
          className={`feed-rating__stars ${isInline ? 'feed-rating__stars--inline' : ''}`}
          role="group"
          aria-label="Gi 1 til 5 stjerner"
          title={isInline && disabledReason ? disabledReason : undefined}
          onMouseLeave={() => setHoverRating(null)}
        >
          {STAR_VALUES.map((value) => {
            const isActive = value <= activeRating;

            return (
              <button
                key={`${entry.id}-star-${value}`}
                type="button"
                className={`feed-rating-star ${isActive ? 'is-active' : ''} ${
                  isOverlay ? 'feed-rating-star--overlay' : ''
                } ${isInline ? 'feed-rating-star--inline' : ''}`}
                disabled={isSubmitting || isDisabled}
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
        {isInline ? (
          <p className="feed-rating__summary feed-rating__summary--inline">{summaryLabel}</p>
        ) : null}
        {!isInline && !isOverlay ? (
          <p className={`feed-rating__summary ${isOverlay ? 'feed-rating__summary--overlay' : ''}`}>
            {summaryLabel}
          </p>
        ) : null}
        {!isInline && disabledReason ? (
          <p className={`feed-rating__hint ${isOverlay ? 'feed-rating__hint--overlay' : ''}`}>
            {disabledReason}
          </p>
        ) : null}
        {!isInline && errorMessage ? <p className="feed-rating__error">{errorMessage}</p> : null}
      </div>
    </div>
  );
}

function FeedPostActions({
  canManage,
  entry,
  isDeleting,
  onDelete,
  variant = 'floating',
}) {
  if (!canManage || !entry.submissionId) {
    return null;
  }

  return (
    <PostActionsMenu
      className={variant === 'hud' ? 'post-actions-menu--hud' : 'post-actions-menu--card'}
      isDeleting={isDeleting}
      onDelete={() => onDelete(entry)}
    />
  );
}

function FeedReportButton({ entry, isSubmitting, onReport, variant = 'default' }) {
  if (!entry?.submissionId || !onReport) {
    return null;
  }

  if (variant === 'hud') {
    return (
      <button
        type="button"
        className="feed-reel-card__hud-button"
        onClick={() => onReport(entry)}
        disabled={isSubmitting}
        aria-label="Rapporter post"
        title="Rapporter post"
      >
        {'\u2691'}
      </button>
    );
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

function FeedDeleteConfirmDialog({
  entry,
  isDeleting,
  onCancel,
  onConfirm,
}) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onCancel();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel]);

  if (!entry || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="feed-report-modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isDeleting) {
          onCancel();
        }
      }}
    >
      <div
        className="feed-report-modal feed-delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feed-delete-dialog-title"
      >
        <h3 id="feed-delete-dialog-title">Er du sikker du vil slette?</h3>
        <p className="feed-report-modal__subtitle">
          Dette kan ikke angres. Innlegget slettes permanent.
        </p>

        <div className="feed-report-modal__actions">
          <button
            type="button"
            className="action-button action-button--ghost"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Avbryt
          </button>
          <button
            type="button"
            className="action-button feed-delete-dialog__confirm"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Sletter...' : 'Slett'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
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
    : entry.studentPhotoThumbUrl || entry.studentPhotoUrl;

  if (photoUrl) {
    return (
      <div className="profile-photo profile-photo--small">
        <img
          src={photoUrl}
          alt={entry.isAnonymous ? 'Anonym profilbilde' : `${entry.studentName} profilbilde`}
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }

  return <div className="profile-avatar profile-avatar--small">{entry.studentIcon}</div>;
}

function CommentAvatar({ comment, size = 'small' }) {
  const cls = `profile-${comment.authorPhotoUrl ? 'photo' : 'avatar'} profile-${comment.authorPhotoUrl ? 'photo' : 'avatar'}--${size}`;
  if (comment.authorPhotoUrl) {
    return (
      <div className={cls}>
        <img
          src={comment.authorPhotoUrl}
          alt={`${comment.authorName} profilbilde`}
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }
  return <div className={cls}>{comment.authorIcon || comment.authorName?.charAt(0) || '?'}</div>;
}

function CommentAuthorLink({ comment, onOpenProfile, className = '' }) {
  const baseClassName = className || 'feed-comment__author-name';

  if (!onOpenProfile || !comment?.authorId) {
    return <strong className={baseClassName}>{comment?.authorName}</strong>;
  }

  return (
    <button
      type="button"
      className={`${baseClassName} feed-comment__author-link`}
      onClick={(event) => {
        event.stopPropagation();
        onOpenProfile(comment.authorId);
      }}
    >
      {comment.authorName}
    </button>
  );
}

function FeedCommentPreview({
  comments,
  onOpenComments,
  onOpenProfile,
  commentCount,
  isDisabled = false,
}) {
  const previewComments = comments.filter((c) => !c.deleted).slice(0, 2);

  return (
    <div className="feed-comment-preview feed-comment-preview--desktop">
      <div className="feed-comment-preview__header">
        <p>{getCommentsCountLabel(commentCount)}</p>
        <button
          type="button"
          className="feed-comment-button"
          onClick={onOpenComments}
          disabled={isDisabled}
        >
          Kommentarer
        </button>
      </div>
      {previewComments.length ? (
        <div className="feed-comment-preview__list">
          {previewComments.map((comment) => (
            <p key={comment.id} className="feed-comment-preview__item">
              <CommentAuthorLink
                comment={comment}
                onOpenProfile={onOpenProfile}
                className="feed-comment-preview__author"
              />{' '}
              {comment.text}
            </p>
          ))}
        </div>
      ) : (
        <p className="feed-comment-preview__empty">
          Ingen kommentarer ennå. Vær den første!
        </p>
      )}
    </div>
  );
}

function CommentItem({
  comment,
  replyingToId,
  replyDraft,
  isSubmittingReply,
  replyError,
  pendingLikeIds,
  pendingDeleteId,
  confirmReportId,
  reportReason,
  onReply,
  onReplyDraftChange,
  onSubmitReply,
  onLike,
  onDelete,
  onStartReport,
  onCancelReport,
  onConfirmReport,
  onReportReasonChange,
  onOpenProfile,
  isDisabled,
}) {
  const isReplying = replyingToId === comment.id;
  const isLiking = pendingLikeIds.has(comment.id);
  const isDeleting = pendingDeleteId === comment.id;
  const isConfirmingReport = confirmReportId === comment.id;
  const visibleReplies = comment.replies?.filter((reply) => !reply.deleted) ?? [];

  return (
    <article className={`feed-sheet__comment ${comment.deleted ? 'is-deleted' : ''}`}>
      <div className="feed-comment__header">
        <CommentAvatar comment={comment} size="small" />
        <div className="feed-comment__author-info">
          <CommentAuthorLink comment={comment} onOpenProfile={onOpenProfile} />
        </div>
        {!comment.deleted && !isDisabled && !comment.isOwn ? (
          <button
            type="button"
            className="feed-comment__report-btn"
            title="Rapporter kommentar"
            aria-label="Rapporter kommentar"
            onClick={() => onStartReport(comment.id)}
          >
            ⚑
          </button>
        ) : null}
        {!comment.deleted && comment.isOwn ? (
          <button
            type="button"
            className={`feed-comment__delete-btn ${isDeleting ? 'is-pending' : ''}`}
            title="Slett kommentar"
            aria-label="Slett kommentar"
            onClick={() => onDelete(comment.id)}
            disabled={isDeleting}
          >
            ✕
          </button>
        ) : null}
      </div>

      <p className={`feed-comment__text ${comment.deleted ? 'feed-comment__text--deleted' : ''}`}>
        {comment.text}
      </p>

      {!comment.deleted ? (
        <div className="feed-comment__actions">
          <span className="feed-comment__time">{comment.createdAtLabel}</span>
          <button
            type="button"
            className={`feed-comment__like-btn ${comment.myLiked ? 'is-liked' : ''} ${isLiking ? 'is-pending' : ''}`}
            onClick={() => onLike(comment.id)}
            disabled={isLiking || isDisabled}
          >
            <span aria-hidden="true">{'♥'}</span>
            {comment.likeCount > 0 ? <span>{comment.likeCount}</span> : null}
          </button>
          {!isDisabled ? (
            <button
              type="button"
              className="feed-comment__reply-btn"
              onClick={() => onReply(isReplying ? null : comment.id)}
            >
              {isReplying ? 'Avbryt' : 'Svar'}
            </button>
          ) : null}
        </div>
      ) : null}

      {isConfirmingReport ? (
        <div className="feed-comment__report-form">
          <select
            className="text-input text-input--sm"
            value={reportReason}
            onChange={(e) => onReportReasonChange(e.target.value)}
          >
            {COMMENT_REPORT_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <div className="feed-comment__report-actions">
            <button type="button" className="btn btn--sm btn--danger" onClick={() => onConfirmReport(comment.id)}>
              Send rapport
            </button>
            <button type="button" className="btn btn--sm btn--ghost" onClick={onCancelReport}>
              Avbryt
            </button>
          </div>
        </div>
      ) : null}

      {isReplying ? (
        <div className="feed-comment__reply-form">
          <textarea
            className="feed-sheet__composer-input"
            placeholder={`Svar til ${comment.authorName}…`}
            value={replyDraft}
            onChange={(e) => onReplyDraftChange(e.target.value)}
            rows={2}
            maxLength={500}
            autoFocus
          />
          <div className="feed-comment__reply-send-row">
            {replyError ? <span className="feed-sheet__error">{replyError}</span> : null}
            <button
              type="button"
              className="feed-sheet__send-btn"
              onClick={() => onSubmitReply(comment.id)}
              disabled={isSubmittingReply || !replyDraft.trim()}
            >
              {isSubmittingReply ? '…' : 'Send'}
            </button>
          </div>
        </div>
      ) : null}

      {visibleReplies.length > 0 ? (
        <div className="feed-comment__replies">
          {visibleReplies.map((reply) => (
            <article key={reply.id} className="feed-sheet__comment feed-sheet__comment--reply">
              <div className="feed-comment__header">
                <CommentAvatar comment={reply} size="xsmall" />
                <div className="feed-comment__author-info">
                  <CommentAuthorLink comment={reply} onOpenProfile={onOpenProfile} />
                </div>
                {!reply.deleted && !isDisabled && !reply.isOwn ? (
                  <button
                    type="button"
                    className="feed-comment__report-btn"
                    title="Rapporter"
                    aria-label="Rapporter svar"
                    onClick={() => onStartReport(reply.id)}
                  >
                    ⚑
                  </button>
                ) : null}
                {!reply.deleted && reply.isOwn ? (
                  <button
                    type="button"
                    className={`feed-comment__delete-btn ${pendingDeleteId === reply.id ? 'is-pending' : ''}`}
                    title="Slett"
                    aria-label="Slett svar"
                    onClick={() => onDelete(reply.id)}
                    disabled={pendingDeleteId === reply.id}
                  >
                    {'✕'}
                  </button>
                ) : null}
              </div>
              <p className={`feed-comment__text ${reply.deleted ? 'feed-comment__text--deleted' : ''}`}>
                {reply.text}
              </p>
              {!reply.deleted ? (
                <div className="feed-comment__actions">
                  <span className="feed-comment__time">{reply.createdAtLabel}</span>
                  <button
                    type="button"
                    className={`feed-comment__like-btn ${reply.myLiked ? 'is-liked' : ''} ${pendingLikeIds.has(reply.id) ? 'is-pending' : ''}`}
                    onClick={() => onLike(reply.id)}
                    disabled={pendingLikeIds.has(reply.id) || isDisabled}
                  >
                    <span aria-hidden="true">{'♥'}</span>
                    {reply.likeCount > 0 ? <span>{reply.likeCount}</span> : null}
                  </button>
                </div>
              ) : null}
              {confirmReportId === reply.id ? (
                <div className="feed-comment__report-form">
                  <select
                    className="text-input text-input--sm"
                    value={reportReason}
                    onChange={(e) => onReportReasonChange(e.target.value)}
                  >
                    {COMMENT_REPORT_REASONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <div className="feed-comment__report-actions">
                    <button type="button" className="btn btn--sm btn--danger" onClick={() => onConfirmReport(reply.id)}>
                      Send rapport
                    </button>
                    <button type="button" className="btn btn--sm btn--ghost" onClick={onCancelReport}>
                      Avbryt
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function FeedCommentSheet({
  entry,
  comments,
  onClose,
  onSubmitComment,
  onDeleteComment,
  onLikeComment,
  onReportComment,
  onOpenProfile,
  isDisabled = false,
  disabledReason = '',
}) {
  const commentListRef = useRef(null);
  const swipeTimeoutRef = useRef(null);
  const textareaRef = useRef(null);

  const [draftText, setDraftText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [pendingLikeIds, setPendingLikeIds] = useState(new Set());
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [confirmReportId, setConfirmReportId] = useState(null);
  const [reportReason, setReportReason] = useState(COMMENT_REPORT_REASONS[0]);
  const [swipeGesture, setSwipeGesture] = useState({
    zone: null,
    pointerId: null,
    startY: 0,
    offset: 0,
    settling: null,
  });
  const isSwipeSettling = swipeGesture.settling !== null;
  const isSheetDragging = swipeGesture.zone === 'sheet';
  const sheetDragOffset =
    isSheetDragging || swipeGesture.settling === 'close-sheet'
      ? Math.max(0, swipeGesture.offset)
      : 0;
  const sheetStyle = {
    transform: sheetDragOffset ? `translateY(${sheetDragOffset}px)` : undefined,
  };

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(
    () => () => {
      if (swipeTimeoutRef.current) {
        clearTimeout(swipeTimeoutRef.current);
        swipeTimeoutRef.current = null;
      }
      // Blur any focused input so iOS resets the zoomed viewport after sheet closes
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    },
    [],
  );

  function resetSwipeGesture() {
    setSwipeGesture({ zone: null, pointerId: null, startY: 0, offset: 0, settling: null });
  }

  function startSwipe(zone, event) {
    if (isSwipeSettling) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setSwipeGesture({ zone, pointerId: event.pointerId, startY: event.clientY, offset: 0, settling: null });
  }

  function updateSwipe(event) {
    if (swipeGesture.pointerId !== event.pointerId) return;
    const deltaY = event.clientY - swipeGesture.startY;
    if (deltaY <= 0) {
      if (swipeGesture.offset !== 0) setSwipeGesture((c) => ({ ...c, offset: 0 }));
      return;
    }
    event.preventDefault();
    setSwipeGesture((c) => ({
      ...c,
      offset: Math.min(deltaY, COMMENT_SWIPE_CLOSE_OFFSET_PX),
    }));
  }

  function endSwipe(event) {
    if (swipeGesture.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (swipeGesture.zone === 'sheet' && swipeGesture.offset >= COMMENT_SWIPE_THRESHOLD_PX) {
      const fromOffset = swipeGesture.offset;
      setSwipeGesture({
        zone: 'sheet', pointerId: null, startY: 0,
        offset: Math.max(fromOffset, COMMENT_SWIPE_CLOSE_OFFSET_PX),
        settling: 'close-sheet',
      });
      swipeTimeoutRef.current = window.setTimeout(() => {
        swipeTimeoutRef.current = null;
        onClose();
      }, 155);
      return;
    }
    resetSwipeGesture();
  }

  async function handleSubmit() {
    const text = draftText.trim();
    if (!text || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await onSubmitComment(text, null);
      setDraftText('');
      if (commentListRef.current) commentListRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setSubmitError(err?.message ?? 'Kunne ikke sende kommentar.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitReply(parentId) {
    const text = replyDraft.trim();
    if (!text || isSubmittingReply) return;
    setIsSubmittingReply(true);
    setReplyError('');
    try {
      await onSubmitComment(text, parentId);
      setReplyDraft('');
      setReplyingToId(null);
    } catch (err) {
      setReplyError(err?.message ?? 'Kunne ikke sende svar.');
    } finally {
      setIsSubmittingReply(false);
    }
  }

  async function handleLike(commentId) {
    if (pendingLikeIds.has(commentId)) return;
    setPendingLikeIds((prev) => new Set([...prev, commentId]));
    try {
      await onLikeComment(commentId);
    } finally {
      setPendingLikeIds((prev) => { const next = new Set(prev); next.delete(commentId); return next; });
    }
  }

  async function handleDelete(commentId) {
    if (pendingDeleteId) return;
    setPendingDeleteId(commentId);
    try {
      await onDeleteComment(commentId);
    } finally {
      setPendingDeleteId(null);
    }
  }

  async function handleConfirmReport(commentId) {
    try {
      await onReportComment(commentId, reportReason);
      setConfirmReportId(null);
    } catch {
      setConfirmReportId(null);
    }
  }

  const visibleComments = comments.filter((comment) => !comment.deleted);
  const totalCount =
    visibleComments.length +
    visibleComments.reduce(
      (sum, c) => sum + (c.replies?.filter((reply) => !reply.deleted).length ?? 0),
      0,
    );

  return createPortal(
    <div
      className="feed-sheet-backdrop"
      role="presentation"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        className={`feed-sheet ${isSwipeSettling ? 'is-swipe-settling' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feed-comment-sheet-title"
        style={sheetStyle}
      >
        <div
          className={`feed-sheet__dismiss-zone ${isSheetDragging ? 'is-dragging' : ''}`}
          onPointerDown={(event) => startSwipe('sheet', event)}
          onPointerMove={updateSwipe}
          onPointerUp={endSwipe}
          onPointerCancel={resetSwipeGesture}
        >
          <div className="feed-sheet__handle" />
          <div className="feed-sheet__header">
            <div>
              <p className="eyebrow">Kommentarer</p>
              <h3 id="feed-comment-sheet-title">{entry.knotTitle}</h3>
              <p className="feed-sheet__subtitle">{getCommentsCountLabel(totalCount)}</p>
            </div>
            <button type="button" className="feed-sheet__close" onClick={onClose}>
              {'\u00D7'}
            </button>
          </div>
        </div>

        <div ref={commentListRef} className="feed-sheet__comment-list">
          {visibleComments.length ? (
            visibleComments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                replyingToId={replyingToId}
                replyDraft={replyDraft}
                isSubmittingReply={isSubmittingReply}
                replyError={replyError}
                pendingLikeIds={pendingLikeIds}
                pendingDeleteId={pendingDeleteId}
                confirmReportId={confirmReportId}
                reportReason={reportReason}
                onReply={setReplyingToId}
                onReplyDraftChange={setReplyDraft}
                onSubmitReply={handleSubmitReply}
                onLike={handleLike}
                onDelete={handleDelete}
                onStartReport={(id) => { setConfirmReportId(id); setReportReason(COMMENT_REPORT_REASONS[0]); }}
                onCancelReport={() => setConfirmReportId(null)}
                onConfirmReport={handleConfirmReport}
                onReportReasonChange={setReportReason}
                onOpenProfile={onOpenProfile}
                isDisabled={isDisabled}
              />
            ))
          ) : (
            <div className="feed-sheet__empty">
              <strong>Ingen kommentarer ennå</strong>
              <p>{'Vær den første til å kommentere!'}</p>
            </div>
          )}
        </div>

        <div className="feed-sheet__composer-shell">
          {disabledReason ? <p className="feed-sheet__disabled-note">{disabledReason}</p> : null}
          {!isDisabled ? (
            <div className="feed-sheet__composer-form">
              <textarea
                ref={textareaRef}
                className="feed-sheet__composer-input"
                placeholder="Skriv en kommentar..."
                value={draftText}
                onChange={(e) => {
                  if (e.target.value.length <= 100) {
                    setDraftText(e.target.value);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
                }}
                rows={2}
                maxLength={100}
                disabled={isSubmitting}
                aria-label="Skriv en kommentar"
              />
              <button
                type="button"
                className="feed-sheet__send-btn"
                onClick={handleSubmit}
                disabled={isSubmitting || !draftText.trim()}
              >
                {isSubmitting ? '...' : 'Send'}
              </button>
              <span className="feed-sheet__composer-counter">
                {draftText.length}/100
              </span>
            </div>
          ) : null}
          {submitError ? <p className="feed-sheet__error">{submitError}</p> : null}
        </div>
      </section>
    </div>,
    document.body,
  );
}

const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_THRESHOLD_PX = 10;

function useLongPressReaction(onLongPress) {
  const stateRef = useRef({ pointerId: null, timer: null, x: 0, y: 0, fired: false });

  const cleanup = useCallback(() => {
    if (stateRef.current.timer) {
      window.clearTimeout(stateRef.current.timer);
      stateRef.current.timer = null;
    }
    stateRef.current.pointerId = null;
    stateRef.current.fired = false;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const onPointerDown = useCallback((event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    // Skip when starting on interactive control to avoid hijacking buttons
    const target = event.target;
    if (
      target?.closest?.(
        'button, a, input, textarea, select, [data-no-long-press="true"]',
      )
    ) {
      return;
    }
    cleanup();
    stateRef.current.pointerId = event.pointerId;
    stateRef.current.x = event.clientX;
    stateRef.current.y = event.clientY;
    stateRef.current.fired = false;
    const startX = event.clientX;
    const startY = event.clientY;
    const captureTarget = event.currentTarget;
    stateRef.current.timer = window.setTimeout(() => {
      if (stateRef.current.pointerId === event.pointerId) {
        stateRef.current.fired = true;
        try {
          captureTarget?.setPointerCapture?.(event.pointerId);
        } catch {
          // ignore
        }
        onLongPress(startX, startY);
      }
    }, LONG_PRESS_MS);
  }, [cleanup, onLongPress]);

  const onPointerMove = useCallback((event) => {
    if (stateRef.current.pointerId !== event.pointerId) return;
    if (stateRef.current.fired) return;
    const dx = event.clientX - stateRef.current.x;
    const dy = event.clientY - stateRef.current.y;
    if (Math.abs(dx) > LONG_PRESS_MOVE_THRESHOLD_PX || Math.abs(dy) > LONG_PRESS_MOVE_THRESHOLD_PX) {
      cleanup();
    }
  }, [cleanup]);

  const onPointerUp = useCallback(() => cleanup(), [cleanup]);
  const onPointerCancel = useCallback(() => cleanup(), [cleanup]);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}

function FeedCardMobile({
  canManage,
  entry,
  index,
  isActive,
  isDeleting,
  isRemoving,
  isReporting,
  total,
  isSubmitting,
  onDelete,
  onExit,
  onOpenComments,
  onOpenProfile,
  onReport,
  onRate,
  ratingError,
  commentCount = 0,
  feedInteractionsDisabled,
  feedInteractionMessage,
  registerCardRef,
  onLongPressReaction,
  onShareCopied,
  audioOn = false,
  onToggleAudio,
  // Vindusrendering: kort langt unna viewporten rendrer kun det tomme
  // <article>-skallet. Skallet må alltid rendres (med ref og data-feed-index)
  // fordi scroll-snap-geometrien, IntersectionObserver-en og
  // getNearestCardIndex avhenger av at alle kort finnes i DOM med fast høyde.
  isHydrated = true,
  allowVideoLoad = true,
}) {
  const longPress = useLongPressReaction((x, y) => {
    onLongPressReaction?.(x, y);
  });
  const isLightScene = entry.mediaType === 'none';
  const noteText =
    entry.note && entry.note.trim() && entry.note.trim() !== entry.knotTitle
      ? entry.note
      : '';
  const showBottomCopy = !isLightScene;

  if (!isHydrated) {
    return (
      <article
        ref={(node) => registerCardRef(entry.submissionId, node)}
        className={`feed-reel-card ${
          isLightScene ? 'feed-reel-card--light-scene' : 'feed-reel-card--media-scene'
        }`}
        data-feed-index={index}
        aria-hidden="true"
      />
    );
  }

  return (
    <article
      ref={(node) => registerCardRef(entry.submissionId, node)}
      className={`feed-reel-card ${isActive ? 'is-active' : ''} ${
        isLightScene ? 'feed-reel-card--light-scene' : 'feed-reel-card--media-scene'
      } ${isRemoving ? 'is-removing' : ''}`}
      data-feed-index={index}
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerCancel={longPress.onPointerCancel}
    >
      <FeedMedia
        entry={entry}
        variant="mobile"
        isActive={isActive}
        allowVideoLoad={allowVideoLoad}
        audioOn={audioOn}
        onToggleAudio={onToggleAudio}
      />

      <div className="feed-reel-card__overlay">
        <div className="feed-reel-card__hud feed-reel-card__hud--top">
          <div className="feed-reel-card__hud-side">
            <button
              type="button"
              className="feed-reel-card__hud-button"
              onClick={() => onExit?.()}
              aria-label="Ga ut av feed"
            >
              {'\u2190'}
            </button>
          </div>
          <div className="feed-reel-card__hud-center">
            <span className="feed-reel-card__hud-pill">Feed</span>
          </div>
          <div className="feed-reel-card__hud-side feed-reel-card__hud-side--end">
            <FeedPostActions
              canManage={canManage}
              entry={entry}
              isDeleting={isDeleting}
              onDelete={onDelete}
              variant="hud"
            />
            <FeedReportButton
              entry={entry}
              isSubmitting={isReporting || feedInteractionsDisabled}
              onReport={onReport}
              variant="hud"
            />
          </div>
        </div>

        <div className="feed-reel-card__bottom-hud">
          <div className="feed-reel-card__info-stack">
            <div className="feed-reel-card__identity-row">
              <button
                type="button"
                className="feed-reel-card__identity"
                onClick={() => onOpenProfile?.(entry.studentId)}
                disabled={!entry.studentId || entry.isAnonymous}
              >
                <FeedProfileAvatar entry={entry} />
                <div className="feed-reel-card__identity-copy">
                  <strong>{entry.studentName}</strong>
                  <p>{entry.studentGroup}</p>
                </div>
              </button>

              <div className="feed-reel-card__rating-column">
                <FeedRatingRow
                  entry={entry}
                  isSubmitting={isSubmitting}
                  onRate={onRate}
                  errorMessage={ratingError}
                  isDisabled={feedInteractionsDisabled}
                  disabledReason={feedInteractionMessage}
                  variant="inline"
                />
                <button
                  type="button"
                  className="feed-reel-card__comment-inline-button"
                  onClick={() => onOpenComments(entry)}
                  disabled={feedInteractionsDisabled}
                  aria-label={`Apne kommentarer (${commentCount})`}
                  title="Apne kommentarer"
                >
                  <span aria-hidden="true">{'\u{1F4AC}'}</span>
                  {commentCount > 0 ? (
                    <span className="feed-reel-card__comment-count">{commentCount}</span>
                  ) : null}
                </button>
              </div>
            </div>

            <div className="feed-reel-card__meta-pills">
              <span className="feed-reel-card__meta-pill feed-reel-card__meta-pill--points">
                {entry.points}p
              </span>
              <span className="feed-reel-card__meta-pill">{entry.completedAt}</span>
              {entry.isAnonymous ? (
                <span className="feed-reel-card__meta-pill">Anonym</span>
              ) : null}
            </div>

            {showBottomCopy ? (
              <div className="feed-reel-card__title-group">
                <h3>{entry.knotTitle}</h3>
                {noteText ? <p className="feed-reel-card__note">{noteText}</p> : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="feed-reel-card__index-indicator">
          {index + 1}/{total}
        </div>
      </div>
    </article>
  );
}

function getNearestCardIndex(container, entries, cardRefMap) {
  if (!container || !entries.length) {
    return 0;
  }

  const containerTop = container.scrollTop;
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  entries.forEach((entry, index) => {
    const element = cardRefMap.current.get(String(entry.submissionId));

    if (!element) {
      return;
    }

    const distance = Math.abs(element.offsetTop - containerTop);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function FeedCardDesktop({
  canManage,
  entry,
  index,
  isDeleting,
  isRemoving,
  isReporting,
  total,
  isSubmitting,
  onDelete,
  onOpenComments,
  onOpenProfile,
  onReport,
  onRate,
  ratingError,
  comments,
  feedInteractionsDisabled,
  feedInteractionMessage,
  onLongPressReaction,
  onShareCopied,
}) {
  const isTextOnly = entry.mediaType === 'none';
  const longPress = useLongPressReaction((x, y) => {
    onLongPressReaction?.(x, y);
  });

  return (
    <article
      className={`feed-card-desktop ${isRemoving ? 'is-removing' : ''}`}
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerCancel={longPress.onPointerCancel}
    >
      <FeedPostActions
        canManage={canManage}
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
            <p className="feed-card-v3__profile-class">{entry.studentGroup}</p>
          </div>
        </button>
        <div className="feed-card-desktop__header-actions">
          <span className="feed-card-v3__index">
            {index + 1}/{total}
          </span>
          <FeedReportButton entry={entry} isSubmitting={isReporting} onReport={onReport} />
        </div>
      </header>

      <div className="feed-card-desktop__body">
        <FeedMedia entry={entry} variant="desktop" isActive />

        <div className="feed-card-desktop__content">
          {!isTextOnly ? <h3>{entry.knotTitle}</h3> : null}
          <p className="feed-card-v3__meta">
            {entry.points} poeng · {entry.completedAt}
          </p>
          {!isTextOnly ? (
            <p className="feed-card-v3__note">
              {entry.note ? entry.note : 'Ren tekstpost uten ekstra notat.'}
            </p>
          ) : null}

          <FeedCommentPreview
            comments={comments}
            commentCount={comments.length}
            onOpenComments={() => onOpenComments(entry)}
            onOpenProfile={onOpenProfile}
            isDisabled={feedInteractionsDisabled}
          />

          <FeedRatingRow
            entry={entry}
            isSubmitting={isSubmitting}
            onRate={onRate}
            errorMessage={ratingError}
            isDisabled={feedInteractionsDisabled}
            disabledReason={feedInteractionMessage}
          />
        </div>
      </div>
    </article>
  );
}

export function FeedPage({
  activityLog,
  commentsBySubmission = {},
  currentUserId = null,
  currentUserRole = 'user',
  currentUserActiveBans = [],
  onCreateComment,
  onDeleteComment,
  onLikeComment,
  onReportComment,
  onDeleteSubmission,
  onExit,
  onOpenKnots,
  onOpenProfile,
  onReportSubmission,
  onRateSubmission,
  onRefresh,
}) {
  const [pendingBySubmission, setPendingBySubmission] = useState({});
  const [deletingBySubmission, setDeletingBySubmission] = useState({});
  const [deleteDialogEntry, setDeleteDialogEntry] = useState(null);
  const [removingBySubmission, setRemovingBySubmission] = useState({});
  const [reportingBySubmission, setReportingBySubmission] = useState({});
  const [ratingDraftBySubmission, setRatingDraftBySubmission] = useState({});
  const [ratingErrorBySubmission, setRatingErrorBySubmission] = useState({});
  const [reportModalEntry, setReportModalEntry] = useState(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportNote, setReportNote] = useState('');
  const [reportError, setReportError] = useState('');
  const [reportFeedback, setReportFeedback] = useState('');
  const [deleteFeedback, setDeleteFeedback] = useState('');
  const [deleteToast, setDeleteToast] = useState('');
  const [shareToast, setShareToast] = useState('');
  const shareToastTimeoutRef = useRef(null);
  const handleShareCopied = useCallback((errorMessage) => {
    setShareToast(errorMessage || 'Lenke kopiert!');
    if (shareToastTimeoutRef.current) {
      clearTimeout(shareToastTimeoutRef.current);
    }
    shareToastTimeoutRef.current = window.setTimeout(() => setShareToast(''), 2200);
  }, []);
  useEffect(
    () => () => {
      if (shareToastTimeoutRef.current) {
        clearTimeout(shareToastTimeoutRef.current);
        shareToastTimeoutRef.current = null;
      }
    },
    [],
  );
  const [activeMobileIndex, setActiveMobileIndex] = useState(0);
  const [desktopVisibleCount, setDesktopVisibleCount] = useState(DESKTOP_FEED_BATCH_SIZE);
  const desktopSentinelRef = useRef(null);
  const [feedAudioOn, setFeedAudioOn] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('feed_audio_on') === 'true';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('feed_audio_on', feedAudioOn ? 'true' : 'false');
    } catch {
      // Ignore — preferansen er ikke kritisk
    }
  }, [feedAudioOn]);
  const [commentSheetEntry, setCommentSheetEntry] = useState(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reactionPicker, setReactionPicker] = useState(null);
  const [flyingReactions, setFlyingReactions] = useState([]);

  const handleOpenReactionPicker = useCallback((x, y) => {
    setReactionPicker({ x, y });
  }, []);
  const handleCloseReactionPicker = useCallback(() => setReactionPicker(null), []);
  const handleSelectReaction = useCallback((emoji) => {
    setReactionPicker((current) => {
      if (!current) return null;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const x = current.x;
      const y = current.y;
      setFlyingReactions((prev) => [...prev, { id, emoji, x, y }]);
      window.setTimeout(() => {
        setFlyingReactions((prev) => prev.filter((item) => item.id !== id));
      }, REACTION_FLY_DURATION_MS + 50);
      return null;
    });
  }, []);
  const isDesktop = useDesktopFeed();
  const mobileReelRef = useRef(null);
  const cardRefMap = useRef(new Map());
  const deleteToastTimeoutRef = useRef(null);
  const pullStateRef = useRef({
    active: false,
    startY: 0,
    startX: 0,
    direction: 'unknown',
  });

  const activeFeedBan =
    currentUserActiveBans.find((ban) => ban.type === 'feed') ?? null;
  const feedInteractionMessage = activeFeedBan
    ? `Feed-tilgangen din er midlertidig begrenset${
        activeFeedBan.remainingLabel ? ` (${activeFeedBan.remainingLabel})` : ''
      }.`
    : '';
  const currentUserIdKey =
    currentUserId === null || currentUserId === undefined
      ? ''
      : String(currentUserId);
  const feedEntries = useMemo(
    () =>
      activityLog.filter(
        (entry) =>
          Boolean(entry.submissionId) &&
          entry.shareDetails !== false,
      ),
    [activityLog],
  );

  useEffect(() => {
    if (!isDesktop) {
      return undefined;
    }

    const sentinel = desktopSentinelRef.current;

    if (!sentinel || desktopVisibleCount >= feedEntries.length) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (observed) => {
        if (observed.some((item) => item.isIntersecting)) {
          setDesktopVisibleCount((count) =>
            Math.min(count + DESKTOP_FEED_BATCH_SIZE, feedEntries.length),
          );
        }
      },
      { rootMargin: '600px 0px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isDesktop, desktopVisibleCount, feedEntries.length]);

  function canManageEntry(entry) {
    if (!entry?.submissionId) {
      return false;
    }

    // Admin kan fjerne hvilket som helst innlegg fra feed-en.
    if (currentUserRole === 'admin') {
      return true;
    }

    if (!currentUserIdKey || entry?.studentId === null || entry?.studentId === undefined) {
      return false;
    }

    return String(entry.studentId) === currentUserIdKey;
  }

  useEffect(
    () => () => {
      if (deleteToastTimeoutRef.current) {
        clearTimeout(deleteToastTimeoutRef.current);
        deleteToastTimeoutRef.current = null;
      }
    },
    [],
  );

  // Pull-to-refresh på mobilfeeden. Drag ned 80px for å trigge refresh.
  // For å ikke kollidere med horisontal swipe-tab navigasjon (i SwipeTabsShell)
  // og normal vertikal scroll, krever vi at scrollTop er 0 OG at draget tydelig
  // er vertikalt. Reagerer på touch-events for å være billig og presist.
  const PULL_THRESHOLD_PX = 80;
  const triggerRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (typeof onRefresh === 'function') {
        await onRefresh();
      } else {
        // Fallback: bare en kort "respons" så det føles som det skjer noe.
        await new Promise((resolve) => window.setTimeout(resolve, 600));
      }
    } catch {
      // Stille feil — vi vil uansett dempe ned indikatoren.
    } finally {
      window.setTimeout(() => {
        setIsRefreshing(false);
        setPullDistance(0);
      }, 250);
    }
  }, [isRefreshing, onRefresh]);

  useEffect(() => {
    if (isDesktop) {
      return undefined;
    }

    const container = mobileReelRef.current;
    if (!container) return undefined;

    function handleTouchStart(event) {
      if (event.touches.length !== 1) return;
      if (commentSheetEntry) return;
      // Bare aktiver pull når vi er helt øverst i feeden.
      if (container.scrollTop > 0) return;

      pullStateRef.current = {
        active: true,
        startY: event.touches[0].clientY,
        startX: event.touches[0].clientX,
        direction: 'unknown',
      };
    }

    function handleTouchMove(event) {
      const state = pullStateRef.current;
      if (!state.active) return;
      if (event.touches.length !== 1) return;

      const touch = event.touches[0];
      const dy = touch.clientY - state.startY;
      const dx = touch.clientX - state.startX;

      // Bestem retning ved første merkbare bevegelse.
      if (state.direction === 'unknown') {
        if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return;
        if (Math.abs(dx) > Math.abs(dy)) {
          // Horisontal — la SwipeTabsShell håndtere det.
          state.direction = 'horizontal';
          state.active = false;
          return;
        }
        state.direction = 'vertical';
      }

      if (state.direction !== 'vertical') return;
      if (dy <= 0) {
        // Bruker drar oppover — bare en vanlig scroll.
        if (pullDistance !== 0) setPullDistance(0);
        return;
      }

      // Litt rubber-band: dragger blir tyngre over terskelen.
      const eased = dy < PULL_THRESHOLD_PX
        ? dy
        : PULL_THRESHOLD_PX + (dy - PULL_THRESHOLD_PX) * 0.4;
      setPullDistance(eased);
    }

    function handleTouchEnd() {
      const state = pullStateRef.current;
      const direction = state.direction;
      pullStateRef.current = {
        active: false,
        startY: 0,
        startX: 0,
        direction: 'unknown',
      };
      if (direction !== 'vertical') return;

      if (pullDistance >= PULL_THRESHOLD_PX) {
        triggerRefresh();
      } else if (pullDistance !== 0) {
        setPullDistance(0);
      }
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isDesktop, commentSheetEntry, pullDistance, triggerRefresh]);

  useEffect(() => {
    if (isDesktop) {
      return undefined;
    }

    const container = mobileReelRef.current;

    if (!container || !feedEntries.length) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisibleEntry = entries
          .filter((item) => item.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

        if (!mostVisibleEntry) {
          return;
        }

        const nextIndex = Number(mostVisibleEntry.target.dataset.feedIndex);

        if (Number.isInteger(nextIndex)) {
          setActiveMobileIndex(nextIndex);
        }
      },
      {
        root: container,
        threshold: [0.45, 0.6, 0.75],
      },
    );

    feedEntries.forEach((entry) => {
      const element = cardRefMap.current.get(String(entry.submissionId));
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [feedEntries, isDesktop]);

  useEffect(() => {
    if (isDesktop) {
      return undefined;
    }

    const container = mobileReelRef.current;

    if (!container || !feedEntries.length) {
      return undefined;
    }

    let snapTimerId = null;

    const handleScroll = () => {
      if (snapTimerId) {
        window.clearTimeout(snapTimerId);
      }

      snapTimerId = window.setTimeout(() => {
        const nearestIndex = getNearestCardIndex(container, feedEntries, cardRefMap);
        const nearestEntry = feedEntries[nearestIndex];
        const nearestElement = nearestEntry
          ? cardRefMap.current.get(String(nearestEntry.submissionId))
          : null;

        setActiveMobileIndex(nearestIndex);

        if (nearestElement && Math.abs(nearestElement.offsetTop - container.scrollTop) > 8) {
          container.scrollTo({
            top: nearestElement.offsetTop,
            behavior: 'smooth',
          });
        }
      }, 110);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);

      if (snapTimerId) {
        window.clearTimeout(snapTimerId);
      }
    };
  }, [feedEntries, isDesktop]);

  useEffect(() => {
    const maxIndex = Math.max(feedEntries.length - 1, 0);
    if (activeMobileIndex > maxIndex) {
      setActiveMobileIndex(maxIndex);
    }
  }, [activeMobileIndex, feedEntries.length]);

  function registerCardRef(submissionId, node) {
    const key = String(submissionId);

    if (node) {
      cardRefMap.current.set(key, node);
      return;
    }

    cardRefMap.current.delete(key);
  }

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
    if (!entry.submissionId || !onRateSubmission || activeFeedBan) {
      return;
    }

    if (pendingBySubmission[entry.submissionId]) {
      return;
    }

    playTick();

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
            : 'Kunne ikke lagre rating na. Prov igjen.',
      }));
    } finally {
      setPendingBySubmission((current) => {
        const next = { ...current };
        delete next[entry.submissionId];
        return next;
      });
    }
  }

  function handleDelete(entry) {
    if (!entry.submissionId || !onDeleteSubmission) {
      return;
    }

    if (!canManageEntry(entry) || deletingBySubmission[entry.submissionId]) {
      return;
    }

    setDeleteFeedback('');
    setDeleteDialogEntry(entry);
  }

  function closeDeleteDialog() {
    if (deleteDialogEntry?.submissionId && deletingBySubmission[deleteDialogEntry.submissionId]) {
      return;
    }

    setDeleteDialogEntry(null);
  }

  async function confirmDelete() {
    if (!deleteDialogEntry?.submissionId || !onDeleteSubmission) {
      return;
    }

    const entry = deleteDialogEntry;

    if (!canManageEntry(entry) || deletingBySubmission[entry.submissionId]) {
      return;
    }

    setDeleteFeedback('');
    setDeletingBySubmission((current) => ({
      ...current,
      [entry.submissionId]: true,
    }));

    try {
      await onDeleteSubmission(entry.submissionId, {
        beforeApply: () => {
          setDeleteDialogEntry(null);
          setRemovingBySubmission((current) => ({
            ...current,
            [entry.submissionId]: true,
          }));
          setDeleteToast('Innlegget ble slettet');

          if (deleteToastTimeoutRef.current) {
            clearTimeout(deleteToastTimeoutRef.current);
          }

          deleteToastTimeoutRef.current = setTimeout(() => {
            setDeleteToast('');
            deleteToastTimeoutRef.current = null;
          }, DELETE_TOAST_MS);
        },
        delayAppDataMs: DELETE_FADE_OUT_MS,
      });
    } catch {
      setDeleteFeedback('Noe gikk galt. Prøv igjen.');
      setRemovingBySubmission((current) => {
        const next = { ...current };
        delete next[entry.submissionId];
        return next;
      });
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
      setReportFeedback('Rapport sendt. Admin folger opp posten manuelt.');
      setReportModalEntry(null);
    } catch (error) {
      setReportError(
        error instanceof Error && error.message
          ? error.message
          : 'Kunne ikke sende rapport akkurat na.',
      );
    } finally {
      setReportingBySubmission((current) => {
        const next = { ...current };
        delete next[submissionId];
        return next;
      });
    }
  }

  function openCommentSheet(entry) {
    setCommentSheetEntry(entry);
  }

  function closeCommentSheet() {
    setCommentSheetEntry(null);
    window.setTimeout(() => {
      const container = mobileReelRef.current;
      if (!container) return;
      const activeEntry = feedEntries[activeMobileIndex];
      if (!activeEntry) return;
      const el = cardRefMap.current.get(String(activeEntry.submissionId));
      if (el) container.scrollTo({ top: el.offsetTop, behavior: 'instant' });
    }, 0);
  }

  if (!feedEntries.length) {
    return (
      <section className="section-card feed-empty">
        <div className="feed-empty__inner empty-state">
          <div className="empty-state__icon" aria-hidden="true">🎉</div>
          <h3 className="empty-state__title">Ingen poster enda</h3>
          <p className="empty-state__hint">
            Bli den første som drar i gang! Send inn en knute og legg den ut i feeden.
          </p>
          {typeof onOpenKnots === 'function' ? (
            <button type="button" className="action-button" onClick={onOpenKnots}>
              Send inn en knute
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  const activeComments = commentSheetEntry?.submissionId
    ? (commentsBySubmission[String(commentSheetEntry.submissionId)] ?? [])
    : [];

  return (
    <div className="feed-page feed-page--friendly feed-page--immersive">
      {isDesktop ? (
        <div className="feed-page__header">
          <div className="feed-page__header-copy">
            <p className="eyebrow">Feed</p>
            <h2>Delte oyeblikk fra knutene</h2>
            <p>Mobilfeeden er gjort om til en scenevisning, mens desktop holder seg roligere.</p>
          </div>
          <button type="button" className="feed-exit-button" onClick={() => onExit?.()}>
            {'\u2190'} Ut
          </button>
        </div>
      ) : null}

      {isDesktop && activeFeedBan ? (
        <div className="feed-page__ban-banner">
          <strong>Feeden er delvis last for deg akkurat na.</strong>
          <p>{feedInteractionMessage}</p>
        </div>
      ) : null}

      {reportFeedback ? <p className="form-feedback">{reportFeedback}</p> : null}
      {deleteFeedback ? <p className="form-feedback">{deleteFeedback}</p> : null}
      {deleteToast && typeof document !== 'undefined'
        ? createPortal(
            <div className="feed-delete-toast" role="status" aria-live="polite">
              <p>{deleteToast}</p>
            </div>,
            document.body,
          )
        : null}

      {shareToast && typeof document !== 'undefined'
        ? createPortal(
            <div className="feed-share-toast" role="status" aria-live="polite">
              <p>{shareToast}</p>
            </div>,
            document.body,
          )
        : null}

      {isDesktop ? (
        <div className="feed-list-v3">
          {feedEntries.slice(0, desktopVisibleCount).map((entry, index) => (
            <FeedCardDesktop
              key={entry.id}
              canManage={canManageEntry(entry)}
              entry={{
                ...entry,
                myRating: ratingDraftBySubmission[entry.submissionId] ?? entry.myRating,
              }}
              index={index}
              isDeleting={Boolean(deletingBySubmission[entry.submissionId])}
              isRemoving={Boolean(removingBySubmission[entry.submissionId])}
              isReporting={Boolean(reportingBySubmission[entry.submissionId])}
              total={feedEntries.length}
              isSubmitting={Boolean(pendingBySubmission[entry.submissionId])}
              ratingError={ratingErrorBySubmission[entry.submissionId] ?? ''}
              onDelete={handleDelete}
              onOpenComments={openCommentSheet}
              onOpenProfile={onOpenProfile}
              onReport={openReportModal}
              onRate={handleRate}
              comments={commentsBySubmission[String(entry.submissionId)] ?? []}
              feedInteractionsDisabled={Boolean(activeFeedBan)}
              feedInteractionMessage={feedInteractionMessage}
              onLongPressReaction={handleOpenReactionPicker}
              onShareCopied={handleShareCopied}
            />
          ))}
          {desktopVisibleCount < feedEntries.length ? (
            <div
              ref={desktopSentinelRef}
              className="feed-list-v3__sentinel"
              aria-hidden="true"
            />
          ) : null}
        </div>
      ) : (
        <div
          ref={mobileReelRef}
          className={`feed-reel-mobile${commentSheetEntry ? ' feed-reel-mobile--locked' : ''}`}
        >
          {(pullDistance > 0 || isRefreshing) ? (
            <div
              className={`feed-pull-refresh${
                isRefreshing
                  ? ' is-refreshing'
                  : pullDistance >= PULL_THRESHOLD_PX
                    ? ' is-ready'
                    : ''
              }`}
              style={{
                height: isRefreshing
                  ? `${PULL_THRESHOLD_PX}px`
                  : `${Math.min(pullDistance, PULL_THRESHOLD_PX + 20)}px`,
                opacity: Math.min(pullDistance / 40, 1),
              }}
              aria-hidden="true"
            >
              <div className="feed-pull-refresh__indicator">
                <svg
                  className="feed-pull-refresh__icon"
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transform: `rotate(${
                      isRefreshing ? 0 : Math.min((pullDistance / PULL_THRESHOLD_PX) * 360, 360)
                    }deg)`,
                  }}
                >
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              </div>
            </div>
          ) : null}
          {feedEntries.map((entry, index) => (
            <FeedCardMobile
              key={entry.id}
              canManage={canManageEntry(entry)}
              entry={{
                ...entry,
                myRating: ratingDraftBySubmission[entry.submissionId] ?? entry.myRating,
              }}
              index={index}
              isActive={activeMobileIndex === index}
              isHydrated={Math.abs(index - activeMobileIndex) <= MOBILE_HYDRATION_RADIUS}
              allowVideoLoad={Math.abs(index - activeMobileIndex) <= MOBILE_VIDEO_RADIUS}
              isDeleting={Boolean(deletingBySubmission[entry.submissionId])}
              isRemoving={Boolean(removingBySubmission[entry.submissionId])}
              isReporting={Boolean(reportingBySubmission[entry.submissionId])}
              total={feedEntries.length}
              isSubmitting={Boolean(pendingBySubmission[entry.submissionId])}
              ratingError={ratingErrorBySubmission[entry.submissionId] ?? ''}
              onDelete={handleDelete}
              onExit={onExit}
              onOpenComments={openCommentSheet}
              onOpenProfile={onOpenProfile}
              onReport={openReportModal}
              onRate={handleRate}
              commentCount={
                (commentsBySubmission[String(entry.submissionId)] ?? []).filter(
                  (c) => !c.deleted,
                ).length
              }
              feedInteractionsDisabled={Boolean(activeFeedBan)}
              feedInteractionMessage={feedInteractionMessage}
              registerCardRef={registerCardRef}
              onLongPressReaction={handleOpenReactionPicker}
              onShareCopied={handleShareCopied}
              audioOn={feedAudioOn}
              onToggleAudio={setFeedAudioOn}
            />
          ))}
        </div>
      )}

      {reactionPicker ? (
        <ReactionPicker
          x={reactionPicker.x}
          y={reactionPicker.y}
          onClose={handleCloseReactionPicker}
          onSelect={handleSelectReaction}
        />
      ) : null}
      <ReactionFlyOverlay items={flyingReactions} />

      {commentSheetEntry ? (
        <FeedCommentSheet
          entry={commentSheetEntry}
          comments={activeComments}
          currentUserId={currentUserId}
          onClose={closeCommentSheet}
          onSubmitComment={(text, parentId) =>
            onCreateComment?.(commentSheetEntry.submissionId, text, parentId)
          }
          onDeleteComment={onDeleteComment}
          onLikeComment={onLikeComment}
          onReportComment={onReportComment}
          onOpenProfile={onOpenProfile}
          isDisabled={Boolean(activeFeedBan)}
          disabledReason={feedInteractionMessage}
        />
      ) : null}

      {deleteDialogEntry ? (
        <FeedDeleteConfirmDialog
          entry={deleteDialogEntry}
          isDeleting={Boolean(deletingBySubmission[deleteDialogEntry.submissionId])}
          onCancel={closeDeleteDialog}
          onConfirm={confirmDelete}
        />
      ) : null}

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
            <p className="feed-report-modal__subtitle">{reportModalEntry.knotTitle}</p>

            <label className="field-group">
              <span>Arsak</span>
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

      {isDesktop ? <BackToTopButton /> : null}
    </div>
  );
}
