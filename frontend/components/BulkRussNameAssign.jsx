import { useEffect, useState } from 'react';
import { adminListUsers, adminSetUserRussName } from '../data/api.js';

const MAX_RUSS_NAME_CHARS = 40;

function splitLine(line) {
  if (line.includes('\t')) return line.split(/\t+/);
  if (line.includes(';')) return line.split(';');
  if (/\s*(=>|→)\s*/.test(line)) return line.split(/\s*(?:=>|→)\s*/);
  if (line.includes(',')) return line.split(',');
  return [line];
}

function parseLines(text) {
  return text
    .split('\n')
    .map((rawLine, index) => {
      const line = rawLine.trim();
      if (!line) return null;
      const parts = splitLine(line).map((part) => part.trim());
      const emailIndex = parts.findIndex((part) => /@/.test(part));
      if (emailIndex < 0) return null;
      return {
        lineNumber: index + 1,
        name: parts.slice(0, emailIndex).join(' ').trim(),
        email: parts[emailIndex],
        russName: parts.slice(emailIndex + 1).join(' ').trim(),
      };
    })
    .filter((entry) => entry && /@/.test(entry.email));
}

function normalizeKey(value) {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function BulkRussNameAssign({ sessionToken }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  async function refresh() {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const data = await adminListUsers(sessionToken);
      setUsers(data.users ?? []);
      setLoadError('');
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  function handlePreview() {
    setError('');
    setResults(null);
    const entries = parseLines(text);

    if (entries.length === 0) {
      setPreview({ matches: [], notFound: [], skipped: [] });
      setError(
        'Fant ingen rader å forhåndsvise. Hver linje må inneholde en e-post og et russenavn.',
      );
      return;
    }

    const byEmail = new Map(
      users.map((user) => [(user.email ?? '').toLowerCase().trim(), user]),
    );
    const matches = [];
    const notFound = [];
    const skipped = [];

    for (const entry of entries) {
      const emailKey = entry.email.toLowerCase().trim();
      const russName = entry.russName.trim();

      if (!russName) {
        skipped.push({ ...entry, reason: 'Russenavn mangler i raden.' });
        continue;
      }
      if (russName.length > MAX_RUSS_NAME_CHARS) {
        skipped.push({
          ...entry,
          reason: `Russenavnet er for langt (maks ${MAX_RUSS_NAME_CHARS} tegn).`,
        });
        continue;
      }

      const user = byEmail.get(emailKey);
      if (!user) {
        notFound.push(entry);
        continue;
      }

      const sameAsCurrent =
        normalizeKey(user.russName ?? '') === normalizeKey(russName);
      matches.push({
        ...entry,
        userId: user.id,
        currentRussName: user.russName ?? '',
        sameAsCurrent,
      });
    }

    setPreview({ matches, notFound, skipped });
  }

  async function handleConfirm() {
    if (!preview || busy) return;
    const toUpdate = preview.matches.filter((m) => !m.sameAsCurrent);
    if (toUpdate.length === 0) return;

    setBusy(true);
    setError('');
    setProgress({ done: 0, total: toUpdate.length });
    const successes = [];
    const failures = [];

    for (let i = 0; i < toUpdate.length; i++) {
      const entry = toUpdate[i];
      try {
        await adminSetUserRussName(sessionToken, entry.userId, entry.russName);
        successes.push(entry);
      } catch (err) {
        failures.push({ ...entry, error: err.message });
      } finally {
        setProgress({ done: i + 1, total: toUpdate.length });
      }
    }

    setResults({ successes, failures });
    setBusy(false);
    setPreview(null);
    setText('');
    await refresh();
  }

  function handleReset() {
    setText('');
    setPreview(null);
    setResults(null);
    setProgress({ done: 0, total: 0 });
  }

  return (
    <div
      className="section-card"
      style={{
        marginTop: '1rem',
        padding: '1rem',
        background: 'var(--color-surface-raised, #f5f5ff)',
        borderRadius: 8,
        border: '1px solid #ddd',
      }}
    >
      <strong>Tilordne russenavn fra liste</strong>
      <p style={{ margin: '0.5rem 0', fontSize: '0.9rem', color: '#555' }}>
        Lim inn lista fra russeprestene. Hver linje må inneholde en e-post og et
        russenavn — adskilt med tab, semikolon, komma eller pil (=&gt; / →).
        Et eventuelt navn-felt før e-posten ignoreres ved matching, men er greit
        å ha for at lista skal være leselig.
      </p>
      <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: '#666' }}>
        Eksempler:
        <br />
        <code>ola@elev.no;Pingvin-Petter</code>
        <br />
        <code>Ola Nordmann{'\t'}ola@elev.no{'\t'}Pingvin-Petter</code>
      </p>
      <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#1f5e1f' }}>
        Russenavnene lagres skjult. De vises ikke for brukerne før du trykker
        «Avslør alle russenavn» øverst på denne fanen.
      </p>

      {loading ? (
        <p style={{ fontSize: '0.85rem', color: '#666' }}>Henter brukerliste...</p>
      ) : null}
      {loadError ? (
        <p className="form-feedback form-feedback--error">{loadError}</p>
      ) : null}

      <textarea
        className="text-input text-input--area"
        rows={8}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="ola@elev.no;Pingvin-Petter&#10;kari@elev.no;Sjokolade-Sara"
        disabled={busy || loading}
        style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.9rem' }}
      />
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          marginTop: '0.5rem',
        }}
      >
        <button
          type="button"
          className="action-button action-button--ghost"
          onClick={handlePreview}
          disabled={busy || loading || !text.trim()}
        >
          Forhåndsvis
        </button>
        {preview ? (
          <>
            <button
              type="button"
              className="action-button"
              onClick={handleConfirm}
              disabled={
                busy ||
                preview.matches.filter((m) => !m.sameAsCurrent).length === 0
              }
            >
              {busy
                ? `Oppdaterer... (${progress.done}/${progress.total})`
                : `Bekreft ${preview.matches.filter((m) => !m.sameAsCurrent).length} oppdateringer`}
            </button>
            <button
              type="button"
              className="action-button action-button--ghost"
              onClick={handleReset}
              disabled={busy}
            >
              Avbryt
            </button>
          </>
        ) : null}
      </div>

      {error ? (
        <p className="form-feedback form-feedback--error">{error}</p>
      ) : null}

      {preview ? (
        <div style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
          {preview.matches.length > 0 ? (
            <>
              <strong style={{ color: '#1f5e1f' }}>
                ✓ {preview.matches.length} treff
              </strong>
              <ul style={{ margin: '0.25rem 0 0.75rem 1.25rem', padding: 0 }}>
                {preview.matches.map((m) => (
                  <li key={`m-${m.email}`}>
                    <code>{m.email}</code> → <strong>{m.russName}</strong>
                    {m.sameAsCurrent ? (
                      <span style={{ color: '#888' }}>
                        {' '}
                        (uendret — overstyres ikke)
                      </span>
                    ) : m.currentRussName ? (
                      <span style={{ color: '#888' }}>
                        {' '}
                        (overstyrer «{m.currentRussName}»)
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {preview.notFound.length > 0 ? (
            <>
              <strong style={{ color: '#a33' }}>
                ⚠ {preview.notFound.length} ikke funnet
              </strong>
              <ul style={{ margin: '0.25rem 0 0.75rem 1.25rem', padding: 0 }}>
                {preview.notFound.map((m) => (
                  <li key={`n-${m.lineNumber}`}>
                    Linje {m.lineNumber}: <code>{m.email}</code> finnes ikke
                    i brukerlisten.
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {preview.skipped.length > 0 ? (
            <>
              <strong style={{ color: '#a33' }}>
                ✗ {preview.skipped.length} hoppet over
              </strong>
              <ul style={{ margin: '0.25rem 0 0.75rem 1.25rem', padding: 0 }}>
                {preview.skipped.map((m) => (
                  <li key={`s-${m.lineNumber}`}>
                    Linje {m.lineNumber}: {m.reason}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      {results ? (
        <div style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
          <strong style={{ color: '#1f5e1f' }}>
            ✓ {results.successes.length} russenavn lagret
          </strong>
          {results.failures.length > 0 ? (
            <>
              <br />
              <strong style={{ color: '#a33' }}>
                ⚠ {results.failures.length} feilet:
              </strong>
              <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0 }}>
                {results.failures.map((f) => (
                  <li key={`f-${f.email}`}>
                    <code>{f.email}</code> ({f.russName}): {f.error}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
