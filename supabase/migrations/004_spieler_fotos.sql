-- Migration 004: Foto-Pfad im Kader und Foto-Upload für Admins
-- foto: NULL = Standardpfad spieler/<id>.png, '' = kein Foto (Platzhalter), sonst Pfad im Bucket
alter table public.kader add column if not exists foto text check (foto is null or char_length(foto) <= 120);

drop policy if exists "admin spielerfoto hochladen" on storage.objects;
create policy "admin spielerfoto hochladen" on storage.objects for insert to authenticated
  with check (bucket_id = 'kickbase' and (storage.foldername(name))[1] = 'spieler' and public.is_admin());
drop policy if exists "admin spielerfoto ersetzen" on storage.objects;
create policy "admin spielerfoto ersetzen" on storage.objects for update to authenticated
  using (bucket_id = 'kickbase' and (storage.foldername(name))[1] = 'spieler' and public.is_admin())
  with check (bucket_id = 'kickbase' and (storage.foldername(name))[1] = 'spieler' and public.is_admin());
