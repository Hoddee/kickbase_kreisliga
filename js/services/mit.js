/* Mitbuch-Modus: bis zu 3 weitere Handys buchen im selben Spiel mit.
   Der Gastgeber (das Handy mit dem Spiel) bleibt maßgeblich: Uhr, Aufstellung, Abpfiff und Speichern laufen nur dort.
   Mitbucher kommen per QR-Code/Link dazu (?mit=<Spiel-ID>.<Code>), sperren Spieler für sich („locken“) und buchen nur
   für diese; Tore (mit Tor-Assistent) darf jeder melden. Gesperrte Spieler kann man jederzeit übernehmen.
   Übertragung: Supabase Realtime Broadcast auf einem Kanal mit zufälligem Code – nichts landet in der Datenbank.
     Gastgeber → alle:    's' Spielstand (nur geänderte Spieler-Einträge, Prüfsummen für den Rest), 'no' Absage, 'end'
     Mitbucher → Gastgeber: 'hi' Hallo/Lebenszeichen, 'lk' Spieler sperren/freigeben, 'ed' Änderungen an Ereignissen,
                            'sy' alles neu schicken, 'by' tschüss
   Mitbucher arbeiten auf einer Kopie (store.S.remote, wird nie gespeichert). Jede Änderung dort geht als Unterschied
   der Ereignisse an den Gastgeber; der wendet sie an (Punkte rechnet er selbst) und bestätigt sie. Änderungen sind
   doppelt anwendbar ohne Schaden, darum wird bis zur Bestätigung einfach wiederholt. */
import { SUPABASE_URL, SUPABASE_KEY, APP_URL, KEYS } from '../config.js';
import { randomId, readJson, writeJson, toast } from '../core/util.js';
import { num, str, okId, okFoto } from './api.js';
import { countBytes } from './traffic.js';
import { PL, POS_NAME } from '../data/players.js';
import { CL } from '../data/clubs.js';
import {
  store, hooks, saveGame, reloadGame, extract, load, isMulti, eachPlayer, withPlayer, elapsed, ACT, val, applyMedia, applyMatchNames
} from '../core/game.js';

export const MAX_HELPERS = 3;
const HELLO = 20000, GONE = 75000, BEAT = 15000;

/* Gerät: feste zufällige ID */
export function devId() {
  let d = readJson(KEYS.dev, '');
  if (!/^[A-Za-z0-9]{12,40}$/.test(d)) { d = randomId(16); writeJson(KEYS.dev, d); }
  return d;
}

/* ---------- Kanal (Phoenix-Protokoll wie in live.js) ---------- */
function channel(topic, onMsg, onUp) {
  let ws = null, hb = null, ref = 0, retry = 0, closed = false, joined = false;
  const raw = (event, payload, t = topic) => { try { ws.send(JSON.stringify({ topic: t, event, payload, ref: String(++ref) })); return true; } catch (e) { return false; } };
  function open() {
    if (closed || ws) return;
    const url = SUPABASE_URL.replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(SUPABASE_KEY) + '&vsn=1.0.0';
    try { ws = new WebSocket(url); } catch (e) { ws = null; return later(); }
    ws.onopen = () => {
      retry = 0;
      raw('phx_join', { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, private: false } });
      hb = setInterval(() => raw('heartbeat', {}, 'phoenix'), 25000);
    };
    ws.onmessage = m => {
      countBytes(typeof m.data === 'string' ? m.data.length : 0);
      let x; try { x = JSON.parse(m.data); } catch (e) { return; }
      if (x.topic !== topic) return;
      if (x.event === 'phx_reply' && !joined && x.payload && x.payload.status === 'ok') { joined = true; onUp(true); }
      else if (x.event === 'broadcast' && x.payload && x.payload.payload && typeof x.payload.payload === 'object') onMsg(x.payload.payload);
      else if (x.event === 'phx_error' || x.event === 'phx_close') { try { ws.close(); } catch (e) {} }
    };
    ws.onclose = () => { clearInterval(hb); ws = null; if (joined) { joined = false; onUp(false); } later(); };
    ws.onerror = () => { try { ws.close(); } catch (e) {} };
  }
  function later() { if (!closed && document.visibilityState !== 'hidden') setTimeout(open, Math.min(20000, 800 * 2 ** retry++)); }
  const vis = () => { if (document.visibilityState === 'visible' && !ws) { retry = 0; open(); } };
  document.addEventListener('visibilitychange', vis);
  open();
  return {
    send: msg => joined && raw('broadcast', { type: 'broadcast', event: 'm', payload: msg }),
    up: () => joined,
    close() { closed = true; document.removeEventListener('visibilitychange', vis); try { if (ws) ws.close(); } catch (e) {} }
  };
}
const topicOf = (gid, code) => 'realtime:mit-' + gid + '-' + code;

/* Wer bekommt Bescheid, wenn sich etwas ändert (Ansichten neu zeichnen) */
let onUpdate = () => {};
export const onMit = fn => { onUpdate = fn; };
const changed = what => { try { onUpdate(what); } catch (e) {} };

/* Ereignis-Kennung über Geräte hinweg (IDs vergibt jedes Gerät selbst) */
/* Spieler- und Vereins-IDs (auch Gastspieler „gast:…“ und eigene Gegner „x:…“) */
const ref = v => typeof v === 'string' && v.length <= 80 && (okId(v) || /^(gast|x):[^<>"'&]{1,70}$/.test(v));
const pid = v => (ref(v) && PL[v] ? v : null), cid = v => (ref(v) && CL[v] ? v : null);
const idk = e => (e.ts || 'i' + e.id) + '|' + e.key;
const slotsOf = S => (isMulti() ? S.squad.map((x, i) => (i === S.cur ? extract(S) : x)) : [extract(S)]);
/* kurze Prüfsumme über JSON mit sortierten Schlüsseln (Realtime sortiert sie beim Weiterleiten um) */
const canon = v => (Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : v && typeof v === 'object'
  ? '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v === undefined ? null : v));
function sum(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

/* =====================================================================
   Gastgeber
   ===================================================================== */
const H = { ch: null, devs: new Map(), kicked: new Set(), sent: new Map(), timer: null, beat: null };
export const hosting = () => !!(H.ch && store.S.mit && !store.S.remote);
export const helpers = () => [...H.devs].map(([d, x]) => ({ d, n: x.n, ps: Object.values((store.S.mit || {}).locks || {}).filter(l => l.d === d).length }));
export const joinUrl = () => { const m = store.S.mit; return m ? APP_URL + '?mit=' + gidOf() + '.' + m.code : ''; };
const gidOf = () => (isMulti() ? (store.S.cur === 0 ? store.S.uid : store.S.squad[0].uid) : store.S.uid);

export function startHosting() {
  const S = store.S;
  if (S.remote || !S.match || S.manual || S.ended) return;
  if (!S.mit) { S.mit = { code: randomId(10), locks: {}, acks: {} }; saveGame(); }
  if (H.ch) return;
  H.ch = channel(topicOf(gidOf(), S.mit.code), hostMsg, up => { if (up) broadcast(true); changed('conn'); });
  H.beat = setInterval(() => {
    const now = Date.now();
    /* Wer sich lange nicht meldet, ist weg – seine Spieler gehen zurück an den Gastgeber */
    for (const [d, x] of H.devs) if (now - x.at > GONE) dropDev(d);
    broadcast(false, true);
  }, BEAT);
  hooks.save = onHostSave;
}
export function stopHosting(silent) {
  if (H.ch) { if (!silent) H.ch.send({ t: 'end' }); const c = H.ch; setTimeout(() => c.close(), 300); }
  H.ch = null; clearInterval(H.beat); clearTimeout(H.timer);
  H.devs.clear(); H.sent.clear();
  if (hooks.save === onHostSave) hooks.save = null;
  if (store.S.mit && !store.S.remote) { delete store.S.mit; saveGame(); }
  changed('stop');
}
/* Spiel vorbei oder weg: Mitbuchen beenden */
function onHostSave() {
  const S = store.S;
  if (S.remote) return;
  if (!S.match || !S.mit || S.ended) { if (H.ch) stopHosting(); return; }
  clearTimeout(H.timer);
  H.timer = setTimeout(() => broadcast(false), 120);
}
function dropDev(d) {
  H.devs.delete(d);
  const L = (store.S.mit || {}).locks || {};
  for (const u of Object.keys(L)) if (L[u].d === d) delete L[u];
  saveGame(); changed('devs');
}
export function kick(d) { H.kicked.add(d); if (H.ch) H.ch.send({ t: 'no', to: d, why: 'kick' }); dropDev(d); }

/* Spieler zurückholen (Gastgeber bucht ihn wieder selbst) */
export function takeBack(uid) { const L = (store.S.mit || {}).locks; if (L && L[uid]) { delete L[uid]; saveGame(); changed('lock'); } }
/* Wer bucht diesen Spieler gerade? (Name oder null = dieses Gerät) */
export function lockOf(uid) {
  const S = store.S;
  if (S.remote) {
    if ((S.mine || []).includes(uid)) return null;
    const l = (S.locks || {})[uid];
    return l ? l.n : S.hostN || 'Gastgeber';
  }
  const l = S.mit && S.mit.locks && S.mit.locks[uid];
  return l && H.devs.has(l.d) ? l.n : null;
}

hooks.lockOf = lockOf;

function broadcast(full, beat) {
  if (!H.ch || !H.ch.up()) return;
  const S = store.S, slots = slotsOf(S), sl = {}, sg = {};
  for (const x of slots) {
    const s = sum(canon(x));
    sg[x.uid] = s;
    if (full || H.sent.get(x.uid) !== s) { sl[x.uid] = x; H.sent.set(x.uid, s); }
  }
  if (beat && !full && !Object.keys(sl).length && H.devs.size === 0) return;
  const m = S.match;
  H.ch.send({
    t: 's', full: !!full, order: slots.map(x => x.uid), sl, sg,
    g: { o: m.o, of: m.of || null, home: !!m.home, team: m.team || null, el: Math.floor(elapsed()), run: !!S.clock.startedAt, ended: !!S.ended, ht: !!S.ht, h2: !!S.h2, by: S.by || null },
    locks: S.mit.locks, acks: S.mit.acks, devs: [...H.devs].map(([d, x]) => [d, x.n])
  });
}

function hostMsg(m) {
  const S = store.S, d = typeof m.d === 'string' && /^[A-Za-z0-9]{12,40}$/.test(m.d) ? m.d : null;
  if (!d || !S.mit || S.remote || m.t === 's') return;
  if (H.kicked.has(d)) { H.ch.send({ t: 'no', to: d, why: 'kick' }); return; }
  const known = H.devs.get(d);
  if (m.t === 'hi') {
    if (!known && H.devs.size >= MAX_HELPERS) { H.ch.send({ t: 'no', to: d, why: 'voll' }); return; }
    H.devs.set(d, { n: str(m.n, 30) || 'Mitbucher', at: Date.now() });
    if (!known) { toast(H.devs.get(d).n + ' bucht mit'); changed('devs'); }
    H.sent.clear(); broadcast(true);
    return;
  }
  if (!known) { H.ch.send({ t: 'no', to: d, why: 'neu' }); return; }
  known.at = Date.now();
  if (m.t === 'by') { dropDev(d); toast(known.n + ' bucht nicht mehr mit'); return; }
  if (m.t === 'sy') { H.sent.clear(); broadcast(true); return; }
  if (m.t === 'lk') {
    const u = okId(m.u);
    if (!u || !slotsOf(S).some(x => x.uid === u)) return;
    if (m.on) S.mit.locks[u] = { d, n: known.n }; else if (S.mit.locks[u] && S.mit.locks[u].d === d) delete S.mit.locks[u];
    saveGame(); changed('lock');
    return;
  }
  if (m.t === 'ed' && Array.isArray(m.ch)) {
    applyEdits(d, m.ch.slice(0, 20));
    S.mit.acks[d] = Math.max(S.mit.acks[d] || 0, num(m.q));
    saveGame(); changed('ed');
  }
}
/* Änderungen eines Mitbuchers übernehmen. Normale Aktionen nur für Spieler, die er gesperrt hat; Tore für alle. */
function applyEdits(d, list) {
  const S = store.S, idx = new Map(slotsOf(S).map((x, i) => [x.uid, i]));
  for (const c of list) {
    const i = idx.get(okId(c && c.u));
    if (i == null) continue;
    const mine = S.mit.locks[c.u] && S.mit.locks[c.u].d === d;
    const ok = e => mine || !!(e.grp || e.gg);
    withPlayer(i, () => {
      const P = store.S;
      const del = new Set((Array.isArray(c.del) ? c.del : []).map(k => String(k).slice(0, 40)));
      if (del.size) P.events = P.events.filter(e => !(del.has(idk(e)) && ok(e)));
      for (const [k, v] of Array.isArray(c.sc) ? c.sc : []) { const e = P.events.find(x => idk(x) === String(k)); if (e && ok(e)) e.sc = v ? 1 : 0; }
      for (const a of (Array.isArray(c.add) ? c.add : []).slice(0, 30)) {
        const key = str(a && a.k, 12), act = ACT[key];
        if (!act) continue;
        const e = { id: 0, key, label: str(a.l, 60) || act.s || act.l, pts: 0, t: Math.max(-1, Math.min(20000, Math.floor(num(a.t, -1)))), ts: num(a.ts) || Date.now() };
        const grp = str(a.grp, 24), gg = str(a.gg, 24);
        if (grp) e.grp = grp;
        if (gg) { e.gg = gg; e.ga = 1; }
        if (a.sc) e.sc = 1;
        if (!ok(e) || P.events.some(x => idk(x) === idk(e))) continue;
        e.id = P.nextId++; e.pts = val(act);
        P.events.push(e);
      }
    });
  }
}

/* =====================================================================
   Mitbucher
   ===================================================================== */
const C = { ch: null, gid: '', code: '', n: '', q: 0, pending: [], base: new Map(), cache: null, hello: null, resend: null, seen: 0, adopted: false, wait: null, onFirst: null };
export const helping = () => !!store.S.remote;
export const helperConn = () => (C.ch && C.ch.up() && Date.now() - C.seen < 40000);
export const savedJoin = () => readJson(KEYS.mit, null);

/* Beitreten: gid/code aus dem Link; onFirst() sobald das Spiel da ist */
export function join(gid, code, name, onFirst) {
  if (!okId(gid) || !/^[A-Za-z0-9]{6,20}$/.test(code)) return false;
  leave(true);
  Object.assign(C, { gid, code, n: name, q: 0, pending: [], base: new Map(), cache: null, seen: 0, adopted: false, onFirst });
  writeJson(KEYS.mit, { gid, code });
  const d = devId();
  C.ch = channel(topicOf(gid, code), helperMsg, up => { if (up) { C.ch.send({ t: 'hi', d, n: C.n }); flush(); } changed('conn'); });
  C.hello = setInterval(() => { if (C.ch) C.ch.send({ t: 'hi', d, n: C.n }); changed('beat'); }, HELLO);
  C.resend = setInterval(flush, 2500);
  /* Kommt nichts vom Gastgeber: aufgeben */
  C.wait = setTimeout(() => { if (!C.adopted) { toast('Spiel nicht gefunden', 'bad'); leave(true); } }, 15000);
  return true;
}
export function leave(silent) {
  if (C.ch) { C.ch.send({ t: 'by', d: devId() }); const c = C.ch; setTimeout(() => c.close(), 300); }
  C.ch = null; clearInterval(C.hello); clearInterval(C.resend); clearTimeout(C.wait);
  try { localStorage.removeItem(KEYS.mit); } catch (e) {}
  if (hooks.save === onHelperSave) hooks.save = null;
  if (store.S.remote) { reloadGame(); if (!silent) changed('left'); }
}
function flush() { if (C.ch && C.pending.length) for (const op of C.pending) C.ch.send(op); }

/* Spieler für sich sperren / freigeben */
export function lockPlayer(uid, on) {
  const S = store.S;
  if (!S.remote || !C.ch) return;
  S.mine = (S.mine || []).filter(u => u !== uid);
  if (on) S.mine.push(uid);
  C.ch.send({ t: 'lk', d: devId(), u: uid, on: !!on });
  changed('lock');
}

function helperMsg(m) {
  const d = devId();
  if (m.t === 'no' && m.to === d) {
    toast(m.why === 'voll' ? 'Schon ' + MAX_HELPERS + ' Mitbucher dabei' : m.why === 'kick' ? 'Mitbuchen beendet' : 'Verbinde neu …', m.why === 'neu' ? '' : 'bad');
    if (m.why === 'neu') { if (C.ch) C.ch.send({ t: 'hi', d, n: C.n }); return; }
    leave(); return;
  }
  if (m.t === 'end') { toast('Mitbuchen beendet'); leave(); return; }
  if (m.t !== 's' || !Array.isArray(m.order)) return;
  C.seen = Date.now();
  const c = C.cache || { sl: {} };
  c.order = m.order.slice(0, 15).map(okId).filter(Boolean);
  for (const [u, x] of Object.entries(m.sl || {})) { const s = cleanSlot(x); if (s && s.uid === u) c.sl[u] = s; }
  for (const u of Object.keys(c.sl)) if (!c.order.includes(u)) delete c.sl[u];
  c.g = cleanG(m.g || {}); c.at = Date.now();
  c.locks = {}; for (const [u, l] of Object.entries(m.locks || {})) if (okId(u) && l && typeof l === 'object') c.locks[u] = { d: str(l.d, 40), n: str(l.n, 30) };
  c.ack = num((m.acks || {})[d]);
  c.devs = (Array.isArray(m.devs) ? m.devs : []).slice(0, 5).map(x => [str(x[0], 40), str(x[1], 30)]);
  C.cache = c;
  if (!c.devs.some(x => x[0] === d)) { if (C.ch) C.ch.send({ t: 'hi', d, n: C.n }); }
  /* Fehlt ein Spieler oder passt die Prüfsumme nicht: alles neu anfordern */
  const sg = m.sg || {};
  if (c.order.some(u => !c.sl[u] || (sg[u] && sum(canon(rawOf(c.sl[u]))) !== sg[u]))) {
    if (C.ch && Date.now() - (C.sy || 0) > 4000) { C.sy = Date.now(); C.ch.send({ t: 'sy', d }); }
    if (!C.adopted) return;
  }
  if (!c.order.length || !c.g.o || !c.order.every(u => c.sl[u])) return;
  C.pending = C.pending.filter(op => op.q > c.ack);
  if (c.g.ended) { toast('Abpfiff – Mitbuchen beendet'); leave(); return; }
  /* Erst übernehmen, wenn alle eigenen Änderungen angekommen sind (sonst würden sie kurz verschwinden) */
  if (C.pending.length && Date.now() - C.pending[0].at < 10000) return;
  C.pending = [];
  adopt();
}
/* Prüfsumme über genau das, was der Gastgeber geschickt hat */
const raws = new WeakMap();
const rawOf = s => raws.get(s);
function cleanG(g) {
  return { o: cid(g.o), of: okFoto(g.of), home: !!g.home, team: cid(g.team), el: Math.max(0, num(g.el)), run: !!g.run, ended: !!g.ended, ht: !!g.ht, h2: !!g.h2, by: str(g.by, 40) || null };
}
function cleanSlot(x) {
  if (!x || typeof x !== 'object' || !okId(x.uid) || !pid(x.p)) return null;
  const ev = (Array.isArray(x.events) ? x.events : []).slice(0, 500).filter(e => e && ACT[e.key]).map(e => {
    const o = { id: num(e.id), key: e.key, label: str(e.label, 60), pts: num(e.pts), t: num(e.t, -1) };
    if (e.ts) o.ts = num(e.ts);
    if (e.grp) o.grp = str(e.grp, 24);
    if (e.gg) o.gg = str(e.gg, 24);
    if (e.ga) o.ga = 1;
    if (e.sc) o.sc = 1;
    return o;
  });
  const s = {
    p: x.p, pf: okFoto(x.pf), pos: POS_NAME[x.pos] ? x.pos : 'MIT', startelf: !!x.startelf,
    stints: (Array.isArray(x.stints) ? x.stints : []).slice(0, 30).map(t => ({ from: num(t && t.from), to: t && t.to != null ? num(t.to) : null })),
    events: ev, subs: (Array.isArray(x.subs) ? x.subs : []).slice(0, 30).map(t => ({ o: t && t.o === 'out' ? 'out' : 'in', at: num(t && t.at), t: num(t && t.t) })),
    nextId: num(x.nextId, 1), h2Id: x.h2Id == null ? null : num(x.h2Id), uid: x.uid, saved: !!x.saved
  };
  raws.set(s, x);
  return s;
}

/* Spielstand des Gastgebers als eigene Kopie übernehmen */
function adopt() {
  const c = C.cache, old = store.S, g = c.g, d = devId();
  const prev = old.remote ? old.uid : null;
  const slots = c.order.map(u => JSON.parse(JSON.stringify(c.sl[u])));
  const mine = Object.entries(c.locks).filter(([, l]) => l.d === d).map(([u]) => u);
  let cur = slots.findIndex(x => x.uid === prev && mine.includes(x.uid));
  if (cur < 0) cur = Math.max(0, slots.findIndex(x => mine.includes(x.uid)));
  const run = g.run && !g.ended;
  const S = {
    remote: true, gid: C.gid, mine, locks: c.locks, hostN: g.by, devs: c.devs,
    match: { p: slots[cur].p, o: g.o, home: g.home, team: g.team || undefined },
    clock: { offset: g.el + (run ? (Date.now() - c.at) / 1000 : 0), startedAt: run ? Date.now() : null },
    ended: g.ended, ht: g.ht, h2: g.h2, by: g.by
  };
  if (g.of) S.match.of = g.of;
  if (slots.length > 1) { S.squad = slots; S.cur = cur; }
  load(S, slots[cur]);
  for (const x of slots) applyMedia(x.p, g.o, x.pf, g.of);
  store.S = S;
  C.base = new Map(slots.map(x => [x.uid, x.events.map(e => Object.assign({}, e))]));
  hooks.save = onHelperSave;
  applyMatchNames();
  const first = !C.adopted;
  C.adopted = true; clearTimeout(C.wait);
  if (first && C.onFirst) C.onFirst();
  changed(first ? 'first' : 'state');
}

/* Nach jeder Änderung auf dem Mitbucher-Handy: Unterschiede zum letzten Stand an den Gastgeber */
function onHelperSave() {
  const S = store.S;
  if (!S.remote || !C.ch) return;
  const ch = [];
  eachPlayer(() => {
    const P = store.S, base = C.base.get(P.uid) || [], bm = new Map(base.map(e => [idk(e), e])), nm = new Map(P.events.map(e => [idk(e), e]));
    const add = [], del = [], sc = [];
    for (const [k, e] of nm) {
      const b = bm.get(k);
      if (!b) add.push({ k: e.key, l: e.label, t: e.t, ts: e.ts, grp: e.grp, gg: e.gg, sc: e.sc ? 1 : 0 });
      else if (!!b.sc !== !!e.sc) sc.push([k, e.sc ? 1 : 0]);
    }
    for (const k of bm.keys()) if (!nm.has(k)) del.push(k);
    if (add.length || del.length || sc.length) ch.push({ u: P.uid, add, del, sc });
    C.base.set(P.uid, P.events.map(e => Object.assign({}, e)));
  });
  if (!ch.length) return;
  const op = { t: 'ed', d: devId(), q: ++C.q, ch, at: Date.now() };
  C.pending.push(op);
  C.ch.send(op);
}

/* Beim Start: offener Mitbuch-Link oder abgebrochene Sitzung */
export function linkParam() {
  const v = new URLSearchParams(location.search).get('mit');
  if (!v) return null;
  const [gid, code] = v.split('.');
  return okId(gid) && /^[A-Za-z0-9]{6,20}$/.test(code || '') ? { gid, code } : null;
}
/* Gastgeber nach einem Neustart der App: Kanal wieder öffnen */
export function resumeHosting() { if (store.S.mit && !store.S.remote && store.S.match && !store.S.ended) startHosting(); }
