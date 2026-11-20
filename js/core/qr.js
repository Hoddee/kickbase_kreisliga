/* QR-Code (Byte-Modus, Fehlerkorrektur M, Version 1–10 ≈ bis 213 Zeichen) als SVG – ohne Bibliothek.
   Verfahren nach ISO/IEC 18004; geprüft gegen die Python-Bibliothek „qrcode“ (gleiche Matrix für alle 8 Masken). */
const EC = [null, [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0], [16, 4, 27, 0, 0],
  [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44]]; // [EC je Block, Blöcke1, Daten1, Blöcke2, Daten2]
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

/* Galois-Feld GF(256) mit Polynom 0x11D */
const EXP = new Array(512), LOG = new Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
function rsEc(data, n) {
  let g = [1];
  for (let i = 0; i < n; i++) { const r = new Array(g.length + 1).fill(0); g.forEach((c, j) => { r[j] ^= c; r[j + 1] ^= mul(c, EXP[i]); }); g = r; }
  const res = data.concat(new Array(n).fill(0));
  for (let i = 0; i < data.length; i++) { const f = res[i]; if (f) for (let j = 0; j < g.length; j++) res[i + j] ^= mul(g[j], f); }
  return res.slice(data.length);
}
const bch = (v, poly, bits) => { let x = v << bits; const deg = Math.floor(Math.log2(poly)); while (Math.floor(Math.log2(x || 1)) >= deg && x) x ^= poly << (Math.floor(Math.log2(x)) - deg); return (v << bits) | x; };

function codewords(bytes, ver) {
  const [ecn, b1, d1, b2, d2] = EC[ver], cap = b1 * d1 + b2 * d2, bits = [];
  const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1); };
  put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach(b => put(b, 8));
  put(0, Math.min(4, cap * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let p = 0; data.length < cap; p++) data.push(p % 2 ? 0x11 : 0xec);
  const blocks = [];
  let o = 0;
  for (let i = 0; i < b1 + b2; i++) { const n = i < b1 ? d1 : d2; blocks.push(data.slice(o, o + n)); o += n; }
  const ecs = blocks.map(b => rsEc(b, ecn)), out = [];
  for (let i = 0; i < Math.max(d1, d2); i++) for (const b of blocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ecn; i++) for (const e of ecs) out.push(e[i]);
  return out;
}

const MASKS = [(r, c) => (r + c) % 2 === 0, r => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => (r * c) % 2 + (r * c) % 3 === 0,
  (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0, (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0];

function build(ver, cw, mask) {
  const n = ver * 4 + 17, m = Array.from({ length: n }, () => new Array(n).fill(null));
  const set = (r, c, v) => { m[r][c] = v ? 1 : 0; };
  const finder = (r0, c0) => { for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) { const rr = r0 + r, cc = c0 + c; if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
    set(rr, cc, r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4))); } };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  for (let i = 8; i < n - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const al = ALIGN[ver];
  for (const r of al) for (const c of al) {
    if ((r === 6 && c === 6) || (r === 6 && c === al[al.length - 1]) || (r === al[al.length - 1] && c === 6)) continue;
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) set(r + y, c + x, Math.max(Math.abs(y), Math.abs(x)) !== 1);
  }
  set(n - 8, 8, 1); // dunkles Modul
  /* Format- und Versionsbereiche reservieren */
  for (let i = 0; i < 9; i++) { if (m[8][i] === null) m[8][i] = 0; if (m[i][8] === null) m[i][8] = 0; }
  for (let i = 0; i < 8; i++) { if (m[8][n - 1 - i] === null) m[8][n - 1 - i] = 0; if (m[n - 1 - i][8] === null) m[n - 1 - i][8] = 0; }
  if (ver >= 7) for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { m[i][n - 11 + j] = 0; m[n - 11 + j][i] = 0; }
  const fixed = m.map(row => row.map(v => v !== null));
  /* Daten im Zickzack von unten rechts */
  let bit = 0;
  const bits = [];
  cw.forEach(b => { for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1); });
  for (let c = n - 1; c > 0; c -= 2) {
    if (c === 6) c--;
    for (let k = 0; k < n; k++) {
      const r = ((c + 1) & 2) ? k : n - 1 - k;
      for (let d = 0; d < 2; d++) {
        const cc = c - d;
        if (fixed[r][cc]) continue;
        let v = bit < bits.length ? bits[bit] : 0; bit++;
        if (MASKS[mask](r, cc)) v ^= 1;
        m[r][cc] = v;
      }
    }
  }
  /* Formatinformation (Fehlerkorrektur M = 00) */
  const f = bch(mask, 0x537, 10) ^ 0x5412;
  for (let i = 0; i < 15; i++) {
    const v = (f >> i) & 1;
    if (i < 6) m[i][8] = v; else if (i < 8) m[i + 1][8] = v; else m[n - 15 + i][8] = v;
    if (i < 8) m[8][n - 1 - i] = v; else if (i < 9) m[8][15 - i - 1 + 1] = v; else m[8][15 - i - 1] = v;
  }
  if (ver >= 7) {
    const v = bch(ver, 0x1f25, 12);
    for (let i = 0; i < 18; i++) { const b = (v >> i) & 1, a = Math.floor(i / 3), c = i % 3 + n - 11; m[a][c] = b; m[c][a] = b; }
  }
  return m;
}

function penalty(m) {
  const n = m.length;
  let p = 0;
  for (let k = 0; k < 2; k++) for (let i = 0; i < n; i++) {
    let run = 1;
    for (let j = 1; j < n; j++) {
      const a = k ? m[j][i] : m[i][j], b = k ? m[j - 1][i] : m[i][j - 1];
      if (a === b) { run++; if (j === n - 1 && run >= 5) p += run - 2; } else { if (run >= 5) p += run - 2; run = 1; }
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) { const v = m[i][j]; if (v === m[i + 1][j] && v === m[i][j + 1] && v === m[i + 1][j + 1]) p += 3; }
  const pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], rev = pat.slice().reverse();
  for (let i = 0; i < n; i++) for (let j = 0; j <= n - 11; j++) for (const pp of [pat, rev]) {
    if (pp.every((v, k) => m[i][j + k] === v)) p += 40;
    if (pp.every((v, k) => m[j + k][i] === v)) p += 40;
  }
  let dark = 0; m.forEach(r => r.forEach(v => { dark += v; }));
  p += Math.floor(Math.abs(dark * 100 / (n * n) - 50) / 5) * 10;
  return p;
}

/* Matrix (0/1) für einen Text; mask = feste Maske (nur für Tests), sonst die beste */
export function qrMatrix(text, mask = null) {
  const bytes = [...new TextEncoder().encode(text)];
  let ver = 1;
  while (ver <= 10) { const [, b1, d1, b2, d2] = EC[ver]; if (bytes.length + (ver < 10 ? 2 : 3) <= b1 * d1 + b2 * d2) break; ver++; }
  if (ver > 10) throw new Error('Text zu lang für den QR-Code');
  const cw = codewords(bytes, ver);
  if (mask != null) return build(ver, cw, mask);
  let best = null, bp = Infinity;
  for (let k = 0; k < 8; k++) { const m = build(ver, cw, k), p = penalty(m); if (p < bp) { bp = p; best = m; } }
  return best;
}
/* Als SVG mit Ruhezone */
export function qrSvg(text, { dark = '#131417', light = '#fff' } = {}) {
  const m = qrMatrix(text), n = m.length, q = 4;
  let d = '';
  m.forEach((row, r) => row.forEach((v, c) => { if (v) d += 'M' + (c + q) + ' ' + (r + q) + 'h1v1h-1z'; }));
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (n + q * 2) + ' ' + (n + q * 2) + '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="' + light + '"/><path fill="' + dark + '" d="' + d + '"/></svg>';
}
