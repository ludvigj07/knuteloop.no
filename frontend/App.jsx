import { useEffect, useMemo, useState } from 'react';
import './App.css';
import './styles/blaruss-refresh.css';
import { SwipeTabsShell } from './components/SwipeTabsShell.jsx';
import {
  buildActivityLog,
  buildClassLeaderboard,
  buildDashboardData,
  buildDailyKnot,
  buildDuelAvailability,
  buildDuelHistory,
  buildGenderLeaderboards,
  buildKnotTypeLeaderboard,
  buildLeaderboard,
  buildProfiles,
  DUEL_DAILY_LIMIT,
  DUEL_LIMITS_DISABLED,
  DUEL_RANGE,
  DUEL_STAKE,
  DUEL_WINDOW_HOURS,
} from './data/appHelpers.js';
import { buildAchievements } from './data/badgeSystem.js';
import {
  completeDuel,
  convertToMp4,
  createBan,
  deleteKnot,
  deleteSubmission,
  setKnotVisibility,
  fetchBootstrap,
  fetchPilotUsers,
  getStoredSessionToken,
  importKnots,
  loginWithCode,
  logout,
  readFileAsDataUrl,
  rateSubmission,
  removeBan,
  reportSubmission,
  reviewReport,
  reviewDuelCompletion,
  resolveDuel,
  reviewSubmission,
  startDuel,
  storeSessionToken,
  submitKnot,
  updateKnotFeedbackMessages,
  updateKnotPoints,
  updateProfile,
} from './data/api.js';
import { AdminPage } from './pages/AdminPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { FeedPage } from './pages/FeedPageV2.jsx';
import { KnotsPage } from './pages/KnotsPage.jsx';
import { LeaderboardPage } from './pages/LeaderboardPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { ProfilesPage } from './pages/ProfilesPage.jsx';
import { StatusPage } from './pages/StatusPage.jsx';

const PAGE_CONFIG = {
  dashboard: {
    id: 'dashboard',
    label: 'Hjem',
    shortLabel: 'Hjem',
    icon: '\u2302',
    title: 'Hjem',
    description: 'En rolig oversikt over dagens knuter og aktivitet i kullet.',
  },
  knuter: {
    id: 'knuter',
    label: 'Knuter',
    shortLabel: 'Knuter',
    icon: '\u2630',
    title: 'Knuter',
    description: 'Velg knuter i eget tempo, og del det du har gjort.',
  },
  leaderboard: {
    id: 'leaderboard',
    label: 'Toppliste',
    shortLabel: 'Topp',
    icon: '\u{1F3C6}',
    title: 'Topplisten',
    description: 'Se deltakelse i kullet på en vennlig og lavterskel måte.',
  },
  profiler: {
    id: 'profiler',
    label: 'Profil',
    shortLabel: 'Profil',
    icon: '\u263A',
    title: 'Profil',
    description: 'Profiler, merker og det som gjør hver person unik.',
  },
  feed: {
    id: 'feed',
    label: 'Feed',
    shortLabel: 'Feed',
    icon: '\u25B6',
    title: 'Feed',
    description: 'Delte øyeblikk fra godkjente knuter i en rolig kortfeed.',
  },
  status: {
    id: 'status',
    label: 'Status',
    shortLabel: 'Status',
    icon: '\u2726',
    title: 'Status',
    description: 'Badges, feed og knute-off samlet i en enkel oversikt.',
  },
  admin: {
    id: 'admin',
    label: 'Admin',
    shortLabel: 'Admin',
    icon: '\u26E8',
    title: 'Admin',
    description: 'Innsendinger, knuter og adminoppgaver i én arbeidsflate.',
  },
};

const USER_PAGE_ORDER = ['dashboard', 'knuter', 'leaderboard', 'feed', 'profiler', 'status'];
const ADMIN_PAGE_ORDER = ['dashboard', 'knuter', 'leaderboard', 'feed', 'profiler', 'admin'];

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [profileViewMode, setProfileViewMode] = useState('overview');
  const [focusedKnotId, setFocusedKnotId] = useState(null);
  const [focusedKnotScrollRequest, setFocusedKnotScrollRequest] = useState(0);
  const [sessionToken, setSessionToken] = useState(() => getStoredSessionToken());
  const [appData, setAppData] = useState(null);
  const [pilotUsers, setPilotUsers] = useState([]);
  const [loginCode, setLoginCode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [appError, setAppError] = useState('');
  const [isLoadingApp, setIsLoadingApp] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const currentUser = appData?.currentUser ?? null;
  const knots = appData?.knots ?? EMPTY_ARRAY;
  const submissions = appData?.submissions ?? EMPTY_ARRAY;
  const duels = appData?.duels ?? EMPTY_ARRAY;
  const reports = appData?.reports ?? EMPTY_ARRAY;
  const bans = appData?.bans ?? EMPTY_ARRAY;
  const currentUserActiveBans = appData?.currentUserActiveBans ?? EMPTY_ARRAY;
  const currentUserStreak = appData?.currentUserStreak ?? {
    current: 0,
    todayQualified: false,
    currentBonusPercent: 0,
    currentBonusPointsCap: 6,
    lastQualifiedDayKey: null,
  };
  const profileDetails = appData?.profileDetails ?? EMPTY_OBJECT;
  const profileHistory = appData?.profileHistory ?? EMPTY_OBJECT;
  const knotFeedbackMessages = appData?.knotFeedbackMessages ?? EMPTY_OBJECT;
  const baseLeaders = appData?.leaders ?? EMPTY_ARRAY;

  const leaders = useMemo(
    () =>
      currentUser
        ? buildLeaderboard(
            baseLeaders,
            submissions,
            knots,
            currentUser.leaderId,
            duels,
          )
        : [],
    [baseLeaders, currentUser, duels, knots, submissions],
  );
  const currentLeader = currentUser
    ? leaders.find((leader) => leader.id === currentUser.leaderId)
    : null;
  const achievements = useMemo(
    () => buildAchievements(knots, currentLeader),
    [currentLeader, knots],
  );
  const profiles = useMemo(
    () =>
      currentUser
        ? buildProfiles(
            leaders,
            currentUser.leaderId,
            knots,
            submissions,
            profileHistory,
            profileDetails,
          )
        : [],
    [currentUser, knots, leaders, profileDetails, profileHistory, submissions],
  );
  const currentProfile = currentUser
    ? profiles.find((profile) => profile.id === currentUser.leaderId) ?? profiles[0]
    : null;
  const selectedProfile =
    profiles.find((profile) => profile.id === selectedProfileId) ?? profiles[0];
  const displayLeaders = useMemo(
    () =>
      leaders.map((leader) => {
        const profile = profiles.find((candidate) => candidate.id === leader.id);

        return profile
          ? {
              ...leader,
              icon: profile.icon,
              leaderboardTitle: profile.leaderboardTitle,
              photoUrl: profile.photoUrl,
              russName: profile.russName,
              realName: profile.realName,
              className: profile.className,
              genderIdentity: profile.genderIdentity,
            }
          : leader;
      }),
    [leaders, profiles],
  );
  const activityLog = useMemo(
    () => buildActivityLog(profiles, submissions),
    [profiles, submissions],
  );
  const classLeaderboard = useMemo(
    () => buildClassLeaderboard(displayLeaders),
    [displayLeaders],
  );
  const knotTypeLeaderboard = useMemo(
    () => buildKnotTypeLeaderboard(submissions, knots),
    [knots, submissions],
  );
  const genderLeaderboards = useMemo(
    () => buildGenderLeaderboards(displayLeaders),
    [displayLeaders],
  );
  const dailyKnot = useMemo(() => buildDailyKnot(knots), [knots]);
  const duelAvailability = currentUser
    ? buildDuelAvailability(currentUser.leaderId, displayLeaders, duels)
    : { byLeaderId: {}, currentUserDailyCount: 0, currentUserRemaining: 0, thisDayTotal: 0 };
  const duelHistory = buildDuelHistory(duels, displayLeaders);
  const duelSummary = {
    stake: DUEL_STAKE,
    range: DUEL_RANGE,
    deadlineHours: DUEL_WINDOW_HOURS,
    dailyLimit: DUEL_LIMITS_DISABLED ? 'Ingen (testmodus)' : DUEL_DAILY_LIMIT,
    currentUserDailyCount: duelAvailability.currentUserDailyCount ?? 0,
    currentUserRemaining: duelAvailability.currentUserRemaining ?? 0,
    thisDayTotal: duelAvailability.thisDayTotal ?? 0,
    activeCount: duels.filter((duel) => duel.status === 'active').length,
  };
  const dashboardData =
    currentUser && currentLeader
      ? buildDashboardData(
          currentUser.leaderId,
          displayLeaders,
          achievements,
          activityLog,
          knots,
        )
      : {
          stats: [],
          messages: [],
          rivals: [],
          recentActivity: [],
          nextRank: null,
          nextAchievement: null,
          rankProgress: null,
          recommendedKnot: null,
          weeklyTopPost: null,
          weeklyPostMinRatings: 10,
          currentLeader: null,
        };

  const approvedKnots = knots.filter((knot) => knot.status === 'Godkjent').length;
  const pendingSubmissions = submissions.filter(
    (submission) => submission.status === 'Venter',
  ).length;
  const adminStats = [
    {
      label: 'Totale knuter',
      value: knots.length,
      note: 'Hentes fra backend og er felles for skolen',
    },
    {
      label: 'Godkjente knuter',
      value: approvedKnots,
      note: `Bruker: ${currentUser?.name ?? '-'}`,
    },
    {
      label: 'Venter behandling',
      value: pendingSubmissions,
      note: 'Oppdateres direkte fra lagret data',
    },
    {
      label: 'Knute-offs i dag',
      value: duelSummary.thisDayTotal,
      note: `Fast innsats: ${duelSummary.stake} poeng`,
    },
    {
      label: 'Aktive knute-offs',
      value: duelSummary.activeCount,
      note: `${duelSummary.deadlineHours} timers frist`,
    },
  ];

  const pageOrder = currentUser?.role === 'admin' ? ADMIN_PAGE_ORDER : USER_PAGE_ORDER;
  const visiblePages = pageOrder.map((pageId) => PAGE_CONFIG[pageId]);
  const currentPage = visiblePages.find((page) => page.id === activePage) ?? visiblePages[0];

  useEffect(() => {
    fetchPilotUsers()
      .then((result) => setPilotUsers(result?.users ?? []))
      .catch(() => setPilotUsers([]));
  }, []);

  useEffect(() => {
    if (!sessionToken) {
      setIsLoadingApp(false);
      return;
    }

    fetchBootstrap(sessionToken)
      .then((nextAppData) => {
        setAppData(nextAppData);
        setIsLoadingApp(false);
        setAppError('');
      })
      .catch((error) => {
        storeSessionToken('');
        setSessionToken('');
        setAppData(null);
        setAppError(error.message);
        setIsLoadingApp(false);
      });
  }, [sessionToken]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    if (!selectedProfileId || !profiles.some((profile) => profile.id === selectedProfileId)) {
      setSelectedProfileId(currentUser.leaderId);
    }
  }, [currentUser, profiles, selectedProfileId]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    if (!pageOrder.includes(activePage)) {
      setActivePage(pageOrder[0]);
    }
  }, [activePage, currentUser, pageOrder]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activePage]);

  async function refreshAppData(token = sessionToken) {
    if (!token) {
      setAppData(null);
      setIsLoadingApp(false);
      return null;
    }

    setIsLoadingApp(true);
    setAppError('');

    try {
      const nextAppData = await fetchBootstrap(token);
      setAppData(nextAppData);
      setIsLoadingApp(false);
      return nextAppData;
    } catch (error) {
      storeSessionToken('');
      setSessionToken('');
      setAppData(null);
      setAppError(error.message);
      setIsLoadingApp(false);
      throw error;
    }
  }

  function handleChangePage(nextPage) {
    setActivePage(nextPage);

    if (nextPage !== 'knuter') {
      setFocusedKnotId(null);
    }

    if (nextPage === 'profiler') {
      setProfileViewMode('overview');
    }
  }

  function handleOpenProfile(profileId) {
    setSelectedProfileId(profileId);
    setProfileViewMode('detail');
    setActivePage('profiler');
  }

  function handleBackToProfileOverview() {
    setProfileViewMode('overview');
    setActivePage('profiler');
  }

  function handleOpenDailyKnot(knotId = null) {
    setFocusedKnotId(knotId);
    setFocusedKnotScrollRequest((current) => current + 1);
    setActivePage('knuter');
  }

  async function handleLogin() {
    if (!loginCode.trim()) {
      setLoginError('Skriv inn en kode for å logge inn.');
      return;
    }

    setIsLoggingIn(true);
    setLoginError('');

    try {
      const result = await loginWithCode(loginCode);
      storeSessionToken(result.token);
      setSessionToken(result.token);
      setLoginCode('');
      await refreshAppData(result.token);
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleLogout() {
    try {
      if (sessionToken) {
        await logout(sessionToken);
      }
    } catch {
      // Ignore logout failures and clear local session anyway.
    }

    storeSessionToken('');
    setSessionToken('');
    setAppData(null);
    setSelectedProfileId(null);
    setFocusedKnotId(null);
    setActivePage('dashboard');
  }

  async function handleImportKnots(rawText, defaultPoints, defaultFolder, description) {
    const result = await importKnots(sessionToken, {
      rawText,
      defaultPoints,
      defaultFolder,
      description,
    });

    setAppData(result.app);
    return result.result;
  }

  async function handleUpdateKnotPoints(knotId, nextPoints) {
    const nextAppData = await updateKnotPoints(sessionToken, knotId, nextPoints);
    setAppData(nextAppData);
  }

  async function handleDeleteKnot(knotId) {
    const nextAppData = await deleteKnot(sessionToken, knotId);
    setAppData(nextAppData);
  }

  async function handleUpdateProfile(field, value) {
    const nextFields =
      typeof field === 'object' && field !== null ? field : { [field]: value };
    const photoFile = nextFields.photoFile ?? null;
    const payload = {
      ...nextFields,
      photoFile: undefined,
      photoDataUrl: photoFile ? await readFileAsDataUrl(photoFile) : '',
    };
    const nextAppData = await updateProfile(sessionToken, {
      ...payload,
    });

    setAppData(nextAppData);
  }

  async function handleSubmitKnot(
    knotId,
    evidence = {},
    submissionMode = 'review',
    options = {},
  ) {
    const knot = knots.find((item) => item.id === knotId);

    if (
      !knot ||
      (knot.status !== 'Tilgjengelig' &&
        knot.status !== 'Sendt inn' &&
        knot.status !== 'Avslått' &&
        knot.status !== 'Avslaatt')
    ) {
      return;
    }

    const convertedVideoFile = evidence.videoFile
      ? await convertToMp4(evidence.videoFile)
      : null;
    const normalizedSubmissionMode =
      submissionMode === 'feed' || submissionMode === 'anonymous-feed'
        ? submissionMode
        : 'review';
    const modeTouched = options?.modeTouched === true;
    const shouldSendSubmissionMode =
      knot.status !== 'Sendt inn' || modeTouched;

    const nextAppData = await submitKnot(sessionToken, {
      knotId,
      ...(shouldSendSubmissionMode
        ? { submissionMode: normalizedSubmissionMode }
        : {}),
      note: evidence.note ?? '',
      removeImage: evidence.removeImage === true,
      imageName: evidence.imageName ?? '',
      imageDataUrl: evidence.imageFile
        ? await readFileAsDataUrl(evidence.imageFile)
        : '',
      videoName: convertedVideoFile?.name ?? evidence.videoName ?? '',
      videoDataUrl: convertedVideoFile
        ? await readFileAsDataUrl(convertedVideoFile)
        : '',
    });

    setAppData(nextAppData);
    return nextAppData;
  }

  async function handleReviewSubmission(submissionId, nextStatus) {
    const nextAppData = await reviewSubmission(sessionToken, submissionId, nextStatus);
    setAppData(nextAppData);
  }

  async function handleStartDuel(opponentId) {
    try {
      const nextAppData = await startDuel(sessionToken, opponentId);
      const opponent = displayLeaders.find((leader) => leader.id === opponentId);
      const activeDuel = nextAppData.duels[0];

      setAppData(nextAppData);

      return {
        ok: true,
        message: `Knute-off startet mot ${
          opponent?.russName ?? opponent?.name ?? 'motstander'
        }. Begge fikk "${activeDuel?.knotTitle ?? 'en knute'}".`,
      };
    } catch (error) {
      return {
        ok: false,
        message: error.message,
      };
    }
  }

  async function handleMarkDuelCompleted(
    duelId,
    leaderId = currentUser?.leaderId,
    evidence = {},
  ) {
    if (leaderId !== currentUser?.leaderId) {
      return {
        ok: false,
        message: 'Du kan bare registrere fullføring for din egen knute-off.',
      };
    }

    try {
      const normalizedSubmissionMode =
        evidence.submissionMode === 'anonymous-feed' ||
        evidence.submissionMode === 'review'
          ? evidence.submissionMode
          : 'feed';
      const convertedVideoFile = evidence.videoFile
        ? await convertToMp4(evidence.videoFile)
        : null;
      const nextAppData = await completeDuel(sessionToken, duelId, {
        submissionMode: normalizedSubmissionMode,
        note: evidence.note ?? '',
        imageName: evidence.imageName ?? '',
        imageDataUrl: evidence.imageFile
          ? await readFileAsDataUrl(evidence.imageFile)
          : '',
        videoName: convertedVideoFile?.name ?? evidence.videoName ?? '',
        videoDataUrl: convertedVideoFile
          ? await readFileAsDataUrl(convertedVideoFile)
          : '',
      });

      setAppData(nextAppData);
      return {
        ok: true,
        message:
          normalizedSubmissionMode === 'anonymous-feed'
            ? 'Bevis registrert og lagt anonymt ut i feed med en gang.'
            : normalizedSubmissionMode === 'review'
              ? 'Bevis registrert med en gang. Admin kan fortsatt reversere ved behov.'
              : 'Bevis registrert og lagt ut i feed med en gang.',
      };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'Kunne ikke registrere knute-off akkurat nå.',
      };
    }
  }

  async function handleResolveDuel(duelId) {
    const nextAppData = await resolveDuel(sessionToken, duelId);
    setAppData(nextAppData);
  }

  async function handleReviewDuelCompletion(duelId, participantId, approved) {
    const nextAppData = await reviewDuelCompletion(
      sessionToken,
      duelId,
      participantId,
      approved,
    );
    setAppData(nextAppData);
  }

  async function handleRateSubmission(submissionId, rating) {
    if (!submissionId) {
      return;
    }

    const nextAppData = await rateSubmission(sessionToken, submissionId, rating);
    setAppData(nextAppData);
  }

  async function handleDeleteSubmission(submissionId) {
    if (!submissionId) {
      return;
    }

    const nextAppData = await deleteSubmission(sessionToken, submissionId);
    setAppData(nextAppData);
  }

  async function handleSetKnotVisibility(submissionId, hidden) {
    if (!submissionId) {
      return;
    }

    const nextAppData = await setKnotVisibility(sessionToken, submissionId, hidden);
    setAppData(nextAppData);
  }

  async function handleReportSubmission(submissionId, reason, note = '') {
    if (!submissionId) {
      return;
    }

    const nextAppData = await reportSubmission(sessionToken, submissionId, reason, note);
    setAppData(nextAppData);
  }

  async function handleReviewReport(reportId, action) {
    if (!reportId) {
      return;
    }

    const nextAppData = await reviewReport(sessionToken, reportId, action);
    setAppData(nextAppData);
  }

  async function handleCreateBan(payload) {
    const nextAppData = await createBan(sessionToken, payload);
    setAppData(nextAppData);
  }

  async function handleRemoveBan(banId) {
    if (!banId) {
      return;
    }

    const nextAppData = await removeBan(sessionToken, banId);
    setAppData(nextAppData);
  }

  async function handleUpdateKnotFeedbackMessages(messages) {
    const nextAppData = await updateKnotFeedbackMessages(sessionToken, messages);
    setAppData(nextAppData);
    return nextAppData;
  }

  function renderHeroPanel() {
    return (
      <header className="hero-panel hero-panel--page">
        <div>
          <p className="eyebrow">Live nå</p>
          <div className="hero-chip-row">
            <span className="hero-chip">
              {currentProfile?.leaderboardTitle ?? 'Klar for oversikten'}
            </span>
            <span className="hero-chip hero-chip--accent">
              Plass #{currentLeader?.rank ?? '-'}
            </span>
          </div>
          <h1>Russeknuteportalen</h1>
          <p className="hero-copy">
            {currentProfile?.russName ?? currentUser?.name}, dagens knute er klar,
            og fellesskapet deler nye øyeblikk gjennom hele dagen.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="action-button hero-action-button"
              onClick={() => handleOpenDailyKnot(dailyKnot?.id ?? null)}
            >
              Ta dagens knute
            </button>
            <button
              type="button"
              className="action-button action-button--ghost hero-action-button"
              onClick={() => handleChangePage('leaderboard')}
            >
              Se oversikten
            </button>
            <button
              type="button"
              className="action-button action-button--ghost hero-action-button"
              onClick={handleLogout}
            >
              Logg ut
            </button>
          </div>
        </div>

        <div className="hero-meta">
          <div className="hero-stat">
            <span>Plassering</span>
            <strong>#{currentLeader?.rank ?? '-'}</strong>
          </div>
          <div className="hero-stat">
            <span>Poeng</span>
            <strong>{currentLeader?.points ?? 0}</strong>
          </div>
          <div className="hero-stat">
            <span>Godkjent</span>
            <strong>{approvedKnots}</strong>
          </div>
          <div className="hero-stat">
            <span>Venter</span>
            <strong>{pendingSubmissions}</strong>
          </div>
        </div>
      </header>
    );
  }

  function renderPageContent(page) {
    const commonPageProps = {
      activityLog,
      achievements,
      currentUserId: currentUser.leaderId,
      currentUserRole: currentUser.role,
      currentUserName: currentUser.name,
      currentUserPoints: currentLeader?.points ?? 0,
      currentUserStreak,
      dailyKnot,
      dashboard: dashboardData,
      duelAvailability,
      duelHistory,
      duelSummary,
      duels,
      focusedKnotId,
      focusedKnotScrollRequest,
      bans,
      knots,
      leaders: displayLeaders,
      classLeaderboard,
      knotTypeLeaderboard,
      genderLeaderboards,
      currentUserClassName: currentProfile?.className ?? currentUser?.group ?? 'Ukjent klasse',
      onDeleteKnot: handleDeleteKnot,
      onDeleteSubmission: handleDeleteSubmission,
      onCreateBan: handleCreateBan,
      onImportKnots: handleImportKnots,
      onMarkDuelCompleted: handleMarkDuelCompleted,
      onOpenDailyKnot: handleOpenDailyKnot,
      onOpenProfile: handleOpenProfile,
      onRemoveBan: handleRemoveBan,
      onReportSubmission: handleReportSubmission,
      onReviewReport: handleReviewReport,
      onReviewDuelCompletion: handleReviewDuelCompletion,
      onResolveDuel: handleResolveDuel,
      onReviewSubmission: handleReviewSubmission,
      onSelectProfile: handleOpenProfile,
      onStartDuel: handleStartDuel,
      onSubmitKnot: handleSubmitKnot,
      onUpdateKnotFeedbackMessages: handleUpdateKnotFeedbackMessages,
      onUpdateKnotPoints: handleUpdateKnotPoints,
      onUpdateProfile: handleUpdateProfile,
      knotFeedbackMessages,
      profiles,
      reports,
      currentUserActiveBans,
      selectedProfile,
      stats: adminStats,
      submissions,
    };

    let content = null;

    if (page.id === 'dashboard') {
      content = (
        <DashboardPage
          currentUserId={currentUser.leaderId}
          currentUserStreak={currentUserStreak}
          dailyKnot={dailyKnot}
          dashboard={dashboardData}
          leaders={displayLeaders}
          onOpenDailyKnot={handleOpenDailyKnot}
          onOpenProfile={handleOpenProfile}
        />
      );
    } else if (page.id === 'knuter') {
      content = (
        <KnotsPage
          {...commonPageProps}
          isPageActive={activePage === 'knuter'}
        />
      );
    } else if (page.id === 'leaderboard') {
      content = <LeaderboardPage {...commonPageProps} />;
    } else if (page.id === 'feed') {
      content = (
        <FeedPage
          activityLog={activityLog}
          canDeletePosts={currentUser.role === 'admin'}
          currentUserActiveBans={currentUserActiveBans}
          onDeleteSubmission={handleDeleteSubmission}
          onOpenProfile={handleOpenProfile}
          onReportSubmission={handleReportSubmission}
          onRateSubmission={handleRateSubmission}
        />
      );
    } else if (page.id === 'profiler') {
      content = (
        <ProfilesPage
          {...commonPageProps}
          onBackToOverview={handleBackToProfileOverview}
          onSetKnotVisibility={handleSetKnotVisibility}
          profileViewMode={profileViewMode}
        />
      );
    } else if (page.id === 'status') {
      content = (
        <StatusPage
          achievements={achievements}
          activityLog={activityLog}
          currentUserId={currentUser.leaderId}
          duelHistory={duelHistory}
          duelSummary={duelSummary}
          onOpenFeed={() => handleChangePage('feed')}
          onOpenKnots={() => handleChangePage('knuter')}
          onOpenProfile={handleOpenProfile}
        />
      );
    } else if (page.id === 'admin') {
      content = <AdminPage {...commonPageProps} />;
    }

    return (
      <div className="main-page-panel">
        {page.id === 'dashboard' ? renderHeroPanel() : null}

        <main className="page-layout">
          {page.id !== 'dashboard' ? (
            <section className="page-intro page-intro--shell">
              {page.id === 'knuter' ? (
                <h2>{page.title}</h2>
              ) : (
                <>
                  <p className="eyebrow">Visning</p>
                  <h2>{page.title}</h2>
                  <p>{page.description}</p>
                </>
              )}
            </section>
          ) : null}
          {content}
        </main>
      </div>
    );
  }

  if (isLoadingApp) {
    return (
      <div className="app-theme">
        <div className="app-shell">
          <section className="section-card">
            <p className="eyebrow">Laster</p>
            <h2>Kobler til lagret data</h2>
            <p>Henter brukere, knuter, submissions og profiler fra backend.</p>
          </section>
        </div>
      </div>
    );
  }

  if (!sessionToken || !currentUser || !currentPage) {
    return (
      <div className="app-theme">
        <div className="app-shell">
          <LoginPage
            code={loginCode}
            error={loginError || appError}
            isSubmitting={isLoggingIn}
            onChangeCode={setLoginCode}
            onSubmit={handleLogin}
            pilotUsers={pilotUsers}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app-theme">
      <div className="app-shell">
        <SwipeTabsShell
          pages={visiblePages}
          activePageId={currentPage.id}
          onChangePage={handleChangePage}
          renderPage={renderPageContent}
          mobileOnlySwipe
        />
      </div>
    </div>
  );
}

export default App;
