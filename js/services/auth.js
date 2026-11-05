/* Anmeldung über Supabase Auth (E-Mail + Passwort), ohne externe Bibliothek.
   Rollen: Admin (Tabelle admins) und Spieler (Tabelle spieler_konten, vom Admin freigeschaltet).
   Die Sitzung liegt im localStorage und wird automatisch erneuert. */
import { SUPABASE_URL, SUPABASE_KEY, APP_URL, KEYS } from '../config.js';
import { readJson, writeJson } from '../core/util.js';

let session = readJson(KEYS.auth, null);
let adminFlag = null;
/* Spielerkonto des angemeldeten Nutzers: { spieler_id, status: 'offen' | 'frei' | 'abgelehnt' } oder null */
let account = null;
/* Anzahl offener Anfragen (nur für Admins) */
let pending = 0;
const listeners = new Set();

export const onAuthChange = fn => listeners.add(fn);
const emit = () => listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });

export const currentUser = () => (session && session.user) || null;
export const isLoggedIn = () => !!session;
export const isAdmin = () => adminFlag === true;
export const myAccount = () => account;
/* Freigeschalteter eigener Spieler (oder null) */
export const myPlayer = () => (account && account.status === 'frei' ? account.spieler_id : null);
/* Darf der Nutzer Spiele dieses Spielers nachtragen / bearbeiten? */
export const canManage = playerId => isAdmin() || (!!playerId && myPlayer() === playerId);
export const pendingRequests = () => pending;

function store(s) {
  session = s;
  if (s) writeJson(KEYS.auth, s); else { try { localStorage.removeItem(KEYS.auth); } catch (e) {} }
  adminFlag = null;
  if (!s) { account = null; pending = 0; }
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
  'Email not confirmed': 'Die E-Mail-Adresse ist noch nicht bestätigt.',
  'User already registered': 'Mit dieser E-Mail gibt es schon ein Konto – bitte anmelden.',
  'Signups not allowed for this instance': 'Registrierungen sind gerade abgeschaltet.',
  'Unable to validate email address: invalid format': 'Die E-Mail-Adresse ist ungültig.'
};
const german = e => MESSAGES[e.message] || (/at least \d+ characters/.test(e.message) ? 'Das Passwort ist zu kurz (mindestens 8 Zeichen).' : e.message);

/* Registrieren: der Antrag (welcher Spieler) wird per Datenbank-Trigger aus den Metadaten angelegt */
export async function signup(email, password, spielerId) {
  let d;
  try { d = await authFetch('signup', { email, password, data: { spieler_id: spielerId } }); }
  catch (e) { throw new Error(german(e)); }
  if (d.access_token) { store(fromTokenResponse(d)); await refreshAdminFlag(); return true; }
  if (d.id && d.identities && !d.identities.length) throw new Error(MESSAGES['User already registered']);
  return false; // E-Mail-Bestätigung nötig
}

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

/* Rollen neu laden: Admin-Recht, eigenes Spielerkonto, offene Anfragen (Admin) */
export async function refreshAdminFlag() {
  const t = await accessToken();
  if (!t) { adminFlag = false; account = null; pending = 0; emit(); return false; }
  const headers = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' };
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/is_admin', { method: 'POST', headers, body: '{}' });
    adminFlag = r.ok ? (await r.json()) === true : false;
  } catch (e) { adminFlag = adminFlag === true; }
  try {
    const uid = session && session.user && session.user.id;
    if (uid) {
      const r = await fetch(SUPABASE_URL + '/rest/v1/spieler_konten?select=spieler_id,status&user_id=eq.' + uid, { headers });
      const d = r.ok ? await r.json() : [];
      account = d[0] || null;
    }
    if (adminFlag) {
      const r = await fetch(SUPABASE_URL + '/rest/v1/spieler_konten?select=user_id&status=eq.offen', { headers });
      pending = r.ok ? (await r.json()).length : 0;
    }
  } catch (e) {}
  emit();
  return adminFlag;
}
/* Antrag stellen oder ändern (z. B. nach Ablehnung oder falschem Spieler) */
export async function requestAccount(spielerId) {
  const t = await accessToken(), u = currentUser();
  if (!t || !u) throw new Error('Nicht angemeldet.');
  const headers = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  const r = account
    ? await fetch(SUPABASE_URL + '/rest/v1/spieler_konten?user_id=eq.' + u.id, { method: 'PATCH', headers, body: JSON.stringify({ spieler_id: spielerId, status: 'offen', entschieden_at: null }) })
    : await fetch(SUPABASE_URL + '/rest/v1/spieler_konten', { method: 'POST', headers, body: JSON.stringify({ user_id: u.id, spieler_id: spielerId, email: u.email, status: 'offen' }) });
  if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.message || 'Fehler ' + r.status); }
  await refreshAdminFlag();
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
