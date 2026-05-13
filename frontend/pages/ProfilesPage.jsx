import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { SectionCard } from '../components/SectionCard.jsx';

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
          <h2>{profile.russName ?? profile.realName ?? 'Russ'}</h2>
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

export function ProfilesPage({
  currentUserId,
  currentUserRole,
  onBackToOverview,
  onSelectProfile,
  onUpdateProfile,
  profileViewMode = 'overview',
  profiles,
  selectedProfile,
  submissions = [],
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileEditorError, setProfileEditorError] = useState('');
  const [draft, setDraft] = useState(() => createProfileDraft(selectedProfile));
  const [profileSearchQuery, setProfileSearchQuery] = useState('');
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
  const feedPostCount = useMemo(() => {
    if (!Array.isArray(submissions) || !selectedProfile?.id) return 0;
    const profileIdKey = String(selectedProfile.id);
    return submissions.filter(
      (submission) =>
        String(submission.studentId) === profileIdKey
        && submission.status === 'Godkjent'
        && !submission.isAnonymous,
    ).length;
  }, [submissions, selectedProfile?.id]);

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
  const showOverview = profileViewMode !== 'detail';
  const completedKnotCount = selectedProfile.knots.length;
  const currentUserProfile =
    profiles.find((profile) => profile.id === currentUserId) ?? selectedProfile;
  const otherUserRailProfiles = [
    currentUserProfile,
    ...profiles.filter((profile) => profile.id !== currentUserId),
  ].slice(0, 8);
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
                    <strong>{profile.russName ?? profile.realName ?? 'Russ'}</strong>
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
            <span aria-hidden="true" />
          </header>

          <ProfileCard
            canEdit={canEditProfile}
            onEdit={handleOpenEditor}
            profile={selectedProfile}
            roleLabel={currentUserRole === 'admin' && isOwnProfile ? 'Admin' : 'Russ'}
          />

          <section className="mobile-stat-list" aria-label="Statistikk">
            <div className="mobile-stat-row">
              <span aria-hidden="true">🪢</span>
              <p>Fullførte knuter</p>
              <strong>{completedKnotCount}</strong>
            </div>
            <div className="mobile-stat-row">
              <span aria-hidden="true">📣</span>
              <p>Knuter postet i feed</p>
              <strong>{feedPostCount}</strong>
            </div>
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

