import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { SectionCard } from '../components/SectionCard.jsx';
import { getUnlockedAchievements } from '../data/badgeSystem.js';

function createProfileDraft(profile) {
  return {
    icon: profile?.icon ?? '',
    photoUrl: profile?.photoUrl ?? '',
    photoFile: null,
    photoName: '',
    russName: profile?.russName ?? '',
    realName: profile?.realName ?? '',
    className: profile?.className ?? '',
    bio: profile?.bio ?? '',
    quote: profile?.quote ?? '',
    knownFor: profile?.knownFor ?? '',
    signatureKnot: profile?.signatureKnot ?? '',
    favoriteCategory: profile?.favoriteCategory ?? '',
    russType: profile?.russType ?? 'blue',
    genderIdentity: profile?.genderIdentity ?? 'other',
  };
}

function revokeLocalPreview(url, keepUrl = '') {
  if (!url || url === keepUrl || !url.startsWith('blob:') || typeof URL === 'undefined') {
    return;
  }

  URL.revokeObjectURL(url);
}

function ProfilePhoto({ profile, size = 'small' }) {
  if (profile?.photoUrl) {
    const useThumb = size === 'small' || size === 'thumb';
    const src = useThumb ? (profile.photoThumbUrl || profile.photoUrl) : profile.photoUrl;
    return (
      <div className={`profile-photo profile-photo--${size}`}>
        <img
          src={src}
          alt={`${profile.russName ?? profile.realName ?? 'Profil'} profilbilde`}
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }

  return (
    <div
      className={`profile-avatar profile-avatar--${
        size === 'large' ? 'large' : size === 'thumb' ? 'thumb' : 'small'
      }`}
    >
      {profile?.icon}
    </div>
  );
}

function UserAvatar({ profile, size = 'md' }) {
  const photoSize = size === 'lg' ? 'large' : size === 'sm' ? 'thumb' : 'small';

  return <ProfilePhoto profile={profile} size={photoSize} />;
}

function ProfileCard({ canEdit, onEdit, profile, roleLabel }) {
  return (
    <section className="mobile-profile-card">
      <div className="mobile-profile-card__avatar-wrap">
        <UserAvatar profile={profile} size="lg" />
        {canEdit ? (
          <button
            type="button"
            className="mobile-profile-card__camera"
            onClick={onEdit}
            aria-label="Rediger profilbilde"
          >
            📷
          </button>
        ) : null}
      </div>

      <div className="mobile-profile-card__identity">
        <div className="mobile-profile-card__name-row">
          <h2>{profile.russName}</h2>
        </div>
        <p>{roleLabel}</p>
        <div className="mobile-profile-card__chips">
          <span className="is-gold">{profile.leaderboardTitle}</span>
          <span className="is-role">{roleLabel}</span>
        </div>
      </div>

      <div className="mobile-profile-quote">
        <span className="mobile-profile-quote__mark">“</span>
        <p>{profile.quote}</p>
        {canEdit ? (
          <button
            type="button"
            className="mobile-profile-quote__edit"
            onClick={onEdit}
            aria-label="Rediger quote"
          >
            ✎
          </button>
        ) : null}
      </div>
    </section>
  );
}

function ScoreRankingCard({ profile, totalUsers }) {
  return (
    <section className="mobile-score-card">
      <div className="mobile-score-card__points">
        <span>Dine poeng</span>
        <div className="mobile-score-card__score-line">
          <span aria-hidden="true">⚡</span>
          <strong>{profile.points}</strong>
        </div>
        <p>poeng</p>
      </div>
      <div className="mobile-score-card__ranking">
        <span>Ranking</span>
        <strong>#{profile.rank}</strong>
        <p>av {totalUsers}</p>
        <div className="mobile-score-card__trophy" aria-hidden="true">
          🏆
        </div>
      </div>
    </section>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <article className="mobile-stat-card">
      <span aria-hidden="true">{icon}</span>
      <strong>{value}</strong>
      <p>{label}</p>
    </article>
  );
}

function Tabs({ activeTab, onChange, tabs }) {
  return (
    <div className="mobile-profile-tabs" role="tablist" aria-label="Profilinnhold">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={tab.id === activeTab ? 'is-active' : ''}
          onClick={() => onChange(tab.id)}
          role="tab"
          aria-selected={tab.id === activeTab}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function ActivityItem({ activity }) {
  return (
    <article className="mobile-activity-item">
      <span className="mobile-activity-item__icon" aria-hidden="true">
        {activity.icon}
      </span>
      <div>
        <p>{activity.text}</p>
        <time>{activity.time}</time>
      </div>
      <strong>{activity.points}</strong>
    </article>
  );
}

export function ProfilesPage({
  achievements,
  currentUserId,
  currentUserRole,
  onBackToOverview,
  onSelectProfile,
  onUpdateProfile,
  profileViewMode = 'overview',
  profiles,
  selectedProfile,
}) {
  const unlockedAchievements = getUnlockedAchievements(achievements ?? []);
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileEditorError, setProfileEditorError] = useState('');
  const [draft, setDraft] = useState(() => createProfileDraft(selectedProfile));
  const [profileSearchQuery, setProfileSearchQuery] = useState('');
  const [activeProfileTab, setActiveProfileTab] = useState('statistikk');
  const normalizedProfileSearchQuery = profileSearchQuery.trim().toLowerCase();
  const filteredProfiles = useMemo(() => {
    if (!normalizedProfileSearchQuery) {
      return profiles;
    }

    return profiles.filter((profile) => {
      const searchableValues = [profile.russName, profile.realName, profile.className];

      return searchableValues.some(
        (value) =>
          typeof value === 'string' &&
          value.toLowerCase().includes(normalizedProfileSearchQuery),
      );
    });
  }, [profiles, normalizedProfileSearchQuery]);

  if (!selectedProfile) {
    return (
      <SectionCard
        title="Profiler"
        description="Velg en bruker for å se hvilke knuter som ligger i profilen."
      >
        <p>Ingen profil valgt.</p>
      </SectionCard>
    );
  }

  const isOwnProfile = selectedProfile.id === currentUserId;
  const canEditProfile = isOwnProfile || currentUserRole === 'admin';
  const badgeCount = isOwnProfile ? unlockedAchievements.length : selectedProfile.knots.length;
  const showOverview = profileViewMode !== 'detail';
  const completedKnotCount = selectedProfile.knots.length;
  const recentKnots = selectedProfile.knots.slice(0, 3);
  const currentUserProfile =
    profiles.find((profile) => profile.id === currentUserId) ?? selectedProfile;
  const otherUserRailProfiles = [
    currentUserProfile,
    ...profiles.filter((profile) => profile.id !== currentUserId),
  ].slice(0, 8);
  const averagePoints =
    completedKnotCount > 0
      ? Math.round(Number(selectedProfile.points ?? 0) / completedKnotCount)
      : 0;
  const openKnotCount = Math.max(0, 180 - completedKnotCount);
  const memberDays = 12;
  const profileTabs = [
    { id: 'statistikk', label: 'Statistikk' },
    { id: 'historikk', label: 'Historikk' },
    { id: 'badges', label: 'Badges' },
    { id: 'info', label: 'Info' },
  ];
  const profileStats = [
    { icon: '🏆', label: 'Totalt poeng', value: `${selectedProfile.points}p` },
    { icon: '⌁', label: 'Gj.snitt per knute', value: `${averagePoints}p` },
    { icon: '🪢', label: 'Åpne knuter', value: openKnotCount },
    { icon: '✓', label: 'Fullførte knuter', value: completedKnotCount },
    { icon: '☆', label: 'Merker', value: badgeCount },
  ];
  const activityItems = [
    {
      icon: '🪢',
      text: `Fullførte knuten ${recentKnots[0]?.title ?? 'Russedressen'}`,
      time: 'I dag, 18:42',
      points: `+${recentKnots[0]?.points ?? 20}p`,
    },
    {
      icon: '⭐',
      text: 'Låste opp merket Morgenruss',
      time: 'I dag, 09:15',
      points: '+10p',
    },
    {
      icon: '🔥',
      text: 'Startet en ny streak',
      time: 'I går, 22:10',
      points: '+5p',
    },
  ];
  useEffect(() => {
    if (!showOverview || typeof window === 'undefined') {
      return;
    }

    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.scrollingElement?.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
    });
  }, [showOverview]);

  function handleOpenEditor() {
    if (!canEditProfile) {
      return;
    }

    setProfileEditorError('');
    setDraft(createProfileDraft(selectedProfile));
    setIsEditing(true);
  }

  function handleCloseEditor() {
    setProfileEditorError('');
    revokeLocalPreview(draft.photoUrl, selectedProfile.photoUrl ?? '');
    setDraft(createProfileDraft(selectedProfile));
    setIsEditing(false);
  }

  function handleFieldChange(field, value) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
  }

  function handlePhotoChange(event) {
    const file = event.target.files?.[0];

    if (!file || typeof URL === 'undefined') {
      return;
    }

    const nextPhotoUrl = URL.createObjectURL(file);

    setDraft((currentDraft) => {
      revokeLocalPreview(currentDraft.photoUrl, selectedProfile.photoUrl ?? '');

      return {
        ...currentDraft,
        photoUrl: nextPhotoUrl,
        photoFile: file,
        photoName: file.name,
      };
    });

    event.target.value = '';
  }

  async function handleSaveProfile() {
    if (isSavingProfile) {
      return;
    }

    setProfileEditorError('');
    setIsSavingProfile(true);

    try {
      await onUpdateProfile({
        ...draft,
        targetUserId: selectedProfile.id,
        russName: draft.russName.trim() || selectedProfile.russName,
        realName: draft.realName.trim() || selectedProfile.realName,
        className: draft.className.trim() || selectedProfile.className,
        bio: draft.bio.trim() || selectedProfile.bio,
        quote: draft.quote.trim() || 'Ingen sitat lagt til ennå.',
        knownFor: draft.knownFor.trim() || 'Ikke satt ennå.',
        signatureKnot:
          draft.signatureKnot.trim() || 'Ingen signaturknute valgt.',
        favoriteCategory: draft.favoriteCategory.trim() || 'Ikke valgt',
        russType: selectedProfile.russType ?? 'blue',
        genderIdentity: draft.genderIdentity ?? 'other',
        photoFile: draft.photoFile ?? null,
        photoName: draft.photoName ?? '',
      });
      setIsEditing(false);
    } catch (error) {
      setProfileEditorError(
        error instanceof Error ? error.message : 'Kunne ikke lagre profilen.',
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  const profileEditorModal =
    canEditProfile && isEditing ? (
      <div
        className="profile-modal-backdrop"
        role="presentation"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            handleCloseEditor();
          }
        }}
      >
        <div
          className="profile-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-modal-title"
          data-swipe-lock="true"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="profile-modal__header">
            <div>
              <p className="eyebrow">Rediger profil</p>
              <h3 id="profile-modal-title">Oppdater russeprofilen din</h3>
            </div>
            <button
              type="button"
              className="action-button action-button--ghost action-button--compact"
              onClick={handleCloseEditor}
            >
              Lukk
            </button>
          </div>

          <div className="profile-modal__body">
            <div className="profile-modal__preview">
              <ProfilePhoto profile={draft} size="large" />
              <label className="field-group">
                <span>Profilbilde</span>
                <input type="file" accept="image/*" onChange={handlePhotoChange} />
              </label>
            </div>

            <div className="profile-editor-grid">
              <label className="field-group">
                <span>Russenavn</span>
                <input
                  type="text"
                  className="text-input"
                  value={draft.russName}
                  onChange={(event) =>
                    handleFieldChange('russName', event.target.value)
                  }
                />
              </label>

              <label className="field-group">
                <span>Ekte navn</span>
                <input
                  type="text"
                  className="text-input"
                  value={draft.realName}
                  onChange={(event) =>
                    handleFieldChange('realName', event.target.value)
                  }
                />
              </label>

              <label className="field-group field-group--small">
                <span>Klasse</span>
                <input
                  type="text"
                  className="text-input"
                  value={draft.className}
                  onChange={(event) =>
                    handleFieldChange('className', event.target.value)
                  }
                />
              </label>

              <label className="field-group field-group--small">
                <span>Kjønnsidentitet</span>
                <select
                  className="text-input"
                  value={draft.genderIdentity}
                  onChange={(event) =>
                    handleFieldChange('genderIdentity', event.target.value)
                  }
                >
                  <option value="girl">Jente</option>
                  <option value="boy">Gutt</option>
                  <option value="other">Annet</option>
                </select>
              </label>

              <label className="field-group">
                <span>Quote</span>
                <input
                  type="text"
                  className="text-input"
                  value={draft.quote}
                  onChange={(event) =>
                    handleFieldChange('quote', event.target.value)
                  }
                />
              </label>

              <label className="field-group">
                <span>Signaturknute</span>
                <input
                  type="text"
                  className="text-input"
                  value={draft.signatureKnot}
                  onChange={(event) =>
                    handleFieldChange('signatureKnot', event.target.value)
                  }
                />
              </label>

            </div>
          </div>

          {profileEditorError ? (
            <p className="profile-knot-feedback profile-knot-feedback--error">
              {profileEditorError}
            </p>
          ) : null}

          <div className="profile-modal__actions">
            <button
              type="button"
              className="action-button action-button--ghost"
              onClick={handleCloseEditor}
              disabled={isSavingProfile}
            >
              Avbryt
            </button>
            <button
              type="button"
              className="action-button"
              onClick={handleSaveProfile}
              disabled={isSavingProfile}
            >
              {isSavingProfile ? 'Lagrer...' : 'Lagre profil'}
            </button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      {showOverview ? (
        <SectionCard
          title="Alle profiler"
          description="Trykk på en profil for å åpne en egen profilside med full oversikt."
        >
          <button
            type="button"
            className="profile-own-return-card"
            onClick={() => onSelectProfile(currentUserId)}
          >
            <span>Min profil</span>
            <span className="profile-own-return-card__arrow">→</span>
          </button>

          <div className="profile-search-box">
            <label htmlFor="profile-search" className="profile-search-box__label">
              Finn bruker
            </label>
            <input
              id="profile-search"
              type="search"
              className="text-input profile-search-box__input"
              placeholder="Søk på russenavn, navn eller klasse"
              value={profileSearchQuery}
              onChange={(event) => setProfileSearchQuery(event.target.value)}
              autoComplete="off"
            />
            {normalizedProfileSearchQuery ? (
              <p className="profile-search-box__meta">
                {filteredProfiles.length} treff
              </p>
            ) : null}
          </div>

          <div className="profile-selector-list profile-selector-list--overview">
            {filteredProfiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                className={`profile-selector profile-selector--social ${
                  selectedProfile.id === profile.id ? 'is-active' : ''
                }`}
                onClick={() => onSelectProfile(profile.id)}
              >
                <div className="profile-selector__top">
                  <ProfilePhoto profile={profile} size="small" />
                  <div className="profile-selector__identity">
                    <strong>{profile.russName}</strong>
                    <span>{profile.realName}</span>
                    <span className="pill pill--rank">
                      {profile.leaderboardTitle}
                    </span>
                  </div>
                  <span className="profile-class-badge">{profile.className}</span>
                </div>
                <p>{profile.quote}</p>
              </button>
            ))}
          </div>
          {filteredProfiles.length === 0 ? (
            <p className="profile-search-box__empty">
              Ingen brukere matcher søket ditt ennå.
            </p>
          ) : null}
        </SectionCard>
      ) : (
        <main className="mobile-profile-screen" aria-label="Min profil">
          <header className="mobile-profile-header">
            <button type="button" onClick={onBackToOverview} aria-label="Tilbake">
              ←
            </button>
            <h1>Min profil</h1>
            <button
              type="button"
              onClick={canEditProfile ? handleOpenEditor : undefined}
              aria-label="Innstillinger"
              disabled={!canEditProfile}
            >
              ⚙
            </button>
          </header>

          <ProfileCard
            canEdit={canEditProfile}
            onEdit={handleOpenEditor}
            profile={selectedProfile}
            roleLabel={currentUserRole === 'admin' && isOwnProfile ? 'Admin' : 'Russ'}
          />

          <ScoreRankingCard profile={selectedProfile} totalUsers={profiles.length || 180} />

          <section className="mobile-quick-stats" aria-label="Rask statistikk">
            <StatCard icon="🔥" label="Streak" value="1" />
            <StatCard icon="🪢" label="Fullførte knuter" value={completedKnotCount} />
            <StatCard icon="⭐" label="Merker" value={badgeCount} />
            <StatCard icon="📅" label="Dager medlem" value={memberDays} />
          </section>

          <section className="mobile-tab-card">
            <Tabs
              activeTab={activeProfileTab}
              onChange={setActiveProfileTab}
              tabs={profileTabs}
            />

            {activeProfileTab === 'statistikk' ? (
              <div className="mobile-stat-list">
                {profileStats.map((stat) => (
                  <div key={stat.label} className="mobile-stat-row">
                    <span aria-hidden="true">{stat.icon}</span>
                    <p>{stat.label}</p>
                    <strong>{stat.value}</strong>
                  </div>
                ))}
              </div>
            ) : null}

            {activeProfileTab === 'historikk' ? (
              <div className="mobile-activity-list">
                {activityItems.map((activity) => (
                  <ActivityItem key={`${activity.text}-${activity.time}`} activity={activity} />
                ))}
                <button type="button" className="mobile-history-button">
                  Se all historikk <span aria-hidden="true">›</span>
                </button>
              </div>
            ) : null}

            {activeProfileTab === 'badges' ? (
              <div className="mobile-empty-tab">
                <strong>{badgeCount} merker</strong>
                <p>Merkene dine vises her når du låser opp flere.</p>
              </div>
            ) : null}

            {activeProfileTab === 'info' ? (
              <div className="mobile-empty-tab">
                <strong>{selectedProfile.knownFor}</strong>
                <p>{selectedProfile.bio}</p>
              </div>
            ) : null}
          </section>

          <section className="mobile-other-users">
            <div className="mobile-other-users__header">
              <h2>Andre på appen</h2>
              <button type="button" onClick={onBackToOverview}>Se alle</button>
            </div>
            <div
              className="mobile-other-users__rail"
              aria-label="Andre profiler"
              data-swipe-lock="true"
            >
              {otherUserRailProfiles
                .filter(Boolean)
                .map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    className={`mobile-user-pill ${profile.id === currentUserId ? 'is-current' : ''}`}
                    onClick={() => onSelectProfile(profile.id)}
                  >
                    <UserAvatar profile={profile} size="sm" />
                    <span>{profile.id === currentUserId ? 'Deg' : profile.russName}</span>
                    <strong>#{profile.rank}</strong>
                  </button>
                ))}
            </div>
          </section>
        </main>
      )}

      {typeof document !== 'undefined'
        ? createPortal(profileEditorModal, document.body)
        : profileEditorModal}
    </>
  );
}

