import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { SectionCard } from '../components/SectionCard.jsx';
import {
  buildProfileAchievements,
  getUnlockedAchievements,
} from '../data/badgeSystem.js';
import { BadgeGrid } from '../components/BadgeMedallion.jsx';

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
    return (
      <div className={`profile-photo profile-photo--${size}`}>
        <img
          src={profile.photoUrl}
          alt={`${profile.russName ?? profile.realName ?? 'Profil'} profilbilde`}
        />
      </div>
    );
  }

  return (
    <div
      className={`profile-avatar profile-avatar--${
        size === 'large' ? 'large' : 'small'
      }`}
    >
      {profile?.icon}
    </div>
  );
}

export function ProfilesPage({
  achievements,
  currentUserId,
  currentUserRole,
  editRequest = 0,
  knots,
  onBackToOverview,
  onDeleteSubmission,
  onSelectProfile,
  onSetKnotVisibility,
  onUpdateProfile,
  profileViewMode = 'overview',
  profiles,
  selectedProfile,
}) {
  const unlockedAchievements = getUnlockedAchievements(achievements ?? []);
  const profileAchievements = buildProfileAchievements(selectedProfile, {
    allKnots: knots,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileEditorError, setProfileEditorError] = useState('');
  const [draft, setDraft] = useState(() => createProfileDraft(selectedProfile));
  const [deletingSubmissionId, setDeletingSubmissionId] = useState('');
  const [togglingKnotId, setTogglingKnotId] = useState('');
  const [profileSearchQuery, setProfileSearchQuery] = useState('');
  const [knotFeedbackMessage, setKnotFeedbackMessage] = useState({
    type: '',
    text: '',
  });
  const normalizedProfileSearchQuery = profileSearchQuery.trim().toLowerCase();

  // Når innstillinger ber om å åpne editoren (via editRequest-tellern),
  // åpnes editor-modalen automatisk hvis brukeren ser sin egen profil.
  useEffect(() => {
    if (!editRequest) return;
    if (!selectedProfile) return;
    const ownsProfile = selectedProfile.id === currentUserId;
    const canEdit = ownsProfile || currentUserRole === 'admin';
    if (!canEdit) return;
    setProfileEditorError('');
    setDraft(createProfileDraft(selectedProfile));
    setIsEditing(true);
  }, [editRequest, selectedProfile, currentUserId, currentUserRole]);

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

  function canDeleteKnotFeedPost(knot) {
    if (!isOwnProfile || !knot?.submissionId || knot?.source !== 'submission') {
      return false;
    }

    return (
      knot.submissionMode === 'feed' || knot.submissionMode === 'anonymous-feed'
    );
  }

  async function handleDeleteFeedPost(knot) {
    if (!canDeleteKnotFeedPost(knot) || !onDeleteSubmission) {
      return;
    }

    const shouldDelete =
      typeof window === 'undefined'
        ? true
        : window.confirm(
            'Vil du fjerne denne posten fra feeden? Knuten forblir godkjent.',
          );

    if (!shouldDelete) {
      return;
    }

    setKnotFeedbackMessage({ type: '', text: '' });
    setDeletingSubmissionId(knot.submissionId);

    try {
      await onDeleteSubmission(knot.submissionId);
      setKnotFeedbackMessage({
        type: 'success',
        text: 'Posten er fjernet fra feeden. Godkjenningen er beholdt.',
      });
    } catch (error) {
      setKnotFeedbackMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Kunne ikke fjerne posten fra feeden.',
      });
    } finally {
      setDeletingSubmissionId('');
    }
  }

  async function handleToggleKnotVisibility(knot) {
    if (!knot.submissionId || !onSetKnotVisibility) {
      return;
    }

    setTogglingKnotId(knot.submissionId);

    try {
      await onSetKnotVisibility(knot.submissionId, !knot.profileHidden);
    } catch (error) {
      setKnotFeedbackMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Kunne ikke endre synlighet akkurat nå.',
      });
    } finally {
      setTogglingKnotId('');
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
                <span>Kjent for</span>
                <input
                  type="text"
                  className="text-input"
                  value={draft.knownFor}
                  onChange={(event) =>
                    handleFieldChange('knownFor', event.target.value)
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

              <label className="field-group">
                <span>Favorittkategori</span>
                <input
                  type="text"
                  className="text-input"
                  value={draft.favoriteCategory}
                  onChange={(event) =>
                    handleFieldChange('favoriteCategory', event.target.value)
                  }
                />
              </label>

              <label className="field-group profile-editor-grid__bio">
                <span>Bio</span>
                <textarea
                  className="text-input text-input--area"
                  value={draft.bio}
                  onChange={(event) =>
                    handleFieldChange('bio', event.target.value)
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
          title="Profiler"
          description="Trykk på en profil for å åpne en egen profilside med full oversikt."
        >
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
        <div className="stack-layout">
          <div className="profile-detail-topbar">
            <button
              type="button"
              className="action-button action-button--ghost action-button--compact profile-back-button"
              onClick={onBackToOverview}
            >
              ← Tilbake
            </button>
          </div>

          <SectionCard
            title={isOwnProfile ? 'Min russeprofil' : `Profil: ${selectedProfile.russName}`}
            description="Her ser du status, merker og identitet i en rolig og tydelig visning."
          >
            <div className="profile-showcase">
              <div className="profile-cover">
                <div className="profile-cover__content">
                  <ProfilePhoto profile={selectedProfile} size="large" />

                  <div className="profile-identity">
                  <div className="profile-identity__meta">
                    <span className="profile-class-badge">
                      {selectedProfile.className}
                    </span>
                    <span className="pill pill--soft">
                      {selectedProfile.russType === 'red' ? 'Rødruss' : 'Blåruss'}
                    </span>
                    <span className="pill pill--rank">
                      {selectedProfile.leaderboardTitle}
                    </span>
                      {isOwnProfile ? (
                        <span className="pill pill--success">Min profil</span>
                      ) : null}
                    </div>
                    <h3 className="profile-russ-name">{selectedProfile.russName}</h3>
                    <p className="profile-real-name">{selectedProfile.realName}</p>
                    <p className="profile-bio-copy">{selectedProfile.bio}</p>
                    <p className="profile-quote">"{selectedProfile.quote}"</p>
                    {isOwnProfile && !isEditing ? (
                      <p className="profile-self-hint">
                        Stemmer ikke navnet ditt? Trykk{' '}
                        <button
                          type="button"
                          className="profile-self-hint__link"
                          onClick={handleOpenEditor}
                        >
                          Rediger profil
                        </button>{' '}
                        for å fikse det.
                      </p>
                    ) : null}
                  </div>

                  {canEditProfile ? (
                    <button
                      type="button"
                      className="action-button profile-editor-trigger"
                      onClick={handleOpenEditor}
                    >
                      Rediger profil
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="profile-summary profile-summary--social">
                <article className="stat-card">
                  <span>Poeng</span>
                  <strong>{selectedProfile.points}</strong>
                  <p>Oppdatert fra leaderboard</p>
                </article>
                <article className="stat-card">
                  <span>Plassering</span>
                  <strong>#{selectedProfile.rank}</strong>
                  <p>Basert på poeng i appen</p>
                </article>
                <article className="stat-card">
                  <span>{isOwnProfile ? 'Badges' : 'Knuter'}</span>
                  <strong>{badgeCount}</strong>
                  <p>{isOwnProfile ? 'Last opp så langt' : 'Synlige i profilen'}</p>
                </article>
              </div>

              <div className="profile-social-grid">
                <article className="profile-detail-card">
                  <span>Kjent for</span>
                  <strong>{selectedProfile.knownFor}</strong>
                </article>
                <article className="profile-detail-card">
                  <span>Signaturknute</span>
                  <strong>{selectedProfile.signatureKnot}</strong>
                </article>
                <article className="profile-detail-card">
                  <span>Favorittkategori</span>
                  <strong>{selectedProfile.favoriteCategory}</strong>
                </article>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Merker"
            description={
              isOwnProfile
                ? 'Alle merker du jobber mot — tier-system fra bronse til diamant.'
                : `Merkesamlingen til ${selectedProfile.russName}.`
            }
          >
            <BadgeGrid achievements={profileAchievements} size="md" />
          </SectionCard>

          <SectionCard
            title="Det som allerede er tatt"
            description={
              isOwnProfile
                ? 'Velg hvilke knuter som skal synes for andre på profilen din.'
                : 'Godkjente knuter som er synlige på profilen.'
            }
          >
            <div className="profile-knot-list">
              {knotFeedbackMessage.text ? (
                <p
                  className={`profile-knot-feedback ${
                    knotFeedbackMessage.type === 'error'
                      ? 'profile-knot-feedback--error'
                      : ''
                  }`}
                >
                  {knotFeedbackMessage.text}
                </p>
              ) : null}
              {selectedProfile.knots.length > 0 ? (
                selectedProfile.knots.map((knot) => (
                  <article key={knot.id} className="profile-knot-row">
                    <div>
                      <h3>{knot.title}</h3>
                      <p>
                        {knot.category} | {knot.completedAt}
                      </p>
                    </div>
                    <div className="profile-knot-row__actions">
                      <strong>{knot.points} poeng</strong>
                      {isOwnProfile && knot.source === 'submission' ? (
                        <button
                          type="button"
                          className="action-button action-button--compact action-button--ghost"
                          onClick={() => handleToggleKnotVisibility(knot)}
                          disabled={togglingKnotId === knot.submissionId}
                          title={knot.profileHidden ? 'Vis på profil' : 'Skjul fra profil'}
                        >
                          {togglingKnotId === knot.submissionId
                            ? '...'
                            : knot.profileHidden
                            ? '👁 Vis'
                            : '🙈 Skjul'}
                        </button>
                      ) : null}
                      {canDeleteKnotFeedPost(knot) ? (
                        <button
                          type="button"
                          className="action-button action-button--compact profile-delete-button"
                          onClick={() => handleDeleteFeedPost(knot)}
                          disabled={deletingSubmissionId === knot.submissionId}
                        >
                          {deletingSubmissionId === knot.submissionId
                            ? 'Fjerner...'
                            : 'Slett fra feed'}
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))
              ) : (
                <p className="folder-empty">
                  Ingen godkjente knuter er lagt inn på denne profilen ennå.
                </p>
              )}
            </div>
          </SectionCard>
        </div>
      )}

      {typeof document !== 'undefined'
        ? createPortal(profileEditorModal, document.body)
        : profileEditorModal}
    </>
  );
}



