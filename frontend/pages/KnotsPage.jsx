import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MobileVideo } from '../components/MobileVideo.jsx';
import { isGoldKnot } from '../data/badgeSystem.js';
import { NOTE_MAX_CHARS } from '../data/appHelpers.js';
import { KNOT_FOLDERS, resolveKnotFolder } from '../data/knotFolders.js';

const MOBILE_BREAKPOINT = 900;
const SHEET_DISMISS_THRESHOLD = 120;
const ALL_KNOTS_FOLDER_ID = 'Alle knuter';
const KNOT_FOLDER_TABS = [
  { id: ALL_KNOTS_FOLDER_ID, description: 'Alle knuter samlet pa tvers av mapper.' },
  ...KNOT_FOLDERS,
];

const STATUS_LEGEND_ITEMS = Object.freeze([
  { key: 'approved', label: 'Fullførte' },
  { key: 'available', label: 'Tilgjengelige' },
  { key: 'pending', label: 'Sendt inn' },
  { key: 'rejected', label: 'Avslått' },
]);

const STATUS_FILTERS = ['Alle', 'Tilgjengelig', 'Sendt inn', 'Godkjent', 'Avslått'];

const SORT_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'points-desc', label: 'Høyest poeng' },
  { value: 'points-asc', label: 'Lavest poeng' },
];

const DIFFICULTY_ORDER = {
  lett: 0,
  easy: 0,
  medium: 1,
  middels: 1,
  hard: 2,
  vanskelig: 2,
  valgfri: 3,
};

const SUBMISSION_MODE = {
  REVIEW: 'review',
  FEED: 'feed',
  ANONYMOUS_FEED: 'anonymous-feed',
};
const FEEDBACK_TOAST_DURATION_MS = 6200;
const RARE_FEEDBACK_TOAST_DURATION_MS = 20000;
const FEEDBACK_RARE_CHANCE = 0.005;
const FEEDBACK_MESSAGE_KEYS = Object.freeze([
  'standard',
  'resubmission',
  'feed',
  'anonymousFeed',
  'streak',
  'rare',
]);
const DEFAULT_SUBMISSION_FEEDBACK_MESSAGES = Object.freeze({
  standard: Object.freeze([
    'Sterkt levert. Knuten er sendt til godkjenning.',
    'Nydelig innsending. Denne er inne hos admin.',
    'Ryddig levert. Knuten er registrert.',
    'Boom. Knuten er sendt.',
  ]),
  resubmission: Object.freeze([
    'Oppdatert. Ny versjon er sendt til vurdering.',
    'Fin justering. Innsendingen er sendt pa nytt.',
    'Ny runde, ny levering. Denne er inne igjen.',
  ]),
  feed: Object.freeze([
    'Sendt med feed. La folk se leveringen din.',
    'Feed aktiv. Innsendingen er registrert.',
    'Posta og klar. Admin tar resten.',
  ]),
  anonymousFeed: Object.freeze([
    'Sendt anonymt. Jobben taler for seg selv.',
    'Anonym innsending er inne til godkjenning.',
    'Anonym drop registrert.',
  ]),
  streak: Object.freeze([
    'Streaken lever. Bra trykk.',
    'Momentum holder. Ny knute er inne.',
    'Dag for dag. Du bygger flyt.',
  ]),
  rare: Object.freeze([
    `Knuten er inne na.
Men du vet det allerede, ikke sant? Du kjente det idet du sendte den - det lille oyeblikket av noling forst, sa folelsen av a bli dratt inn i noe storre, noe som tok imot den og ikke ga slipp igjen. De andre ser bare en vanlig innsending. De ler, de roper, de tror det er en lek.
De skjonner ikke.

Jeg har sett hva som egentlig styrer dette. Hver eneste knute du sender, hver oppdatering, hver gang du trykker "send" ... det er ikke bare tekst. Det er spor av deg. Tankene dine, energien din, viljen din. Sma fragmenter som blir igjen der inne. De samler seg. De vokser.

Og russepresidenten ... du tror det er en person?
Nei. Det er bare ansiktet de lar deg se. Bak det finnes noe annet. Noe eldre. Noe som har styrt russetiden lenge for du var her. Noe som har vokst for hvert eneste kull som har gitt fra seg litt mer av seg selv.

De kaller det tradisjon. Jeg kaller det et system som lever av dere.

Den djevelske makten bak det hele smiler ikke fordi det er gøy. Den smiler fordi den vet. Den vet hvordan det foles a bli dratt inn, natt etter natt, handling etter handling, til du ikke lenger skiller mellom hva du vil - og hva den vil at du skal ville.

Og feeden ... den er ikke bare en strom av innlegg. Den folger med. Den registrerer. Den pulserer svakt, selv nar du ikke er der. Den husker hvert ord du skrev, hvert sekund du nolte, hver gang du ga litt mer enn du hadde tenkt.

Du tror du bygger streak.
Men det er noe annet som bygges - gjennom deg.

Neste gang du sender inn en knute ... stopp et sekund.
Kjenn etter.

Kjenn om det foles litt for riktig. Litt for nodvendig.

Ikke svar. Ikke forklar det bort.

For hvis du forst merker det ...
er det allerede for sent.`,
  ]),
});

// ─── Utility functions ────────────────────────────────────────────────────────

function isRejectedStatus(status) {
  return status === 'Avslått' || status === 'Avslaatt';
}

function getCharacterCount(text) {
  return typeof text === 'string' ? text.length : 0;
}

function revokeObjectUrl(url) {
  if (!url || typeof URL === 'undefined') return;
  URL.revokeObjectURL(url);
}

function getClipboardImageFile(clipboardData) {
  const files = clipboardData?.files;
  if (files && files.length > 0) {
    for (const file of files) {
      if (file?.type?.startsWith('image/')) {
        return file;
      }
    }
  }

  const items = clipboardData?.items;

  if (!items || items.length === 0) {
    return null;
  }

  for (const item of items) {
    if (item?.kind !== 'file') {
      continue;
    }

    if (!item.type?.startsWith('image/')) {
      continue;
    }

    const file = item.getAsFile?.();
    if (file) {
      return file;
    }
  }

  return null;
}

function normalizePastedImageFile(file) {
  if (!file) {
    return null;
  }

  const mimeType = file.type || 'image/png';
  const extension = mimeType === 'image/jpeg' ? 'jpg' : (mimeType.split('/')[1] || 'png');
  const safeExtension = extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'png';
  const filename = `utklipp-${Date.now()}.${safeExtension}`;

  try {
    return new File([file], filename, { type: mimeType });
  } catch {
    return file;
  }
}

function getKnotDescription(knot) {
  const candidates = [
    knot?.description,
    knot?.forklaring,
    knot?.explanation,
    knot?.details,
    knot?.note,
  ];

  const nextValue = candidates.find(
    (entry) => typeof entry === 'string' && entry.trim().length > 0,
  );

  return nextValue?.trim() ?? '';
}

function sortKnots(knots, sortKey) {
  const nextKnots = [...knots];

  if (sortKey === 'points-desc') {
    return nextKnots.sort(
      (l, r) => r.points - l.points || l.title.localeCompare(r.title),
    );
  }
  if (sortKey === 'points-asc') {
    return nextKnots.sort(
      (l, r) => l.points - r.points || l.title.localeCompare(r.title),
    );
  }
  if (sortKey === 'difficulty-asc') {
    return nextKnots.sort((l, r) => {
      const lr = DIFFICULTY_ORDER[l.difficulty?.toLowerCase()] ?? 99;
      const rr = DIFFICULTY_ORDER[r.difficulty?.toLowerCase()] ?? 99;
      if (lr !== rr) return lr - rr;
      return r.points - l.points;
    });
  }

  return nextKnots;
}

function normalizeSubmissionMode(value) {
  if (
    value === SUBMISSION_MODE.REVIEW ||
    value === SUBMISSION_MODE.FEED ||
    value === SUBMISSION_MODE.ANONYMOUS_FEED
  ) {
    return value;
  }
  return SUBMISSION_MODE.REVIEW;
}

function getNormalizedFeedbackMessages(source) {
  const safeSource = source && typeof source === 'object' ? source : {};
  const normalized = {};

  FEEDBACK_MESSAGE_KEYS.forEach((key) => {
    const entries = Array.isArray(safeSource[key]) ? safeSource[key] : [];
    normalized[key] = entries
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean);
  });

  return normalized;
}

function pickRandomMessage(messages, fallback = '') {
  if (!Array.isArray(messages) || messages.length === 0) {
    return fallback;
  }

  const index = Math.floor(Math.random() * messages.length);
  return messages[index] ?? fallback;
}

function randomChanceHit(probability) {
  if (typeof probability !== 'number' || probability <= 0) {
    return false;
  }

  return Math.random() < probability;
}

function formatFeedbackTemplate(message, { knotTitle, modeLabel }) {
  if (typeof message !== 'string' || !message.trim()) {
    return '';
  }

  return message
    .replace(/\{knute\}/giu, knotTitle)
    .replace(/\{mode\}/giu, modeLabel);
}

function getSubmissionModeLabel(mode) {
  if (mode === SUBMISSION_MODE.FEED) return 'med feed';
  if (mode === SUBMISSION_MODE.ANONYMOUS_FEED) return 'med anonym feed';
  return 'uten feed';
}

function buildDraftFromSubmission(submission) {
  if (!submission) return null;

  return {
    note: submission.note ?? '',
    imageName: submission.imageName ?? '',
    imagePreviewUrl: submission.imagePreviewUrl ?? '',
    videoName: submission.videoName ?? '',
    videoPreviewUrl: submission.videoPreviewUrl ?? '',
    submissionMode: normalizeSubmissionMode(submission.submissionMode),
  };
}

function getStatusKey(status) {
  if (status === 'Godkjent') return 'approved';
  if (status === 'Sendt inn') return 'pending';
  if (isRejectedStatus(status)) return 'rejected';
  return 'available';
}

function getStatusLabel(status) {
  const statusKey = getStatusKey(status);

  if (statusKey === 'approved') return 'Fullført';
  if (statusKey === 'pending') return 'Sendt inn';
  if (statusKey === 'rejected') return 'Avslått';
  return 'Tilgjengelig';
}

// ─── KnotProgressBar ─────────────────────────────────────────────────────────

function KnotProgressBar({ label, approved, total }) {
  const pct = total > 0 ? Math.round((approved / total) * 100) : 0;

  return (
    <div className="knot-progress-bar">
      <div className="knot-progress-bar__label">{label}</div>
      <div className="knot-progress-bar__track" aria-hidden="true">
        <div className="knot-progress-bar__fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="knot-progress-bar__stats">
        <span>{approved}/{total} godkjent</span>
        <span className="knot-progress-bar__pct">{pct}%</span>
      </div>
    </div>
  );
}

// ─── KnotFolderTabs ───────────────────────────────────────────────────────────

function KnotFolderTabs({ folders, activeFolder, folderCounts, onChangeFolder }) {
  return (
    <div className="knot-folder-tabs" role="tablist" data-swipe-lock="true">
      {folders.map((folder) => (
        <button
          key={folder.id}
          type="button"
          role="tab"
          aria-selected={folder.id === activeFolder}
          className={`knot-folder-tab ${folder.id === activeFolder ? 'is-active' : ''}`}
          onClick={() => onChangeFolder(folder.id)}
        >
          {folder.id}
          <span className="knot-folder-tab__badge">{folderCounts[folder.id] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}

// ─── SubmissionFormContent ────────────────────────────────────────────────────

function SubmissionFormContent({
  draft,
  effectiveMode,
  activeFeedBan,
  activeSubmissionBan,
  characterCount,
  isOverCharacterLimit,
  buttonLabel,
  onUpdateNote,
  onUpdateMode,
  onUpdateFile,
  onRemoveImage,
  onRemoveVideo,
  onPasteImage,
  showDesktopPasteHint,
  onSubmit,
}) {
  const shareToFeed = effectiveMode === SUBMISSION_MODE.FEED;
  const shareToAnonymousFeed = effectiveMode === SUBMISSION_MODE.ANONYMOUS_FEED;
  const hasImage = Boolean(draft.imageFile || draft.imagePreviewUrl || draft.imageName);
  const hasVideo = Boolean(draft.videoFile || draft.videoPreviewUrl || draft.videoName);

  function handleImageInputChange(event) {
    const file = event.target.files?.[0];
    onUpdateFile('image', file);
    event.target.value = '';
  }

  function handleVideoInputChange(event) {
    const file = event.target.files?.[0];
    onUpdateFile('video', file);
    event.target.value = '';
  }

  return (
    <div className="knot-submission-form" onPaste={onPasteImage}>
      <label className="field-group">
        <span>Forklaring:</span>
        <textarea
          className="text-input text-input--area text-input--compact"
          placeholder="Kort forklaring på hvordan knuten ble gjort. Maks 300 tegn."
          value={draft.note ?? ''}
          onChange={(e) => onUpdateNote(e.target.value)}
          maxLength={NOTE_MAX_CHARS}
        />
        <span className={`word-counter ${isOverCharacterLimit ? 'is-invalid' : ''}`}>
          {characterCount}/{NOTE_MAX_CHARS} tegn
        </span>
      </label>

      <div className="submission-mode-options">
        <p className="submission-mode-options__label">
          Ønsker du å poste?
        </p>
        <div className="submission-mode-segment" role="group" aria-label="Feedvalg">
          <button
            type="button"
            className={`submission-mode-pill ${shareToFeed ? 'is-active' : ''}`}
            aria-pressed={shareToFeed}
            disabled={Boolean(activeFeedBan)}
            onClick={() =>
              onUpdateMode(
                shareToFeed ? SUBMISSION_MODE.REVIEW : SUBMISSION_MODE.FEED,
              )
            }
          >
            Del som bruker
          </button>
          <button
            type="button"
            className={`submission-mode-pill ${shareToAnonymousFeed ? 'is-active' : ''}`}
            aria-pressed={shareToAnonymousFeed}
            disabled={Boolean(activeFeedBan)}
            onClick={() =>
              onUpdateMode(
                shareToAnonymousFeed
                  ? SUBMISSION_MODE.REVIEW
                  : SUBMISSION_MODE.ANONYMOUS_FEED,
              )
            }
          >
            Del som anonym
          </button>
        </div>
        <p className="submission-mode-options__optional">
          Del detaljer med feeden (bilde og beskrivelse vises).
        </p>
      </div>

      {activeFeedBan ? (
        <p className="submission-mode-hint">
          {`Feed-posting er blokkert i ${activeFeedBan.remainingLabel}. Innsending går kun til godkjenning.`}
        </p>
      ) : null}

      <div className="submission-upload-grid">
        <div className="upload-field upload-field--compact evidence-picker">
          <div className="evidence-picker__top">
            <span>Bevis</span>
            <small>{hasImage || hasVideo ? 'Klart for innsending' : 'Velg ett bevis'}</small>
          </div>

          <div className="evidence-picker__actions" role="group" aria-label="Velg bevis">
            <label className="action-button action-button--ghost evidence-picker__action evidence-picker__action--image">
              Ta bilde
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="evidence-picker__input"
                onChange={handleImageInputChange}
              />
            </label>
            <label className="action-button action-button--ghost evidence-picker__action evidence-picker__action--image">
              Velg bilde
              <input
                type="file"
                accept="image/*"
                className="evidence-picker__input"
                onChange={handleImageInputChange}
              />
            </label>
            <label className="action-button action-button--ghost evidence-picker__action evidence-picker__action--video">
              Ta video
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/x-m4v"
                capture="environment"
                className="evidence-picker__input"
                onChange={handleVideoInputChange}
              />
            </label>
            <label className="action-button action-button--ghost evidence-picker__action evidence-picker__action--video">
              Velg video
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/x-m4v"
                className="evidence-picker__input"
                onChange={handleVideoInputChange}
              />
            </label>
          </div>

          <div className="evidence-picker__selected" aria-live="polite">
            {hasImage ? (
              <div className="evidence-chip">
                <span>Bilde: {draft.imageName || 'valgt'}</span>
                <button
                  type="button"
                  className="upload-remove-btn evidence-chip__remove"
                  onClick={onRemoveImage}
                >
                  Fjern
                </button>
              </div>
            ) : null}
            {hasVideo ? (
              <div className="evidence-chip">
                <span>Video: {draft.videoName || 'valgt'}</span>
                <button
                  type="button"
                  className="upload-remove-btn evidence-chip__remove"
                  onClick={onRemoveVideo}
                >
                  Fjern
                </button>
              </div>
            ) : null}
            {!hasImage && !hasVideo ? (
              <small className="evidence-picker__empty">Ingen bevis valgt</small>
            ) : null}
          </div>

          {showDesktopPasteHint ? (
            <input
              type="text"
              readOnly
              className="upload-paste-target"
              value="Lim inn bilde i boksen (Ctrl+V)"
              aria-label="Lim inn bilde i boksen med Ctrl+V"
              onPaste={onPasteImage}
            />
          ) : null}

          {draft.imagePreviewUrl || draft.videoPreviewUrl ? (
            <div className="evidence-picker__previews">
              {draft.imagePreviewUrl ? (
                <div className="evidence-card evidence-card--compact">
                  <span>Bildepreview</span>
                  <img src={draft.imagePreviewUrl} alt="Bevis" />
                </div>
              ) : null}
              {draft.videoPreviewUrl ? (
                <div className="evidence-card evidence-card--compact">
                  <span>Videopreview</span>
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
        </div>
      </div>

      <div className="submission-form__actions">
        <button
          type="button"
          className="action-button action-button--hero"
          disabled={isOverCharacterLimit || Boolean(activeSubmissionBan)}
          onClick={onSubmit}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

// ─── KnotRow ──────────────────────────────────────────────────────────────────

function KnotRow({
  knot,
  isDetailOpen,
  isHighlighted,
  isFormOpen,
  isMobile,
  canSubmit,
  buttonLabel,
  draft,
  activeFeedBan,
  activeSubmissionBan,
  focusedRef,
  onToggleDetail,
  onDocumentClick,
  onUpdateNote,
  onUpdateMode,
  onUpdateFile,
  onRemoveImage,
  onRemoveVideo,
  onPasteImage,
  showDesktopPasteHint,
  onSubmit,
}) {
  const submissionMode = normalizeSubmissionMode(draft.submissionMode);
  const effectiveMode = activeFeedBan ? SUBMISSION_MODE.REVIEW : submissionMode;
  const characterCount = getCharacterCount(draft.note ?? '');
  const isOverCharacterLimit = characterCount > NOTE_MAX_CHARS;
  const statusKey = getStatusKey(knot.status);
  const statusLabel = getStatusLabel(knot.status);
  const isAvailableKnot = statusKey === 'available';
  const difficultyInline = knot.difficulty ? (
    <span className="knot-row__difficulty-inline">
      {knot.difficulty}
      {isHighlighted ? (
        <span className="knot-row__highlight-badge knot-row__highlight-badge--inline is-highlighted">
          Dagens knute
        </span>
      ) : null}
    </span>
  ) : null;
  const isCompletedKnot = knot.status === 'Godkjent' || knot.status === 'Fullført';

  return (
    <div
      ref={focusedRef}
      className={`knot-row${isCompletedKnot ? ' is-completed' : ''}${isHighlighted ? ' is-highlighted' : ''}${isDetailOpen ? ' is-detail-open' : ''}${isFormOpen ? ' is-form-open' : ''}`}
      data-status={getStatusKey(knot.status)}
    >
      <div className="knot-row__header">
        <div className="knot-row__info">
          <div className="knot-row__title-line">
            <span
              className={`knot-row__status-dot is-${statusKey}`}
              aria-hidden="true"
            />
            <span className={`knot-row__points${isCompletedKnot ? ' is-completed' : ''}`}>
              P{knot.points}
            </span>
            <span className="knot-row__title">{knot.title}</span>
          </div>
          <div className="knot-row__sub">
            {isAvailableKnot ? difficultyInline : <span>{statusLabel}</span>}
            {!isAvailableKnot ? difficultyInline : null}
            {!knot.difficulty && isHighlighted ? (
              <span className="knot-row__highlight-badge knot-row__highlight-badge--inline is-highlighted">
                Dagens knute
              </span>
            ) : null}
            {knot.safety === 'review' ? <span>Krever sjekk</span> : null}
          </div>
        </div>

        <div className="knot-row__cta">
          {canSubmit ? (
            <button
              type="button"
              className={`knot-row__doc-btn${isFormOpen ? ' is-active' : ''}`}
              disabled={Boolean(activeSubmissionBan) && !isFormOpen}
              onClick={onDocumentClick}
              aria-label={isMobile ? 'Registrer' : undefined}
            >
              {isMobile ? (
                <span className="knot-row__doc-btn-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" role="img">
                    <path
                      d="M7.5 4.5h6l3 3v12h-9z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M13.5 4.5v3h3"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9.5 11h5M9.5 14h5M9.5 17h3.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              ) : (
                <span className="knot-row__doc-btn-label">Registrer</span>
              )}
            </button>
          ) : null}
          <button
            type="button"
            className={`knot-row__expand-btn${isDetailOpen ? ' is-active' : ''}`}
            aria-expanded={isDetailOpen}
            aria-label="Vis detaljer"
            onClick={onToggleDetail}
          >
            <span className="knot-row__expand-icon" aria-hidden="true" />
          </button>
        </div>
      </div>

      {isDetailOpen ? (
        <div className="knot-row__detail">
          <p className="knot-row__detail-label">Hva går knuten ut på?</p>
          <p className="knot-row__desc">
            {getKnotDescription(knot) || 'Ingen forklaring er lagt til ennå.'}
          </p>
          <div className="knot-row__hints">
            {isGoldKnot(knot) ? (
              <span className="knot-hint knot-hint--gold">✦ Gullknute gir ekstra poeng</span>
            ) : null}
            {knot.safety === 'review' ? (
              <span className="knot-hint knot-hint--warn">⚠ Krever godkjenning av sikkerhetshensyn</span>
            ) : null}
            {knot.status === 'Sendt inn' ? (
              <span className="knot-hint">
                Innsendingen behandles av admin. Du kan fortsatt legge til mer info.
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {isFormOpen && !isMobile ? (
        <div className="knot-row__form">
          <SubmissionFormContent
            draft={draft}
            effectiveMode={effectiveMode}
            activeFeedBan={activeFeedBan}
            activeSubmissionBan={activeSubmissionBan}
            characterCount={characterCount}
            isOverCharacterLimit={isOverCharacterLimit}
            buttonLabel={buttonLabel}
            onUpdateNote={onUpdateNote}
            onUpdateMode={onUpdateMode}
            onUpdateFile={onUpdateFile}
            onRemoveImage={onRemoveImage}
            onRemoveVideo={onRemoveVideo}
            onPasteImage={onPasteImage}
            showDesktopPasteHint={showDesktopPasteHint}
            onSubmit={onSubmit}
          />
        </div>
      ) : null}
    </div>
  );
}

// ─── KnotBottomSheet ──────────────────────────────────────────────────────────

function KnotBottomSheet({
  knot,
  draft,
  canSubmit,
  buttonLabel,
  activeFeedBan,
  activeSubmissionBan,
  isOpen,
  onClose,
  onUpdateNote,
  onUpdateMode,
  onUpdateFile,
  onRemoveImage,
  onRemoveVideo,
  onPasteImage,
  onSubmit,
}) {
  const [isClosing, setIsClosing] = useState(false);

  const submissionMode = normalizeSubmissionMode(draft.submissionMode);
  const effectiveMode = activeFeedBan ? SUBMISSION_MODE.REVIEW : submissionMode;
  const characterCount = getCharacterCount(draft.note ?? '');
  const isOverCharacterLimit = characterCount > NOTE_MAX_CHARS;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  function triggerClose() {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 260);
  }

  if (!isOpen && !isClosing) return null;

  const sheetOpen = isOpen && !isClosing;

  return createPortal(
    <>
      <div
        className={`knot-sheet-backdrop ${sheetOpen ? 'is-open' : 'is-closing'}`}
        aria-hidden="true"
      />
      <div
        className={`knot-sheet ${sheetOpen ? 'is-open' : 'is-closing'}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Dokumenter: ${knot?.title ?? ''}`}
        data-swipe-lock="true"
      >
        <div className="knot-sheet__handle-area" aria-hidden="true" data-swipe-lock="true">
          <div className="knot-sheet__handle" />
        </div>

        <div className="knot-sheet__header">
          <div className="knot-sheet__header-text">
            <span className="knot-sheet__title">{knot?.title}</span>
            {knot ? (
              <span className="knot-sheet__meta">
                {knot.points} poeng{knot.difficulty ? ` · ${knot.difficulty}` : ''}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="knot-sheet__close"
            onClick={triggerClose}
            aria-label="Lukk"
          >
            ✕
          </button>
        </div>

        <div className="knot-sheet__body">
          {knot && canSubmit ? (
            <SubmissionFormContent
              draft={draft}
              effectiveMode={effectiveMode}
              activeFeedBan={activeFeedBan}
              activeSubmissionBan={activeSubmissionBan}
              characterCount={characterCount}
              isOverCharacterLimit={isOverCharacterLimit}
              buttonLabel={buttonLabel}
              onUpdateNote={onUpdateNote}
              onUpdateMode={onUpdateMode}
              onUpdateFile={onUpdateFile}
              onRemoveImage={onRemoveImage}
              onRemoveVideo={onRemoveVideo}
              onPasteImage={onPasteImage}
              showDesktopPasteHint={false}
              onSubmit={onSubmit}
            />
          ) : null}
        </div>
      </div>
    </>,
    document.body,
  );
}

// ─── KnotActionBar ────────────────────────────────────────────────────────────

function KnotActionBar({ documented, total, hasActiveFilters, onResetFilters }) {
  return (
    <div className="knot-action-bar">
      <span className="knot-action-bar__count">
        Mine: <strong>{documented}/{total}</strong> godkjent
      </span>
      {hasActiveFilters ? (
        <button
          type="button"
          className="knot-action-bar__btn knot-action-bar__btn--ghost"
          onClick={onResetFilters}
        >
          Nullstill filtre
        </button>
      ) : null}
    </div>
  );
}

// ─── KnotsPage ────────────────────────────────────────────────────────────────

function KnotFeedbackToast({ message, isMobile = false, isRare = false }) {
  if (!message || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className={`knot-feedback-toast ${isMobile ? 'is-mobile' : 'is-desktop'} ${
        isRare ? 'is-rare' : ''
      }`}
      role="status"
      aria-live="polite"
    >
      <p>{message}</p>
    </div>,
    document.body,
  );
}

export function KnotsPage({
  currentUserActiveBans = [],
  currentUserId = null,
  currentUserPoints = 0,
  currentUserStreak = null,
  focusedKnotId,
  focusedKnotScrollRequest = 0,
  knuterSettledToken = 0,
  isPageActive = true,
  knotFeedbackMessages = {},
  knots,
  onSubmitKnot,
  submissions = [],
}) {
  const focusedKnot = focusedKnotId
    ? knots.find((k) => k.id === focusedKnotId)
    : null;

  const [activeFolder, setActiveFolder] = useState(
    () => (focusedKnot ? resolveKnotFolder(focusedKnot) : ALL_KNOTS_FOLDER_ID),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Alle');
  const [sortKey, setSortKey] = useState('standard');
  const [openDetailId, setOpenDetailId] = useState(null);
  const [openFormId, setOpenFormId] = useState(null);
  const [sheetKnotId, setSheetKnotId] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isRareFeedbackActive, setIsRareFeedbackActive] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [highlightedKnotId, setHighlightedKnotId] = useState(null);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= MOBILE_BREAKPOINT;
  });
  const normalizedFeedbackMessages = getNormalizedFeedbackMessages(knotFeedbackMessages);

  const draftsRef = useRef(drafts);
  const focusedCardRef = useRef(null);
  const knotResultsRef = useRef(null);
  const handledFocusOpenRequestRef = useRef(0);
  const handledScrollRequestRef = useRef(0);
  const folderScrollFrameRef = useRef(0);
  const highlightTimeoutRef = useRef(null);

  // ── Derived ──────────────────────────────────────────────────────────────

  const folderCounts = Object.fromEntries(
    KNOT_FOLDER_TABS.map((folder) => [
      folder.id,
      folder.id === ALL_KNOTS_FOLDER_ID
        ? knots.length
        : knots.filter((k) => resolveKnotFolder(k) === folder.id).length,
    ]),
  );
  const visibleFolder =
    KNOT_FOLDER_TABS.find((f) => f.id === activeFolder) ?? KNOT_FOLDER_TABS[0];
  const visibleFolderKnots =
    visibleFolder.id === ALL_KNOTS_FOLDER_ID
      ? knots
      : knots.filter((k) => resolveKnotFolder(k) === visibleFolder.id);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredKnots = sortKnots(
    visibleFolderKnots.filter((k) => {
      const matchesStatus =
        statusFilter === 'Alle' ||
        (statusFilter === 'Avslått'
          ? isRejectedStatus(k.status)
          : k.status === statusFilter);
      const matchesSearch =
        !normalizedQuery ||
        k.title.toLowerCase().includes(normalizedQuery) ||
        (k.description ?? '').toLowerCase().includes(normalizedQuery);
      return matchesStatus && matchesSearch;
    }),
    sortKey,
  );
  const visibleKnots =
    focusedKnotId && filteredKnots.some((k) => k.id === focusedKnotId)
      ? [
          filteredKnots.find((k) => k.id === focusedKnotId),
          ...filteredKnots.filter((k) => k.id !== focusedKnotId),
        ]
      : filteredKnots;

  const approvedCount = visibleFolderKnots.filter(
    (k) => k.status === 'Godkjent',
  ).length;
  const hasActiveFilters =
    searchQuery.trim() !== '' || statusFilter !== 'Alle' || sortKey !== 'standard';
  const activeFeedBan =
    currentUserActiveBans.find((b) => b.type === 'feed') ?? null;
  const activeSubmissionBan =
    currentUserActiveBans.find((b) => b.type === 'submission') ?? null;
  const pendingSubmissionsByKnotId = submissions
    .filter(
      (submission) =>
        submission?.status === 'Venter' &&
        (currentUserId == null || submission?.leaderId === currentUserId),
    )
    .sort(
      (left, right) =>
        new Date(right?.submittedAtRaw ?? 0).getTime() -
        new Date(left?.submittedAtRaw ?? 0).getTime(),
    )
    .reduce((acc, submission) => {
      if (!acc[submission.knotId]) {
        acc[submission.knotId] = submission;
      }
      return acc;
    }, {});

  const sheetKnot = sheetKnotId ? knots.find((k) => k.id === sheetKnotId) : null;
  const sheetDraft = sheetKnotId ? (drafts[sheetKnotId] ?? {}) : {};
  const sheetCanSubmit = sheetKnot
    ? sheetKnot.status === 'Tilgjengelig' ||
      sheetKnot.status === 'Sendt inn' ||
      isRejectedStatus(sheetKnot.status)
    : false;
  const sheetButtonLabel =
    sheetKnot?.status === 'Sendt inn'
      ? 'Oppdater innsending'
      : sheetKnot && isRejectedStatus(sheetKnot.status)
        ? 'Send til godkjenning på nytt'
        : 'Send til godkjenning';
  const streakCount = currentUserStreak?.current ?? 0;

  // ── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    function handleResize() {
      setIsMobileViewport(window.innerWidth <= MOBILE_BREAKPOINT);
    }

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!feedbackMessage) {
      return undefined;
    }

    const timeoutMs = isRareFeedbackActive
      ? RARE_FEEDBACK_TOAST_DURATION_MS
      : feedbackMessage.length > 96
        ? FEEDBACK_TOAST_DURATION_MS + 1200
        : FEEDBACK_TOAST_DURATION_MS;
    const timeoutId = window.setTimeout(() => {
      setFeedbackMessage('');
      setIsRareFeedbackActive(false);
    }, timeoutMs);

    return () => window.clearTimeout(timeoutId);
  }, [feedbackMessage, isRareFeedbackActive]);

  useEffect(() => {
    if (
      !focusedKnotId ||
      !isPageActive ||
      focusedKnotScrollRequest <= 0 ||
      handledFocusOpenRequestRef.current === focusedKnotScrollRequest
    ) {
      return;
    }

    const nextFocused = knots.find((k) => k.id === focusedKnotId);
    if (!nextFocused) return;

    handledFocusOpenRequestRef.current = focusedKnotScrollRequest;
    const t = window.setTimeout(() => {
      setActiveFolder(resolveKnotFolder(nextFocused) || ALL_KNOTS_FOLDER_ID);
      setSearchQuery('');
      setStatusFilter('Alle');
      setSortKey('standard');
      setOpenFormId(null);
      setSheetKnotId(null);
      setOpenDetailId(nextFocused.id);
      setHighlightedKnotId(nextFocused.id);
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
      highlightTimeoutRef.current = window.setTimeout(() => {
        setHighlightedKnotId((current) =>
          current === nextFocused.id ? null : current,
        );
      }, 4000);
    }, 0);
    return () => window.clearTimeout(t);
  }, [focusedKnotId, focusedKnotScrollRequest, isPageActive, knots]);

  useEffect(
    () => () => {
      if (folderScrollFrameRef.current) {
        window.cancelAnimationFrame(folderScrollFrameRef.current);
      }
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(
    () => () => {
      Object.values(draftsRef.current).forEach((d) => {
        revokeObjectUrl(d.imagePreviewUrl);
        revokeObjectUrl(d.videoPreviewUrl);
      });
    },
    [],
  );

  useEffect(() => {
    if (
      !focusedKnotId ||
      !isPageActive ||
      (isMobileViewport && knuterSettledToken < focusedKnotScrollRequest) ||
      focusedKnotScrollRequest <= 0 ||
      handledScrollRequestRef.current === focusedKnotScrollRequest
    ) {
      return;
    }

    handledScrollRequestRef.current = focusedKnotScrollRequest;
    let cancelled = false;
    let attempts = 0;
    let settledPassScheduled = false;
    const maxAttempts = isMobileViewport ? 8 : 4;
    const retryDelay = 90;
    const initialDelay = isMobileViewport ? 90 : 0;
    const timerIds = [];

    function scrollFocusedCard() {
      const element = focusedCardRef.current;
      if (!element) return false;

      const rect = element.getBoundingClientRect();
      const viewportHeight =
        typeof window !== 'undefined' ? window.innerHeight : 0;
      const topOffset = isMobileViewport
        ? Math.max(Math.round(viewportHeight * 0.27), 104)
        : 96;
      const isiOSWebKit =
        typeof navigator !== 'undefined' &&
        /iP(hone|od|ad)/i.test(navigator.userAgent ?? '');
      const scrollBehavior = isiOSWebKit ? 'auto' : 'smooth';

      if (typeof window === 'undefined') {
        element.scrollIntoView({
          behavior: scrollBehavior,
          block: isMobileViewport ? 'center' : 'start',
        });
        return true;
      }

      const currentScrollY = window.scrollY;
      const windowTargetTop = Math.max(
        Math.round(currentScrollY + rect.top - topOffset),
        0,
      );

      let scrollContainer = element.parentElement;
      while (scrollContainer && scrollContainer !== document.body) {
        const style = window.getComputedStyle(scrollContainer);
        const canScrollY = /(auto|scroll|overlay)/.test(style.overflowY);
        if (canScrollY && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
          break;
        }
        scrollContainer = scrollContainer.parentElement;
      }

      if (scrollContainer && scrollContainer !== document.body) {
        const containerRect = scrollContainer.getBoundingClientRect();
        const targetWithinContainer = Math.max(
            Math.round(
              scrollContainer.scrollTop +
                (rect.top - containerRect.top) -
                (isMobileViewport ? 40 : 16),
            ),
            0,
          );

        scrollContainer.scrollTo({
          top: targetWithinContainer,
          left: 0,
          behavior: scrollBehavior,
        });

        if (isiOSWebKit) {
          scrollContainer.scrollTop = targetWithinContainer;
        }
      } else {
        window.scrollTo({
          top: windowTargetTop,
          left: 0,
          behavior: scrollBehavior,
        });

        if (isiOSWebKit) {
          const scrollingElement =
            document.scrollingElement ?? document.documentElement;
          scrollingElement.scrollTop = windowTargetTop;
          document.documentElement.scrollTop = windowTargetTop;
          document.body.scrollTop = windowTargetTop;
        }
      }

      return true;
    }

    function tryScroll() {
      if (cancelled) return;

      const didScroll = scrollFocusedCard();
      if (didScroll) {
        if (!settledPassScheduled) {
          settledPassScheduled = true;
          const settleTimer = window.setTimeout(() => {
            if (!cancelled) {
              scrollFocusedCard();
            }
          }, isMobileViewport ? 260 : 100);
          timerIds.push(settleTimer);
        }
        return;
      }

      attempts += 1;
      if (attempts >= maxAttempts) return;

      const retryTimer = window.setTimeout(tryScroll, retryDelay);
      timerIds.push(retryTimer);
    }

    const initialTimer = window.setTimeout(tryScroll, initialDelay);
    timerIds.push(initialTimer);

    return () => {
      cancelled = true;
      timerIds.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [
    focusedKnotId,
    focusedKnotScrollRequest,
    knuterSettledToken,
    isMobileViewport,
    isPageActive,
    visibleKnots.length,
  ]);

  // ── Draft handlers ───────────────────────────────────────────────────────

  function updateDraftNote(knotId, note) {
    const normalizedNote = typeof note === 'string' ? note.slice(0, NOTE_MAX_CHARS) : '';
    setDrafts((d) => ({ ...d, [knotId]: { ...d[knotId], note: normalizedNote } }));
  }

  function updateDraftSubmissionMode(knotId, submissionMode) {
    setDrafts((d) => ({
      ...d,
      [knotId]: {
        ...d[knotId],
        submissionMode: normalizeSubmissionMode(submissionMode),
        modeTouched: true,
      },
    }));
  }

  const updateDraftFile = useCallback(async (knotId, type, file) => {
    if ((type !== 'image' && type !== 'video') || !file) return;
    const previewField = type === 'image' ? 'imagePreviewUrl' : 'videoPreviewUrl';
    const nameField = type === 'image' ? 'imageName' : 'videoName';
    const fileField = type === 'image' ? 'imageFile' : 'videoFile';
    const removeField = type === 'image' ? 'removeImage' : 'removeVideo';
    const oppositePreviewField = type === 'image' ? 'videoPreviewUrl' : 'imagePreviewUrl';
    const oppositeNameField = type === 'image' ? 'videoName' : 'imageName';
    const oppositeFileField = type === 'image' ? 'videoFile' : 'imageFile';
    const oppositeRemoveField = type === 'image' ? 'removeVideo' : 'removeImage';
    const nextPreviewUrl = URL.createObjectURL(file);

    setDrafts((d) => {
      const cur = d[knotId] ?? {};
      revokeObjectUrl(cur[previewField]);
      revokeObjectUrl(cur[oppositePreviewField]);
      return {
        ...d,
        [knotId]: {
          ...cur,
          [nameField]: file.name,
          [fileField]: file,
          [previewField]: nextPreviewUrl,
          [removeField]: false,
          [oppositeNameField]: '',
          [oppositeFileField]: undefined,
          [oppositePreviewField]: '',
          [oppositeRemoveField]: true,
        },
      };
    });
  }, []);

  function clearDraftImage(knotId) {
    setDrafts((d) => {
      const cur = d[knotId] ?? {};
      if (!cur.imagePreviewUrl && !cur.imageName && !cur.imageFile) {
        return d;
      }
      revokeObjectUrl(cur.imagePreviewUrl);
      return {
        ...d,
        [knotId]: {
          ...cur,
          imageName: '',
          imageFile: undefined,
          imagePreviewUrl: '',
          removeImage: true,
        },
      };
    });
  }

  function clearDraftVideo(knotId) {
    setDrafts((d) => {
      const cur = d[knotId] ?? {};
      if (!cur.videoPreviewUrl && !cur.videoName && !cur.videoFile) {
        return d;
      }
      revokeObjectUrl(cur.videoPreviewUrl);
      return {
        ...d,
        [knotId]: {
          ...cur,
          videoName: '',
          videoFile: undefined,
          videoPreviewUrl: '',
          removeVideo: true,
        },
      };
    });
  }

  const handlePasteImageForKnot = useCallback(async (knotId, event) => {
    if (event?.defaultPrevented) {
      return;
    }

    const pastedImage = getClipboardImageFile(event?.clipboardData);

    if (!pastedImage) {
      return;
    }

    event.preventDefault();
    const normalizedImage = normalizePastedImageFile(pastedImage);

    await updateDraftFile(knotId, 'image', normalizedImage);
    setFeedbackMessage('Bilde limt inn fra utklippstavla.');
    setIsRareFeedbackActive(false);
  }, [updateDraftFile]);

  function resetDraft(knotId) {
    setDrafts((d) => {
      const next = { ...d };
      delete next[knotId];
      return next;
    });
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit(knotId) {
    if (activeSubmissionBan) {
      setFeedbackMessage(
        `Du har innsendings-ban i ${activeSubmissionBan.remainingLabel}. Prøv igjen senere.`,
      );
      setIsRareFeedbackActive(false);
      return;
    }

    const draft = drafts[knotId] ?? {};
    const modeTouched = draft.modeTouched === true;
    const submissionMode = normalizeSubmissionMode(draft.submissionMode);
    const effectiveSubmissionMode = activeFeedBan
      ? SUBMISSION_MODE.REVIEW
      : submissionMode;
    const draftCharacterCount = getCharacterCount(draft.note ?? '');
    if (draftCharacterCount > NOTE_MAX_CHARS) {
      setFeedbackMessage(`Hold forklaringen under ${NOTE_MAX_CHARS} tegn.`);
      setIsRareFeedbackActive(false);
      return;
    }

    const knot = knots.find((k) => k.id === knotId);
    const wasPending = knot?.status === 'Sendt inn';

    try {
      const nextAppData = await onSubmitKnot(
        knotId,
        draft,
        effectiveSubmissionMode,
        { modeTouched },
      );
      resetDraft(knotId);
      setOpenFormId(null);
      setSheetKnotId(null);
      const knotTitle = knot?.title ?? 'Knuten';
      const modeLabel = getSubmissionModeLabel(effectiveSubmissionMode);
      const previousStreakQualified = currentUserStreak?.todayQualified === true;
      const nextStreakQualified = nextAppData?.currentUserStreak?.todayQualified === true;
      const hasRareMessages =
        (normalizedFeedbackMessages.rare?.length ?? 0) > 0 ||
        (DEFAULT_SUBMISSION_FEEDBACK_MESSAGES.rare?.length ?? 0) > 0;
      const shouldTriggerRare = hasRareMessages && randomChanceHit(FEEDBACK_RARE_CHANCE);
      let feedbackCategory = 'standard';

      if (shouldTriggerRare) {
        feedbackCategory = 'rare';
      } else if (wasPending) {
        feedbackCategory = 'resubmission';
      } else if (!previousStreakQualified && nextStreakQualified) {
        feedbackCategory = 'streak';
      } else if (effectiveSubmissionMode === SUBMISSION_MODE.ANONYMOUS_FEED) {
        feedbackCategory = 'anonymousFeed';
      } else if (effectiveSubmissionMode === SUBMISSION_MODE.FEED) {
        feedbackCategory = 'feed';
      }

      const fallbackByCategory = {
        standard: `"${knotTitle}" ble sendt inn for vurdering (${modeLabel}).`,
        resubmission: `"${knotTitle}" ble oppdatert. Innsendingen star fortsatt til vurdering.`,
        feed: `"${knotTitle}" ble sendt inn for vurdering (${modeLabel}).`,
        anonymousFeed: `"${knotTitle}" ble sendt inn for vurdering (${modeLabel}).`,
        streak: `"${knotTitle}" ble sendt inn. Streaken er i live.`,
        rare: `ULTRA RARE. "${knotTitle}" gikk inn med style.`,
      };
      const messagePool =
        normalizedFeedbackMessages[feedbackCategory]?.length > 0
          ? normalizedFeedbackMessages[feedbackCategory]
          : DEFAULT_SUBMISSION_FEEDBACK_MESSAGES[feedbackCategory] ??
            DEFAULT_SUBMISSION_FEEDBACK_MESSAGES.standard;
      const randomTemplate = pickRandomMessage(
        messagePool,
        fallbackByCategory[feedbackCategory] ?? fallbackByCategory.standard,
      );

      setFeedbackMessage(
        formatFeedbackTemplate(randomTemplate, {
          knotTitle,
          modeLabel,
        }) || fallbackByCategory[feedbackCategory] || fallbackByCategory.standard,
      );
      setIsRareFeedbackActive(feedbackCategory === 'rare');
    } catch (error) {
      setFeedbackMessage(
        error instanceof Error && error.message
          ? error.message
          : 'Kunne ikke sende inn knuten akkurat nå.',
      );
      setIsRareFeedbackActive(false);
    }
  }

  // ── UI handlers ──────────────────────────────────────────────────────────

  function seedDraftFromPendingSubmission(knotId) {
    const existingDraft = draftsRef.current[knotId];
    if (existingDraft) {
      return;
    }

    const pendingSubmission = pendingSubmissionsByKnotId[knotId];
    const seededDraft = buildDraftFromSubmission(pendingSubmission);
    if (!seededDraft) {
      return;
    }

    setDrafts((d) => {
      if (d[knotId]) return d;
      return {
        ...d,
        [knotId]: seededDraft,
      };
    });
  }

  function handleFolderChange(folderId) {
    setActiveFolder(folderId);
    setOpenDetailId(null);
    setOpenFormId(null);
    setSheetKnotId(null);
    scheduleScrollToKnotResults();
  }

  function scrollToKnotResults() {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const element = knotResultsRef.current;
    if (!element) {
      return;
    }

    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight || 0;
    const topOffset = isMobileViewport
      ? Math.max(Math.round(viewportHeight * 0.18), 84)
      : 88;
    const isiOSWebKit =
      typeof navigator !== 'undefined' &&
      /iP(hone|od|ad)/i.test(navigator.userAgent ?? '');
    const scrollBehavior = isiOSWebKit ? 'auto' : 'smooth';

    let scrollContainer = element.parentElement;
    while (scrollContainer && scrollContainer !== document.body) {
      const style = window.getComputedStyle(scrollContainer);
      const canScrollY = /(auto|scroll|overlay)/.test(style.overflowY);
      if (canScrollY && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
        break;
      }
      scrollContainer = scrollContainer.parentElement;
    }

    if (scrollContainer && scrollContainer !== document.body) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const targetWithinContainer = Math.max(
        Math.round(scrollContainer.scrollTop + rect.top - containerRect.top - 16),
        0,
      );

      scrollContainer.scrollTo({
        top: targetWithinContainer,
        left: 0,
        behavior: scrollBehavior,
      });

      if (isiOSWebKit) {
        scrollContainer.scrollTop = targetWithinContainer;
      }
      return;
    }

    const targetTop = Math.max(Math.round(window.scrollY + rect.top - topOffset), 0);
    window.scrollTo({
      top: targetTop,
      left: 0,
      behavior: scrollBehavior,
    });

    if (isiOSWebKit) {
      const scrollingElement = document.scrollingElement ?? document.documentElement;
      scrollingElement.scrollTop = targetTop;
      document.documentElement.scrollTop = targetTop;
      document.body.scrollTop = targetTop;
    }
  }

  function scheduleScrollToKnotResults() {
    if (typeof window === 'undefined') {
      return;
    }

    if (folderScrollFrameRef.current) {
      window.cancelAnimationFrame(folderScrollFrameRef.current);
    }

    folderScrollFrameRef.current = window.requestAnimationFrame(() => {
      folderScrollFrameRef.current = window.requestAnimationFrame(() => {
        folderScrollFrameRef.current = 0;
        scrollToKnotResults();
      });
    });
  }

  function handleResetFilters() {
    setSearchQuery('');
    setStatusFilter('Alle');
    setSortKey('standard');
  }

  function handleDocumentClick(knotId) {
    if (isMobileViewport) {
      setSheetKnotId((current) => {
        const next = current === knotId ? null : knotId;
        if (next) {
          seedDraftFromPendingSubmission(next);
        }
        return next;
      });
    } else {
      setOpenFormId((current) => {
        const next = current === knotId ? null : knotId;
        if (next) {
          seedDraftFromPendingSubmission(next);
        }
        return next;
      });
    }
  }

  function handleToggleDetail(knotId) {
    setOpenDetailId((current) => (current === knotId ? null : knotId));
  }

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      isMobileViewport ||
      !isPageActive ||
      !openFormId
    ) {
      return undefined;
    }

    const onWindowPaste = (event) => {
      void handlePasteImageForKnot(openFormId, event);
    };

    window.addEventListener('paste', onWindowPaste);
    return () => {
      window.removeEventListener('paste', onWindowPaste);
    };
  }, [handlePasteImageForKnot, isMobileViewport, isPageActive, openFormId]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={`knots-page${isMobileViewport ? ' knots-page--mobile' : ''}`}>
      <KnotFeedbackToast
        message={feedbackMessage}
        isMobile={isMobileViewport}
        isRare={isRareFeedbackActive}
      />

      <section className="knots-page__hero" aria-labelledby="knots-page-title">
        <div className="knots-page__hero-copy">
          <p className="knots-page__eyebrow">Knutekatalog · {knots.length} knuter</p>
          <h1 id="knots-page-title" className="knots-page__title font-display">
            Hva tar du <span className="knots-page__title-highlight">i dag?</span>
          </h1>
          <div className="knots-status-legend" aria-label="Fargeforklaring for knutestatus">
            {STATUS_LEGEND_ITEMS.map((item) => (
              <span
                key={item.key}
                className={`knots-status-legend__item is-${item.key}`}
              >
                {item.label}
              </span>
            ))}
          </div>
        </div>

        <div className="knots-page__points sticker">
          <small>Dine poeng</small>
          <span>{currentUserPoints}p</span>
        </div>

        {streakCount > 0 ? (
          <div className="knots-page__hero-streak sticker">
            <span aria-hidden="true">🔥</span>
            <span>{streakCount} streak</span>
          </div>
        ) : null}
      </section>

      {/* Progress */}
      <KnotProgressBar
        label={visibleFolder.id}
        approved={approvedCount}
        total={visibleFolderKnots.length}
      />

      {/* Folder tabs */}
      <KnotFolderTabs
        folders={KNOT_FOLDER_TABS}
        activeFolder={activeFolder}
        folderCounts={folderCounts}
        onChangeFolder={handleFolderChange}
      />

      {/* Compact toolbar */}
      <div className="knot-toolbar-compact">
        <input
          type="search"
          className="knot-toolbar-compact__search text-input"
          placeholder={`Søk i ${visibleFolder.id.toLowerCase()}…`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className="knot-toolbar-compact__status-pills" role="group" aria-label="Statusfilter">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              className={`knot-status-pill${statusFilter === filter ? ' is-active' : ''}`}
              aria-pressed={statusFilter === filter}
              onClick={() => setStatusFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
        <select
          className="knot-toolbar-compact__select knot-toolbar-compact__select--status text-input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Statusfilter"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          className="knot-toolbar-compact__select text-input"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value)}
          aria-label="Sortering"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Feedback & ban banners */}
      {activeSubmissionBan ? (
        <div className="inline-feedback">
          <p>
            Innsendinger er midlertidig blokkert i {activeSubmissionBan.remainingLabel}.
          </p>
        </div>
      ) : null}
      {activeFeedBan ? (
        <div className="inline-feedback">
          <p>
            Feed-posting er blokkert i {activeFeedBan.remainingLabel}. Du kan fortsatt
            sende til godkjenning.
          </p>
        </div>
      ) : null}

      {/* Empty states */}
      {visibleFolderKnots.length === 0 ? (
        <p ref={knotResultsRef} className="folder-empty">
          Det ligger ingen knuter i denne mappen ennå.
        </p>
      ) : null}
      {visibleFolderKnots.length > 0 && visibleKnots.length === 0 ? (
        <div ref={knotResultsRef} className="filter-empty-state">
          <h3>Ingen knuter matcher søket ditt</h3>
          <p>
            Prøv et annet søk, bytt statusfilter eller nullstill filtrene for å se hele
            mappen igjen.
          </p>
          <button
            type="button"
            className="action-button action-button--sticker action-button--compact"
            onClick={handleResetFilters}
          >
            Nullstill filtre
          </button>
        </div>
      ) : null}

      {/* Knot list */}
      {visibleKnots.length > 0 ? (
        <div ref={knotResultsRef} className="knot-list">
          {visibleKnots.map((knot) => {
            const canSubmit =
              knot.status === 'Tilgjengelig' ||
              knot.status === 'Sendt inn' ||
              isRejectedStatus(knot.status);
            const buttonLabel =
              knot.status === 'Sendt inn'
                ? 'Oppdater innsending'
                : isRejectedStatus(knot.status)
                  ? 'Send til godkjenning på nytt'
                  : 'Send til godkjenning';
            const draft = drafts[knot.id] ?? {};

            return (
              <KnotRow
                key={knot.id}
                knot={knot}
                isDetailOpen={openDetailId === knot.id}
                isHighlighted={highlightedKnotId === knot.id}
                isFormOpen={openFormId === knot.id}
                isMobile={isMobileViewport}
                canSubmit={canSubmit}
                buttonLabel={buttonLabel}
                draft={draft}
                activeFeedBan={activeFeedBan}
                activeSubmissionBan={activeSubmissionBan}
                focusedRef={knot.id === focusedKnotId ? focusedCardRef : null}
                onToggleDetail={() => handleToggleDetail(knot.id)}
                onDocumentClick={() => handleDocumentClick(knot.id)}
                onUpdateNote={(note) => updateDraftNote(knot.id, note)}
                onUpdateMode={(mode) => updateDraftSubmissionMode(knot.id, mode)}
                onUpdateFile={(type, file) => updateDraftFile(knot.id, type, file)}
                onRemoveImage={() => clearDraftImage(knot.id)}
                onRemoveVideo={() => clearDraftVideo(knot.id)}
                onPasteImage={(event) => {
                  void handlePasteImageForKnot(knot.id, event);
                }}
                showDesktopPasteHint={!isMobileViewport}
                onSubmit={() => handleSubmit(knot.id)}
              />
            );
          })}
        </div>
      ) : null}

      {/* Mobile bottom sheet */}
      <KnotBottomSheet
        knot={sheetKnot}
        draft={sheetDraft}
        canSubmit={sheetCanSubmit}
        buttonLabel={sheetButtonLabel}
        activeFeedBan={activeFeedBan}
        activeSubmissionBan={activeSubmissionBan}
        isOpen={Boolean(sheetKnotId)}
        onClose={() => setSheetKnotId(null)}
        onUpdateNote={(note) => sheetKnotId && updateDraftNote(sheetKnotId, note)}
        onUpdateMode={(mode) =>
          sheetKnotId && updateDraftSubmissionMode(sheetKnotId, mode)
        }
        onUpdateFile={(type, file) =>
          sheetKnotId && updateDraftFile(sheetKnotId, type, file)
        }
        onRemoveImage={() => {
          if (sheetKnotId) {
            clearDraftImage(sheetKnotId);
          }
        }}
        onRemoveVideo={() => {
          if (sheetKnotId) {
            clearDraftVideo(sheetKnotId);
          }
        }}
        onPasteImage={(event) => {
          if (sheetKnotId) {
            void handlePasteImageForKnot(sheetKnotId, event);
          }
        }}
        onSubmit={() => sheetKnotId && handleSubmit(sheetKnotId)}
      />

      {/* Fixed action bar */}
      {isMobileViewport ? (
        <KnotActionBar
          documented={approvedCount}
          total={visibleFolderKnots.length}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={handleResetFilters}
        />
      ) : null}
    </div>
  );
}
