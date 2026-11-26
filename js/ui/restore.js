/* Blatt „Laufendes Spiel gefunden“ (Sicherung aus Supabase) und die Diagnose-Karte im Admin-Bereich. Logik: services/backup.js */
import { esc, buzz } from '../core/util.js';
import { PL } from '../data/players.js';
import { CL } from '../data/clubs.js';
import { avatar } from './components.js';
import { startLog } from '../services/backup.js';

export function offerRestore(S, accept, discard) {
  if (document.querySelector('.rs-sheet')) return;
  const ids = S.squad ? S.squad.map(x => x.p) : [S.match.p];
  const goals = k => S.events.filter(e => e.key === k).length, us = goals('tg'), them = goals('cg');
  const acts = (S.squad ? S.squad.map((x, i) => (i === S.cur ? S.events : x.events)) : [S.events]).reduce((n, l) => n + (l || []).filter(e => e.key !== 'tg' && e.key !== 'cg').length, 0);
  const team = (CL[S.match.team] || {}).n || '', opp = (CL[S.match.o] || {}).n || '';
  const el = document.createElement('div');
  el.className = 'sheet-bg rs-sheet';
  el.innerHTML = '<div class="sheet rs" role="dialog" aria-modal="true" aria-labelledby="rsT"><h3 id="rsT">Laufendes Spiel gefunden</h3>' +
    '<div class="rs-m"><b>' + esc(S.match.home ? team : opp) + '</b><span>' + (S.match.home ? us + ' : ' + them : them + ' : ' + us) + '</span><b>' + esc(S.match.home ? opp : team) + '</b></div>' +
    '<div class="rs-ps">' + ids.slice(0, 8).map(id => avatar(id)).join('') + (ids.length > 8 ? '<i>+' + (ids.length - 8) + '</i>' : '') + '</div>' +
    '<small class="rs-n">' + ids.length + ' Spieler · ' + acts + (acts === 1 ? ' Aktion' : ' Aktionen') + (S.squad ? '' : ' · ' + esc((PL[S.match.p] || {}).n || '')) + '</small>' +
    '<button type="button" class="btn primary full" data-rs="ok">Wiederherstellen</button><button type="button" class="btn full ghost" data-rs="no">Verwerfen</button></div>';
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-rs]');
    if (!b) return;
    buzz(10); el.remove();
    if (b.dataset.rs === 'ok') accept(); else discard();
  });
  document.body.appendChild(el);
}

/* Admin: was die App bei den letzten Starts vorgefunden hat */
const two = n => (n < 10 ? '0' : '') + n;
export async function diagHtml() {
  const list = await startLog();
  if (!list.length) return '';
  return '<div class="card rsd"><b>Spielspeicher · letzte Starts</b><ul>' + list.slice(0, 8).map(x => {
    const d = new Date(x.t);
    return '<li><span>' + two(d.getDate()) + '.' + two(d.getMonth() + 1) + '. ' + two(d.getHours()) + ':' + two(d.getMinutes()) + '</span><span>Handy ' + esc(x.ls) + ' · IDB ' + esc(x.idb) + ' · Cloud ' + esc(x.cloud) + (x.act ? ' · <b>' + esc(x.act) + '</b>' : '') + '</span></li>';
  }).join('') + '</ul></div>';
}
