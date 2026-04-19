import { useState } from 'react';

const SESSION_TOKEN_KEY = 'russ-session-token';

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'Noe gikk galt.');
  }
  return data;
}

function readInviteParams() {
  if (typeof window === 'undefined') return { email: '', code: '' };
  const params = new URLSearchParams(window.location.search);
  return {
    email: params.get('email') ?? '',
    code: (params.get('code') ?? '').toUpperCase(),
  };
}

export function InvitePage() {
  const initial = readInviteParams();
  const [step, setStep] = useState('verify');
  const [email, setEmail] = useState(initial.email);
  const [code, setCode] = useState(initial.code);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [claimToken, setClaimToken] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onVerify(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await postJson('/api/auth/invite/verify', {
        email: email.trim(),
        code: code.trim(),
      });
      setClaimToken(data.claimToken);
      setDisplayName(data.user?.name ?? '');
      setStep('password');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onActivate(event) {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Passordet må være minst 8 tegn.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Passordene er ikke like.');
      return;
    }
    setBusy(true);
    try {
      const data = await postJson('/api/auth/invite/activate', {
        claimToken,
        password,
      });
      try {
        window.localStorage.setItem(SESSION_TOKEN_KEY, data.token);
      } catch {}
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="login-shell">
        <section className="login-card">
          <p className="eyebrow">Ferdig</p>
          <h1>Kontoen er klar, {displayName || 'russ'}!</h1>
          <p className="login-copy">Du er nå logget inn. Gå til appen for å starte.</p>
          <button
            type="button"
            className="action-button"
            onClick={() => {
              window.location.assign('/');
            }}
          >
            Åpne appen
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="login-shell">
      <section className="login-card">
        <p className="eyebrow">Invitasjon</p>
        <h1>{step === 'verify' ? 'Aktivér russeknute-kontoen din' : `Velkommen${displayName ? `, ${displayName}` : ''}!`}</h1>
        <p className="login-copy">
          {step === 'verify'
            ? 'Skriv inn e-posten din og koden du fikk av admin.'
            : 'Velg et passord du vil huske. Passordet kan bare endres av admin senere.'}
        </p>

        {step === 'verify' ? (
          <form className="login-form" onSubmit={onVerify}>
            <label className="field-group">
              <span>E-post</span>
              <input
                type="email"
                className="text-input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label className="field-group">
              <span>Invitasjonskode</span>
              <input
                type="text"
                className="text-input"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="F.eks. K7M2-QX9N"
                autoComplete="one-time-code"
                required
              />
            </label>
            {error ? <p className="form-feedback form-feedback--error">{error}</p> : null}
            <button type="submit" className="action-button" disabled={busy}>
              {busy ? 'Sjekker...' : 'Fortsett'}
            </button>
          </form>
        ) : (
          <form className="login-form" onSubmit={onActivate}>
            <label className="field-group">
              <span>Nytt passord</span>
              <input
                type="password"
                className="text-input"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            <label className="field-group">
              <span>Gjenta passordet</span>
              <input
                type="password"
                className="text-input"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            {error ? <p className="form-feedback form-feedback--error">{error}</p> : null}
            <button type="submit" className="action-button" disabled={busy}>
              {busy ? 'Lagrer...' : 'Sett passord og logg inn'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
