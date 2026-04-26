import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Image as ImageIcon, Video, X } from 'lucide-react';
import { MobileVideo } from './MobileVideo.jsx';

const MAX_DUEL_NOTE_WORDS = 100;
const SUBMISSION_MODE = {
  REVIEW: 'review',
  FEED: 'feed',
  ANONYMOUS_FEED: 'anonymous-feed',
};

function getWordCount(text) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function revokeObjectUrl(url) {
  if (!url || typeof URL === 'undefined') return;
  URL.revokeObjectURL(url);
}

// Bottom-sheet for å registrere bevis på en knute-off. Glir opp fra
// bunn med VS-kort i miniatyr på toppen, så fokus-skjema for notat,
// feed-toggles og bilde/video-opplasting. Lukk via tap på backdrop,
// X-knapp eller swipe ned (TODO).
export function DuelEvidenceSheet({
  duel,
  currentUserId,
  isOpen,
  onClose,
  onSubmit,
  feedBanned,
  submissionBanned,
  submissionBanLabel,
}) {
  const [note, setNote] = useState('');
  const [submissionMode, setSubmissionMode] = useState(SUBMISSION_MODE.FEED);
  const [imageFile, setImageFile] = useState(null);
  const [imageName, setImageName] = useState('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [videoName, setVideoName] = useState('');
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const previewsRef = useRef({ image: '', video: '' });

  useEffect(() => {
    previewsRef.current = { image: imagePreviewUrl, video: videoPreviewUrl };
  }, [imagePreviewUrl, videoPreviewUrl]);

  useEffect(() => {
    if (!isOpen) {
      // Rens preview-URLer når sheet lukker.
      revokeObjectUrl(previewsRef.current.image);
      revokeObjectUrl(previewsRef.current.video);
      setNote('');
      setSubmissionMode(SUBMISSION_MODE.FEED);
      setImageFile(null);
      setImageName('');
      setImagePreviewUrl('');
      setVideoFile(null);
      setVideoName('');
      setVideoPreviewUrl('');
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  useEffect(
    () => () => {
      revokeObjectUrl(previewsRef.current.image);
      revokeObjectUrl(previewsRef.current.video);
    },
    [],
  );

  if (!isOpen || !duel || typeof document === 'undefined') return null;

  const wordCount = getWordCount(note);
  const isOverLimit = wordCount > MAX_DUEL_NOTE_WORDS;
  const isChallenger = duel.challengerId === currentUserId;
  const opponentName = isChallenger ? duel.opponentName : duel.challengerName;
  const effectiveMode = feedBanned ? SUBMISSION_MODE.REVIEW : submissionMode;
  const shareToFeed = effectiveMode === SUBMISSION_MODE.FEED;
  const shareAnonymously = effectiveMode === SUBMISSION_MODE.ANONYMOUS_FEED;

  function handlePickImage(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || typeof URL === 'undefined') return;
    revokeObjectUrl(imagePreviewUrl);
    const url = URL.createObjectURL(file);
    setImageFile(file);
    setImageName(file.name);
    setImagePreviewUrl(url);
  }

  function handlePickVideo(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || typeof URL === 'undefined') return;
    revokeObjectUrl(videoPreviewUrl);
    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoName(file.name);
    setVideoPreviewUrl(url);
  }

  async function handleSubmit() {
    if (isOverLimit) {
      setError(`Hold notatet under ${MAX_DUEL_NOTE_WORDS} ord.`);
      return;
    }
    if (submissionBanned) {
      setError(
        `Du har innsendings-ban i ${submissionBanLabel ?? 'en periode'}. Kan ikke registrere nå.`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onSubmit?.({
        note,
        submissionMode: effectiveMode,
        imageFile,
        imageName,
        imagePreviewUrl,
        videoFile,
        videoName,
        videoPreviewUrl,
      });
      if (result?.ok) {
        onClose?.();
      } else if (result?.message) {
        setError(result.message);
      }
    } catch (err) {
      setError(err?.message ?? 'Noe gikk galt — prøv igjen.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return createPortal(
    <div
      className="duel-sheet-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className="duel-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="duel-sheet-title"
        data-swipe-lock="true"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="duel-sheet__handle" aria-hidden="true" />

        <div className="duel-sheet__header">
          <div>
            <p className="duel-sheet__eyebrow">Knute-off</p>
            <h3 id="duel-sheet-title">vs. {opponentName}</h3>
            <p className="duel-sheet__knot">{duel.knotTitle}</p>
          </div>
          <button
            type="button"
            className="duel-sheet__close"
            onClick={onClose}
            aria-label="Lukk"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        {error ? <div className="duel-sheet__error">{error}</div> : null}

        <label className="field-group">
          <span>Kort notat</span>
          <textarea
            className="text-input text-input--area"
            placeholder="Hva gjorde du, og hva bør admin se etter?"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
          />
          <small className={`word-counter ${isOverLimit ? 'is-invalid' : ''}`}>
            {wordCount}/{MAX_DUEL_NOTE_WORDS} ord
          </small>
        </label>

        <div className="duel-sheet__feed-toggles">
          <label className="submission-mode-option">
            <input
              type="checkbox"
              checked={shareToFeed}
              disabled={feedBanned}
              onChange={(event) =>
                setSubmissionMode(
                  event.target.checked ? SUBMISSION_MODE.FEED : SUBMISSION_MODE.REVIEW,
                )
              }
            />
            <span>Del i feed</span>
          </label>
          <label className="submission-mode-option">
            <input
              type="checkbox"
              checked={shareAnonymously}
              disabled={feedBanned}
              onChange={(event) =>
                setSubmissionMode(
                  event.target.checked
                    ? SUBMISSION_MODE.ANONYMOUS_FEED
                    : SUBMISSION_MODE.REVIEW,
                )
              }
            />
            <span>Post anonymt</span>
          </label>
        </div>

        <div className="duel-sheet__upload-row">
          <label className="duel-sheet__upload">
            <input type="file" accept="image/*" onChange={handlePickImage} hidden />
            <span className="duel-sheet__upload-icon" aria-hidden="true">
              <ImageIcon size={20} strokeWidth={1.8} />
            </span>
            <span className="duel-sheet__upload-label">
              {imageName ? imageName : 'Bilde'}
            </span>
          </label>
          <label className="duel-sheet__upload">
            <input type="file" accept="video/mp4,video/quicktime,video/x-m4v" onChange={handlePickVideo} hidden />
            <span className="duel-sheet__upload-icon" aria-hidden="true">
              <Video size={20} strokeWidth={1.8} />
            </span>
            <span className="duel-sheet__upload-label">
              {videoName ? videoName : 'Video'}
            </span>
          </label>
        </div>

        {imagePreviewUrl || videoPreviewUrl ? (
          <div className="duel-sheet__preview-grid">
            {imagePreviewUrl ? (
              <div className="duel-sheet__preview">
                <img src={imagePreviewUrl} alt="Valgt bevis" />
              </div>
            ) : null}
            {videoPreviewUrl ? (
              <div className="duel-sheet__preview">
                <MobileVideo controls autoPlay muted loop src={videoPreviewUrl} />
              </div>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          className="duel-sheet__submit"
          disabled={isOverLimit || submissionBanned || isSubmitting}
          onClick={handleSubmit}
        >
          <Camera size={18} strokeWidth={2} aria-hidden="true" />
          <span>{isSubmitting ? 'Registrerer...' : 'Registrer fullført'}</span>
        </button>
      </div>
    </div>,
    document.body,
  );
}
