/* Mitbuch-Modus in der Punktevergabe: Karte „Mitbuchen“ (Gastgeber: QR-Code und Mitbucher, Mitbucher: eigene Spieler),
   Hinweis bei gesperrten Spielern und der Einstieg über den Link. Logik und Übertragung: services/mit.js */
import { esc, buzz, toast, shareLink } from '../core/util.js';
import { qrSvg } from '../core/qr.js';
import { PL } from '../data/players.js';
import { store, eachPlayer, uidAt, mineAt, isMulti } from '../core/game.js';
import {
  MAX_HELPERS, hosting, helpers, joinUrl, startHosting, stopHosting, kick, takeBack, lockOf, helping, helperConn, lockPlayer,
  join, leave, linkParam, savedJoin, resumeHosting, onMit
} from '../services/mit.js';
import { avatar } from './components.js';
import { recorderName, askName } from './setup.js';
import { show, nav } from '../router.js';

const ui = { qr: false };
export { helping, hosting };

/* ---------- Gastgeber ---------- */
export function hostCardHtml() {
  const S = store.S;
  if (S.manual || S.ended || S.remote) return '';
  if (!hosting()) return '<h2>Mitbuchen</h2><button type="button" class="btn full mt-go" data-mt="host">Mitbucher einladen</button>';
  const hs = helpers(), showQr = ui.qr || !hs.length;
  let h = '<h2>Mitbuchen · ' + hs.length + '/' + MAX_HELPERS + '</h2><div class="card mt-card">';
  if (showQr && hs.length < MAX_HELPERS) h += '<div class="mt-qr">' + qrSvg(joinUrl()) + '</div><button type="button" class="btn full" data-mt="link">Link teilen</button>';
  else if (hs.length < MAX_HELPERS) h += '<button type="button" class="btn full" data-mt="qr">QR-Code zeigen</button>';
  if (hs.length) h += '<ul class="mt-devs">' + hs.map(x => '<li><b>' + esc(x.n) + '</b><small>' + (x.ps ? x.ps + ' Spieler' : 'noch kein Spieler') + '</small>' +
    '<button type="button" class="mt-x" data-mt="kick:' + esc(x.d) + '" aria-label="' + esc(x.n) + ' entfernen">×</button></li>').join('') + '</ul>';
  return h + '<button type="button" class="lnk inline mt-stop" data-mt="stop">Mitbuchen beenden</button></div>';
}

/* ---------- Mitbucher ---------- */
export function helperCardHtml() {
  const S = store.S;
  const rows = eachPlayer(i => {
    const P = store.S, u = P.uid, by = lockOf(u), mine = mineAt(i);
    return '<button type="button" class="mt-p" data-mt="lk:' + esc(u) + '" aria-pressed="' + mine + '">' + avatar(P.match.p) +
      '<span><b>' + esc(PL[P.match.p].n) + '</b><small>' + (mine ? 'Du' : esc(by)) + '</small></span><i class="mt-ck" aria-hidden="true"></i></button>';
  });
  return '<h2>Deine Spieler</h2><div class="mt-ps">' + rows.join('') + '</div>' +
    (helperConn() ? '' : '<div class="mt-off">Keine Verbindung</div>') +
    '<div class="mt-host">Gastgeber: ' + esc(S.hostN || '–') + '</div>' +
    '<button type="button" class="btn full danger mt-leave" data-mt="leave">Mitbuchen verlassen</button>';
}

/* Hinweis über den Aktionen, wenn ein anderes Gerät den Spieler bucht */
export function lockBannerHtml() {
  const S = store.S, by = lockOf(uidAt(isMulti() ? S.cur : 0));
  if (!by) return '';
  return '<div class="mt-lock"><span>Bucht gerade <b>' + esc(by) + '</b></span><button type="button" class="btn sm" data-mt="take">Übernehmen</button></div>';
}
/* Darf dieses Gerät für den aktuellen Spieler buchen? (Tore immer) */
export const blocked = () => !!lockOf(uidAt(isMulti() ? store.S.cur : 0));

/* ---------- Klicks ---------- */
let rerender = () => {};
function onClick(e) {
  const b = e.target.closest('[data-mt]');
  if (!b) return;
  const v = b.getAttribute('data-mt'), S = store.S;
  buzz(8);
  if (v === 'host') { startHosting(); ui.qr = true; }
  else if (v === 'qr') ui.qr = !ui.qr;
  else if (v === 'link') { shareLink(joinUrl(), 'Mitbuchen', 'Mitbuchen bei ' + (S.by || 'mir')); return; }
  else if (v === 'stop') stopHosting();
  else if (v.startsWith('kick:')) kick(v.slice(5));
  else if (v === 'take') {
    const u = uidAt(isMulti() ? S.cur : 0);
    if (S.remote) lockPlayer(u, true); else takeBack(u);
  }
  else if (v.startsWith('lk:')) { const u = v.slice(3); lockPlayer(u, !(S.mine || []).includes(u)); }
  else if (v === 'leave') { leave(); return; }
  rerender();
}

/* Einstieg über den Link (?mit=…): Name klären, verbinden, Punktevergabe öffnen */
function startJoin(p) {
  const go = n => {
    toast('Verbinde …');
    join(p.gid, p.code, n, () => { show('edit'); });
  };
  const n = recorderName();
  if (n) go(n); else askName(go);
}

export function initMit(onRender) {
  rerender = onRender;
  document.addEventListener('click', onClick);
  onMit(what => {
    if (what === 'left') { if (['edit', 'home'].includes(nav.current)) show('start', { tab: true }); return; }
    if (what === 'first') ui.qr = false;
    if (what === 'devs' && hosting() && helpers().length) ui.qr = false;
    if (what !== 'beat' || helping()) rerender(what);
  });
  resumeHosting();
  const p = linkParam();
  if (p) {
    try { const u = new URL(location.href); u.searchParams.delete('mit'); history.replaceState(null, '', u.pathname + u.search); } catch (e) {}
    /* Eigenes Spiel ist gerade offen: nicht einfach darüber legen */
    const S = store.S;
    if (S.match && !S.ended && S.mit && p.gid === (isMulti() ? S.squad[0].uid : S.uid)) return;
    startJoin(p);
    return;
  }
  const s = savedJoin();
  if (s) startJoin(s);
}
