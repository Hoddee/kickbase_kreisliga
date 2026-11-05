/* Kader. Die Liste hier ist der Offline-Stand; die gepflegten Werte (Status, Position, Marktwert)
   kommen aus der Supabase-Tabelle "kader" und überschreiben diese Einträge (siehe services/roster.js). */
import { storageUrl } from './clubs.js';

export const PLAYER_LIST = [
  { id: 'Barbano', vn: 'Mattia', n: 'Barbano', c: 'vfr', pos: 'ABW', mw: 11500000, status: 'fit' },
  { id: 'Doez', vn: 'Benjamin', n: 'Döz', c: 'vfr', pos: 'ABW', mw: 8800000, status: 'fit' },
  { id: 'Heckmann', vn: 'Philipp', n: 'Heckmann', c: 'vfr', pos: 'MIT', mw: 8000000, status: 'fit' },
  { id: 'Kugler', vn: 'Mattis', n: 'Kugler', c: 'vfr', pos: 'ABW', mw: 7500000, status: 'fit' },
  { id: 'Pace', vn: 'Vincenzo', n: 'Pace', c: 'vfr', pos: 'ANG', mw: 12500000, status: 'fit' },
  { id: 'Sipala', vn: 'Angelo', n: 'Sipala', c: 'vfr', pos: 'ANG', mw: 6500000, status: 'hit' },
  { id: 'Buehler', vn: 'Marian', n: 'Bühler', c: 'vfrk', pos: 'ANG', mw: 800000, status: 'inj' },
  { id: 'Fechter', vn: 'Mikk', n: 'Fechter', c: 'vfrk', pos: 'TW', mw: 5800000, status: 'fit' },
  { id: 'Filenberg', vn: 'Daniel', n: 'Filenberg', c: 'vfrk', pos: 'ABW', mw: 9342812, exact: true, status: 'fit' },
  { id: 'Klenk', vn: 'Silas', n: 'Klenk', c: 'vfrk', pos: 'MIT', mw: 6200000, status: 'fit' },
  { id: 'Knoedler', vn: 'Jakob', n: 'Knödler', c: 'vfrk', pos: 'ABW', mw: 3200000, status: 'fit' },
  { id: 'Krauss', vn: 'Levin', n: 'Krauss', c: 'vfrk', pos: 'MIT', mw: 6000000, status: 'fit' },
  { id: 'Reule', vn: 'Noah', n: 'Reule', c: 'vfrk', pos: 'ABW', mw: 7400000, status: 'fit' },
  { id: 'Schauss', vn: 'Ben', n: 'Schauß', c: 'vfrk', pos: 'MIT', mw: 6800000, status: 'fit' },
  { id: 'Schoenenberg', vn: 'Benedikt', n: 'Schönenberg', c: 'vfrk', pos: 'ABW', mw: 7000000, status: 'fit' },
  { id: 'Schwer', vn: 'Benjamin', n: 'Schwer', c: 'vfrk', pos: 'ANG', mw: 700000, status: 'inj' },
  { id: 'Collin', vn: 'Alexander', n: 'Collin', c: 'fornsbach', pos: 'MIT', mw: 8000000, status: 'fit' },
  { id: 'Collin2', vn: 'Niklas', n: 'Collin', c: 'fornsbach', pos: 'MIT', mw: 4500000, status: 'fit' }
];

/* Gastspieler gelten nur für ein Spiel. ID-Format: "gast:<Vereins-ID>:<Name>".
   PL liefert für solche IDs automatisch einen Eintrag (ohne Foto, Standard-Marktwert). */
export const GUEST_PREFIX = 'gast:';
export const isGuest = id => typeof id === 'string' && id.startsWith(GUEST_PREFIX);
export function guestId(clubId, name) { return GUEST_PREFIX + clubId + ':' + name.trim().replace(/\s+/g, ' ').slice(0, 20); }
function guestFromId(id) {
  const rest = id.slice(GUEST_PREFIX.length), i = rest.indexOf(':');
  if (i < 1) return undefined;
  return { id, vn: '', n: rest.slice(i + 1), c: rest.slice(0, i), pos: 'MIT', mw: 500000, status: 'fit', guest: true, foto: '' };
}

/* Lookup nach ID; wird bei Kader-Updates in place aktualisiert */
const playerBase = Object.fromEntries(PLAYER_LIST.map(p => [p.id, p]));
export const PL = new Proxy(playerBase, {
  get(t, k) {
    if (typeof k === 'string' && !(k in t) && isGuest(k)) { const g = guestFromId(k); if (g) t[k] = g; }
    return t[k];
  }
});
/* Neuen Stammspieler aus der Datenbank aufnehmen */
export function addPlayer(p) {
  if (playerBase[p.id]) return playerBase[p.id];
  playerBase[p.id] = p; PLAYER_LIST.push(p);
  return p;
}

export const POS_NAME = { TW: 'Torwart', ABW: 'Abwehr', MIT: 'Mittelfeld', ANG: 'Angriff' };
export const POS_SHORT = { TW: 'TW', ABW: 'ABW', MIT: 'MF', ANG: 'ANG' };
export const POS_ORDER = ['TW', 'ABW', 'MIT', 'ANG'];
export const STATUS_NAME = { fit: 'Fit', hit: 'Angeschlagen', inj: 'Verletzt' };

export function fullName(p) { return p.vn ? p.vn + ' ' + p.n : p.n; }
/* Platzhalter-Silhouette für Spieler ohne Foto (gleiches Format wie die Spielerfotos) */
const SILHOUETTE = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 907 1255"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a5260"/><stop offset="1" stop-color="#2a2f37"/></linearGradient></defs>' +
  '<circle cx="453" cy="330" r="190" fill="url(#g)"/><path d="M90 1255c0-300 160-560 363-560s363 260 363 560z" fill="url(#g)"/></svg>');

export function photoUrl(id) {
  const p = PL[id];
  if (!p || p.foto === '') return SILHOUETTE;
  if (p.foto) return storageUrl(p.foto) + (p.fotoV ? '?v=' + p.fotoV : '');
  return storageUrl('spieler/' + id + '.png');
}
