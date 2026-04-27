import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Home, Play, Shield, Trophy, User } from 'lucide-react';
import { KnotIcon } from './components/KnotIcon.jsx';
import './App.css';
import './styles/blaruss-refresh.css';
import { LiveOnboarding } from './components/LiveOnboarding.jsx';
import { SettingsModal } from './components/SettingsModal.jsx';
import { SwipeTabsShell } from './components/SwipeTabsShell.jsx';
import { Toast } from './components/Toast.jsx';
import {
  assertVideoWithinLimits,
  changeOwnPassword,
  completeDuel,
  createBan,
  createComment,
  deleteComment,
  deleteKnot,
  deleteOwnAccount,
  deleteSubmission,
  likeComment,
  reportComment,
  setKnotVisibility,
  fetchBootstrap,
  fetchPilotUsers,
  getStoredSessionToken,
  importKnots,
  loginWithCode,
  loginWithEmailPassword,
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
    icon: <Home size={22} strokeWidth={1.8} />,
    title: 'Hjem',
    description: 'En rolig oversikt over dagens knuter og aktivitet i kullet.',
  },
  knuter: {
    id: 'knuter',
    label: 'Knuter',
    shortLabel: 'Knuter',
    icon: <KnotIcon size={22} strokeWidth={1.8} />,
    title: 'Knuter',
    description: 'Velg knuter i eget tempo, og del det du har gjort.',
  },
  leaderboard: {
    id: 'leaderboard',
    label: 'Toppliste',
    shortLabel: 'Topp',
    icon: <Trophy size={22} strokeWidth={1.8} />,
    title: 'Topplisten',
    description: 'Se deltakelse i kullet på en vennlig og lavterskel måte.',
  },
  profiler: {
    id: 'profiler',
    label: 'Profil',
    shortLabel: 'Profil',
    icon: <User size={22} strokeWidth={1.8} />,
    title: 'Profil',
    description: 'Profiler, merker og det som gjør hver person unik.',
  },
  feed: {
    id: 'feed',
    label: 'Feed',
    shortLabel: 'Feed',
    icon: <Play size={22} strokeWidth={1.8} />,
    title: 'Feed',
    description: 'Delte øyeblikk fra godkjente knuter i en rolig kortfeed.',
  },
  status: {
    id: 'status',
    label: 'Status',
    shortLabel: 'Status',
    icon: <Activity size={22} strokeWidth={1.8} />,
    title: 'Status',
    description: 'Badges, feed og knute-off samlet i en enkel oversikt.',
  },
  admin: {
    id: 'admin',
    label: 'Admin',
    shortLabel: 'Admin',
    icon: <Shield size={22} strokeWidth={1.8} />,
    title: 'Admin',
    description: 'Innsendinger, knuter og adminoppgaver i én arbeidsflate.',
  },
};

const USER_PAGE_ORDER = ['dashboard', 'knuter', 'leaderboard', 'feed', 'profiler', 'status'];
const ADMIN_PAGE_ORDER = ['dashboard', 'knuter', 'leaderboard', 'feed', 'profiler', 'admin'];

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};
const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? '0.0.0';
const DEFAULT_PASSWORD_FORM = Object.freeze({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});

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
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginNotice, setLoginNotice] = useState('');
  const [appError, setAppError] = useState('');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState(DEFAULT_PASSWORD_FORM);
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isLoadingApp, setIsLoadingApp] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [knuterSettledToken, setKnuterSettledToken] = useState(0);
  const [toast, setToast] = useState(null);
  const [profileEditRequest, setProfileEditRequest] = useState(0);
  const skipNextPageTopResetRef = useRef(false);

  function showToast(message, type = 'success') {
    setToast({ message, type, key: Date.now() });
  }

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
  const leaders = appData?.leaderboard ?? EMPTY_ARRAY;
  const displayLeaders = leaders;
  const currentLeader = currentUser
    ? leaders.find((leader) => leader.id === currentUser.leaderId) ?? null
    : null;
  const achievements = appData?.achievements ?? EMPTY_ARRAY;
  const profiles = appData?.profiles ?? EMPTY_ARRAY;
  const currentProfile = currentUser
    ? profiles.find((profile) => profile.id === currentUser.leaderId) ?? profiles[0]
    : null;
  const selectedProfile =
    profiles.find((profile) => profile.id === selectedProfileId) ?? profiles[0];
  const activityLog = appData?.activityLog ?? EMPTY_ARRAY;
  const classLeaderboard = appData?.classLeaderboard ?? EMPTY_ARRAY;
  const genderLeaderboards = appData?.genderLeaderboards ?? EMPTY_OBJECT;
  const dailyKnot = appData?.dailyKnot ?? null;
  const duelAvailability = appData?.duelAvailability ?? {
    byLeaderId: {},
    currentUserDailyCount: 0,
    currentUserRemaining: 0,
    thisDayTotal: 0,
  };
  const duelHistory = appData?.duelHistory ?? EMPTY_ARRAY;
  const duelSummary = appData?.duelSummary ?? {
    stake: 0,
    range: 0,
    deadlineHours: 0,
    dailyLimit: 0,
    currentUserDailyCount: 0,
    currentUserRemaining: 0,
    thisDayTotal: 0,
    activeCount: 0,
  };
  const knotFeedbackMessages = appData?.knotFeedbackMessages ?? EMPTY_OBJECT;
  const baseDashboardData = appData?.dashboardData ?? {
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

  // Fra farger: overstyr weeklyTopPost med første aktivitet som har bilde/video,
  // så "Ukas post"-kortet får noe å rendre når server ikke har kåret en vinner ennå.
  const weeklyMediaTestPost = useMemo(() => {
    const imageEntry = activityLog.find(
      (entry) =>
        entry?.submissionId &&
        entry?.mediaType === 'image' &&
        Boolean(entry?.imagePreviewUrl),
    );
    const videoEntry = activityLog.find(
      (entry) =>
        entry?.submissionId &&
        entry?.mediaType === 'video' &&
        Boolean(entry?.videoPreviewUrl),
    );
    const mediaEntry = videoEntry ?? imageEntry ?? null;

    if (!mediaEntry) {
      return null;
    }

    const resolvedMediaType =
      mediaEntry.mediaType === 'image' && mediaEntry.imagePreviewUrl
        ? 'image'
        : mediaEntry.mediaType === 'video' && mediaEntry.videoPreviewUrl
          ? 'video'
          : 'none';

    return {
      id: mediaEntry.id ?? `submission-${mediaEntry.submissionId}`,
      submissionId: mediaEntry.submissionId,
      studentId: mediaEntry.isAnonymous ? null : (mediaEntry.studentId ?? null),
      studentName: mediaEntry.studentName ?? 'Anonym',
      studentPhotoUrl: mediaEntry.studentPhotoUrl ?? '',
      studentIcon: mediaEntry.studentIcon ?? '',
      isAnonymous: mediaEntry.isAnonymous === true,
      knotTitle: mediaEntry.knotTitle ?? 'Post',
      note: mediaEntry.note ?? '',
      points: Number(mediaEntry.points ?? 0),
      completedAt: mediaEntry.completedAt ?? 'Nylig',
      ratingAverage: Number(mediaEntry.ratingAverage ?? 0),
      ratingCount: Number(mediaEntry.ratingCount ?? 0),
      weeklyScore: Number(mediaEntry.ratingAverage ?? 0),
      mediaType: resolvedMediaType,
      imagePreviewUrl: mediaEntry.imagePreviewUrl ?? '',
      imageName: mediaEntry.imageName ?? '',
      videoPreviewUrl: mediaEntry.videoPreviewUrl ?? '',
      videoName: mediaEntry.videoName ?? '',
    };
  }, [activityLog]);

  const dashboardData =
    weeklyMediaTestPost && !baseDashboardData.weeklyTopPost
      ? { ...baseDashboardData, weeklyTopPost: weeklyMediaTestPost }
      : baseDashboardData;

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
    document.documentElement.setAttribute('data-theme', 'light');
    window.localStorage.removeItem('theme');
  }, []);

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

    if (skipNextPageTopResetRef.current) {
      skipNextPageTopResetRef.current = false;
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activePage]);

  useEffect(() => {
    if (!sessionToken || typeof document === 'undefined') return;
    let cancelled = false;
    const silentRefresh = async () => {
      try {
        const next = await fetchBootstrap(sessionToken);
        if (!cancelled) setAppData(next);
      } catch {
        // Ignore transient failures; the next user action triggers a full refresh.
      }
    };
    const interval = window.setInterval(silentRefresh, 30000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') silentRefresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [sessionToken]);

  useEffect(() => {
    if (!currentUser) return;
    if (typeof window !== 'undefined' && !window.localStorage.getItem('onboarding_v2_completed')) {
      setIsOnboardingOpen(true);
    }
  }, [currentUser?.leaderId]);

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
      setSelectedProfileId(currentUser?.leaderId ?? null);
      setProfileViewMode('detail');
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
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.scrollingElement?.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
    });
  }

  function handleOpenDailyKnot(knotId = null) {
    skipNextPageTopResetRef.current = true;
    setFocusedKnotId(knotId);
    setFocusedKnotScrollRequest((current) => current + 1);
    setActivePage('knuter');
  }

  const handlePageSettled = useCallback((pageId) => {
    if (pageId === 'knuter') {
      setKnuterSettledToken((current) => current + 1);
    }
  }, []);

  function resetSettingsForm() {
    setPasswordForm({ ...DEFAULT_PASSWORD_FORM });
    setPasswordError('');
    setIsChangingPassword(false);
  }

  function handleCompleteOnboarding() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('onboarding_v2_completed', 'true');
    }
    setIsOnboardingOpen(false);
  }

  function handleRestartTour() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('onboarding_v2_completed');
    }
    setIsSettingsOpen(false);
    setIsOnboardingOpen(true);
  }

  function handleOpenSettings() {
    resetSettingsForm();
    setIsSettingsOpen(true);
  }

  function handleCloseSettings() {
    setIsSettingsOpen(false);
    resetSettingsForm();
  }

  function handleChangePasswordField(field, value) {
    setPasswordForm((current) => ({
      ...current,
      [field]: value,
    }));
    setPasswordError('');
  }

  async function handleLogin() {
    if (!loginEmail.trim() || !loginPassword) {
      setLoginError('Fyll inn e-post og passord.');
      return;
    }

    setIsLoggingIn(true);
    setLoginError('');
    setLoginNotice('');

    try {
      const result = await loginWithEmailPassword(loginEmail.trim(), loginPassword);
      storeSessionToken(result.token);
      setSessionToken(result.token);
      setLoginPassword('');
      await refreshAppData(result.token);
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleLogout(options = {}) {
    const noticeMessage = options?.noticeMessage ?? '';

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
    setAppError('');
    setLoginError('');
    setLoginNotice(noticeMessage);
    setIsSettingsOpen(false);
    resetSettingsForm();
    setSelectedProfileId(null);
    setFocusedKnotId(null);
    setActivePage('dashboard');
  }

  async function handleChangeOwnPassword(event) {
    event.preventDefault();

    if (isChangingPassword) {
      return;
    }

    if (
      !passwordForm.currentPassword ||
      !passwordForm.newPassword ||
      !passwordForm.confirmPassword
    ) {
      setPasswordError('Fyll inn nåværende passord, nytt passord og bekreftelse.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Nytt passord og bekreftelse må være like.');
      return;
    }

    setIsChangingPassword(true);
    setPasswordError('');

    try {
      await changeOwnPassword(sessionToken, {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      await handleLogout({
        noticeMessage: 'Passordet er oppdatert. Logg inn med det nye passordet.',
      });
    } catch (error) {
      setPasswordError(
        error instanceof Error ? error.message : 'Kunne ikke oppdatere passordet.',
      );
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleDeleteAccount() {
    if (isDeletingAccount) return;
    setIsDeletingAccount(true);
    try {
      await deleteOwnAccount(sessionToken);
      await handleLogout({
        noticeMessage: 'Kontoen din er slettet. Takk for at du var med.',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Kunne ikke slette kontoen akkurat nå.';
      window.alert(message);
    } finally {
      setIsDeletingAccount(false);
    }
  }

  function handleSettingsOpenKnots() {
    setIsSettingsOpen(false);
    handleChangePage('knuter');
  }

  function handleSettingsOpenFeed() {
    setIsSettingsOpen(false);
    handleChangePage('feed');
  }

  function handleSettingsOpenProfile() {
    setIsSettingsOpen(false);
    if (currentUser?.leaderId) {
      handleOpenProfile(currentUser.leaderId);
    } else {
      handleChangePage('profiler');
    }
  }

  function handleSettingsOpenProfileEditor() {
    setIsSettingsOpen(false);
    if (currentUser?.leaderId) {
      handleOpenProfile(currentUser.leaderId);
    } else {
      handleChangePage('profiler');
    }
    setProfileEditRequest((token) => token + 1);
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

    assertVideoWithinLimits(evidence.videoFile);
    const convertedVideoFile = evidence.videoFile
      ? await convertToMp4(evidence.videoFile)
      : null;
    assertVideoWithinLimits(convertedVideoFile);
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
      removeVideo: evidence.removeVideo === true,
      imageName: evidence.imageName ?? '',
      imageDataUrl: evidence.imageFile
        ? await readFileAsDataUrl(evidence.imageFile)
        : '',
      videoName: evidence.videoFile?.name ?? evidence.videoName ?? '',
      videoDataUrl: evidence.videoFile
        ? await readFileAsDataUrl(evidence.videoFile)
        : '',
    });

    setAppData(nextAppData);

    // Bekreftelse til bruker — annen tekst avhengig av om posten gikk
    // direkte til feeden eller til admin-godkjenning.
    if (shouldSendSubmissionMode) {
      if (normalizedSubmissionMode === 'feed') {
        showToast('Knuten er lagt ut i feeden!');
      } else if (normalizedSubmissionMode === 'anonymous-feed') {
        showToast('Knuten er lagt ut anonymt i feeden!');
      } else {
        showToast('Knuten er sendt inn for godkjenning.');
      }
    } else {
      showToast('Knuten er oppdatert.');
    }

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
      const nextAppData = await completeDuel(sessionToken, duelId, {
        submissionMode: normalizedSubmissionMode,
        note: evidence.note ?? '',
        imageName: evidence.imageName ?? '',
        imageDataUrl: evidence.imageFile
          ? await readFileAsDataUrl(evidence.imageFile)
          : '',
        videoName: evidence.videoFile?.name ?? evidence.videoName ?? '',
        videoDataUrl: evidence.videoFile
          ? await readFileAsDataUrl(evidence.videoFile)
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

  async function handleDeleteSubmission(submissionId, options = {}) {
    if (!submissionId) {
      return;
    }

    const nextAppData = await deleteSubmission(sessionToken, submissionId);
    options.beforeApply?.();

    const delayAppDataMs = Number(options.delayAppDataMs) || 0;
    if (delayAppDataMs > 0) {
      await new Promise((resolve) => {
        window.setTimeout(resolve, delayAppDataMs);
      });
    }

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

  async function handleCreateComment(submissionId, text, parentId = null) {
    const nextAppData = await createComment(sessionToken, submissionId, text, parentId);
    setAppData(nextAppData);
  }

  async function handleDeleteComment(commentId) {
    const nextAppData = await deleteComment(sessionToken, commentId);
    setAppData(nextAppData);
  }

  async function handleLikeComment(commentId) {
    const nextAppData = await likeComment(sessionToken, commentId);
    setAppData(nextAppData);
  }

  async function handleReportComment(commentId, reason, note = '') {
    const nextAppData = await reportComment(sessionToken, commentId, reason, note);
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
    const leaderAbove = displayLeaders.find(
      (leader) => leader.rank === (currentLeader?.rank ?? 0) - 1,
    );
    const pointsBehind = leaderAbove
      ? Math.max((leaderAbove.points ?? 0) - (currentLeader?.points ?? 0), 0)
      : 0;
    const leaderAboveName = leaderAbove?.russName ?? leaderAbove?.name ?? 'ukjent';

    return (
      <header className="hero-panel hero-panel--page">
        <div className="hero-panel__content">
          <h1>
            Heisann{' '}
            <span className="hero-name-accent">
              {currentProfile?.russName ?? currentUser?.name ?? 'russ'}
            </span>
          </h1>
          <p className="hero-copy hero-copy--status font-display">
            {leaderAbove ? (
              <>
                Du er{' '}
                <span className="hero-copy__points">
                  <span className="hero-copy__points-value">{pointsBehind}</span> poeng
                </span>{' '}
                bak {leaderAboveName}.
              </>
            ) : (
              'Du leder topplisten.'
            )}
          </p>
        </div>

      </header>
    );
  }

  function renderPageContent(page) {
    const commonPageProps = {
      sessionToken,
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
      knuterSettledToken,
      bans,
      knots,
      leaders: displayLeaders,
      classLeaderboard,
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
          currentUserId={currentUser.leaderId}
          currentUserActiveBans={currentUserActiveBans}
          commentsBySubmission={appData?.commentsBySubmission ?? {}}
          onDeleteSubmission={handleDeleteSubmission}
          onExit={() => handleChangePage('dashboard')}
          onOpenProfile={handleOpenProfile}
          onOpenKnots={() => handleChangePage('knuter')}
          onReportSubmission={handleReportSubmission}
          onRateSubmission={handleRateSubmission}
          onCreateComment={handleCreateComment}
          onDeleteComment={handleDeleteComment}
          onLikeComment={handleLikeComment}
          onReportComment={handleReportComment}
        />
      );
    } else if (page.id === 'profiler') {
      content = (
        <ProfilesPage
          {...commonPageProps}
          onBackToOverview={handleBackToProfileOverview}
          onOpenSettings={handleOpenSettings}
          onSetKnotVisibility={handleSetKnotVisibility}
          profileViewMode={profileViewMode}
          editRequest={profileEditRequest}
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
        <main className="page-layout">
          {page.id === 'dashboard' ? renderHeroPanel() : null}
          {page.id !== 'dashboard' && page.id !== 'knuter' ? (
            <section className="page-intro page-intro--shell">
              <>
                <p className="eyebrow">Visning</p>
                <h2>{page.title}</h2>
                <p>{page.description}</p>
              </>
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
            email={loginEmail}
            password={loginPassword}
            error={loginError || appError}
            notice={loginNotice}
            isSubmitting={isLoggingIn}
            onChangeEmail={setLoginEmail}
            onChangePassword={setLoginPassword}
            onSubmit={handleLogin}
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
          onPageSettled={handlePageSettled}
          renderPage={renderPageContent}
          hideNavigation={false}
          mobileOnlySwipe
        />
        <LiveOnboarding
          isOpen={isOnboardingOpen}
          onComplete={handleCompleteOnboarding}
          currentPage={activePage}
          onChangePage={handleChangePage}
        />
        <SettingsModal
          appVersion={APP_VERSION}
          currentUser={currentUser}
          isChangingPassword={isChangingPassword}
          isDeletingAccount={isDeletingAccount}
          isOpen={isSettingsOpen}
          onChangePasswordField={handleChangePasswordField}
          onClose={handleCloseSettings}
          onDeleteAccount={handleDeleteAccount}
          onLogout={() => handleLogout()}
          onNavigateToFeed={handleSettingsOpenFeed}
          onNavigateToKnots={handleSettingsOpenKnots}
          onNavigateToProfile={handleSettingsOpenProfile}
          onOpenProfileEditor={handleSettingsOpenProfileEditor}
          onRestartTour={handleRestartTour}
          onSubmitPasswordChange={handleChangeOwnPassword}
          passwordError={passwordError}
          passwordForm={passwordForm}
        />
        {toast ? (
          <Toast
            key={toast.key}
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        ) : null}
      </div>
    </div>
  );
}

export default App;
