import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Home, Play, Shield, Trophy, User } from 'lucide-react';
import { KnotIcon } from './components/KnotIcon.jsx';
import './App.css';
import './styles/blaruss-refresh.css';
import { AchievementCelebration } from './components/AchievementCelebration.jsx';
import { ConfettiBurst } from './components/ConfettiBurst.jsx';
import { LiveOnboarding } from './components/LiveOnboarding.jsx';
import { LoadingSplash } from './components/LoadingSplash.jsx';
import { PwaInstallPrompt } from './components/PwaInstallPrompt.jsx';
import { RankUpToast } from './components/RankUpToast.jsx';
import { SettingsModal } from './components/SettingsModal.jsx';
import { SwipeTabsShell } from './components/SwipeTabsShell.jsx';
import { Toast } from './components/Toast.jsx';
import { playDing, playSwoosh, playTick, isSoundsMuted, setSoundsMuted } from './lib/sounds.js';
import { useIdleAnimation } from './lib/useIdleAnimation.js';
import {
  buildActivityLog,
  buildClassLeaderboard,
  buildDashboardData,
  buildDailyKnot,
  buildDuelAvailability,
  buildDuelHistory,
  buildGenderLeaderboards,
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
    description: 'Dine tall, merker og knute-off.',
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
  const [isDark, setIsDark] = useState(() => {
    const stored = window.localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });
  const [soundsMuted, setSoundsMutedState] = useState(() => isSoundsMuted());
  const handleToggleSounds = useCallback(() => {
    setSoundsMutedState((current) => {
      const next = !current;
      setSoundsMuted(next);
      return next;
    });
  }, []);

  // Idle easter egg: wobble the Knuter tab icon after 30s of no input.
  useIdleAnimation(() => {
    if (typeof document === 'undefined') return;
    const button = document.querySelector('[data-tour-id="tab-knuter"]');
    if (!button) return;
    const iconWrapper = button.querySelector('.bottom-swipe-nav__icon') ?? button;
    iconWrapper.classList.remove('is-knot-wobble');
    // force reflow so we can re-trigger
    void iconWrapper.offsetWidth;
    iconWrapper.classList.add('is-knot-wobble');
    window.setTimeout(() => {
      iconWrapper.classList.remove('is-knot-wobble');
    }, 1300);
  }, { timeout: 30000 });
  const [passwordForm, setPasswordForm] = useState(DEFAULT_PASSWORD_FORM);
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isLoadingApp, setIsLoadingApp] = useState(true);
  // Mock: garanterer at splash vises minst 1.8s så vi får evaluert designet.
  // Fjern når du bestemmer deg for om splash skal beholdes eller ei.
  const [mockSplashActive, setMockSplashActive] = useState(true);
  useEffect(() => {
    const id = window.setTimeout(() => setMockSplashActive(false), 1800);
    return () => window.clearTimeout(id);
  }, []);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [knuterSettledToken, setKnuterSettledToken] = useState(0);
  const [profileEditRequest, setProfileEditRequest] = useState(0);
  const [focusedFeedSubmissionId, setFocusedFeedSubmissionId] = useState(null);
  const [focusedFeedCommentId, setFocusedFeedCommentId] = useState(null);
  const [focusedFeedScrollRequest, setFocusedFeedScrollRequest] = useState(0);
  const [toast, setToast] = useState(null);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [pendingAchievementCelebration, setPendingAchievementCelebration] = useState(null);
  const [pendingRankUp, setPendingRankUp] = useState(null);
  const previousRankRef = useRef(null);
  const [lastVisitedFeedAt, setLastVisitedFeedAt] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const stored = window.localStorage.getItem('lastVisitedFeedAt');
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? parsed : 0;
  });
  const skipNextPageTopResetRef = useRef(false);
  const previousApprovedSubmissionIdsRef = useRef(null);

  function showToast(message, type = 'success') {
    setToast({ message, type, key: Date.now() });
  }

  // Testpanel — trigges fra Innstillinger så Ludvig kan se alle de små
  // animasjonene/celebrasjonene uten å måtte fremprovosere dem naturlig.
  function handleRunTest(testId) {
    switch (testId) {
      case 'confetti':
        setConfettiTrigger((c) => c + 1);
        break;
      case 'achievement':
        setPendingAchievementCelebration({
          id: 'test-achievement',
          title: 'Testprestasjon',
          description: 'Dette er en testcelebrasjon for å se hvordan den ser ut.',
          icon: '🏆',
          currentTierIndex: 2,
          currentTierLabel: 'Gull',
          isUnlocked: true,
        });
        break;
      case 'rank-up':
        setPendingRankUp({
          key: Date.now(),
          passedName: 'Test Russen',
          newRank: 3,
        });
        break;
      case 'toast-success':
        showToast('Knute sendt inn! ✓', 'success');
        break;
      case 'toast-error':
        showToast('Noe gikk galt', 'error');
        break;
      case 'toast-info':
        showToast('Lenke kopiert til utklippstavlen', 'info');
        break;
      case 'sound-ding':
        playDing();
        break;
      case 'sound-swoosh':
        playSwoosh();
        break;
      case 'sound-tick':
        playTick();
        break;
      case 'invite-pulse': {
        // Trigger invitasjons-pulsen på alle synlige Registrer-knapper i ~3 sek.
        // Lukker innstillinger først så brukeren ser knappene blinke.
        if (typeof document === 'undefined') break;
        setIsSettingsOpen(false);
        window.setTimeout(() => {
          document.body.classList.add('force-invite-pulse');
          window.setTimeout(() => {
            document.body.classList.remove('force-invite-pulse');
          }, 10000);
        }, 320);
        break;
      }
      default:
        break;
    }
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
    () =>
      buildAchievements(knots, currentLeader, {
        streakDays: Number(currentUserStreak?.current ?? 0),
        duelHistory: duels,
        currentUserId: currentUser?.leaderId ?? null,
        totalLeaderboardCount: Array.isArray(leaders) ? leaders.length : 0,
      }),
    [currentLeader, currentUser, currentUserStreak, duels, knots, leaders],
  );

  // Watch achievements for newly unlocked items and show a celebration.
  // Storage key er per bruker så vi ikke blander achievements på tvers.
  const achievementSeenStorageKey = currentUser
    ? `seen_achievement_ids:${currentUser.leaderId ?? currentUser.id ?? 'self'}`
    : null;
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!achievementSeenStorageKey) return;
    if (!Array.isArray(achievements) || achievements.length === 0) return;

    let seenIds = [];
    try {
      const raw = window.localStorage.getItem(achievementSeenStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) seenIds = parsed.filter((id) => typeof id === 'string');
      }
    } catch {
      seenIds = [];
    }

    // Vi tier-er per achievement, så vi sporer "id:tierIndex" for å fange
    // når man rykker opp en tier også, ikke bare første gang.
    const buildKey = (achievement) =>
      `${achievement.id}:${achievement.currentTierIndex}`;

    const unlockedNow = achievements.filter(
      (achievement) => achievement.isUnlocked && achievement.currentTierIndex >= 0,
    );

    // Første gang brukeren laster appen: marker alle eksisterende som sett,
    // men ikke vis celebration.
    const isFirstLoad = seenIds.length === 0;
    if (isFirstLoad) {
      const initialKeys = unlockedNow.map(buildKey);
      try {
        window.localStorage.setItem(
          achievementSeenStorageKey,
          JSON.stringify(initialKeys),
        );
      } catch {
        // ignore quota
      }
      return;
    }

    const newOnes = unlockedNow.filter(
      (achievement) => !seenIds.includes(buildKey(achievement)),
    );

    if (newOnes.length === 0) return;

    // Marker alle som sett umiddelbart for å unngå dobbel-firing.
    const nextSeen = Array.from(
      new Set([...seenIds, ...unlockedNow.map(buildKey)]),
    );
    try {
      window.localStorage.setItem(
        achievementSeenStorageKey,
        JSON.stringify(nextSeen),
      );
    } catch {
      // ignore
    }

    // Vis celebration for første nye — om flere er låst opp samtidig viser
    // vi bare den øverste, det holder.
    if (!pendingAchievementCelebration) {
      setPendingAchievementCelebration(newOnes[0]);
    }
  }, [achievements, achievementSeenStorageKey, pendingAchievementCelebration]);

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

  // Rank-up: vis toast når currentUser passerer noen på topplisten.
  // Vi sammenligner forrige rank med ny — om ny < forrige (lavere = bedre),
  // finner vi den som tidligere lå én plass over (gammel rank - 1) og som
  // ikke er brukeren selv, og viser navnet.
  useEffect(() => {
    if (!currentUser) {
      previousRankRef.current = null;
      return;
    }
    const myRank = displayLeaders.find(
      (leader) => leader.id === currentUser.leaderId,
    )?.rank;
    if (!Number.isFinite(myRank)) return;

    const previousRank = previousRankRef.current;
    previousRankRef.current = myRank;

    if (!Number.isFinite(previousRank)) return; // første render — ikke fyr av
    if (myRank >= previousRank) return; // ingen rank-up

    // Finn navn på den vi gikk forbi: rivalen som tidligere lå like over,
    // dvs. på (previousRank - 1) — eller hvis det er oss, gå én til over.
    let rivalName = null;
    for (let candidateRank = previousRank - 1; candidateRank >= myRank; candidateRank -= 1) {
      const rival = displayLeaders.find(
        (leader) =>
          leader.rank === candidateRank && leader.id !== currentUser.leaderId,
      );
      if (rival) {
        rivalName = rival.russName ?? rival.realName ?? rival.name ?? null;
        break;
      }
    }

    if (!rivalName) return;

    setPendingRankUp({
      passedName: rivalName,
      newRank: myRank,
      key: Date.now(),
    });
  }, [currentUser, displayLeaders]);

  const activityLog = useMemo(
    () => buildActivityLog(profiles, submissions),
    [profiles, submissions],
  );
  // Tidsstempel for nyeste feed-post — brukes til å avgjøre om Feed-tabben
  // skal vise en rød "nytt innhold"-prikk.
  const latestFeedEntryAt = useMemo(() => {
    let max = 0;
    for (const entry of activityLog) {
      if (!entry?.submissionId) continue;
      if (entry.shareDetails === false) continue;
      const raw = entry.submittedAtRaw ?? entry.completedAtRaw ?? null;
      const ts = raw ? new Date(raw).getTime() : NaN;
      if (Number.isFinite(ts) && ts > max) {
        max = ts;
      }
    }
    return max;
  }, [activityLog]);
  const hasNewFeedPosts =
    activePage !== 'feed' &&
    latestFeedEntryAt > 0 &&
    latestFeedEntryAt > lastVisitedFeedAt;
  const classLeaderboard = useMemo(
    () => buildClassLeaderboard(displayLeaders),
    [displayLeaders],
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

  const baseDashboardData =
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
  const dashboardData = weeklyMediaTestPost
    ? {
        ...baseDashboardData,
        weeklyTopPost: weeklyMediaTestPost,
      }
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
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    window.localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

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

  // Hold lastVisitedFeedAt oppdatert mens brukeren er på Feed-siden, slik at
  // badge-prikken ikke vises med en gang man bytter bort.
  useEffect(() => {
    if (activePage !== 'feed') return;
    if (latestFeedEntryAt > 0 && latestFeedEntryAt > lastVisitedFeedAt) {
      setLastVisitedFeedAt(latestFeedEntryAt);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('lastVisitedFeedAt', String(latestFeedEntryAt));
      }
    }
  }, [activePage, latestFeedEntryAt, lastVisitedFeedAt]);

  // Confetti når brukerens egen submission går fra ikke-godkjent til "Godkjent".
  // Vi husker hvilke submission-IDer som var godkjente forrige render, og fyrer
  // av når en ny ID dukker opp i settet.
  useEffect(() => {
    if (!currentUser) return;
    const myLeaderId = currentUser.leaderId;
    const currentApprovedIds = new Set(
      submissions
        .filter(
          (submission) =>
            submission?.leaderId === myLeaderId && submission?.status === 'Godkjent',
        )
        .map((submission) => submission.id),
    );

    const previous = previousApprovedSubmissionIdsRef.current;
    previousApprovedSubmissionIdsRef.current = currentApprovedIds;

    // Første gang vi har data — bare lagre, ikke fyr av confetti for eksisterende godkjente.
    if (previous === null) {
      return;
    }

    let foundNewApproved = false;
    for (const id of currentApprovedIds) {
      if (!previous.has(id)) {
        foundNewApproved = true;
        break;
      }
    }

    if (foundNewApproved) {
      setConfettiTrigger((current) => current + 1);
      showToast('Knuten din er godkjent! 🎉');
      playDing();
    }
  }, [submissions, currentUser]);

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

    if (nextPage === 'feed') {
      const now = Date.now();
      setLastVisitedFeedAt(now);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('lastVisitedFeedAt', String(now));
      }
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

  function handleOpenFeedPost(submissionId, commentId = null) {
    setFocusedFeedSubmissionId(submissionId ?? null);
    setFocusedFeedCommentId(commentId ?? null);
    setFocusedFeedScrollRequest((token) => token + 1);
    handleChangePage('feed');
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
      playSwoosh();
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
          <div className="hero-panel__topbar">
            <div className="hero-panel__utility">
              <button
                type="button"
                className="hero-icon-button"
                onClick={handleOpenSettings}
                aria-label="Apne innstillinger"
                title="Innstillinger"
              >
                ⚙
              </button>
            </div>
          </div>
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
          focusedSubmissionId={focusedFeedSubmissionId}
          focusedCommentId={focusedFeedCommentId}
          focusScrollRequest={focusedFeedScrollRequest}
          isAdmin={currentUser?.role === 'admin'}
          onDeleteSubmission={handleDeleteSubmission}
          onExit={() => handleChangePage('dashboard')}
          onOpenKnots={() => handleChangePage('knuter')}
          onOpenProfile={handleOpenProfile}
          onReportSubmission={handleReportSubmission}
          onRateSubmission={handleRateSubmission}
          onCreateComment={handleCreateComment}
          onDeleteComment={handleDeleteComment}
          onLikeComment={handleLikeComment}
          onReportComment={handleReportComment}
          onRefresh={() => refreshAppData(sessionToken)}
        />
      );
    } else if (page.id === 'profiler') {
      content = (
        <ProfilesPage
          {...commonPageProps}
          onBackToOverview={handleBackToProfileOverview}
          onSetKnotVisibility={handleSetKnotVisibility}
          profileViewMode={profileViewMode}
          editRequest={profileEditRequest}
        />
      );
    } else if (page.id === 'status') {
      content = (
        <StatusPage
          achievements={achievements}
          currentLeader={currentLeader}
          currentUserId={currentUser.leaderId}
          currentUserStreak={currentUserStreak}
          duelHistory={duelHistory}
          duelSummary={duelSummary}
          knots={knots}
          onOpenKnots={() => handleChangePage('knuter')}
          onOpenLeaderboard={() => handleChangePage('leaderboard')}
        />
      );
    } else if (page.id === 'admin') {
      content = <AdminPage {...commonPageProps} onOpenFeedPost={handleOpenFeedPost} />;
    }

    return (
      <div className="main-page-panel">
        <main className="page-layout">
          {page.id === 'dashboard' ? renderHeroPanel() : null}
          {page.id !== 'dashboard' && page.id !== 'knuter' && page.id !== 'status' ? (
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

  if (isLoadingApp || mockSplashActive) {
    return (
      <div className="app-theme">
        <LoadingSplash />
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
          pageBadges={{ feed: hasNewFeedPosts }}
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
          isDark={isDark}
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
          onRunTest={handleRunTest}
          onSubmitPasswordChange={handleChangeOwnPassword}
          onToggleDark={() => setIsDark((prev) => !prev)}
          onToggleSounds={handleToggleSounds}
          passwordError={passwordError}
          passwordForm={passwordForm}
          soundsMuted={soundsMuted}
        />
        {toast ? (
          <Toast
            key={toast.key}
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        ) : null}
        <ConfettiBurst triggerKey={confettiTrigger} />
        <AchievementCelebration
          achievement={pendingAchievementCelebration}
          onClose={() => setPendingAchievementCelebration(null)}
        />
        <RankUpToast
          key={pendingRankUp?.key ?? 'rank-up'}
          data={pendingRankUp}
          onClose={() => setPendingRankUp(null)}
        />
        <PwaInstallPrompt />
      </div>
    </div>
  );
}

export default App;
