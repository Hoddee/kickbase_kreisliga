/* Ergebnis als Bild (1080x1350) im Look der Spielerkarte – teilen oder herunterladen */
import { store, total, score, names } from '../core/game.js';
import { PL, photoUrl } from '../data/players.js';
import { CL, crestUrl } from '../data/clubs.js';
import { tierOf, dateLong } from '../core/util.js';

const TIER_COLOR = { red: '#E0343F', orange: '#ED8928', lime: '#9CE04A', emerald: '#28DE86', gold: '#E1BE38' };
const imgCache = new Map();

function loadImg(url) {
  if (!imgCache.has(url)) {
    imgCache.set(url, new Promise(res => {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = () => res(i); i.onerror = () => res(null);
      i.src = url;
    }));
  }
  return imgCache.get(url);
}
function fontsReady() {
  try { return Promise.all([document.fonts.load('800 100px Oxanium'), document.fonts.load('500 40px "Inter Tight"')]).catch(() => {}); }
  catch (e) { return Promise.resolve(); }
}
function urls() {
  const m = store.S.match, mine = PL[m.p].c;
  return [photoUrl(m.p), crestUrl(m.home ? mine : m.o), crestUrl(m.home ? m.o : mine)];
}
/* Bilder vorab laden, damit "Teilen" sofort reagiert (Teilen-Dialog braucht eine direkte Nutzeraktion) */
export function preloadShare() { if (store.S.match) { urls().forEach(loadImg); fontsReady(); } }

function fit(x, img, cx, cy, box) {
  if (!img) return;
  const k = Math.min(box / img.width, box / img.height), w = img.width * k, h = img.height * k;
  x.drawImage(img, cx - w / 2, cy - h / 2, w, h);
}
const spacing = (x, v) => { try { x.letterSpacing = v; } catch (e) {} };

export async function shareCard() {
  const S = store.S;
  if (!S.ended || !S.match) return;
  const t = total(), sc = score(), col = TIER_COLOR[tierOf(t)], home = !!S.match.home;
  const [photo, cl, cr] = await Promise.all([...urls().map(loadImg), fontsReady()]);
  const W = 1080, H = 1350, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  x.fillStyle = '#131417'; x.fillRect(0, 0, W, H);
  for (let yy = 40; yy < 780; yy += 54) for (let xx = 27; xx < W; xx += 54) {
    x.fillStyle = 'rgba(255,255,255,' + (yy < 380 ? 0.34 : Math.max(0, 0.34 * (1 - (yy - 380) / 400))).toFixed(3) + ')';
    x.beginPath(); x.arc(xx, yy, 4, 0, 6.2832); x.fill();
  }
  if (photo) { const pw = 800, ph = pw * photo.height / photo.width; x.drawImage(photo, (W - pw) / 2, 30, pw, ph); }
  const g = x.createLinearGradient(0, 640, 0, 1010);
  g.addColorStop(0, 'rgba(19,20,23,0)'); g.addColorStop(1, '#131417');
  x.fillStyle = g; x.fillRect(0, 640, W, 380); x.fillStyle = '#131417'; x.fillRect(0, 1010, W, H - 1010);
  x.textAlign = 'center';
  x.fillStyle = 'rgba(255,255,255,.92)'; x.font = '500 52px "Inter Tight", Arial, sans-serif'; x.fillText(names.player, W / 2, 810);
  spacing(x, '-9px');
  x.fillStyle = col; x.font = '800 290px Oxanium, Arial, sans-serif'; x.fillText(String(t), W / 2, 1050);
  spacing(x, '0px');
  fit(x, cl, 215, 1175, 170); fit(x, cr, 865, 1175, 170);
  spacing(x, '6px');
  x.fillStyle = 'rgba(255,255,255,.92)'; x.font = '500 92px "Inter Tight", Arial, sans-serif';
  x.fillText(home ? sc.us + ' : ' + sc.them : sc.them + ' : ' + sc.us, W / 2, 1200);
  spacing(x, '4px');
  x.fillStyle = '#a8adb4'; x.font = '500 34px "Inter Tight", Arial, sans-serif'; x.fillText('ENDSTAND', W / 2, 1262);
  spacing(x, '0px');
  x.font = '500 26px "Inter Tight", Arial, sans-serif'; x.fillStyle = '#7e8187';
  const d = S.manual && S.playedAt ? new Date(S.playedAt) : new Date();
  x.fillText('Kreisliga Edition · Kreisliga ' + CL[PL[S.match.p].c].lg + ' · ' + dateLong(d), W / 2, 1316);

  cv.toBlob(blob => {
    if (!blob) return;
    const name = names.player.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + t + '.png';
    let file = null;
    try { file = new File([blob], name, { type: 'image/png' }); } catch (e) {}
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: names.player + ' – ' + t + ' Punkte' }).catch(er => { if (er && er.name !== 'AbortError') download(blob, name); });
    } else download(blob, name);
  }, 'image/png');
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
