import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Crown,
  Eye,
  Gavel,
  Lock,
  RotateCcw,
  Search,
  Shield,
  ShieldCheck,
  Swords,
  Trash2,
  Trophy,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { MobileVideo } from './MobileVideo.jsx';

const FILTER_OPTIONS = [
  { id: 'ready', label: 'Klar' },
  { id: 'pending', label: 'Pågående' },
  { id: 'reverted', label: 'Reversert' },
  { id: 'mine', label: 'Mine' },
  { id: 'all', label: 'Alle' },
];

function getDuelEvidence(duel, side) {
  if (side === 'challenger') {
    return {
      participantId: duel.challengerId,
      name: duel.challengerName,
      photoUrl: duel.challengerPhotoUrl,
      icon: duel.challengerIcon,
      completedAt: duel.challengerCompletedAt,
      approved: duel.challengerCompletionApproved,
      statusLabel: duel.challengerStatusLabel,
      note: duel.challengerNote ?? '',
      imageName: duel.challengerImageName ?? '',
      imagePreviewUrl: duel.challengerImagePreviewUrl ?? '',
      videoName: duel.challengerVideoName ?? '',
      videoPreviewUrl: duel.challengerVideoPreviewUrl ?? '',
    };
  }
  return {
    participantId: duel.opponentId,
    name: duel.opponentName,
    photoUrl: duel.opponentPhotoUrl,
    icon: duel.opponentIcon,
    completedAt: duel.opponentCompletedAt,
    approved: duel.opponentCompletionApproved,
    statusLabel: duel.opponentStatusLabel,
    note: duel.opponentNote ?? '',
    imageName: duel.opponentImageName ?? '',
    imagePreviewUrl: duel.opponentImagePreviewUrl ?? '',
    videoName: duel.opponentVideoName ?? '',
    videoPreviewUrl: duel.opponentVideoPreviewUrl ?? '',
  };
}

function formatRelative(timestampIso) {
  if (!timestampIso) return null;
  const ts = new Date(timestampIso).getTime();
  if (!Number.isFinite(ts)) return null;
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'akkurat nå';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m siden`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}t siden`;
  return `${Math.floor(diff / 86_400_000)}d siden`;
}

function formatRemaining(millisToDeadline) {
  if (millisToDeadline == null) return null;
  if (millisToDeadline <= 0) return 'utløpt';
  const m = Math.floor(millisToDeadline / 60_000);
  if (m < 60) return `${m}m igjen`;
  const h = Math.floor(m / 60);
  const remainingMinutes = m % 60;
  if (h < 24) return `${h}t ${remainingMinutes}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}t`;
}

function StatusPill({ icon: Icon, label, tone }) {
  return (
    <span className={`adh-status-pill adh-status-pill--${tone}`}>
      <Icon size={12} strokeWidth={2} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

function ParticipantStatus({ evidence }) {
  if (evidence.approved === false) {
    return <StatusPill icon={AlertTriangle} label="Reversert" tone="reverted" />;
  }
  if (evidence.completedAt) {
    return <StatusPill icon={CheckCircle2} label="Levert" tone="done" />;
  }
  return <StatusPill icon={Clock} label="Mangler" tone="pending" />;
}

function HeroStat({ Icon, value, label, tone }) {
  return (
    <div className={`adh-stat adh-stat--${tone}`}>
      <span className="adh-stat__icon" aria-hidden="true">
        <Icon size={20} strokeWidth={1.8} />
      </span>
      <strong className="adh-stat__value">{value}</strong>
      <span className="adh-stat__label">{label}</span>
    </div>
  );
}

function QueueRow({
  duel,
  isSelected,
  isLocked,
  isLockedByMe,
  isLockedByOther,
  lastReviewedRelative,
  onOpen,
}) {
  const challenger = getDuelEvidence(duel, 'challenger');
  const opponent = getDuelEvidence(duel, 'opponent');
  const remaining = formatRemaining(duel.millisToDeadline);
  const urgent = duel.isUrgent && !duel.deadlinePassed;
  const expired = duel.deadlinePassed;

  return (
    <button
      type="button"
      className={`adh-row${isSelected ? ' is-selected' : ''}${
        isLockedByOther ? ' is-locked-other' : ''
      }`}
      onClick={onOpen}
      disabled={isLockedByOther}
      aria-pressed={isSelected}
    >
      <div className="adh-row__main">
        <div className="adh-row__title">
          <strong>{duel.knotTitle}</strong>
          {duel.readyForResolution ? (
            <span className="adh-row__ready" aria-hidden="true">
              <Gavel size={12} strokeWidth={2} />
            </span>
          ) : null}
        </div>
        <div className="adh-row__participants">
          <span className="adh-row__name">{challenger.name}</span>
          <ParticipantStatus evidence={challenger} />
          <span className="adh-row__vs" aria-hidden="true">vs</span>
          <span className="adh-row__name">{opponent.name}</span>
          <ParticipantStatus evidence={opponent} />
        </div>
        <div className="adh-row__meta">
          {expired ? (
            <span className="adh-row__deadline adh-row__deadline--expired">
              <Clock size={12} strokeWidth={2} aria-hidden="true" />
              <span>Frist utløpt</span>
            </span>
          ) : remaining ? (
            <span
              className={`adh-row__deadline${
                urgent ? ' adh-row__deadline--urgent' : ''
              }`}
            >
              <Clock size={12} strokeWidth={2} aria-hidden="true" />
              <span>{remaining}</span>
            </span>
          ) : null}
          {isLocked && isLockedByMe ? (
            <span className="adh-row__lock adh-row__lock--mine">
              <Lock size={12} strokeWidth={2} aria-hidden="true" />
              <span>Du sjekker</span>
            </span>
          ) : isLockedByOther ? (
            <span className="adh-row__lock adh-row__lock--other">
              <Lock size={12} strokeWidth={2} aria-hidden="true" />
              <span>{duel.lockedByAdminName ?? 'Annen admin'} sjekker</span>
            </span>
          ) : lastReviewedRelative && duel.lastReviewedByAdminName ? (
            <span className="adh-row__seen">
              <Eye size={12} strokeWidth={2} aria-hidden="true" />
              <span>
                {duel.lastReviewedByAdminName} {lastReviewedRelative}
              </span>
            </span>
          ) : null}
        </div>
      </div>
      <ChevronRight size={18} strokeWidth={1.8} className="adh-row__chevron" aria-hidden="true" />
    </button>
  );
}

function EvidencePanel({ evidence }) {
  return (
    <div className="adh-evidence">
      <div className="adh-evidence__header">
        {evidence.photoUrl ? (
          <div className="adh-evidence__avatar">
            <img src={evidence.photoUrl} alt={`${evidence.name} profilbilde`} />
          </div>
        ) : (
          <div className="adh-evidence__avatar adh-evidence__avatar--empty">
            {evidence.icon ?? '🪢'}
          </div>
        )}
        <div className="adh-evidence__name-block">
          <strong>{evidence.name}</strong>
          <ParticipantStatus evidence={evidence} />
        </div>
      </div>
      {evidence.note ? (
        <div className="adh-evidence__note">
          <p className="adh-evidence__note-label">Notat</p>
          <p>{evidence.note}</p>
        </div>
      ) : (
        <p className="adh-evidence__empty">Ikke registrert ennå.</p>
      )}
      {evidence.imagePreviewUrl ? (
        <div className="adh-evidence__media">
          <img src={evidence.imagePreviewUrl} alt={`${evidence.name} bevis-bilde`} />
        </div>
      ) : null}
      {evidence.videoPreviewUrl ? (
        <div className="adh-evidence__media">
          <MobileVideo
            controls
            playsInline
            preload="metadata"
            src={evidence.videoPreviewUrl}
          />
        </div>
      ) : null}
    </div>
  );
}

function ReviewLog({ entries }) {
  if (!entries || entries.length === 0) {
    return <p className="adh-log__empty">Ingen handlinger logget enda.</p>;
  }

  const labelByAction = {
    approve: 'Godkjente',
    reverse: 'Reverserte',
    resolve: 'Avgjorde',
    'manual-resolve': 'Avgjorde manuelt',
    cancel: 'Annullerte',
  };
  const targetByKey = {
    challenger: 'utfordrer',
    opponent: 'motstander',
  };

  return (
    <ol className="adh-log">
      {[...entries].reverse().map((entry, index) => {
        const actionLabel = labelByAction[entry.action] ?? entry.action;
        const target = entry.target ? targetByKey[entry.target] : null;
        return (
          <li key={`${entry.timestamp}-${index}`} className="adh-log__entry">
            <span className="adh-log__time">{formatRelative(entry.timestamp)}</span>
            <span className="adh-log__main">
              <strong>{entry.adminName ?? 'Admin'}</strong> {actionLabel}
              {target ? ` ${target}` : ''}
              {entry.result ? ` — ${entry.result}` : ''}
              {entry.reason ? `: "${entry.reason}"` : ''}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function CancelConfirm({ duel, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('Skriv en kort grunn for annulleringen.');
      return;
    }
    setSubmitting(true);
    const result = await onConfirm(trimmed);
    if (!result?.ok) {
      setError(result?.message ?? 'Kunne ikke annullere.');
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      className="adh-confirm-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className="adh-confirm" role="dialog" aria-modal="true">
        <h3>Annuller knute-off</h3>
        <p>
          Annullerer duellen mellom <strong>{duel.challengerName}</strong> og{' '}
          <strong>{duel.opponentName}</strong>. Ingen poeng tildeles. Tilhørende
          innsendinger blir avslått.
        </p>
        <label className="field-group">
          <span>Grunn (synlig for andre admins i loggen)</span>
          <textarea
            className="text-input text-input--area"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="F.eks. fake bevis fra begge, eller test-duell"
          />
        </label>
        {error ? <p className="adh-confirm__error">{error}</p> : null}
        <div className="adh-confirm__actions">
          <button
            type="button"
            className="action-button action-button--ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Avbryt
          </button>
          <button
            type="button"
            className="action-button action-button--danger"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Annullerer...' : 'Bekreft annullering'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function DetailPanel({
  duel,
  currentAdminId,
  isLockedByOther,
  lockedByAdminName,
  onClose,
  onOverrideClaim,
  onReverseChallenger,
  onApproveChallenger,
  onReverseOpponent,
  onApproveOpponent,
  onResolve,
  onManualResolve,
  onCancel,
  onRelease,
}) {
  const [feedback, setFeedback] = useState('');
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [showManualResolve, setShowManualResolve] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [busyAction, setBusyAction] = useState('');

  if (!duel) return null;

  const challenger = getDuelEvidence(duel, 'challenger');
  const opponent = getDuelEvidence(duel, 'opponent');
  const remaining = formatRemaining(duel.millisToDeadline);
  const expired = duel.deadlinePassed;

  async function withBusy(actionId, fn, successMessage) {
    setBusyAction(actionId);
    setFeedback('');
    const result = await fn();
    setBusyAction('');
    if (result?.ok) {
      if (successMessage) setFeedback(successMessage);
    } else {
      setFeedback(result?.message ?? 'Noe gikk galt — prøv igjen.');
    }
    return result;
  }

  return (
    <aside className="adh-detail" aria-label="Knute-off detaljer">
      <header className="adh-detail__header">
        <div>
          <p className="adh-detail__eyebrow">Knute-off</p>
          <h3>{duel.knotTitle}</h3>
        </div>
        <button
          type="button"
          className="adh-detail__close"
          onClick={onClose}
          aria-label="Lukk detaljer"
        >
          <X size={18} strokeWidth={2} />
        </button>
      </header>

      <div className="adh-detail__lock-bar">
        {isLockedByOther ? (
          <>
            <span className="adh-detail__lock-text">
              <Lock size={14} strokeWidth={2} aria-hidden="true" />
              {lockedByAdminName ?? 'En annen admin'} sjekker denne nå
            </span>
            <button
              type="button"
              className="action-button action-button--ghost action-button--compact"
              onClick={onOverrideClaim}
            >
              Overstyr
            </button>
          </>
        ) : (
          <>
            <span className="adh-detail__lock-text adh-detail__lock-text--mine">
              <ShieldCheck size={14} strokeWidth={2} aria-hidden="true" />
              Du sjekker — auto-låst i 5 min
            </span>
            <button
              type="button"
              className="action-button action-button--ghost action-button--compact"
              onClick={onRelease}
            >
              Slipp
            </button>
          </>
        )}
      </div>

      <div className="adh-detail__meta-row">
        {expired ? (
          <span className="adh-row__deadline adh-row__deadline--expired">
            <Clock size={12} strokeWidth={2} aria-hidden="true" />
            <span>Frist utløpt</span>
          </span>
        ) : remaining ? (
          <span
            className={`adh-row__deadline${
              duel.isUrgent ? ' adh-row__deadline--urgent' : ''
            }`}
          >
            <Clock size={12} strokeWidth={2} aria-hidden="true" />
            <span>{remaining}</span>
          </span>
        ) : null}
        <span className="adh-row__deadline">
          <Trophy size={12} strokeWidth={2} aria-hidden="true" />
          <span>{(duel.stake ?? 10) * 2}p på spill</span>
        </span>
      </div>

      {feedback ? <div className="adh-detail__feedback">{feedback}</div> : null}

      <div className="adh-detail__evidence-grid">
        <div className="adh-detail__evidence-col">
          <EvidencePanel evidence={challenger} />
          {challenger.completedAt ? (
            challenger.approved === false ? (
              <button
                type="button"
                className="action-button action-button--ghost"
                disabled={busyAction === 'approve-challenger'}
                onClick={() =>
                  withBusy(
                    'approve-challenger',
                    () => onApproveChallenger(),
                    `Utfordrer godkjent.`,
                  )
                }
              >
                <UserCheck size={16} strokeWidth={1.8} aria-hidden="true" />
                <span>Godkjenn igjen</span>
              </button>
            ) : (
              <button
                type="button"
                className="action-button action-button--ghost"
                disabled={busyAction === 'reverse-challenger'}
                onClick={() =>
                  withBusy(
                    'reverse-challenger',
                    () => onReverseChallenger(),
                    `Utfordrer reversert.`,
                  )
                }
              >
                <RotateCcw size={16} strokeWidth={1.8} aria-hidden="true" />
                <span>Reverser utfordrer</span>
              </button>
            )
          ) : null}
        </div>
        <div className="adh-detail__evidence-col">
          <EvidencePanel evidence={opponent} />
          {opponent.completedAt ? (
            opponent.approved === false ? (
              <button
                type="button"
                className="action-button action-button--ghost"
                disabled={busyAction === 'approve-opponent'}
                onClick={() =>
                  withBusy(
                    'approve-opponent',
                    () => onApproveOpponent(),
                    `Motstander godkjent.`,
                  )
                }
              >
                <UserCheck size={16} strokeWidth={1.8} aria-hidden="true" />
                <span>Godkjenn igjen</span>
              </button>
            ) : (
              <button
                type="button"
                className="action-button action-button--ghost"
                disabled={busyAction === 'reverse-opponent'}
                onClick={() =>
                  withBusy(
                    'reverse-opponent',
                    () => onReverseOpponent(),
                    `Motstander reversert.`,
                  )
                }
              >
                <RotateCcw size={16} strokeWidth={1.8} aria-hidden="true" />
                <span>Reverser motstander</span>
              </button>
            )
          ) : null}
        </div>
      </div>

      <div className="adh-detail__action-bar">
        <button
          type="button"
          className="action-button"
          disabled={busyAction === 'resolve'}
          onClick={() =>
            withBusy('resolve', () => onResolve(), 'Knute-off er avgjort.')
          }
        >
          <Gavel size={16} strokeWidth={1.8} aria-hidden="true" />
          <span>Avgjør (auto)</span>
        </button>
        <button
          type="button"
          className="action-button action-button--ghost"
          onClick={() => setShowManualResolve((v) => !v)}
        >
          <Crown size={16} strokeWidth={1.8} aria-hidden="true" />
          <span>Manuell vinner</span>
        </button>
        <button
          type="button"
          className="action-button action-button--ghost action-button--danger-outline"
          onClick={() => setConfirmingCancel(true)}
        >
          <Trash2 size={16} strokeWidth={1.8} aria-hidden="true" />
          <span>Annuller</span>
        </button>
      </div>

      {showManualResolve ? (
        <div className="adh-detail__manual-bar">
          <p className="adh-detail__manual-hint">
            Sett vinner manuelt — overstyrer auto-utregningen basert på status.
          </p>
          <div className="adh-detail__manual-grid">
            <button
              type="button"
              className="action-button action-button--ghost"
              disabled={busyAction === 'manual-challenger'}
              onClick={() =>
                withBusy(
                  'manual-challenger',
                  () => onManualResolve('challenger-wins'),
                  `${challenger.name} satt som vinner.`,
                )
              }
            >
              {challenger.name} vinner
            </button>
            <button
              type="button"
              className="action-button action-button--ghost"
              disabled={busyAction === 'manual-opponent'}
              onClick={() =>
                withBusy(
                  'manual-opponent',
                  () => onManualResolve('opponent-wins'),
                  `${opponent.name} satt som vinner.`,
                )
              }
            >
              {opponent.name} vinner
            </button>
            <button
              type="button"
              className="action-button action-button--ghost"
              disabled={busyAction === 'manual-split'}
              onClick={() =>
                withBusy(
                  'manual-split',
                  () => onManualResolve('split'),
                  'Split — begge deler potten.',
                )
              }
            >
              Split (begge)
            </button>
            <button
              type="button"
              className="action-button action-button--ghost"
              disabled={busyAction === 'manual-no'}
              onClick={() =>
                withBusy(
                  'manual-no',
                  () => onManualResolve('no-completion'),
                  'Avgjort som no-completion.',
                )
              }
            >
              No-completion
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="adh-detail__log-toggle"
        onClick={() => setShowLog((v) => !v)}
      >
        <span>Logg ({duel.reviewLog?.length ?? 0})</span>
        <ChevronRight
          size={14}
          strokeWidth={2}
          className={showLog ? 'is-open' : ''}
          aria-hidden="true"
        />
      </button>
      {showLog ? <ReviewLog entries={duel.reviewLog ?? []} /> : null}

      {confirmingCancel ? (
        <CancelConfirm
          duel={duel}
          onClose={() => setConfirmingCancel(false)}
          onConfirm={async (reason) => {
            const result = await onCancel(reason);
            if (result?.ok) {
              setConfirmingCancel(false);
            }
            return result;
          }}
        />
      ) : null}
    </aside>
  );
}

export function AdminDuelHub({
  duels,
  duelSummary,
  currentAdminId,
  onClaimDuel,
  onReleaseDuel,
  onReviewDuelCompletion,
  onResolveDuel,
  onManualResolveDuel,
  onCancelDuel,
}) {
  const [filter, setFilter] = useState('ready');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDuelId, setSelectedDuelId] = useState(null);
  const [feedback, setFeedback] = useState('');
  // Tikker hvert minutt for å oppdatere "X min siden"-labels og frist-countdown.
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((v) => v + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const safeDuels = duels ?? [];
  const allActive = useMemo(
    () => safeDuels.filter((duel) => duel.status === 'active'),
    [safeDuels],
  );
  const resolved = useMemo(
    () => safeDuels.filter((duel) => duel.status === 'resolved'),
    [safeDuels],
  );

  // Hovedfiltrene over kø-listen.
  const filteredActive = useMemo(() => {
    let list = allActive;

    if (filter === 'ready') {
      list = list.filter((duel) => duel.readyForResolution);
    } else if (filter === 'pending') {
      list = list.filter((duel) => !duel.readyForResolution);
    } else if (filter === 'reverted') {
      list = list.filter(
        (duel) =>
          duel.challengerCompletionApproved === false ||
          duel.opponentCompletionApproved === false,
      );
    } else if (filter === 'mine') {
      list = list.filter(
        (duel) => duel.lastReviewedByAdminId === currentAdminId,
      );
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((duel) => {
        const haystack = [
          duel.knotTitle,
          duel.challengerName,
          duel.opponentName,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    return list;
  }, [allActive, filter, searchQuery, currentAdminId]);

  // Counters for filter-tabs.
  const counts = useMemo(() => {
    const ready = allActive.filter((duel) => duel.readyForResolution).length;
    const pending = allActive.filter((duel) => !duel.readyForResolution).length;
    const reverted = allActive.filter(
      (duel) =>
        duel.challengerCompletionApproved === false ||
        duel.opponentCompletionApproved === false,
    ).length;
    const mine = allActive.filter(
      (duel) => duel.lastReviewedByAdminId === currentAdminId,
    ).length;
    return {
      ready,
      pending,
      reverted,
      mine,
      all: allActive.length,
    };
  }, [allActive, currentAdminId]);

  // Stats — top of page.
  const lockedCount = useMemo(
    () =>
      allActive.filter(
        (duel) => duel.lockedByAdminId && !duel.lockExpired,
      ).length,
    [allActive],
  );
  const urgentCount = useMemo(
    () => allActive.filter((duel) => duel.isUrgent).length,
    [allActive],
  );
  const myReviewQueue = counts.mine;

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  const resolvedToday = useMemo(
    () =>
      resolved.filter((duel) => {
        const ts = duel.resolvedAtRaw
          ? new Date(duel.resolvedAtRaw).getTime()
          : 0;
        return ts >= todayStart;
      }).length,
    [resolved, todayStart],
  );
  const myResolutionsToday = useMemo(
    () =>
      resolved.filter((duel) => {
        const ts = duel.resolvedAtRaw
          ? new Date(duel.resolvedAtRaw).getTime()
          : 0;
        return ts >= todayStart && duel.lastReviewedByAdminId === currentAdminId;
      }).length,
    [resolved, todayStart, currentAdminId],
  );

  const selectedDuel = useMemo(
    () => safeDuels.find((duel) => duel.id === selectedDuelId) ?? null,
    [safeDuels, selectedDuelId],
  );

  // Når en valgt duell forsvinner (annullert/resolved) må vi rydde state.
  useEffect(() => {
    if (selectedDuelId && !selectedDuel) {
      setSelectedDuelId(null);
    } else if (selectedDuel && selectedDuel.status !== 'active') {
      setSelectedDuelId(null);
    }
  }, [selectedDuel, selectedDuelId]);

  async function openDetail(duel, { override = false } = {}) {
    setFeedback('');
    const result = await onClaimDuel?.(duel.id, { override });
    if (result?.ok) {
      setSelectedDuelId(duel.id);
    } else {
      setFeedback(result?.message ?? 'Kunne ikke claime knute-off.');
    }
  }

  async function closeDetail() {
    if (selectedDuelId) {
      // Slipper låsen i bakgrunnen — feiler stille hvis allerede sluppet.
      onReleaseDuel?.(selectedDuelId);
    }
    setSelectedDuelId(null);
  }

  return (
    <div className="adh">
      {/* HERO STATS */}
      <section className="adh-stats" aria-label="Knute-off-oversikt">
        <HeroStat
          Icon={Gavel}
          value={counts.ready}
          label="klar for avgjørelse"
          tone="ready"
        />
        <HeroStat
          Icon={AlertTriangle}
          value={urgentCount}
          label="haster (< 2t)"
          tone="urgent"
        />
        <HeroStat
          Icon={Lock}
          value={lockedCount}
          label="låst akkurat nå"
          tone="locked"
        />
        <HeroStat
          Icon={UserCheck}
          value={myReviewQueue}
          label="i min kø"
          tone="mine"
        />
      </section>

      <div className="adh-meta-row">
        <span>
          Avgjort i dag: <strong>{resolvedToday}</strong>{' '}
          {myResolutionsToday > 0 ? <span>· av deg: {myResolutionsToday}</span> : null}
        </span>
        <span className="adh-meta-row__divider" aria-hidden="true">·</span>
        <span>{(duelSummary?.stake ?? 10) * 2}p potter</span>
      </div>

      {feedback ? (
        <div className="adh-feedback">
          <span>{feedback}</span>
          <button
            type="button"
            className="action-button action-button--ghost action-button--compact"
            onClick={() => setFeedback('')}
          >
            Lukk
          </button>
        </div>
      ) : null}

      {/* FILTERS + SEARCH */}
      <div className="adh-controls">
        <div className="adh-filters" role="tablist" aria-label="Filtrer knute-offs">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={filter === option.id}
              className={`adh-filter${filter === option.id ? ' is-active' : ''}`}
              onClick={() => setFilter(option.id)}
            >
              <span>{option.label}</span>
              <strong>{counts[option.id]}</strong>
            </button>
          ))}
        </div>
        <div className="adh-search">
          <Search size={14} strokeWidth={2} aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Søk navn eller knute…"
          />
        </div>
      </div>

      {/* QUEUE */}
      <div className="adh-layout">
        <div className="adh-queue">
          {filteredActive.length === 0 ? (
            <p className="adh-empty">
              {filter === 'ready'
                ? 'Ingen klar til avgjørelse akkurat nå. Pågående knute-offer venter på bevis.'
                : 'Ingen knute-offer i denne filteren.'}
            </p>
          ) : (
            filteredActive.map((duel) => {
              const isLocked =
                duel.lockedByAdminId && !duel.lockExpired;
              const isLockedByMe = isLocked && duel.lockedByAdminId === currentAdminId;
              const isLockedByOther = isLocked && duel.lockedByAdminId !== currentAdminId;
              return (
                <QueueRow
                  key={duel.id}
                  duel={duel}
                  isSelected={selectedDuelId === duel.id}
                  isLocked={Boolean(isLocked)}
                  isLockedByMe={Boolean(isLockedByMe)}
                  isLockedByOther={Boolean(isLockedByOther)}
                  lastReviewedRelative={formatRelative(duel.lastReviewedAt)}
                  onOpen={() => openDetail(duel)}
                />
              );
            })
          )}
        </div>

        {/* DETAIL PANEL */}
        {selectedDuel ? (
          <DetailPanel
            duel={selectedDuel}
            currentAdminId={currentAdminId}
            isLockedByOther={
              selectedDuel.lockedByAdminId &&
              !selectedDuel.lockExpired &&
              selectedDuel.lockedByAdminId !== currentAdminId
            }
            lockedByAdminName={selectedDuel.lockedByAdminName}
            onClose={closeDetail}
            onOverrideClaim={async () => {
              await onClaimDuel?.(selectedDuel.id, { override: true });
            }}
            onRelease={() => {
              onReleaseDuel?.(selectedDuel.id);
              setSelectedDuelId(null);
            }}
            onReverseChallenger={() =>
              onReviewDuelCompletion(selectedDuel.id, selectedDuel.challengerId, false)
                .then(() => ({ ok: true }))
                .catch((err) => ({ ok: false, message: err?.message }))
            }
            onApproveChallenger={() =>
              onReviewDuelCompletion(selectedDuel.id, selectedDuel.challengerId, true)
                .then(() => ({ ok: true }))
                .catch((err) => ({ ok: false, message: err?.message }))
            }
            onReverseOpponent={() =>
              onReviewDuelCompletion(selectedDuel.id, selectedDuel.opponentId, false)
                .then(() => ({ ok: true }))
                .catch((err) => ({ ok: false, message: err?.message }))
            }
            onApproveOpponent={() =>
              onReviewDuelCompletion(selectedDuel.id, selectedDuel.opponentId, true)
                .then(() => ({ ok: true }))
                .catch((err) => ({ ok: false, message: err?.message }))
            }
            onResolve={() =>
              onResolveDuel(selectedDuel.id)
                .then(() => ({ ok: true }))
                .catch((err) => ({ ok: false, message: err?.message }))
            }
            onManualResolve={(result) =>
              onManualResolveDuel?.(selectedDuel.id, result)
            }
            onCancel={(reason) => onCancelDuel?.(selectedDuel.id, reason)}
          />
        ) : null}
      </div>

      {/* RESOLVED HISTORY */}
      <section className="adh-history">
        <header className="adh-history__head">
          <h3>Historikk</h3>
          <span>{resolved.length} avgjorte totalt</span>
        </header>
        <div className="adh-history__list">
          {resolved.slice(0, 12).map((duel) => {
            const isCancelled = duel.result === 'cancelled';
            return (
              <div
                key={duel.id}
                className={`adh-history-row${
                  isCancelled ? ' adh-history-row--cancelled' : ''
                }`}
              >
                <div className="adh-history-row__main">
                  <strong>
                    {isCancelled ? 'Annullert' : duel.outcomeTitle}
                    {duel.knotTitle ? ` · ${duel.knotTitle}` : ''}
                  </strong>
                  <span className="adh-history-row__sub">
                    {duel.challengerName} vs {duel.opponentName} ·{' '}
                    {duel.resolvedAtLabel}
                    {duel.lastReviewedByAdminName
                      ? ` · av ${duel.lastReviewedByAdminName}`
                      : ''}
                    {isCancelled && duel.cancelReason
                      ? ` · "${duel.cancelReason}"`
                      : ''}
                  </span>
                </div>
                <span className="adh-history-row__pill">
                  {isCancelled ? 'annullert' : duel.pointLabel}
                </span>
              </div>
            );
          })}
          {resolved.length === 0 ? (
            <p className="adh-empty">Ingen avgjorte knute-offer ennå.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
