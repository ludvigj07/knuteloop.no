import { useEffect } from 'react';

const SESSION_TOKEN_KEY = 'russ-session-token';

export function LogoutPage() {
  useEffect(() => {
    let cancelled = false;
    async function doLogout() {
      let token = '';
      try {
        token = window.localStorage.getItem(SESSION_TOKEN_KEY) ?? '';
        window.localStorage.removeItem(SESSION_TOKEN_KEY);
      } catch {}
      if (token) {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch {}
      }
      if (!cancelled) {
        window.location.replace('/');
      }
    }
    doLogout();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="login-shell">
      <section className="login-card">
        <p className="eyebrow">Logger ut</p>
        <h1>Ha det!</h1>
        <p className="login-copy">Du blir snart sendt tilbake til innloggingen...</p>
      </section>
    </div>
  );
}
