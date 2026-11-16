-- 1) Spielerfotos: Rechte vervollständigen
--    Bisher gab es nur INSERT und UPDATE. Zum Ersetzen (x-upsert) und zum Aufräumen
--    braucht der Storage zusätzlich SELECT und DELETE, sonst meldet er
--    "new row violates row-level security policy" – auch bei einer ganz neuen Datei.
drop policy if exists "bilder sehen" on storage.objects;
create policy "bilder sehen" on storage.objects for select to anon, authenticated
  using (bucket_id = 'kickbase');

drop policy if exists "admin spielerfoto loeschen" on storage.objects;
create policy "admin spielerfoto loeschen" on storage.objects for delete to authenticated
  using (bucket_id = 'kickbase' and (storage.foldername(name))[1] in ('spieler', 'gast') and public.is_admin());

-- 2) Marlon Bühler (VfR Murrhardt/ Kirchenkirnberg II, Mittelfeld)
--    foto bleibt leer: das Bild liegt im Repo unter assets/img/p/BuehlerM.webp
insert into public.kader (id, vorname, nachname, verein, pos, mw_start, mw_exakt, status, aktiv, sort)
values ('BuehlerM', 'Marlon', 'Bühler', 'vfrk', 'MIT', 5852911, true, 'fit', true, 190)
on conflict (id) do update set
  vorname = excluded.vorname, nachname = excluded.nachname, verein = excluded.verein,
  pos = excluded.pos, mw_start = excluded.mw_start, mw_exakt = excluded.mw_exakt, updated_at = now();

select id, vorname, nachname, verein, pos, mw_start from public.kader where id = 'BuehlerM';
