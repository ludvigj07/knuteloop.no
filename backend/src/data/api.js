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

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? 'Noe gikk galt mot API-et.');
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

export const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 20;

export function assertVideoWithinLimits(file) {
  if (!file) return;
  if (file.size > MAX_VIDEO_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    const maxMb = MAX_VIDEO_BYTES / 1024 / 1024;
    throw new Error(
      `Videoen er for stor (${mb} MB). Maks ${maxMb} MB. Prøv å filme kortere eller i lavere oppløsning.`,
    );
  }
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

const COMPRESSED_MAX_DIMENSION = 720;
const COMPRESSED_VIDEO_BITRATE = 1_500_000;
const COMPRESSED_AUDIO_BITRATE = 96_000;

function pickCompressedMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  return candidates.find((mime) => MediaRecorder.isTypeSupported?.(mime)) ?? '';
}

export async function convertToMp4(file) {
  if (!file) {
    return null;
  }

  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof MediaRecorder === 'undefined'
  ) {
    return file;
  }

  const mimeType = pickCompressedMimeType();
  if (!mimeType) {
    return file;
  }

  return new Promise((resolve) => {
    const video = document.createElement('video');
    let sourceUrl = '';
    let animationFrameId = null;
    let stopTimer = null;
    let finalized = false;
    let recorder = null;
    let stream = null;

    function finalize(nextFile) {
      if (finalized) return;
      finalized = true;

      if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
      if (stopTimer) clearTimeout(stopTimer);
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);

      resolve(nextFile);
    }

    try {
      sourceUrl = URL.createObjectURL(file);
      video.src = sourceUrl;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', 'true');

      video.onerror = () => finalize(file);
      video.onended = () => recorder?.stop();

      video.onloadedmetadata = async () => {
        try {
          const srcWidth = Math.max(1, video.videoWidth || 720);
          const srcHeight = Math.max(1, video.videoHeight || 1280);
          const scale = Math.min(
            1,
            COMPRESSED_MAX_DIMENSION / Math.max(srcWidth, srcHeight),
          );
          const width = Math.max(1, Math.round(srcWidth * scale));
          const height = Math.max(1, Math.round(srcHeight * scale));

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');

          if (!context) {
            finalize(file);
            return;
          }

          stream = canvas.captureStream(30);
          recorder = new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond: COMPRESSED_VIDEO_BITRATE,
            audioBitsPerSecond: COMPRESSED_AUDIO_BITRATE,
          });
          const chunks = [];

          recorder.ondataavailable = (event) => {
            if (event.data?.size) chunks.push(event.data);
          };
          recorder.onerror = () => finalize(file);
          recorder.onstop = () => {
            if (chunks.length === 0) {
              finalize(file);
              return;
            }

            const isWebm = mimeType.startsWith('video/webm');
            const outputMime = isWebm ? 'video/webm' : 'video/mp4';
            const outputExt = isWebm ? '.webm' : '.mp4';
            const blob = new Blob(chunks, { type: outputMime });

            if (blob.size >= file.size) {
              finalize(file);
              return;
            }

            const nextName = file.name.replace(/\.[^.]+$/, outputExt);
            finalize(new File([blob], nextName, { type: outputMime }));
          };

          const drawFrame = () => {
            if (video.paused || video.ended || finalized) return;
            context.drawImage(video, 0, 0, width, height);
            animationFrameId = window.requestAnimationFrame(drawFrame);
          };

          stopTimer = setTimeout(() => {
            recorder?.state === 'recording' && recorder.stop();
          }, MAX_VIDEO_SECONDS * 1000);

          await video.play();
          drawFrame();
          recorder.start();
        } catch {
          finalize(file);
        }
      };
    } catch {
      finalize(file);
    }
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
