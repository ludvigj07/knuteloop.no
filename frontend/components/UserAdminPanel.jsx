import { useEffect, useMemo, useState } from 'react';
import { SectionCard } from './SectionCard.jsx';
import {
  adminCreateUser,
  adminListUsers,
  adminRegenerateInvite,
  adminResetPassword,
  adminSetUserActive,
  adminSetUserRussName,
} from '../data/api.js';

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

function userStatusVariant(user) {
  if (!user.active) return 'inactive';
  if (user.activatedAt) return 'active';
  if (user.hasInvite) return 'pending';
  return 'noaccess';
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return users.filter((user) => {
      if (statusFilter !== 'all' && userStatusVariant(user) !== statusFilter) {
        return false;
      }
      if (!needle) return true;
      const haystack = [user.name, user.russName, user.email, user.class, user.role]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [users, search, statusFilter]);

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
    if (!form.email.trim() || !form.name.trim() || !form.class.trim()) {
      setError('Fyll inn e-post, navn og klasse.');
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
      setLastInvite({
        email: result.user.email,
        name: result.user.name,
        code: result.inviteCode,
        link: buildInviteLink(result.user.email, result.inviteCode),
      });
      setForm(emptyForm());
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerate(userId) {
    setRowBusyId(userId);
    setError('');
    try {
      const result = await adminRegenerateInvite(sessionToken, userId);
      setLastInvite({
        email: result.user.email,
        name: result.user.name,
        code: result.inviteCode,
        link: buildInviteLink(result.user.email, result.inviteCode),
      });
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
            <span>Dåpsnavn (valgfritt)</span>
            <input
              className="text-input"
              value={form.russName}
              onChange={(event) => setForm({ ...form, russName: event.target.value })}
              placeholder="Russenavnet som vises i appen"
            />
          </label>
        </div>
        <button type="submit" className="action-button" disabled={busy}>
          {busy ? 'Oppretter...' : 'Opprett og generer invitasjon'}
        </button>
      </form>

      <div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <strong>{filteredUsers.length} av {users.length} brukere</strong>
          <input
            type="search"
            className="text-input"
            placeholder="Søk navn, e-post, klasse…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ flex: '1 1 200px', minWidth: '160px' }}
          />
          <select
            className="text-input"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            style={{ flex: '0 0 auto' }}
          >
            <option value="all">Alle status</option>
            <option value="active">Aktivert</option>
            <option value="pending">Venter aktivering</option>
            <option value="noaccess">Uten tilgang</option>
            <option value="inactive">Deaktivert</option>
          </select>
          {loading ? <span style={{ color: 'var(--text-muted)' }}>Laster…</span> : null}
        </div>
        <div className="admin-table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Navn</th>
              <th>Dåpsnavn</th>
              <th>E-post</th>
              <th>Klasse</th>
              <th>Rolle</th>
              <th>Status</th>
              <th>Handlinger</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => {
              const busyRow = rowBusyId === user.id;
              return (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td style={{ fontStyle: user.russName ? 'normal' : 'italic', opacity: user.russName ? 1 : 0.6 }}>
                    {user.russName || '—'}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                    {user.email}
                  </td>
                  <td>{user.class}</td>
                  <td>
                    <span className={`pill ${user.role === 'admin' ? 'pill--soft' : 'pill--muted'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>
                    <span className={`user-status user-status--${userStatusVariant(user)}`}>
                      {userStatusLabel(user)}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
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
    </SectionCard>
  );
}
