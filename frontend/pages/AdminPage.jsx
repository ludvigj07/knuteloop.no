import { useEffect, useMemo, useState } from 'react';
import { MobileVideo } from '../components/MobileVideo.jsx';
import { SectionCard } from '../components/SectionCard.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { KNOT_FOLDERS, resolveKnotFolder } from '../data/knotFolders.js';
import { UserAdminPanel } from '../components/UserAdminPanel.jsx';
import { BulkRussNameAssign } from '../components/BulkRussNameAssign.jsx';

const FOLDER_NAME_TO_ID = {
  sexkategori: 'Sexknuter',
  sexknuter: 'Sexknuter',
  sex: 'Sexknuter',
  rampestreker: 'Fordervett-knuter',
  rampestrek: 'Fordervett-knuter',
  fordervett: 'Fordervett-knuter',
  'fordervett-knuter': 'Fordervett-knuter',
  alkoholkategori: 'Alkoholknuter',
  alkoholknuter: 'Alkoholknuter',
  alkohol: 'Alkoholknuter',
  'dobbelknute-kategori': 'Dobbelknuter',
  dobbelknuter: 'Dobbelknuter',
  dobbelknute: 'Dobbelknuter',
  'generelle knuter': 'Generelle',
  generelle: 'Generelle',
};

function parseStructuredKnotInput(text) {
  const knots = [];
  const errors = [];
  let currentFolder = null;
  let currentFolderName = '';

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) continue;

    const isKnotLine = /^[-*•]\s/.test(line);

    if (isKnotLine) {
      const inner = line.replace(/^[-*•]\s+/, '');
      const parts = inner.split(/\s+[–—-]\s+/);
      if (parts.length < 3) {
        errors.push(`Linje ${i + 1}: må være "- Tittel – Xp – Forklaring": "${line}"`);
        continue;
      }
      const title = parts[0].trim();
      const pointsStr = parts[1].replace(/p\b/i, '').trim();
      const description = parts.slice(2).join(' – ').trim();
      const points = Number.parseInt(pointsStr, 10);
      if (Number.isNaN(points)) {
        errors.push(`Linje ${i + 1}: ugyldig poeng "${parts[1]}"`);
        continue;
      }
      if (!currentFolder) {
        errors.push(`Linje ${i + 1}: knute uten kategori-header over: "${title}"`);
        continue;
      }
      if (!title || !description) {
        errors.push(`Linje ${i + 1}: tittel eller forklaring mangler`);
        continue;
      }
      knots.push({ title, points, description, folder: currentFolder });
    } else {
      const cleaned = line
        .replace(/^\*{1,3}/, '')
        .replace(/\*{1,3}$/, '')
        .replace(/^#+\s*/, '')
        .trim()
        .toLowerCase();
      const folderId = FOLDER_NAME_TO_ID[cleaned];
      if (folderId) {
        currentFolder = folderId;
        currentFolderName = line;
      } else {
        errors.push(`Linje ${i + 1}: ukjent kategori "${line}"`);
      }
    }
  }

  return { knots, errors };
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
  { value: 'submission', label: 'Innsendings-ban (knuter)' },
];

const BAN_DURATION_OPTIONS = [
  { hours: 24, label: '24 timer' },
  { hours: 72, label: '3 dager' },
  { hours: 168, label: '1 uke' },
];

const REVIEW_FILTER = {
  APPROVAL_ONLY: 'approval-only',
  FEED: 'feed',
  REVIEWED: 'reviewed',
};
function toSubmissionKey(id) {
  return String(id ?? '');
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
  const openReports = (reports ?? []).filter(
    (report) =>
      report.status === 'open' && report.type !== 'comment' && !report.commentId,
  );
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

function buildOpenCommentReportQueue(reports) {
  const openReports = (reports ?? []).filter(
    (report) =>
      report.status === 'open' && (report.type === 'comment' || report.commentId),
  );
  const groupedByComment = openReports.reduce((accumulator, report) => {
    const key = report.commentId;
    const currentGroup = accumulator[key] ?? {
      commentId: report.commentId,
      commentText: report.commentText,
      commentAuthorName: report.commentAuthorName,
      knotTitle: report.knotTitle,
      reportIds: [],
      count: 0,
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

    accumulator[key] = currentGroup;
    return accumulator;
  }, {});

  return Object.values(groupedByComment)
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
  reportedSubmissionIdSet = new Set(),
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
        const isReviewing = Boolean(isReviewingById[submissionKey]);
        const hasOpenReport = reportedSubmissionIdSet.has(submissionKey);
        const disableRowActions = disableReviewActions || isReviewing;

        return (
        <article
          key={submission.id}
          className={`submission-row ${isActive ? 'is-active' : ''}`}
          onClick={canReview ? () => onSetActiveSubmission?.(submissionKey) : undefined}
        >
          <div className="submission-row__content">
            <h3>{submission.knotTitle}</h3>
            <p>
              {submission.student} | {submission.submittedAt}
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
            {submissionMode === 'anonymous-feed' || !canReview ? (
              <span className={`pill ${modeMeta.pillClass}`}>{modeMeta.label}</span>
            ) : null}
            {!canReview ? (
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
            ) : null}
            {hasOpenReport ? (
              <span className="pill pill--warning submission-row__flag">Rapportert</span>
            ) : null}
            {canReview ? (
              <>
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
  currentUserId,
  currentUserEmail = '',
  currentUserIsSuperAdmin = false,
  knots,
  leaders = [],
  onDeleteKnot,
  onCreateBan,
  onHideRussnames,
  onImportKnots,
  onRevealRussnames,
  onRemoveBan,
  onReviewReport,
  onReviewSubmission,
  onUpdateKnotPoints,
  reports = [],
  russnamesRevealed = false,
  russnamesRevealedAt = null,
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
  const [structuredBulkText, setStructuredBulkText] = useState('');
  const [structuredBulkBusy, setStructuredBulkBusy] = useState(false);
  const [structuredBulkProgress, setStructuredBulkProgress] = useState({ done: 0, total: 0 });
  const [structuredBulkResult, setStructuredBulkResult] = useState(null);
  const [deleteAllBusy, setDeleteAllBusy] = useState(false);
  const [deleteAllProgress, setDeleteAllProgress] = useState({ done: 0, total: 0 });
  const [activeAdminTask, setActiveAdminTask] = useState('overview');
  const [activeReviewFilter, setActiveReviewFilter] = useState(
    REVIEW_FILTER.APPROVAL_ONLY,
  );
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [selectedBanUserId, setSelectedBanUserId] = useState('');
  const [selectedBanType, setSelectedBanType] = useState(BAN_TYPE_OPTIONS[0].value);
  const [selectedBanDurationHours, setSelectedBanDurationHours] = useState(
    BAN_DURATION_OPTIONS[0].hours,
  );
  const [processingReportId, setProcessingReportId] = useState('');
  const [processingBanId, setProcessingBanId] = useState('');
  const [knotSearch, setKnotSearch] = useState('');
  const [knotFolderFilter, setKnotFolderFilter] = useState('all');
  const [activeSubmissionId, setActiveSubmissionId] = useState('');
  const [reviewingSubmissionIds, setReviewingSubmissionIds] = useState({});
  const [revealRussnamesBusy, setRevealRussnamesBusy] = useState(false);
  const [revealRussnamesError, setRevealRussnamesError] = useState('');

  const pendingSubmissions = submissions.filter(
    (submission) => submission.status === 'Venter',
  );
  const pendingApprovalOnlySubmissions = pendingSubmissions.filter(
    (submission) => getSubmissionMode(submission) === 'review',
  );
  const pendingFeedSubmissions = pendingSubmissions.filter((submission) => {
    const submissionMode = getSubmissionMode(submission);
    return submissionMode === 'feed' || submissionMode === 'anonymous-feed';
  });
  const pendingApprovalOnlyCount = pendingApprovalOnlySubmissions.length;
  const pendingFeedCount = pendingFeedSubmissions.length;
  const resolvedSubmissions = submissions.filter(
    (submission) => submission.status !== 'Venter',
  );

  const pendingSubmissionCount = pendingSubmissions.length;
  const resolvedSubmissionCount = resolvedSubmissions.length;
  const totalKnotCount = knots.length;
  const reportQueue = buildOpenReportQueue(reports);
  const commentReportQueue = buildOpenCommentReportQueue(reports);
  const reportedSubmissionIdSet = useMemo(
    () => new Set(reportQueue.map((report) => toSubmissionKey(report.submissionId))),
    [reportQueue],
  );
  const openReportCount = reportQueue.length + commentReportQueue.length;
  const activeBans = (bans ?? []).filter((ban) => ban.active);
  const activeBanCount = activeBans.length;
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
      id: 'users',
      label: 'Brukere',
      count: Math.max(leaders.length - 1, 0),
      note: 'Kontoer',
    },
    {
      id: 'dap-reveal',
      label: 'Dåp / russenavn',
      count: russnamesRevealed ? 1 : 0,
      note: russnamesRevealed ? 'Avslørt' : 'Hemmelig',
    },
    {
      id: 'overview',
      label: 'Oversikt',
      count: stats.length,
      note: 'Kort',
    },
    ...(currentUserIsSuperAdmin
      ? [
          {
            id: 'knute-deltakere',
            label: 'Knutedeltakere',
            count: knots?.length ?? 0,
            note: 'Kun superadmin',
          },
        ]
      : []),
  ];

  const reviewFilters = [
    {
      id: REVIEW_FILTER.APPROVAL_ONLY,
      label: 'Kun godkjenning',
      count: pendingApprovalOnlyCount,
      description: 'Venter uten feed-post',
    },
    {
      id: REVIEW_FILTER.FEED,
      label: 'Feed-post',
      count: pendingFeedCount,
      description: 'Vanlig og anonym feed',
    },
    {
      id: REVIEW_FILTER.REVIEWED,
      label: 'Vurdert',
      count: resolvedSubmissionCount,
      description: 'Godkjent og avslått',
    },
  ];

  const reviewQueueSubmissions =
    activeReviewFilter === REVIEW_FILTER.REVIEWED
      ? resolvedSubmissions
      : activeReviewFilter === REVIEW_FILTER.FEED
        ? pendingFeedSubmissions
        : pendingApprovalOnlySubmissions;
  const canReviewCurrentFilter = activeReviewFilter !== REVIEW_FILTER.REVIEWED;

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

  useEffect(() => {
    const visibleSubmissionIdSet = new Set(
      reviewQueueSubmissions.map((submission) => toSubmissionKey(submission.id)),
    );

    if (!canReviewCurrentFilter || !reviewQueueSubmissions.length) {
      setActiveSubmissionId('');
      return;
    }

    if (
      !activeSubmissionId ||
      !visibleSubmissionIdSet.has(toSubmissionKey(activeSubmissionId))
    ) {
      setActiveSubmissionId(toSubmissionKey(reviewQueueSubmissions[0].id));
    }
  }, [activeSubmissionId, canReviewCurrentFilter, reviewQueueSubmissions]);

  useEffect(() => {
    if (
      activeAdminTask !== 'submissions' ||
      !canReviewCurrentFilter ||
      !reviewQueueSubmissions.length
    ) {
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

      if (!activeSubmission) {
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
    canReviewCurrentFilter,
    handleReviewAction,
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

  async function handleStructuredImport() {
    setStructuredBulkResult(null);
    const { knots: parsed, errors: parseErrors } = parseStructuredKnotInput(structuredBulkText);
    if (parsed.length === 0) {
      setStructuredBulkResult({
        added: 0,
        failed: 0,
        errors: parseErrors.length > 0 ? parseErrors : ['Fant ingen knuter i input.'],
      });
      return;
    }

    setStructuredBulkBusy(true);
    setStructuredBulkProgress({ done: 0, total: parsed.length });

    let added = 0;
    let failed = 0;
    const runtimeErrors = [...parseErrors];

    for (let i = 0; i < parsed.length; i++) {
      const k = parsed[i];
      try {
        const result = await onImportKnots(k.title, k.points, k.folder, k.description);
        if (result?.added > 0) {
          added += 1;
        } else {
          runtimeErrors.push(`"${k.title}" finnes allerede eller ble hoppet over.`);
          failed += 1;
        }
      } catch (err) {
        runtimeErrors.push(`"${k.title}": ${err.message}`);
        failed += 1;
      } finally {
        setStructuredBulkProgress({ done: i + 1, total: parsed.length });
      }
    }

    setStructuredBulkBusy(false);
    setStructuredBulkResult({ added, failed, errors: runtimeErrors });
    if (added > 0) {
      setStructuredBulkText('');
    }
  }

  async function handleDeleteAllKnots() {
    if (knots.length === 0) {
      setStructuredBulkResult({ added: 0, failed: 0, errors: ['Ingen knuter å slette.'] });
      return;
    }
    const confirmed = window.confirm(
      `Slette ALLE ${knots.length} knuter? Dette kan ikke angres.`,
    );
    if (!confirmed) return;

    setDeleteAllBusy(true);
    setDeleteAllProgress({ done: 0, total: knots.length });
    const errors = [];
    let deleted = 0;

    const snapshot = [...knots];
    for (let i = 0; i < snapshot.length; i++) {
      const k = snapshot[i];
      try {
        await onDeleteKnot(k.id);
        deleted += 1;
      } catch (err) {
        errors.push(`Kunne ikke slette "${k.title}": ${err.message}`);
      } finally {
        setDeleteAllProgress({ done: i + 1, total: snapshot.length });
      }
    }

    setDeleteAllBusy(false);
    setStructuredBulkResult({
      added: 0,
      failed: errors.length,
      errors:
        errors.length > 0
          ? [`Slettet ${deleted} knuter`, ...errors]
          : [`Slettet alle ${deleted} knuter`],
    });
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

    try {
      await onReviewSubmission(submission.id, nextStatus);

      if (silent) {
        return true;
      }

      if (nextStatus === 'Godkjent') {
        setReviewFeedback(`"${submission.knotTitle}" ble godkjent (${modeMeta.label}).`);
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

  async function handleReportAction(reportId, action) {
    if (!onReviewReport || !reportId) {
      return;
    }

    setProcessingReportId(reportId);

    try {
      await onReviewReport(reportId, action);
      setReviewFeedback(
        action === 'keep'
          ? 'Rapport er lukket uten endring.'
          : action === 'delete-comment'
            ? 'Kommentaren er slettet og rapportene er håndtert.'
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
    <div className="stack-layout admin-page">
      <div className="admin-task-shell">
        <nav className="admin-task-nav" aria-label="Adminområde">
          {adminTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              className={`admin-task-button ${activeAdminTask === task.id ? 'is-active' : ''}`}
              aria-pressed={activeAdminTask === task.id}
              onClick={() => setActiveAdminTask(task.id)}
            >
              <span className="admin-task-button__content">
                <strong>{task.label}</strong>
                <span>{task.note}</span>
              </span>
              <span className="admin-task-button__badge">{task.count}</span>
            </button>
          ))}
        </nav>
      </div>

      {activeAdminTask === 'submissions' ? (
        <div className="admin-submissions-workspace">
          <div className="admin-section-toolbar">
            <div className="admin-section-toolbar__actions">
              <button
                type="button"
                className="action-button action-button--ghost admin-shortcut"
                onClick={() => setActiveAdminTask('overview')}
              >
                Se oversikt
              </button>
            </div>
          </div>

          <div className="admin-task-panel">
            <div className="admin-review-toolbar">
              <div className="admin-review-filters" aria-label="Filtrer innsendinger">
                {reviewFilters.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    className={`admin-review-filter ${
                      activeReviewFilter === filter.id ? 'is-active' : ''
                    }`}
                    onClick={() => setActiveReviewFilter(filter.id)}
                  >
                    <span>{filter.label}</span>
                    <strong>{filter.count}</strong>
                  </button>
                ))}
              </div>
            </div>
            <SubmissionList
              items={reviewQueueSubmissions}
              canReview={canReviewCurrentFilter}
              onReviewAction={handleReviewAction}
              activeSubmissionId={activeSubmissionId}
              isReviewingById={reviewingSubmissionIds}
              onSetActiveSubmission={setActiveSubmissionId}
              reportedSubmissionIdSet={reportedSubmissionIdSet}
            />
          </div>
        </div>
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
                className="action-button action-button--ghost admin-shortcut"
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

                <details className="admin-bulk-details" open>
                  <summary>Strukturert bulk-import (kategori + poeng + forklaring per linje)</summary>
                  <div className="admin-setup__bulk">
                    <p style={{ margin: '0.5rem 0', fontSize: '0.85rem' }}>
                      Format: <strong>kategori-header på egen linje</strong>, deretter knuter
                      som <code>- Tittel – Xp – Forklaring</code>. Bruk <code>**</code> rundt
                      headeren om du vil. Hver kategori gjelder for alle knuter til neste header.
                    </p>
                    <label className="field-group">
                      <span>Lim inn liste</span>
                      <textarea
                        className="text-input text-input--area"
                        rows={12}
                        placeholder={
                          '**Sexkategori**\n- Konglå – 50p – Ha sex ute\n- Gullkonglå – 60p – Ha sex i et tre\n\n**Rampestreker**\n- Smiskeren – 40p – Få et kyss på kinnet av en lærer'
                        }
                        value={structuredBulkText}
                        onChange={(event) => setStructuredBulkText(event.target.value)}
                        disabled={structuredBulkBusy || deleteAllBusy}
                        style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem' }}
                      />
                    </label>

                    {structuredBulkBusy ? (
                      <p style={{ margin: 0 }}>
                        Importerer... ({structuredBulkProgress.done} / {structuredBulkProgress.total})
                      </p>
                    ) : null}
                    {deleteAllBusy ? (
                      <p style={{ margin: 0 }}>
                        Sletter... ({deleteAllProgress.done} / {deleteAllProgress.total})
                      </p>
                    ) : null}

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="action-button"
                        disabled={!structuredBulkText.trim() || structuredBulkBusy || deleteAllBusy}
                        onClick={handleStructuredImport}
                      >
                        {structuredBulkBusy ? 'Importerer...' : 'Importer alle'}
                      </button>
                      <button
                        type="button"
                        className="action-button action-button--ghost"
                        style={{ color: '#a33', borderColor: '#a33' }}
                        disabled={deleteAllBusy || structuredBulkBusy || knots.length === 0}
                        onClick={handleDeleteAllKnots}
                      >
                        {deleteAllBusy
                          ? 'Sletter...'
                          : `Slett alle ${knots.length} eksisterende knuter`}
                      </button>
                    </div>

                    {structuredBulkResult ? (
                      <div
                        style={{
                          marginTop: '0.75rem',
                          padding: '0.75rem',
                          background: 'var(--color-surface-raised, #f5f5ff)',
                          borderRadius: 6,
                        }}
                      >
                        <strong>
                          {structuredBulkResult.added > 0
                            ? `La til ${structuredBulkResult.added} knuter`
                            : 'Resultat'}
                          {structuredBulkResult.failed > 0
                            ? ` · ${structuredBulkResult.failed} feilet`
                            : ''}
                        </strong>
                        {structuredBulkResult.errors.length > 0 ? (
                          <ul style={{ margin: '0.5rem 0 0 1rem', fontSize: '0.85rem' }}>
                            {structuredBulkResult.errors.map((err, idx) => (
                              <li key={idx}>{err}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </details>
              </div>
            </div>

            <div className="admin-subsection">
              <div className="section-card__header">
                <h3>Poeng og sletting</h3>
                <p>Juster poeng eller fjern knuter direkte her.</p>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
                <input
                  type="search"
                  className="text-input"
                  placeholder="Søk knute…"
                  value={knotSearch}
                  onChange={(event) => setKnotSearch(event.target.value)}
                  style={{ flex: '1 1 180px', minWidth: 140 }}
                />
                <select
                  className="text-input"
                  value={knotFolderFilter}
                  onChange={(event) => setKnotFolderFilter(event.target.value)}
                >
                  <option value="all">Alle mapper</option>
                  {KNOT_FOLDERS.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="config-list">
                {knots
                  .filter((knot) => {
                    if (knotFolderFilter !== 'all' && resolveKnotFolder(knot) !== knotFolderFilter) {
                      return false;
                    }
                    const needle = knotSearch.trim().toLowerCase();
                    if (!needle) return true;
                    return (knot.title ?? '').toLowerCase().includes(needle);
                  })
                  .map((knot) => (
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
                className="action-button action-button--ghost admin-shortcut"
                onClick={() => setActiveAdminTask('submissions')}
              >
                Til innsendinger
              </button>
            </div>
          </div>

          <div className="admin-task-panel">
            <div className="admin-subsection">
              <div className="section-card__header">
                <h3>Rapporterte feed-poster</h3>
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
                          <p className="submission-note">"{reportGroup.notes[0]}"</p>
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
                  <p className="folder-empty">Ingen rapporterte poster akkurat nå.</p>
                )}
              </div>
            </div>

            <div className="admin-subsection">
              <div className="section-card__header">
                <h3>Rapporterte kommentarer</h3>
                <p>Én rad per kommentar med samlet rapportmengde.</p>
              </div>

              <div className="config-list">
                {commentReportQueue.length > 0 ? (
                  commentReportQueue.map((reportGroup) => (
                    <article key={reportGroup.commentId} className="config-row">
                      <div className="config-row__content">
                        <h3>{reportGroup.knotTitle}</h3>
                        <p>
                          {reportGroup.commentAuthorName ?? 'Ukjent'} · {reportGroup.count} rapport(er) ·
                          {' '}
                          {reportGroup.latestAtLabel}
                        </p>
                        {reportGroup.commentText ? (
                          <p className="submission-note">"{reportGroup.commentText}"</p>
                        ) : null}
                        <p>
                          Grunnlag: {reportGroup.reasons.join(', ')}
                        </p>
                        {reportGroup.notes[0] ? (
                          <p className="submission-note">Admin-notat: "{reportGroup.notes[0]}"</p>
                        ) : null}
                      </div>

                      <div className="config-row__actions">
                        <button
                          type="button"
                          className="action-button action-button--ghost"
                          disabled={processingReportId === reportGroup.primaryReportId}
                          onClick={() => handleReportAction(reportGroup.primaryReportId, 'keep')}
                        >
                          Behold kommentar
                        </button>
                        <button
                          type="button"
                          className="action-button action-button--danger"
                          disabled={processingReportId === reportGroup.primaryReportId}
                          onClick={() =>
                            handleReportAction(reportGroup.primaryReportId, 'delete-comment')
                          }
                        >
                          Slett kommentar
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="folder-empty">Ingen rapporterte kommentarer akkurat nå.</p>
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
                className="action-button action-button--ghost admin-shortcut"
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
                            : 'Innsendings-ban (knuter)'}
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
        <UserAdminPanel
          sessionToken={sessionToken}
          currentUserId={currentUserId}
          currentUserEmail={currentUserEmail}
          currentUserIsSuperAdmin={currentUserIsSuperAdmin}
        />
      ) : null}

      {activeAdminTask === 'dap-reveal' ? (
        <SectionCard
          title="Avsløring av russenavn"
          description={
            russnamesRevealed
              ? 'Russenavnene er synlige i appen.'
              : 'Russenavnene er skjult helt til admin trykker på avsløring-knappen.'
          }
        >
          <div className="admin-task-panel">
            {russnamesRevealed ? (
              <>
                <div className="section-card" style={{ background: '#eef7ee' }}>
                  <strong>✓ Russenavnene ble avslørt</strong>
                  <p style={{ marginTop: 4 }}>
                    {russnamesRevealedAt
                      ? new Date(russnamesRevealedAt).toLocaleString('nb-NO', {
                          weekday: 'long',
                          day: '2-digit',
                          month: 'long',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Tidspunkt ukjent'}
                  </p>
                  <p>Alle russer kan nå se hverandres russenavn i feed, toppliste og profiler.</p>
                </div>

                <div style={{ marginTop: '1.5rem' }}>
                  <strong>Skjul russenavn igjen?</strong>
                  <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                    Bruk denne hvis du trykket avslør for tidlig. Russenavnene forsvinner ut av
                    appen umiddelbart, og ekte navn vises i stedet.
                  </p>
                  <button
                    type="button"
                    className="action-button action-button--ghost"
                    disabled={revealRussnamesBusy}
                    onClick={async () => {
                      const ok = window.confirm(
                        'Sikker på at du vil skjule russenavnene igjen? Alle russer mister tilgang til russenavn-visning umiddelbart.',
                      );
                      if (!ok) return;
                      setRevealRussnamesBusy(true);
                      setRevealRussnamesError('');
                      try {
                        await onHideRussnames();
                      } catch (error) {
                        setRevealRussnamesError(
                          error instanceof Error ? error.message : 'Kunne ikke skjule russenavn.',
                        );
                      } finally {
                        setRevealRussnamesBusy(false);
                      }
                    }}
                  >
                    {revealRussnamesBusy ? 'Skjuler…' : 'Skjul russenavn igjen'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="section-card" style={{ background: '#fff7ed' }}>
                  <strong>🔒 Russenavn er hemmelig</strong>
                  <p style={{ marginTop: 4 }}>
                    Ingen — ikke engang den enkelte russen selv — kan se russenavn i appen
                    før du trykker avsløring-knappen.
                  </p>
                  <p>
                    Russenavnene ligger trygt i databasen og strippes ut av API-responsen
                    inntil avsløringen skjer.
                  </p>
                </div>

                <div style={{ marginTop: '1.5rem' }}>
                  <strong>Avslør alle russenavn nå</strong>
                  <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                    Trykk når dåpsseremonien er ferdig. Alle russer ser russenavn umiddelbart,
                    overalt i appen.
                  </p>
                  <button
                    type="button"
                    className="action-button"
                    disabled={revealRussnamesBusy}
                    onClick={async () => {
                      const ok = window.confirm(
                        'Sikker på at du vil avsløre alle russenavn nå? Dette er synlig for alle russer umiddelbart.',
                      );
                      if (!ok) return;
                      setRevealRussnamesBusy(true);
                      setRevealRussnamesError('');
                      try {
                        await onRevealRussnames();
                      } catch (error) {
                        setRevealRussnamesError(
                          error instanceof Error ? error.message : 'Kunne ikke avsløre russenavn.',
                        );
                      } finally {
                        setRevealRussnamesBusy(false);
                      }
                    }}
                    style={{
                      fontSize: '1.1rem',
                      padding: '0.9rem 1.5rem',
                      marginTop: '0.5rem',
                    }}
                  >
                    {revealRussnamesBusy ? 'Avslører…' : '🎭 Avslør alle russenavn'}
                  </button>
                </div>
              </>
            )}
            {revealRussnamesError ? (
              <p className="form-feedback form-feedback--error" style={{ marginTop: '1rem' }}>
                {revealRussnamesError}
              </p>
            ) : null}

            <BulkRussNameAssign sessionToken={sessionToken} />
          </div>
        </SectionCard>
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
                className="action-button admin-shortcut"
                onClick={() => setActiveAdminTask('submissions')}
              >
                Gå til ventende
              </button>
              <button
                type="button"
                className="action-button action-button--ghost admin-shortcut"
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

      {activeAdminTask === 'knute-deltakere' && currentUserIsSuperAdmin ? (
        <KnuteDeltakerePanel
          knots={knots}
          submissions={submissions}
          leaders={leaders}
        />
      ) : null}
    </div>
  );
}

function SubmissionDocModal({ sub, leaderName, onClose }) {
  const hasImage = Boolean(sub.imagePreviewUrl);
  const hasVideo = Boolean(sub.videoPreviewUrl);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: '14px',
          maxWidth: '480px', width: '100%',
          maxHeight: '90vh', overflowY: 'auto',
          padding: '20px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <strong style={{ fontSize: '1rem' }}>{leaderName}</strong>
            <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'rgba(26,37,64,0.55)' }}>
              {sub.knotTitle} · {sub.submittedAt}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.4rem', lineHeight: 1, padding: '0 0 0 12px' }}
            aria-label="Lukk"
          >
            ×
          </button>
        </div>

        {hasVideo ? (
          <video
            src={sub.videoPreviewUrl}
            controls
            playsInline
            style={{ width: '100%', borderRadius: '8px', background: '#000', maxHeight: '320px' }}
          />
        ) : hasImage ? (
          <img
            src={sub.imagePreviewUrl}
            alt="Dokumentasjon"
            style={{ width: '100%', borderRadius: '8px', objectFit: 'contain', maxHeight: '320px' }}
          />
        ) : (
          <p style={{ color: 'rgba(26,37,64,0.5)', fontStyle: 'italic' }}>Ingen bilder eller video levert inn.</p>
        )}

        {sub.note ? (
          <p style={{ marginTop: '12px', fontSize: '0.9rem', background: 'rgba(26,37,64,0.04)', borderRadius: '8px', padding: '10px 12px' }}>
            {sub.note}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function KnuteDeltakerePanel({ knots = [], submissions = [], leaders = [] }) {
  const [search, setSearch] = useState('');
  const [selectedSub, setSelectedSub] = useState(null);

  const leaderById = useMemo(() => {
    const map = new Map();
    for (const l of leaders) map.set(String(l.id), l);
    return map;
  }, [leaders]);

  const approvedByKnotTitle = useMemo(() => {
    const map = new Map();
    for (const sub of submissions) {
      if (sub.status !== 'Godkjent') continue;
      const title = String(sub.knotTitle ?? '').trim();
      if (!title) continue;
      if (!map.has(title)) map.set(title, []);
      map.get(title).push(sub);
    }
    return map;
  }, [submissions]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredKnots = useMemo(() => {
    return [...knots]
      .sort((a, b) => String(a.title ?? '').localeCompare(String(b.title ?? ''), 'nb'))
      .filter((k) => {
        if (!normalizedSearch) return true;
        return String(k.title ?? '').toLowerCase().includes(normalizedSearch);
      });
  }, [knots, normalizedSearch]);

  const selectedLeaderName = selectedSub
    ? (() => {
        const l = leaderById.get(String(selectedSub.leaderId));
        return l?.russName || l?.name || `Bruker ${selectedSub.leaderId}`;
      })()
    : '';

  return (
    <>
      {selectedSub ? (
        <SubmissionDocModal
          sub={selectedSub}
          leaderName={selectedLeaderName}
          onClose={() => setSelectedSub(null)}
        />
      ) : null}
    <SectionCard
      title="Knutedeltakere"
      description="Oversikt over hvem som har tatt hvilke knuter. Klikk på et navn for å se dokumentasjonen."
    >
      <div style={{ marginBottom: '12px' }}>
        <input
          type="search"
          className="text-input"
          placeholder="Søk etter knutenavn…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', maxWidth: '360px' }}
        />
      </div>
      <div className="stack-layout" style={{ gap: '12px' }}>
        {filteredKnots.map((knot) => {
          const subs = approvedByKnotTitle.get(String(knot.title ?? '').trim()) ?? [];
          return (
            <div
              key={knot.id}
              style={{
                background: 'var(--card, #fff)',
                border: '1px solid rgba(26,37,64,0.12)',
                borderRadius: '10px',
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: subs.length ? '8px' : 0 }}>
                <strong style={{ flex: 1 }}>{knot.title}</strong>
                <span
                  style={{
                    background: subs.length ? '#e8f5e9' : 'rgba(26,37,64,0.06)',
                    color: subs.length ? '#2e7d32' : 'rgba(26,37,64,0.5)',
                    borderRadius: '999px',
                    padding: '2px 10px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                  }}
                >
                  {subs.length} tatt
                </span>
              </div>
              {subs.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {subs.map((sub) => {
                    const leader = leaderById.get(String(sub.leaderId));
                    const name = leader?.russName || leader?.name || `Bruker ${sub.leaderId}`;
                    const cls = leader?.className ? ` (${leader.className})` : '';
                    const hasMedia = Boolean(sub.imagePreviewUrl || sub.videoPreviewUrl);
                    return (
                      <button
                        key={sub.id ?? sub.leaderId}
                        type="button"
                        onClick={() => setSelectedSub(sub)}
                        title={hasMedia ? 'Klikk for å se dokumentasjon' : 'Ingen media levert inn'}
                        style={{
                          background: hasMedia ? 'rgba(26,37,64,0.08)' : 'rgba(26,37,64,0.04)',
                          border: 'none',
                          borderRadius: '999px',
                          padding: '4px 12px',
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          textDecoration: hasMedia ? 'underline dotted' : 'none',
                          color: 'inherit',
                        }}
                      >
                        {name}{cls}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
        {filteredKnots.length === 0 ? (
          <p style={{ color: 'rgba(26,37,64,0.5)' }}>Ingen knuter matcher søket.</p>
        ) : null}
      </div>
    </SectionCard>
    </>
  );
}


