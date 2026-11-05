/* Vereine der Kreisliga A2 und B2 (Rems/Murr/Hall). Wappen liegen im Supabase-Bucket "kickbase". */
import { STORAGE_BASE } from '../config.js';

const FA = 'Wappen_KreisligaA2_Rems__Murr__Hall/';
const FB = 'Wappen_KreisligaB2_Rems__Murr__Hall/';

export const CLUB_LIST = [
  { id: 'vfr', n: 'VfR Murrhardt', lg: 'A2', f: FA + 'VfR_Murrhardt.png' },
  { id: 'allm2', n: 'Allmersbach II', lg: 'A2', f: FA + 'Allmersbach_II.png' },
  { id: 'weiler', n: 'FSV Weiler', lg: 'A2', f: FA + 'FSV_Weiler.png' },
  { id: 'sulzm', n: 'FV Sulzbach/Murr', lg: 'A2', f: FA + 'FV_SulzbachMurr.png' },
  { id: 'alex', n: 'Großer Alexander', lg: 'A2', f: FA + 'Grosser_Alexander.png' },
  { id: 'klein', n: 'Kleinaspach', lg: 'A2', f: FA + 'Kleinaspach.png' },
  { id: 'oppen2', n: 'Oppenweiler II', lg: 'A2', f: FA + 'Oppenweiler_II.png' },
  { id: 'ruder', n: 'Rudersberg', lg: 'A2', f: FA + 'Rudersberg.png' },
  { id: 'erbA', n: 'SGM Erbstetten/ TSG Backnang II', lg: 'A2', f: FA + 'SGM_Erbstetten__TSG_Backnang_II.png' },
  { id: 'sulzl', n: 'SGM Sulzbach-Laufen/ Gschwend', lg: 'A2', f: FA + 'SGM_Sulzbach_Laufen__Gschwend.png' },
  { id: 'sk_fichtenberg', n: 'SK Fichtenberg', lg: 'A2', f: FA + 'SK_Fichtenberg.png' },
  { id: 'spiegel', n: 'SV Spiegelberg', lg: 'A2', f: FA + 'SV_Spiegelberg.png' },
  { id: 'stein2', n: 'SV Steinbach II', lg: 'A2', f: FA + 'SV_Steinbach_II.png' },
  { id: 'tsc', n: 'TSC Murrhardt', lg: 'A2', f: FA + 'TSC_Murrhardt.png' },
  { id: 'unter2', n: 'Unterweissach II', lg: 'A2', f: FA + 'Unterweissach_II.png' },
  { id: 'vfrk', n: 'VfR Murrhardt/ Kirchenkirnberg II', lg: 'B2', f: FB + 'VfR Murrhardt__Kirchenkirnberg II.png' },
  { id: 'fornsbach', n: 'SC Fornsbach', lg: 'B2', f: FB + 'SC_Fornsbach.png' },
  { id: 'winn', n: 'FC Winnenden', lg: 'B2', f: FB + 'FC Winnenden.png' },
  { id: 'grosser', n: 'SF Großerlach', lg: 'B2', f: FB + 'SF_Grosserlach.png' },
  { id: 'erbB', n: 'SGM Erbstetten II/ TSG Backnang III', lg: 'B2', f: FB + 'SGM Erbstetten II__TSG Backnang III II.png' },
  { id: 'aspach', n: 'SGM Aspach', lg: 'B2', f: FB + 'SGM_Aspach.png' },
  { id: 'allm3', n: 'SV Allmersbach III', lg: 'B2', f: FB + 'SV_Allmersbach_III.png' },
  { id: 'kirchberg', n: 'SVG Kirchberg', lg: 'B2', f: FB + 'SVG_Kirchberg.png' },
  { id: 'althuette', n: 'TSV Althütte', lg: 'B2', f: FB + 'TSV_Althuette.png' },
  { id: 'leuten', n: 'TSV Leutenbach', lg: 'B2', f: FB + 'TSV_Leutenbach.png' },
  { id: 'lippold', n: 'TSV Lippoldsweiler', lg: 'B2', f: FB + 'TSV_Lippoldsweiler.png' },
  { id: 'oberbr', n: 'TSV Oberbrüden', lg: 'B2', f: FB + 'TSV_Oberbrueden.png' },
  { id: 'ruder2', n: 'TSV Rudersberg II', lg: 'B2', f: FB + 'TSV_Rudersberg_II.png' },
  { id: 'tuerk', n: 'Türkspor Schorndorf', lg: 'B2', f: FB + 'Tuerkspor_Schorndorf.png' }
];

export const CL = Object.fromEntries(CLUB_LIST.map(c => [c.id, c]));

/* Vereine, aus denen Spieler gebucht werden (Reihenfolge in der Auswahl) */
export const OWN_CLUBS = ['vfr', 'vfrk', 'fornsbach'];

export function storageUrl(path) {
  return STORAGE_BASE + path.split('/').map(encodeURIComponent).join('/');
}
export function crestUrl(clubId) { return storageUrl(CL[clubId].f); }
