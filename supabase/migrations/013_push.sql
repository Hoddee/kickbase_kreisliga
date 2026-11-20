-- Push-Benachrichtigungen (installierte App): „X ist live“ beim Anpfiff und montags 19 Uhr „MVP-Stage ist live“.
-- Vorher einmal im SQL-Editor das gemeinsame Geheimnis hinterlegen (Wert NICHT ins Repo):
--   select vault.create_secret('<PUSH_SECRET>', 'push_secret');
-- Versendet wird von der Edge Function „push“ (supabase/functions/push) – siehe dortige README.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Abos: nur über Funktionen erreichbar
create table if not exists public.push_abos (
  endpoint text primary key check (endpoint ~ '^https://' and length(endpoint) < 600),
  p256dh   text not null check (length(p256dh) < 200),
  auth     text not null check (length(auth) < 100),
  erstellt timestamptz not null default now()
);
alter table public.push_abos enable row level security;
revoke all on public.push_abos from anon, authenticated;

-- Bereits verschickt (verhindert doppelte Nachrichten)
create table if not exists public.push_log (
  schluessel text primary key,
  erstellt   timestamptz not null default now()
);
alter table public.push_log enable row level security;
revoke all on public.push_log from anon, authenticated;

create or replace function public.push_anmelden(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.push_abos (endpoint, p256dh, auth) values (p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth;
end $$;
create or replace function public.push_abmelden(p_endpoint text) returns void
language sql security definer set search_path = public as $$ delete from public.push_abos where endpoint = p_endpoint $$;
revoke all on function public.push_anmelden(text, text, text) from public;
revoke all on function public.push_abmelden(text) from public;
grant execute on function public.push_anmelden(text, text, text) to anon, authenticated;
grant execute on function public.push_abmelden(text) to anon, authenticated;

-- Edge Function aufrufen (Geheimnis aus dem Vault)
create or replace function public.push_ausloesen(p_body jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare s text;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = 'push_secret' limit 1;
  if s is null then return; end if;
  perform net.http_post(
    url := 'https://eewvsquscmflxdhkgvna.supabase.co/functions/v1/push',
    body := p_body,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', s)
  );
end $$;
revoke all on function public.push_ausloesen(jsonb) from public, anon, authenticated;

-- Anpfiff: erster Live-Eintrag eines Spiels (Spieler 0) löst „ist live“ aus
create or replace function public.live_push() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce((new.data->>'i')::int, 0) = 0 then
    perform public.push_ausloesen(jsonb_build_object('type', 'live', 'data', new.data));
  end if;
  return new;
end $$;
drop trigger if exists live_push on public.live_spiele;
create trigger live_push after insert on public.live_spiele for each row execute function public.live_push();

-- Montag 19 Uhr deutscher Zeit: Cron läuft in UTC, daher 17 und 18 Uhr UTC (Sommer/Winter);
-- die Function prüft selbst, ob es in Berlin gerade 19 Uhr ist, und schickt pro Spieltag nur einmal.
select cron.unschedule('mvp-push') where exists (select 1 from cron.job where jobname = 'mvp-push');
select cron.schedule('mvp-push', '0 17,18 * * 1', $$ select public.push_ausloesen('{"type":"mvp"}'::jsonb) $$);
