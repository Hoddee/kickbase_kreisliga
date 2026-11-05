/* Bilder für Spieler und Wappen aufbereiten: Hintergrund entfernen, zuschneiden, verkleinern.
   - Wappen/Logos auf einfarbigem Hintergrund: schnelles Freistellen per Flächenfüllung vom Rand aus.
   - Fotos (Personen) und unruhige Hintergründe: KI-Freistellung im Browser (@imgly/background-removal, AGPL).
     Das Modell (~45 MB) wird beim ersten Mal geladen und danach vom Browser zwischengespeichert. */

const LIB_URL = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
let libPromise = null;
const loadLib = () => libPromise || (libPromise = import(LIB_URL).catch(e => { libPromise = null; throw e; }));

/* Ausgabeformate: Spieler wie die vorhandenen Fotos (Hochformat 907×1255), Wappen quadratisch */
const FORMAT = {
  player: { w: 907, h: 1255 },
  guest: { w: 600, h: 830 },
  crest: { w: 256, h: 256 }
};

function canvasOf(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
const toBlob = (cv, type = 'image/png') => new Promise((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error('Bild konnte nicht erstellt werden.'))), type));

async function decode(blob, maxSide) {
  let bmp;
  try { bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
  catch (e) { throw new Error('Das Bild kann nicht gelesen werden (bitte JPG oder PNG verwenden).'); }
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const cv = canvasOf(Math.max(1, Math.round(bmp.width * s)), Math.max(1, Math.round(bmp.height * s)));
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  if (bmp.close) bmp.close();
  return cv;
}

/* Randpixel einsammeln */
function borderPixels(d, w, h) {
  const idx = [];
  const step = Math.max(1, Math.floor(Math.min(w, h) / 120));
  for (let x = 0; x < w; x += step) { idx.push(x, (h - 1) * w + x); }
  for (let y = 0; y < h; y += step) { idx.push(y * w, y * w + w - 1); }
  return idx.map(i => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3]]);
}
const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

/* Ist der Rand schon transparent (Bild bereits freigestellt)? */
function alreadyCut(px) { return px.filter(p => p[3] < 24).length / px.length > 0.6; }

/* Häufigste Randfarbe und wie einheitlich der Rand ist */
function borderColor(px) {
  const buckets = new Map();
  for (const p of px) {
    const k = (p[0] >> 5) + ',' + (p[1] >> 5) + ',' + (p[2] >> 5);
    const b = buckets.get(k) || { n: 0, r: 0, g: 0, b: 0 };
    b.n++; b.r += p[0]; b.g += p[1]; b.b += p[2]; buckets.set(k, b);
  }
  const top = [...buckets.values()].sort((a, b) => b.n - a.n)[0];
  const c = [top.r / top.n, top.g / top.n, top.b / top.n];
  const share = px.filter(p => dist(p, c) < 60).length / px.length;
  return { c, share };
}

/* Flächenfüllung vom Rand: alles, was zusammenhängend der Hintergrundfarbe ähnelt, wird transparent.
   Kanten werden weich ausgeblendet, damit keine weißen Säume bleiben. */
function floodRemove(cv, bg) {
  const w = cv.width, h = cv.height, ctx = cv.getContext('2d');
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const HARD = 70, SOFT = 140;
  const seen = new Uint8Array(w * h), stack = [];
  const push = i => { if (!seen[i]) { seen[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop(), o = i * 4;
    const dd = Math.abs(d[o] - bg[0]) + Math.abs(d[o + 1] - bg[1]) + Math.abs(d[o + 2] - bg[2]);
    if (d[o + 3] < 24 || dd < HARD) {
      d[o + 3] = 0;
      const x = i % w, y = (i / w) | 0;
      if (x > 0) push(i - 1);
      if (x < w - 1) push(i + 1);
      if (y > 0) push(i - w);
      if (y < h - 1) push(i + w);
    } else if (dd < SOFT) {
      d[o + 3] = Math.min(d[o + 3], Math.round(255 * (dd - HARD) / (SOFT - HARD)));
    }
  }
  ctx.putImageData(img, 0, 0);
}

/* Auf den sichtbaren Inhalt zuschneiden */
function trim(cv) {
  const w = cv.width, h = cv.height, d = cv.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  if (x1 < 0) throw new Error('Auf dem Bild wurde nichts erkannt.');
  const out = canvasOf(x1 - x0 + 1, y1 - y0 + 1);
  out.getContext('2d').drawImage(cv, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/* In das Zielformat einpassen: Personen unten bündig (wie die Kickbase-Fotos), Wappen mittig */
function fit(cv, kind) {
  const f = FORMAT[kind], out = canvasOf(f.w, f.h), ctx = out.getContext('2d');
  const pad = kind === 'crest' ? 0.06 : 0.03;
  const s = Math.min((f.w * (1 - 2 * pad)) / cv.width, (f.h * (1 - pad)) / cv.height);
  const w = cv.width * s, h = cv.height * s;
  const x = (f.w - w) / 2, y = kind === 'crest' ? (f.h - h) / 2 : f.h - h;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cv, x, y, w, h);
  return out;
}

/**
 * Bild freistellen und aufbereiten.
 * @param {File|Blob} file  ausgewähltes Bild
 * @param {'player'|'guest'|'crest'} kind
 * @param {(text:string)=>void} onStatus  Fortschrittsanzeige
 * @returns {Promise<{blob:Blob, url:string, method:string}>}
 */
export async function cutout(file, kind, onStatus = () => {}) {
  if (!file || !file.size) throw new Error('Kein Bild ausgewählt.');
  if (file.size > 25e6) throw new Error('Das Bild ist zu groß (max. 25 MB).');
  onStatus('Bild wird gelesen …');
  let cv = await decode(file, 1600);
  const ctx = cv.getContext('2d');
  const px = borderPixels(ctx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height);
  let method = 'none';

  if (alreadyCut(px)) method = 'schon-freigestellt';
  else {
    const bc = borderColor(px);
    const simple = kind === 'crest' ? bc.share > 0.6 : bc.share > 0.92;
    if (simple) { floodRemove(cv, bc.c); method = 'flaeche'; }
    else {
      try {
        onStatus('Hintergrund wird entfernt … (beim ersten Mal wird das KI-Modell geladen, ca. 45 MB)');
        const lib = await loadLib();
        const remove = lib.removeBackground || lib.default;
        let lastPct = -1;
        const out = await remove(await toBlob(cv), {
          model: 'isnet_quint8',
          output: { format: 'image/png' },
          progress: (key, cur, total) => {
            if (!total || !/model|wasm/i.test(key)) return;
            const p = Math.floor((cur / total) * 100);
            if (p !== lastPct && p % 5 === 0) { lastPct = p; onStatus('KI-Modell wird geladen … ' + p + ' %'); }
          }
        });
        onStatus('Hintergrund wird entfernt …');
        cv = await decode(out, 1600);
        method = 'ki';
      } catch (e) {
        console.warn('Freistellen per KI nicht möglich', e);
        if (bc.share > 0.5) { floodRemove(cv, bc.c); method = 'flaeche'; }
      }
    }
  }
  const final = fit(trim(cv), kind);
  const blob = await toBlob(final);
  return { blob, url: URL.createObjectURL(blob), method };
}
