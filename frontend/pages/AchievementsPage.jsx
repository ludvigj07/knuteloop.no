import { SectionCard } from '../components/SectionCard.jsx';
import { getUnlockedAchievements } from '../data/badgeSystem.js';

export function AchievementsPage({ achievements }) {
  const unlockedAchievements = getUnlockedAchievements(achievements);
  const maxTierCount = achievements.filter((achievement) => achievement.isMaxTier).length;

  return (
    <div className="stack-layout">
      <SectionCard
        title="Merker du har åpnet"
        description="Følg progresjon i ditt eget tempo mot neste nivå."
      >
        <div className="badge-hero">
          <article className="badge-summary-card">
            <span>Opplåste merker</span>
            <strong>{unlockedAchievements.length}</strong>
            <p>{maxTierCount} på høyeste nivå akkurat nå</p>
          </article>

          <div className="badge-rail">
            {unlockedAchievements.length > 0 ? (
              unlockedAchievements.map((achievement) => (
                <article
                  key={achievement.id}
                  className={`badge-token badge-token--${achievement.tone}`}
                >
                  <span className="badge-token__icon">{achievement.icon}</span>
                  <div>
                    <strong>{achievement.title}</strong>
                    <p>{achievement.currentTierLabel}</p>
                  </div>
                </article>
              ))
            ) : (
              <article className="badge-token badge-token--muted">
                <span className="badge-token__icon">☆</span>
                <div>
                  <strong>Ingen merker ennå</strong>
                  <p>Ta flere knuter for å fylle opp samlingen.</p>
                </div>
              </article>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Hele merkesamlingen"
        description="Hvert merke har flere nivåer med tydelig progresjon."
      >
        <div className="card-grid">
          {achievements.map((achievement) => {
            return (
              <article
                key={achievement.id}
                className={`badge-card badge-card--${achievement.tone}`}
              >
                <div className="badge-card__header">
                  <div className="badge-card__icon">{achievement.icon}</div>
                  <span
                    className={`pill ${
                      achievement.isUnlocked ? 'pill--success' : 'pill--muted'
                    }`}
                  >
                    {achievement.currentTierLabel}
                  </span>
                </div>

                <div className="badge-card__body">
                  <span className="badge-card__medal">{achievement.category}</span>
                  <h3>{achievement.title}</h3>
                  <p>{achievement.description}</p>
                </div>

                <div className="progress-block">
                  <div className="progress-meta">
                    <span>
                      {achievement.nextTier
                        ? `Neste nivå: ${achievement.nextTier.label}`
                        : 'Høyeste nivå nå'}
                    </span>
                    <strong>
                      {achievement.currentProgress}/{achievement.progressTarget}
                    </strong>
                  </div>
                  <div className="progress-bar" aria-hidden="true">
                    <span style={{ width: `${achievement.progressPercent}%` }} />
                  </div>
                  <p className="achievement-tier-note">
                    {achievement.nextTier
                      ? `${achievement.nextTier.target - achievement.currentProgress} igjen til ${achievement.nextTier.label}.`
                      : 'Høyeste nivå er låst opp.'}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
