const API_BASE = '/api';

async function apiRequest(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return null;
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.error ?? `Klarte ikke å kontakte backend (HTTP ${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export function getStoredSessionToken() {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem('russ-session-token') ?? '';
}

export function storeSessionToken(token) {
  if (typeof window === 'undefined') {
    return;
  }

  if (token) {
    window.localStorage.setItem('russ-session-token', token);
  } else {
    window.localStorage.removeItem('russ-session-token');
  }
}

export function fetchPilotUsers() {
  return apiRequest('/public/pilot-users');
}

export function loginWithCode(code) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: { code },
  });
}

export function loginWithEmailPassword(email, password) {
  return apiRequest('/auth/password-login', {
    method: 'POST',
    body: { email, password },
  });
}

export function logout(token) {
  return apiRequest('/auth/logout', {
    method: 'POST',
    token,
  });
}

export function changeOwnPassword(token, payload) {
  return apiRequest('/auth/password', {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export function deleteOwnAccount(token, payload = {}) {
  return apiRequest('/auth/account', {
    method: 'DELETE',
    token,
    body: payload,
  });
}

export function fetchBootstrap(token) {
  return apiRequest('/bootstrap', { token });
}

export function adminListUsers(token) {
  return apiRequest('/admin/users', { token });
}

export function adminCreateUser(token, payload) {
  return apiRequest('/admin/users', { method: 'POST', token, body: payload });
}

export function adminRegenerateInvite(token, userId) {
  return apiRequest(`/admin/users/${userId}/regenerate-invite`, { method: 'POST', token });
}

export function adminResetPassword(token, userId, password) {
  return apiRequest(`/admin/users/${userId}/password`, {
    method: 'POST',
    token,
    body: { password },
  });
}

export function adminSetUserActive(token, userId, active) {
  return apiRequest(`/admin/users/${userId}/active`, {
    method: 'PATCH',
    token,
    body: { active },
  });
}

export function adminSetUserRussName(token, userId, russName) {
  return apiRequest(`/admin/users/${userId}/russ-name`, {
    method: 'PATCH',
    token,
    body: { russName },
  });
}

export async function readFileAsDataUrl(file) {
  if (!file) {
    return '';
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result?.toString() ?? '');
    reader.onerror = () => reject(new Error('Kunne ikke lese filen.'));
    reader.readAsDataURL(file);
  });
}

export function submitKnot(token, payload) {
  return apiRequest('/submissions', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function reviewSubmission(token, submissionId, status) {
  return apiRequest(`/submissions/${submissionId}/review`, {
    method: 'PATCH',
    token,
    body: {
      status,
    },
  });
}

export function rateSubmission(token, submissionId, rating) {
  return apiRequest(`/submissions/${submissionId}/rating`, {
    method: 'PATCH',
    token,
    body: {
      rating: rating ?? null,
    },
  });
}

export function reportSubmission(token, submissionId, reason, note = '') {
  return apiRequest(`/submissions/${submissionId}/report`, {
    method: 'POST',
    token,
    body: {
      reason,
      note,
    },
  });
}

export function deleteSubmission(token, submissionId) {
  return apiRequest(`/submissions/${submissionId}`, {
    method: 'DELETE',
    token,
  });
}

export function setKnotVisibility(token, submissionId, hidden) {
  return apiRequest(`/submissions/${submissionId}/visibility`, {
    method: 'PATCH',
    token,
    body: { hidden },
  });
}

export function fetchAdminReports(token) {
  return apiRequest('/admin/reports', {
    method: 'GET',
    token,
  });
}

export function reviewReport(token, reportId, action) {
  return apiRequest(`/admin/reports/${reportId}`, {
    method: 'PATCH',
    token,
    body: {
      action,
    },
  });
}

export function createBan(token, payload) {
  return apiRequest('/admin/bans', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function updateKnotFeedbackMessages(token, messages) {
  return apiRequest('/admin/knot-feedback-messages', {
    method: 'PATCH',
    token,
    body: { messages },
  });
}

export function removeBan(token, banId) {
  return apiRequest(`/admin/bans/${banId}`, {
    method: 'DELETE',
    token,
  });
}

export function updateProfile(token, payload) {
  return apiRequest('/profile', {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export function importKnots(token, payload) {
  return apiRequest('/knots/import', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function updateKnotPoints(token, knotId, points) {
  return apiRequest(`/knots/${knotId}/points`, {
    method: 'PATCH',
    token,
    body: { points },
  });
}

export function deleteKnot(token, knotId) {
  return apiRequest(`/knots/${knotId}`, {
    method: 'DELETE',
    token,
  });
}

export function startDuel(token, opponentId) {
  return apiRequest('/duels', {
    method: 'POST',
    token,
    body: { opponentId },
  });
}

export function completeDuel(token, duelId, payload) {
  return apiRequest(`/duels/${duelId}/complete`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export function reviewDuelCompletion(token, duelId, participantId, approved) {
  return apiRequest(`/duels/${duelId}/review`, {
    method: 'PATCH',
    token,
    body: {
      participantId,
      approved,
    },
  });
}

export function resolveDuel(token, duelId) {
  return apiRequest(`/duels/${duelId}/resolve`, {
    method: 'PATCH',
    token,
  });
}

export function claimDuel(token, duelId, { override = false } = {}) {
  return apiRequest(`/duels/${duelId}/claim`, {
    method: 'POST',
    token,
    body: { override },
  });
}

export function releaseDuel(token, duelId) {
  return apiRequest(`/duels/${duelId}/release`, {
    method: 'POST',
    token,
  });
}

export function cancelDuel(token, duelId, { reason }) {
  return apiRequest(`/duels/${duelId}/cancel`, {
    method: 'POST',
    token,
    body: { reason },
  });
}

export function manuallyResolveDuel(token, duelId, { result }) {
  return apiRequest(`/duels/${duelId}/manual-resolve`, {
    method: 'POST',
    token,
    body: { result },
  });
}

export function createComment(token, submissionId, text, parentId = null) {
  return apiRequest(`/submissions/${submissionId}/comments`, {
    method: 'POST',
    token,
    body: { text, parentId },
  });
}

export function deleteComment(token, commentId) {
  return apiRequest(`/comments/${commentId}`, {
    method: 'DELETE',
    token,
  });
}

export function likeComment(token, commentId) {
  return apiRequest(`/comments/${commentId}/like`, {
    method: 'POST',
    token,
  });
}

export function reportComment(token, commentId, reason, note = '') {
  return apiRequest(`/comments/${commentId}/report`, {
    method: 'POST',
    token,
    body: { reason, note },
  });
}
