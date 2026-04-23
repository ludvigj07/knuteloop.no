import {
  clearLoginAttempts,
  consumeClaimToken,
  countRecentAttempts,
  createClaimToken,
  createSession,
  deleteSession,
  deleteSessionsForUser,
  getSession,
  getUserByEmail,
  getUserById,
  insertUser,
  listUsers,
  recordLoginAttempt,
  setUserActive,
  setUserPassword,
  setUserRussName,
  touchSession,
  updateUserInvite,
} from './db.mjs';
import {
  generateInviteCode,
  generateToken,
  hashSecret,
  validatePasswordStrength,
  verifySecret,
} from './passwords.mjs';

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const GENERIC_LOGIN_ERROR = 'Ugyldig e-post eller passord.';
const GENERIC_INVITE_ERROR = 'Ugyldig e-post eller kode.';

let bridge = { ensureJsonUser: async () => {} };

export function setAuthBridge(next) {
  bridge = { ensureJsonUser: async () => {}, ...next };
}

const MAX_REQUEST_BODY_BYTES = 50 * 1024 * 1024;

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    request.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_REQUEST_BODY_BYTES) {
        const err = new Error(
          `Forespørselen er for stor. Maks ${MAX_REQUEST_BODY_BYTES / 1024 / 1024} MB.`,
        );
        err.statusCode = 413;
        request.destroy();
        reject(err);
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    request.on('error', reject);
  });
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function clientIp(request) {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return request.socket.remoteAddress ?? 'unknown';
}

function rateLimitKey(request, email) {
  return `${clientIp(request)}::${email}`;
}

function rateLimited(request, email) {
  const key = rateLimitKey(request, email);
  const count = countRecentAttempts(key, RATE_LIMIT_WINDOW_MS);
  return count >= RATE_LIMIT_MAX;
}

function userPublicShape(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    class: user.class,
    role: user.role,
    russName: user.russ_name ?? '',
    active: Boolean(user.active),
    activatedAt: user.activated_at,
    hasPassword: Boolean(user.password_hash),
    hasInvite: Boolean(user.invite_code_hash),
    inviteExpiresAt: user.invite_expires_at,
  };
}

function getBearerToken(request) {
  const header = request.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

export function getAuthedUserFromRequest(request) {
  const token = getBearerToken(request);
  if (!token) return null;
  const session = getSession(token);
  if (!session) return null;
  if (session.expires_at < Date.now()) {
    deleteSession(token);
    return null;
  }
  const user = getUserById(session.user_id);
  if (!user || !user.active) return null;
  touchSession(token);
  return user;
}

function requireAdmin(request, response) {
  const user = getAuthedUserFromRequest(request);
  if (!user) {
    sendJson(response, 401, { error: 'Ikke logget inn.' });
    return null;
  }
  if (user.role !== 'admin') {
    sendJson(response, 403, { error: 'Kun admin.' });
    return null;
  }
  return user;
}

export async function handlePasswordLogin(request, response) {
  const body = await readJsonBody(request);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    sendJson(response, 400, { error: GENERIC_LOGIN_ERROR });
    return;
  }
  if (rateLimited(request, email)) {
    sendJson(response, 429, { error: 'For mange forsøk. Prøv igjen om litt.' });
    return;
  }

  const user = getUserByEmail(email);
  const passwordOk = user && user.active && (await verifySecret(password, user.password_hash));
  if (!passwordOk) {
    recordLoginAttempt(rateLimitKey(request, email));
    sendJson(response, 401, { error: GENERIC_LOGIN_ERROR });
    return;
  }

  clearLoginAttempts(rateLimitKey(request, email));
  await bridge.ensureJsonUser(user);
  const token = generateToken();
  const session = createSession(user.id, token);
  sendJson(response, 200, { token, expiresAt: session.expiresAt, user: userPublicShape(user) });
}

export async function handleLogout(request, response) {
  const token = getBearerToken(request);
  if (token) deleteSession(token);
  sendJson(response, 200, { ok: true });
}

export async function handleChangeOwnPassword(request, response) {
  const user = getAuthedUserFromRequest(request);

  if (!user) {
    sendJson(response, 401, { error: 'Ikke logget inn.' });
    return;
  }

  const body = await readJsonBody(request);
  const currentPassword =
    typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!currentPassword || !newPassword) {
    sendJson(response, 400, { error: 'Fyll inn nåværende og nytt passord.' });
    return;
  }

  const currentPasswordMatches = await verifySecret(currentPassword, user.password_hash);
  if (!currentPasswordMatches) {
    sendJson(response, 401, { error: 'Nåværende passord er feil.' });
    return;
  }

  const passwordError = validatePasswordStrength(newPassword);
  if (passwordError) {
    sendJson(response, 400, { error: passwordError });
    return;
  }

  const nextHash = await hashSecret(newPassword);
  setUserPassword(user.id, nextHash);
  deleteSessionsForUser(user.id);
  sendJson(response, 200, { ok: true });
}

export async function handleInviteVerify(request, response) {
  const body = await readJsonBody(request);
  const email = normalizeEmail(body.email);
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';

  if (!email || !code) {
    sendJson(response, 400, { error: GENERIC_INVITE_ERROR });
    return;
  }
  if (rateLimited(request, email)) {
    sendJson(response, 429, { error: 'For mange forsøk. Prøv igjen om litt.' });
    return;
  }

  const user = getUserByEmail(email);
  const codeOk =
    user &&
    user.active &&
    user.invite_code_hash &&
    (!user.invite_expires_at || user.invite_expires_at > Date.now()) &&
    (await verifySecret(code, user.invite_code_hash));

  if (!codeOk) {
    recordLoginAttempt(rateLimitKey(request, email));
    sendJson(response, 401, { error: GENERIC_INVITE_ERROR });
    return;
  }

  clearLoginAttempts(rateLimitKey(request, email));
  const claimToken = generateToken();
  const claim = createClaimToken(user.id, claimToken);
  sendJson(response, 200, {
    claimToken,
    expiresAt: claim.expiresAt,
    user: { name: user.name, email: user.email },
  });
}

export async function handleInviteActivate(request, response) {
  const body = await readJsonBody(request);
  const claimToken = typeof body.claimToken === 'string' ? body.claimToken : '';
  const password = typeof body.password === 'string' ? body.password : '';

  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    sendJson(response, 400, { error: passwordError });
    return;
  }

  const claim = consumeClaimToken(claimToken);
  if (!claim) {
    sendJson(response, 401, { error: 'Lenken er utløpt. Start på nytt.' });
    return;
  }

  const user = getUserById(claim.user_id);
  if (!user || !user.active) {
    sendJson(response, 401, { error: 'Bruker er ikke aktiv.' });
    return;
  }

  const passwordHash = await hashSecret(password);
  setUserPassword(user.id, passwordHash, { clearInvite: true });

  const fresh = getUserById(user.id);
  await bridge.ensureJsonUser(fresh);
  const token = generateToken();
  const session = createSession(user.id, token);
  sendJson(response, 200, { token, expiresAt: session.expiresAt, user: userPublicShape(fresh) });
}

export async function handleAdminListUsers(request, response) {
  if (!requireAdmin(request, response)) return;
  sendJson(response, 200, { users: listUsers().map(userPublicShape) });
}

export async function handleAdminCreateUser(request, response) {
  if (!requireAdmin(request, response)) return;
  const body = await readJsonBody(request);
  const email = normalizeEmail(body.email);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const className = typeof body.class === 'string' ? body.class.trim() : '';
  const role = body.role === 'admin' ? 'admin' : 'user';

  if (!email || !name || !className) {
    sendJson(response, 400, { error: 'Mangler e-post, navn eller klasse.' });
    return;
  }
  if (getUserByEmail(email)) {
    sendJson(response, 409, { error: 'E-post er allerede registrert.' });
    return;
  }

  const russName = typeof body.russName === 'string' ? body.russName.trim() : '';
  const inviteCode = generateInviteCode();
  const inviteCodeHash = await hashSecret(inviteCode);
  const userId = insertUser({
    email,
    name,
    className,
    role,
    russName: russName || null,
    inviteCodeHash,
  });
  const user = getUserById(userId);
  await bridge.ensureJsonUser(user);
  sendJson(response, 201, { user: userPublicShape(user), inviteCode });
}

export async function handleAdminSetRussName(request, response, userIdParam) {
  if (!requireAdmin(request, response)) return;
  const body = await readJsonBody(request);
  const russName = typeof body.russName === 'string' ? body.russName.trim() : '';
  const userId = Number(userIdParam);
  const user = getUserById(userId);
  if (!user) {
    sendJson(response, 404, { error: 'Fant ikke brukeren.' });
    return;
  }
  setUserRussName(userId, russName || null);
  const fresh = getUserById(userId);
  await bridge.ensureJsonUser(fresh);
  sendJson(response, 200, { user: userPublicShape(fresh) });
}

export async function handleAdminRegenerateInvite(request, response, userIdParam) {
  if (!requireAdmin(request, response)) return;
  const userId = Number(userIdParam);
  const user = getUserById(userId);
  if (!user) {
    sendJson(response, 404, { error: 'Fant ikke brukeren.' });
    return;
  }
  const inviteCode = generateInviteCode();
  const inviteCodeHash = await hashSecret(inviteCode);
  updateUserInvite(userId, inviteCodeHash);
  sendJson(response, 200, { user: userPublicShape(getUserById(userId)), inviteCode });
}

export async function handleAdminResetPassword(request, response, userIdParam) {
  if (!requireAdmin(request, response)) return;
  const body = await readJsonBody(request);
  const password = typeof body.password === 'string' ? body.password : '';
  const error = validatePasswordStrength(password);
  if (error) {
    sendJson(response, 400, { error });
    return;
  }
  const userId = Number(userIdParam);
  const user = getUserById(userId);
  if (!user) {
    sendJson(response, 404, { error: 'Fant ikke brukeren.' });
    return;
  }
  const passwordHash = await hashSecret(password);
  setUserPassword(userId, passwordHash, { clearInvite: true });
  deleteSessionsForUser(userId);
  sendJson(response, 200, { user: userPublicShape(getUserById(userId)) });
}

export async function handleAdminSetActive(request, response, userIdParam) {
  if (!requireAdmin(request, response)) return;
  const body = await readJsonBody(request);
  const active = Boolean(body.active);
  const userId = Number(userIdParam);
  const user = getUserById(userId);
  if (!user) {
    sendJson(response, 404, { error: 'Fant ikke brukeren.' });
    return;
  }
  setUserActive(userId, active);
  if (!active) deleteSessionsForUser(userId);
  sendJson(response, 200, { user: userPublicShape(getUserById(userId)) });
}
