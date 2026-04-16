import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = path.resolve(__dirname, '..', '..', 'data', 'auth.sqlite');

let db;

export function openAuthDb(filePath = DEFAULT_DB_PATH) {
  if (db) return db;
  db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

function runMigrations(handle) {
  handle.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id                INTEGER PRIMARY KEY,
      email             TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name              TEXT NOT NULL,
      class             TEXT NOT NULL,
      role              TEXT NOT NULL DEFAULT 'user',
      russ_name         TEXT,
      password_hash     TEXT,
      invite_code_hash  TEXT,
      invite_expires_at INTEGER,
      activated_at      INTEGER,
      active            INTEGER NOT NULL DEFAULT 1,
      created_at        INTEGER NOT NULL,
      updated_at        INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id           TEXT PRIMARY KEY,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at   INTEGER NOT NULL,
      expires_at   INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS claim_tokens (
      id         TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      id         INTEGER PRIMARY KEY,
      key        TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_login_attempts_key ON login_attempts(key, created_at);
  `);

  const columns = handle.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
  if (!columns.includes('russ_name')) {
    handle.exec(`ALTER TABLE users ADD COLUMN russ_name TEXT`);
  }
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;   // 30 days
const CLAIM_TTL_MS = 1000 * 60 * 10;               // 10 minutes
const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 30;    // 30 days

export function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

export function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function listUsers() {
  return db
    .prepare(
      `SELECT id, email, name, class, role, russ_name, password_hash, invite_code_hash,
              invite_expires_at, activated_at, active
       FROM users ORDER BY name COLLATE NOCASE`,
    )
    .all();
}

export function insertUser({ email, name, className, role, russName, inviteCodeHash }) {
  const now = Date.now();
  const info = db
    .prepare(
      `INSERT INTO users (email, name, class, role, russ_name, invite_code_hash, invite_expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      email,
      name,
      className,
      role ?? 'user',
      russName ?? null,
      inviteCodeHash,
      now + INVITE_TTL_MS,
      now,
      now,
    );
  return info.lastInsertRowid;
}

export function setUserRussName(userId, russName) {
  db.prepare(`UPDATE users SET russ_name = ?, updated_at = ? WHERE id = ?`).run(
    russName ?? null,
    Date.now(),
    userId,
  );
}

export function updateUserInvite(userId, inviteCodeHash) {
  const now = Date.now();
  db.prepare(
    `UPDATE users SET invite_code_hash = ?, invite_expires_at = ?, updated_at = ? WHERE id = ?`,
  ).run(inviteCodeHash, now + INVITE_TTL_MS, now, userId);
}

export function setUserPassword(userId, passwordHash, { clearInvite = false } = {}) {
  const now = Date.now();
  if (clearInvite) {
    db.prepare(
      `UPDATE users SET password_hash = ?, invite_code_hash = NULL, invite_expires_at = NULL,
                        activated_at = COALESCE(activated_at, ?), updated_at = ? WHERE id = ?`,
    ).run(passwordHash, now, now, userId);
  } else {
    db.prepare(
      `UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`,
    ).run(passwordHash, now, userId);
  }
}

export function setUserActive(userId, active) {
  db.prepare(`UPDATE users SET active = ?, updated_at = ? WHERE id = ?`).run(
    active ? 1 : 0,
    Date.now(),
    userId,
  );
}

export function createSession(userId, tokenId) {
  const now = Date.now();
  db.prepare(
    `INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(tokenId, userId, now, now + SESSION_TTL_MS, now);
  return { id: tokenId, expiresAt: now + SESSION_TTL_MS };
}

export function getSession(tokenId) {
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(tokenId);
}

export function touchSession(tokenId) {
  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(Date.now(), tokenId);
}

export function deleteSession(tokenId) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(tokenId);
}

export function deleteSessionsForUser(userId) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export function createClaimToken(userId, tokenId) {
  const now = Date.now();
  db.prepare(
    `INSERT INTO claim_tokens (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
  ).run(tokenId, userId, now + CLAIM_TTL_MS, now);
  return { id: tokenId, expiresAt: now + CLAIM_TTL_MS };
}

export function consumeClaimToken(tokenId) {
  const row = db.prepare('SELECT * FROM claim_tokens WHERE id = ?').get(tokenId);
  db.prepare('DELETE FROM claim_tokens WHERE id = ?').run(tokenId);
  if (!row) return null;
  if (row.expires_at < Date.now()) return null;
  return row;
}

export function recordLoginAttempt(key) {
  db.prepare(`INSERT INTO login_attempts (key, created_at) VALUES (?, ?)`).run(key, Date.now());
}

export function countRecentAttempts(key, withinMs) {
  const row = db
    .prepare(`SELECT COUNT(*) AS n FROM login_attempts WHERE key = ? AND created_at > ?`)
    .get(key, Date.now() - withinMs);
  return row.n;
}

export function clearLoginAttempts(key) {
  db.prepare(`DELETE FROM login_attempts WHERE key = ?`).run(key);
}
