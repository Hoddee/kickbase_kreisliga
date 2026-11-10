/* Kleine Helfer für DOM und Formatierung */
export const $ = id => document.getElementById(id);

export function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
export const fmt = n => (n > 0 ? '+' + n : String(n));
export const cls = n => (n < 0 ? 'neg' : n === 0 ? 'zero' : n >= 15 ? 'hi' : 'pos');
export const tierOf = n => (n < 0 ? 'red' : n < 100 ? 'orange' : n < 200 ? 'lime' : n < 400 ? 'emerald' : 'gold');
export const pad2 = n => (n < 10 ? '0' : '') + n;

export function clock(sec) {
  sec = Math.floor(sec);
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + pad2(s);
}
/* Spielminute im Kickbase-Format (1. Minute = 1’); negative Zeit = ohne Minute */
export const minStamp = t => (t >= 0 ? (Math.floor(t / 60) + 1) + '’' : '');

export function dateShort(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.';
}
export function dateLong(d) { return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.' + d.getFullYear(); }

export const eur = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €';
export const signedEur = n => (n > 0 ? '+' : n < 0 ? '−' : '±') + eur(Math.abs(n));
export const trendClass = d => (d > 0 ? 'up' : d < 0 ? 'down' : 'flat');

/* Deterministischer Zufallswert 0..1 aus einem Text (gleich auf allen Geräten) */
export function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

/* Zu null wie bei den Punkten: kein Gegentor und mindestens 10 Minuten (erster Minutenbonus) */
export const cleanSheet = g => g.them === 0 && (g.minutes || 0) >= 10;

export function randomId(len = 20) {
  const a = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, b => a[b % a.length]).join('');
}

export const reducedMotion = (() => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
})();

/* Zahl animiert hochzählen (Kickbase-Punktzahl) */
export function setNum(el, to) {
  const from = el._v == null ? to : el._v;
  el._v = to;
  el.setAttribute('data-len', String(Math.min(5, String(to).length)));
  cancelAnimationFrame(el._raf);
  if (from === to || reducedMotion) { el.textContent = String(to); return; }
  const t0 = performance.now(), dur = 420;
  const step = now => {
    const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = String(Math.round(from + (to - from) * e));
    if (p < 1) el._raf = requestAnimationFrame(step); else el.textContent = String(to);
  };
  step(t0);
}

export function setSrc(el, url, alt) {
  if (el.getAttribute('data-s') !== url) { el.setAttribute('data-s', url); el.src = url; }
  el.alt = alt || '';
}
export function applyTier(points) { document.body.setAttribute('data-tier', tierOf(points)); }

export function buzz(ms = 15) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

export function readJson(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fallback : v; } catch (e) { return fallback; }
}
export function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }

/* Kurze Rückmeldung am unteren Bildschirmrand */
let toastTimer = 0;
export function toast(msg, kind = '') {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg;
  el.className = 'toast show ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast ' + kind; }, 2600);
}
