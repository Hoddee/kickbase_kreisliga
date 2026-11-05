-- Bilder als WebP (deutlich kleiner) erlauben – für Gastspieler/eigene Gegner und die Bildpfade in "spiele"
alter table public.spiele drop constraint if exists spiele_fotos_chk;
alter table public.spiele add constraint spiele_fotos_chk check (
  (player_foto is null or player_foto ~ '^gast/[a-f0-9]{24}\.(png|webp)$') and
  (opp_foto is null or opp_foto ~ '^gast/[a-f0-9]{24}\.(png|webp)$'));

drop policy if exists "gast bilder hochladen" on storage.objects;
create policy "gast bilder hochladen" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'kickbase' and name ~ '^gast/[a-f0-9]{24}\.(png|webp)$');

-- Vorhandene Dateien: lange Cache-Dauer (Bilder ändern sich nicht; neue Fotos bekommen eine neue Adresse)
update storage.objects set metadata = jsonb_set(metadata, '{cacheControl}', '"max-age=31536000"')
  where bucket_id = 'kickbase';

select count(*) filter (where metadata->>'cacheControl' = 'max-age=31536000') as lange_cache_dauer, count(*) as dateien
from storage.objects where bucket_id = 'kickbase';
