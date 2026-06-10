import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { resolveKnotFolder } from '../data/knotFolders.js';

const SLIDE_MS = 7000;

const FOLDER_LABELS = {
  Generelle: 'Generelle',
  Dobbelknuter: 'Dobbel',
  Alkoholknuter: 'Alkohol',
  Sexknuter: 'Sex',
  'Fordervett-knuter': 'Rampestrek',
};

const PERSONAS = {
  Alkoholknuter: {
    emoji: '🍻',
    name: 'Festgeneralen',
    text: 'Der det skjedde noe, var du. Tilfeldig? Aldri. Du har minst én historie fra i vår som starter med «ok, men du kan IKKE si det videre». Loopen vet uansett.',
  },
  Sexknuter: {
    emoji: '😏',
    name: 'Sjarmøren',
    text: 'Vi sier ikke mer enn tallene gjør — men tallene skriker, kompis. Og den personen du tenker på akkurat nå? De vet det godt.',
  },
  'Fordervett-knuter': {
    emoji: '🦊',
    name: 'Kaosreven',
    text: 'Statistisk sett burde du vært utvist. Sosialt sett er du legenden folk kommer til å lyve om at de kjente. Faens imponerende.',
  },
  Dobbelknuter: {
    emoji: '🤝',
    name: 'Lagspilleren',
    text: 'Aldri alene om noe, medskyldig i alt. Du vet nøyaktig hvem partner-in-crime er — og de tenker på deg når de leser sin.',
  },
  Generelle: {
    emoji: '🧩',
    name: 'Allrounderen',
    text: 'Litt av alt, og alltid bittelitt bedre enn folk forventet. Irriterende som faen. Ikke slutt.',
  },
  none: {
    emoji: '👻',
    name: 'Mysteriet',
    text: 'Du var her. Det vet vi. Resten nekter loopen å snakke om — og noe sier oss at det er best for alle sånn.',
  },
};

// Tekstvarianter velges deterministisk fra bruker-ID: Per og Pål med
// identiske tall får ulike formuleringer, men hver bruker ser alltid
// den samme versjonen sin.
function pickVariant(seed, salt, variants) {
  return variants[(seed + salt) % variants.length];
}

// Egen spydighet per vinnerkategori på kategori-sliden — 2 varianter per.
const CATEGORY_WIN_QUIPS = {
  Alkoholknuter: [
    'Alkohol vant. Sjokk. Leveren din har levert oppsigelse. 🍺',
    'Alkohol vant. Ingen i loopen er overrasket. Ingen. 🍺',
  ],
  Sexknuter: [
    'Sex-knuter på topp. Vi sier det ikke til mora di. 😏',
    'Sex-knuter vant. Vi har sett tallene. Vi trenger en prat. 😏',
  ],
  'Fordervett-knuter': [
    'Rampestrek vant, din lille kriminelle. 🙈',
    'Rampestrek vant. Rektor hadde grått. 🙈',
  ],
  Dobbelknuter: [
    'Dobbel vant. Klarer du i det hele tatt noe alene? 🤝',
    'Dobbel vant. Separasjonsangst, men du har gjort det til en greie. 🤝',
  ],
  Generelle: [
    'Generelle vant. Modig som faen. 🧷',
    'Generelle vant. Vanilje — men du eier det. 🧷',
  ],
};

const CATEGORY_SUB_VARIANTS = [
  'Og du vet nøyaktig hvilken kveld som dro opp statistikken.',
  'Statistikk lyver ikke. Du vet hva du gjorde.',
];

const RANK_FIRST_VARIANTS = [
  'Førsteplass. Wow. Helt fantastisk. Kan vi få autograf, sjef? Skal vi ringe NRK? 🙇',
  'Førsteplass. Gratulerer, eller noe. De andre hater deg litt nå — bare så du vet det.',
];

const RANK_TOP_VARIANTS = [
  (pct) =>
    `Topp ${pct} %. Imponerende — og du har sjekket topplisten oftere enn du innrømmer, det vet vi begge.`,
  (pct) => `Topp ${pct} %. Flexer du nå? Det kjennes sånn ut. Vi lar deg holde på.`,
];

const RANK_BOTTOM_VARIANTS = [
  'Du var «opptatt med andre ting», sant? Vi tror deg. Nesten.',
  'Noen må være fundamentet i pyramiden. Takk for tjenesten. 🫡',
];

const BEST_DAY_VARIANTS = [
  ' Du husker ikke halvparten av den dagen, og det vet du godt.',
  ' Den dagen kommer til å bli gjenfortalt feil i mange år. Av deg.',
];

const STREAK_VARIANTS = [
  'Minst én knute hver eneste dag. Noen har hobbyer — du har et problem. Vi heier på problemet. 🔥',
  'Hver dag. HVER dag. Disiplinen din er skummel — tenk om du brukte den på skolen. 🔥',
];

const IMAGES_SUB_VARIANTS = [
  'minst ett av disse angrer du på. Du vet selv hvilket.',
  'du kommer til å vise dem til barna dine en dag. Kanskje ikke alle.',
];

const CONFETTI_COLORS = ['#ffdc68', '#ff7eb6', '#6fe3c1', '#fffaf0', '#2c54a8'];

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true
  );
}

function toLocalDayKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDayLabel(date) {
  try {
    return new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'long' }).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

function formatTimeLabel(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `kl. ${hours}:${minutes}`;
}

function longestConsecutiveRun(dayKeys) {
  const sorted = [...new Set(dayKeys)].sort();
  let longest = sorted.length > 0 ? 1 : 0;
  let run = longest;

  for (let i = 1; i < sorted.length; i += 1) {
    const previous = new Date(`${sorted[i - 1]}T12:00:00`);
    const current = new Date(`${sorted[i]}T12:00:00`);
    const dayDiff = Math.round((current - previous) / 86400000);

    run = dayDiff === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  return longest;
}

function buildWrappedStats({
  currentUserId,
  submissions,
  knots,
  activityLog,
  leaderboard,
}) {
  const knotById = new Map((knots ?? []).map((knot) => [knot.id, knot]));
  const mySubs = (submissions ?? []).filter(
    (submission) =>
      submission?.leaderId === currentUserId && submission?.status === 'Godkjent',
  );
  const myApprovedKnots = (knots ?? []).filter((knot) => knot.status === 'Godkjent');
  const totalCount = Math.max(mySubs.length, myApprovedKnots.length);

  // Kategorifordeling — folder hentes fra knuten innsendingen peker på.
  const categoryCounts = new Map();
  const categorySource =
    mySubs.length > 0
      ? mySubs.map((submission) => knotById.get(submission.knotId) ?? { folder: submission.knotCategory })
      : myApprovedKnots;
  for (const knot of categorySource) {
    const folder = resolveKnotFolder(knot);
    categoryCounts.set(folder, (categoryCounts.get(folder) ?? 0) + 1);
  }
  const categories = [...categoryCounts.entries()]
    .map(([folder, count]) => ({
      folder,
      label: FOLDER_LABELS[folder] ?? folder,
      count,
    }))
    .sort((left, right) => right.count - left.count);
  const dominantFolder = categories[0]?.folder ?? null;

  // Tidsstempler — kun innsendinger med gyldig dato.
  const timestamps = mySubs
    .map((submission) => Date.parse(submission.submittedAtRaw ?? ''))
    .filter((value) => Number.isFinite(value))
    .map((value) => new Date(value));

  const dayBuckets = new Map();
  let nightCount = 0;
  for (const date of timestamps) {
    const key = toLocalDayKey(date);
    const bucket = dayBuckets.get(key) ?? { count: 0, latest: date };
    bucket.count += 1;
    if (date > bucket.latest) bucket.latest = date;
    dayBuckets.set(key, bucket);

    const hour = date.getHours();
    if (hour >= 22 || hour < 6) nightCount += 1;
  }

  let bestDay = null;
  for (const bucket of dayBuckets.values()) {
    if (!bestDay || bucket.count > bestDay.count) bestDay = bucket;
  }

  const nightShare = timestamps.length > 0 ? nightCount / timestamps.length : 0;
  const longestStreak = longestConsecutiveRun([...dayBuckets.keys()]);

  const leader = (leaderboard ?? []).find((entry) => entry.id === currentUserId) ?? null;
  const totalUsers = (leaderboard ?? []).length;
  const rank = Number.isFinite(leader?.rank) ? leader.rank : null;
  const topPercent =
    rank && totalUsers > 0 ? Math.max(1, Math.round((rank / totalUsers) * 100)) : null;

  // Egne bilder fra godkjente innsendinger — vises kun for brukeren selv.
  const myImages = mySubs
    .filter((submission) => submission.imagePreviewUrl)
    .sort((left, right) => {
      const leftTs = Date.parse(left.submittedAtRaw ?? '') || 0;
      const rightTs = Date.parse(right.submittedAtRaw ?? '') || 0;
      return leftTs - rightTs;
    })
    .map((submission) => ({
      url: submission.imageThumbUrl || submission.imagePreviewUrl,
      fullUrl: submission.imagePreviewUrl,
      title: submission.knotTitle ?? '',
    }));

  // Loopens favoritter — knutene flest forskjellige folk har fått godkjent.
  const byTitle = new Map();
  for (const entry of activityLog ?? []) {
    const title = (entry?.knotTitle ?? '').trim();
    if (!title) continue;
    const key = title.toLowerCase();
    const record = byTitle.get(key) ?? { title, users: new Set() };
    record.users.add(entry.studentId ?? entry.id);
    byTitle.set(key, record);
  }
  const loopTop = [...byTitle.values()]
    .map((record) => ({ title: record.title, count: record.users.size }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);

  // Loopens øyeblikk — best ratede delte bilde i feeden.
  const loopMoment = (activityLog ?? [])
    .filter(
      (entry) =>
        entry?.shareDetails &&
        entry.mediaType === 'image' &&
        entry.imagePreviewUrl &&
        Number(entry.ratingCount) > 0,
    )
    .map((entry) => ({
      imageUrl: entry.imagePreviewUrl,
      studentName: entry.studentName ?? 'Ukjent',
      knotTitle: entry.knotTitle ?? '',
      ratingAverage: Number(entry.ratingAverage) || 0,
      ratingCount: Number(entry.ratingCount) || 0,
      score: (Number(entry.ratingAverage) || 0) * Math.log10((Number(entry.ratingCount) || 0) + 1),
    }))
    .sort((left, right) => right.score - left.score)[0] ?? null;

  const persona = PERSONAS[totalCount > 0 ? dominantFolder ?? 'Generelle' : 'none'];
  const isNightOwl = nightShare >= 0.4 && timestamps.length >= 5;

  // Trådene — hierarki der kun den gjeveste vises: Gull > Sølv > Bronse.
  // Matcher på tittel så varianter som «Gulltråden» også teller.
  const myTitles = [
    ...mySubs.map((submission) => submission.knotTitle ?? ''),
    ...myApprovedKnots.map((knot) => knot.title ?? ''),
  ].map((title) => title.toLowerCase());
  const hasThread = (needle) => myTitles.some((title) => title.includes(needle));
  const threadTier = hasThread('gulltråd')
    ? 'gull'
    : hasThread('sølvtråd')
      ? 'solv'
      : hasThread('bronsetråd')
        ? 'bronse'
        : null;

  return {
    totalCount,
    points: Number(leader?.points ?? 0),
    categories,
    bestDay: bestDay
      ? {
          label: formatDayLabel(bestDay.latest),
          count: bestDay.count,
          timeLabel: formatTimeLabel(bestDay.latest),
        }
      : null,
    longestStreak,
    rank,
    totalUsers,
    topPercent,
    myImages,
    loopTop,
    loopMoment,
    persona,
    isNightOwl,
    threadTier,
    seed: Math.abs(Number(currentUserId) || 0),
  };
}

// Én slide per trådnivå — kun den gjeveste tråden vises.
const THREAD_SLIDES = {
  gull: {
    medal: '🥇',
    tone: 'gold',
    eyebrow: 'Den hellige gulltråden',
    headline: 'GULLTRÅD.',
    sub: 'Det der klarer nesten ingen. Folk kommer til å snakke om deg på gjenforeningsfesten i 2046. Respekt — ekte respekt. Ikke venn deg til at vi er hyggelige.',
  },
  solv: {
    medal: '🥈',
    tone: 'night',
    eyebrow: 'Sølvtråden',
    headline: 'Sølvtråd!',
    sub: 'Så nære gull at det nesten gjør vondt, sant? Fortsatt rått — men du kommer til å tenke på den gulltråden i dusjen i mange år. 😌',
  },
  bronse: {
    medal: '🥉',
    tone: 'navy',
    eyebrow: 'Bronsetråden',
    headline: 'Bronsetråd!',
    sub: 'Pallplass! Ikke toppen av pallen, men pallen. Det er mer enn de fleste kan si — og du har allerede nevnt det på minst tre vors.',
  },
};

function buildSlides(stats) {
  const slides = [];

  slides.push({ id: 'intro', tone: 'navy' });

  slides.push({ id: 'total', tone: 'gold' });

  if (stats.rank && stats.totalUsers > 1 && stats.totalCount > 0) {
    slides.push({ id: 'rank', tone: 'night' });
  }

  if (stats.categories.length > 0) {
    slides.push({ id: 'categories', tone: 'mint' });
  }

  if (stats.bestDay && stats.bestDay.count >= 2) {
    slides.push({ id: 'best-day', tone: 'night' });
  }

  if (stats.longestStreak >= 2) {
    slides.push({ id: 'streak', tone: 'pink' });
  }

  if (stats.myImages.length > 0) {
    slides.push({ id: 'images', tone: 'navy' });
  }

  if (stats.loopTop.length >= 3) {
    slides.push({ id: 'loop-top', tone: 'mint' });
  }

  if (stats.loopMoment) {
    slides.push({ id: 'loop-moment', tone: 'pink' });
  }

  if (stats.threadTier) {
    slides.push({ id: 'thread', tone: THREAD_SLIDES[stats.threadTier].tone });
  }

  slides.push({ id: 'persona', tone: 'gold' });

  return slides;
}

function totalSlideCopy(stats) {
  const { totalCount, seed } = stats;
  if (totalCount === 0) {
    return {
      headline: 'Null knuter.',
      sub: pickVariant(seed, 1, [
        'Null, faen. Appen funker — vi har sjekket tre ganger. Du åpnet den bare for å «se litt», sant? Klassisk deg.',
        'Ikke én. Vi hadde en hel animasjon klar og alt. Skuffende — men på en imponerende måte.',
      ]),
    };
  }
  if (totalCount <= 2) {
    return {
      headline: totalCount === 1 ? '1 knute!' : '2 knuter!',
      sub: pickVariant(seed, 2, [
        'Kvalitet over kvantitet, sant? Si det høyt nok mange ganger, så blir det kanskje sant, kompis.',
        'Du smakte på det. Som å gå på treningssenter én gang i januar. Vi ser deg.',
      ]),
    };
  }
  if (totalCount >= 25) {
    return {
      headline: `${totalCount} knuter?!`,
      sub: pickVariant(seed, 3, [
        'Hvem faen har oppdratt deg? Imponerende og bekymringsverdig i nøyaktig lik mengde.',
        'Vi måtte dobbeltsjekke at det ikke var en bug. Det var ikke en bug. Du er buggen.',
      ]),
    };
  }
  if (totalCount >= 10) {
    return {
      headline: `${totalCount} knuter!`,
      sub: pickVariant(seed, 4, [
        'Solid, gærning. Du sa «bare én til» minst seks ganger i vår. Vi vet det. Du vet det.',
        'Imponerende innsats fra en som «egentlig ikke brydde seg så mye om knuter». Jaja.',
      ]),
    };
  }
  return {
    headline: `${totalCount} knuter!`,
    sub: pickVariant(seed, 5, [
      'Helt midt på treet. Som en 4-er i gym. Og vi SÅ deg scrolle i knutelista kl. 23 uten å sende inn noe, klovn.',
      'Solid mellomklasse. Ikke flaut, ikke imponerende — bare veldig, veldig deg.',
    ]),
  };
}

function CountUp({ value, duration = 1400 }) {
  // Reduced motion: start rett på sluttverdien, ingen animasjon.
  const [current, setCurrent] = useState(() => (prefersReducedMotion() ? value : 0));

  useEffect(() => {
    if (prefersReducedMotion()) {
      return undefined;
    }

    let rafId;
    const startTime = performance.now();

    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      setCurrent(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [value, duration]);

  return <>{current}</>;
}

// Deterministisk pseudo-tilfeldighet — ser tilfeldig ut, men er stabil
// mellom rendringer (react-hooks/purity tillater ikke Math.random i render).
function pseudoRandom(index, salt) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function ConfettiRain() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 56 }, (_, index) => ({
        left: pseudoRandom(index, 1) * 100,
        delay: pseudoRandom(index, 2) * 0.8,
        duration: 2.2 + pseudoRandom(index, 3) * 2.4,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      })),
    [],
  );

  if (prefersReducedMotion()) return null;

  return (
    <div className="ws-confetti" aria-hidden="true">
      {pieces.map((piece, index) => (
        <span
          key={index}
          style={{
            left: `${piece.left}%`,
            background: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

export function WrappedStory({
  onClose,
  currentUserId,
  displayName,
  submissions,
  knots,
  activityLog,
  leaderboard,
}) {
  // Statistikken fryses ved åpning så slides ikke hopper hvis appdata
  // poll-oppdateres midt i visningen.
  const stats = useMemo(
    () =>
      buildWrappedStats({
        currentUserId,
        submissions,
        knots,
        activityLog,
        leaderboard,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const slides = useMemo(() => buildSlides(stats), [stats]);

  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const indexRef = useRef(0);
  indexRef.current = index;
  const remainingMsRef = useRef(SLIDE_MS);
  const holdStartRef = useRef(0);
  const isLast = index === slides.length - 1;

  function goTo(nextIndex) {
    setIndex(Math.max(0, Math.min(nextIndex, slides.length - 1)));
  }

  // Lås bakgrunnsscroll mens storyen er åpen.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Ny slide = full tid på klokka igjen.
  useEffect(() => {
    remainingMsRef.current = SLIDE_MS;
  }, [index]);

  // Automatisk fremdrift — stopper på siste slide, og fryser når brukeren
  // holder fingeren på skjermen (resttiden huskes mellom pauser).
  useEffect(() => {
    if (isLast || isPaused || prefersReducedMotion()) return undefined;
    const startedAt = Date.now();
    const timer = window.setTimeout(() => {
      goTo(indexRef.current + 1);
    }, remainingMsRef.current);
    return () => {
      window.clearTimeout(timer);
      remainingMsRef.current = Math.max(
        0,
        remainingMsRef.current - (Date.now() - startedAt),
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, isPaused, isLast, slides.length]);

  // Hold-for-pause: pek ned fryser, slipp gjenopptar. Et kort trykk
  // (<250 ms) teller som blading i stedet.
  function handleHoldStart() {
    holdStartRef.current = Date.now();
    setIsPaused(true);
  }

  function handleHoldEnd(navigateDelta) {
    setIsPaused(false);
    const heldMs = Date.now() - holdStartRef.current;
    if (heldMs < 250 && navigateDelta !== 0) {
      goTo(indexRef.current + navigateDelta);
    }
  }

  function handleHoldCancel() {
    setIsPaused(false);
  }

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight' || event.key === ' ') goTo(indexRef.current + 1);
      if (event.key === 'ArrowLeft') goTo(indexRef.current - 1);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length, onClose]);

  const slide = slides[index];

  function renderSlide() {
    switch (slide.id) {
      case 'intro':
        return (
          <>
            <div className="ws-rope" aria-hidden="true">🪢</div>
            <p className="ws-eyebrow">Russetiden 2026</p>
            <h2 className="ws-headline">
              Ok{displayName ? ` ${displayName}` : ''}. Vi må snakke.
            </h2>
            <p className="ws-sub">
              Vi har gått gjennom loopen din. Alt sammen. Du vet godt hva som
              kommer nå — og nei, du kan ikke slette historikken. 👀
            </p>
          </>
        );

      case 'total': {
        const copy = totalSlideCopy(stats);
        return (
          <>
            <p className="ws-eyebrow">Godkjente knuter</p>
            <div className="ws-big">
              <CountUp value={stats.totalCount} />
            </div>
            <h2 className="ws-headline">{copy.headline}</h2>
            <p className="ws-sub">{copy.sub}</p>
          </>
        );
      }

      case 'rank':
        return (
          <>
            <p className="ws-eyebrow">Din plassering</p>
            <div className="ws-big">#{stats.rank}</div>
            <h2 className="ws-headline">av {stats.totalUsers} i loopen</h2>
            <p className="ws-sub">
              {stats.rank === 1
                ? pickVariant(stats.seed, 6, RANK_FIRST_VARIANTS)
                : stats.topPercent && stats.topPercent <= 50
                  ? pickVariant(stats.seed, 7, RANK_TOP_VARIANTS)(stats.topPercent)
                  : pickVariant(stats.seed, 8, RANK_BOTTOM_VARIANTS)}
            </p>
          </>
        );

      case 'categories': {
        const maxCount = stats.categories[0]?.count ?? 1;
        const winner = stats.categories[0];
        return (
          <>
            <p className="ws-eyebrow">Dine kategorier</p>
            <h2 className="ws-headline">
              {CATEGORY_WIN_QUIPS[winner.folder]
                ? pickVariant(stats.seed, 9, CATEGORY_WIN_QUIPS[winner.folder])
                : `${winner.label}-knuter vant! 🏆`}
            </h2>
            <div className="ws-bars">
              {stats.categories.slice(0, 5).map((category, position) => (
                <div className="ws-bar-row" key={category.folder}>
                  <span className="ws-bar-label">{category.label}</span>
                  <span className="ws-bar-track">
                    <span
                      className="ws-bar-fill"
                      style={{
                        width: `${Math.max(8, Math.round((category.count / maxCount) * 100))}%`,
                        animationDelay: `${0.9 + position * 0.15}s`,
                      }}
                    />
                  </span>
                  <span className="ws-bar-count">{category.count}</span>
                </div>
              ))}
            </div>
            <p className="ws-sub ws-sub--small">
              {pickVariant(stats.seed, 10, CATEGORY_SUB_VARIANTS)}
            </p>
          </>
        );
      }

      case 'best-day':
        return (
          <>
            <p className="ws-eyebrow">Din villeste dag</p>
            <div className="ws-big ws-big--date">{stats.bestDay.label}</div>
            <h2 className="ws-headline">
              {stats.bestDay.count} knuter på én dag, din gærning 🤯
            </h2>
            <p className="ws-sub">
              Siste registrering: {stats.bestDay.timeLabel}.
              {stats.isNightOwl
                ? ' Og det var ikke et unntak — du er en sertifisert nattugle. Søvn er visst for de svake 🦉'
                : pickVariant(stats.seed, 11, BEST_DAY_VARIANTS)}
            </p>
          </>
        );

      case 'streak':
        return (
          <>
            <p className="ws-eyebrow">Lengste streak</p>
            <div className="ws-big">
              <CountUp value={stats.longestStreak} />
            </div>
            <h2 className="ws-headline">
              {stats.longestStreak} dager i strekk!
            </h2>
            <p className="ws-sub">
              {pickVariant(stats.seed, 12, STREAK_VARIANTS)}
            </p>
          </>
        );

      case 'images': {
        const shown = stats.myImages.slice(0, 8);
        const remaining = stats.myImages.length - shown.length;
        return (
          <>
            <p className="ws-eyebrow">Året i bilder</p>
            <h2 className="ws-headline">Bevismaterialet 📸</h2>
            <div
              className={`ws-collage${shown.length === 1 ? ' ws-collage--single' : ''}`}
            >
              {shown.map((image, position) => (
                <img
                  key={`${image.url}-${position}`}
                  src={image.url}
                  alt={image.title}
                  loading="lazy"
                  decoding="async"
                  style={{ animationDelay: `${0.4 + position * 0.18}s` }}
                />
              ))}
            </div>
            <p className="ws-sub ws-sub--small">
              {`${remaining > 0 ? `+ ${remaining} til. ` : ''}Kun synlig for deg — og ${pickVariant(stats.seed, 13, IMAGES_SUB_VARIANTS)}`}
            </p>
          </>
        );
      }

      case 'loop-top':
        return (
          <>
            <p className="ws-eyebrow">Loopens favoritter</p>
            <h2 className="ws-headline">Knutene «alle» tok 🐑</h2>
            <div className="ws-toplist">
              {stats.loopTop.map((item, position) => (
                <div className="ws-toplist-row" key={item.title}>
                  <span className="ws-toplist-rank">{position + 1}</span>
                  <span className="ws-toplist-name">{item.title}</span>
                  <span className="ws-toplist-count">{item.count} russ</span>
                </div>
              ))}
            </div>
            <p className="ws-sub ws-sub--small">
              Sau-mentalitet, hele gjengen. Elsker det.
            </p>
          </>
        );

      case 'loop-moment':
        return (
          <>
            <p className="ws-eyebrow">Loopens øyeblikk</p>
            <h2 className="ws-headline">Årets mest likte post ⭐</h2>
            <figure className="ws-moment">
              <img
                src={stats.loopMoment.imageUrl}
                alt={stats.loopMoment.knotTitle}
                loading="lazy"
                decoding="async"
              />
              <figcaption>
                <strong>{stats.loopMoment.studentName}</strong>
                <span>{stats.loopMoment.knotTitle}</span>
                <span className="ws-moment-stars">
                  {stats.loopMoment.ratingAverage.toFixed(1)} ★ ·{' '}
                  {stats.loopMoment.ratingCount} ratinger
                </span>
              </figcaption>
            </figure>
          </>
        );

      case 'thread': {
        const thread = THREAD_SLIDES[stats.threadTier];
        return (
          <>
            <p className="ws-eyebrow">{thread.eyebrow}</p>
            <div className="ws-threads" aria-hidden="true">
              <span>{thread.medal}</span>
            </div>
            <h2 className="ws-headline">{thread.headline}</h2>
            <p className="ws-sub">{thread.sub}</p>
          </>
        );
      }

      case 'persona':
        return (
          <>
            <p className="ws-eyebrow">Din russe-persona er…</p>
            <div className="ws-card">
              <div className="ws-card-emoji" aria-hidden="true">
                {stats.persona.emoji}
              </div>
              <div className="ws-card-name">{stats.persona.name}</div>
              <p className="ws-card-text">{stats.persona.text}</p>
              {stats.isNightOwl ? (
                <p className="ws-card-badge">Sertifisert nattugle 🦉</p>
              ) : null}
              <div className="ws-card-stats">
                <div>
                  <strong>{stats.totalCount}</strong>
                  <small>knuter</small>
                </div>
                <div>
                  <strong>{stats.points}</strong>
                  <small>poeng</small>
                </div>
                {stats.rank ? (
                  <div>
                    <strong>#{stats.rank}</strong>
                    <small>i loopen</small>
                  </div>
                ) : null}
              </div>
              <div className="ws-card-brand">🪢 Knuteloop Wrapped 2026</div>
            </div>
            <p className="ws-sub ws-sub--small">
              Ta skjermbilde og del i loopen — eller gjem det for alltid,
              feiging. Vi skjønner begge deler. 💛
            </p>
          </>
        );

      default:
        return null;
    }
  }

  // Portal til document.body — garanterer ekte fullskjerm uansett hvilke
  // transforms/filtre forfedre i appen måtte ha (fixed-positioning-fella).
  return createPortal(
    <div
      className="wrapped-story"
      role="dialog"
      aria-modal="true"
      aria-label="Knuteloop Wrapped"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="ws-stage">
        <div
          className={`ws-progress${isPaused ? ' is-paused' : ''}`}
          aria-hidden="true"
        >
          {slides.map((item, position) => (
            <span
              key={`${item.id}-${position === index ? 'active' : 'idle'}`}
              className={
                position < index ? 'is-done' : position === index ? 'is-active' : ''
              }
              style={
                position === index ? { animationDuration: `${SLIDE_MS}ms` } : undefined
              }
            />
          ))}
        </div>

        <button type="button" className="ws-close" onClick={onClose} aria-label="Lukk Wrapped">
          ✕
        </button>

        <section
          key={slide.id}
          className={`ws-slide ws-slide--${slide.tone}${isPaused ? ' is-paused' : ''}`}
        >
          {renderSlide()}
        </section>

        {isLast ? <ConfettiRain /> : null}

        <button
          type="button"
          className="ws-tap ws-tap--left"
          onPointerDown={handleHoldStart}
          onPointerUp={() => handleHoldEnd(-1)}
          onPointerLeave={handleHoldCancel}
          onPointerCancel={handleHoldCancel}
          aria-label="Forrige slide"
        />
        <button
          type="button"
          className="ws-tap ws-tap--right"
          onPointerDown={handleHoldStart}
          onPointerUp={() => handleHoldEnd(1)}
          onPointerLeave={handleHoldCancel}
          onPointerCancel={handleHoldCancel}
          aria-label="Neste slide"
        />

        {index === 0 ? (
          <p className="ws-hint">Trykk for å bla · hold for pause</p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
