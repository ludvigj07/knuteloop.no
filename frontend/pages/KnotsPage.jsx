import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isGoldKnot } from '../data/badgeSystem.js';
import { KNOT_FOLDERS, resolveKnotFolder } from '../data/knotFolders.js';

const MOBILE_BREAKPOINT = 900;

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

// ─── Utility functions ────────────────────────────────────────────────────────

function isRejectedStatus(status) {
  return status === 'Avslått' || status === 'Avslaatt';
}

function getWordCount(text) {
  const trimmedText = text.trim();
  if (!trimmedText) return 0;
  return trimmedText.split(/\s+/).length;
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
    submissionMode: normalizeSubmissionMode(submission.submissionMode),
  };
}

function getStatusDotClass(status) {
  if (status === 'Godkjent') return 'is-approved';
  if (status === 'Sendt inn') return 'is-pending';
  if (isRejectedStatus(status)) return 'is-rejected';
  return 'is-available';
}
function getStatusKey(status) {
  if (status === 'Godkjent') return 'approved';
  if (status === 'Sendt inn') return 'pending';
  if (isRejectedStatus(status)) return 'rejected';
  return 'available';
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
    <div className="knot-folder-tabs" role="tablist">
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
  wordCount,
  isOverWordLimit,
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
          placeholder="Kort forklaring på hvordan knuten ble gjort. Maks 100 ord."
          value={draft.note ?? ''}
          onChange={(e) => onUpdateNote(e.target.value)}
        />
        <span className={`word-counter ${isOverWordLimit ? 'is-invalid' : ''}`}>
          {wordCount}/100 ord
        </span>
      </label>

      <div className="submission-mode-options">
        <label
          className="submission-mode-checkbox"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: activeFeedBan ? 'not-allowed' : 'pointer' }}
        >
          <input
            type="checkbox"
            checked={shareToFeed || shareToAnonymousFeed}
            disabled={Boolean(activeFeedBan)}
            onChange={(event) => {
              if (event.target.checked) {
                onUpdateMode(SUBMISSION_MODE.FEED);
              } else {
                onUpdateMode(SUBMISSION_MODE.REVIEW);
              }
            }}
          />
          <span>Del detaljer med feeden (bilde og beskrivelse vises)</span>
        </label>
        {shareToFeed || shareToAnonymousFeed ? (
          <label
            className="submission-mode-checkbox"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', cursor: activeFeedBan ? 'not-allowed' : 'pointer', paddingLeft: '1.5rem' }}
          >
            <input
              type="checkbox"
              checked={shareToAnonymousFeed}
              disabled={Boolean(activeFeedBan)}
              onChange={(event) => {
                onUpdateMode(
                  event.target.checked
                    ? SUBMISSION_MODE.ANONYMOUS_FEED
                    : SUBMISSION_MODE.FEED,
                );
              }}
            />
            <span>Post anonymt</span>
          </label>
        ) : null}
      </div>

      {activeFeedBan ? (
        <p className="submission-mode-hint">
          {`Feed-posting er blokkert i ${activeFeedBan.remainingLabel}. Innsending går kun til godkjenning.`}
        </p>
      ) : null}

      <div className="submission-upload-grid">
        <div className="upload-field upload-field--compact">
          <span>{showDesktopPasteHint ? 'Bilde' : 'Last opp bilde'}</span>

          {showDesktopPasteHint ? (
            <>
              <div className="upload-file-row">
                <input
                  type="file"
                  accept="image/*"
                  className="upload-file-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    onUpdateFile('image', file);
                    e.target.value = '';
                  }}
                />
                <span className="upload-file-name">{draft.imageName || 'Ingen fil valgt'}</span>
                <button
                  type="button"
                  className="upload-remove-btn"
                  onClick={onRemoveImage}
                  disabled={!hasImage}
                >
                  Slett bilde
                </button>
              </div>
              <input
                type="text"
                readOnly
                className="upload-paste-target"
                value="Lim inn bilde i boksen (Ctrl+V)"
                aria-label="Lim inn bilde i boksen med Ctrl+V"
                onPaste={onPasteImage}
              />
            </>
          ) : (
            <>
              <div className="upload-capture-row" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <label className="action-button action-button--ghost" style={{ cursor: 'pointer' }}>
                  Ta bilde
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                    onChange={handleImageInputChange}
                  />
                </label>
                <label className="action-button action-button--ghost" style={{ cursor: 'pointer' }}>
                  Velg fra galleri
                  <input
                    type="file"
                    accept="image/*"
                    style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                    onChange={handleImageInputChange}
                  />
                </label>
              </div>
              <small>{draft.imageName || 'Valgfritt bildebevis'}</small>
              <button
                type="button"
                className="upload-remove-btn upload-remove-btn--mobile"
                onClick={onRemoveImage}
                disabled={!hasImage}
              >
                Slett bilde
              </button>
            </>
          )}
        </div>

        <div className="upload-field upload-field--compact">
          <span>Last opp video (maks 20 sek, 30 MB)</span>
          <div className="upload-capture-row" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <label className="action-button action-button--ghost" style={{ cursor: 'pointer' }}>
              Ta video
              <input
                type="file"
                accept="video/*"
                capture="environment"
                style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                onChange={handleVideoInputChange}
              />
            </label>
            <label className="action-button action-button--ghost" style={{ cursor: 'pointer' }}>
              Velg video
              <input
                type="file"
                accept="video/*"
                style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                onChange={handleVideoInputChange}
              />
            </label>
          </div>
          <small>{draft.videoName || 'Valgfritt videobevis'}</small>
          <button
            type="button"
            className="upload-remove-btn upload-remove-btn--mobile"
            onClick={onRemoveVideo}
            disabled={!hasVideo}
          >
            Slett video
          </button>
        </div>
      </div>

      {draft.imagePreviewUrl || draft.videoPreviewUrl ? (
        <div className="submission-preview-grid">
          {draft.imagePreviewUrl ? (
            <div className="evidence-card">
              <span>Bildepreview</span>
              <img src={draft.imagePreviewUrl} alt="Bevis" />
            </div>
          ) : null}
          {draft.videoPreviewUrl ? (
            <div className="evidence-card">
              <span>Videopreview</span>
              <video src={draft.videoPreviewUrl} controls preload="metadata" playsInline muted />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="submission-form__actions">
        <button
          type="button"
          className="action-button"
          disabled={isOverWordLimit || Boolean(activeSubmissionBan)}
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
  const wordCount = getWordCount(draft.note ?? '');
  const isOverWordLimit = wordCount > 100;
  const isCompletedKnot = knot.status === 'Godkjent' || knot.status === 'Fullført';

  return (
    <div
      ref={focusedRef}
      className={`knot-row${isCompletedKnot ? ' is-completed' : ''}${isDetailOpen ? ' is-detail-open' : ''}${isFormOpen ? ' is-form-open' : ''}`}
      data-status={getStatusKey(knot.status)}
    >
      <div className="knot-row__header">
        <div className="knot-row__info">
          <div className="knot-row__title-line">
            <span className={`knot-row__points${isCompletedKnot ? ' is-completed' : ''}`}>
              P{knot.points}
            </span>
            <span className="knot-row__title">{knot.title}</span>
            {knot.status === 'Sendt inn' ? (
              <span className="pill pill--warning pill--sm">Sendt</span>
            ) : null}
          </div>
        </div>

        <div className="knot-row__cta">
          {canSubmit ? (
            <button
              type="button"
              className={`knot-row__doc-btn${isFormOpen ? ' is-active' : ''}`}
              disabled={Boolean(activeSubmissionBan) && !isFormOpen}
              onClick={onDocumentClick}
              aria-label={isMobile ? 'Registrering' : undefined}
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
                <span className="knot-row__doc-btn-label">Registrering</span>
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
            wordCount={wordCount}
            isOverWordLimit={isOverWordLimit}
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
  const wordCount = getWordCount(draft.note ?? '');
  const isOverWordLimit = wordCount > 100;

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
      >
        <div className="knot-sheet__handle-area" aria-hidden="true">
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
              wordCount={wordCount}
              isOverWordLimit={isOverWordLimit}
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

export function KnotsPage({
  currentUserActiveBans = [],
  currentUserId = null,
  currentUserPoints = 0,
  focusedKnotId,
  focusedKnotScrollRequest = 0,
  isPageActive = true,
  knots,
  onSubmitKnot,
  submissions = [],
}) {
  const focusedKnot = focusedKnotId
    ? knots.find((k) => k.id === focusedKnotId)
    : null;

  const [activeFolder, setActiveFolder] = useState(
    () => resolveKnotFolder(focusedKnot) || KNOT_FOLDERS[0].id,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Alle');
  const [sortKey, setSortKey] = useState('standard');
  const [openDetailId, setOpenDetailId] = useState(null);
  const [openFormId, setOpenFormId] = useState(null);
  const [sheetKnotId, setSheetKnotId] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [drafts, setDrafts] = useState({});
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= MOBILE_BREAKPOINT;
  });

  const draftsRef = useRef(drafts);
  const focusedCardRef = useRef(null);
  const handledScrollRequestRef = useRef(0);

  // ── Derived ──────────────────────────────────────────────────────────────

  const folderCounts = Object.fromEntries(
    KNOT_FOLDERS.map((folder) => [
      folder.id,
      knots.filter((k) => resolveKnotFolder(k) === folder.id).length,
    ]),
  );
  const visibleFolder =
    KNOT_FOLDERS.find((f) => f.id === activeFolder) ?? KNOT_FOLDERS[0];
  const visibleFolderKnots = knots.filter(
    (k) => resolveKnotFolder(k) === visibleFolder.id,
  );
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
        k.description.toLowerCase().includes(normalizedQuery);
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
    if (!focusedKnotId || !isPageActive) return;
    const nextFocused = knots.find((k) => k.id === focusedKnotId);
    if (!nextFocused) return;
    const t = window.setTimeout(() => {
      setActiveFolder(resolveKnotFolder(nextFocused) || KNOT_FOLDERS[0].id);
      setSearchQuery('');
      setStatusFilter('Alle');
      setSortKey('standard');
      setOpenDetailId(null);
    }, 0);
    return () => window.clearTimeout(t);
  }, [focusedKnotId, isPageActive, knots]);

  useEffect(
    () => () => {
      Object.values(draftsRef.current).forEach((d) => {
        revokeObjectUrl(d.imagePreviewUrl);
      });
    },
    [],
  );

  useEffect(() => {
    if (
      !focusedKnotId ||
      !focusedCardRef.current ||
      !isPageActive ||
      focusedKnotScrollRequest <= 0 ||
      handledScrollRequestRef.current === focusedKnotScrollRequest
    ) {
      return;
    }

    handledScrollRequestRef.current = focusedKnotScrollRequest;
    const delay = isMobileViewport ? 280 : 0;
    const t = window.setTimeout(() => {
      focusedCardRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: isMobileViewport ? 'center' : 'start',
      });
    }, delay);
    return () => window.clearTimeout(t);
  }, [
    focusedKnotId,
    focusedKnotScrollRequest,
    isMobileViewport,
    isPageActive,
    visibleKnots.length,
  ]);

  // ── Draft handlers ───────────────────────────────────────────────────────

  function updateDraftNote(knotId, note) {
    setDrafts((d) => ({ ...d, [knotId]: { ...d[knotId], note } }));
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

  async function updateDraftFile(knotId, type, file) {
    if (!file) return;
    if (type !== 'image' && type !== 'video') return;
    const nextPreviewUrl = URL.createObjectURL(file);

    setDrafts((d) => {
      const cur = d[knotId] ?? {};
      if (type === 'image') {
        revokeObjectUrl(cur.imagePreviewUrl);
        return {
          ...d,
          [knotId]: {
            ...cur,
            imageName: file.name,
            imageFile: file,
            imagePreviewUrl: nextPreviewUrl,
            removeImage: false,
          },
        };
      }
      revokeObjectUrl(cur.videoPreviewUrl);
      return {
        ...d,
        [knotId]: {
          ...cur,
          videoName: file.name,
          videoFile: file,
          videoPreviewUrl: nextPreviewUrl,
          removeVideo: false,
        },
      };
    });
  }

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

  async function handlePasteImageForKnot(knotId, event) {
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
  }

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
      return;
    }

    const draft = drafts[knotId] ?? {};
    const modeTouched = draft.modeTouched === true;
    const submissionMode = normalizeSubmissionMode(draft.submissionMode);
    const effectiveSubmissionMode = activeFeedBan
      ? SUBMISSION_MODE.REVIEW
      : submissionMode;
    const knot = knots.find((k) => k.id === knotId);
    const wasPending = knot?.status === 'Sendt inn';

    try {
      await onSubmitKnot(knotId, draft, effectiveSubmissionMode, { modeTouched });
      resetDraft(knotId);
      setOpenFormId(null);
      setSheetKnotId(null);
      if (wasPending) {
        setFeedbackMessage(
          `"${knot?.title ?? 'Knuten'}" ble oppdatert. Innsendingen står fortsatt til vurdering.`,
        );
      } else {
        setFeedbackMessage(
          `"${knot?.title ?? 'Knuten'}" ble sendt inn for vurdering (${getSubmissionModeLabel(effectiveSubmissionMode)}).`,
        );
      }
    } catch (error) {
      setFeedbackMessage(
        error instanceof Error && error.message
          ? error.message
          : 'Kunne ikke sende inn knuten akkurat nå.',
      );
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
  }, [isMobileViewport, isPageActive, openFormId]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={`knots-page${isMobileViewport ? ' knots-page--mobile' : ''}`}>
      {/* Header */}
      <div className="knots-page__header">
        <div>
          <h2>Knutekatalog</h2>
          <p>Velg en knute, del det du har gjort, og følg progresjon.</p>
        </div>
        <div className="knots-page__points">
          <span>{currentUserPoints}</span>
          <small>poeng</small>
        </div>
      </div>

      {/* Progress */}
      <KnotProgressBar
        label={visibleFolder.id}
        approved={approvedCount}
        total={visibleFolderKnots.length}
      />

      {/* Folder tabs */}
      <KnotFolderTabs
        folders={KNOT_FOLDERS}
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
        <select
          className="knot-toolbar-compact__select text-input"
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
      {feedbackMessage ? (
        <div className="inline-feedback" role="status">
          <p>{feedbackMessage}</p>
          <button
            type="button"
            className="action-button action-button--ghost action-button--compact"
            onClick={() => setFeedbackMessage('')}
          >
            Lukk
          </button>
        </div>
      ) : null}
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
        <p className="folder-empty">Det ligger ingen knuter i denne mappen ennå.</p>
      ) : null}
      {visibleFolderKnots.length > 0 && visibleKnots.length === 0 ? (
        <div className="filter-empty-state">
          <h3>Ingen knuter matcher søket ditt</h3>
          <p>
            Prøv et annet søk, bytt statusfilter eller nullstill filtrene for å se hele
            mappen igjen.
          </p>
          <button
            type="button"
            className="action-button action-button--ghost action-button--compact"
            onClick={handleResetFilters}
          >
            Nullstill filtre
          </button>
        </div>
      ) : null}

      {/* Knot list */}
      {visibleKnots.length > 0 ? (
        <div className="knot-list">
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
