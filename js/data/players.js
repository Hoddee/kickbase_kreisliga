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

/* Lookup nach ID; wird bei Kader-Updates in place aktualisiert */
export const PL = Object.fromEntries(PLAYER_LIST.map(p => [p.id, p]));

export const POS_NAME = { TW: 'Torwart', ABW: 'Abwehr', MIT: 'Mittelfeld', ANG: 'Angriff' };
export const POS_SHORT = { TW: 'TW', ABW: 'ABW', MIT: 'MF', ANG: 'ANG' };
export const POS_ORDER = ['TW', 'ABW', 'MIT', 'ANG'];
export const STATUS_NAME = { fit: 'Fit', hit: 'Angeschlagen', inj: 'Verletzt' };

export function fullName(p) { return p.vn ? p.vn + ' ' + p.n : p.n; }
export function photoUrl(id) { return storageUrl('spieler/' + id + '.png'); }
