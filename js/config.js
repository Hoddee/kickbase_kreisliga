/* Zentrale Konfiguration. Der Publishable Key ist öffentlich gedacht; die Rechte regelt Row Level Security in Supabase. */
export const SUPABASE_URL = 'https://eewvsquscmflxdhkgvna.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_tWF4nhJLNDqHsuGSK07zmw_54ZiRmPU';
export const STORAGE_BASE = SUPABASE_URL + '/storage/v1/object/public/kickbase/';

/* Adresse der App, auf die Passwort-Links aus E-Mails zurückführen */
export const APP_URL = 'https://hoddee.github.io/kickbase_kreisliga/';

export const SEASON = '2026/2027';

/* localStorage-Schlüssel (alte Namen bleiben, damit laufende Spiele ein Update überstehen) */
export const KEYS = {
  game: 'matchday-punkte-v3',
  lastSelection: 'matchday-last-v1', schedule: 'kl-schedule-v1', intro: 'kl-intro-v1',
  roster: 'kl-roster-v1',
  auth: 'kl-auth-v1'
};
