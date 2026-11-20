/* Zentrale Konfiguration. Der Publishable Key ist öffentlich gedacht; die Rechte regelt Row Level Security in Supabase. */
export const SUPABASE_URL = 'https://eewvsquscmflxdhkgvna.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_tWF4nhJLNDqHsuGSK07zmw_54ZiRmPU';
export const STORAGE_BASE = SUPABASE_URL + '/storage/v1/object/public/kickbase/';

/* Adresse der App, auf die Passwort-Links aus E-Mails zurückführen */
export const APP_URL = 'https://hoddee.github.io/kickbase_kreisliga/';
/* Öffentlicher Schlüssel für Push-Benachrichtigungen (der private liegt nur als Secret bei der Edge Function „push“) */
export const VAPID_PUBLIC = 'BPpdkr18TxFId_jZJ6A0qLOo3pkdTIdKzKqfSYsnChxvth3Oq3Vn4VzAdmfkCmEZEFQpB9aOw9omTvpAEto28Ms';

export const SEASON = '2026/2027';

/* Angezeigte Version (Konto-Seite) – zusammen mit VERSION in sw.js hochzählen */
export const APP_VERSION = '4.9.1';

/* localStorage-Schlüssel (alte Namen bleiben, damit laufende Spiele ein Update überstehen) */
export const KEYS = {
  game: 'matchday-punkte-v3',
  lastSelection: 'matchday-last-v1', schedule: 'kl-schedule-v1', intro: 'kl-intro-v1', intro2: 'kl-intro-v2', tourBook: 'kl-tour-book-v1', mvpSeen: 'kl-mvp-seen', mvpNews: 'kl-mvp-news', recorder: 'kl-recorder', oneHand: 'kl-onehand', traffic: 'kl-traffic',
  intro3: 'kl-intro-v3', tourBook2: 'kl-tour-book-v2', dev: 'kl-dev', mit: 'kl-mit',
  roster: 'kl-roster-v1',
  auth: 'kl-auth-v1'
};
