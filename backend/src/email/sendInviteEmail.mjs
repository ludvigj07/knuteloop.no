const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildInviteLink(baseUrl, email, code) {
  const trimmedBase = baseUrl.replace(/\/+$/, '');
  const params = new URLSearchParams({ email, code });
  return `${trimmedBase}/invite?${params.toString()}`;
}

function buildEmailBodies({ name, code, link }) {
  const safeName = escapeHtml(name);
  const safeCode = escapeHtml(code);
  const safeLink = escapeHtml(link);

  const text = [
    `Hei ${name}!`,
    '',
    'Du er invitert til Russeknute.',
    'Trykk på lenken under for å aktivere kontoen din:',
    link,
    '',
    `Eller bruk koden manuelt: ${code}`,
    '',
    'Hilsen Russeknute',
  ].join('\n');

  const html = `<!doctype html>
<html lang="no">
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #1f2937; max-width: 560px; margin: 0 auto; padding: 24px;">
    <h1 style="font-size: 22px; margin: 0 0 16px;">Hei ${safeName}!</h1>
    <p style="margin: 0 0 16px;">Du er invitert til <strong>Russeknute</strong>.</p>
    <p style="margin: 0 0 24px;">
      <a href="${safeLink}" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">Aktiver kontoen din</a>
    </p>
    <p style="margin: 0 0 8px; color: #6b7280;">Eller åpne denne lenken i nettleseren:</p>
    <p style="margin: 0 0 24px; word-break: break-all;"><a href="${safeLink}">${safeLink}</a></p>
    <p style="margin: 0 0 8px; color: #6b7280;">Hvis du heller vil skrive inn koden manuelt:</p>
    <p style="margin: 0 0 24px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 16px; letter-spacing: 0.05em;">${safeCode}</p>
    <p style="margin: 0; color: #6b7280; font-size: 14px;">Hilsen Russeknute</p>
  </body>
</html>`;

  return { text, html };
}

export async function sendInviteEmail({ email, name, code }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const baseUrl = process.env.APP_PUBLIC_URL;

  if (!apiKey || !from || !baseUrl) {
    return {
      ok: false,
      error: 'Mangler RESEND_API_KEY, EMAIL_FROM eller APP_PUBLIC_URL i miljøet.',
    };
  }

  const link = buildInviteLink(baseUrl, email, code);
  const { text, html } = buildEmailBodies({ name, code, link });

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: 'Invitasjon til Russeknute',
        text,
        html,
      }),
    });

    if (!response.ok) {
      let detail = '';
      try {
        const payload = await response.json();
        detail = payload?.message ?? payload?.error ?? JSON.stringify(payload);
      } catch {
        detail = await response.text().catch(() => '');
      }
      return { ok: false, error: `Resend ${response.status}: ${detail || 'ukjent feil'}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message ?? String(err) };
  }
}
