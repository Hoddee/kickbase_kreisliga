-- Live-Spiele: Das Handy, das gerade Punkte vergibt, schreibt hier seinen aktuellen Stand hinein,
-- alle anderen sehen ihn sofort (Supabase Realtime) als Live-Kachel auf der Startseite.
-- Eine Zeile pro Spieler im laufenden Spiel; nach dem Speichern wird sie wieder gelöscht.
--
-- Schreibrecht ohne Anmeldung: Jedes Gerät hat einen geheimen Schlüssel (Header "x-live-key").
-- In der Tabelle liegt nur dessen SHA-256-Wert – ändern oder löschen kann eine Zeile nur das Gerät,
-- das sie angelegt hat. Lesen darf jeder.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.live_spiele (
  uid        text primary key check (uid ~ '^[A-Za-z0-9_-]{6,64}$'),
  key_hash   text not null,
  data       jsonb not null check (pg_column_size(data) < 60000),
  updated_at timestamptz not null default now()
);

-- Schlüssel aus dem Anfrage-Header als Hash
create or replace function public.live_key_hash() returns text
language sql stable as $$
  select encode(extensions.digest(coalesce(current_setting('request.headers', true)::json->>'x-live-key', ''), 'sha256'), 'hex')
$$;

alter table public.live_spiele enable row level security;

drop policy if exists "live lesen" on public.live_spiele;
create policy "live lesen" on public.live_spiele for select to anon, authenticated using (true);

drop policy if exists "live anlegen" on public.live_spiele;
create policy "live anlegen" on public.live_spiele for insert to anon, authenticated
  with check (length(coalesce(current_setting('request.headers', true)::json->>'x-live-key', '')) >= 24 and key_hash = public.live_key_hash());

drop policy if exists "live aendern" on public.live_spiele;
create policy "live aendern" on public.live_spiele for update to anon, authenticated
  using (key_hash = public.live_key_hash()) with check (key_hash = public.live_key_hash());

drop policy if exists "live loeschen" on public.live_spiele;
create policy "live loeschen" on public.live_spiele for delete to anon, authenticated
  using (key_hash = public.live_key_hash() or public.is_admin());

grant select, insert, update, delete on public.live_spiele to anon, authenticated;

-- Zeitstempel immer vom Server; alte, vergessene Live-Spiele (älter als 8 Stunden) räumen sich selbst auf
create or replace function public.live_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    delete from public.live_spiele where updated_at < now() - interval '8 hours';
  end if;
  return new;
end $$;

drop trigger if exists live_touch on public.live_spiele;
create trigger live_touch before insert or update on public.live_spiele
  for each row execute function public.live_touch();

-- Für Realtime freigeben (Änderungen werden an alle offenen Apps geschickt)
do $$ begin
  alter publication supabase_realtime add table public.live_spiele;
exception when duplicate_object then null; end $$;

select 'live_spiele bereit' as status;
