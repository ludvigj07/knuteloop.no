const API_BASE = process.env.RUSS_API_BASE ?? 'http://localhost:3001/api';
const USER_CODE = process.env.RUSS_SMOKE_USER_CODE ?? 'EMIL2026';
const ADMIN_CODE = process.env.RUSS_SMOKE_ADMIN_CODE ?? 'SOFIE2026';
const INITIAL_RATING = 5;
const UPDATED_RATING = 3;

async function apiRequest(path, { method = 'GET', token, body } = {}) {
  const response = await globalThis.fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.error ?? `${method} ${path} feilet med status ${response.status}`);
  }

  return payload;
}

function logStep(message) {
  console.log(`* ${message}`);
}

logStep('Sjekker helse-endepunkt');
await apiRequest('/health');

logStep('Henter pilotbrukere');
await apiRequest('/public/pilot-users');

logStep(`Logger inn som bruker ${USER_CODE}`);
const userLogin = await apiRequest('/auth/login', {
  method: 'POST',
  body: { code: USER_CODE },
});
const userToken = userLogin?.token;

logStep('Henter bootstrap for bruker');
const userBootstrap = await apiRequest('/bootstrap', { token: userToken });
const knotToSubmit = userBootstrap?.knots?.find(
  (knot) =>
    knot?.status === 'Tilgjengelig' ||
    knot?.status === 'Avslått' ||
    knot?.status === 'Avslaatt',
);

if (!knotToSubmit) {
  throw new Error('Fant ingen tilgjengelig knute å bruke i smoke-testen.');
}

logStep(`Sender inn knuten "${knotToSubmit?.title}"`);
await apiRequest('/submissions', {
  method: 'POST',
  token: userToken,
  body: {
    knotId: knotToSubmit?.id,
    note: `Smoke-test ${new Date().toISOString()}`,
    postToFeed: true,
  },
});

logStep(`Logger inn som admin ${ADMIN_CODE}`);
const adminLogin = await apiRequest('/auth/login', {
  method: 'POST',
  body: { code: ADMIN_CODE },
});
const adminToken = adminLogin?.token;

logStep('Henter bootstrap for admin');
const adminBootstrap = await apiRequest('/bootstrap', { token: adminToken });
const pendingSubmission = adminBootstrap?.submissions?.find(
  (submission) =>
    submission?.knotId === knotToSubmit?.id &&
    submission?.leaderId === userLogin?.user?.id &&
    submission?.status === 'Venter',
);

if (!pendingSubmission) {
  throw new Error('Fant ikke ventende innsending etter bruker-send inn.');
}

logStep('Godkjenner innsending som admin');
await apiRequest(`/submissions/${pendingSubmission?.id}/review`, {
  method: 'PATCH',
  token: adminToken,
  body: { status: 'Godkjent' },
});

const approvedSubmissionId = pendingSubmission?.id;

if (!approvedSubmissionId) {
  throw new Error('Fant ikke innsending å bruke i rating-testen.');
}

logStep(`Legger inn rating (${INITIAL_RATING} stjerner) på godkjent innsending`);
await apiRequest(`/submissions/${approvedSubmissionId}/rating`, {
  method: 'PATCH',
  token: userToken,
  body: { rating: INITIAL_RATING },
});

logStep('Verifiserer myRating, ratingAverage og ratingCount etter rating');
const ratedBootstrap = await apiRequest('/bootstrap', { token: userToken });
const ratedSubmission = ratedBootstrap?.submissions?.find(
  (submission) => submission?.id === approvedSubmissionId,
);
const ratingCountAfterAdd = ratedSubmission?.ratingCount ?? 0;
const ratingAverageAfterAdd = ratedSubmission?.ratingAverage ?? 0;

if (!ratedSubmission) {
  throw new Error('Fant ikke innsendingen etter at rating ble lagt til.');
}

if (ratedSubmission?.myRating !== INITIAL_RATING) {
  throw new Error('myRating ble ikke satt riktig etter rating.');
}

if (ratingCountAfterAdd < 1) {
  throw new Error('ratingCount ble ikke oppdatert etter rating.');
}

if (Math.abs(ratingAverageAfterAdd - INITIAL_RATING) > 0.001) {
  throw new Error('ratingAverage ble ikke korrekt etter første rating.');
}

logStep(`Oppdaterer rating til ${UPDATED_RATING} stjerner`);
await apiRequest(`/submissions/${approvedSubmissionId}/rating`, {
  method: 'PATCH',
  token: userToken,
  body: { rating: UPDATED_RATING },
});

logStep('Verifiserer at rating ble oppdatert');
const updatedBootstrap = await apiRequest('/bootstrap', { token: userToken });
const updatedSubmission = updatedBootstrap?.submissions?.find(
  (submission) => submission?.id === approvedSubmissionId,
);
const ratingCountAfterUpdate = updatedSubmission?.ratingCount ?? 0;
const ratingAverageAfterUpdate = updatedSubmission?.ratingAverage ?? 0;

if (!updatedSubmission) {
  throw new Error('Fant ikke innsendingen etter at rating ble oppdatert.');
}

if (updatedSubmission?.myRating !== UPDATED_RATING) {
  throw new Error('myRating ble ikke oppdatert etter ny rating.');
}

if (ratingCountAfterUpdate !== ratingCountAfterAdd) {
  throw new Error('ratingCount skal ikke endre seg når samme bruker rerater.');
}

if (Math.abs(ratingAverageAfterUpdate - UPDATED_RATING) > 0.001) {
  throw new Error('ratingAverage ble ikke korrekt etter oppdatert rating.');
}

logStep('Logger ut bruker og admin');
await apiRequest('/auth/logout', { method: 'POST', token: userToken });
await apiRequest('/auth/logout', { method: 'POST', token: adminToken });

console.log(
  'Smoke-test fullført: login, bootstrap, submission, review og ratingflyt fungerer.',
);
