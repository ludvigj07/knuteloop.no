import { createPortal } from 'react-dom';

export function SettingsModal({
  appVersion,
  currentUser,
  isChangingPassword,
  isOpen,
  onChangePasswordField,
  onClose,
  onLogout,
  onNavigateToFeed,
  onNavigateToKnots,
  onNavigateToProfile,
  onSubmitPasswordChange,
  passwordError,
  passwordForm,
}) {
  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  const roleLabel = currentUser?.role === 'admin' ? 'Admin' : 'Bruker';
  const email = currentUser?.email?.trim() ? currentUser.email : 'Ikke tilgjengelig';

  return createPortal(
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
              <h4>Om og hjelp</h4>
            </div>
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
  );
}
