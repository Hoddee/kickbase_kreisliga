/* „Mein Bereich“ für freigeschaltete Spieler: Stand, Rivalen, nächstes Spiel, Vergleich mit dem Team,
   Erfolge (Bronze/Silber/Gold mit Fortschritt) und persönliche Rekorde. Alles wird aus den gespeicherten Spielen berechnet. */
import { $, esc, eur, signedEur, trendClass, tierOf, pad2, applyTier } from '../core/util.js';
import { PL, PLAYER_LIST, photoUrl, fullName } from '../data/players.js';
import { CL, crestUrl } from '../data/clubs.js';
import { nextFixture } from '../data/schedule.js';
import { marketOf, byDate } from '../core/market.js';
import { games, loadGames } from '../services/api.js';
import { myPlayer, isLoggedIn } from '../services/auth.js';
import { sparkline } from './components.js';
import { registerView, show, nav } from '../router.js';
import { requestNewGame } from './start.js';
import { openSetup } from './setup.js';
import { openProfile } from './profile.js';

const gamesOf = id => byDate((games.list || []).filter(g => g.player === id));
const sum = (l, f) => l.reduce((s, g) => s + f(g), 0);

/* Tabelle: Gesamtpunkte aller Spieler mit mindestens einem Spiel */
export function standings() {
  const by = new Map();
  for (const g of games.list || []) by.set(g.player, (by.get(g.player) || 0) + g.points);
  return [...by].map(([p, t]) => ({ p, t })).sort((a, b) => b.t - a.t);
}

/* Längste Serie aufeinanderfolgender Spiele mit mindestens 100 Punkten */
function bestStreak(l) {
  let best = 0, cur = 0;
  for (const g of l) { cur = g.points >= 100 ? cur + 1 : 0; best = Math.max(best, cur); }
  return best;
}

/* Erfolge: [Symbol, Name, Wert, Stufen Bronze/Silber/Gold] – eine einzelne Stufe ist ein Special.
   Torhüter bekommen statt Torjäger/Vorbereiter den Special „Torwart-Scorer“. */
function achievements(l, keeper) {
  const scorer = keeper
    ? [['🧤', 'Torwart-Scorer', sum(l, g => (g.goals || 0) + (g.assists || 0)), [1]]]
    : [['⚽', 'Torjäger', sum(l, g => g.goals || 0), [1, 5, 15]], ['🎯', 'Vorbereiter', sum(l, g => g.assists || 0), [1, 5, 10]]];
  return [
    ['👟', 'Stammkraft', l.length, [3, 10, 20]],
    ...scorer,
    ['⭐', 'Punktesammler', sum(l, g => g.points), [500, 1500, 4000]],
    ['🔥', 'Sternstunde', l.length ? Math.max(...l.map(g => g.points)) : 0, [150, 250, 400]],
    ['🛡️', 'Weiße Weste', l.filter(g => g.them === 0 && g.minutes >= 45).length, [1, 3, 8]],
    ['🏆', 'Siegertyp', l.filter(g => g.us > g.them && g.minutes > 0).length, [1, 5, 12]],
    ['⏱️', 'Dauerbrenner', l.filter(g => g.minutes >= 90).length, [1, 5, 12]],
    ['📈', 'Formstark', bestStreak(l), [2, 4, 6]]
  ];
}
const TIER = ['Bronze', 'Silber', 'Gold'];
/* Kurze Erklärung nur als Tooltip, damit die Liste ruhig bleibt */
const HOW = { Stammkraft: 'Spiele', 'Torwart-Scorer': 'Tor oder Vorlage als Torwart', Torjäger: 'Tore', Vorbereiter: 'Vorlagen', Punktesammler: 'Gesamtpunkte', Sternstunde: 'Punkte in einem Spiel', 'Weiße Weste': 'Spiele zu null', Siegertyp: 'Siege', Dauerbrenner: 'Spiele über 90 Min.', Formstark: 'Spiele in Folge mit 100+' };

function achHtml(a) {
  const [icon, name, v, steps] = a, special = steps.length === 1;
  const level = steps.filter(s => v >= s).length, next = steps[level];
  const from = level ? steps[level - 1] : 0;
  const pct = next ? Math.min(100, Math.round(((v - from) / (next - from)) * 100)) : 100;
  const cls = special ? (level ? 'lv3 sp' : 'lv0 sp') : 'lv' + level;
  const tag = special ? (level ? 'Special' : '') : level ? TIER[level - 1] : '';
  return '<li class="ach ' + cls + '" title="' + esc(HOW[name] || '') + '"><span class="ach-i" aria-hidden="true">' + icon + '</span><div><b>' + esc(name) + (tag ? ' <i class="ach-t">' + tag + '</i>' : '') + '</b>' +
    '<small>' + (next ? v + ' / ' + next : '✓') + '</small><span class="ach-bar"><i style="width:' + pct + '%"></i></span></div></li>';
}

const daysUntil = d => { const a = new Date(); a.setHours(0, 0, 0, 0); const b = new Date(d); b.setHours(0, 0, 0, 0); return Math.round((b - a) / 864e5); };
const whenText = d => { const n = daysUntil(d); return n <= 0 ? 'Heute' : n === 1 ? 'Morgen' : 'in ' + n + ' Tagen'; };

function html() {
  const id = myPlayer();
  if (!id || !PL[id]) return '<p class="hmsg">Nur für freigeschaltete Spieler.</p>';
  if (!games.list) return '<p class="hmsg">Lädt …</p>';
  const p = PL[id], l = gamesOf(id), mw = marketOf(id, games.list), table = standings();
  const rank = table.findIndex(x => x.p === id), mine = rank >= 0 ? table[rank].t : 0;
  const avg = l.length ? Math.round(sum(l, g => g.points) / l.length) : null;

  /* Kopf: Foto, Name, Platz, Marktwert */
  let h = '<section class="mehero tc" data-tier="' + tierOf(avg || 0) + '"><div class="me-t"><small>Mein Bereich</small><h1>' + esc(p.vn || '') + '<b>' + esc(p.n) + '</b></h1>' +
    '<div class="me-chips">' + (rank >= 0 ? '<span class="me-rank">#' + (rank + 1) + '<em> von ' + table.length + '</em></span>' : '<span class="me-rank">Noch ohne Spiel</span>') + '</div>' +
    '<div class="me-mw"><span>' + eur(mw.v) + '</span><em class="' + trendClass(mw.last) + '">' + (mw.last > 0 ? '▲ ' : mw.last < 0 ? '▼ ' : '') + signedEur(mw.last) + '</em></div></div>' +
    '<img class="me-ph" src="' + esc(photoUrl(id)) + '" alt="">' + '<div class="me-sp">' + sparkline(mw.series) + '</div></section>';

  /* Rivalen */
  if (rank >= 0 && table.length > 1) {
    const above = rank > 0 ? table[rank - 1] : null, below = table[rank + 1] || null;
    h += '<h2>Tabelle</h2><div class="card rival">';
    if (above) {
      const gap = above.t - mine, pct = Math.max(6, Math.min(96, Math.round((mine / Math.max(1, above.t)) * 100)));
      h += '<div class="rv-l"><span><b>−' + gap + '</b> bis Platz ' + rank + '</span><button type="button" class="rv-n" data-me="p:' + esc(above.p) + '">' + esc(PL[above.p].n) + ' ›</button></div>' +
        '<div class="rv-bar"><i style="width:' + pct + '%"></i><img src="' + esc(photoUrl(above.p, true)) + '" alt=""></div>';
    } else h += '<div class="rv-l"><span>🥇 <b>Platz 1</b>' + (below ? ' · +' + (mine - below.t) : '') + '</span></div>';
    if (below) h += '<p class="rv-b">Dahinter: <button type="button" class="lnk inline" data-me="p:' + esc(below.p) + '">' + esc(PL[below.p].n) + '</button> (' + (below.t - mine) + ')</p>';
    h += '</div>';
  }

  /* Nächstes Spiel */
  const fx = nextFixture(p.c);
  if (fx) {
    const ho = fx.home ? fx.team : fx.o, aw = fx.home ? fx.o : fx.team;
    h += '<h2>Nächstes Spiel</h2><div class="card menext"><div class="mn-top"><span class="mn-cd">' + whenText(fx.at) + '</span><span class="muted small">' +
      fx.at.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' · ' + pad2(fx.at.getHours()) + ':' + pad2(fx.at.getMinutes()) + ' Uhr</span></div>' +
      '<div class="mn-m"><img src="' + esc(crestUrl(ho)) + '" alt=""><span>' + esc(CL[ho].n) + '<i>vs</i>' + esc(CL[aw].n) + '</span><img src="' + esc(crestUrl(aw)) + '" alt=""></div>' +
      '<div class="duo"><button type="button" class="btn primary" data-me="live">Live bewerten</button><button type="button" class="btn" data-me="manual">Nachtragen</button></div></div>';
  } else h += '<div class="duo" style="margin-top:16px"><button type="button" class="btn primary" data-me="live">Spiel bewerten</button><button type="button" class="btn" data-me="manual">Nachtragen</button></div>';

  /* Du gegen dein Team */
  if (l.length) {
    const mates = PLAYER_LIST.filter(x => x.c === p.c).map(x => x.id), tg = (games.list || []).filter(g => mates.includes(g.player));
    const rows = [
      ['Ø Punkte', avg, tg.length ? Math.round(sum(tg, g => g.points) / tg.length) : 0],
      ['Ø Minuten', Math.round(sum(l, g => g.minutes) / l.length), tg.length ? Math.round(sum(tg, g => g.minutes) / tg.length) : 0],
      ['Scorer / Spiel', +(sum(l, g => (g.goals || 0) + (g.assists || 0)) / l.length).toFixed(1), tg.length ? +(sum(tg, g => (g.goals || 0) + (g.assists || 0)) / tg.length).toFixed(1) : 0]
    ];
    h += '<h2>Du vs. Team</h2><div class="card vs"><div class="vs-lg"><span><i class="me"></i>Du</span><span><i></i>' + esc(CL[p.c].n) + '</span></div>' + rows.map(([n, a, b]) => {
      const max = Math.max(a, b, 0.1), win = a >= b;
      return '<div class="vs-r"><div class="vs-h"><span>' + n + '</span><b class="' + (win ? 'up' : 'down') + '">' + String(a).replace('.', ',') + '</b><em>Team ' + String(b).replace('.', ',') + '</em></div>' +
        '<div class="vs-b"><i class="me" style="width:' + Math.max(3, Math.round((Math.max(0, a) / max) * 100)) + '%"></i></div><div class="vs-b"><i style="width:' + Math.max(3, Math.round((Math.max(0, b) / max) * 100)) + '%"></i></div></div>';
    }).join('') + '</div>';
  }

  /* Erfolge */
  const ach = achievements(l, p.pos === 'TW'), done = ach.reduce((s, a) => s + a[3].filter(x => a[2] >= x).length, 0), all = ach.reduce((s, a) => s + a[3].length, 0);
  h += '<h2>Erfolge <i class="nb">' + done + '/' + all + '</i></h2><ul class="achs">' + ach.map(achHtml).join('') + '</ul>';

  /* Rekorde */
  if (l.length) {
    const best = l.reduce((a, g) => (g.points > a.points ? g : a)), goals = l.reduce((a, g) => ((g.goals || 0) > (a.goals || 0) ? g : a));
    const peak = mw.series.reduce((a, x) => (x.v > a.v ? x : a));
    const opp = g => (CL[g.opp] ? 'vs ' + CL[g.opp].n : '');
    const rec = (t, v, sub, link) => '<button type="button" class="mrec"' + (link ? ' data-open="g:' + esc(link) + '"' : ' disabled') + '><span>' + t + '</span><b>' + v + '</b><small>' + esc(sub) + '</small></button>';
    h += '<h2>Persönliche Rekorde</h2><div class="mrecs">' +
      rec('Bestes Spiel', best.points + ' Pkt.', opp(best), best.uid) +
      rec('Meiste Tore', String(goals.goals || 0), goals.goals ? opp(goals) : '–', goals.goals ? goals.uid : null) +
      rec('Höchster MW', eur(peak.v), peak.g ? opp(peak.g) : 'Startwert', peak.g ? peak.g.uid : null) +
      rec('Beste Serie', String(bestStreak(l)), 'Spiele 100+', null) + '</div>';
  }
  h += '<div class="duo" style="margin-top:22px"><button type="button" class="btn" data-me="profile">Profil</button><button type="button" class="btn" data-me="konto">Konto</button></div>';
  return h;
}

export function render() {
  if (!games.list && !games.busy) loadGames().then(() => { if (nav.current === 'me') render(); });
  $('meBody').innerHTML = html();
  applyTier(0);
}

export function initMe() {
  registerView('me', { elements: ['me'], render, guard: () => (isLoggedIn() && myPlayer() ? null : 'admin') });
  $('me').addEventListener('click', e => {
    const b = e.target.closest('[data-me]');
    if (!b) return;
    const k = b.dataset.me, id = myPlayer();
    if (k === 'live') requestNewGame({ player: id });
    else if (k === 'manual') openSetup(null, { manual: true, player: id });
    else if (k === 'profile') openProfile(id);
    else if (k === 'konto') show('admin');
    else if (k.startsWith('p:')) openProfile(k.slice(2));
  });
}
