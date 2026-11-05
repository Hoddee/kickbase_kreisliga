/* Vereine der Kreisliga A2, B2 und B5 (Rems/Murr/Hall). In der B5 nutzen die Teams das Wappen des Stammvereins. Wappen liegen im Supabase-Bucket "kickbase". */
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
  { id: 'tuerk', n: 'Türkspor Schorndorf', lg: 'B2', f: FB + 'Tuerkspor_Schorndorf.png' },
  { id: 'sgm5', n: 'SGM Fornsbach II', lg: 'B5', f: FB + 'SC_Fornsbach.png' },
  { id: 'oberbr2', n: 'TSV Oberbrüden II', lg: 'B5', f: FB + 'TSV_Oberbrueden.png' },
  { id: 'klein2', n: 'Kleinaspach/ Allmersbach II', lg: 'B5', f: FA + 'Kleinaspach.png' },
  { id: 'kirchberg2', n: 'SVG Kirchberg II', lg: 'B5', f: FB + 'SVG_Kirchberg.png' },
  { id: 'spiegel2', n: 'SV Spiegelberg II', lg: 'B5', f: FA + 'SV_Spiegelberg.png' },
  { id: 'sulzm2', n: 'FV Sulzbach/Murr II', lg: 'B5', f: FA + 'FV_SulzbachMurr.png' },
  { id: 'alex2', n: 'Großer Alexander II', lg: 'B5', f: FA + 'Grosser_Alexander.png' },
  { id: 'leuten2', n: 'SGM Leutenbach II/ Weiler II', lg: 'B5', f: FB + 'TSV_Leutenbach.png' },
  { id: 'oppen3', n: 'Oppenweiler III', lg: 'B5', f: FA + 'Oppenweiler_II.png' },
  { id: 'sulzl2', n: 'SGM Sulzbach-Laufen/ Gschwend II', lg: 'B5', f: FA + 'SGM_Sulzbach_Laufen__Gschwend.png' },
  { id: 'fichten2', n: 'SK Fichtenberg II', lg: 'B5', f: FA + 'SK_Fichtenberg.png' },
  { id: 'tuerk2', n: 'Türkspor Schorndorf II', lg: 'B5', f: FB + 'Tuerkspor_Schorndorf.png' }
];
export const LEAGUES = ['A2', 'B2', 'B5'];

/* Eigene Gegner (z. B. Pokal) haben die ID "x:Name" und gelten nur für ein Spiel.
   CL liefert für solche IDs automatisch einen Eintrag ohne Liga mit generiertem Wappen. */
export const CUSTOM_PREFIX = 'x:';
export const isCustomClub = id => typeof id === 'string' && id.startsWith(CUSTOM_PREFIX);
export const customClubId = name => CUSTOM_PREFIX + name.trim().replace(/\s+/g, ' ').slice(0, 30);
const clubBase = Object.fromEntries(CLUB_LIST.map(c => [c.id, c]));
export const CL = new Proxy(clubBase, {
  get(t, k) {
    if (typeof k === 'string' && !(k in t) && isCustomClub(k) && k.length > 2) t[k] = { id: k, n: k.slice(2), lg: null, custom: true };
    return t[k];
  }
});

/* Vereine, aus denen Spieler gebucht werden (Reihenfolge in der Auswahl) */
export const OWN_CLUBS = ['vfr', 'vfrk', 'fornsbach', 'sgm5'];

export function storageUrl(path) {
  return STORAGE_BASE + path.split('/').map(encodeURIComponent).join('/');
}
/* Generiertes Wappen (Schild mit Initialen) für eigene Gegner */
function initials(name) {
  const w = name.replace(/[^\p{L}\p{N} ]/gu, ' ').split(' ').filter(x => x && !/^(fc|sv|tsv|sc|sg|sgm|fsv|vfr|vfb|tsg|sf|svg|fv|tsc|sk)$/i.test(x));
  return ((w[0] || name)[0] + (w[1] ? w[1][0] : (w[0] || '').slice(1, 2))).toUpperCase();
}
const crestCache = new Map();
function generatedCrest(name) {
  if (!crestCache.has(name)) {
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const hue = h % 360;
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 4l40 12v30c0 26-17 42-40 50C27 88 10 72 10 46V16z" fill="hsl(' + hue + ',55%,38%)" stroke="#fff" stroke-width="4"/>' +
      '<text x="50" y="60" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="30" fill="#fff">' + initials(name).replace(/[<&>]/g, '') + '</text></svg>';
    crestCache.set(name, 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
  }
  return crestCache.get(name);
}
export function crestUrl(clubId) {
  const c = CL[clubId];
  if (!c) return generatedCrest('?');
  if (c.img) return c.img;
  if (!c.custom) return 'assets/img/c/' + c.id + '.webp'; // verkleinert im Repo (GitHub Pages)
  return c.f ? storageUrl(c.f) : generatedCrest(c.n);
}
