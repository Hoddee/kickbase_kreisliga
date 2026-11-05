-- Spielerkonten: Spieler registrieren sich selbst (E-Mail + Passwort + "welcher Spieler bin ich"),
-- der Admin schaltet das Konto frei. Freigeschaltete Spieler dürfen ihre eigenen Spiele nachtragen,
-- bearbeiten und löschen.

create table if not exists public.spieler_konten (
  user_id uuid primary key references auth.users (id) on delete cascade,
  spieler_id text not null references public.kader (id) on delete cascade,
  email text,
  status text not null default 'offen' check (status in ('offen', 'frei', 'abgelehnt')),
  created_at timestamptz not null default now(),
  entschieden_at timestamptz
);
-- Pro Spieler höchstens ein freigeschaltetes Konto
create unique index if not exists spieler_konten_ein_konto on public.spieler_konten (spieler_id) where status = 'frei';

alter table public.spieler_konten enable row level security;
drop policy if exists "konto lesen" on public.spieler_konten;
create policy "konto lesen" on public.spieler_konten for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "konto beantragen" on public.spieler_konten;
create policy "konto beantragen" on public.spieler_konten for insert to authenticated
  with check (user_id = auth.uid() and status = 'offen');
-- Eigener Antrag darf geändert werden (z. B. anderer Spieler), solange er nicht freigeschaltet ist – bleibt aber "offen"
drop policy if exists "antrag aendern" on public.spieler_konten;
create policy "antrag aendern" on public.spieler_konten for update to authenticated
  using (user_id = auth.uid() and status <> 'frei')
  with check (user_id = auth.uid() and status = 'offen');
drop policy if exists "admin entscheidet" on public.spieler_konten;
create policy "admin entscheidet" on public.spieler_konten for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin loescht konto" on public.spieler_konten;
create policy "admin loescht konto" on public.spieler_konten for delete to authenticated
  using (public.is_admin());

-- Bei der Registrierung den Antrag automatisch anlegen (Spieler-ID kommt aus den Metadaten)
create or replace function public.neues_spielerkonto() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.raw_user_meta_data ? 'spieler_id'
     and exists (select 1 from public.kader where id = new.raw_user_meta_data ->> 'spieler_id') then
    insert into public.spieler_konten (user_id, spieler_id, email)
    values (new.id, new.raw_user_meta_data ->> 'spieler_id', new.email)
    on conflict (user_id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists spielerkonto_anlegen on auth.users;
create trigger spielerkonto_anlegen after insert on auth.users
  for each row execute function public.neues_spielerkonto();

-- Ist das der freigeschaltete Spieler des angemeldeten Nutzers?
create or replace function public.ist_eigener_spieler(pid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.spieler_konten where user_id = auth.uid() and spieler_id = pid and status = 'frei');
$$;

drop policy if exists "spieler traegt nach" on public.spiele;
create policy "spieler traegt nach" on public.spiele for insert to authenticated
  with check (public.ist_eigener_spieler(player) and played_at <= now() + interval '1 day');
drop policy if exists "spieler aendert" on public.spiele;
create policy "spieler aendert" on public.spiele for update to authenticated
  using (public.ist_eigener_spieler(player)) with check (public.ist_eigener_spieler(player));
drop policy if exists "spieler loescht" on public.spiele;
create policy "spieler loescht" on public.spiele for delete to authenticated
  using (public.ist_eigener_spieler(player));

select count(*) as policies from pg_policies where tablename in ('spieler_konten', 'spiele');
