import { useState } from 'react';
import { SectionCard } from '../components/SectionCard.jsx';

export function LeaderboardPage({
  currentUserId,
  duelAvailability,
  duelHistory,
  duelSummary,
  leaders,
  onOpenProfile,
  onStartDuel,
}) {
  const [duelFeedback, setDuelFeedback] = useState('');

  function handleStartDuel(opponentId) {
    const result = onStartDuel?.(opponentId);

    if (result?.message) {
      setDuelFeedback(result.message);
    }
  }

  return (
    <SectionCard
      title="Leaderboard"
      description="Rangeringen under bruker lokal state og oppdateres når innsendinger og knute-offs blir registrert."
    >
      <div className="duel-summary-bar">
        <div>
          <strong>Knute-off</strong>
          <p>
            Utfordre brukere innenfor {duelSummary?.range ?? 5} plasser. Hver duel
            gir {duelSummary?.stake ?? 5} poeng opp eller ned.
          </p>
        </div>
        <div className="duel-summary-bar__stats">
          <span>{duelSummary?.currentUserWeeklyCount ?? 0}/2 denne uken</span>
          <span>{duelSummary?.currentUserRemaining ?? 0} igjen</span>
        </div>
      </div>

      {duelFeedback ? (
        <div className="inline-feedback">
          <p>{duelFeedback}</p>
          <button
            type="button"
            className="action-button action-button--ghost action-button--compact"
            onClick={() => setDuelFeedback('')}
          >
            Lukk
          </button>
        </div>
      ) : null}

      <div className="leaderboard-list">
        {leaders.map((leader) => {
          const duelState = duelAvailability?.byLeaderId?.[leader.id];
          const isCurrentUser = leader.id === currentUserId;
          const duelHint = isCurrentUser
            ? 'Din plassering oppdateres med både knuter og knute-offs.'
            : duelState?.reason ?? 'Knute-off utilgjengelig akkurat nå.';

          return (
            <article key={leader.id} className="leaderboard-row">
              <div className="leaderboard-row__rank">#{leader.rank}</div>
              <div className="leaderboard-row__person">
                {leader.photoUrl ? (
                  <div className="profile-photo profile-photo--small">
                    <img
                      src={leader.photoUrl}
                      alt={`${leader.russName ?? leader.name} profilbilde`}
                    />
                  </div>
                ) : (
                  <div className="profile-avatar profile-avatar--small">
                    {leader.icon}
                  </div>
                )}
                <div className="leaderboard-row__person-text">
                  <h3>{leader.russName ?? leader.name}</h3>
                  <p>
                    {leader.realName ?? leader.name} | {leader.className ?? leader.group}
                  </p>
                  <span className="pill pill--rank">{leader.leaderboardTitle}</span>
                </div>
              </div>
              <div className="leaderboard-row__details">
                <span>{leader.completedKnots} godkjente knuter</span>
                <strong>{leader.points} poeng</strong>
                {leader.duelPointDelta ? (
                  <span className="leaderboard-row__duel-note">
                    Knute-off{' '}
                    {leader.duelPointDelta > 0
                      ? `+${leader.duelPointDelta}`
                      : leader.duelPointDelta}
                    p
                  </span>
                ) : null}
                <div className="leaderboard-row__actions">
                  <button
                    type="button"
                    className="action-button action-button--ghost"
                    onClick={() => onOpenProfile(leader.id)}
                  >
                    Se profil
                  </button>
                  {!isCurrentUser ? (
                    <button
                      type="button"
                      className="action-button"
                      disabled={!duelState?.canChallenge}
                      onClick={() => handleStartDuel(leader.id)}
                    >
                      Utfordre
                    </button>
                  ) : null}
                </div>
                <p className="leaderboard-row__duel-hint">{duelHint}</p>
              </div>
            </article>
          );
        })}
      </div>

      <div className="duel-history-block">
        <div className="section-card__header">
          <h3>Siste knute-offs</h3>
          <p>Små dueller som gir en liten edge i det vanlige leaderboardet.</p>
        </div>

        <div className="duel-history-list">
          {duelHistory?.slice(0, 5).map((duel) => (
            <article key={duel.id} className="duel-history-row">
              <div>
                <strong>
                  {duel.winnerName} slo {duel.loserName}
                </strong>
                <p>
                  {duel.challengerName} vs {duel.opponentName} | {duel.playedAtLabel}
                </p>
              </div>
              <span className="pill pill--warning">+/- {duel.stake}p</span>
            </article>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}
