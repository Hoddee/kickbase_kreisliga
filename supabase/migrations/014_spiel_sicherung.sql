-- Sicherung laufender Spiele: Das Handy, das Punkte vergibt, legt hier alle paar Sekunden seinen kompletten
-- Spielstand ab. Verliert iOS den Speicher der App (z. B. nach dem Wegwischen), holt die App das Spiel von hier zurück.
-- Eine Zeile pro Gerät. Lesen, schreiben und löschen kann nur das Gerät mit dem passenden Schlüssel
-- (Header "x-live-key", wie bei live_spiele; gespeichert ist nur der SHA-256-Wert). Kein Realtime, kein öffentliches Lesen.
-- Benötigt public.live_key_hash() aus 009_live.sql.

create table if not exists public.spiel_sicherung (
  key_hash   text primary key,
  data       jsonb not null check (pg_column_size(data) < 400000),
  updated_at timestamptz not null default now()
);

alter table public.spiel_sicherung enable row level security;

drop policy if exists "sicherung lesen" on public.spiel_sicherung;
create policy "sicherung lesen" on public.spiel_sicherung for select to anon, authenticated
  using (key_hash = public.live_key_hash());

drop policy if exists "sicherung anlegen" on public.spiel_sicherung;
create policy "sicherung anlegen" on public.spiel_sicherung for insert to anon, authenticated
  with check (length(coalesce(current_setting('request.headers', true)::json->>'x-live-key', '')) >= 24 and key_hash = public.live_key_hash());

drop policy if exists "sicherung aendern" on public.spiel_sicherung;
create policy "sicherung aendern" on public.spiel_sicherung for update to anon, authenticated
  using (key_hash = public.live_key_hash()) with check (key_hash = public.live_key_hash());

drop policy if exists "sicherung loeschen" on public.spiel_sicherung;
create policy "sicherung loeschen" on public.spiel_sicherung for delete to anon, authenticated
  using (key_hash = public.live_key_hash());

grant select, insert, update, delete on public.spiel_sicherung to anon, authenticated;

-- Zeitstempel vom Server; Sicherungen älter als 2 Tage räumen sich beim nächsten Anlegen selbst auf
create or replace function public.sicherung_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    delete from public.spiel_sicherung where updated_at < now() - interval '2 days';
  end if;
  return new;
end $$;

drop trigger if exists sicherung_touch on public.spiel_sicherung;
create trigger sicherung_touch before insert or update on public.spiel_sicherung
  for each row execute function public.sicherung_touch();

select 'spiel_sicherung bereit' as status;
