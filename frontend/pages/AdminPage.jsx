import { useEffect, useMemo, useState } from 'react';
import { MobileVideo } from '../components/MobileVideo.jsx';
import { SectionCard } from '../components/SectionCard.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { KNOT_FOLDERS, resolveKnotFolder } from '../data/knotFolders.js';
import { UserAdminPanel } from '../components/UserAdminPanel.jsx';

function getDuelEvidence(duel, participant) {
  if (participant === 'challenger') {
    return {
      note: duel.challengerNote ?? '',
      imageName: duel.challengerImageName ?? '',
      imagePreviewUrl: duel.challengerImagePreviewUrl ?? '',
      videoName: duel.challengerVideoName ?? '',
      videoPreviewUrl: duel.challengerVideoPreviewUrl ?? '',
    };
  }

  return {
    note: duel.opponentNote ?? '',
    imageName: duel.opponentImageName ?? '',
    imagePreviewUrl: duel.opponentImagePreviewUrl ?? '',
    videoName: duel.opponentVideoName ?? '',
    videoPreviewUrl: duel.opponentVideoPreviewUrl ?? '',
  };
}

function DuelEvidencePanel({ title, evidence }) {
  const hasEvidence =
    evidence.note ||
    evidence.imagePreviewUrl ||
    evidence.videoPreviewUrl;

  return (
    <div className="duel-evidence-admin">
      <strong>{title}</strong>
      {hasEvidence ? (
        <>
          {evidence.note ? <p className="submission-note">{evidence.note}</p> : null}
          {evidence.imagePreviewUrl || evidence.videoPreviewUrl ? (
            <div className="submission-preview-grid">
              {evidence.imagePreviewUrl ? (
                <div className="evidence-card">
                  <span>{evidence.imageName || 'Bildebevis'}</span>
                  <img src={evidence.imagePreviewUrl} alt={title} />
                </div>
              ) : null}

              {evidence.videoPreviewUrl ? (
                <div className="evidence-card">
                  <span>{evidence.videoName || 'Videobevis'}</span>
                  <MobileVideo
                    controls
                    autoPlay
                    muted
                    loop
                    playsInline
                    src={evidence.videoPreviewUrl}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <p className="submission-note">Ingen bevis lastet opp ennå.</p>
      )}
    </div>
  );
}

function getSubmissionModeMeta(submissionMode) {
  if (submissionMode === 'anonymous-feed') {
    return {
      label: 'Ønsker anonym feed-post',
      pillClass: 'pill--warning',
    };
  }

  if (submissionMode === 'feed') {
    return {
      label: 'Ønsker feed-post',
      pillClass: 'pill--soft',
    };
  }

  return {
    label: 'Kun godkjenning',
    pillClass: 'pill--muted',
  };
}

function getSubmissionMode(submission) {
  if (submission?.isAnonymousFeed === true) {
    return 'anonymous-feed';
  }

  if (submission?.submissionMode === 'feed' || submission?.submissionMode === 'anonymous-feed') {
    return submission.submissionMode;
  }

  return 'review';
}

const BAN_TYPE_OPTIONS = [
  { value: 'feed', label: 'Feed-ban (kun posting)' },
  { value: 'submission', label: 'Innsendings-ban (knuter + knuteoff)' },
];

const BAN_DURATION_OPTIONS = [
  { hours: 24, label: '24 timer' },
  { hours: 72, label: '3 dager' },
  { hours: 168, label: '1 uke' },
];

const REVIEW_QUEUE_MODE = {
  ALL: 'all',
  FAST: 'fast',
};
const FEEDBACK_FIELD_CONFIG = Object.freeze([
  {
    key: 'standard',
    label: 'Standard innsending',
    description: 'Brukes ved forste innsending.',
  },
  {
    key: 'resubmission',
    label: 'Oppdatert innsending',
    description: 'Brukes nar bruker sender pa nytt.',
  },
  {
    key: 'feed',
    label: 'Feed-innsending',
    description: 'Brukes nar innsending sendes med vanlig feed.',
  },
  {
    key: 'anonymousFeed',
    label: 'Anonym feed-innsending',
    description: 'Brukes nar innsending sendes anonymt.',
  },
  {
    key: 'streak',
    label: 'Streak-melding',
    description: 'Brukes nar dagens streak trigges.',
  },
  {
    key: 'rare',
    label: 'Rare (sykt sjelden)',
    description: 'Kan trigges pa tvers av alle kategorier med veldig lav sjanse.',
  },
]);

function toSubmissionKey(id) {
  return String(id ?? '');
}

function feedbackListToTextareaText(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return '';
  }

  return entries.filter((entry) => typeof entry === 'string' && entry.trim()).join('\n');
}

function feedbackTextareaTextToList(value) {
  return String(value ?? '')
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter(Boolean);
}

function feedbackTextareaTextToListByField(fieldKey, value) {
  if (fieldKey === 'rare') {
    const fullText = String(value ?? '')
      .replace(/\r\n/gu, '\n')
      .replace(/\n{3,}/gu, '\n\n')
      .trim();

    return fullText ? [fullText] : [];
  }

  return feedbackTextareaTextToList(value);
}

function buildFeedbackDraftFromMessages(messages) {
  const draft = {};

  FEEDBACK_FIELD_CONFIG.forEach((field) => {
    draft[field.key] = feedbackListToTextareaText(messages?.[field.key]);
  });

  return draft;
}

function isFormLikeTarget(target) {
  const tagName = target?.tagName?.toLowerCase?.() ?? '';

  if (target?.isContentEditable) {
    return true;
  }

  return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

function formatAdminTimestamp(isoValue) {
  const parsedDate = new Date(isoValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Ukjent tidspunkt';
  }

  return parsedDate.toLocaleString('nb-NO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildOpenReportQueue(reports) {
  const openReports = (reports ?? []).filter((report) => report.status === 'open');
  const groupedBySubmission = openReports.reduce((accumulator, report) => {
    const currentGroup = accumulator[report.submissionId] ?? {
      submissionId: report.submissionId,
      reportIds: [],
      count: 0,
      knotTitle: report.knotTitle,
      submittedByName: report.submittedByName,
      submissionStatus: report.submissionStatus,
      createdAt: report.createdAt,
      reasons: new Set(),
      notes: [],
    };

    currentGroup.reportIds.push(report.id);
    currentGroup.count += 1;
    currentGroup.reasons.add(report.reason);

    if (report.note) {
      currentGroup.notes.push(report.note);
    }

    if (Date.parse(report.createdAt) > Date.parse(currentGroup.createdAt)) {
      currentGroup.createdAt = report.createdAt;
    }

    accumulator[report.submissionId] = currentGroup;
    return accumulator;
  }, {});

  return Object.values(groupedBySubmission)
    .map((group) => ({
      ...group,
      reasons: Array.from(group.reasons),
      latestAtLabel: formatAdminTimestamp(group.createdAt),
      primaryReportId: group.reportIds[0],
    }))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

function SubmissionList({
  items,
  canReview,
  onReviewAction,
  activeSubmissionId = '',
  disableReviewActions = false,
  isReviewingById = {},
  onSetActiveSubmission = null,
  onToggleSelected = null,
  reportedSubmissionIdSet = new Set(),
  selectedSubmissionIds = {},
}) {
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
      {items.map((submission) => {
        const submissionMode = getSubmissionMode(submission);
        const modeMeta = getSubmissionModeMeta(submissionMode);
        const submissionKey = toSubmissionKey(submission.id);
        const isActive = canReview && activeSubmissionId === submissionKey;
        const isSelected = Boolean(selectedSubmissionIds[submissionKey]);
        const isReviewing = Boolean(isReviewingById[submissionKey]);
        const hasOpenReport = reportedSubmissionIdSet.has(submissionKey);
        const disableRowActions = disableReviewActions || isReviewing;

        return (
        <article
          key={submission.id}
          className={`submission-row ${isActive ? 'is-active' : ''}`}
          onClick={() => onSetActiveSubmission?.(submissionKey)}
        >
          <div className="submission-row__content">
            <h3>{submission.knotTitle}</h3>
            <p>
              {submission.student} | {submission.submittedAt}
            </p>
            <p className="submission-note">
              Innsendingstype: <strong>{modeMeta.label}</strong>
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
                    <MobileVideo
                      controls
                      autoPlay
                      muted
                      loop
                      playsInline
                      src={submission.videoPreviewUrl}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="submission-row__actions">
            <span className={`pill ${modeMeta.pillClass}`}>{modeMeta.label}</span>
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
            {hasOpenReport ? (
              <span className="pill pill--warning submission-row__flag">Rapportert</span>
            ) : null}
            {canReview ? (
              <>
                <label className="submission-row__select">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelected?.(submissionKey)}
                    onClick={(event) => event.stopPropagation()}
                  />
                  <span>Velg</span>
                </label>
                <button
                  type="button"
                  className="action-button"
                  disabled={disableRowActions}
                  onClick={(event) => {
                    event.stopPropagation();
                    onReviewAction(submission, 'Godkjent');
                  }}
                >
                  Godkjenn
                  {isActive ? <span className="submission-row__quickkey">A</span> : null}
                </button>
                <button
                  type="button"
                  className="action-button action-button--ghost"
                  disabled={disableRowActions}
                  onClick={(event) => {
                    event.stopPropagation();
                    onReviewAction(submission, 'Avslått');
                  }}
                >
                  Avslå
                  {isActive ? <span className="submission-row__quickkey">D</span> : null}
                </button>
              </>
            ) : null}
          </div>
        </article>
        );
      })}
    </div>
  );
}

export function AdminPage({
  bans = [],
  currentUserName,
  currentUserPoints = 0,
  duelHistory,
  duelSummary,
  knotFeedbackMessages = {},
  knots,
  leaders = [],
  onDeleteKnot,
  onCreateBan,
  onImportKnots,
  onUpdateKnotFeedbackMessages,
  onRemoveBan,
  onReviewReport,
  onReviewDuelCompletion,
  onResolveDuel,
  onReviewSubmission,
  onUpdateKnotPoints,
  reports = [],
  stats,
  submissions,
  sessionToken,
}) {
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [defaultPoints, setDefaultPoints] = useState(20);
  const [defaultFolder, setDefaultFolder] = useState(KNOT_FOLDERS[0].id);
  const [importMessage, setImportMessage] = useState('');
  const [activeAdminTask, setActiveAdminTask] = useState('overview');
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [selectedBanUserId, setSelectedBanUserId] = useState('');
  const [selectedBanType, setSelectedBanType] = useState(BAN_TYPE_OPTIONS[0].value);
  const [selectedBanDurationHours, setSelectedBanDurationHours] = useState(
    BAN_DURATION_OPTIONS[0].hours,
  );
  const [processingReportId, setProcessingReportId] = useState('');
  const [processingBanId, setProcessingBanId] = useState('');
  const [reviewQueueMode, setReviewQueueMode] = useState(REVIEW_QUEUE_MODE.ALL);
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState({});
  const [activeSubmissionId, setActiveSubmissionId] = useState('');
  const [isBatchReviewing, setIsBatchReviewing] = useState(false);
  const [reviewingSubmissionIds, setReviewingSubmissionIds] = useState({});
  const [feedbackDraft, setFeedbackDraft] = useState(() =>
    buildFeedbackDraftFromMessages(knotFeedbackMessages),
  );
  const [feedbackSettingsMessage, setFeedbackSettingsMessage] = useState('');
  const [isSavingFeedbackSettings, setIsSavingFeedbackSettings] = useState(false);
  const [rareFeedbackPreview, setRareFeedbackPreview] = useState('');

  const pendingSubmissions = submissions.filter(
    (submission) => submission.status === 'Venter',
  );
  const pendingApprovalOnlyCount = pendingSubmissions.filter(
    (submission) => getSubmissionMode(submission) === 'review',
  ).length;
  const pendingFeedCount = pendingSubmissions.filter(
    (submission) => getSubmissionMode(submission) === 'feed',
  ).length;
  const pendingAnonymousFeedCount = pendingSubmissions.filter(
    (submission) => getSubmissionMode(submission) === 'anonymous-feed',
  ).length;
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
  const reportQueue = buildOpenReportQueue(reports);
  const reportedSubmissionIdSet = useMemo(
    () => new Set(reportQueue.map((report) => toSubmissionKey(report.submissionId))),
    [reportQueue],
  );
  const fastLanePendingSubmissions = useMemo(
    () =>
      pendingSubmissions.filter(
        (submission) => !reportedSubmissionIdSet.has(toSubmissionKey(submission.id)),
      ),
    [pendingSubmissions, reportedSubmissionIdSet],
  );
  const reviewQueueSubmissions =
    reviewQueueMode === REVIEW_QUEUE_MODE.FAST
      ? fastLanePendingSubmissions
      : pendingSubmissions;
  const fastLanePendingCount = fastLanePendingSubmissions.length;
  const selectedVisibleSubmissionCount = reviewQueueSubmissions.filter((submission) =>
    Boolean(selectedSubmissionIds[toSubmissionKey(submission.id)]),
  ).length;
  const openReportCount = reportQueue.length;
  const activeBans = (bans ?? []).filter((ban) => ban.active);
  const activeBanCount = activeBans.length;
  const customFeedbackLineCount = FEEDBACK_FIELD_CONFIG.reduce(
    (total, field) =>
      total + feedbackTextareaTextToListByField(field.key, feedbackDraft[field.key]).length,
    0,
  );
  const banCandidates = (leaders ?? []).filter((leader) => leader.id !== 1);

  const adminTasks = [
    {
      id: 'submissions',
      label: 'Godkjenn innsendinger',
      count: pendingSubmissionCount,
      note: 'Ventende',
    },
    {
      id: 'knots',
      label: 'Knuter og sletting',
      count: totalKnotCount,
      note: 'Poeng + slett',
    },
    {
      id: 'duels',
      label: 'Knute-offs',
      count: activeDuelCount,
      note: 'Aktive',
    },
    {
      id: 'reports',
      label: 'Rapporter',
      count: openReportCount,
      note: 'Åpne saker',
    },
    {
      id: 'bans',
      label: 'Bans',
      count: activeBanCount,
      note: 'Aktive',
    },
    {
      id: 'feedback',
      label: 'Knute-feedback',
      count: customFeedbackLineCount,
      note: 'Egne tekster',
    },
    {
      id: 'users',
      label: 'Brukere',
      count: leaders?.length ?? 0,
      note: 'Admin og invites',
    },
    {
      id: 'overview',
      label: 'Oversikt',
      count: stats.length,
      note: 'Kort',
    },
  ];

  const submissionById = useMemo(
    () =>
      new Map(
        reviewQueueSubmissions.map((submission) => [
          toSubmissionKey(submission.id),
          submission,
        ]),
      ),
    [reviewQueueSubmissions],
  );

  function getNextSubmissionId(currentSubmissionId, direction = 1) {
    if (!reviewQueueSubmissions.length) {
      return '';
    }

    const currentIndex = reviewQueueSubmissions.findIndex(
      (submission) => toSubmissionKey(submission.id) === currentSubmissionId,
    );

    if (currentIndex === -1) {
      return toSubmissionKey(reviewQueueSubmissions[0].id);
    }

    const nextIndex = Math.min(
      Math.max(currentIndex + direction, 0),
      reviewQueueSubmissions.length - 1,
    );

    return toSubmissionKey(reviewQueueSubmissions[nextIndex].id);
  }

  function moveActiveSubmission(direction = 1) {
    setActiveSubmissionId((currentSubmissionId) =>
      getNextSubmissionId(currentSubmissionId, direction),
    );
  }

  function toggleSubmissionSelection(submissionId) {
    setSelectedSubmissionIds((currentSelections) => {
      const submissionKey = toSubmissionKey(submissionId);
      const nextSelections = { ...currentSelections };

      if (nextSelections[submissionKey]) {
        delete nextSelections[submissionKey];
      } else {
        nextSelections[submissionKey] = true;
      }

      return nextSelections;
    });
  }

  function toggleSelectAllVisibleSubmissions() {
    setSelectedSubmissionIds((currentSelections) => {
      if (selectedVisibleSubmissionCount === reviewQueueSubmissions.length) {
        const nextSelections = { ...currentSelections };
        reviewQueueSubmissions.forEach((submission) => {
          delete nextSelections[toSubmissionKey(submission.id)];
        });
        return nextSelections;
      }

      const nextSelections = { ...currentSelections };
      reviewQueueSubmissions.forEach((submission) => {
        nextSelections[toSubmissionKey(submission.id)] = true;
      });
      return nextSelections;
    });
  }

  useEffect(() => {
    const visibleSubmissionIdSet = new Set(
      reviewQueueSubmissions.map((submission) => toSubmissionKey(submission.id)),
    );

    setSelectedSubmissionIds((currentSelections) => {
      const nextSelections = Object.entries(currentSelections).reduce(
        (accumulator, [submissionId, isSelected]) => {
          if (isSelected && visibleSubmissionIdSet.has(submissionId)) {
            accumulator[submissionId] = true;
          }
          return accumulator;
        },
        {},
      );

      const hasChanged =
        Object.keys(nextSelections).length !== Object.keys(currentSelections).length;

      return hasChanged ? nextSelections : currentSelections;
    });

    if (!reviewQueueSubmissions.length) {
      setActiveSubmissionId('');
      return;
    }

    if (
      !activeSubmissionId ||
      !visibleSubmissionIdSet.has(toSubmissionKey(activeSubmissionId))
    ) {
      setActiveSubmissionId(toSubmissionKey(reviewQueueSubmissions[0].id));
    }
  }, [activeSubmissionId, reviewQueueSubmissions]);

  useEffect(() => {
    setFeedbackDraft(buildFeedbackDraftFromMessages(knotFeedbackMessages));
  }, [knotFeedbackMessages]);

  useEffect(() => {
    if (activeAdminTask !== 'submissions' || !reviewQueueSubmissions.length) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (isFormLikeTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === 'arrowdown' || key === 'j') {
        event.preventDefault();
        moveActiveSubmission(1);
        return;
      }

      if (key === 'arrowup' || key === 'k') {
        event.preventDefault();
        moveActiveSubmission(-1);
        return;
      }

      const activeSubmission = submissionById.get(toSubmissionKey(activeSubmissionId));

      if (!activeSubmission || isBatchReviewing) {
        return;
      }

      if (key === 'a') {
        event.preventDefault();
        void handleReviewAction(activeSubmission, 'Godkjent');
        return;
      }

      if (key === 'd') {
        event.preventDefault();
        void handleReviewAction(activeSubmission, 'Avslått');
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [
    activeAdminTask,
    activeSubmissionId,
    handleReviewAction,
    isBatchReviewing,
    moveActiveSubmission,
    reviewQueueSubmissions,
    submissionById,
  ]);

  async function handleAddSingleKnot() {
    const title = newTitle.trim();
    if (!title) return;
    if (!newDescription.trim()) {
      setImportMessage('Legg inn forklaring før du oppretter knuten.');
      return;
    }
    const result = await onImportKnots(title, defaultPoints, defaultFolder, newDescription.trim());
    if (result.added === 0) {
      setImportMessage(`"${title}" finnes allerede.`);
    } else {
      setImportMessage(`La til "${title}".`);
      setNewTitle('');
      setNewDescription('');
    }
  }

  async function handleImportSubmit() {
    if (!newDescription.trim()) {
      setImportMessage('Legg inn forklaring før du legger til knuter.');
      return;
    }

    const result = await onImportKnots(
      bulkInput,
      defaultPoints,
      defaultFolder,
      newDescription.trim(),
    );

    if (result.added === 0) {
      setImportMessage('Ingen nye knuter ble lagt til.');
      return;
    }

    setImportMessage(
      `La til ${result.added} knuter${result.skipped ? `, hoppet over ${result.skipped}` : ''}.`,
    );
    setBulkInput('');
  }

  function handleFeedbackDraftChange(fieldKey, value) {
    setFeedbackDraft((current) => ({
      ...current,
      [fieldKey]: value,
    }));
  }

  function handleResetFeedbackDraft() {
    setFeedbackDraft(buildFeedbackDraftFromMessages(knotFeedbackMessages));
    setFeedbackSettingsMessage('Utkast nullstilt til sist lagrede verdier.');
    setRareFeedbackPreview('');
  }

  async function handleSaveFeedbackMessages() {
    if (!onUpdateKnotFeedbackMessages) {
      return;
    }

    const nextMessages = FEEDBACK_FIELD_CONFIG.reduce((accumulator, field) => {
      accumulator[field.key] = feedbackTextareaTextToListByField(
        field.key,
        feedbackDraft[field.key],
      );
      return accumulator;
    }, {});
    const hasAnyMessage = FEEDBACK_FIELD_CONFIG.some(
      (field) => nextMessages[field.key].length > 0,
    );

    if (!hasAnyMessage) {
      setFeedbackSettingsMessage('Legg inn minst en linje for a lagre.');
      return;
    }

    setIsSavingFeedbackSettings(true);
    setFeedbackSettingsMessage('');

    try {
      await onUpdateKnotFeedbackMessages(nextMessages);
      setFeedbackSettingsMessage('Feedback-tekstene er lagret.');
    } catch (error) {
      setFeedbackSettingsMessage(
        error instanceof Error ? error.message : 'Kunne ikke lagre feedback-tekstene.',
      );
    } finally {
      setIsSavingFeedbackSettings(false);
    }
  }

  function handleTestRareFeedback() {
    const rareMessages = feedbackTextareaTextToListByField('rare', feedbackDraft.rare ?? '');

    if (rareMessages.length === 0) {
      setRareFeedbackPreview('');
      setFeedbackSettingsMessage('Legg inn en rare-melding for a teste.');
      return;
    }

    const candidate =
      rareMessages[Math.floor(Math.random() * rareMessages.length)] ?? rareMessages[0];

    setRareFeedbackPreview(candidate);
    setFeedbackSettingsMessage('Viser test av rare-melding under.');
  }

  async function handleReviewAction(submission, nextStatus, options = {}) {
    if (!submission?.id) {
      return false;
    }

    const { silent = false } = options;
    const submissionMode = getSubmissionMode(submission);
    const modeMeta = getSubmissionModeMeta(submissionMode);
    const submissionKey = toSubmissionKey(submission.id);
    const nextActiveId = getNextSubmissionId(submissionKey, 1);

    if (nextActiveId && nextActiveId !== submissionKey) {
      setActiveSubmissionId(nextActiveId);
    }

    setReviewingSubmissionIds((current) => ({
      ...current,
      [submissionKey]: true,
    }));

    setSelectedSubmissionIds((current) => {
      const next = { ...current };
      delete next[submissionKey];
      return next;
    });

    try {
      await onReviewSubmission(submission.id, nextStatus);

      if (silent) {
        return true;
      }

      if (nextStatus === 'Godkjent') {
        const nextPoints =
          submission.leaderId === 1
            ? currentUserPoints + submission.points
            : currentUserPoints;

        setReviewFeedback(
          `"${submission.knotTitle}" ble godkjent (${modeMeta.label}). ${
            submission.leaderId === 1
              ? `${currentUserName} har nå ${nextPoints} poeng.`
              : 'Leaderboard oppdateres automatisk.'
          }`,
        );
      } else {
        setReviewFeedback(`"${submission.knotTitle}" ble avslått og status er oppdatert.`);
      }

      return true;
    } catch (error) {
      if (!silent) {
        setReviewFeedback(
          error instanceof Error
            ? error.message
            : 'Kunne ikke oppdatere innsendingen.',
        );
      }
      return false;
    } finally {
      setReviewingSubmissionIds((current) => {
        const next = { ...current };
        delete next[submissionKey];
        return next;
      });
    }
  }

  async function handleBatchReview(nextStatus) {
    const targets = reviewQueueSubmissions.filter((submission) =>
      Boolean(selectedSubmissionIds[toSubmissionKey(submission.id)]),
    );

    if (!targets.length) {
      setReviewFeedback('Velg minst én innsending først.');
      return;
    }

    setIsBatchReviewing(true);

    let successCount = 0;
    let failedCount = 0;

    for (const submission of targets) {
      const wasSuccessful = await handleReviewAction(submission, nextStatus, {
        silent: true,
      });

      if (wasSuccessful) {
        successCount += 1;
      } else {
        failedCount += 1;
      }
    }

    setSelectedSubmissionIds({});
    setIsBatchReviewing(false);

    const actionLabel = nextStatus === 'Godkjent' ? 'godkjent' : 'avslått';
    setReviewFeedback(
      `Batch ferdig: ${successCount} ${actionLabel}.${failedCount ? ` ${failedCount} feilet.` : ''}`,
    );
  }

  async function handleDuelCompletionReview(duel, participantId, approved) {
    if (!onReviewDuelCompletion) {
      return;
    }

    const participantLabel =
      participantId === duel.challengerId ? duel.challengerName : duel.opponentName;

    try {
      await onReviewDuelCompletion(duel.id, participantId, approved);
      setReviewFeedback(
        approved
          ? `${participantLabel} er godkjent igjen i knute-offen.`
          : `${participantLabel} er reversert i knute-offen.`,
      );
    } catch (error) {
      setReviewFeedback(
        error instanceof Error
          ? error.message
          : 'Kunne ikke oppdatere duel-vurderingen.',
      );
    }
  }

  async function handleReportAction(reportId, action) {
    if (!onReviewReport || !reportId) {
      return;
    }

    setProcessingReportId(reportId);

    try {
      await onReviewReport(reportId, action);
      setReviewFeedback(
        action === 'keep'
          ? 'Rapport er lukket uten endring i posten.'
          : action === 'remove-feed'
            ? 'Posten er fjernet fra feeden, og rapportene er håndtert.'
            : 'Posten er reversert og rapportene er håndtert.',
      );
    } catch (error) {
      setReviewFeedback(
        error instanceof Error
          ? error.message
          : 'Kunne ikke oppdatere rapporten.',
      );
    } finally {
      setProcessingReportId('');
    }
  }

  async function handleCreateBanSubmit() {
    if (!onCreateBan || !selectedBanUserId) {
      setReviewFeedback('Velg en bruker før du oppretter ban.');
      return;
    }

    try {
      await onCreateBan({
        userId: Number(selectedBanUserId),
        type: selectedBanType,
        durationHours: Number(selectedBanDurationHours),
      });
      setReviewFeedback('Ban er opprettet.');
    } catch (error) {
      setReviewFeedback(
        error instanceof Error
          ? error.message
          : 'Kunne ikke opprette ban akkurat nå.',
      );
    }
  }

  async function handleRemoveBanClick(banId) {
    if (!onRemoveBan || !banId) {
      return;
    }

    setProcessingBanId(banId);

    try {
      await onRemoveBan(banId);
      setReviewFeedback('Ban er opphevet.');
    } catch (error) {
      setReviewFeedback(
        error instanceof Error
          ? error.message
          : 'Kunne ikke oppheve ban akkurat nå.',
      );
    } finally {
      setProcessingBanId('');
    }
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
              <p>
                Kun godkjenning: {pendingApprovalOnlyCount} | Feed: {pendingFeedCount} | Anonym
                feed: {pendingAnonymousFeedCount}
              </p>
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

          <div className="admin-live-strip">
            <span className="leaderboard-row__duel-note">
              {currentUserName} har nå {currentUserPoints} poeng
            </span>
            {reviewFeedback ? (
              <p>{reviewFeedback}</p>
            ) : (
              <p>Alle endringer vises live i UI-et.</p>
            )}
          </div>

          <div className="admin-task-panel">
            <div className="admin-subsection">
              <div className="section-card__header">
                <h3>Ventende nå</h3>
                <p>Dette er hovedkøen for admin.</p>
              </div>
              <div className="admin-review-toolbar">
                <div className="admin-review-toolbar__group">
                  <button
                    type="button"
                    className={`leaderboard-switch__button ${
                      reviewQueueMode === REVIEW_QUEUE_MODE.ALL ? 'is-active' : ''
                    }`}
                    onClick={() => setReviewQueueMode(REVIEW_QUEUE_MODE.ALL)}
                  >
                    Hele køen ({pendingSubmissionCount})
                  </button>
                  <button
                    type="button"
                    className={`leaderboard-switch__button ${
                      reviewQueueMode === REVIEW_QUEUE_MODE.FAST ? 'is-active' : ''
                    }`}
                    onClick={() => setReviewQueueMode(REVIEW_QUEUE_MODE.FAST)}
                  >
                    Fast lane ({fastLanePendingCount})
                  </button>
                </div>

                <div className="admin-review-toolbar__group">
                  <button
                    type="button"
                    className="action-button action-button--ghost action-button--compact"
                    onClick={toggleSelectAllVisibleSubmissions}
                    disabled={!reviewQueueSubmissions.length}
                  >
                    {selectedVisibleSubmissionCount === reviewQueueSubmissions.length &&
                    reviewQueueSubmissions.length > 0
                      ? 'Fjern alle'
                      : 'Velg alle'}
                  </button>
                  <button
                    type="button"
                    className="action-button action-button--compact"
                    onClick={() => handleBatchReview('Godkjent')}
                    disabled={!selectedVisibleSubmissionCount || isBatchReviewing}
                  >
                    Godkjenn valgte ({selectedVisibleSubmissionCount})
                  </button>
                  <button
                    type="button"
                    className="action-button action-button--ghost action-button--compact"
                    onClick={() => handleBatchReview('Avslått')}
                    disabled={!selectedVisibleSubmissionCount || isBatchReviewing}
                  >
                    Avslå valgte
                  </button>
                </div>
                <p className="admin-review-toolbar__hint">
                  Hurtigtaster: J/K for neste/forrige, A for godkjenn, D for avslå.
                </p>
              </div>
              <SubmissionList
                items={reviewQueueSubmissions}
                canReview
                onReviewAction={handleReviewAction}
                activeSubmissionId={activeSubmissionId}
                disableReviewActions={isBatchReviewing}
                isReviewingById={reviewingSubmissionIds}
                onSetActiveSubmission={setActiveSubmissionId}
                onToggleSelected={toggleSubmissionSelection}
                reportedSubmissionIdSet={reportedSubmissionIdSet}
                selectedSubmissionIds={selectedSubmissionIds}
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
                onReviewAction={handleReviewAction}
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
                  <span>Tittel</span>
                  <input
                    type="text"
                    className="text-input"
                    placeholder="F.eks. Spis frokost under pulten"
                    value={newTitle}
                    onChange={(event) => setNewTitle(event.target.value)}
                  />
                </label>

                <label className="field-group">
                  <span>Forklaring (brukes for nye knuter)</span>
                  <textarea
                    className="text-input text-input--compact"
                    placeholder="Beskriv hva knuten går ut på..."
                    value={newDescription}
                    onChange={(event) => setNewDescription(event.target.value)}
                  />
                </label>

                <div className="admin-setup__actions">
                  <label className="field-group field-group--small">
                    <span>Poeng</span>
                    <input
                      type="number"
                      min="0"
                      className="text-input"
                      value={defaultPoints}
                      onChange={(event) => setDefaultPoints(event.target.value)}
                    />
                  </label>

                  <label className="field-group field-group--small">
                    <span>Mappe</span>
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
                    disabled={!newTitle.trim() || !newDescription.trim()}
                    onClick={handleAddSingleKnot}
                  >
                    Legg til knute
                  </button>
                </div>

                {importMessage ? <p className="form-feedback">{importMessage}</p> : null}

                <details className="admin-bulk-details">
                  <summary>Legg til flere på én gang</summary>
                  <div className="admin-setup__bulk">
                    <label className="field-group">
                      <span>Lim inn titler (én per linje)</span>
                      <textarea
                        className="text-input text-input--area"
                        placeholder={'Eksempel:\nSpis is med votter\nSyng på bussen\nBytt sko med en venn'}
                        value={bulkInput}
                        onChange={(event) => setBulkInput(event.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="action-button"
                      disabled={!bulkInput.trim() || !newDescription.trim()}
                      onClick={handleImportSubmit}
                    >
                      Legg til knuter
                    </button>
                  </div>
                </details>
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
                Hver duel har {duelSummary?.stake ?? 10} poeng innsats og{' '}
                {duelSummary?.deadlineHours ?? 24} timers frist.
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
                <p>Fullføringer er auto-godkjent. Reverser ved behov, og avgjør deretter utfallet.</p>
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
                        <div className="duel-evidence-grid">
                          <DuelEvidencePanel
                            title={`Bevis fra ${duel.challengerName}`}
                            evidence={getDuelEvidence(duel, 'challenger')}
                          />
                          <DuelEvidencePanel
                            title={`Bevis fra ${duel.opponentName}`}
                            evidence={getDuelEvidence(duel, 'opponent')}
                          />
                        </div>
                      </div>
                      <div className="duel-history-row__actions duel-history-row__actions--admin">
                        <button
                          type="button"
                          className="action-button action-button--ghost"
                          disabled={!duel.challengerCompletedAt}
                          onClick={() =>
                            handleDuelCompletionReview(
                              duel,
                              duel.challengerId,
                              duel.challengerCompletionApproved === false,
                            )
                          }
                        >
                          {duel.challengerCompletionApproved === false
                            ? 'Godkjenn utfordrer'
                            : 'Reverser utfordrer'}
                        </button>
                        <button
                          type="button"
                          className="action-button action-button--ghost"
                          disabled={!duel.opponentCompletedAt}
                          onClick={() =>
                            handleDuelCompletionReview(
                              duel,
                              duel.opponentId,
                              duel.opponentCompletionApproved === false,
                            )
                          }
                        >
                          {duel.opponentCompletionApproved === false
                            ? 'Godkjenn motstander'
                            : 'Reverser motstander'}
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

      {activeAdminTask === 'reports' ? (
        <SectionCard
          title="Rapporter"
          description="Brukerrapporter håndteres manuelt av admin."
        >
          <div className="admin-section-toolbar">
            <div>
              <strong>{openReportCount} åpne rapporter</strong>
              <p>Ingen auto-skjuling. Du bestemmer hva som skjer med posten.</p>
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
                <h3>Åpne saker</h3>
                <p>Én rad per post med samlet rapportmengde.</p>
              </div>

              <div className="config-list">
                {reportQueue.length > 0 ? (
                  reportQueue.map((reportGroup) => (
                    <article key={reportGroup.submissionId} className="config-row">
                      <div className="config-row__content">
                        <h3>{reportGroup.knotTitle}</h3>
                        <p>
                          {reportGroup.submittedByName} · {reportGroup.count} rapport(er) ·
                          {' '}
                          {reportGroup.latestAtLabel}
                        </p>
                        <p>
                          Grunnlag: {reportGroup.reasons.join(', ')}
                        </p>
                        {reportGroup.notes[0] ? (
                          <p className="submission-note">“{reportGroup.notes[0]}”</p>
                        ) : null}
                      </div>

                      <div className="config-row__actions">
                        <button
                          type="button"
                          className="action-button action-button--ghost"
                          disabled={processingReportId === reportGroup.primaryReportId}
                          onClick={() => handleReportAction(reportGroup.primaryReportId, 'keep')}
                        >
                          Behold post
                        </button>
                        <button
                          type="button"
                          className="action-button action-button--ghost"
                          disabled={processingReportId === reportGroup.primaryReportId}
                          onClick={() =>
                            handleReportAction(reportGroup.primaryReportId, 'remove-feed')
                          }
                        >
                          Fjern fra feed
                        </button>
                        <button
                          type="button"
                          className="action-button action-button--danger"
                          disabled={processingReportId === reportGroup.primaryReportId}
                          onClick={() =>
                            handleReportAction(reportGroup.primaryReportId, 'reverse-approval')
                          }
                        >
                          Reverser godkjenning
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="folder-empty">Ingen åpne rapporter akkurat nå.</p>
                )}
              </div>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {activeAdminTask === 'bans' ? (
        <SectionCard
          title="Bans"
          description="Midlertidig blokkering av feed-posting eller innsending."
        >
          <div className="admin-section-toolbar">
            <div>
              <strong>{activeBanCount} aktive bans</strong>
              <p>Varighet: 24t, 3 dager eller 1 uke.</p>
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
                <h3>Opprett ban</h3>
                <p>Velg bruker, type og varighet.</p>
              </div>

              <div className="admin-setup admin-setup--bans">
                <label className="field-group field-group--small">
                  <span>Bruker</span>
                  <select
                    className="text-input"
                    value={selectedBanUserId}
                    onChange={(event) => setSelectedBanUserId(event.target.value)}
                  >
                    <option value="">Velg bruker</option>
                    {banCandidates.map((leader) => (
                      <option key={leader.id} value={leader.id}>
                        {leader.russName ?? leader.name} ({leader.className ?? leader.group})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-group field-group--small">
                  <span>Type</span>
                  <select
                    className="text-input"
                    value={selectedBanType}
                    onChange={(event) => setSelectedBanType(event.target.value)}
                  >
                    {BAN_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-group field-group--small">
                  <span>Varighet</span>
                  <select
                    className="text-input"
                    value={selectedBanDurationHours}
                    onChange={(event) =>
                      setSelectedBanDurationHours(Number(event.target.value))
                    }
                  >
                    {BAN_DURATION_OPTIONS.map((option) => (
                      <option key={option.hours} value={option.hours}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="admin-setup__actions">
                  <button
                    type="button"
                    className="action-button"
                    onClick={handleCreateBanSubmit}
                  >
                    Opprett ban
                  </button>
                </div>
              </div>
            </div>

            <div className="admin-subsection">
              <div className="section-card__header">
                <h3>Aktive bans</h3>
                <p>Opphev manuelt ved behov.</p>
              </div>

              <div className="config-list">
                {activeBans.length > 0 ? (
                  activeBans.map((ban) => (
                    <article key={ban.id} className="config-row">
                      <div className="config-row__content">
                        <h3>{ban.userName}</h3>
                        <p>
                          {ban.type === 'feed'
                            ? 'Feed-ban (kun posting)'
                            : 'Innsendings-ban (knuter + knuteoff)'}
                        </p>
                        <p>
                          Gjenstår {ban.remainingLabel} · Utløper {ban.expiresAtLabel}
                        </p>
                      </div>
                      <div className="config-row__actions">
                        <button
                          type="button"
                          className="action-button action-button--danger"
                          disabled={processingBanId === ban.id}
                          onClick={() => handleRemoveBanClick(ban.id)}
                        >
                          {processingBanId === ban.id ? 'Opphever...' : 'Opphev nå'}
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="folder-empty">Ingen aktive bans akkurat nå.</p>
                )}
              </div>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {activeAdminTask === 'users' ? (
        <UserAdminPanel sessionToken={sessionToken} />
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
              <button
                type="button"
                className="admin-quick-card"
                onClick={() => setActiveAdminTask('reports')}
              >
                <strong>Moderer rapporter</strong>
                <p>{openReportCount} åpne rapport-saker</p>
              </button>
              <button
                type="button"
                className="admin-quick-card"
                onClick={() => setActiveAdminTask('bans')}
              >
                <strong>Bans</strong>
                <p>{activeBanCount} aktive bans nå</p>
              </button>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}


