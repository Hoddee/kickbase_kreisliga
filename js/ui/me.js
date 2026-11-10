/* „Mein Bereich“ für freigeschaltete Spieler: Stand, Rivalen, nächstes Spiel, Vergleich mit dem Team,
   Erfolge (Bronze/Silber/Gold mit Fortschritt) und persönliche Rekorde. Alles wird aus den gespeicherten Spielen berechnet. */
import { $, esc, eur, signedEur, trendClass, tierOf, pad2, applyTier, cleanSheet } from '../core/util.js';
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
/* Linien-Symbole für die Abzeichen */
const AI = {
  boot: '<path d="M6 8h6l1 5 6 2a2 2 0 0 1 1 2v1H6z"/><path d="M6 18v1M10 18v1M14 18v1"/>',
  ball: '<circle cx="12" cy="12" r="7.5"/><path d="M12 8.5l3 2.2-1.1 3.6h-3.8L9 10.7z"/>',
  assist: '<path d="M4 17c4-8 10-10 16-10"/><path d="M16 4l4 3-4 3"/>',
  star: '<path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z"/>',
  flame: '<path d="M12 21c-4 0-6-2.6-6-6 0-4 4-6 4-10 3 2 4 4 4 6 1-1 1.5-2 1.5-3 2.5 2 4.5 4.5 4.5 7 0 3.4-3 6-8 6z"/>',
  wall: '<path d="M4 7h16v12H4zM4 11h16M4 15h16M9 7v4M15 7v4M12 11v4M8 15v4M16 15v4"/>',
  cup: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/>',
  clock: '<circle cx="12" cy="13" r="7"/><path d="M12 9v4l2.5 2M10 3h4"/>',
  trend: '<path d="M4 17l5-5 3 3 7-7M14 8h5v5"/>',
  glove: '<path d="M8 21v-5L5 12a1.5 1.5 0 0 1 2.3-2L9 12V5a1.3 1.3 0 0 1 2.6 0v5-6a1.3 1.3 0 0 1 2.6 0v6-5a1.3 1.3 0 0 1 2.6 0v8l-1 4v4z"/>'
};
function achievements(l, keeper) {
  const scorer = keeper
    ? [['glove', 'Torwart-Scorer', sum(l, g => (g.goals || 0) + (g.assists || 0)), [1]]]
    : [['ball', 'Torjäger', sum(l, g => g.goals || 0), [1, 5, 15]], ['assist', 'Vorbereiter', sum(l, g => g.assists || 0), [1, 5, 10]]];
  return [
    ['boot', 'Stammkraft', l.length, [3, 10, 20]],
    ...scorer,
    ['star', 'Punktesammler', sum(l, g => g.points), [500, 1500, 4000]],
    ['flame', 'Sternstunde', l.length ? Math.max(...l.map(g => g.points)) : 0, [150, 250, 400]],
    ['wall', 'Weiße Weste', l.filter(cleanSheet).length, [1, 3, 8]],
    ['cup', 'Siegertyp', l.filter(g => g.us > g.them && g.minutes > 0).length, [1, 5, 12]],
    ['clock', 'Dauerbrenner', l.filter(g => g.minutes >= 90).length, [1, 5, 12]],
    ['trend', 'Formstark', bestStreak(l), [2, 4, 6]]
  ];
}
const TIER = ['Bronze', 'Silber', 'Gold'];
const HOW = { Stammkraft: 'Spiele', 'Torwart-Scorer': 'Tor oder Vorlage als Torwart', Torjäger: 'Tore', Vorbereiter: 'Vorlagen', Punktesammler: 'Gesamtpunkte', Sternstunde: 'Punkte in einem Spiel', 'Weiße Weste': 'Spiele zu null', Siegertyp: 'Siege', Dauerbrenner: 'Spiele über 90 Min.', Formstark: 'Spiele in Folge mit 100+' };
/* Schild-Formen: Bronze unten rund, Silber spitz, Gold spitz mit Zacken oben */
const SHIELD = [
  'M32 4l24 8v24c0 15-10 26-24 32C18 62 8 51 8 36V12z',
  'M32 4l24 8v26c0 12-11 22-24 30C19 60 8 50 8 38V12z',
  'M32 4l24 8v24c0 15-10 26-24 32C18 62 8 51 8 36V12z',
  'M8 10l8-4 8 4 8-6 8 6 8-4 8 4v26c0 15-10 26-24 32C18 62 8 51 8 36z'
];
function achHtml(a) {
  const [icon, name, v, steps] = a, special = steps.length === 1;
  const level = steps.filter(s => v >= s).length, next = steps[level];
  const cls = special ? (level ? 'lv3 sp' : 'lv0 sp') : 'lv' + level;
  const tag = special ? 'Special' : level ? TIER[level - 1] : 'Gesperrt';
  return '<li class="shb ' + cls + '" title="' + esc((HOW[name] || '') + (next ? ': ' + v + ' / ' + next : '')) + '">' +
    '<svg viewBox="0 0 64 72" aria-hidden="true"><path class="sh-o" d="' + SHIELD[special && level ? 3 : level] + '"/><path class="sh-i" d="' + SHIELD[special && level ? 3 : level] + '" transform="translate(32 36) scale(.8) translate(-32 -36)"/>' +
    '<g transform="translate(18 21) scale(1.17)">' + AI[icon] + '</g></svg>' +
    '<b>' + esc(name) + '</b><small>' + (next ? v + ' / ' + next : tag) + '</small></li>';
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
  h += '<h2>Erfolge <i class="nb">' + done + '/' + all + '</i></h2><ul class="shbs">' + ach.map(achHtml).join('') + '</ul>';

  /* Rekorde */
  if (l.length) {
    const best = l.reduce((a, g) => (g.points > a.points ? g : a)), goals = l.reduce((a, g) => ((g.goals || 0) > (a.goals || 0) ? g : a));
    const peak = mw.series.reduce((a, x) => (x.v > a.v ? x : a));
    const opp = g => (CL[g.opp] ? 'vs ' + CL[g.opp].n : '');
    const rec = (t, v, sub, link) => '<button type="button" class="mrec"' + (link ? ' data-match="' + esc(link) + '"' : ' disabled') + '><span>' + t + '</span><b>' + v + '</b><small>' + esc(sub) + '</small></button>';
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
