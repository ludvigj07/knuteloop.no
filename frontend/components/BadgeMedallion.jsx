// BadgeMedallion — Clash Royale-inspirert sirkulær merke-render.
// Tier-fargede borders, indre ring, ytre glow på Gull/Diamant og en
// holographic shimmer-overlay på Diamant. Låste merker rendres i
// gråtone med 🔒-overlay.

const SIZE_MAP = {
  sm: 56,
  md: 72,
  lg: 96,
};

export function BadgeMedallion({
  achievement,
  size = 'md',
  showLabel = true,
}) {
  if (!achievement) return null;

  const px = SIZE_MAP[size] ?? SIZE_MAP.md;
  const tierKey = achievement.tierKey ?? 'locked';
  const tierLabel = achievement.currentTierLabel ?? 'Låst';
  const isUnlocked = Boolean(achievement.isUnlocked);
  const isDiamond = tierKey === 'diamond';
  const isGold = tierKey === 'gold';
  const className = [
    'badge-medallion',
    `badge-medallion--${size}`,
    `badge-medallion--${tierKey}`,
    isUnlocked ? 'is-unlocked' : 'is-locked',
  ].join(' ');

  return (
    <div
      className={className}
      style={{ '--badge-size': `${px}px` }}
      aria-label={`${achievement.title} (${tierLabel})`}
    >
      <div className="badge-medallion__ring" aria-hidden="true">
        <div className="badge-medallion__inner">
          <span className="badge-medallion__icon" aria-hidden="true">
            {achievement.icon ?? '★'}
          </span>
        </div>
        {isDiamond ? <span className="badge-medallion__shimmer" aria-hidden="true" /> : null}
        {(isGold || isDiamond) ? <span className="badge-medallion__glow" aria-hidden="true" /> : null}
        {!isUnlocked ? (
          <span className="badge-medallion__lock" aria-hidden="true">🔒</span>
        ) : null}
      </div>
      {showLabel ? (
        <div className="badge-medallion__label">
          <strong className="badge-medallion__title">{achievement.title}</strong>
          <span className={`badge-medallion__tier badge-medallion__tier--${tierKey}`}>
            {tierLabel}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function BadgeGrid({ achievements, size = 'md' }) {
  if (!achievements || achievements.length === 0) {
    return (
      <p className="folder-empty">Ingen merker er åpnet ennå.</p>
    );
  }
  return (
    <div className="badge-grid">
      {achievements.map((achievement) => (
        <BadgeMedallion key={achievement.id} achievement={achievement} size={size} />
      ))}
    </div>
  );
}
