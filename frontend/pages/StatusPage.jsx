import {
  BeerBottleIcon,
  HeteroSymbolIcon,
  RampestrekerIcon,
  SimpleKnotIcon,
  TwoXIcon,
} from '../components/KnotCategoryIcons.jsx';
import { resolveKnotFolder } from '../data/knotFolders.js';

const CATEGORY_META = [
  { id: 'Generelle', label: 'Generelle', Icon: SimpleKnotIcon },
  { id: 'Dobbelknuter', label: 'Dobbel', Icon: TwoXIcon },
  { id: 'Fordervett-knuter', label: 'Rampestrek', Icon: RampestrekerIcon },
  { id: 'Alkoholknuter', label: 'Alkohol', Icon: BeerBottleIcon },
  { id: 'Sexknuter', label: 'Sex', Icon: HeteroSymbolIcon },
];

const GOLD_POINTS_THRESHOLD = 30;

function tierForPercent(percent) {
  if (percent >= 75) return 'diamond';
  if (percent >= 50) return 'gold';
  if (percent >= 25) return 'silver';
  return 'bronze';
}

function isCompletedKnot(knot) {
  return knot.status === 'Godkjent' || knot.status === 'Fullført';
}

function CategoryMedallion({ Icon, label, completed, total }) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const tier = tierForPercent(percent);

  return (
    <article
      className={`category-medallion category-medallion--${tier}`}
      role="listitem"
      aria-label={`${label}-knuter: ${completed} av ${total} fullført`}
    >
      <div className="category-medallion__ring">
        <div className="category-medallion__core">
          <Icon size={28} strokeWidth={1.7} />
        </div>
      </div>
      <strong className="category-medallion__label">{label}</strong>
      <span className="category-medallion__count">
        {completed} / {total}
      </span>
    </article>
  );
}

export function StatusPage({
  knots = [],
  currentUserPoints = 0,
  currentUserRank = null,
  currentUserStreak,
  onOpenFeed,
  onOpenKnots,
}) {
  const streakCount = currentUserStreak?.current ?? 0;

  const categoryStats = CATEGORY_META.map((category) => {
    const inCategory = knots.filter(
      (knot) => resolveKnotFolder(knot) === category.id,
    );
    return {
      ...category,
      completed: inCategory.filter(isCompletedKnot).length,
      total: inCategory.length,
    };
  });

  const completedKnots = knots.filter(isCompletedKnot);
  const totalCompleted = completedKnots.length;
  const goldKnots = completedKnots.filter(
    (knot) => Number(knot.points ?? 0) >= GOLD_POINTS_THRESHOLD,
  ).length;

  return (
    <div className="status-page-v2">
      <section className="status-hero-v2" aria-label="Mine nøkkeltall">
        <article className="status-hero-v2__stat">
          <span aria-hidden="true">🔥</span>
          <strong>{streakCount}</strong>
          <p>Streak</p>
        </article>
        <article className="status-hero-v2__stat">
          <span aria-hidden="true">⭐</span>
          <strong>{currentUserPoints}</strong>
          <p>Poeng</p>
        </article>
        <article className="status-hero-v2__stat">
          <span aria-hidden="true">🏆</span>
          <strong>{currentUserRank ? `#${currentUserRank}` : '–'}</strong>
          <p>Rank</p>
        </article>
      </section>

      <section className="status-categories-v2" aria-label="Knote-kategorier">
        <header className="status-section-header-v2">
          <h2>Knote-kategorier</h2>
          <p>Tier-ringen oppgraderes når du fullfører flere knuter i kategorien.</p>
        </header>
        <div className="status-category-rail" role="list">
          {categoryStats.map((category) => (
            <CategoryMedallion
              key={category.id}
              Icon={category.Icon}
              label={category.label}
              completed={category.completed}
              total={category.total}
            />
          ))}
        </div>
      </section>

      <section className="status-mini-grid-v2" aria-label="Mini-statistikk">
        <article className="status-mini-cell">
          <strong>{totalCompleted}</strong>
          <p>Knuter fullført</p>
        </article>
        <article className="status-mini-cell">
          <strong>{goldKnots}</strong>
          <p>Gull-knuter</p>
        </article>
        <button
          type="button"
          className="status-mini-cell status-mini-cell--action"
          onClick={onOpenKnots}
        >
          <span aria-hidden="true">🪢</span>
          <p>Åpne Knuter</p>
        </button>
        <button
          type="button"
          className="status-mini-cell status-mini-cell--action"
          onClick={onOpenFeed}
        >
          <span aria-hidden="true">📺</span>
          <p>Åpne Feed</p>
        </button>
      </section>
    </div>
  );
}
