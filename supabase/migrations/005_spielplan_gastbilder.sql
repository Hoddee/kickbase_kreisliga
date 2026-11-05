-- Mannschaft je Spiel (z. B. Einsatz in der B5) und Bilder für Gastspieler / eigene Gegner
alter table public.spiele
  add column if not exists team text,
  add column if not exists player_foto text,
  add column if not exists opp_foto text;

alter table public.spiele drop constraint if exists spiele_team_chk;
alter table public.spiele add constraint spiele_team_chk check (team is null or team ~ '^[A-Za-z0-9_]{1,24}$');
alter table public.spiele drop constraint if exists spiele_fotos_chk;
alter table public.spiele add constraint spiele_fotos_chk check (
  (player_foto is null or player_foto ~ '^gast/[a-f0-9]{24}\.png$') and
  (opp_foto is null or opp_foto ~ '^gast/[a-f0-9]{24}\.png$'));

-- Jeder darf Bilder für Gastspieler / eigene Gegner hochladen (nur neue Dateien unter gast/, kein Überschreiben)
drop policy if exists "gast bilder hochladen" on storage.objects;
create policy "gast bilder hochladen" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'kickbase' and name ~ '^gast/[a-f0-9]{24}\.png$');

-- Uploads auf 5 MB begrenzen
update storage.buckets set file_size_limit = 5242880 where id = 'kickbase' and file_size_limit is null;

select column_name from information_schema.columns where table_schema = 'public' and table_name = 'spiele' and column_name in ('team', 'player_foto', 'opp_foto');
