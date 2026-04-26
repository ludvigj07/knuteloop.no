import { useMemo, useState } from 'react';
import { getUnlockedAchievements, isGoldKnot } from '../data/badgeSystem.js';
import { BadgeGrid, BadgeMedallion } from '../components/BadgeMedallion.jsx';
import { resolveKnotFolder } from '../data/knotFolders.js';

// StatusPage v2 — visuell "Min stats + Knute-off"-side. Tre soner:
// hero-stats, merker, knute-off. Mini-stats nederst. Null excel-stil.

function HeroStat({ icon, value, label, tone }) {
  return (
    <div className={`status-v2-hero__stat status-v2-hero__stat--${tone}`}>
      <span className="status-v2-hero__icon" aria-hidden="true">{icon}</span>
      <strong className="status-v2-hero__value">{value}</strong>
      <span className="status-v2-hero__label">{label}</span>
    </div>
  );
}

function NextBadgeCard({ achievement }) {
  if (!achievement) return null;
  const remaining = Math.max(
    (achievement.nextTier?.target ?? achievement.progressTarget) -
      achievement.currentProgress,
    0,
  );
  const percent = achievement.progressPercent ?? 0;

  return (
    <div className="status-v2-next-badge" aria-label={`Neste merke: ${achievement.title}`}>
      <div className="status-v2-next-badge__icon" aria-hidden="true">
        {achievement.icon ?? '★'}
      </div>
      <div className="status-v2-next-badge__copy">
        <strong>{achievement.title}</strong>
        <span>{remaining} igjen til {achievement.nextTier?.label ?? 'neste'}</span>
        <div className="status-v2-next-badge__bar" aria-hidden="true">
          <div
            className="status-v2-next-badge__fill"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon, value, label, tone = 'default' }) {
  return (
    <div className={`status-v2-mini-stat status-v2-mini-stat--${tone}`}>
      <span className="status-v2-mini-stat__icon" aria-hidden="true">{icon}</span>
      <strong className="status-v2-mini-stat__value">{value}</strong>
      <span className="status-v2-mini-stat__label">{label}</span>
    </div>
  );
}

function ActiveDuelCard({ duel, currentUserId }) {
  const isChallenger = duel.challengerId === currentUserId;
  const opponentName = isChallenger ? duel.opponentName : duel.challengerName;

  return (
    <article className="status-v2-duel-card status-v2-duel-card--active">
      <div className="status-v2-duel-card__top">
        <span className="status-v2-duel-card__vs" aria-hidden="true">⚔️</span>
        <strong className="status-v2-duel-card__title">{duel.knotTitle}</strong>
      </div>
      <div className="status-v2-duel-card__mid">
        <span className="status-v2-duel-card__opponent">vs. {opponentName}</span>
        <span className="status-v2-duel-card__stake">+{duel.stake}p</span>
      </div>
      <div className="status-v2-duel-card__deadline">
        ⏱ {duel.deadlineLabel}
      </div>
    </article>
  );
}

function DuelResultRow({ duel, currentUserId }) {
  const youWon = duel.winnerId === currentUserId;
  const opponentName =
    duel.challengerId === currentUserId ? duel.opponentName : duel.challengerName;

  return (
    <div
      className={`status-v2-duel-result status-v2-duel-result--${
        youWon ? 'win' : 'loss'
      }`}
    >
      <span className="status-v2-duel-result__icon" aria-hidden="true">
        {youWon ? '✅' : '❌'}
      </span>
      <span className="status-v2-duel-result__copy">
        {youWon ? 'Vant mot' : 'Tapte mot'} <strong>{opponentName}</strong>
      </span>
      <span className="status-v2-duel-result__stake">
        {youWon ? '+' : '−'}{duel.stake}p
      </span>
    </div>
  );
}

export function StatusPage({
  achievements,
  currentLeader,
  currentUserId,
  currentUserStreak,
  duelHistory,
  duelSummary,
  knots,
  onOpenKnots,
  onOpenLeaderboard,
}) {
  const [showAllBadges, setShowAllBadges] = useState(false);

  const safeAchievements = achievements ?? [];
  const unlockedAchievements = useMemo(
    () => getUnlockedAchievements(safeAchievements),
    [safeAchievements],
  );
  const nextAchievement = useMemo(
    () =>
      safeAchievements
        .filter((a) => !a.isMaxTier)
        .sort((l, r) => {
          const lr = (l.nextTier?.target ?? l.progressTarget) - l.currentProgress;
          const rr = (r.nextTier?.target ?? r.progressTarget) - r.currentProgress;
          return lr - rr;
        })[0] ?? null,
    [safeAchievements],
  );

  const safeDuels = duelHistory ?? [];
  const myActiveDuels = useMemo(
    () =>
      safeDuels.filter(
        (duel) =>
          duel.status === 'active' &&
          (duel.challengerId === currentUserId || duel.opponentId === currentUserId),
      ),
    [currentUserId, safeDuels],
  );
  const myFinishedDuels = useMemo(
    () =>
      safeDuels.filter(
        (duel) =>
          duel.status !== 'active' &&
          (duel.challengerId === currentUserId || duel.opponentId === currentUserId),
      ),
    [currentUserId, safeDuels],
  );
  const recentResults = myFinishedDuels.slice(0, 3);
  const duelsWonCount = myFinishedDuels.filter((d) => d.winnerId === currentUserId).length;

  const safeKnots = knots ?? [];
  const myApprovedKnots = useMemo(
    () =>
      safeKnots.filter(
        (k) => k.status === 'Godkjent' && k.leaderId === currentUserId,
      ),
    [safeKnots, currentUserId],
  );
  const goldCount = myApprovedKnots.filter(isGoldKnot).length;
  const folderHits = useMemo(() => {
    const set = new Set();
    myApprovedKnots.forEach((k) => set.add(resolveKnotFolder(k)));
    return set.size;
  }, [myApprovedKnots]);

  const points = currentLeader?.points ?? 0;
  const rank = currentLeader?.rank ?? null;
  const streak = Math.max(0, Number(currentUserStreak?.current ?? 0));

  const stake = duelSummary?.stake ?? 10;
  const deadlineHours = duelSummary?.deadlineHours ?? 24;

  return (
    <div className="status-v2">
      {/* 1. HERO STATS */}
      <section className="status-v2-hero" aria-label="Mine tall">
        <HeroStat icon="🔥" value={streak} label="dager streak" tone="streak" />
        <HeroStat icon="⭐" value={points} label="poeng" tone="points" />
        <HeroStat
          icon="🏆"
          value={rank ? `#${rank}` : '—'}
          label="rank"
          tone="rank"
        />
      </section>

      {/* 2. MERKER */}
      <section className="status-v2-badges" aria-label="Merker">
        <header className="status-v2-section-head">
          <h3>Mine merker</h3>
          <button
            type="button"
            className="status-v2-link"
            onClick={() => setShowAllBadges((v) => !v)}
          >
            {showAllBadges ? 'Skjul' : `Se alle (${safeAchievements.length})`}
          </button>
        </header>

        {showAllBadges ? (
          <BadgeGrid achievements={safeAchievements} size="md" />
        ) : (
          <div className="status-v2-badges__row">
            {unlockedAchievements.length === 0 ? (
              <p className="status-v2-empty">
                Ingen merker enda — ta din første knute så er du i gang 🪢
              </p>
            ) : (
              unlockedAchievements
                .slice(0, 8)
                .map((a) => (
                  <BadgeMedallion key={a.id} achievement={a} size="sm" showLabel={false} />
                ))
            )}
            {nextAchievement ? <NextBadgeCard achievement={nextAchievement} /> : null}
          </div>
        )}
      </section>

      {/* 3. KNUTE-OFF */}
      <section className="status-v2-duels" aria-label="Knute-off">
        <header className="status-v2-section-head">
          <h3>Knute-off</h3>
          <span className="status-v2-section-meta">{stake}p · {deadlineHours}t frist</span>
        </header>

        <button
          type="button"
          className="status-v2-cta"
          onClick={onOpenLeaderboard}
        >
          <span aria-hidden="true">⚔️</span>
          <span>Start ny knute-off</span>
        </button>

        {myActiveDuels.length > 0 ? (
          <div className="status-v2-duel-card-list">
            {myActiveDuels.map((duel) => (
              <ActiveDuelCard key={duel.id} duel={duel} currentUserId={currentUserId} />
            ))}
          </div>
        ) : (
          <p className="status-v2-empty">Ingen aktive knute-off akkurat nå.</p>
        )}

        {recentResults.length > 0 ? (
          <div className="status-v2-duel-results">
            {recentResults.map((duel) => (
              <DuelResultRow key={duel.id} duel={duel} currentUserId={currentUserId} />
            ))}
          </div>
        ) : null}
      </section>

      {/* 4. MINI-STATS */}
      <section className="status-v2-mini-grid" aria-label="Statistikk">
        <MiniStat icon="🪢" value={myApprovedKnots.length} label="knuter tatt" tone="knot" />
        <MiniStat icon="💎" value={goldCount} label="gull-knuter" tone="gold" />
        <MiniStat icon="🎨" value={folderHits} label="mapper truffet" tone="folder" />
        <MiniStat icon="⚔️" value={duelsWonCount} label="knute-off vunnet" tone="duel" />
        <MiniStat
          icon="🏅"
          value={unlockedAchievements.length}
          label="merker låst opp"
          tone="badge"
        />
        <button
          type="button"
          className="status-v2-mini-stat status-v2-mini-stat--cta"
          onClick={onOpenKnots}
        >
          <span className="status-v2-mini-stat__icon" aria-hidden="true">→</span>
          <strong className="status-v2-mini-stat__value">Knuter</strong>
          <span className="status-v2-mini-stat__label">ta flere</span>
        </button>
      </section>
    </div>
  );
}
