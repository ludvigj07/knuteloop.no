import { useEffect, useState } from 'react';
import { SectionCard } from './SectionCard.jsx';
import {
  adminCreateUser,
  adminListUsers,
  adminRegenerateInvite,
  adminResetPassword,
  adminSetUserActive,
  adminSetUserRussName,
} from '../data/api.js';
import { createRussNamePool } from '../utils/russNameGenerator.js';
import { InvitePrintOverlay } from './InvitePrintOverlay.jsx';

function parseBulkLines(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const commaIdx = line.lastIndexOf(',');
      if (commaIdx > 0) {
        return {
          name: line.slice(0, commaIdx).trim(),
          email: line.slice(commaIdx + 1).trim(),
        };
      }
      const tabParts = line.split(/\t/);
      if (tabParts.length === 2) {
        return { name: tabParts[0].trim(), email: tabParts[1].trim() };
      }
      if (/@/.test(line)) {
        return { name: '', email: line };
      }
      return null;
    })
    .filter((entry) => entry && /@/.test(entry.email));
}

function buildShortHost() {
  if (typeof window === 'undefined') return '';
  return window.location.host.replace(/^www\./, '');
}

const HISTORY_KEY = 'russ-admin-invite-history';
const HISTORY_LIMIT = 30;

function loadInviteHistory() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveInviteHistory(history) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // localStorage kan være full eller utilgjengelig; ignorer.
  }
}

function appendInviteHistory(entry) {
  const history = loadInviteHistory();
  const next = [entry, ...history].slice(0, HISTORY_LIMIT);
  saveInviteHistory(next);
  return next;
}

function describeHistoryEntry(entry) {
  const kindLabel = {
    'bulk-import': 'Bulk-import',
    'bulk-regenerate': 'Regenerering (alle ventende)',
    'single-create': 'Enkeltbruker opprettet',
    'single-regenerate': 'Ny kode for én bruker',
  }[entry.kind] ?? 'Invitasjon';
  const date = new Date(entry.createdAt);
  const timeStr = date.toLocaleString('no-NO', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const count = entry.invites?.length ?? 0;
  return `${kindLabel} · ${count} kode${count === 1 ? '' : 'r'} · ${timeStr}`;
}

function buildInviteLink(email, code) {
  if (typeof window === 'undefined') return '';
  const base = `${window.location.origin}/invite`;
  const params = new URLSearchParams({ email, code });
  return `${base}?${params.toString()}`;
}

function userStatusLabel(user) {
  if (!user.active) return 'Deaktivert';
  if (user.activatedAt) return 'Aktivert';
  if (user.hasInvite) return 'Venter aktivering';
  return 'Uten tilgang';
}

function emptyForm() {
  return { email: '', name: '', class: '', role: 'user', russName: '' };
}

export function UserAdminPanel({ sessionToken }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [lastInvite, setLastInvite] = useState(null);
  const [resetForUserId, setResetForUserId] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [russNameForUserId, setRussNameForUserId] = useState(null);
  const [russNameDraft, setRussNameDraft] = useState('');
  const [rowBusyId, setRowBusyId] = useState(null);

  const [bulkText, setBulkText] = useState('');
  const [bulkClass, setBulkClass] = useState('');
  const [bulkRole, setBulkRole] = useState('user');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [bulkInvites, setBulkInvites] = useState([]);
  const [bulkErrors, setBulkErrors] = useState([]);
  const [printOverlayOpen, setPrintOverlayOpen] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);
  const [regenProgress, setRegenProgress] = useState({ done: 0, total: 0 });

  const [inviteHistory, setInviteHistory] = useState(() => loadInviteHistory());
  const [showHistory, setShowHistory] = useState(false);

  const pendingUsers = users.filter((u) => u.hasInvite && !u.activatedAt && u.active);

  function logInviteHistory(kind, invites) {
    if (!invites || invites.length === 0) return;
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      kind,
      invites,
    };
    const next = appendInviteHistory(entry);
    setInviteHistory(next);
  }

  function handleOpenHistoryEntry(entry) {
    if (!entry.invites || entry.invites.length === 0) return;
    setBulkInvites(entry.invites);
    setBulkErrors([]);
    setPrintOverlayOpen(true);
  }

  function handleClearHistory() {
    if (!window.confirm('Slette all lagret invitasjons-historikk?')) return;
    saveInviteHistory([]);
    setInviteHistory([]);
  }

  async function refresh() {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const data = await adminListUsers(sessionToken);
      setUsers(data.users ?? []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  async function handleCreate(event) {
    event.preventDefault();
    if (
      !form.email.trim() ||
      !form.name.trim() ||
      !form.class.trim() ||
      !form.russName.trim()
    ) {
      setError('Fyll inn e-post, navn, klasse og dåpsnavn.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await adminCreateUser(sessionToken, {
        email: form.email.trim(),
        name: form.name.trim(),
        class: form.class.trim(),
        role: form.role,
        russName: form.russName.trim(),
      });
      const invite = {
        email: result.user.email,
        name: result.user.name,
        className: result.user.class ?? form.class.trim(),
        russName: result.user.russName ?? form.russName.trim(),
        code: result.inviteCode,
        link: buildInviteLink(result.user.email, result.inviteCode),
        shortHost: buildShortHost(),
      };
      setLastInvite({
        email: invite.email,
        name: invite.name,
        code: invite.code,
        link: invite.link,
      });
      logInviteHistory('single-create', [invite]);
      setForm(emptyForm());
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleBulkImport(event) {
    event.preventDefault();
    setError('');
    setBulkErrors([]);
    setBulkInvites([]);

    const entries = parseBulkLines(bulkText);
    if (entries.length === 0) {
      setError('Fant ingen gyldige linjer. Format per linje: «Navn, e-post».');
      return;
    }
    if (!bulkClass.trim()) {
      setError('Fyll inn klasse for alle (f.eks. 3STA).');
      return;
    }

    setBulkBusy(true);
    setBulkProgress({ done: 0, total: entries.length });

    const namePool = createRussNamePool();
    const existingRussNames = users.map((u) => u.russName).filter(Boolean);
    const newInvites = [];
    const errors = [];
    const shortHost = buildShortHost();

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const fallbackName =
        entry.name ||
        entry.email.split('@')[0].replace(/[._-]+/g, ' ').trim() ||
        'Russ';
      const russName = namePool.take(existingRussNames);

      try {
        const result = await adminCreateUser(sessionToken, {
          email: entry.email.trim(),
          name: fallbackName,
          class: bulkClass.trim(),
          role: bulkRole,
          russName,
        });
        newInvites.push({
          email: result.user.email,
          name: result.user.name,
          className: result.user.class ?? bulkClass.trim(),
          russName: result.user.russName ?? russName,
          code: result.inviteCode,
          link: buildInviteLink(result.user.email, result.inviteCode),
          shortHost,
        });
      } catch (err) {
        errors.push({ email: entry.email, message: err.message });
      } finally {
        setBulkProgress({ done: i + 1, total: entries.length });
      }
    }

    setBulkInvites(newInvites);
    setBulkErrors(errors);
    setBulkBusy(false);
    if (newInvites.length > 0) {
      setBulkText('');
      logInviteHistory('bulk-import', newInvites);
    }
    await refresh();
  }

  async function handleRegenerateAllPending() {
    setError('');
    setBulkErrors([]);
    setBulkInvites([]);

    if (pendingUsers.length === 0) {
      setError('Ingen brukere venter på aktivering.');
      return;
    }

    setRegenBusy(true);
    setRegenProgress({ done: 0, total: pendingUsers.length });

    const newInvites = [];
    const errors = [];
    const shortHost = buildShortHost();

    for (let i = 0; i < pendingUsers.length; i++) {
      const user = pendingUsers[i];
      try {
        const result = await adminRegenerateInvite(sessionToken, user.id);
        newInvites.push({
          email: result.user.email,
          name: result.user.name,
          className: result.user.class ?? '',
          russName: result.user.russName ?? '',
          code: result.inviteCode,
          link: buildInviteLink(result.user.email, result.inviteCode),
          shortHost,
        });
      } catch (err) {
        errors.push({ email: user.email, message: err.message });
      } finally {
        setRegenProgress({ done: i + 1, total: pendingUsers.length });
      }
    }

    setBulkInvites(newInvites);
    setBulkErrors(errors);
    setRegenBusy(false);
    if (newInvites.length > 0) {
      setPrintOverlayOpen(true);
      logInviteHistory('bulk-regenerate', newInvites);
    }
    await refresh();
  }

  async function handleRegenerate(userId) {
    setRowBusyId(userId);
    setError('');
    try {
      const result = await adminRegenerateInvite(sessionToken, userId);
      const invite = {
        email: result.user.email,
        name: result.user.name,
        className: result.user.class ?? '',
        russName: result.user.russName ?? '',
        code: result.inviteCode,
        link: buildInviteLink(result.user.email, result.inviteCode),
        shortHost: buildShortHost(),
      };
      setLastInvite({
        email: invite.email,
        name: invite.name,
        code: invite.code,
        link: invite.link,
      });
      logInviteHistory('single-regenerate', [invite]);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setRowBusyId(null);
    }
  }

  async function handleResetSubmit(event) {
    event.preventDefault();
    if (resetPassword.length < 8) {
      setError('Passordet må være minst 8 tegn.');
      return;
    }
    setRowBusyId(resetForUserId);
    setError('');
    try {
      await adminResetPassword(sessionToken, resetForUserId, resetPassword);
      setResetForUserId(null);
      setResetPassword('');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setRowBusyId(null);
    }
  }

  async function handleRussNameSubmit(event) {
    event.preventDefault();
    setRowBusyId(russNameForUserId);
    setError('');
    try {
      await adminSetUserRussName(sessionToken, russNameForUserId, russNameDraft.trim());
      setRussNameForUserId(null);
      setRussNameDraft('');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setRowBusyId(null);
    }
  }

  async function handleToggleActive(user) {
    setRowBusyId(user.id);
    setError('');
    try {
      await adminSetUserActive(sessionToken, user.id, !user.active);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setRowBusyId(null);
    }
  }

  return (
    <SectionCard
      title="Brukere"
      description="Opprett, inviter og administrer brukere. Invitasjonskoder vises bare én gang."
    >
      {error ? <p className="form-feedback form-feedback--error">{error}</p> : null}

      {lastInvite ? (
        <div
          className="section-card"
          style={{
            background: 'var(--color-surface-raised, #f5f5ff)',
            padding: '1rem',
            marginBottom: '1rem',
          }}
        >
          <strong>Invitasjon klar for {lastInvite.name}</strong>
          <p style={{ margin: '0.5rem 0' }}>Kopier disse og send til brukeren — koden vises bare én gang.</p>
          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.25rem 0.75rem', margin: 0 }}>
            <dt>E-post:</dt>
            <dd style={{ margin: 0, fontFamily: 'monospace' }}>{lastInvite.email}</dd>
            <dt>Kode:</dt>
            <dd style={{ margin: 0, fontFamily: 'monospace', fontSize: '1.1rem' }}>{lastInvite.code}</dd>
            <dt>Lenke:</dt>
            <dd style={{ margin: 0, wordBreak: 'break-all' }}>
              <a href={lastInvite.link} target="_blank" rel="noreferrer">{lastInvite.link}</a>
            </dd>
          </dl>
          <button
            type="button"
            className="action-button action-button--ghost"
            style={{ marginTop: '0.75rem' }}
            onClick={() => setLastInvite(null)}
          >
            Lukk
          </button>
        </div>
      ) : null}

      <form
        className="login-form"
        onSubmit={handleBulkImport}
        style={{
          marginBottom: '1.5rem',
          padding: '1rem',
          background: 'var(--color-surface-raised, #f5f5ff)',
          borderRadius: 8,
        }}
      >
        <strong>Bulk-importer brukere fra liste</strong>
        <p style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.85rem' }}>
          Lim inn én elev per linje på formatet <code>Navn, e-post</code>. Dåpsnavn
          genereres automatisk (kleine russenavn). Klasse og rolle gjelder for alle.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <label className="field-group">
            <span>Klasse for alle</span>
            <input
              className="text-input"
              value={bulkClass}
              onChange={(event) => setBulkClass(event.target.value)}
              placeholder="F.eks. 3STA"
              required
              disabled={bulkBusy}
            />
          </label>
          <label className="field-group">
            <span>Rolle for alle</span>
            <select
              className="text-input"
              value={bulkRole}
              onChange={(event) => setBulkRole(event.target.value)}
              disabled={bulkBusy}
            >
              <option value="user">Bruker</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>
        <label className="field-group">
          <span>Klasseliste</span>
          <textarea
            className="text-input"
            rows={8}
            value={bulkText}
            onChange={(event) => setBulkText(event.target.value)}
            placeholder={'Ola Nordmann, ola@elev.skole.no\nKari Hansen, kari@elev.skole.no'}
            disabled={bulkBusy}
            style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem' }}
          />
        </label>
        {bulkBusy ? (
          <p style={{ margin: 0 }}>
            Oppretter brukere... ({bulkProgress.done} / {bulkProgress.total})
          </p>
        ) : null}
        <button type="submit" className="action-button" disabled={bulkBusy}>
          {bulkBusy ? 'Oppretter...' : 'Opprett alle og generer invitasjoner'}
        </button>
      </form>

      {bulkInvites.length > 0 ? (
        <div
          className="section-card"
          style={{
            background: 'var(--color-surface-raised, #eef7ee)',
            padding: '1rem',
            marginBottom: '1.5rem',
            borderRadius: 8,
          }}
        >
          <strong>{bulkInvites.length} invitasjoner klare</strong>
          <p style={{ margin: '0.25rem 0 0.75rem', fontSize: '0.9rem' }}>
            Skriv ut og del ut i klassen. Kodene vises bare nå — du kan generere nye
            koder per bruker fra tabellen under hvis nødvendig.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="action-button"
              onClick={() => setPrintOverlayOpen(true)}
            >
              Åpne utskriftsvisning ({bulkInvites.length} ruter)
            </button>
            <button
              type="button"
              className="action-button action-button--ghost"
              onClick={() => {
                setBulkInvites([]);
                setBulkErrors([]);
              }}
            >
              Lukk
            </button>
          </div>
          {bulkErrors.length > 0 ? (
            <div style={{ marginTop: '0.75rem' }}>
              <strong style={{ color: '#a33' }}>
                {bulkErrors.length} feilet:
              </strong>
              <ul style={{ margin: '0.25rem 0 0 1rem', fontSize: '0.85rem' }}>
                {bulkErrors.map((err) => (
                  <li key={err.email}>
                    <code>{err.email}</code>: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {inviteHistory.length > 0 ? (
        <div
          style={{
            marginBottom: '1.5rem',
            padding: '0.75rem 1rem',
            background: 'var(--color-surface-raised, #f5f5ff)',
            borderRadius: 8,
            border: '1px solid #ddd',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            <strong>Tidligere utskrifter ({inviteHistory.length})</strong>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="action-button action-button--ghost"
                onClick={() => setShowHistory((v) => !v)}
              >
                {showHistory ? 'Skjul' : 'Vis'}
              </button>
              {showHistory ? (
                <button
                  type="button"
                  className="action-button action-button--ghost"
                  onClick={handleClearHistory}
                  style={{ color: '#a33' }}
                >
                  Slett alt
                </button>
              ) : null}
            </div>
          </div>
          {showHistory ? (
            <>
              <p style={{ margin: '0.5rem 0', fontSize: '0.85rem', color: '#555' }}>
                Lagret kun i denne nettleseren. Gamle koder kan være ugyldige hvis de er
                regenerert senere.
              </p>
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'grid',
                  gap: '0.4rem',
                }}
              >
                {inviteHistory.map((entry) => (
                  <li
                    key={entry.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      background: '#fff',
                      border: '1px solid #e5e5e5',
                      borderRadius: 6,
                      fontSize: '0.9rem',
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      {describeHistoryEntry(entry)}
                    </span>
                    <button
                      type="button"
                      className="action-button action-button--ghost"
                      onClick={() => handleOpenHistoryEntry(entry)}
                    >
                      Åpne utskrift
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      {pendingUsers.length > 0 ? (
        <div
          style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            background: 'var(--color-surface-raised, #fff7e6)',
            borderRadius: 8,
            border: '1px solid #f0d68c',
          }}
        >
          <strong>
            {pendingUsers.length} bruker{pendingUsers.length === 1 ? '' : 'e'} venter på
            aktivering
          </strong>
          <p style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.9rem' }}>
            Mistet utskriften? Klikk for å generere nye koder for alle ventende brukere
            og åpne utskriftsvisningen direkte.{' '}
            <em>NB: Tidligere koder slutter å virke når du genererer nye.</em>
          </p>
          {regenBusy ? (
            <p style={{ margin: '0.25rem 0' }}>
              Genererer... ({regenProgress.done} / {regenProgress.total})
            </p>
          ) : null}
          <button
            type="button"
            className="action-button"
            disabled={regenBusy}
            onClick={handleRegenerateAllPending}
          >
            {regenBusy
              ? 'Genererer...'
              : `Generer nye koder + skriv ut (${pendingUsers.length})`}
          </button>
        </div>
      ) : null}

      <form className="login-form" onSubmit={handleCreate} style={{ marginBottom: '1.5rem' }}>
        <strong>Opprett ny bruker</strong>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <label className="field-group">
            <span>Navn</span>
            <input
              className="text-input"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </label>
          <label className="field-group">
            <span>E-post</span>
            <input
              type="email"
              className="text-input"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              required
            />
          </label>
          <label className="field-group">
            <span>Klasse</span>
            <input
              className="text-input"
              value={form.class}
              onChange={(event) => setForm({ ...form, class: event.target.value })}
              placeholder="F.eks. 3STA"
              required
            />
          </label>
          <label className="field-group">
            <span>Rolle</span>
            <select
              className="text-input"
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value })}
            >
              <option value="user">Bruker</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="field-group" style={{ gridColumn: '1 / -1' }}>
            <span>Dåpsnavn</span>
            <input
              className="text-input"
              value={form.russName}
              onChange={(event) => setForm({ ...form, russName: event.target.value })}
              placeholder="Russenavnet som vises i appen"
              required
            />
          </label>
        </div>
        <button type="submit" className="action-button" disabled={busy}>
          {busy ? 'Oppretter...' : 'Opprett og generer invitasjon'}
        </button>
      </form>

      <div>
        <strong>{users.length} brukere</strong>
        {loading ? <p>Laster...</p> : null}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border, #ddd)' }}>
              <th style={{ padding: '0.5rem 0.25rem' }}>Navn</th>
              <th style={{ padding: '0.5rem 0.25rem' }}>Dåpsnavn</th>
              <th style={{ padding: '0.5rem 0.25rem' }}>E-post</th>
              <th style={{ padding: '0.5rem 0.25rem' }}>Klasse</th>
              <th style={{ padding: '0.5rem 0.25rem' }}>Rolle</th>
              <th style={{ padding: '0.5rem 0.25rem' }}>Status</th>
              <th style={{ padding: '0.5rem 0.25rem' }}>Handlinger</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const busyRow = rowBusyId === user.id;
              return (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--color-border-subtle, #eee)' }}>
                  <td style={{ padding: '0.5rem 0.25rem' }}>{user.name}</td>
                  <td style={{ padding: '0.5rem 0.25rem', fontStyle: user.russName ? 'normal' : 'italic', opacity: user.russName ? 1 : 0.6 }}>
                    {user.russName || '—'}
                  </td>
                  <td style={{ padding: '0.5rem 0.25rem', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                    {user.email}
                  </td>
                  <td style={{ padding: '0.5rem 0.25rem' }}>{user.class}</td>
                  <td style={{ padding: '0.5rem 0.25rem' }}>{user.role}</td>
                  <td style={{ padding: '0.5rem 0.25rem' }}>{userStatusLabel(user)}</td>
                  <td style={{ padding: '0.5rem 0.25rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="action-button action-button--ghost"
                      disabled={busyRow}
                      onClick={() => {
                        setRussNameForUserId(user.id);
                        setRussNameDraft(user.russName ?? '');
                      }}
                    >
                      Dåpsnavn
                    </button>
                    <button
                      type="button"
                      className="action-button action-button--ghost"
                      disabled={busyRow}
                      onClick={() => handleRegenerate(user.id)}
                    >
                      Ny kode
                    </button>
                    <button
                      type="button"
                      className="action-button action-button--ghost"
                      disabled={busyRow}
                      onClick={() => {
                        setResetForUserId(user.id);
                        setResetPassword('');
                      }}
                    >
                      Sett passord
                    </button>
                    <button
                      type="button"
                      className="action-button action-button--ghost"
                      disabled={busyRow}
                      onClick={() => handleToggleActive(user)}
                    >
                      {user.active ? 'Deaktivér' : 'Aktivér'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {russNameForUserId != null ? (
        <form
          onSubmit={handleRussNameSubmit}
          className="login-form"
          style={{ marginTop: '1rem', padding: '1rem', background: 'var(--color-surface-raised, #f5f5ff)' }}
        >
          <strong>
            Sett dåpsnavn for {users.find((u) => u.id === russNameForUserId)?.name ?? 'bruker'}
          </strong>
          <p style={{ margin: '0.5rem 0' }}>
            La feltet stå tomt for å fjerne dåpsnavnet. Dette er russenavnet som vises i appen.
          </p>
          <label className="field-group">
            <span>Dåpsnavn</span>
            <input
              type="text"
              className="text-input"
              value={russNameDraft}
              onChange={(event) => setRussNameDraft(event.target.value)}
              autoFocus
            />
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="action-button" disabled={rowBusyId === russNameForUserId}>
              Lagre
            </button>
            <button
              type="button"
              className="action-button action-button--ghost"
              onClick={() => {
                setRussNameForUserId(null);
                setRussNameDraft('');
              }}
            >
              Avbryt
            </button>
          </div>
        </form>
      ) : null}

      {resetForUserId != null ? (
        <form
          onSubmit={handleResetSubmit}
          className="login-form"
          style={{ marginTop: '1rem', padding: '1rem', background: 'var(--color-surface-raised, #f5f5ff)' }}
        >
          <strong>
            Sett nytt passord for {users.find((u) => u.id === resetForUserId)?.name ?? 'bruker'}
          </strong>
          <p style={{ margin: '0.5rem 0' }}>
            Velg et passord og gi det til brukeren. Alle aktive sesjoner for brukeren avsluttes.
          </p>
          <label className="field-group">
            <span>Nytt passord</span>
            <input
              type="text"
              className="text-input"
              value={resetPassword}
              onChange={(event) => setResetPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="action-button" disabled={rowBusyId === resetForUserId}>
              Lagre
            </button>
            <button
              type="button"
              className="action-button action-button--ghost"
              onClick={() => {
                setResetForUserId(null);
                setResetPassword('');
              }}
            >
              Avbryt
            </button>
          </div>
        </form>
      ) : null}

      {printOverlayOpen && bulkInvites.length > 0 ? (
        <InvitePrintOverlay
          invites={bulkInvites}
          onClose={() => setPrintOverlayOpen(false)}
        />
      ) : null}
    </SectionCard>
  );
}
