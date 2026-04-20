import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MobileVideo } from '../components/MobileVideo.jsx';
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
const COMMENT_EMOJIS = ['🔥', '👑', '👍', '😂', '💀'];
const PRESET_TAB_ORDER = ['Heia', 'Tørr'];
const COMMENT_PRESETS = {
  Heia: [
    'Russelegende 2026 👑',
    'Helt rå... nesten 🔥',
    'Respekt... for motet 👍',
    'Nice try kamerat',
    'Godt forsøk russegutt/russejente',
  ],
  Tørr: [
    'What a save! 😂',
    'Konge... i sin egen hode 💀',
    'Dette var jo episk... for en annen skole 😂',
    '10/10 for innsats, 2/10 for resultat 💀',
    'Bro... hva var det der? 💀',
  ],
};
const LOCAL_FEED_COMMENTS = new Map();
const DELETE_UNDO_DELAY_MS = 10000;

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

function getLocalCommentsSnapshot() {
  return Object.fromEntries(LOCAL_FEED_COMMENTS.entries());
}

function createLocalComment(text, emoji) {
  const normalizedText = typeof text === 'string' ? text.trim() : '';
  const normalizedEmoji = COMMENT_EMOJIS.includes(emoji) ? emoji : '';
  const message = [normalizedEmoji, normalizedText].filter(Boolean).join(' ').trim();

  return {
    id: `local-comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    author: 'Du',
    createdAtLabel: 'Nettopp',
    emoji: normalizedEmoji,
    text: message,
  };
}

function getCommentsCountLabel(count) {
  if (!count) {
    return 'Ingen kommentarer ennå';
  }

  if (count === 1) {
    return '1 lokal kommentar';
  }

  return `${count} lokale kommentarer`;
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

function FeedMedia({ entry, variant = 'mobile', isActive = false }) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
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
    const mobileVideo = (
      <MobileVideo
        ref={videoRef}
        className={mediaClass}
        controls={false}
        autoPlay
        loop
        muted={false}
        playsInline
        preload="metadata"
        src={entry.videoPreviewUrl}
        isActive={isActive}
        playMode="sound-preferred"
        onAutoplayBlocked={(blocked) => setAutoplayBlocked(blocked)}
        onError={() => setVideoFailed(true)}
      />
    );

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
        {!isDesktop && autoplayBlocked && isActive ? (
          <button
            type="button"
            className="feed-video-fallback-button"
            onClick={async () => {
              const didPlay = await videoRef.current?.playWithAudio?.();

              if (!didPlay) {
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
    const image = (
      <img
        className={mediaClass}
        src={entry.imagePreviewUrl}
        alt={`${entry.studentName} sitt bildebevis for ${entry.knotTitle}`}
      />
    );

    return (
      <>
        {isDesktop ? (
          <div
            className="feed-card-desktop__media-wrap feed-media--clickable"
            role="button"
            tabIndex={0}
            onClick={() => setLightboxOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                setLightboxOpen(true);
              }
            }}
            aria-label="Apne bilde i fullskjerm"
          >
            {image}
          </div>
        ) : (
          renderMobileFrame(
            <div
              className="feed-reel-card__media-frame-button"
              role="button"
              tabIndex={0}
              onClick={() => setLightboxOpen(true)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  setLightboxOpen(true);
                }
              }}
              aria-label="Apne bilde i fullskjerm"
            >
              {image}
            </div>,
            <img
              className="feed-reel-card__media-backdrop"
              src={entry.imagePreviewUrl}
              alt=""
              aria-hidden="true"
            />,
          )
        )}
        {lightboxOpen ? (
          <FeedLightbox entry={entry} onClose={() => setLightboxOpen(false)} />
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

  return (
    <div
      className={`feed-card-v3__reactions ${isOverlay ? 'feed-card-v3__reactions--overlay' : ''}`}
      aria-label="Stjernerating"
    >
      <div className={`feed-rating ${isOverlay ? 'feed-rating--overlay' : ''}`}>
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
                className={`feed-rating-star ${isActive ? 'is-active' : ''} ${
                  isOverlay ? 'feed-rating-star--overlay' : ''
                }`}
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
        <p className={`feed-rating__summary ${isOverlay ? 'feed-rating__summary--overlay' : ''}`}>
          {summaryLabel}
        </p>
        {disabledReason ? (
          <p className={`feed-rating__hint ${isOverlay ? 'feed-rating__hint--overlay' : ''}`}>
            {disabledReason}
          </p>
        ) : null}
        {errorMessage ? <p className="feed-rating__error">{errorMessage}</p> : null}
      </div>
    </div>
  );
}

function FeedDeleteButton({
  canDelete,
  entry,
  isDeleting,
  onDelete,
  variant = 'floating',
}) {
  if (!canDelete || !entry.submissionId) {
    return null;
  }

  if (variant === 'hud') {
    return (
      <button
        type="button"
        className="feed-reel-card__hud-button feed-reel-card__hud-button--danger"
        onClick={() => onDelete(entry)}
        disabled={isDeleting}
        aria-label="Slett feed-post"
        title="Slett feed-post"
      >
        {isDeleting ? '...' : '\u00D7'}
      </button>
    );
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

function FeedCommentPreview({ comments, onOpenComments, commentCount, isDisabled = false }) {
  const previewComments = comments.slice(0, 2);

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
          Kommenter
        </button>
      </div>
      {previewComments.length ? (
        <div className="feed-comment-preview__list">
          {previewComments.map((comment) => (
            <p key={comment.id} className="feed-comment-preview__item">
              <strong>{comment.author}</strong> {comment.text}
            </p>
          ))}
        </div>
      ) : (
        <p className="feed-comment-preview__empty">
          Apne kommentarfeltet for a sende en lokal emoji eller en ferdig tekst.
        </p>
      )}
    </div>
  );
}

function FeedCommentFab({ count, onOpenComments, isDisabled = false }) {
  return (
    <button
      type="button"
      className="feed-reel-card__comment-fab"
      onClick={onOpenComments}
      disabled={isDisabled}
      aria-label="Apne kommentarer"
    >
      <span className="feed-reel-card__comment-icon">{'\u{1F4AC}'}</span>
      <span className="feed-reel-card__comment-count">{count}</span>
    </button>
  );
}

function FeedCommentSheet({
  entry,
  comments,
  draftText,
  selectedEmoji,
  selectedTab,
  onClose,
  onSelectEmoji,
  onSelectPresetTab,
  onSelectPreset,
  onChangeDraft,
  onSubmit,
  isDisabled = false,
  disabledReason = '',
}) {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="feed-sheet-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="feed-sheet"
        data-swipe-lock="true"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feed-comment-sheet-title"
      >
        <div className="feed-sheet__handle" />
        <div className="feed-sheet__header">
          <div>
            <p className="eyebrow">Kommentarer</p>
            <h3 id="feed-comment-sheet-title">{entry.knotTitle}</h3>
            <p className="feed-sheet__subtitle">{getCommentsCountLabel(comments.length)}</p>
          </div>
          <button type="button" className="feed-sheet__close" onClick={onClose}>
            {'\u00D7'}
          </button>
        </div>

        <div className="feed-sheet__composer">
          <div className="feed-sheet__emoji-row">
            {COMMENT_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={`feed-emoji-button ${selectedEmoji === emoji ? 'is-active' : ''}`}
                onClick={() => onSelectEmoji(emoji)}
                disabled={isDisabled}
              >
                {emoji}
              </button>
            ))}
          </div>

          <div className="feed-sheet__tabs">
            {PRESET_TAB_ORDER.map((tab) => (
              <button
                key={tab}
                type="button"
                className={`feed-sheet__tab ${selectedTab === tab ? 'is-active' : ''}`}
                onClick={() => onSelectPresetTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="feed-sheet__preset-grid">
            {COMMENT_PRESETS[selectedTab].map((preset) => (
              <button
                key={preset}
                type="button"
                className="feed-preset-button"
                onClick={() => onSelectPreset(preset)}
                disabled={isDisabled}
              >
                {preset}
              </button>
            ))}
          </div>

          <label className="field-group">
            <span>Skriv kommentar</span>
            <textarea
              className="text-input text-input--area feed-sheet__textarea"
              value={draftText}
              onChange={(event) => onChangeDraft(event.target.value)}
              placeholder="Skriv noe eller velg en av tekstene over."
              disabled={isDisabled}
              maxLength={180}
            />
          </label>

          {disabledReason ? <p className="feed-sheet__disabled-note">{disabledReason}</p> : null}

          <div className="feed-sheet__actions">
            <button
              type="button"
              className="action-button action-button--ghost"
              onClick={onClose}
            >
              Lukk
            </button>
            <button
              type="button"
              className="action-button"
              onClick={onSubmit}
              disabled={isDisabled || (!draftText.trim() && !selectedEmoji)}
            >
              Send lokalt
            </button>
          </div>
        </div>

        <div className="feed-sheet__comment-list">
          {comments.length ? (
            comments.map((comment) => (
              <article key={comment.id} className="feed-sheet__comment">
                <div className="feed-sheet__comment-top">
                  <strong>{comment.author}</strong>
                  <span>{comment.createdAtLabel}</span>
                </div>
                <p>{comment.text}</p>
              </article>
            ))
          ) : (
            <div className="feed-sheet__empty">
              <strong>Ingen lokale kommentarer ennå</strong>
              <p>Det du sender her vises med en gang i denne økten, men lagres ikke i backend.</p>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function FeedCardMobile({
  canDelete,
  entry,
  index,
  isActive,
  isDeleting,
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
  commentCount,
  feedInteractionsDisabled,
  feedInteractionMessage,
  registerCardRef,
}) {
  const isLightScene = entry.mediaType === 'none';
  const noteText =
    entry.note && entry.note.trim() && entry.note.trim() !== entry.knotTitle
      ? entry.note
      : '';
  const showBottomCopy = !isLightScene;

  return (
    <article
      ref={(node) => registerCardRef(entry.submissionId, node)}
      className={`feed-reel-card ${isActive ? 'is-active' : ''} ${
        isLightScene ? 'feed-reel-card--light-scene' : 'feed-reel-card--media-scene'
      }`}
      data-feed-index={index}
    >
      <FeedMedia entry={entry} variant="mobile" isActive={isActive} />

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
            <FeedDeleteButton
              canDelete={canDelete}
              entry={entry}
              isDeleting={isDeleting}
              onDelete={onDelete}
              variant="hud"
            />
            <FeedReportButton
              entry={entry}
              isSubmitting={isReporting}
              onReport={onReport}
              variant="hud"
            />
          </div>
        </div>

        <div className="feed-reel-card__bottom-hud">
          <div className="feed-reel-card__info-stack">
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

            <FeedRatingRow
              entry={entry}
              isSubmitting={isSubmitting}
              onRate={onRate}
              errorMessage={ratingError}
              isDisabled={feedInteractionsDisabled}
              disabledReason={feedInteractionMessage}
              variant="overlay"
            />
          </div>

          <FeedCommentFab
            count={commentCount}
            onOpenComments={() => onOpenComments(entry)}
            isDisabled={feedInteractionsDisabled}
          />
        </div>

        <div className="feed-reel-card__index-indicator">
          {index + 1}/{total}
        </div>
      </div>
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
  onOpenComments,
  onOpenProfile,
  onReport,
  onRate,
  ratingError,
  comments,
  feedInteractionsDisabled,
  feedInteractionMessage,
}) {
  const isTextOnly = entry.mediaType === 'none';

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

export function FeedPage({
  activityLog,
  canDeletePosts = false,
  currentUserActiveBans = [],
  onDeleteSubmission,
  onExit,
  onOpenProfile,
  onReportSubmission,
  onRateSubmission,
}) {
  const [pendingBySubmission, setPendingBySubmission] = useState({});
  const [deletingBySubmission, setDeletingBySubmission] = useState({});
  const [pendingDelete, setPendingDelete] = useState(null);
  const [reportingBySubmission, setReportingBySubmission] = useState({});
  const [ratingDraftBySubmission, setRatingDraftBySubmission] = useState({});
  const [ratingErrorBySubmission, setRatingErrorBySubmission] = useState({});
  const [reportModalEntry, setReportModalEntry] = useState(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportNote, setReportNote] = useState('');
  const [reportError, setReportError] = useState('');
  const [reportFeedback, setReportFeedback] = useState('');
  const [deleteFeedback, setDeleteFeedback] = useState('');
  const [activeMobileIndex, setActiveMobileIndex] = useState(0);
  const [commentSheetEntry, setCommentSheetEntry] = useState(null);
  const [localCommentsBySubmission, setLocalCommentsBySubmission] = useState(
    () => getLocalCommentsSnapshot(),
  );
  const [commentDraftBySubmission, setCommentDraftBySubmission] = useState({});
  const [commentEmojiBySubmission, setCommentEmojiBySubmission] = useState({});
  const [commentTabBySubmission, setCommentTabBySubmission] = useState({});
  const isDesktop = useDesktopFeed();
  const mobileReelRef = useRef(null);
  const cardRefMap = useRef(new Map());
  const pendingDeleteTimeoutRef = useRef(null);

  const activeFeedBan =
    currentUserActiveBans.find((ban) => ban.type === 'feed') ?? null;
  const feedInteractionMessage = activeFeedBan
    ? `Feed-tilgangen din er midlertidig begrenset${
        activeFeedBan.remainingLabel ? ` (${activeFeedBan.remainingLabel})` : ''
      }.`
    : '';
  const hiddenSubmissionId = pendingDelete?.submissionId ?? null;
  const feedEntries = useMemo(
    () =>
      activityLog.filter(
        (entry) =>
          Boolean(entry.submissionId) &&
          entry.shareDetails !== false &&
          entry.submissionId !== hiddenSubmissionId,
      ),
    [activityLog, hiddenSubmissionId],
  );

  useEffect(
    () => () => {
      if (pendingDeleteTimeoutRef.current) {
        clearTimeout(pendingDeleteTimeoutRef.current);
        pendingDeleteTimeoutRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    setLocalCommentsBySubmission((current) => {
      const next = { ...current };
      let changed = false;

      feedEntries.forEach((entry) => {
        const key = String(entry.submissionId);
        if (!(key in next) && LOCAL_FEED_COMMENTS.has(key)) {
          next[key] = LOCAL_FEED_COMMENTS.get(key);
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [feedEntries]);

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

  async function handleDelete(entry) {
    if (!entry.submissionId || !onDeleteSubmission) {
      return;
    }

    if (deletingBySubmission[entry.submissionId] || pendingDelete) {
      return;
    }

    setDeleteFeedback('');
    setPendingDelete({
      submissionId: entry.submissionId,
      knotTitle: entry.knotTitle ?? '',
    });

    if (pendingDeleteTimeoutRef.current) {
      clearTimeout(pendingDeleteTimeoutRef.current);
      pendingDeleteTimeoutRef.current = null;
    }

    pendingDeleteTimeoutRef.current = setTimeout(async () => {
      setDeletingBySubmission((current) => ({
        ...current,
        [entry.submissionId]: true,
      }));

      try {
        await onDeleteSubmission(entry.submissionId);
      } catch (error) {
        const message =
          error instanceof Error && error.message ? error.message : '';
        const normalizedMessage = message.trim().toLowerCase();

        if (normalizedMessage.includes('ikke synlig i feeden')) {
          setDeleteFeedback('');
        } else {
          setDeleteFeedback(
            message || 'Kunne ikke slette feed-posten akkurat na.',
          );
        }
      } finally {
        setPendingDelete((current) =>
          current?.submissionId === entry.submissionId ? null : current,
        );
        setDeletingBySubmission((current) => {
          const next = { ...current };
          delete next[entry.submissionId];
          return next;
        });
        pendingDeleteTimeoutRef.current = null;
      }
    }, DELETE_UNDO_DELAY_MS);
  }

  function handleUndoDelete() {
    if (!pendingDelete) {
      return;
    }

    if (pendingDeleteTimeoutRef.current) {
      clearTimeout(pendingDeleteTimeoutRef.current);
      pendingDeleteTimeoutRef.current = null;
    }

    setPendingDelete(null);
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
  }

  function handleSelectCommentEmoji(submissionId, emoji) {
    setCommentEmojiBySubmission((current) => ({
      ...current,
      [submissionId]: current[submissionId] === emoji ? '' : emoji,
    }));
  }

  function handleSelectCommentTab(submissionId, tab) {
    setCommentTabBySubmission((current) => ({
      ...current,
      [submissionId]: tab,
    }));
  }

  function handleSelectCommentPreset(submissionId, preset) {
    setCommentDraftBySubmission((current) => ({
      ...current,
      [submissionId]: preset,
    }));
  }

  function handleCommentDraftChange(submissionId, value) {
    setCommentDraftBySubmission((current) => ({
      ...current,
      [submissionId]: value,
    }));
  }

  function handleSubmitLocalComment(entry) {
    if (!entry?.submissionId || activeFeedBan) {
      return;
    }

    const submissionId = String(entry.submissionId);
    const draftText = commentDraftBySubmission[submissionId] ?? '';
    const selectedEmoji = commentEmojiBySubmission[submissionId] ?? '';
    const nextComment = createLocalComment(draftText, selectedEmoji);

    if (!nextComment.text) {
      return;
    }

    setLocalCommentsBySubmission((current) => {
      const nextComments = [nextComment, ...(current[submissionId] ?? [])];
      const nextState = {
        ...current,
        [submissionId]: nextComments,
      };

      LOCAL_FEED_COMMENTS.set(submissionId, nextComments);
      return nextState;
    });

    setCommentDraftBySubmission((current) => ({
      ...current,
      [submissionId]: '',
    }));
    setCommentEmojiBySubmission((current) => ({
      ...current,
      [submissionId]: '',
    }));
  }

  if (!feedEntries.length && !pendingDelete) {
    return (
      <section className="section-card">
        <div className="section-card__header">
          <h3>Feed</h3>
          <p>Ingen synlige feed-poster ligger ute enna.</p>
        </div>
      </section>
    );
  }

  const activeCommentSubmissionId = String(commentSheetEntry?.submissionId ?? '');
  const activeCommentTab =
    commentTabBySubmission[activeCommentSubmissionId] ?? PRESET_TAB_ORDER[0];
  const activeCommentDraft = commentDraftBySubmission[activeCommentSubmissionId] ?? '';
  const activeCommentEmoji = commentEmojiBySubmission[activeCommentSubmissionId] ?? '';
  const activeComments = commentSheetEntry?.submissionId
    ? localCommentsBySubmission[String(commentSheetEntry.submissionId)] ?? []
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
      {pendingDelete && typeof document !== 'undefined'
        ? createPortal(
            <div className="feed-undo-toast" role="status" aria-live="polite">
              <p>
                Posten{pendingDelete.knotTitle ? ` "${pendingDelete.knotTitle}"` : ''} slettes om
                10 sekunder.
              </p>
              <button
                type="button"
                className="feed-undo-toast__undo-button"
                onClick={handleUndoDelete}
                aria-label="Angre sletting"
                title="Angre sletting"
              >
                {'\u21A9'}
              </button>
            </div>,
            document.body,
          )
        : null}

      {isDesktop ? (
        <div className="feed-list-v3">
          {feedEntries.map((entry, index) => (
            <FeedCardDesktop
              key={entry.id}
              canDelete={canDeletePosts && !pendingDelete}
              entry={{
                ...entry,
                myRating: ratingDraftBySubmission[entry.submissionId] ?? entry.myRating,
              }}
              index={index}
              isDeleting={Boolean(deletingBySubmission[entry.submissionId])}
              isReporting={Boolean(reportingBySubmission[entry.submissionId])}
              total={feedEntries.length}
              isSubmitting={Boolean(pendingBySubmission[entry.submissionId])}
              ratingError={ratingErrorBySubmission[entry.submissionId] ?? ''}
              onDelete={handleDelete}
              onOpenComments={openCommentSheet}
              onOpenProfile={onOpenProfile}
              onReport={openReportModal}
              onRate={handleRate}
              comments={localCommentsBySubmission[String(entry.submissionId)] ?? []}
              feedInteractionsDisabled={Boolean(activeFeedBan)}
              feedInteractionMessage={feedInteractionMessage}
            />
          ))}
        </div>
      ) : (
        <div ref={mobileReelRef} className="feed-reel-mobile">
          {feedEntries.map((entry, index) => (
            <FeedCardMobile
              key={entry.id}
              canDelete={canDeletePosts && !pendingDelete}
              entry={{
                ...entry,
                myRating: ratingDraftBySubmission[entry.submissionId] ?? entry.myRating,
              }}
              index={index}
              isActive={activeMobileIndex === index}
              isDeleting={Boolean(deletingBySubmission[entry.submissionId])}
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
                (localCommentsBySubmission[String(entry.submissionId)] ?? []).length
              }
              feedInteractionsDisabled={Boolean(activeFeedBan)}
              feedInteractionMessage={feedInteractionMessage}
              registerCardRef={registerCardRef}
            />
          ))}
        </div>
      )}

      {commentSheetEntry ? (
        <FeedCommentSheet
          entry={commentSheetEntry}
          comments={activeComments}
          draftText={activeCommentDraft}
          selectedEmoji={activeCommentEmoji}
          selectedTab={activeCommentTab}
          onClose={closeCommentSheet}
          onSelectEmoji={(emoji) =>
            handleSelectCommentEmoji(activeCommentSubmissionId, emoji)
          }
          onSelectPresetTab={(tab) =>
            handleSelectCommentTab(activeCommentSubmissionId, tab)
          }
          onSelectPreset={(preset) =>
            handleSelectCommentPreset(activeCommentSubmissionId, preset)
          }
          onChangeDraft={(value) =>
            handleCommentDraftChange(activeCommentSubmissionId, value)
          }
          onSubmit={() => handleSubmitLocalComment(commentSheetEntry)}
          isDisabled={Boolean(activeFeedBan)}
          disabledReason={feedInteractionMessage}
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
    </div>
  );
}
