/* Push-Benachrichtigungen (MVP-Stage, Live-Start). Auf dem iPhone nur in der installierten App (iOS 16.4+),
   anmelden nur nach Tipp (Vorgabe von Apple). Abos landen über rpc/push_anmelden in Supabase. */
import { VAPID_PUBLIC } from '../config.js';
import { rest } from './api.js';

const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
/* iPhone im Safari-Tab: Push gibt es erst nach „Zum Home-Bildschirm“ */
export const pushNeedsInstall = () => isIOS && !standalone;

const key = () => { const s = VAPID_PUBLIC.replace(/-/g, '+').replace(/_/g, '/'), raw = atob(s + '='.repeat((4 - s.length % 4) % 4)); return Uint8Array.from(raw, c => c.charCodeAt(0)); };
const post = (fn, body) => rest('rpc/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export async function pushState() {
  if (!pushSupported()) return 'none';
  if (pushNeedsInstall()) return 'install';
  if (Notification.permission === 'denied') return 'denied';
  try { const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription(); return sub ? 'on' : 'off'; }
  catch (e) { return 'off'; }
}
export async function pushOn() {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key() });
  const j = sub.toJSON();
  await post('push_anmelden', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
  return true;
}
export async function pushOff() {
  const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const ep = sub.endpoint;
  await sub.unsubscribe();
  await post('push_abmelden', { p_endpoint: ep }).catch(() => {});
}
