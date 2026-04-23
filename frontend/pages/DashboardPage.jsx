import { useEffect, useRef, useState } from 'react';
import streakFlameIcon from '../assets/streak-flame.svg';
import { MobileVideo } from '../components/MobileVideo.jsx';

// ─── Animated counter ─────────────────────────────────────────────────────────

function AnimatedPoints({ target, duration = 800 }) {
  const [count, setCount] = useState(target);
  const rafRef = useRef(null);
  const mounted = useRef(false);

  useEffect(() => {
    // Skip animation on very first mount — just show the number
    if (!mounted.current) {
      mounted.current = true;
      setCount(target);
      return;
    }

    const from = count;
    const delta = target - from;
    if (delta === 0) return;

    const startTime = performance.now();

    function tick(now) {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setCount(Math.round(from + delta * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return <>{count}</>;
}

// ─── Tiny avatar ─────────────────────────────────────────────────────────────

function MiniAvatar({ person }) {
  if (person?.photoUrl) {
    return (
      <img
        className="db-mini-avatar"
        src={person.photoUrl}
        alt={person.russName ?? person.name}
      />
    );
  }
  return (
    <span className="db-mini-avatar db-mini-avatar--icon">
      {person?.icon ?? '👤'}
    </span>
  );
}

const MEDALS = ['🥇', '🥈', '🥉'];

function formatStarLabel(value) {
  const numericValue = Number(value);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
  return safeValue.toFixed(1);
}

function shortenNote(value, maxLength = 120) {
  const trimmed = (value ?? '').trim();

  if (!trimmed) {
    return '';
  }

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
}

// ─── DashboardPage ────────────────────────────────────────────────────────────

export function DashboardPage({
  currentUserId,
  currentUserStreak,
  dailyKnot,
  dashboard,
  leaders,
  onOpenDailyKnot,
  onOpenProfile,
}) {
  const currentLeader =
    dashboard.currentLeader ?? leaders.find((l) => l.id === currentUserId);
  const streakCount = Math.max(0, Number(currentUserStreak?.current ?? 0));
  const streakDayLabel = streakCount === 1 ? 'dag' : 'dager';

  const schoolTopThree = [...(leaders ?? [])]
    .filter((l) => Number.isFinite(l.rank))
    .sort((a, b) =>
      a.rank !== b.rank ? a.rank - b.rank : (b.points ?? 0) - (a.points ?? 0),
    )
    .slice(0, 3);

  if (!currentLeader) {
    return (
      <div className="db-layout">
        <p className="folder-empty" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          Ingen data er tilgjengelig akkurat nå.
        </p>
      </div>
    );
  }

  const pct = Math.min(Math.round(dashboard.rankProgress?.percent ?? 0), 100);
  const nextRankNote =
    dashboard.nextRank?.mode === 'chase'
      ? `${dashboard.nextRank.pointsNeeded}p til ${
          dashboard.nextRank.rival?.russName ?? dashboard.nextRank.rival?.name ?? '–'
        }`
      : 'Du er øverst';

  const weeklyTopPost = dashboard.weeklyTopPost ?? null;
  const weeklyPostMinRatings =
    Number.isFinite(Number(dashboard.weeklyPostMinRatings)) &&
    Number(dashboard.weeklyPostMinRatings) > 0
      ? Number(dashboard.weeklyPostMinRatings)
      : 10;
  const weeklyPostNotePreview = shortenNote(weeklyTopPost?.note ?? '');
  const weeklyHasImage =
    weeklyTopPost?.mediaType === 'image' && Boolean(weeklyTopPost?.imagePreviewUrl);
  const weeklyHasVideo =
    weeklyTopPost?.mediaType === 'video' && Boolean(weeklyTopPost?.videoPreviewUrl);
  const recommendedKnotCategory = (dashboard.recommendedKnot?.category ?? '').trim();
  const showRecommendedKnotCategory =
    Boolean(recommendedKnotCategory) &&
    recommendedKnotCategory.toLowerCase() !== 'egendefinert';

  return (
    <div className="db-layout">

      {/* ══ 1. KOMPAKT HERO ══════════════════════════════════════════════════ */}
      <section className="db-hero">
        {/* Navn + klasse */}
        <div className="db-hero__identity">
          <div className="db-hero__identity-copy">
            <span className="db-hero__name">
              {currentLeader.russName ?? currentLeader.name}
            </span>
            <span className="db-hero__class">
              {currentLeader.className ?? currentLeader.group ?? 'Russ'}
            </span>
          </div>
          <div className="db-hero__streak" aria-label={`Streak ${streakCount} ${streakDayLabel}`}>
            <img
              className="db-hero__streak-icon"
              src={streakFlameIcon}
              alt="Streak flamme"
            />
            <span className="db-hero__streak-value">{streakCount}</span>
            <span className="db-hero__streak-label">streak</span>
          </div>
        </div>

        {/* Poeng + plassering side ved side */}
        <div className="db-hero__stats">
          <div className="db-hero__stat">
            <span className="db-hero__stat-value db-hero__stat-value--gold">
              <AnimatedPoints target={currentLeader.points} />
            </span>
            <span className="db-hero__stat-label">poeng</span>
          </div>

          <div className="db-hero__divider" aria-hidden="true" />

          <div className="db-hero__stat">
            <span className="db-hero__stat-value">
              #{currentLeader.rank}
            </span>
            <span className="db-hero__stat-label">plass</span>
          </div>
        </div>

        {/* Progress */}
        <div className="db-hero__progress">
          <div
            className="db-hero__progress-bar"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="db-hero__progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="db-hero__progress-label">{nextRankNote}</span>
        </div>
      </section>

      {/* ══ 2. DAGENS KNUTE — kompakt stripe ═════════════════════════════════ */}
      {dailyKnot ? (
        <section className="db-daily-strip">
          <span className="db-daily-strip__icon" aria-hidden="true">☀️</span>
          <div className="db-daily-strip__text">
            <span className="db-daily-strip__eyebrow">Dagens knute</span>
            <span className="db-daily-strip__title">{dailyKnot.title}</span>
          </div>
          <span className="db-daily-strip__pts">{dailyKnot.points}p</span>
          <button
            type="button"
            className="action-button action-button--compact db-daily-strip__btn"
            onClick={() => onOpenDailyKnot(dailyKnot.id)}
            aria-label={`Åpne dagens knute: ${dailyKnot.title}`}
          >
            Åpne knute
          </button>
        </section>
      ) : null}

      {/* ══ 3. TOPP 3 PÅ SKOLEN ══════════════════════════════════════════════ */}
      {schoolTopThree.length > 0 ? (
        <section className="db-top3">
          <h3 className="db-section-heading">Topp 3 på skolen</h3>
          <div className="db-top3__list">
            {schoolTopThree.map((leader, i) => (
              <button
                key={leader.id}
                type="button"
                className={`db-top3-row${leader.id === currentUserId ? ' db-top3-row--self' : ''}`}
                onClick={() => onOpenProfile(leader.id)}
              >
                <span className="db-top3-row__medal">{MEDALS[i]}</span>
                <MiniAvatar person={leader} />
                <div className="db-top3-row__info">
                  <strong>{leader.russName ?? leader.name}</strong>
                  <span>{leader.className ?? leader.group ?? 'Russ'}</span>
                </div>
                <span className="db-top3-row__pts">{leader.points}p</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section
        className={`db-weekly-post ${weeklyTopPost ? '' : 'db-weekly-post--empty'}`}
        aria-live="polite"
      >
        <div className="db-weekly-post__top">
          <span className="pill pill--gold">Ukas post</span>
          {weeklyTopPost ? (
            <span className="db-weekly-post__score">
              {formatStarLabel(weeklyTopPost.ratingAverage)} stjerner |{' '}
              {weeklyTopPost.ratingCount} ratinger
            </span>
          ) : null}
        </div>

        {weeklyTopPost ? (
          <>
            {weeklyTopPost.isAnonymous || !weeklyTopPost.studentId ? (
              <div className="db-weekly-post__author">
                <MiniAvatar
                  person={{
                    photoUrl: weeklyTopPost.studentPhotoUrl,
                    icon: weeklyTopPost.studentIcon,
                    russName: weeklyTopPost.studentName,
                  }}
                />
                <div className="db-weekly-post__author-copy">
                  <strong>{weeklyTopPost.studentName}</strong>
                  <span>Vinner denne uka</span>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="db-weekly-post__author db-weekly-post__author--button"
                onClick={() => onOpenProfile(weeklyTopPost.studentId)}
              >
                <MiniAvatar
                  person={{
                    photoUrl: weeklyTopPost.studentPhotoUrl,
                    icon: weeklyTopPost.studentIcon,
                    russName: weeklyTopPost.studentName,
                  }}
                />
                <div className="db-weekly-post__author-copy">
                  <strong>{weeklyTopPost.studentName}</strong>
                  <span>Trykk for profil</span>
                </div>
              </button>
            )}

            {weeklyHasImage ? (
              <div className="db-weekly-post__media-wrap">
                <img
                  className="db-weekly-post__media db-weekly-post__media--image"
                  src={weeklyTopPost.imagePreviewUrl}
                  alt={weeklyTopPost.knotTitle}
                  loading="lazy"
                />
              </div>
            ) : null}
            {weeklyHasVideo ? (
              <div className="db-weekly-post__media-wrap">
                <MobileVideo
                  className="db-weekly-post__media db-weekly-post__media--video"
                  src={weeklyTopPost.videoPreviewUrl}
                  controls
                  autoPlay={false}
                  muted
                  playsInline
                  loop={false}
                  preload="metadata"
                />
              </div>
            ) : null}

            <strong className="db-weekly-post__title">{weeklyTopPost.knotTitle}</strong>
            {weeklyPostNotePreview ? (
              <p className="db-weekly-post__note">"{weeklyPostNotePreview}"</p>
            ) : null}
            <p className="db-weekly-post__meta">
              {weeklyTopPost.points}p | {weeklyTopPost.completedAt}
            </p>
          </>
        ) : (
          <div className="db-weekly-post__empty">
            <strong>Ingen kandidat ennå</strong>
            <p>
              En post må ha minst {weeklyPostMinRatings} ratinger for å kunne bli Ukas
              post.
            </p>
          </div>
        )}
      </section>

      {/* ══ 4. RIVALER ═══════════════════════════════════════════════════════ */}
      {/* ══ 5. ANBEFALT KNUTE ════════════════════════════════════════════════ */}
      {dashboard.recommendedKnot ? (
        <section className="db-recommend">
          <div className="db-recommend__header">
            <h3 className="db-section-heading db-recommend__heading">Anbefalt knute</h3>
            <span className="db-recommend__pts">
              {dashboard.recommendedKnot.points}p
            </span>
          </div>
          <div className="db-recommend__card">
            {showRecommendedKnotCategory ? (
              <div className="db-recommend__top">
                <span className="pill pill--soft">{dashboard.recommendedKnot.category}</span>
              </div>
            ) : null}
            <strong className="db-recommend__title">{dashboard.recommendedKnot.title}</strong>
            {dashboard.recommendedKnot.description ? (
              <p>{dashboard.recommendedKnot.description}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ══ 6. PÅMINNELSER ═══════════════════════════════════════════════════ */}
      {dashboard.messages?.length > 0 ? (
        <section className="db-messages">
          <h3 className="db-section-heading">Påminnelser</h3>
          <div className="db-messages__list">
            {dashboard.messages.map((msg) => (
              <div key={msg.id} className="db-message">
                <strong>{msg.title}</strong>
                <p>{msg.detail}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

    </div>
  );
}
