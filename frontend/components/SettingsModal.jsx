import { useState } from 'react';
import { createPortal } from 'react-dom';
import { TermsModal } from './TermsModal.jsx';

export function SettingsModal({
  appVersion,
  currentUser,
  isDark,
  isChangingPassword,
  isDeletingAccount,
  isOpen,
  onChangePasswordField,
  onClose,
  onDeleteAccount,
  onLogout,
  onNavigateToFeed,
  onNavigateToKnots,
  onNavigateToProfile,
  onOpenProfileEditor,
  onRestartTour,
  onRunTest,
  onSubmitPasswordChange,
  onToggleDark,
  onToggleSounds,
  passwordError,
  passwordForm,
  soundsMuted = false,
}) {
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  const roleLabel = currentUser?.role === 'admin' ? 'Admin' : 'Bruker';
  const email = currentUser?.email?.trim() ? currentUser.email : 'Ikke tilgjengelig';

  function handleDeleteRequest() {
    if (typeof onDeleteAccount !== 'function') return;
    onDeleteAccount();
  }

  return (
    <>
      {createPortal(
        <div
          className="settings-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              onClose();
            }
          }}
        >
          <div
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-modal-title"
            data-swipe-lock="true"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="settings-modal__header">
              <div>
                <p className="eyebrow">Innstillinger</p>
                <h3 id="settings-modal-title">Konto og personvern</h3>
              </div>
              <button
                type="button"
                className="action-button action-button--ghost action-button--compact"
                onClick={onClose}
              >
                Lukk
              </button>
            </div>

            <div className="settings-modal__body">
              <section className="settings-section">
                <div className="settings-section__header">
                  <h4>Konto</h4>
                  <p>Se kontoinfo og oppdater passordet ditt.</p>
                </div>

                <div className="settings-account-grid">
                  <label className="field-group">
                    <span>E-post</span>
                    <input type="text" className="text-input" value={email} readOnly disabled />
                  </label>
                  <label className="field-group">
                    <span>Rolle</span>
                    <input type="text" className="text-input" value={roleLabel} readOnly disabled />
                  </label>
                </div>

                <form className="settings-password-form" onSubmit={onSubmitPasswordChange}>
                  <label className="field-group">
                    <span>Nåværende passord</span>
                    <input
                      type="password"
                      className="text-input"
                      value={passwordForm.currentPassword}
                      autoComplete="current-password"
                      onChange={(event) =>
                        onChangePasswordField('currentPassword', event.target.value)
                      }
                    />
                  </label>
                  <label className="field-group">
                    <span>Nytt passord</span>
                    <input
                      type="password"
                      className="text-input"
                      value={passwordForm.newPassword}
                      autoComplete="new-password"
                      onChange={(event) => onChangePasswordField('newPassword', event.target.value)}
                    />
                  </label>
                  <label className="field-group">
                    <span>Bekreft nytt passord</span>
                    <input
                      type="password"
                      className="text-input"
                      value={passwordForm.confirmPassword}
                      autoComplete="new-password"
                      onChange={(event) =>
                        onChangePasswordField('confirmPassword', event.target.value)
                      }
                    />
                  </label>
                  {passwordError ? (
                    <p className="form-feedback form-feedback--error">{passwordError}</p>
                  ) : null}
                  <button type="submit" className="action-button" disabled={isChangingPassword}>
                    {isChangingPassword ? 'Oppdaterer...' : 'Bytt passord'}
                  </button>
                </form>
              </section>

              <section className="settings-section">
                <div className="settings-section__header">
                  <h4>Min profil</h4>
                  <p>
                    Stemmer ikke navnet ditt? Du kan rette navn, klasse, bilde og bio
                    selv her.
                  </p>
                </div>
                <div className="settings-shortcuts">
                  <button
                    type="button"
                    className="action-button"
                    onClick={onOpenProfileEditor}
                  >
                    Rediger min profil
                  </button>
                </div>
              </section>

              <section className="settings-section">
                <div className="settings-section__header">
                  <h4>Personvern</h4>
                  <p>Innstillinger for innsyn og posting ligger i eksisterende sider.</p>
                </div>
                <div className="settings-shortcuts">
                  <button type="button" className="action-button action-button--ghost" onClick={onNavigateToKnots}>
                    Åpne Knuter
                  </button>
                  <button
                    type="button"
                    className="action-button action-button--ghost"
                    onClick={onNavigateToProfile}
                  >
                    Åpne Profil
                  </button>
                  <button type="button" className="action-button action-button--ghost" onClick={onNavigateToFeed}>
                    Åpne Feed
                  </button>
                </div>
                <p className="settings-hint">
                  Du styrer deling per innsending i Knuter, og synlighet per godkjent knute inne på
                  Profil.
                </p>
              </section>

              <section className="settings-section">
                <div className="settings-section__header">
                  <h4>Brukervilkår og personvern</h4>
                  <p>Les vilkårene du godtok ved registrering.</p>
                </div>
                <div className="settings-shortcuts">
                  <button
                    type="button"
                    className="action-button action-button--ghost"
                    onClick={() => setIsTermsOpen(true)}
                  >
                    Les brukervilkår
                  </button>
                </div>
              </section>

              <section className="settings-section">
                <div className="settings-section__header">
                  <h4>Utseende</h4>
                </div>
                <div className="settings-shortcuts">
                  <button
                    type="button"
                    className="action-button action-button--ghost"
                    onClick={onToggleDark}
                  >
                    {isDark ? '☀ Lys modus' : '☾ Mørk modus'}
                  </button>
                  {typeof onToggleSounds === 'function' ? (
                    <button
                      type="button"
                      className="action-button action-button--ghost"
                      onClick={onToggleSounds}
                      aria-pressed={!soundsMuted}
                    >
                      {soundsMuted ? '🔇 Lyd-effekter: av' : '🔊 Lyd-effekter: på'}
                    </button>
                  ) : null}
                </div>
              </section>

              {typeof onRunTest === 'function' ? (
                <section className="settings-section">
                  <div className="settings-section__header">
                    <h4>🧪 Test agent-funksjoner</h4>
                    <p>
                      Trigg de små animasjonene og lydene agenten la inn — uten å
                      måtte fremprovosere dem naturlig.
                    </p>
                  </div>
                  <div className="settings-shortcuts">
                    <button type="button" className="action-button action-button--ghost" onClick={() => onRunTest('confetti')}>
                      🎉 Confetti
                    </button>
                    <button type="button" className="action-button action-button--ghost" onClick={() => onRunTest('achievement')}>
                      🏆 Achievement
                    </button>
                    <button type="button" className="action-button action-button--ghost" onClick={() => onRunTest('rank-up')}>
                      🚀 Rank-up toast
                    </button>
                    <button type="button" className="action-button action-button--ghost" onClick={() => onRunTest('toast-success')}>
                      ✓ Toast (success)
                    </button>
                    <button type="button" className="action-button action-button--ghost" onClick={() => onRunTest('toast-error')}>
                      ! Toast (error)
                    </button>
                    <button type="button" className="action-button action-button--ghost" onClick={() => onRunTest('toast-info')}>
                      • Toast (info)
                    </button>
                    <button type="button" className="action-button action-button--ghost" onClick={() => onRunTest('sound-ding')}>
                      🔔 Lyd: ding
                    </button>
                    <button type="button" className="action-button action-button--ghost" onClick={() => onRunTest('sound-swoosh')}>
                      💨 Lyd: swoosh
                    </button>
                    <button type="button" className="action-button action-button--ghost" onClick={() => onRunTest('sound-tick')}>
                      · Lyd: tick
                    </button>
                  </div>
                  <p className="settings-hint">
                    Andre småting (heart-pop, long-press reactions, idle-wobble,
                    pull-to-refresh, photo zoom) trigges naturlig i feeden — stå
                    stille i 30s for wobble, dra ned i feeden for refresh, hold
                    inne en kommentar for reactions.
                  </p>
                </section>
              ) : null}

              <section className="settings-section settings-section--danger">
                <div className="settings-section__header">
                  <h4>Slett konto</h4>
                  <p>
                    Sletter kontoen din permanent. All persondata og innhold du har publisert
                    blir fjernet. Dette kan ikke angres.
                  </p>
                </div>
                {isConfirmingDelete ? (
                  <div className="settings-shortcuts">
                    <button
                      type="button"
                      className="action-button action-button--danger"
                      onClick={handleDeleteRequest}
                      disabled={isDeletingAccount}
                    >
                      {isDeletingAccount ? 'Sletter...' : 'Ja, slett kontoen min'}
                    </button>
                    <button
                      type="button"
                      className="action-button action-button--ghost"
                      onClick={() => setIsConfirmingDelete(false)}
                      disabled={isDeletingAccount}
                    >
                      Avbryt
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="action-button action-button--ghost action-button--danger-outline"
                    onClick={() => setIsConfirmingDelete(true)}
                  >
                    Slett konto
                  </button>
                )}
              </section>

              <section className="settings-section">
                <div className="settings-section__header">
                  <h4>Om og hjelp</h4>
                </div>
                {typeof onRestartTour === 'function' ? (
                  <div className="settings-shortcuts">
                    <button
                      type="button"
                      className="action-button action-button--ghost"
                      onClick={onRestartTour}
                    >
                      Vis intro-tour på nytt
                    </button>
                  </div>
                ) : null}
                <p className="settings-meta">Versjon: {appVersion}</p>
                <p className="settings-hint">
                  Trenger du hjelp med konto eller moderering, kontakt admin for kullet ditt.
                </p>
              </section>
            </div>

            <div className="settings-modal__footer">
              <button type="button" className="action-button action-button--ghost" onClick={onLogout}>
                Logg ut
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
      <TermsModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} />
    </>
  );
}
