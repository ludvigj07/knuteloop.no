import { useMemo, useState } from 'react';
import { SectionCard } from '../components/SectionCard.jsx';
import { getFeaturedAchievements, getUnlockedAchievements } from '../data/badgeSystem.js';
import { BadgeGrid, BadgeMedallion } from '../components/BadgeMedallion.jsx';

function ProfileThumb({ person }) {
  if (person?.studentPhotoUrl || person?.photoUrl) {
    return (
      <div className="profile-photo profile-photo--small">
        <img
          src={person.studentPhotoUrl ?? person.photoUrl}
          alt={`${person.studentName ?? person.russName ?? person.name} profilbilde`}
        />
      </div>
    );
  }

  return (
    <div className="profile-avatar profile-avatar--small">
      {person?.studentIcon ?? person?.icon ?? '•'}
    </div>
  );
}

export function StatusPage({
  achievements,
  activityLog,
  currentUserId,
  duelHistory,
  duelSummary,
  onOpenFeed,
  onOpenProfile,
  onOpenKnots,
}) {
  const [expandedSection, setExpandedSection] = useState(null);

  const unlockedAchievements = useMemo(
    () => getUnlockedAchievements(achievements ?? []),
    [achievements],
  );
  const featuredAchievements = useMemo(
    () => getFeaturedAchievements(achievements ?? [], 3),
    [achievements],
  );
  const nextAchievement = useMemo(
    () =>
      (achievements ?? [])
        .filter((achievement) => !achievement.isMaxTier)
        .sort((left, right) => {
          const leftRemaining =
            (left.nextTier?.target ?? left.progressTarget) - left.currentProgress;
          const rightRemaining =
            (right.nextTier?.target ?? right.progressTarget) - right.currentProgress;

          return leftRemaining - rightRemaining;
        })[0] ?? null,
    [achievements],
  );
  const myActiveDuels = useMemo(
    () =>
      (duelHistory ?? []).filter(
        (duel) =>
          duel.status === 'active' &&
          (duel.challengerId === currentUserId || duel.opponentId === currentUserId),
      ),
    [currentUserId, duelHistory],
  );
  const myRecentDuels = useMemo(
    () =>
      (duelHistory ?? []).filter(
        (duel) =>
          duel.challengerId === currentUserId || duel.opponentId === currentUserId,
      ),
    [currentUserId, duelHistory],
  );
  const recentActivity = useMemo(() => (activityLog ?? []).slice(0, 5), [activityLog]);

  function toggleSection(sectionId) {
    setExpandedSection((currentSection) =>
      currentSection === sectionId ? null : sectionId,
    );
  }

  return (
    <div className="stack-layout">
      <SectionCard
        title="Status"
        description="Merker, knute-off og feed samlet i ett rolig overblikk."
      >
        <div className="status-hub-grid">
          <article className="status-hub-card">
            <span className="status-hub-card__kicker">Merker</span>
            <strong>{unlockedAchievements.length}</strong>
            <p>
              {nextAchievement
                ? `${nextAchievement.title}: ${Math.max(
                    (nextAchievement.nextTier?.target ?? nextAchievement.progressTarget) -
                      nextAchievement.currentProgress,
                    0,
                  )} igjen`
                : 'Du har åpnet alle merkene.'}
            </p>
            <button
              type="button"
              className="action-button action-button--ghost action-button--compact"
              onClick={() => toggleSection('badges')}
            >
              {expandedSection === 'badges' ? 'Skjul merker' : 'Se merker'}
            </button>
          </article>

          <article className="status-hub-card">
            <span className="status-hub-card__kicker">Knute-off</span>
            <strong>{myActiveDuels.length}</strong>
            <p>
              {myActiveDuels.length > 0
                ? `${duelSummary?.stake ?? 10}p innsats, ${duelSummary?.deadlineHours ?? 24}t frist og ${duelSummary?.dailyLimit ?? 1} per dag`
                : 'Ingen aktive knute-offer akkurat nå'}
            </p>
            <button
              type="button"
              className="action-button action-button--ghost action-button--compact"
              onClick={() => toggleSection('duels')}
            >
              {expandedSection === 'duels' ? 'Skjul knute-off' : 'Se knute-off'}
            </button>
          </article>

          <article className="status-hub-card">
            <span className="status-hub-card__kicker">Feed</span>
            <strong>{recentActivity.length}</strong>
            <p>
              {recentActivity[0]
                ? `Siste deling: ${recentActivity[0].studentName} tok ${recentActivity[0].knotTitle}`
                : 'Ingen ny aktivitet ennå'}
            </p>
            <button
              type="button"
              className="action-button action-button--ghost action-button--compact"
              onClick={onOpenFeed}
            >
              Åpne feed
            </button>
          </article>
        </div>
      </SectionCard>

      <SectionCard
        title="Merkestatus"
        description="Det viktigste i merkesamlingen akkurat nå."
      >
        <div className="status-section-toolbar">
          <p>
            {nextAchievement
              ? `Neste nivå er ${nextAchievement.nextTier?.label ?? 'neste'} i ${nextAchievement.title}.`
              : 'Alle nivåer i merkesamlingen er åpnet.'}
          </p>
          <button
            type="button"
            className="action-button action-button--ghost action-button--compact"
            onClick={onOpenKnots}
          >
            Se knuter
          </button>
        </div>

        {expandedSection === 'badges' ? (
          <BadgeGrid achievements={achievements ?? []} size="md" />
        ) : (
          <div className="status-inline-summary">
            {featuredAchievements.slice(0, 3).map((achievement) => (
              <BadgeMedallion
                key={achievement.id}
                achievement={achievement}
                size="sm"
                showLabel
              />
            ))}
            {featuredAchievements.length === 0 ? (
              <p className="folder-empty">Ingen merker åpnet ennå.</p>
            ) : null}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Knute-off status"
        description="Oversikt uten stress."
      >
        <div className="status-section-toolbar">
          <p>
            {myActiveDuels.length > 0
              ? `${myActiveDuels.length} aktiv${myActiveDuels.length > 1 ? 'e' : ''} knute-off akkurat nå.`
              : 'Ingen aktive knute-offer akkurat nå.'}
          </p>
          <button
            type="button"
            className="action-button action-button--ghost action-button--compact"
            onClick={() => toggleSection('duels')}
          >
            {expandedSection === 'duels' ? 'Vis mindre' : 'Vis detaljer'}
          </button>
        </div>

        <div className="status-compact-list">
          {(expandedSection === 'duels' ? myRecentDuels : myActiveDuels).slice(0, 3).map((duel) => (
            <article key={duel.id} className="status-list-row">
              <div>
                <strong>{duel.knotTitle}</strong>
                <p>
                  {duel.challengerName} vs {duel.opponentName}
                </p>
              </div>
              <span className="pill pill--warning">
                {duel.status === 'active' ? duel.deadlineLabel : duel.outcomeTitle}
              </span>
            </article>
          ))}

          {(expandedSection === 'duels' ? myRecentDuels : myActiveDuels).length === 0 ? (
            <p className="folder-empty">Ingen knute-offer å vise akkurat nå.</p>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="Nylig aktivitet"
        description="Korte glimt fra det som skjer i kullet."
      >
        <div className="status-section-toolbar">
          <p>Et enkelt overblikk som fungerer godt på mobil.</p>
          <button
            type="button"
            className="action-button action-button--ghost action-button--compact"
            onClick={onOpenFeed}
          >
            Gå til feed
          </button>
        </div>

        <div className="status-compact-list">
          {(expandedSection === 'feed' ? recentActivity : recentActivity.slice(0, 3)).map((entry) => (
            <article key={entry.id} className="status-list-row status-list-row--feed">
              <div className="status-list-row__person">
                <ProfileThumb person={entry} />
                <div>
                  <strong>{entry.studentName}</strong>
                  <p>{entry.knotTitle}</p>
                </div>
              </div>
              <button
                type="button"
                className="action-button action-button--ghost action-button--compact"
                onClick={() => onOpenProfile(entry.studentId)}
              >
                Profil
              </button>
            </article>
          ))}

          {recentActivity.length === 0 ? (
            <p className="folder-empty">Ingen aktivitet i feeden ennå.</p>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}

