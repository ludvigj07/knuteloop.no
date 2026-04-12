export function LoginPage({
  code,
  error,
  isSubmitting,
  onChangeCode,
  onSubmit,
  pilotUsers = [],
}) {
  return (
    <div className="login-shell">
      <section className="login-card">
        <p className="eyebrow">Pilot login</p>
        <h1>Logg inn på russeknute-appen</h1>
        <p className="login-copy">
          Dette er første versjon med lagret data. Logg inn med en enkel kode
          fra admin for å komme inn på din bruker.
        </p>

        <form
          className="login-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label className="field-group">
            <span>Innloggingskode</span>
            <input
              type="text"
              className="text-input"
              value={code}
              onChange={(event) => onChangeCode(event.target.value)}
              placeholder="Skriv inn koden din"
              autoComplete="off"
            />
          </label>

          {error ? <p className="form-feedback form-feedback--error">{error}</p> : null}

          <button type="submit" className="action-button" disabled={isSubmitting}>
            {isSubmitting ? 'Logger inn...' : 'Logg inn'}
          </button>
        </form>
      </section>

      <section className="login-card login-card--secondary">
        <h2>Pilotbrukere</h2>
        <p className="login-copy">
          Disse seed-brukerne ligger inne for testing av den ekte dataflyten.
        </p>

        <div className="login-user-list">
          {pilotUsers.map((user) => (
            <button
              key={user.id}
              type="button"
              className="profile-selector"
              onClick={() => onChangeCode(user.code)}
            >
              <div className="profile-selector__identity">
                <strong>{user.russName}</strong>
                <span>
                  {user.name} | {user.className}
                </span>
              </div>
              <span className="pill pill--rank">{user.code}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}


