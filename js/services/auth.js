/* Admin-Login über Supabase Auth (E-Mail + Passwort), ohne externe Bibliothek.
   Die Sitzung liegt im localStorage und wird automatisch erneuert. */
import { SUPABASE_URL, SUPABASE_KEY, APP_URL, KEYS } from '../config.js';
import { readJson, writeJson } from '../core/util.js';

let session = readJson(KEYS.auth, null);
let adminFlag = null;
const listeners = new Set();

export const onAuthChange = fn => listeners.add(fn);
const emit = () => listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });

export const currentUser = () => (session && session.user) || null;
export const isLoggedIn = () => !!session;
export const isAdmin = () => adminFlag === true;

function store(s) {
  session = s;
  if (s) writeJson(KEYS.auth, s); else { try { localStorage.removeItem(KEYS.auth); } catch (e) {} }
  adminFlag = null;
  emit();
}
function fromTokenResponse(d) {
  return {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: d.expires_at ? d.expires_at * 1000 : Date.now() + (d.expires_in || 3600) * 1000,
    user: d.user ? { id: d.user.id, email: d.user.email } : (session && session.user)
  };
}

async function authFetch(path, body, token, method = 'POST') {
  const headers = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(SUPABASE_URL + '/auth/v1/' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = d.msg || d.error_description || d.message || d.error || ('Fehler ' + r.status);
    const e = new Error(msg); e.status = r.status; throw e;
  }
  return d;
}

const MESSAGES = {
  'Invalid login credentials': 'E-Mail oder Passwort stimmt nicht.',
  'Email not confirmed': 'Die E-Mail-Adresse ist noch nicht bestätigt.'
};
const german = e => MESSAGES[e.message] || e.message;

export async function login(email, password) {
  try {
    const d = await authFetch('token?grant_type=password', { email, password });
    store(fromTokenResponse(d));
    await refreshAdminFlag();
  } catch (e) { throw new Error(german(e)); }
}

export async function logout() {
  const t = session && session.access_token;
  store(null);
  if (t) { try { await authFetch('logout', null, t); } catch (e) {} }
}

async function refresh() {
  if (!session || !session.refresh_token) return null;
  try {
    const d = await authFetch('token?grant_type=refresh_token', { refresh_token: session.refresh_token });
    store(fromTokenResponse(d));
  } catch (e) {
    if (e.status >= 400 && e.status < 500) store(null); // Sitzung abgelaufen
  }
  return session;
}

/* Gültiges Zugriffstoken (erneuert es kurz vor Ablauf) */
export async function accessToken() {
  if (!session) return null;
  if (Date.now() > session.expires_at - 60000) await refresh();
  return session ? session.access_token : null;
}

export async function refreshAdminFlag() {
  const t = await accessToken();
  if (!t) { adminFlag = false; emit(); return false; }
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/is_admin', {
      method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: '{}'
    });
    adminFlag = r.ok ? (await r.json()) === true : false;
  } catch (e) { adminFlag = adminFlag === true; }
  emit();
  return adminFlag;
}

/* "Passwort vergessen": Supabase schickt einen Link, der zurück in die App führt */
export async function requestPasswordReset(email) {
  await authFetch('recover?redirect_to=' + encodeURIComponent(APP_URL), { email });
}
export async function updatePassword(password) {
  const t = await accessToken();
  if (!t) throw new Error('Nicht angemeldet.');
  try { await authFetch('user', { password }, t, 'PUT'); } catch (e) { throw new Error(german(e)); }
}

/* Rücksprung aus einer E-Mail (Passwort zurücksetzen / Einladung): Token aus der URL übernehmen */
export function consumeRedirect() {
  const h = location.hash.replace(/^#/, '');
  if (!h.includes('access_token=') && !h.includes('error=')) return null;
  const q = new URLSearchParams(h);
  history.replaceState(null, '', location.pathname + location.search);
  if (q.get('error')) return { error: q.get('error_description') || q.get('error') };
  store({
    access_token: q.get('access_token'),
    refresh_token: q.get('refresh_token'),
    expires_at: Date.now() + (+q.get('expires_in') || 3600) * 1000,
    user: null
  });
  authFetch('user', null, q.get('access_token'), 'GET')
    .then(u => { if (session) { session.user = { id: u.id, email: u.email }; writeJson(KEYS.auth, session); emit(); } })
    .catch(() => {});
  return { type: q.get('type') || 'login' };
}
