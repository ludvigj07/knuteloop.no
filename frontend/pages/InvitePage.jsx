import { useState } from 'react';
import { TermsModal } from '../components/TermsModal.jsx';
import {
  TERMS_CLAUSES,
  TERMS_VERSION,
} from '../data/termsContent.js';

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

function createInitialAcceptances() {
  return TERMS_CLAUSES.reduce((acc, clause) => {
    acc[clause.id] = false;
    return acc;
  }, {});
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

  const [acceptances, setAcceptances] = useState(createInitialAcceptances);
  const [acceptedAt, setAcceptedAt] = useState('');
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);

  const allAccepted = TERMS_CLAUSES.every((clause) => acceptances[clause.id]);

  function setClauseAccepted(clauseId, checked) {
    setAcceptances((prev) => ({ ...prev, [clauseId]: Boolean(checked) }));
  }

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
      setStep('terms');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function onAcceptTerms(event) {
    event.preventDefault();
    setError('');
    if (!allAccepted) {
      setError('Du må krysse av alle punktene for å fortsette.');
      return;
    }
    // Logger tidsstempelet i klienten — backend skal også stemple ved aktivering.
    setAcceptedAt(new Date().toISOString());
    setStep('password');
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
    if (!allAccepted) {
      setError('Du må godta vilkårene før kontoen kan aktiveres.');
      setStep('terms');
      return;
    }
    setBusy(true);
    try {
      const data = await postJson('/api/auth/invite/activate', {
        claimToken,
        password,
        // Disse feltene logges av backend som dokumentasjon på samtykket.
        // Backend-utvikler legger til håndtering — frontend sender alltid med.
        termsVersion: TERMS_VERSION,
        termsAcceptedAt: acceptedAt || new Date().toISOString(),
        acceptedClauses: TERMS_CLAUSES.filter((clause) => acceptances[clause.id])
          .map((clause) => clause.id),
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
    <>
      <div className="login-shell">
        <section className="login-card">
          <p className="eyebrow">
            {step === 'verify' ? 'Invitasjon' : step === 'terms' ? 'Vilkår' : 'Passord'}
          </p>
          <h1>
            {step === 'verify'
              ? 'Aktivér russeknute-kontoen din'
              : step === 'terms'
              ? `Hei${displayName ? `, ${displayName}` : ''}! Les vilkårene først.`
              : 'Sett et passord'}
          </h1>
          <p className="login-copy">
            {step === 'verify'
              ? 'Skriv inn e-posten din og koden du fikk av admin.'
              : step === 'terms'
              ? 'Russeknute er en lukket tjeneste. Du må lese og godta vilkårene før du får tilgang.'
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
          ) : step === 'terms' ? (
            <form className="login-form" onSubmit={onAcceptTerms}>
              <button
                type="button"
                className="action-button action-button--ghost"
                onClick={() => setIsTermsModalOpen(true)}
              >
                Les fullstendige brukervilkår og personvern
              </button>

              <p className="login-copy" style={{ marginTop: '4px' }}>
                Kryss av alle punktene under for å bekrefte at du har lest, forstått og
                godtar vilkårene:
              </p>

              <ul className="terms-clause-list" role="list">
                {TERMS_CLAUSES.map((clause) => (
                  <li key={clause.id} className="terms-clause-list__item">
                    <label className="terms-clause-list__label">
                      <input
                        type="checkbox"
                        checked={acceptances[clause.id]}
                        onChange={(event) =>
                          setClauseAccepted(clause.id, event.target.checked)
                        }
                      />
                      <span>{clause.label}</span>
                    </label>
                  </li>
                ))}
              </ul>

              {error ? <p className="form-feedback form-feedback--error">{error}</p> : null}

              <button
                type="submit"
                className="action-button"
                disabled={!allAccepted}
              >
                Jeg godtar — fortsett
              </button>
              <button
                type="button"
                className="action-button action-button--ghost"
                onClick={() => setStep('verify')}
              >
                Tilbake
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
                {busy ? 'Aktiverer...' : 'Aktiver konto og logg inn'}
              </button>
            </form>
          )}
        </section>
      </div>
      <TermsModal isOpen={isTermsModalOpen} onClose={() => setIsTermsModalOpen(false)} />
    </>
  );
}
