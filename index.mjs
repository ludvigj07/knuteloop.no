import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { execFile } from 'node:child_process';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import ffmpegPath from 'ffmpeg-static';
import {
  buildActivityLog,
  buildClassLeaderboard,
  buildDailyKnot,
  buildDashboardData,
  buildDuelAvailability,
  buildDuelHistory,
  buildGenderLeaderboards,
  buildImportedKnots,
  buildKnotTypeLeaderboard,
  buildLeaderboard,
  buildProfiles,
  DUEL_DAILY_LIMIT,
  DUEL_LIMITS_DISABLED,
  DUEL_RANGE,
  DUEL_STAKE,
  DUEL_WINDOW_HOURS,
  limitNoteWords,
  MODERATION_POLICY,
} from './backend/src/data/appHelpers.js';
import { buildAchievements } from './backend/src/data/badgeSystem.js';
import {
  openAuthDb,
  insertUser,
  listUsers,
  deleteSession as deleteAuthSession,
  getSession as getAuthSession,
  getUserById as getAuthUserById,
  touchSession as touchAuthSession,
} from './backend/src/auth/db.mjs';
import { generateInviteCode, hashSecret } from './backend/src/auth/passwords.mjs';
import {
  handleChangeOwnPassword,
  handlePasswordLogin,
  handleInviteVerify,
  handleInviteActivate,
  handleAdminListUsers,
  handleAdminCreateUser,
  handleAdminRegenerateInvite,
  handleAdminResetPassword,
  handleAdminSetActive,
  handleAdminSetRussName,
  setAuthBridge,
} from './backend/src/auth/handlers.mjs';
import {
  initialDuels,
  initialKnots,
  initialLeaders,
  initialProfileHistory,
  initialSubmissions,
  socialProfileDetails,
  stOlavBoardKnots,
} from './backend/src/data/prototypeData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = __dirname;
const DATA_DIR = path.join(APP_ROOT, 'backend', 'data');
const UPLOADS_DIR = path.join(APP_ROOT, 'backend', 'uploads');
const DB_FILE = path.join(DATA_DIR, 'app-db.json');
const PORT = Number(process.env.PORT) || 3001;
const execFileAsync = promisify(execFile);
const FFMPEG_BINARY = process.env.FFMPEG_PATH || ffmpegPath;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? '*';
const VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-m4v',
  'video/webm',
]);
const MIN_STAR_RATING = 1;
const MAX_STAR_RATING = 5;
const REPORT_REASON_OPTIONS = [
  'Spam',
  'Upassende',
  'Juks/falsk bevis',
  'Trakassering',
  'Annet',
];
const REPORT_STATUS = {
  OPEN: 'open',
  REVIEWED: 'reviewed',
  ACTIONED: 'actioned',
  DISMISSED: 'dismissed',
};
const BAN_TYPES = {
  FEED: 'feed',
  SUBMISSION: 'submission',
};
const BAN_DURATION_HOURS = new Set([24, 72, 168]);
const KNOT_FEEDBACK_MESSAGE_KEYS = Object.freeze([
  'standard',
  'resubmission',
  'feed',
  'anonymousFeed',
  'streak',
  'rare',
]);
const DEFAULT_KNOT_FEEDBACK_MESSAGES = Object.freeze({
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
const STREAK_TIME_ZONE = 'Europe/Oslo';
const STREAK_DAILY_BONUS_CAP = 6;
const STREAK_BONUS_TIERS = Object.freeze([
  { minDays: 14, percent: 0.2 },
  { minDays: 8, percent: 0.15 },
  { minDays: 5, percent: 0.1 },
  { minDays: 3, percent: 0.05 },
  { minDays: 1, percent: 0 },
]);
const OSLO_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: STREAK_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const GENDER_IDENTITY_ALIASES = Object.freeze({
  girl: 'girl',
  jente: 'girl',
  female: 'girl',
  boy: 'boy',
  gutt: 'boy',
  male: 'boy',
  other: 'other',
  annet: 'other',
});

const PILOT_USERS = [
  { id: 1, code: 'SOFIE2026', role: 'admin' },
  { id: 2, code: 'EMIL2026', role: 'user' },
  { id: 3, code: 'NORA2026', role: 'user' },
  { id: 4, code: 'JONAS2026', role: 'user' },
  { id: 5, code: 'LEAH2026', role: 'user' },
];

const NORWEGIAN_TEXT_REPLACEMENTS = [
  [/\bM\?te\b/gu, 'Møte'],
  [/\bM\?t\b/gu, 'Møt'],
  [/\br\?de\b/gu, 'røde'],
  [/\butend\?rs\b/giu, 'utendørs'],
  [/\butendors\b/giu, 'utendørs'],
  [/\bsp\?rsm\?l\b/gu, 'spørsmål'],
  [/\bbadet\?y\b/gu, 'badetøy'],
  [/\bR\?yk\b/gu, 'Røyk'],
  [/\br\?yk\b/gu, 'røyk'],
  [/\broyk\b/giu, 'røyk'],
  [/\bh\?yt\b/gu, 'høyt'],
  [/\bh\?yttaleren\b/gu, 'høyttaleren'],
  [/\bundert\?y\b/gu, 'undertøy'],
  [/\butenp\?\b/gu, 'utenpå'],
  [/\bfullf\?rt\b/gu, 'fullført'],
  [/\bfullf\?rte\b/gu, 'fullførte'],
  [/\bfullf\?r\b/gu, 'fullfør'],
  [/\btrenings\?kt\b/gu, 'treningsøkt'],
  [/\bavgj\?re\b/gu, 'avgjøre'],
  [/\bavgj\?rt\b/gu, 'avgjort'],
  [/\bavgj\?r\b/gu, 'avgjør'],
  [/\bAvsl\?tt\b/gu, 'Avslått'],
  [/\bilopet\b/giu, 'i løpet'],
  [/\bgjennomfor\b/giu, 'gjennomfør'],
  [/\bgjennomfort\b/giu, 'gjennomført'],
  [/\bforesla\b/giu, 'foreslå'],
  [/\bMoter\b/gu, 'Møter'],
  [/\bbade\b/giu, 'både'],
  [/\butlopte\b/giu, 'utløpte'],
  [/\bKnuteforer\b/gu, 'Knutefører'],
  [/\bKnutelaerling\b/gu, 'Knutelærling'],
  [/\bNokkeltall\b/gu, 'Nøkkeltall'],
  [/\bniva\b/giu, 'nivå'],
  [/\bLaaste\b/gu, 'Låste'],
  [/\bsolv\b/giu, 'sølv'],
  [/\bBlaruss\b/gu, 'Blåruss'],
  [/\bRodruss\b/gu, 'Rødruss'],
  [/\bs\?ket\b/gu, 'søket'],
];

function nowIso() {
  return new Date().toISOString();
}

function cloneKnotFeedbackMessages(source = DEFAULT_KNOT_FEEDBACK_MESSAGES) {
  return {
    standard: [...(source.standard ?? [])],
    resubmission: [...(source.resubmission ?? [])],
    feed: [...(source.feed ?? [])],
    anonymousFeed: [...(source.anonymousFeed ?? [])],
    streak: [...(source.streak ?? [])],
    rare: [...(source.rare ?? [])],
  };
}

function sanitizeKnotFeedbackMessage(value, key = 'standard') {
  if (typeof value !== 'string') {
    return '';
  }

  if (key === 'rare') {
    return value
      .replace(/\r\n/gu, '\n')
      .replace(/\n{3,}/gu, '\n\n')
      .trim()
      .slice(0, 4800);
  }

  return value.replace(/\s+/gu, ' ').trim().slice(0, 180);
}

function normalizeKnotFeedbackMessages(messages) {
  const source = messages && typeof messages === 'object' ? messages : {};
  const nextMessages = cloneKnotFeedbackMessages({
    standard: [],
    resubmission: [],
    feed: [],
    anonymousFeed: [],
    streak: [],
    rare: [],
  });

  KNOT_FEEDBACK_MESSAGE_KEYS.forEach((key) => {
    const normalizedEntries = (Array.isArray(source[key]) ? source[key] : [])
      .map((entry) => sanitizeKnotFeedbackMessage(entry, key))
      .filter(Boolean);

    nextMessages[key] = [...new Set(normalizedEntries)].slice(0, 40);
  });

  return nextMessages;
}

function getRelativeLabel(isoValue) {
  const date = new Date(isoValue);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / (1000 * 60)));

  if (diffMinutes < 5) {
    return 'Nettopp';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min siden`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24 && date.getDate() === now.getDate()) {
    return `I dag, ${date.toLocaleTimeString('nb-NO', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (date.toDateString() === yesterday.toDateString()) {
    return `I går, ${date.toLocaleTimeString('nb-NO', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  return date.toLocaleString('nb-NO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseDataUrl(dataUrl) {
  const match = /^data:(.+?);base64,(.+)$/.exec(dataUrl ?? '');

  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

function getExtensionFromMime(mimeType, fallback = '.bin') {
  if (mimeType === 'image/png') {
    return '.png';
  }

  if (mimeType === 'image/jpeg') {
    return '.jpg';
  }

  if (mimeType === 'image/webp') {
    return '.webp';
  }

  if (mimeType === 'video/mp4') {
    return '.mp4';
  }

  if (mimeType === 'video/quicktime') {
    return '.mov';
  }

  if (mimeType === 'video/x-m4v') {
    return '.m4v';
  }

  if (mimeType === 'video/webm') {
    return '.webm';
  }

  return fallback;
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOADS_DIR, { recursive: true });

  if (!(await fileExists(DB_FILE))) {
    await fs.writeFile(DB_FILE, JSON.stringify(createSeedDatabase(), null, 2), 'utf8');
  }
}

function createSeedDatabase() {
  const school = {
    id: 'st-olav',
    name: 'St. Olav vgs',
  };

  const users = initialLeaders.map((leader) => {
    const pilotUser = PILOT_USERS.find((item) => item.id === leader.id);
    const profile = socialProfileDetails[leader.id] ?? {};

    return {
      id: leader.id,
      schoolId: school.id,
      name: leader.name,
      group: leader.group,
      role: pilotUser?.role ?? 'user',
      loginCode: pilotUser?.code ?? `${leader.name.toUpperCase()}2026`,
      basePoints: leader.basePoints,
      baseCompletedKnots: leader.baseCompletedKnots,
      profile: {
        icon: profile.icon ?? '',
        photoUrl: profile.photoUrl ?? '',
        russName: profile.russName ?? leader.name,
        realName: profile.realName ?? leader.name,
        className: profile.className ?? leader.group,
        bio: profile.bio ?? '',
        quote: profile.quote ?? '',
        knownFor: profile.knownFor ?? '',
        signatureKnot: profile.signatureKnot ?? '',
        favoriteCategory: profile.favoriteCategory ?? '',
        russType: profile.russType ?? 'blue',
        genderIdentity: normalizeGenderIdentity(profile.genderIdentity),
      },
    };
  });

  const knots = [...initialKnots, ...stOlavBoardKnots].map((knot) => ({
    ...knot,
    schoolId: school.id,
    isActive: true,
  }));

  const createdAt = nowIso();
  const submissions = initialSubmissions.map((submission) => ({
    ...submission,
    note: submission.note ?? '',
    imageName: submission.imageName ?? '',
    imagePreviewUrl: submission.imagePreviewUrl ?? '',
    videoName: submission.videoName ?? '',
    videoPreviewUrl: submission.videoPreviewUrl ?? '',
    isAnonymousFeed: submission.isAnonymousFeed === true,
    submissionMode: submission.submissionMode ?? 'review',
    ratings: {},
    basePoints: Math.max(0, Number(submission.points) || 0),
    streakBonusPoints: 0,
    streakQualified: false,
    streakDay: null,
    streakDayKey: null,
    submittedAtRaw: createdAt,
    reviewedAtRaw: submission.status === 'Venter' ? null : createdAt,
    reviewedBy: submission.status === 'Venter' ? null : 1,
  }));

  return {
    version: 1,
    schools: [school],
    users,
    knots,
    submissions,
    reports: [],
    bans: [],
    duels: initialDuels.map((duel) => ({
      ...duel,
      challengerNote: duel.challengerNote ?? '',
      challengerImageName: duel.challengerImageName ?? '',
      challengerImagePreviewUrl: duel.challengerImagePreviewUrl ?? '',
      challengerVideoName: duel.challengerVideoName ?? '',
      challengerVideoPreviewUrl: duel.challengerVideoPreviewUrl ?? '',
      challengerCompletionApproved:
        typeof duel.challengerCompletionApproved === 'boolean'
          ? duel.challengerCompletionApproved
          : duel.challengerCompletedAt
            ? true
            : null,
      opponentNote: duel.opponentNote ?? '',
      opponentImageName: duel.opponentImageName ?? '',
      opponentImagePreviewUrl: duel.opponentImagePreviewUrl ?? '',
      opponentVideoName: duel.opponentVideoName ?? '',
      opponentVideoPreviewUrl: duel.opponentVideoPreviewUrl ?? '',
      opponentCompletionApproved:
        typeof duel.opponentCompletionApproved === 'boolean'
          ? duel.opponentCompletionApproved
          : duel.opponentCompletedAt
            ? true
            : null,
      challengerSubmissionId: duel.challengerSubmissionId ?? null,
      opponentSubmissionId: duel.opponentSubmissionId ?? null,
    })),
    profileHistory: initialProfileHistory,
    legacyApprovedKnotIdsByUser: {
      1: ['knot-1', 'knot-2', 'knot-5'],
    },
    knotFeedbackMessages: cloneKnotFeedbackMessages(),
    sessions: [],
  };
}

async function readDb() {
  await ensureStorage();
  const raw = await fs.readFile(DB_FILE, 'utf8');
  const db = JSON.parse(raw);
  const migratedVideoDb = await migrateLegacyVideoUploads(db);
  const migratedRatingsDb = await migrateSubmissionRatings(migratedVideoDb);
  const migratedDuelApprovalsDb = await migrateDuelCompletionApprovals(migratedRatingsDb);
  const migratedModerationDb = await migrateModerationData(migratedDuelApprovalsDb);
  const migratedFeedFlagsDb = await migrateSubmissionFeedFlags(migratedModerationDb);
  const migratedProfileGenderDb = await migrateProfileGenderData(migratedFeedFlagsDb);
  const migratedStreakDb = await migrateSubmissionStreakData(migratedProfileGenderDb);
  const migratedKnotFeedbackDb = await migrateKnotFeedbackMessages(migratedStreakDb);
  return migrateNorwegianText(migratedKnotFeedbackDb);
}

async function writeDb(nextDb) {
  await fs.writeFile(DB_FILE, JSON.stringify(nextDb, null, 2), 'utf8');
}

function normalizeVideoNameToMp4(name, fallback = 'video.mp4') {
  const rawName = (name ?? '').trim();

  if (!rawName) {
    return fallback;
  }

  return rawName.replace(/\.[^.]+$/u, '') + '.mp4';
}

const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 20;
const transcodeQueue = [];
let transcodeBusy = false;

function scheduleTranscode(finalPath) {
  transcodeQueue.push(finalPath);
  drainTranscodeQueue();
}

async function drainTranscodeQueue() {
  if (transcodeBusy) return;
  transcodeBusy = true;
  try {
    while (transcodeQueue.length > 0) {
      const finalPath = transcodeQueue.shift();
      const tempPath = `${finalPath}.transcoded.mp4`;
      try {
        await transcodeVideoToMp4(finalPath, tempPath);
        await fs.rename(tempPath, finalPath);
      } catch (error) {
        await fs.rm(tempPath, { force: true }).catch(() => {});
        console.error(
          `[video] background transcode failed for ${path.basename(finalPath)}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  } finally {
    transcodeBusy = false;
  }
}

async function transcodeVideoToMp4(inputPath, outputPath) {
  if (!FFMPEG_BINARY) {
    throw new Error(
      'Finner ikke ffmpeg-binaren. Sett FFMPEG_PATH eller installer ffmpeg.',
    );
  }

  await execFileAsync(
    FFMPEG_BINARY,
    [
      '-y',
      '-t', String(MAX_VIDEO_SECONDS),
      '-i', inputPath,
      '-vcodec', 'h264',
      '-acodec', 'aac',
      '-movflags', '+faststart',
      outputPath,
    ],
    { windowsHide: true },
  );
}

async function maybeMigrateStoredVideo(fileUrl, category) {
  if (!fileUrl || !fileUrl.startsWith('/uploads/')) {
    return fileUrl ?? '';
  }

  if (fileUrl.toLowerCase().endsWith('.mp4')) {
    return fileUrl;
  }

  const fileName = fileUrl.replace('/uploads/', '');
  const inputPath = path.join(UPLOADS_DIR, fileName);

  if (!(await fileExists(inputPath))) {
    return fileUrl;
  }

  const mp4Name = `${category}-${Date.now()}-${randomUUID()}.mp4`;
  const outputPath = path.join(UPLOADS_DIR, mp4Name);

  try {
    await transcodeVideoToMp4(inputPath, outputPath);
    await fs.rm(inputPath, { force: true });
    return `/uploads/${mp4Name}`;
  } catch {
    await fs.rm(outputPath, { force: true });
    return fileUrl;
  }
}

async function migrateLegacyVideoUploads(db) {
  let changed = false;

  const submissions = await Promise.all(
    db.submissions.map(async (submission) => {
      const nextVideoPreviewUrl = await maybeMigrateStoredVideo(
        submission.videoPreviewUrl,
        'submission-video',
      );

      if (nextVideoPreviewUrl === submission.videoPreviewUrl) {
        return submission;
      }

      changed = true;
      return {
        ...submission,
        videoPreviewUrl: nextVideoPreviewUrl,
        videoName: normalizeVideoNameToMp4(submission.videoName),
      };
    }),
  );

  const duels = await Promise.all(
    db.duels.map(async (duel) => {
      const challengerVideoPreviewUrl = await maybeMigrateStoredVideo(
        duel.challengerVideoPreviewUrl,
        'duel-video',
      );
      const opponentVideoPreviewUrl = await maybeMigrateStoredVideo(
        duel.opponentVideoPreviewUrl,
        'duel-video',
      );

      if (
        challengerVideoPreviewUrl === duel.challengerVideoPreviewUrl &&
        opponentVideoPreviewUrl === duel.opponentVideoPreviewUrl
      ) {
        return duel;
      }

      changed = true;
      return {
        ...duel,
        challengerVideoPreviewUrl,
        challengerVideoName:
          challengerVideoPreviewUrl !== duel.challengerVideoPreviewUrl
            ? normalizeVideoNameToMp4(duel.challengerVideoName)
            : duel.challengerVideoName,
        opponentVideoPreviewUrl,
        opponentVideoName:
          opponentVideoPreviewUrl !== duel.opponentVideoPreviewUrl
            ? normalizeVideoNameToMp4(duel.opponentVideoName)
            : duel.opponentVideoName,
      };
    }),
  );

  if (!changed) {
    return db;
  }

  const nextDb = {
    ...db,
    submissions,
    duels,
  };

  await writeDb(nextDb);
  return nextDb;
}

function normalizeNorwegianText(value) {
  let nextValue = value;

  NORWEGIAN_TEXT_REPLACEMENTS.forEach(([pattern, replacement]) => {
    nextValue = nextValue.replace(pattern, replacement);
  });

  return nextValue;
}

function normalizeNorwegianValue(value) {
  if (typeof value === 'string') {
    return normalizeNorwegianText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeNorwegianValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        normalizeNorwegianValue(nestedValue),
      ]),
    );
  }

  return value;
}

async function migrateNorwegianText(db) {
  const nextDb = normalizeNorwegianValue(db);

  if (JSON.stringify(nextDb) === JSON.stringify(db)) {
    return db;
  }

  await writeDb(nextDb);
  return nextDb;
}

const MAX_REQUEST_BODY_BYTES = 50 * 1024 * 1024;

async function readJsonBody(request) {
  const chunks = [];
  let total = 0;

  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_REQUEST_BODY_BYTES) {
      const err = new Error(
        `Forespørselen er for stor. Maks ${MAX_REQUEST_BODY_BYTES / 1024 / 1024} MB.`,
      );
      err.statusCode = 413;
      throw err;
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const JSON_COMPRESSION_THRESHOLD = 1024;

function sendJson(response, statusCode, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    Vary: 'Accept-Encoding',
  };

  const accept = response.req?.headers?.['accept-encoding'] ?? '';
  let output = body;

  if (body.length >= JSON_COMPRESSION_THRESHOLD) {
    if (accept.includes('br')) {
      output = brotliCompressSync(body);
      headers['Content-Encoding'] = 'br';
    } else if (accept.includes('gzip')) {
      output = gzipSync(body);
      headers['Content-Encoding'] = 'gzip';
    }
  }

  headers['Content-Length'] = output.length;
  response.writeHead(statusCode, headers);
  response.end(output);
}

async function sendFile(
  request,
  response,
  statusCode,
  filePath,
  contentType,
  { cacheControl } = {},
) {
  const stats = await fs.stat(filePath);
  const totalSize = stats.size;
  const rangeHeader = request.headers.range;
  const isVideo = contentType.startsWith('video/');
  const extraHeaders = cacheControl ? { 'Cache-Control': cacheControl } : {};

  if (isVideo && rangeHeader) {
    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);

    if (!match) {
      response.writeHead(416, {
        'Content-Range': `bytes */${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      });
      response.end();
      return;
    }

    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : totalSize - 1;

    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      start < 0 ||
      end < start ||
      start >= totalSize
    ) {
      response.writeHead(416, {
        'Content-Range': `bytes */${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      });
      response.end();
      return;
    }

    const safeEnd = Math.min(end, totalSize - 1);
    const chunkSize = safeEnd - start + 1;

    response.writeHead(206, {
      'Content-Type': contentType,
      'Content-Length': chunkSize,
      'Content-Range': `bytes ${start}-${safeEnd}/${totalSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Disposition': 'inline',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      ...extraHeaders,
    });

    await new Promise((resolve, reject) => {
      const stream = createReadStream(filePath, { start, end: safeEnd });
      stream.on('error', reject);
      response.on('close', resolve);
      stream.pipe(response);
    });
    return;
  }

  response.writeHead(statusCode, {
    'Content-Type': contentType,
    'Content-Length': totalSize,
    'Accept-Ranges': 'bytes',
    'Content-Disposition': 'inline',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    ...extraHeaders,
  });

  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    response.on('close', resolve);
    stream.pipe(response);
  });
}

function getSessionToken(request) {
  const authHeader = request.headers.authorization ?? '';

  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice('Bearer '.length).trim();
}

function getAuthedUser(db, request) {
  const token = getSessionToken(request);

  if (!token) {
    return null;
  }

  const session = db.sessions.find((item) => item.token === token);

  if (session) {
    return db.users.find((user) => user.id === session.userId) ?? null;
  }

  const authSession = getAuthSession(token);
  if (!authSession || authSession.expires_at < Date.now()) {
    return null;
  }
  const authUser = getAuthUserById(authSession.user_id);
  if (!authUser || !authUser.active) return null;
  touchAuthSession(token);
  const jsonUser = db.users.find(
    (user) => user.email && user.email.toLowerCase() === authUser.email.toLowerCase(),
  );
  return jsonUser ?? null;
}

function buildLeaderSeed(db) {
  return db.users.map((user) => ({
    id: user.id,
    name: user.name,
    group: user.group,
    basePoints: user.basePoints,
    baseCompletedKnots: user.baseCompletedKnots,
  }));
}

function getLatestSubmissionByKnot(db, userId, knotId) {
  const submissions = db.submissions
    .filter((submission) => submission.leaderId === userId && submission.knotId === knotId)
    .sort(
      (left, right) =>
        new Date(right.submittedAtRaw ?? right.reviewedAtRaw ?? 0).getTime() -
        new Date(left.submittedAtRaw ?? left.reviewedAtRaw ?? 0).getTime(),
    );

  return submissions[0] ?? null;
}

function getKnotStatusForUser(db, userId, knotId) {
  const latestSubmission = getLatestSubmissionByKnot(db, userId, knotId);

  if (latestSubmission?.status === 'Godkjent') {
    return 'Godkjent';
  }

  if (latestSubmission?.status === 'Venter') {
    return 'Sendt inn';
  }

  if (latestSubmission?.status === 'Avslått') {
    return 'Avslått';
  }

  if (db.legacyApprovedKnotIdsByUser?.[userId]?.includes(knotId)) {
    return 'Godkjent';
  }

  return 'Tilgjengelig';
}

function normalizeSubmissionMode(value, fallback = 'review') {
  if (value === 'feed' || value === 'anonymous-feed' || value === 'review') {
    return value;
  }

  return fallback;
}

function deriveSubmissionMode(submission) {
  if (submission?.isAnonymousFeed === true) {
    return 'anonymous-feed';
  }

  if (submission?.status === 'Godkjent') {
    return 'feed';
  }

  return 'review';
}

function normalizeSubmissionRatings(ratings) {
  const nextRatings = {};

  Object.entries(ratings ?? {}).forEach(([leaderIdRaw, ratingRaw]) => {
    const leaderId = Number(leaderIdRaw);
    const rating = Number(ratingRaw);

    if (
      Number.isInteger(leaderId) &&
      leaderId > 0 &&
      Number.isInteger(rating) &&
      rating >= MIN_STAR_RATING &&
      rating <= MAX_STAR_RATING
    ) {
      nextRatings[String(leaderId)] = rating;
    }
  });

  return nextRatings;
}

function getSubmissionRatingSummary(ratings) {
  const values = Object.values(ratings);

  if (values.length === 0) {
    return {
      average: 0,
      count: 0,
    };
  }

  const sum = values.reduce((total, value) => total + value, 0);

  return {
    average: Number((sum / values.length).toFixed(2)),
    count: values.length,
  };
}

function getSubmissionMyRating(ratings, userId) {
  if (!userId) {
    return null;
  }

  const myRating = ratings[String(userId)];
  return Number.isInteger(myRating) ? myRating : null;
}

function isSubmissionVisibleInFeed(submission) {
  const normalizedSubmissionMode = normalizeSubmissionMode(
    submission?.submissionMode,
    deriveSubmissionMode(submission),
  );

  return (
    submission?.status === 'Godkjent' &&
    (normalizedSubmissionMode === 'feed' || normalizedSubmissionMode === 'anonymous-feed')
  );
}

async function migrateSubmissionRatings(db) {
  let changed = false;

  const submissions = db.submissions.map((submission) => {
    const normalizedRatings = normalizeSubmissionRatings(submission.ratings);
    const currentRatings = submission.ratings ?? {};

    if (JSON.stringify(normalizedRatings) === JSON.stringify(currentRatings)) {
      return submission;
    }

    changed = true;
    return {
      ...submission,
      ratings: normalizedRatings,
    };
  });

  if (!changed) {
    return db;
  }

  const nextDb = {
    ...db,
    submissions,
  };

  await writeDb(nextDb);
  return nextDb;
}

function normalizeCompletionApproval(completedAt, approvedValue) {
  if (!completedAt) {
    return null;
  }

  if (approvedValue === false) {
    return false;
  }

  return true;
}

async function migrateDuelCompletionApprovals(db) {
  let changed = false;

  const duels = (db.duels ?? []).map((duel) => {
    const stakeValue = Number(duel.stake);
    const normalizedStake = duel.status === 'active'
      ? DUEL_STAKE
      : Number.isFinite(stakeValue)
        ? stakeValue
        : DUEL_STAKE;
    const challengerCompletionApproved = normalizeCompletionApproval(
      duel.challengerCompletedAt,
      duel.challengerCompletionApproved,
    );
    const opponentCompletionApproved = normalizeCompletionApproval(
      duel.opponentCompletedAt,
      duel.opponentCompletionApproved,
    );
    const challengerSubmissionId = duel.challengerSubmissionId ?? null;
    const opponentSubmissionId = duel.opponentSubmissionId ?? null;

    if (
      normalizedStake === duel.stake &&
      challengerCompletionApproved === duel.challengerCompletionApproved &&
      opponentCompletionApproved === duel.opponentCompletionApproved &&
      challengerSubmissionId === duel.challengerSubmissionId &&
      opponentSubmissionId === duel.opponentSubmissionId
    ) {
      return duel;
    }

    changed = true;
    return {
      ...duel,
      stake: normalizedStake,
      challengerCompletionApproved,
      opponentCompletionApproved,
      challengerSubmissionId,
      opponentSubmissionId,
    };
  });

  if (!changed) {
    return db;
  }

  const nextDb = {
    ...db,
    duels,
  };

  await writeDb(nextDb);
  return nextDb;
}

function normalizeReportReason(value) {
  if (REPORT_REASON_OPTIONS.includes(value)) {
    return value;
  }

  return 'Annet';
}

function normalizeReportStatus(value) {
  if (
    value === REPORT_STATUS.OPEN ||
    value === REPORT_STATUS.REVIEWED ||
    value === REPORT_STATUS.ACTIONED ||
    value === REPORT_STATUS.DISMISSED
  ) {
    return value;
  }

  return REPORT_STATUS.OPEN;
}

function normalizeBanType(value) {
  if (value === BAN_TYPES.FEED || value === BAN_TYPES.SUBMISSION) {
    return value;
  }

  return BAN_TYPES.FEED;
}

function normalizeGenderIdentity(value) {
  if (typeof value !== 'string') {
    return 'other';
  }

  const normalizedValue = value.trim().toLowerCase();
  return GENDER_IDENTITY_ALIASES[normalizedValue] ?? 'other';
}

async function migrateProfileGenderData(db) {
  let changed = false;
  const users = (db.users ?? []).map((user) => {
    const profile = user?.profile ?? {};
    const { includeInGenderStats: _legacyIncludeInGenderStats, ...profileWithoutLegacyFlag } =
      profile;
    const normalizedGenderIdentity = normalizeGenderIdentity(profile.genderIdentity);
    const includeInGenderStatsExists = Object.prototype.hasOwnProperty.call(
      profile,
      'includeInGenderStats',
    );

    if (
      normalizedGenderIdentity === profile.genderIdentity &&
      !includeInGenderStatsExists
    ) {
      return user;
    }

    changed = true;
    return {
      ...user,
      profile: {
        ...profileWithoutLegacyFlag,
        genderIdentity: normalizedGenderIdentity,
      },
    };
  });

  if (!changed) {
    return db;
  }

  const nextDb = {
    ...db,
    users,
  };

  await writeDb(nextDb);
  return nextDb;
}

function toIsoOrFallback(value, fallbackIso) {
  const parsedMs = Date.parse(value ?? '');

  if (Number.isFinite(parsedMs)) {
    return new Date(parsedMs).toISOString();
  }

  return fallbackIso;
}

function getSubmissionBasePoints(db, submission) {
  const currentBasePoints = Number(submission?.basePoints);

  if (Number.isFinite(currentBasePoints) && currentBasePoints >= 0) {
    return Math.round(currentBasePoints);
  }

  const knotPoints = Number(
    db.knots.find((knot) => knot.id === submission?.knotId)?.points,
  );

  if (Number.isFinite(knotPoints) && knotPoints >= 0) {
    return Math.round(knotPoints);
  }

  const fallbackPoints = Number(submission?.points);
  if (Number.isFinite(fallbackPoints) && fallbackPoints >= 0) {
    return Math.round(fallbackPoints);
  }

  return 0;
}

function toOsloDayKey(isoValue) {
  const parsed = Date.parse(isoValue ?? '');

  if (!Number.isFinite(parsed)) {
    return null;
  }

  const parts = OSLO_DAY_FORMATTER.formatToParts(new Date(parsed));
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

function getDayKeyDiff(fromDayKey, toDayKey) {
  const fromMs = Date.parse(`${fromDayKey}T00:00:00.000Z`);
  const toMs = Date.parse(`${toDayKey}T00:00:00.000Z`);

  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    return null;
  }

  return Math.round((toMs - fromMs) / (24 * 60 * 60 * 1000));
}

function getStreakBonusPercent(streakDays) {
  const safeDays = Math.max(0, Number(streakDays) || 0);
  const tier = STREAK_BONUS_TIERS.find((candidate) => safeDays >= candidate.minDays);
  return tier?.percent ?? 0;
}

function getStreakBonusPoints(basePoints, streakDays) {
  const safeBasePoints = Math.max(0, Number(basePoints) || 0);
  const percent = getStreakBonusPercent(streakDays);
  const rawBonus = Math.floor(safeBasePoints * percent);
  return Math.min(STREAK_DAILY_BONUS_CAP, Math.max(0, rawBonus));
}

function normalizeStreakUserIds(submissions, userIds) {
  if (Array.isArray(userIds)) {
    return [...new Set(
      userIds
        .map((userId) => Number(userId))
        .filter((userId) => Number.isInteger(userId) && userId > 0),
    )];
  }

  return [...new Set(
    submissions
      .map((submission) => Number(submission?.leaderId))
      .filter((userId) => Number.isInteger(userId) && userId > 0),
  )];
}

function recalculateSubmissionStreaksForUser(db, submissions, userId) {
  const fallbackIso = nowIso();
  const streakTimeline = submissions
    .filter(
      (submission) =>
        submission?.leaderId === userId && submission?.status === 'Godkjent',
    )
    .map((submission) => {
      const submittedAtRaw = submission?.submittedAtRaw ?? submission?.reviewedAtRaw;
      return {
        submissionId: submission.id,
        submittedAtIso: toIsoOrFallback(submittedAtRaw, fallbackIso),
      };
    })
    .sort((left, right) => {
      const leftMs = Date.parse(left.submittedAtIso);
      const rightMs = Date.parse(right.submittedAtIso);

      if (leftMs !== rightMs) {
        return leftMs - rightMs;
      }

      return String(left.submissionId).localeCompare(String(right.submissionId), 'nb');
    });
  const streakBySubmissionId = new Map();
  const rewardedDays = new Set();
  let currentStreak = 0;
  let previousRewardedDay = null;

  streakTimeline.forEach((entry) => {
    const dayKey = toOsloDayKey(entry.submittedAtIso);

    if (!dayKey || rewardedDays.has(dayKey)) {
      streakBySubmissionId.set(entry.submissionId, {
        streakQualified: false,
        streakDay: null,
        streakDayKey: null,
      });
      return;
    }

    const dayDiff =
      previousRewardedDay == null ? null : getDayKeyDiff(previousRewardedDay, dayKey);
    currentStreak = dayDiff === 1 ? currentStreak + 1 : 1;
    previousRewardedDay = dayKey;
    rewardedDays.add(dayKey);

    streakBySubmissionId.set(entry.submissionId, {
      streakQualified: true,
      streakDay: currentStreak,
      streakDayKey: dayKey,
    });
  });

  let changed = false;
  const nextSubmissions = submissions.map((submission) => {
    if (submission?.leaderId !== userId) {
      return submission;
    }

    const basePoints = getSubmissionBasePoints(db, submission);

    if (submission?.status !== 'Godkjent') {
      const nextSubmission = {
        ...submission,
        points: basePoints,
        basePoints,
        streakBonusPoints: 0,
        streakQualified: false,
        streakDay: null,
        streakDayKey: null,
      };

      if (JSON.stringify(nextSubmission) !== JSON.stringify(submission)) {
        changed = true;
        return nextSubmission;
      }

      return submission;
    }

    const streakMeta = streakBySubmissionId.get(submission.id) ?? {
      streakQualified: false,
      streakDay: null,
      streakDayKey: null,
    };
    const streakBonusPoints = streakMeta.streakQualified
      ? getStreakBonusPoints(basePoints, streakMeta.streakDay)
      : 0;
    const nextSubmission = {
      ...submission,
      points: basePoints + streakBonusPoints,
      basePoints,
      streakBonusPoints,
      streakQualified: streakMeta.streakQualified,
      streakDay: streakMeta.streakDay,
      streakDayKey: streakMeta.streakDayKey,
    };

    if (JSON.stringify(nextSubmission) !== JSON.stringify(submission)) {
      changed = true;
      return nextSubmission;
    }

    return submission;
  });

  return {
    changed,
    submissions: nextSubmissions,
  };
}

function applyStreakRecalculation(db, userIds = null) {
  const targetUserIds = normalizeStreakUserIds(db.submissions ?? [], userIds);
  let changed = false;
  let nextSubmissions = db.submissions ?? [];

  targetUserIds.forEach((userId) => {
    const result = recalculateSubmissionStreaksForUser(db, nextSubmissions, userId);

    if (result.changed) {
      changed = true;
      nextSubmissions = result.submissions;
    }
  });

  if (!changed) {
    return {
      changed: false,
      db,
    };
  }

  return {
    changed: true,
    db: {
      ...db,
      submissions: nextSubmissions,
    },
  };
}

function computeCurrentStreakFromDayKeys(dayKeys) {
  if (dayKeys.length === 0) {
    return 0;
  }

  let streak = 1;

  for (let index = dayKeys.length - 1; index > 0; index -= 1) {
    const dayDiff = getDayKeyDiff(dayKeys[index - 1], dayKeys[index]);

    if (dayDiff === 1) {
      streak += 1;
      continue;
    }

    break;
  }

  const latestDay = dayKeys[dayKeys.length - 1];
  const todayDayKey = toOsloDayKey(nowIso());
  const gapToToday =
    latestDay && todayDayKey ? getDayKeyDiff(latestDay, todayDayKey) : null;

  if (gapToToday == null || gapToToday < 0 || gapToToday > 1) {
    return 0;
  }

  return streak;
}

function getUserStreakSummary(db, userId) {
  const qualifiedDayKeys = [...new Set(
    (db.submissions ?? [])
      .filter(
        (submission) =>
          submission?.leaderId === userId &&
          submission?.status === 'Godkjent' &&
          submission?.streakQualified === true &&
          typeof submission?.streakDayKey === 'string',
      )
      .map((submission) => submission.streakDayKey),
  )].sort((left, right) => left.localeCompare(right, 'nb'));
  const current = computeCurrentStreakFromDayKeys(qualifiedDayKeys);
  const todayDayKey = toOsloDayKey(nowIso());
  const lastQualifiedDayKey = qualifiedDayKeys[qualifiedDayKeys.length - 1] ?? null;
  const todayQualified = lastQualifiedDayKey != null && todayDayKey === lastQualifiedDayKey;
  const currentBonusPercent = getStreakBonusPercent(current);

  return {
    current,
    todayQualified,
    currentBonusPercent,
    currentBonusPointsCap: STREAK_DAILY_BONUS_CAP,
    lastQualifiedDayKey,
  };
}

async function migrateSubmissionStreakData(db) {
  const result = applyStreakRecalculation(db);

  if (!result.changed) {
    return db;
  }

  await writeDb(result.db);
  return result.db;
}

function formatRemainingDuration(remainingMs) {
  const safeMs = Math.max(0, Number(remainingMs) || 0);
  const totalMinutes = Math.max(1, Math.ceil(safeMs / (1000 * 60)));

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  const restMinutes = totalMinutes % 60;

  if (totalHours < 24) {
    return restMinutes > 0 ? `${totalHours}t ${restMinutes}m` : `${totalHours}t`;
  }

  const totalDays = Math.floor(totalHours / 24);
  const restHours = totalHours % 24;
  return restHours > 0 ? `${totalDays}d ${restHours}t` : `${totalDays}d`;
}

function isBanActive(ban, nowMs = Date.now()) {
  if (!ban || ban.active === false) {
    return false;
  }

  const expiresAtMs = Date.parse(ban.expiresAt ?? '');

  if (!Number.isFinite(expiresAtMs)) {
    return false;
  }

  return expiresAtMs > nowMs;
}

function getActiveBansForUser(db, userId, nowMs = Date.now()) {
  return (db.bans ?? []).filter(
    (ban) => ban.userId === userId && isBanActive(ban, nowMs),
  );
}

function getActiveBanByType(db, userId, type, nowMs = Date.now()) {
  const candidateType = normalizeBanType(type);
  return getActiveBansForUser(db, userId, nowMs)
    .filter((ban) => ban.type === candidateType)
    .sort((left, right) => Date.parse(right.expiresAt) - Date.parse(left.expiresAt))[0] ?? null;
}

function getBanBlockMessage(type, ban, nowMs = Date.now()) {
  const expiresAtMs = Date.parse(ban?.expiresAt ?? '');
  const remainingLabel = Number.isFinite(expiresAtMs)
    ? formatRemainingDuration(expiresAtMs - nowMs)
    : 'en stund';

  if (type === BAN_TYPES.SUBMISSION) {
    return `Du har innsendings-ban i ${remainingLabel} til. Du kan ikke sende inn knuter akkurat nå.`;
  }

  return `Du har feed-ban i ${remainingLabel} til. Posting i feed er midlertidig blokkert.`;
}

function buildCurrentUserActiveBans(db, userId, nowMs = Date.now()) {
  return getActiveBansForUser(db, userId, nowMs).map((ban) => {
    const expiresAtMs = Date.parse(ban.expiresAt ?? '');
    const remainingLabel = Number.isFinite(expiresAtMs)
      ? formatRemainingDuration(expiresAtMs - nowMs)
      : '';

    return {
      id: ban.id,
      type: ban.type,
      startedAt: ban.startedAt,
      expiresAt: ban.expiresAt,
      startedAtLabel: getRelativeLabel(ban.startedAt),
      expiresAtLabel: getRelativeLabel(ban.expiresAt),
      remainingLabel,
    };
  });
}

async function migrateModerationData(db) {
  let changed = false;
  const now = nowIso();
  const reportsSource = Array.isArray(db.reports) ? db.reports : [];
  const bansSource = Array.isArray(db.bans) ? db.bans : [];

  if (!Array.isArray(db.reports) || !Array.isArray(db.bans)) {
    changed = true;
  }

  const reports = reportsSource
    .map((report) => {
      const submissionId = typeof report?.submissionId === 'string' ? report.submissionId : '';
      const reporterId = Number(report?.reporterId);

      if (!submissionId || !Number.isInteger(reporterId) || reporterId <= 0) {
        changed = true;
        return null;
      }

      const normalized = {
        id:
          typeof report?.id === 'string' && report.id
            ? report.id
            : `report-${Date.now()}-${randomUUID().slice(0, 8)}`,
        submissionId,
        reporterId,
        reason: normalizeReportReason(report?.reason),
        note: typeof report?.note === 'string' ? report.note.slice(0, 300) : '',
        status: normalizeReportStatus(report?.status),
        createdAt: toIsoOrFallback(report?.createdAt, now),
        reviewedAt:
          report?.reviewedAt == null ? null : toIsoOrFallback(report?.reviewedAt, now),
        reviewedBy: Number.isInteger(Number(report?.reviewedBy))
          ? Number(report.reviewedBy)
          : null,
        resolution: typeof report?.resolution === 'string' ? report.resolution : null,
      };

      if (JSON.stringify(normalized) !== JSON.stringify(report)) {
        changed = true;
      }

      return normalized;
    })
    .filter(Boolean);

  const uniqueReportMap = new Map();

  reports
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .forEach((report) => {
      const key = `${report.submissionId}:${report.reporterId}`;

      if (uniqueReportMap.has(key)) {
        changed = true;
        return;
      }

      uniqueReportMap.set(key, report);
    });

  const dedupedReports = Array.from(uniqueReportMap.values()).sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );

  const bans = bansSource
    .map((ban) => {
      const userId = Number(ban?.userId);

      if (!Number.isInteger(userId) || userId <= 0) {
        changed = true;
        return null;
      }

      const startedAt = toIsoOrFallback(ban?.startedAt, now);
      let expiresAt = toIsoOrFallback(
        ban?.expiresAt,
        new Date(Date.parse(startedAt) + 24 * 60 * 60 * 1000).toISOString(),
      );

      if (Date.parse(expiresAt) <= Date.parse(startedAt)) {
        expiresAt = new Date(Date.parse(startedAt) + 24 * 60 * 60 * 1000).toISOString();
        changed = true;
      }

      const normalized = {
        id:
          typeof ban?.id === 'string' && ban.id
            ? ban.id
            : `ban-${Date.now()}-${randomUUID().slice(0, 8)}`,
        userId,
        type: normalizeBanType(ban?.type),
        startedAt,
        expiresAt,
        createdBy: Number.isInteger(Number(ban?.createdBy)) ? Number(ban.createdBy) : null,
        active: ban?.active !== false,
        endedAt: ban?.endedAt == null ? null : toIsoOrFallback(ban.endedAt, now),
      };

      if (JSON.stringify(normalized) !== JSON.stringify(ban)) {
        changed = true;
      }

      return normalized;
    })
    .filter(Boolean);

  if (!changed) {
    return db;
  }

  const nextDb = {
    ...db,
    reports: dedupedReports,
    bans,
  };

  await writeDb(nextDb);
  return nextDb;
}

async function migrateSubmissionFeedFlags(db) {
  let changed = false;

  const submissions = (db.submissions ?? []).map((submission) => {
    const normalizedSubmissionMode = normalizeSubmissionMode(
      submission?.submissionMode,
      deriveSubmissionMode(submission),
    );
    const nextIsAnonymousFeed = normalizedSubmissionMode === 'anonymous-feed';
    const currentIsAnonymousFeed = submission?.isAnonymousFeed === true;

    if (
      submission?.submissionMode === normalizedSubmissionMode &&
      currentIsAnonymousFeed === nextIsAnonymousFeed
    ) {
      return submission;
    }

    changed = true;
    return {
      ...submission,
      submissionMode: normalizedSubmissionMode,
      isAnonymousFeed: nextIsAnonymousFeed,
    };
  });

  if (!changed) {
    return db;
  }

  const nextDb = {
    ...db,
    submissions,
  };

  await writeDb(nextDb);
  return nextDb;
}

async function migrateKnotFeedbackMessages(db) {
  const hasExisting =
    db.knotFeedbackMessages != null &&
    typeof db.knotFeedbackMessages === 'object' &&
    !Array.isArray(db.knotFeedbackMessages);
  const nextMessages = hasExisting
    ? normalizeKnotFeedbackMessages(db.knotFeedbackMessages)
    : cloneKnotFeedbackMessages();

  if (JSON.stringify(db.knotFeedbackMessages ?? null) === JSON.stringify(nextMessages)) {
    return db;
  }

  const nextDb = {
    ...db,
    knotFeedbackMessages: nextMessages,
  };

  await writeDb(nextDb);
  return nextDb;
}

function toPublicReport(db, report) {
  const reporter = db.users.find((user) => user.id === report.reporterId);
  const submission = db.submissions.find((item) => item.id === report.submissionId);
  const submittedBy = submission
    ? db.users.find((user) => user.id === submission.leaderId)
    : null;
  const reviewer = report.reviewedBy
    ? db.users.find((user) => user.id === report.reviewedBy)
    : null;

  return {
    id: report.id,
    submissionId: report.submissionId,
    reporterId: report.reporterId,
    reporterName: reporter?.name ?? 'Ukjent',
    reason: report.reason,
    note: report.note ?? '',
    status: report.status,
    createdAt: report.createdAt,
    createdAtLabel: getRelativeLabel(report.createdAt),
    reviewedAt: report.reviewedAt,
    reviewedAtLabel: report.reviewedAt ? getRelativeLabel(report.reviewedAt) : '',
    reviewedBy: report.reviewedBy,
    reviewedByName: reviewer?.name ?? '',
    resolution: report.resolution ?? '',
    knotTitle: submission?.knotTitle ?? 'Ukjent knute',
    submissionStatus: submission?.status ?? 'Ukjent',
    submissionMode: submission?.submissionMode ?? 'review',
    submissionVisibleInFeed: submission ? isSubmissionVisibleInFeed(submission) : false,
    submittedById: submission?.leaderId ?? null,
    submittedByName: submittedBy?.name ?? submission?.student ?? 'Ukjent',
  };
}

function toPublicBan(db, ban, nowMs = Date.now()) {
  const targetUser = db.users.find((user) => user.id === ban.userId);
  const createdByUser = ban.createdBy
    ? db.users.find((user) => user.id === ban.createdBy)
    : null;
  const expiresAtMs = Date.parse(ban.expiresAt ?? '');
  const active = isBanActive(ban, nowMs);

  return {
    id: ban.id,
    userId: ban.userId,
    userName: targetUser?.name ?? 'Ukjent',
    userClassName: targetUser?.profile?.className ?? targetUser?.group ?? '',
    type: ban.type,
    startedAt: ban.startedAt,
    startedAtLabel: getRelativeLabel(ban.startedAt),
    expiresAt: ban.expiresAt,
    expiresAtLabel: getRelativeLabel(ban.expiresAt),
    active,
    remainingLabel:
      active && Number.isFinite(expiresAtMs)
        ? formatRemainingDuration(expiresAtMs - nowMs)
        : 'Utløpt',
    createdBy: ban.createdBy,
    createdByName: createdByUser?.name ?? '',
    endedAt: ban.endedAt ?? null,
  };
}

function toPublicSubmission(db, submission, currentUserId = null) {
  const user = db.users.find((item) => item.id === submission.leaderId);
  const knot = db.knots.find((item) => item.id === submission.knotId);
  const knotCategory =
    typeof submission.knotCategory === 'string' && submission.knotCategory.trim()
      ? submission.knotCategory.trim()
      : typeof knot?.category === 'string' && knot.category.trim()
        ? knot.category.trim()
        : 'Ukjent';
  const normalizedSubmissionMode = normalizeSubmissionMode(
    submission.submissionMode,
    deriveSubmissionMode(submission),
  );
  const submissionMode = normalizedSubmissionMode;
  const isAnonymousFeed = submissionMode === 'anonymous-feed';
  const ratings = normalizeSubmissionRatings(submission.ratings);
  const ratingSummary = getSubmissionRatingSummary(ratings);

  return {
    id: submission.id,
    knotId: submission.knotId,
    knotTitle: submission.knotTitle,
    knotCategory,
    student: user?.name ?? submission.student ?? 'Ukjent',
    leaderId: submission.leaderId,
    submittedAt: getRelativeLabel(submission.submittedAtRaw ?? nowIso()),
    submittedAtRaw: submission.submittedAtRaw ?? null,
    status: submission.status,
    points: submission.points,
    basePoints: submission.basePoints ?? submission.points,
    streakBonusPoints: submission.streakBonusPoints ?? 0,
    streakQualified: submission.streakQualified === true,
    streakDay: submission.streakDay ?? null,
    streakDayKey: submission.streakDayKey ?? null,
    note: submission.note ?? '',
    imageName: submission.imageName ?? '',
    imagePreviewUrl: submission.imagePreviewUrl ?? '',
    imageThumbUrl: deriveThumbUrl(submission.imagePreviewUrl ?? ''),
    videoName: submission.videoName ?? '',
    videoPreviewUrl: submission.videoPreviewUrl ?? '',
    isAnonymousFeed,
    submissionMode,
    profileHidden: submission.profileHidden ?? false,
    ratingAverage: ratingSummary.average,
    ratingCount: ratingSummary.count,
    myRating: getSubmissionMyRating(ratings, currentUserId),
  };
}

function buildClientKnots(db, userId) {
  return db.knots
    .filter((knot) => knot.isActive !== false)
    .map((knot) => ({
      ...knot,
      status: getKnotStatusForUser(db, userId, knot.id),
    }));
}

function canUseKnotInDuel(db, knot, challengerId, opponentId, activeKnotIds) {
  if (knot.isActive === false || knot.duelEnabled === false) {
    return false;
  }

  if (activeKnotIds.has(knot.id)) {
    return false;
  }

  const challengerStatus = getKnotStatusForUser(db, challengerId, knot.id);
  const opponentStatus = getKnotStatusForUser(db, opponentId, knot.id);

  return challengerStatus !== 'Godkjent' && opponentStatus !== 'Godkjent';
}

function pickDuelKnotForPair(db, challengerId, opponentId) {
  const activeKnotIds = new Set(
    db.duels
      .filter((duel) => duel.status === 'active')
      .map((duel) => duel.knotId),
  );

  const candidates = db.knots
    .filter((knot) =>
      canUseKnotInDuel(db, knot, challengerId, opponentId, activeKnotIds),
    )
    .sort((left, right) => {
      if ((right.points ?? 0) !== (left.points ?? 0)) {
        return (right.points ?? 0) - (left.points ?? 0);
      }

      return left.id.localeCompare(right.id, 'nb');
    });

  return candidates[0] ?? null;
}

function buildBootstrap(db, user) {
  const nowMs = Date.now();
  const isAdminUser = assertAdmin(user);
  const currentUserId = user.id;

  const leaderSeed = buildLeaderSeed(db);
  const clientKnots = buildClientKnots(db, currentUserId);
  const publicSubmissions = db.submissions.map((submission) =>
    toPublicSubmission(db, submission, currentUserId),
  );
  const ownSubmissions = isAdminUser
    ? publicSubmissions
    : publicSubmissions.filter((submission) => submission.leaderId === currentUserId);
  const visibleDuels = isAdminUser
    ? db.duels
    : db.duels.filter(
        (duel) =>
          duel.challengerId === currentUserId || duel.opponentId === currentUserId,
      );
  const profileDetails = Object.fromEntries(
    db.users.map((entry) => [entry.id, entry.profile]),
  );
  const rawLeaderboard = buildLeaderboard(
    leaderSeed,
    publicSubmissions,
    clientKnots,
    currentUserId,
    db.duels,
  );
  const profilesRaw = buildProfiles(
    rawLeaderboard,
    currentUserId,
    clientKnots,
    publicSubmissions,
    db.profileHistory,
    profileDetails,
  );
  const profiles = profilesRaw.map((profile) => ({
    ...profile,
    photoThumbUrl: deriveThumbUrl(profile.photoUrl ?? ''),
  }));
  const leaderboard = rawLeaderboard.map((leader) => {
    const profile = profiles.find((candidate) => candidate.id === leader.id);
    return profile
      ? {
          ...leader,
          icon: profile.icon,
          leaderboardTitle: profile.leaderboardTitle,
          photoUrl: profile.photoUrl,
          photoThumbUrl: deriveThumbUrl(profile.photoUrl ?? ''),
          russName: profile.russName,
          realName: profile.realName,
          className: profile.className,
          genderIdentity: profile.genderIdentity,
        }
      : leader;
  });
  const currentLeader =
    leaderboard.find((leader) => leader.id === currentUserId) ?? null;
  const achievements = buildAchievements(clientKnots, currentLeader);
  const activityLog = buildActivityLog(profiles, publicSubmissions);
  const classLeaderboard = buildClassLeaderboard(leaderboard);
  const knotTypeLeaderboard = buildKnotTypeLeaderboard(publicSubmissions, clientKnots);
  const genderLeaderboards = buildGenderLeaderboards(leaderboard);
  const dailyKnot = buildDailyKnot(clientKnots);
  const duelAvailability = buildDuelAvailability(currentUserId, leaderboard, db.duels);
  const duelHistory = buildDuelHistory(db.duels, leaderboard);
  const duelSummary = {
    stake: DUEL_STAKE,
    range: DUEL_RANGE,
    deadlineHours: DUEL_WINDOW_HOURS,
    dailyLimit: DUEL_LIMITS_DISABLED ? 'Ingen (testmodus)' : DUEL_DAILY_LIMIT,
    currentUserDailyCount: duelAvailability.currentUserDailyCount ?? 0,
    currentUserRemaining: duelAvailability.currentUserRemaining ?? 0,
    thisDayTotal: duelAvailability.thisDayTotal ?? 0,
    activeCount: db.duels.filter((duel) => duel.status === 'active').length,
  };
  const dashboardData = currentLeader
    ? buildDashboardData(currentUserId, leaderboard, achievements, activityLog, clientKnots)
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

  return {
    school: db.schools[0],
    currentUser: {
      leaderId: currentUserId,
      name: user.name,
      email: user.email ?? '',
      group: user.group,
      role: user.role,
    },
    currentUserStreak: getUserStreakSummary(db, currentUserId),
    leaders: leaderSeed,
    knots: clientKnots,
    submissions: ownSubmissions,
    duels: visibleDuels,
    reports: isAdminUser
      ? (db.reports ?? []).map((report) => toPublicReport(db, report))
      : [],
    bans: isAdminUser
      ? (db.bans ?? [])
          .map((ban) => toPublicBan(db, ban, nowMs))
          .sort((left, right) => Date.parse(right.expiresAt) - Date.parse(left.expiresAt))
      : [],
    currentUserActiveBans: buildCurrentUserActiveBans(db, currentUserId, nowMs),
    moderationPolicy: MODERATION_POLICY,
    leaderboard,
    profiles,
    achievements,
    activityLog,
    classLeaderboard,
    knotTypeLeaderboard,
    genderLeaderboards,
    dailyKnot,
    duelAvailability,
    duelHistory,
    duelSummary,
    dashboardData,
    knotFeedbackMessages: cloneKnotFeedbackMessages(db.knotFeedbackMessages),
  };
}

async function saveUploadedAsset(dataUrl, originalName, category) {
  if (!dataUrl) {
    return '';
  }

  const parsed = parseDataUrl(dataUrl);

  if (!parsed) {
    return '';
  }

  const isVideo = VIDEO_MIME_TYPES.has(parsed.mimeType);

  if (!isVideo) {
    const isImage = parsed.mimeType.startsWith('image/');
    if (isImage) {
      const safeName = `${category}-${Date.now()}-${randomUUID()}.webp`;
      const outputPath = path.join(UPLOADS_DIR, safeName);
      await sharp(parsed.buffer)
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(outputPath);
      const thumbName = `${path.basename(safeName, path.extname(safeName))}-thumb.webp`;
      await sharp(parsed.buffer)
        .rotate()
        .resize({ width: 480, withoutEnlargement: true })
        .webp({ quality: 72 })
        .toFile(path.join(UPLOADS_DIR, thumbName));
      return `/uploads/${safeName}`;
    }
    const extension = path.extname(originalName || '') || getExtensionFromMime(parsed.mimeType);
    const safeName = `${category}-${Date.now()}-${randomUUID()}${extension}`;
    const outputPath = path.join(UPLOADS_DIR, safeName);
    await fs.writeFile(outputPath, parsed.buffer);
    return `/uploads/${safeName}`;
  }

  if (parsed.buffer.length > MAX_VIDEO_BYTES) {
    throw new Error(
      `Videoen er for stor (${(parsed.buffer.length / 1024 / 1024).toFixed(1)} MB). Maks ${MAX_VIDEO_BYTES / 1024 / 1024} MB.`,
    );
  }

  const mp4Name = `${category}-${Date.now()}-${randomUUID()}.mp4`;
  const mp4Path = path.join(UPLOADS_DIR, mp4Name);

  await fs.writeFile(mp4Path, parsed.buffer);
  scheduleTranscode(mp4Path);
  return `/uploads/${mp4Name}`;
}

function deriveThumbUrl(fileUrl) {
  if (!fileUrl || !fileUrl.startsWith('/uploads/')) return '';
  const ext = path.extname(fileUrl).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return '';
  const base = fileUrl.slice(0, fileUrl.length - ext.length);
  return `${base}-thumb.webp`;
}

async function deleteLocalUploadIfNeeded(fileUrl) {
  if (!fileUrl || !fileUrl.startsWith('/uploads/')) return;

  const fileName = fileUrl.replace('/uploads/', '');
  await fs.rm(path.join(UPLOADS_DIR, fileName), { force: true });

  const thumbUrl = deriveThumbUrl(fileUrl);
  if (thumbUrl) {
    const thumbName = thumbUrl.replace('/uploads/', '');
    await fs.rm(path.join(UPLOADS_DIR, thumbName), { force: true });
  }
}

async function cleanupSubmissionAssets(submission) {
  await deleteLocalUploadIfNeeded(submission?.imagePreviewUrl);
  await deleteLocalUploadIfNeeded(submission?.videoPreviewUrl);
}

async function cleanupDuelAssets(duel) {
  await deleteLocalUploadIfNeeded(duel?.challengerImagePreviewUrl);
  await deleteLocalUploadIfNeeded(duel?.challengerVideoPreviewUrl);
  await deleteLocalUploadIfNeeded(duel?.opponentImagePreviewUrl);
  await deleteLocalUploadIfNeeded(duel?.opponentVideoPreviewUrl);
}

function buildDisplayLeaders(db, currentUserId) {
  const leaders = buildLeaderboard(
    buildLeaderSeed(db),
    db.submissions.map((submission) =>
      toPublicSubmission(db, submission, currentUserId),
    ),
    buildClientKnots(db, currentUserId),
    currentUserId,
    db.duels,
  );
  const profileDetails = Object.fromEntries(db.users.map((user) => [user.id, user.profile]));

  return leaders.map((leader) => ({
    ...leader,
    icon: profileDetails[leader.id]?.icon ?? '',
    photoUrl: profileDetails[leader.id]?.photoUrl ?? '',
    russName: profileDetails[leader.id]?.russName ?? leader.name,
    realName: profileDetails[leader.id]?.realName ?? leader.name,
    className: profileDetails[leader.id]?.className ?? leader.group,
    genderIdentity: normalizeGenderIdentity(profileDetails[leader.id]?.genderIdentity),
  }));
}

function assertAdmin(user) {
  return user?.role === 'admin';
}

async function handleLogin(request, response) {
  const db = await readDb();
  const body = await readJsonBody(request);
  const code = (body.code ?? '').trim().toUpperCase();
  const user = db.users.find((entry) => entry.loginCode === code);

  if (!user) {
    sendJson(response, 401, { error: 'Ugyldig kode.' });
    return;
  }

  const token = randomUUID();
  const nextDb = {
    ...db,
    sessions: [
      ...db.sessions.filter((session) => session.userId !== user.id),
      {
        token,
        userId: user.id,
        createdAt: nowIso(),
      },
    ],
  };

  await writeDb(nextDb);

  sendJson(response, 200, {
    token,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      russName: user.profile.russName,
    },
  });
}

async function handleLogout(request, response) {
  const db = await readDb();
  const token = getSessionToken(request);

  if (!token) {
    sendJson(response, 204, {});
    return;
  }

  const nextDb = {
    ...db,
    sessions: db.sessions.filter((session) => session.token !== token),
  };

  await writeDb(nextDb);
  sendJson(response, 200, { ok: true });
}

async function handleBootstrap(request, response) {
  const db = await readDb();
  const user = getAuthedUser(db, request);

  if (!user) {
    sendJson(response, 401, { error: 'Ikke logget inn.' });
    return;
  }

  sendJson(response, 200, buildBootstrap(db, user));
}

async function handlePilotUsers(_request, response) {
  const db = await readDb();

  sendJson(response, 200, {
    users: db.users.map((user) => ({
      id: user.id,
      name: user.name,
      russName: user.profile.russName,
      className: user.profile.className,
      role: user.role,
      code: user.loginCode,
    })),
  });
}

async function handleProfileUpdate(request, response) {
  const db = await readDb();
  const user = getAuthedUser(db, request);

  if (!user) {
    sendJson(response, 401, { error: 'Ikke logget inn.' });
    return;
  }

  const body = await readJsonBody(request);
  const targetUserId = Number(body?.targetUserId);
  const hasTargetUserId = Number.isInteger(targetUserId) && targetUserId > 0;
  const targetUser = hasTargetUserId
    ? db.users.find((entry) => entry.id === targetUserId)
    : user;

  if (!targetUser) {
    sendJson(response, 404, { error: 'Fant ikke profilen som skulle oppdateres.' });
    return;
  }

  if (targetUser.id !== user.id && !assertAdmin(user)) {
    sendJson(response, 403, { error: 'Kun admin kan oppdatere andre profiler.' });
    return;
  }

  const photoUrl = body.photoDataUrl
    ? await saveUploadedAsset(body.photoDataUrl, body.photoName, 'profile')
    : targetUser.profile.photoUrl;

  if (body.photoDataUrl && targetUser.profile.photoUrl !== photoUrl) {
    await deleteLocalUploadIfNeeded(targetUser.profile.photoUrl);
  }

  const nextDb = {
    ...db,
    users: db.users.map((entry) =>
      entry.id === targetUser.id
        ? {
            ...entry,
            profile: {
              ...entry.profile,
              icon: body.icon ?? entry.profile.icon,
              photoUrl,
              russName: assertAdmin(user)
                ? (body.russName ?? entry.profile.russName)
                : entry.profile.russName,
              realName: body.realName ?? entry.profile.realName,
              className: body.className ?? entry.profile.className,
              bio: body.bio ?? entry.profile.bio,
              quote: body.quote ?? entry.profile.quote,
              knownFor: body.knownFor ?? entry.profile.knownFor,
              signatureKnot:
                body.signatureKnot ?? entry.profile.signatureKnot,
              favoriteCategory:
                body.favoriteCategory ?? entry.profile.favoriteCategory,
              russType: body.russType === 'red' ? 'red' : 'blue',
              genderIdentity:
                body.genderIdentity == null
                  ? entry.profile.genderIdentity
                  : normalizeGenderIdentity(body.genderIdentity),
            },
          }
        : entry,
    ),
  };

  await writeDb(nextDb);
  sendJson(response, 200, buildBootstrap(nextDb, nextDb.users.find((item) => item.id === user.id)));
}

async function handleCreateSubmission(request, response) {
  const db = await readDb();
  const user = getAuthedUser(db, request);

  if (!user) {
    sendJson(response, 401, { error: 'Ikke logget inn.' });
    return;
  }

  const activeSubmissionBan = getActiveBanByType(
    db,
    user.id,
    BAN_TYPES.SUBMISSION,
  );

  if (activeSubmissionBan) {
    sendJson(response, 403, {
      error: getBanBlockMessage(BAN_TYPES.SUBMISSION, activeSubmissionBan),
    });
    return;
  }

  const body = await readJsonBody(request);
  const knot = db.knots.find((item) => item.id === body.knotId && item.isActive !== false);
  const hasRequestedSubmissionMode = Object.prototype.hasOwnProperty.call(
    body,
    'submissionMode',
  );
  const requestedSubmissionMode = normalizeSubmissionMode(
    body.submissionMode,
    body.isAnonymousFeed === true ? 'anonymous-feed' : body.postToFeed === true ? 'feed' : 'review',
  );
  const activeFeedBan = getActiveBanByType(db, user.id, BAN_TYPES.FEED);
  const submissionMode =
    activeFeedBan &&
    (requestedSubmissionMode === 'feed' || requestedSubmissionMode === 'anonymous-feed')
      ? 'review'
      : requestedSubmissionMode;
  const isAnonymousFeed = submissionMode === 'anonymous-feed';
  const createdAt = nowIso();

  if (!knot) {
    sendJson(response, 404, { error: 'Fant ikke knuten.' });
    return;
  }

  const existingPendingSubmission = db.submissions
    .filter(
      (submission) =>
        submission.knotId === knot.id &&
        submission.leaderId === user.id &&
        submission.status === 'Venter',
    )
    .sort(
      (left, right) =>
        new Date(right.submittedAtRaw ?? 0).getTime() -
        new Date(left.submittedAtRaw ?? 0).getTime(),
    )[0] ?? null;

  const imagePreviewUrl = await saveUploadedAsset(
    body.imageDataUrl,
    body.imageName,
    'submission-image',
  );
  const videoPreviewUrl = await saveUploadedAsset(
    body.videoDataUrl,
    body.videoName,
    'submission-video',
  );

  if (existingPendingSubmission) {
    const hasNewImage = Boolean(imagePreviewUrl);
    const hasNewVideo = Boolean(videoPreviewUrl);
    const shouldRemoveImage = body.removeImage === true && !hasNewImage;
    const shouldRemoveVideo = body.removeVideo === true && !hasNewVideo;
    const incomingNote = limitNoteWords(body.note);
    const currentSubmissionMode = normalizeSubmissionMode(
      existingPendingSubmission.submissionMode,
      deriveSubmissionMode(existingPendingSubmission),
    );
    const nextSubmissionMode = hasRequestedSubmissionMode
      ? submissionMode
      : currentSubmissionMode;
    const nextIsAnonymousFeed = nextSubmissionMode === 'anonymous-feed';

    if (
      (hasNewImage || shouldRemoveImage) &&
      existingPendingSubmission.imagePreviewUrl &&
      (!hasNewImage || existingPendingSubmission.imagePreviewUrl !== imagePreviewUrl)
    ) {
      await deleteLocalUploadIfNeeded(existingPendingSubmission.imagePreviewUrl);
    }

    if (
      (hasNewVideo || shouldRemoveVideo) &&
      existingPendingSubmission.videoPreviewUrl &&
      (!hasNewVideo || existingPendingSubmission.videoPreviewUrl !== videoPreviewUrl)
    ) {
      await deleteLocalUploadIfNeeded(existingPendingSubmission.videoPreviewUrl);
    }

    const nextDb = {
      ...db,
      submissions: db.submissions.map((submission) =>
        submission.id === existingPendingSubmission.id
          ? {
              ...submission,
              note: incomingNote || submission.note || '',
              imageName: hasNewImage
                ? (body.imageName ?? submission.imageName ?? '')
                : shouldRemoveImage
                  ? ''
                  : (submission.imageName ?? ''),
              imagePreviewUrl: hasNewImage
                ? imagePreviewUrl
                : shouldRemoveImage
                  ? ''
                  : (submission.imagePreviewUrl ?? ''),
              videoName: hasNewVideo
                ? (body.videoName ?? submission.videoName ?? '')
                : shouldRemoveVideo
                  ? ''
                  : (submission.videoName ?? ''),
              videoPreviewUrl: hasNewVideo
                ? videoPreviewUrl
                : shouldRemoveVideo
                  ? ''
                  : (submission.videoPreviewUrl ?? ''),
              submissionMode: nextSubmissionMode,
              isAnonymousFeed: nextIsAnonymousFeed,
            }
          : submission,
      ),
    };

    await writeDb(nextDb);
    sendJson(response, 200, buildBootstrap(nextDb, user));
    return;
  }

  const staleSubmissions = db.submissions.filter(
    (submission) =>
      !(
        submission.knotId === knot.id &&
        submission.leaderId === user.id &&
        submission.status !== 'Godkjent'
      ),
  );

  const removedSubmissions = db.submissions.filter(
    (submission) =>
      submission.knotId === knot.id &&
      submission.leaderId === user.id &&
      submission.status !== 'Godkjent',
  );

  await Promise.all(removedSubmissions.map((submission) => cleanupSubmissionAssets(submission)));

  const nextDb = {
    ...db,
    submissions: [
      {
        id: `submission-${Date.now()}`,
        knotId: knot.id,
        knotTitle: knot.title,
        knotCategory: knot.category ?? 'Ukjent',
        student: user.name,
        leaderId: user.id,
        submittedAtRaw: createdAt,
        status: 'Venter',
        points: knot.points,
        basePoints: knot.points,
        streakBonusPoints: 0,
        streakQualified: false,
        streakDay: null,
        streakDayKey: null,
        note: limitNoteWords(body.note),
        imageName: body.imageName ?? '',
        imagePreviewUrl,
        videoName: body.videoName ?? '',
        videoPreviewUrl,
        isAnonymousFeed,
        submissionMode,
        ratings: {},
        reviewedAtRaw: null,
        reviewedBy: null,
        profileHidden: false,
      },
      ...staleSubmissions,
    ],
  };

  await writeDb(nextDb);
  sendJson(response, 200, buildBootstrap(nextDb, user));
}

async function handleReviewSubmission(request, response, submissionId) {
  const db = await readDb();
  const user = getAuthedUser(db, request);

  if (!assertAdmin(user)) {
    sendJson(response, 403, { error: 'Kun admin kan vurdere innsendinger.' });
    return;
  }

  const body = await readJsonBody(request);
  const nextStatus = body.status === 'Godkjent' ? 'Godkjent' : 'Avslått';
  const submission = db.submissions.find((item) => item.id === submissionId);

  if (!submission) {
    sendJson(response, 404, { error: 'Fant ikke innsendingen.' });
    return;
  }

  const currentSubmissionMode = normalizeSubmissionMode(
    submission.submissionMode,
    deriveSubmissionMode(submission),
  );
  const hasRequestedSubmissionMode = Object.prototype.hasOwnProperty.call(
    body,
    'submissionMode',
  );

  if (hasRequestedSubmissionMode) {
    const requestedSubmissionMode = normalizeSubmissionMode(
      body.submissionMode,
      currentSubmissionMode,
    );

    if (requestedSubmissionMode !== currentSubmissionMode) {
      sendJson(response, 400, {
        error: 'Admin kan ikke endre innsendingstype ved godkjenning.',
      });
      return;
    }
  }

  const nextSubmissionMode = currentSubmissionMode;
  const nextIsAnonymousFeed =
    nextStatus === 'Godkjent' && nextSubmissionMode === 'anonymous-feed';

  const nextDb = {
    ...db,
    submissions: db.submissions.map((item) =>
      item.id === submissionId
        ? {
            ...item,
            status: nextStatus,
            submissionMode: nextSubmissionMode,
            isAnonymousFeed: nextIsAnonymousFeed,
            reviewedAtRaw: nowIso(),
            reviewedBy: user.id,
          }
        : item,
    ),
  };

  const recalculated = applyStreakRecalculation(nextDb, [submission.leaderId]);
  const finalDb = recalculated.db;

  await writeDb(finalDb);
  sendJson(response, 200, buildBootstrap(finalDb, user));
}

async function handleRateSubmission(request, response, submissionId) {
  const db = await readDb();
  const user = getAuthedUser(db, request);

  if (!user) {
    sendJson(response, 401, { error: 'Ikke logget inn.' });
    return;
  }

  const body = await readJsonBody(request);
  const nextRating = Number(body?.rating);

  if (
    !Number.isInteger(nextRating) ||
    nextRating < MIN_STAR_RATING ||
    nextRating > MAX_STAR_RATING
  ) {
    sendJson(response, 400, { error: 'Ugyldig rating. Bruk 1 til 5 stjerner.' });
    return;
  }

  const submission = db.submissions.find((item) => item.id === submissionId);

  if (!submission) {
    sendJson(response, 404, { error: 'Fant ikke innsendingen.' });
    return;
  }

  if (!isSubmissionVisibleInFeed(submission)) {
    sendJson(response, 400, { error: 'Innsendingen kan ikke rates.' });
    return;
  }

  const currentRatings = normalizeSubmissionRatings(submission.ratings);
  const nextRatings = {
    ...currentRatings,
    [String(user.id)]: nextRating,
  };

  const nextDb = {
    ...db,
    submissions: db.submissions.map((item) =>
      item.id === submissionId
        ? {
            ...item,
            ratings: normalizeSubmissionRatings(nextRatings),
          }
        : item,
    ),
  };

  await writeDb(nextDb);
  sendJson(response, 200, buildBootstrap(nextDb, user));
}

async function handleDeleteSubmission(request, response, submissionId) {
  const db = await readDb();
  const user = getAuthedUser(db, request);

  if (!user) {
    sendJson(response, 401, { error: 'Ikke logget inn.' });
    return;
  }

  const submission = db.submissions.find((item) => item.id === submissionId);

  if (!submission) {
    sendJson(response, 404, { error: 'Fant ikke innsendingen.' });
    return;
  }

  const isAdmin = assertAdmin(user);
  const isOwner = submission.leaderId === user.id;

  if (!isAdmin && !isOwner) {
    sendJson(response, 403, {
      error: 'Du kan bare fjerne dine egne feed-poster.',
    });
    return;
  }

  const alreadyRemovedFromFeed =
    normalizeSubmissionMode(
      submission.submissionMode,
      deriveSubmissionMode(submission),
    ) === 'review' && submission.isAnonymousFeed !== true;

  if (alreadyRemovedFromFeed) {
    sendJson(response, 200, buildBootstrap(db, user));
    return;
  }

  const nextDb = {
    ...db,
    submissions: db.submissions.map((item) =>
      item.id === submissionId
        ? {
            ...item,
            submissionMode: 'review',
            isAnonymousFeed: false,
          }
        : item,
    ),
  };

  await writeDb(nextDb);
  sendJson(response, 200, buildBootstrap(nextDb, user));
}

async function handleSetKnotVisibility(request, response, submissionId) {
  const db = await readDb();
  const user = getAuthedUser(db, request);

  if (!user) {
    sendJson(response, 401, { error: 'Ikke logget inn.' });
    return;
  }

  const submission = db.submissions.find((item) => item.id === submissionId);

  if (!submission) {
    sendJson(response, 404, { error: 'Fant ikke innsendingen.' });
    return;
  }

  if (submission.leaderId !== user.id) {
    sendJson(response, 403, { error: 'Du kan bare endre synlighet på egne knuter.' });
    return;
  }

  const body = await readJsonBody(request);
  const hidden = Boolean(body.hidden);

  const nextDb = {
    ...db,
    submissions: db.submissions.map((item) =>
      item.id === submissionId ? { ...item, profileHidden: hidden } : item,
    ),
  };

  await writeDb(nextDb);
  sendJson(response, 200, buildBootstrap(nextDb, user));
}

async function handleReportSubmission(request, response, submissionId) {
  const db = await readDb();
  const user = getAuthedUser(db, request);

  if (!user) {
    sendJson(response, 401, { error: 'Ikke logget inn.' });
    return;
  }

  const submission = db.submissions.find((item) => item.id === submissionId);

  if (!submission) {
    sendJson(response, 404, { error: 'Fant ikke innsendingen.' });
    return;
  }

  if (!isSubmissionVisibleInFeed(submission)) {
    sendJson(response, 400, { error: 'Du kan bare rapportere synlige feed-poster.' });
    return;
  }

  const alreadyReported = (db.reports ?? []).some(
    (report) => report.submissionId === submissionId && report.reporterId === user.id,
  );

  if (alreadyReported) {
    sendJson(response, 409, {
      error: 'Du har allerede rapportert denne posten.',
    });
    return;
  }

  const body = await readJsonBody(request);
  const nextReport = {
    id: `report-${Date.now()}-${randomUUID().slice(0, 8)}`,
    submissionId,
    reporterId: user.id,
    reason: normalizeReportReason(body?.reason),
    note: typeof body?.note === 'string' ? body.note.trim().slice(0, 300) : '',
    status: REPORT_STATUS.OPEN,
    createdAt: nowIso(),
    reviewedAt: null,
    reviewedBy: null,
    resolution: null,
  };

  const nextDb = {
    ...db,
    reports: [nextReport, ...(db.reports ?? [])],
  };

  await writeDb(nextDb);
  sendJson(response, 200, buildBootstrap(nextDb, user));
}

async function handleAdminReports(request, response) {
  const db = await readDb();
  const user = getAuthedUser(db, request);

  if (!assertAdmin(user)) {
    sendJson(response, 403, { error: 'Kun admin kan se rapporter.' });
    return;
  }

  sendJson(response, 200, {
    reports: (db.reports ?? []).map((report) => toPublicReport(db, report)),
  });
}

async function handleAdminReportAction(request, response, reportId) {
  const db = await readDb();
  const user = getAuthedUser(db, request);

  if (!assertAdmin(user)) {
    sendJson(response, 403, { error: 'Kun admin kan behandle rapporter.' });
    return;
  }

  const report = (db.reports ?? []).find((item) => item.id === reportId);

  if (!report) {
    sendJson(response, 404, { error: 'Fant ikke rapporten.' });
    return;
  }

  if (report.status !== REPORT_STATUS.OPEN) {
    sendJson(response, 400, { error: 'Rapporten er allerede behandlet.' });
    return;
  }

  const body = await readJsonBody(request);
  const action = String(body?.action ?? '');
  const reviewedAt = nowIso();
  const submission = db.submissions.find((item) => item.id === report.submissionId);

  if (!submission) {
    sendJson(response, 404, { error: 'Fant ikke innsendingen som ble rapportert.' });
    return;
  }

  let resolution = 'kept';
  let reportStatus = REPORT_STATUS.DISMISSED;
  let submissions = db.submissions;

  if (action === 'remove-feed') {
    reportStatus = REPORT_STATUS.ACTIONED;
    resolution = 'removed_from_feed';
    submissions = db.submissions.map((item) =>
      item.id === submission.id
        ? {
            ...item,
            submissionMode: 'review',
            isAnonymousFeed: false,
          }
        : item,
    );
  } else if (action === 'reverse-approval') {
    reportStatus = REPORT_STATUS.ACTIONED;
    resolution = 'reversed_approval';
    submissions = db.submissions.map((item) =>
      item.id === submission.id
        ? {
            ...item,
            status: 'Avslått',
            submissionMode: 'review',
            isAnonymousFeed: false,
            reviewedAtRaw: reviewedAt,
            reviewedBy: user.id,
          }
        : item,
    );
  } else if (action !== 'keep') {
    sendJson(response, 400, {
      error: 'Ugyldig rapporthandling. Bruk keep, remove-feed eller reverse-approval.',
    });
    return;
  }

  const reports = (db.reports ?? []).map((item) => {
    if (item.submissionId === report.submissionId && item.status === REPORT_STATUS.OPEN) {
      return {
        ...item,
        status: reportStatus,
        reviewedAt,
        reviewedBy: user.id,
        resolution,
      };
    }

    return item;
  });

  const nextDb = {
    ...db,
    submissions,
    reports,
  };

  await writeDb(nextDb);
  sendJson(response, 200, buildBootstrap(nextDb, user));
}

async function handleCreateBan(request, response) {
  const db = await readDb();
  const user = getAuthedUser(db, request);

  if (!assertAdmin(user)) {
    sendJson(response, 403, { error: 'Kun admin kan opprette bans.' });
    return;
  }

  const body = await readJsonBody(request);
  const userId = Number(body?.userId);
  const banType = normalizeBanType(body?.type);
  const durationHours = Number(body?.durationHours);

  if (!Number.isInteger(userId) || userId <= 0) {
    sendJson(response, 400, { error: 'Velg en gyldig bruker.' });
    return;
  }

  if (banType !== body?.type) {
    sendJson(response, 400, { error: 'Velg en gyldig ban-type.' });
    return;
  }

  if (!BAN_DURATION_HOURS.has(durationHours)) {
    sendJson(response, 400, { error: 'Velg 24t, 3 dager eller 1 uke.' });
    return;
  }

  const targetUser = db.users.find((entry) => entry.id === userId);

  if (!targetUser) {
    sendJson(response, 404, { error: 'Fant ikke brukeren.' });
    return;
  }

  if (targetUser.role === 'admin') {
    sendJson(response, 400, { error: 'Admin-kontoer kan ikke bannes.' });
    return;
  }

  const startedAt = nowIso();
  const expiresAt = new Date(Date.parse(startedAt) + durationHours * 60 * 60 * 1000).toISOString();
  const currentActiveBan = (db.bans ?? []).find(
    (ban) => ban.userId === userId && ban.type === banType && isBanActive(ban),
  );

  const nextDb = {
    ...db,
    bans: currentActiveBan
      ? (db.bans ?? []).map((ban) =>
          ban.id === currentActiveBan.id
            ? {
                ...ban,
                startedAt,
                expiresAt,
                createdBy: user.id,
                active: true,
                endedAt: null,
              }
            : ban,
        )
      : [
          {
            id: `ban-${Date.now()}-${randomUUID().slice(0, 8)}`,
            userId,
            type: banType,
            startedAt,
            expiresAt,
            createdBy: user.id,
            active: true,
            endedAt: null,
          },
          ...(db.bans ?? []),
        ],
  };

  await writeDb(nextDb);
  sendJson(response, 200, buildBootstrap(nextDb, user));
}

async function handleDeleteBan(request, response, banId) {
  const db = await readDb();
  const user = getAuthedUser(db, request);

  if (!assertAdmin(user)) {
    sendJson(response, 403, { error: 'Kun admin kan oppheve bans.' });
    return;
  }

  const ban = (db.bans ?? []).find((entry) => entry.id === banId);

  if (!ban) {
    sendJson(response, 404, { error: 'Fant ikke denne bannen.' });
    return;
  }

  const endedAt = nowIso();
  const nextDb = {
    ...db,
    bans: (db.bans ?? []).map((entry) =>
      entry.id === banId
        ? {
            ...entry,
            active: false,
            endedAt,
          }
        : entry,
    ),
  };

  await writeDb(nextDb);
  sendJson(response, 200, buildBootstrap(nextDb, user));
}

async function handleUpdateKnotFeedbackMessages(request, response) {
  const db = await readDb();
  const user = getAuthedUser(db, request);

  if (!assertAdmin(user)) {
    sendJson(response, 403, { error: 'Kun admin kan oppdatere feedback-tekster.' });
    return;
  }

  const body = await readJsonBody(request);
  const nextMessages = normalizeKnotFeedbackMessages(
    body?.messages ?? body?.knotFeedbackMessages ?? {},
  );
  const hasAnyMessage = KNOT_FEEDBACK_MESSAGE_KEYS.some(
    (key) => nextMessages[key].length > 0,
  );

  if (!hasAnyMessage) {
    sendJson(response, 400, { error: 'Legg inn minst en feedback-tekst for a lagre.' });
    return;
  }

  const nextDb = {
    ...db,
    knotFeedbackMessages: nextMessages,
  };

  await writeDb(nextDb);
  sendJson(response, 200, buildBootstrap(nextDb, user));
}

async function handleImportKnots(request, response) {
  const db = await readDb();
  const user = getAuthedUser(db, request);

  if (!assertAdmin(user)) {
    sendJson(response, 403, { error: 'Kun admin kan legge til knuter.' });
    return;
  }

  const body = await readJsonBody(request);
  const result = buildImportedKnots(
    body.rawText ?? '',
    body.defaultPoints ?? 20,
    body.defaultFolder ?? 'Generelle',
    db.knots,
    body.description ?? '',
  );

  const nextDb = {
    ...db,
    knots: [
      ...db.knots,
      ...result.knots.map((knot) => ({
        ...knot,
        schoolId: user.schoolId,
        isActive: true,
      })),
    ],
  };

  await writeDb(nextDb);
  sendJson(response, 200, {
    result: {
      added: result.added,
      skipped: result.skipped,
    },
    app: buildBootstrap(nextDb, user),
  });
}

async function handleUpdateKnotPoints(request, response, knotId) {
  const db = await readDb();
  const user = getAuthedUser(db, request);

  if (!assertAdmin(user)) {
    sendJson(response, 403, { error: 'Kun admin kan endre poeng.' });
    return;
  }

  const body = await readJsonBody(request);
  const points = Math.max(0, Number(body.points) || 0);
  const affectedUserIds = [...new Set(
    db.submissions
      .filter((submission) => submission.knotId === knotId)
      .map((submission) => submission.leaderId),
  )];

  const nextDb = {
    ...db,
    knots: db.knots.map((knot) =>
      knot.id === knotId ? { ...knot, points } : knot,
    ),
    submissions: db.submissions.map((submission) =>
      submission.knotId === knotId
        ? {
            ...submission,
            points,
            basePoints: points,
          }
        : submission,
    ),
  };

  const recalculated = applyStreakRecalculation(nextDb, affectedUserIds);
  const finalDb = recalculated.db;

  await writeDb(finalDb);
  sendJson(response, 200, buildBootstrap(finalDb, user));
}

async function handleDeleteKnot(request, response, knotId) {
  const db = await readDb();
  const user = getAuthedUser(db, request);

  if (!assertAdmin(user)) {
    sendJson(response, 403, { error: 'Kun admin kan slette knuter.' });
    return;
  }

  const removedSubmissions = db.submissions.filter((submission) => submission.knotId === knotId);
  const removedDuels = db.duels.filter((duel) => duel.knotId === knotId);
  const affectedUserIds = [...new Set(
    removedSubmissions.map((submission) => submission.leaderId),
  )];

  await Promise.all(removedSubmissions.map((submission) => cleanupSubmissionAssets(submission)));
  await Promise.all(removedDuels.map((duel) => cleanupDuelAssets(duel)));

  const nextDb = {
    ...db,
    knots: db.knots.filter((knot) => knot.id !== knotId),
    submissions: db.submissions.filter((submission) => submission.knotId !== knotId),
    duels: db.duels.filter((duel) => duel.knotId !== knotId),
  };

  const recalculated = applyStreakRecalculation(nextDb, affectedUserIds);
  const finalDb = recalculated.db;

  await writeDb(finalDb);
  sendJson(response, 200, buildBootstrap(finalDb, user));
}

async function handleStartDuel(request, response) {
  const db = await readDb();
  const user = getAuthedUser(db, request);

  if (!user) {
    sendJson(response, 401, { error: 'Ikke logget inn.' });
    return;
  }

  const body = await readJsonBody(request);
  const opponentId = Number(body.opponentId);

  if (!Number.isInteger(opponentId)) {
    sendJson(response, 400, { error: 'Ugyldig motstander.' });
    return;
  }

  const currentLeaders = buildDisplayLeaders(db, user.id);
  const duelAvailability = buildDuelAvailability(user.id, currentLeaders, db.duels);
  const availability = duelAvailability.byLeaderId[opponentId];
  const duelKnot = pickDuelKnotForPair(db, user.id, opponentId);

  if (!availability?.canChallenge) {
    sendJson(response, 400, { error: availability?.reason ?? 'Knute-off er ikke tilgjengelig.' });
    return;
  }

  if (!duelKnot) {
    sendJson(response, 400, { error: 'Fant ingen ledig knute til knute-off.' });
    return;
  }

  const createdAt = nowIso();
  const deadlineAt = new Date(
    Date.now() + DUEL_WINDOW_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const nextDb = {
    ...db,
    duels: [
      {
        id: `duel-${Date.now()}`,
        challengerId: user.id,
        opponentId,
        knotId: duelKnot.id,
        knotTitle: duelKnot.title,
        stake: DUEL_STAKE,
        createdAt,
        deadlineAt,
        challengerCompletedAt: null,
        opponentCompletedAt: null,
        challengerCompletionApproved: null,
        opponentCompletionApproved: null,
        challengerSubmissionId: null,
        opponentSubmissionId: null,
        status: 'active',
        result: null,
        resolvedAt: null,
        challengerNote: '',
        challengerImageName: '',
        challengerImagePreviewUrl: '',
        challengerVideoName: '',
        challengerVideoPreviewUrl: '',
        opponentNote: '',
        opponentImageName: '',
        opponentImagePreviewUrl: '',
        opponentVideoName: '',
        opponentVideoPreviewUrl: '',
      },
      ...db.duels,
    ],
  };

  await writeDb(nextDb);
  sendJson(response, 200, buildBootstrap(nextDb, user));
}

async function handleCompleteDuel(request, response, duelId) {
  const db = await readDb();
  const user = getAuthedUser(db, request);

  if (!user) {
    sendJson(response, 401, { error: 'Ikke logget inn.' });
    return;
  }

  const activeSubmissionBan = getActiveBanByType(
    db,
    user.id,
    BAN_TYPES.SUBMISSION,
  );

  if (activeSubmissionBan) {
    sendJson(response, 403, {
      error: getBanBlockMessage(BAN_TYPES.SUBMISSION, activeSubmissionBan),
    });
    return;
  }

  const body = await readJsonBody(request);
  const duel = db.duels.find((item) => item.id === duelId);

  if (!duel || duel.status !== 'active') {
    sendJson(response, 404, { error: 'Fant ikke aktiv knute-off.' });
    return;
  }

  if (user.id !== duel.challengerId && user.id !== duel.opponentId) {
    sendJson(response, 403, { error: 'Du er ikke med i denne knute-offen.' });
    return;
  }

  const isChallenger = user.id === duel.challengerId;
  const now = Date.now();
  const deadlineTime = new Date(duel.deadlineAt).getTime();

  if (Number.isFinite(deadlineTime) && now > deadlineTime) {
    sendJson(response, 400, {
      error: 'Fristen er passert. Du kan ikke sende inn knute-off etter deadline.',
    });
    return;
  }

  if ((isChallenger && duel.challengerCompletedAt) || (!isChallenger && duel.opponentCompletedAt)) {
    sendJson(response, 400, { error: 'Fullføring er allerede registrert.' });
    return;
  }

  const imagePreviewUrl = await saveUploadedAsset(
    body.imageDataUrl,
    body.imageName,
    'duel-image',
  );
  const videoPreviewUrl = await saveUploadedAsset(
    body.videoDataUrl,
    body.videoName,
    'duel-video',
  );
  const knot = db.knots.find((item) => item.id === duel.knotId && item.isActive !== false);

  if (!knot) {
    sendJson(response, 404, { error: 'Fant ikke knuten for denne knute-offen.' });
    return;
  }

  const note = limitNoteWords(body.note);
  const requestedSubmissionMode = normalizeSubmissionMode(
    body.submissionMode,
    body.isAnonymousFeed === true ? 'anonymous-feed' : body.postToFeed === false ? 'review' : 'feed',
  );
  const activeFeedBan = getActiveBanByType(db, user.id, BAN_TYPES.FEED);
  const submissionMode =
    activeFeedBan &&
    (requestedSubmissionMode === 'feed' || requestedSubmissionMode === 'anonymous-feed')
      ? 'review'
      : requestedSubmissionMode;
  const isAnonymousFeed = submissionMode === 'anonymous-feed';
  const completedAt = nowIso();
  const duelSubmissionId = `submission-duel-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const staleSubmissions = db.submissions.filter(
    (submission) =>
      !(
        submission.knotId === knot.id &&
        submission.leaderId === user.id &&
        submission.status !== 'Godkjent'
      ),
  );
  const removedSubmissions = db.submissions.filter(
    (submission) =>
      submission.knotId === knot.id &&
      submission.leaderId === user.id &&
      submission.status !== 'Godkjent',
  );

  await Promise.all(removedSubmissions.map((submission) => cleanupSubmissionAssets(submission)));

  const duelSubmission = {
    id: duelSubmissionId,
    knotId: knot.id,
    knotTitle: knot.title,
    knotCategory: knot.category ?? 'Ukjent',
    student: user.name,
    leaderId: user.id,
    submittedAtRaw: completedAt,
    status: 'Godkjent',
    points: knot.points,
    basePoints: knot.points,
    streakBonusPoints: 0,
    streakQualified: false,
    streakDay: null,
    streakDayKey: null,
    note,
    imageName: body.imageName ?? '',
    imagePreviewUrl,
    videoName: body.videoName ?? '',
    videoPreviewUrl,
    isAnonymousFeed,
    submissionMode,
    ratings: {},
    reviewedAtRaw: completedAt,
    reviewedBy: null,
    profileHidden: false,
  };

  const nextDb = {
    ...db,
    submissions: [duelSubmission, ...staleSubmissions],
    duels: db.duels.map((item) => {
      if (item.id !== duelId) {
        return item;
      }

      if (isChallenger) {
        return {
          ...item,
          challengerCompletedAt: completedAt,
          challengerCompletionApproved: true,
          challengerSubmissionId: duelSubmissionId,
          challengerNote: note,
          challengerImageName: body.imageName ?? '',
          challengerImagePreviewUrl: imagePreviewUrl,
          challengerVideoName: body.videoName ?? '',
          challengerVideoPreviewUrl: videoPreviewUrl,
        };
      }

      return {
        ...item,
        opponentCompletedAt: completedAt,
        opponentCompletionApproved: true,
        opponentSubmissionId: duelSubmissionId,
        opponentNote: note,
        opponentImageName: body.imageName ?? '',
        opponentImagePreviewUrl: imagePreviewUrl,
        opponentVideoName: body.videoName ?? '',
        opponentVideoPreviewUrl: videoPreviewUrl,
      };
    }),
  };

  const recalculated = applyStreakRecalculation(nextDb, [user.id]);
  const finalDb = recalculated.db;

  await writeDb(finalDb);
  sendJson(response, 200, buildBootstrap(finalDb, user));
}

async function handleReviewDuelCompletion(request, response, duelId) {
  const db = await readDb();
  const user = getAuthedUser(db, request);

  if (!assertAdmin(user)) {
    sendJson(response, 403, { error: 'Kun admin kan reversere knute-off fullforinger.' });
    return;
  }

  const body = await readJsonBody(request);
  const participantId = Number(body?.participantId);
  const approved = body?.approved;
  const duel = db.duels.find((item) => item.id === duelId);

  if (!duel || duel.status !== 'active') {
    sendJson(response, 404, { error: 'Fant ikke aktiv knute-off.' });
    return;
  }

  if (!Number.isInteger(participantId)) {
    sendJson(response, 400, { error: 'Ugyldig deltaker for admin-vurdering.' });
    return;
  }

  if (typeof approved !== 'boolean') {
    sendJson(response, 400, { error: 'Send approved som true eller false.' });
    return;
  }

  const isChallenger = participantId === duel.challengerId;
  const isOpponent = participantId === duel.opponentId;

  if (!isChallenger && !isOpponent) {
    sendJson(response, 400, { error: 'Deltakeren finnes ikke i denne knute-offen.' });
    return;
  }

  if (isChallenger && !duel.challengerCompletedAt) {
    sendJson(response, 400, { error: 'Utfordrer har ikke sendt inn fullforing enda.' });
    return;
  }

  if (isOpponent && !duel.opponentCompletedAt) {
    sendJson(response, 400, { error: 'Motstander har ikke sendt inn fullforing enda.' });
    return;
  }

  const submissionId = isChallenger
    ? duel.challengerSubmissionId
    : duel.opponentSubmissionId;
  const linkedSubmission = submissionId
    ? db.submissions.find((item) => item.id === submissionId)
    : null;

  if (submissionId && !linkedSubmission) {
    sendJson(response, 404, { error: 'Fant ikke innsendingen koblet til denne duellen.' });
    return;
  }

  const reviewedAtRaw = nowIso();

  const nextDb = {
    ...db,
    submissions: submissionId
      ? db.submissions.map((item) =>
          item.id === submissionId
            ? {
                ...item,
                status: approved ? 'Godkjent' : 'Avslått',
                reviewedAtRaw,
                reviewedBy: user.id,
              }
            : item,
        )
      : db.submissions,
    duels: db.duels.map((item) => {
      if (item.id !== duelId) {
        return item;
      }

      if (isChallenger) {
        return {
          ...item,
          challengerCompletionApproved: approved,
        };
      }

      return {
        ...item,
        opponentCompletionApproved: approved,
      };
    }),
  };

  const recalculated = applyStreakRecalculation(nextDb, [participantId]);
  const finalDb = recalculated.db;

  await writeDb(finalDb);
  sendJson(response, 200, buildBootstrap(finalDb, user));
}

async function handleResolveDuel(request, response, duelId) {
  const db = await readDb();
  const user = getAuthedUser(db, request);

  if (!assertAdmin(user)) {
    sendJson(response, 403, { error: 'Kun admin kan avgjøre knute-offs.' });
    return;
  }

  const duel = db.duels.find((item) => item.id === duelId);

  if (!duel || duel.status !== 'active') {
    sendJson(response, 404, { error: 'Fant ikke aktiv knute-off.' });
    return;
  }

  const challengerCompletedAndApproved =
    Boolean(duel.challengerCompletedAt) &&
    duel.challengerCompletionApproved !== false;
  const opponentCompletedAndApproved =
    Boolean(duel.opponentCompletedAt) &&
    duel.opponentCompletionApproved !== false;
  let result = 'no-completion';

  if (challengerCompletedAndApproved && opponentCompletedAndApproved) {
    result = 'split';
  } else if (challengerCompletedAndApproved) {
    result = 'challenger-wins';
  } else if (opponentCompletedAndApproved) {
    result = 'opponent-wins';
  }

  const nextDb = {
    ...db,
    duels: db.duels.map((item) =>
      item.id === duelId
        ? {
            ...item,
            status: 'resolved',
            result,
            resolvedAt: nowIso(),
          }
        : item,
    ),
  };

  await writeDb(nextDb);
  sendJson(response, 200, buildBootstrap(nextDb, user));
}

function getContentType(filePath) {
  if (filePath.endsWith('.png')) {
    return 'image/png';
  }

  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
    return 'image/jpeg';
  }

  if (filePath.endsWith('.webp')) {
    return 'image/webp';
  }

  if (filePath.endsWith('.mp4')) {
    return 'video/mp4';
  }

  if (filePath.endsWith('.mov')) {
    return 'video/quicktime';
  }

  if (filePath.endsWith('.m4v')) {
    return 'video/x-m4v';
  }

  if (filePath.endsWith('.webm')) {
    return 'video/webm';
  }

  return 'application/octet-stream';
}

const server = createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 400, { error: 'Ugyldig request.' });
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  try {
    if (request.method === 'GET' && url.pathname === '/api/health') {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/public/pilot-users') {
      await handlePilotUsers(request, response);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/login') {
      await handleLogin(request, response);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
      const bearer = (request.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim();
      if (bearer) deleteAuthSession(bearer);
      await handleLogout(request, response);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/password-login') {
      await handlePasswordLogin(request, response);
      return;
    }
    if (request.method === 'PATCH' && url.pathname === '/api/auth/password') {
      await handleChangeOwnPassword(request, response);
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/auth/invite/verify') {
      await handleInviteVerify(request, response);
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/auth/invite/activate') {
      await handleInviteActivate(request, response);
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/admin/users') {
      await handleAdminListUsers(request, response);
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/users') {
      await handleAdminCreateUser(request, response);
      return;
    }
    {
      let m;
      if ((m = url.pathname.match(/^\/api\/admin\/users\/(\d+)\/regenerate-invite$/)) && request.method === 'POST') {
        await handleAdminRegenerateInvite(request, response, m[1]);
        return;
      }
      if ((m = url.pathname.match(/^\/api\/admin\/users\/(\d+)\/password$/)) && request.method === 'POST') {
        await handleAdminResetPassword(request, response, m[1]);
        return;
      }
      if ((m = url.pathname.match(/^\/api\/admin\/users\/(\d+)\/active$/)) && request.method === 'PATCH') {
        await handleAdminSetActive(request, response, m[1]);
        return;
      }
      if ((m = url.pathname.match(/^\/api\/admin\/users\/(\d+)\/russ-name$/)) && request.method === 'PATCH') {
        await handleAdminSetRussName(request, response, m[1]);
        return;
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/bootstrap') {
      await handleBootstrap(request, response);
      return;
    }

    if (request.method === 'PATCH' && url.pathname === '/api/profile') {
      await handleProfileUpdate(request, response);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/submissions') {
      await handleCreateSubmission(request, response);
      return;
    }

    if (
      request.method === 'POST' &&
      /^\/api\/submissions\/[^/]+\/report$/.test(url.pathname)
    ) {
      const submissionId = url.pathname.split('/')[3];
      await handleReportSubmission(request, response, submissionId);
      return;
    }

    if (
      request.method === 'PATCH' &&
      /^\/api\/submissions\/[^/]+\/review$/.test(url.pathname)
    ) {
      const submissionId = url.pathname.split('/')[3];
      await handleReviewSubmission(request, response, submissionId);
      return;
    }

    if (
      request.method === 'PATCH' &&
      url.pathname.startsWith('/api/submissions/') &&
      url.pathname.endsWith('/rating')
    ) {
      const pathParts = url.pathname.split('/');

      if (pathParts.length === 5 && pathParts[3]) {
        const submissionId = pathParts[3];
        await handleRateSubmission(request, response, submissionId);
        return;
      }
    }

    if (
      request.method === 'DELETE' &&
      /^\/api\/submissions\/[^/]+$/.test(url.pathname)
    ) {
      const submissionId = url.pathname.split('/')[3];
      await handleDeleteSubmission(request, response, submissionId);
      return;
    }

    if (
      request.method === 'PATCH' &&
      url.pathname.startsWith('/api/submissions/') &&
      url.pathname.endsWith('/visibility')
    ) {
      const submissionId = url.pathname.split('/')[3];
      await handleSetKnotVisibility(request, response, submissionId);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/admin/reports') {
      await handleAdminReports(request, response);
      return;
    }

    if (
      request.method === 'PATCH' &&
      /^\/api\/admin\/reports\/[^/]+$/.test(url.pathname)
    ) {
      const reportId = url.pathname.split('/')[4];
      await handleAdminReportAction(request, response, reportId);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/admin/bans') {
      await handleCreateBan(request, response);
      return;
    }

    if (request.method === 'PATCH' && url.pathname === '/api/admin/knot-feedback-messages') {
      await handleUpdateKnotFeedbackMessages(request, response);
      return;
    }

    if (
      request.method === 'DELETE' &&
      /^\/api\/admin\/bans\/[^/]+$/.test(url.pathname)
    ) {
      const banId = url.pathname.split('/')[4];
      await handleDeleteBan(request, response, banId);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/knots/import') {
      await handleImportKnots(request, response);
      return;
    }

    if (
      request.method === 'PATCH' &&
      /^\/api\/knots\/[^/]+\/points$/.test(url.pathname)
    ) {
      const knotId = url.pathname.split('/')[3];
      await handleUpdateKnotPoints(request, response, knotId);
      return;
    }

    if (request.method === 'DELETE' && /^\/api\/knots\/[^/]+$/.test(url.pathname)) {
      const knotId = url.pathname.split('/')[3];
      await handleDeleteKnot(request, response, knotId);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/duels') {
      await handleStartDuel(request, response);
      return;
    }

    if (
      request.method === 'PATCH' &&
      /^\/api\/duels\/[^/]+\/complete$/.test(url.pathname)
    ) {
      const duelId = url.pathname.split('/')[3];
      await handleCompleteDuel(request, response, duelId);
      return;
    }

    if (
      request.method === 'PATCH' &&
      /^\/api\/duels\/[^/]+\/review$/.test(url.pathname)
    ) {
      const duelId = url.pathname.split('/')[3];
      await handleReviewDuelCompletion(request, response, duelId);
      return;
    }

    if (
      request.method === 'PATCH' &&
      /^\/api\/duels\/[^/]+\/resolve$/.test(url.pathname)
    ) {
      const duelId = url.pathname.split('/')[3];
      await handleResolveDuel(request, response, duelId);
      return;
    }

    if (request.method === 'GET' && url.pathname.startsWith('/uploads/')) {
      const fileName = url.pathname.replace('/uploads/', '');
      const filePath = path.join(UPLOADS_DIR, fileName);

      if (!(await fileExists(filePath))) {
        sendJson(response, 404, { error: 'Fant ikke filen.' });
        return;
      }

        await sendFile(request, response, 200, filePath, getContentType(filePath), {
          cacheControl: 'public, max-age=31536000, immutable',
        });
        return;
      }

    sendJson(response, 404, { error: 'Fant ikke endpoint.' });
  } catch (error) {
    const statusCode = error?.statusCode ?? 500;
    sendJson(response, statusCode, {
      error: statusCode === 413 ? (error?.message ?? 'For stor forespørsel.') : 'Serverfeil.',
      detail: error instanceof Error ? error.message : 'Ukjent feil',
    });
  }
});

await ensureStorage();
openAuthDb();

async function ensureJsonUserForAuth(authUser) {
  if (!authUser?.email) return;
  const db = await readDb();
  const emailLower = authUser.email.toLowerCase();
  const existing = db.users.find(
    (u) => u.email && u.email.toLowerCase() === emailLower,
  );
  const desiredRussName = (authUser.russ_name ?? '').trim();
  if (existing) {
    let dirty = false;
    if (existing.role !== authUser.role) {
      existing.role = authUser.role;
      dirty = true;
    }
    if (desiredRussName && existing.profile?.russName !== desiredRussName) {
      existing.profile = { ...existing.profile, russName: desiredRussName };
      dirty = true;
    }
    if (dirty) await writeDb(db);
    return;
  }
  const nextId = db.users.reduce((max, u) => Math.max(max, u.id ?? 0), 0) + 1;
  const displayName = authUser.name || authUser.email;
  const russName = desiredRussName || displayName;
  db.users.push({
    id: nextId,
    schoolId: db.schools?.[0]?.id ?? 'st-olav',
    name: displayName,
    group: authUser.class || '-',
    role: authUser.role ?? 'user',
    loginCode: '',
    email: authUser.email,
    basePoints: 0,
    baseCompletedKnots: 0,
    profile: {
      icon: '',
      photoUrl: '',
      russName,
      realName: displayName,
      className: authUser.class || '-',
      bio: '',
      quote: '',
      knownFor: '',
      signatureKnot: '',
      favoriteCategory: '',
      russType: 'blue',
      genderIdentity: 'other',
    },
  });
  await writeDb(db);
}

setAuthBridge({ ensureJsonUser: ensureJsonUserForAuth });

async function seedFirstAdminIfEmpty() {
  const existing = listUsers();
  if (existing.length > 0) return;
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'ingve@kampsporthuset.no';
  const name = process.env.BOOTSTRAP_ADMIN_NAME ?? 'Admin';
  const className = process.env.BOOTSTRAP_ADMIN_CLASS ?? '-';
  const code = generateInviteCode();
  const hash = await hashSecret(code);
  insertUser({ email, name, className, role: 'admin', inviteCodeHash: hash });
  console.log('------------------------------------------------------------');
  console.log('Ingen brukere i auth.sqlite — opprettet admin:');
  console.log(`  E-post:    ${email}`);
  console.log(`  Kode:      ${code}`);
  console.log('  Aktivér:   http://localhost:5173/invite');
  console.log('------------------------------------------------------------');
}

await seedFirstAdminIfEmpty();

server.listen(PORT, () => {
  console.log(`Russeknute backend klar på http://localhost:${PORT}`);
  console.log(
    `Knute-off regler: +/-${DUEL_RANGE} plasser, ${DUEL_STAKE}p innsats, ${DUEL_WINDOW_HOURS}t frist, ${
      DUEL_LIMITS_DISABLED ? 'ingen daglig grense (testmodus)' : `${DUEL_DAILY_LIMIT} per dag`
    }.`,
  );
  console.log(
    `Moderering MVP: noLimits=${MODERATION_POLICY.noLimits}, manualFeedModerationFirst=${MODERATION_POLICY.manualFeedModerationFirst}.`,
  );
});
