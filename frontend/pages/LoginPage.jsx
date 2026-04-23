export function LoginPage({
  email,
  password,
  error,
  notice,
  isSubmitting,
  onChangeEmail,
  onChangePassword,
  onSubmit,
}) {
  return (
    <div className="login-shell">
      <section className="login-card">
        <p className="eyebrow">Logg inn</p>
        <h1>Velkommen til russeknute-appen</h1>
        <p className="login-copy">
          Logg inn med e-posten og passordet ditt. Har du fått en invitasjon
          fra admin, aktivér kontoen via lenken i e-posten først.
        </p>

        <form
          className="login-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label className="field-group">
            <span>E-post</span>
            <input
              type="email"
              className="text-input"
              value={email}
              onChange={(event) => onChangeEmail(event.target.value)}
              placeholder="din@skole.no"
              autoComplete="email"
              required
            />
          </label>

          <label className="field-group">
            <span>Passord</span>
            <input
              type="password"
              className="text-input"
              value={password}
              onChange={(event) => onChangePassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error ? <p className="form-feedback form-feedback--error">{error}</p> : null}
          {!error && notice ? <p className="login-notice">{notice}</p> : null}

          <button type="submit" className="action-button" disabled={isSubmitting}>
            {isSubmitting ? 'Logger inn...' : 'Logg inn'}
          </button>
        </form>

        <p className="login-copy" style={{ marginTop: '1.5rem', fontSize: '0.9rem' }}>
          Har du fått invitasjonskode? <a href="/invite">Aktivér kontoen din her.</a>
        </p>
      </section>
    </div>
  );
}
