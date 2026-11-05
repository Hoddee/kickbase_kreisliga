-- Migration 002: Admin-Rolle, Kader-Tabelle, nachgetragene Spiele
-- Im Supabase SQL-Editor ausführbar. Idempotent (kann mehrfach laufen).

-- Admins: wer hier eingetragen ist, darf Spiele ändern/löschen/nachtragen und den Kader pflegen
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists "admin sieht sich" on public.admins;
create policy "admin sieht sich" on public.admins for select to authenticated using (user_id = auth.uid());

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Spiele: Spieldatum und Kennzeichen für Nachträge
alter table public.spiele add column if not exists played_at timestamptz;
update public.spiele set played_at = created_at where played_at is null;
alter table public.spiele alter column played_at set default now();
alter table public.spiele alter column played_at set not null;
alter table public.spiele add column if not exists manual boolean not null default false;
alter table public.spiele add column if not exists updated_at timestamptz;

drop policy if exists "alle eintragen" on public.spiele;
create policy "alle eintragen" on public.spiele for insert to anon, authenticated
  with check (public.is_admin() or (manual = false and played_at between now() - interval '12 hours' and now() + interval '10 minutes'));
drop policy if exists "admin aendert" on public.spiele;
create policy "admin aendert" on public.spiele for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin loescht" on public.spiele;
create policy "admin loescht" on public.spiele for delete to authenticated using (public.is_admin());
grant update, delete on public.spiele to authenticated;

-- Alte PIN-Löschfunktion wird durch den Admin-Login ersetzt
drop function if exists public.delete_game(text, text);
drop table if exists public.admin_pin;

-- Kader: Spieler, Position, Start-Marktwert, Verletzungsstatus (pflegbar im Admin-Bereich)
create table if not exists public.kader (
  id text primary key check (id ~ '^[A-Za-z0-9_]{2,30}$'),
  vorname text not null default '',
  nachname text not null check (char_length(nachname) between 1 and 40),
  verein text not null check (char_length(verein) between 1 and 30),
  pos text not null check (pos in ('TW','ABW','MIT','ANG')),
  mw_start bigint not null check (mw_start between 0 and 500000000),
  mw_exakt boolean not null default false,
  status text not null default 'fit' check (status in ('fit','hit','inj')),
  status_info text not null default '' check (char_length(status_info) <= 80),
  aktiv boolean not null default true,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.kader enable row level security;
drop policy if exists "kader lesen" on public.kader;
create policy "kader lesen" on public.kader for select to anon, authenticated using (true);
drop policy if exists "kader admin" on public.kader;
create policy "kader admin" on public.kader for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.kader to anon, authenticated;
grant insert, update, delete on public.kader to authenticated;

insert into public.kader (id, vorname, nachname, verein, pos, mw_start, mw_exakt, status, sort) values
  ('Barbano','Mattia','Barbano','vfr','ABW',11500000,false,'fit',10),
  ('Doez','Benjamin','Döz','vfr','ABW',8800000,false,'fit',20),
  ('Heckmann','Philipp','Heckmann','vfr','MIT',8000000,false,'fit',30),
  ('Kugler','Mattis','Kugler','vfr','ABW',7500000,false,'fit',40),
  ('Pace','Vincenzo','Pace','vfr','ANG',12500000,false,'fit',50),
  ('Sipala','Angelo','Sipala','vfr','ANG',6500000,false,'hit',60),
  ('Buehler','Marian','Bühler','vfrk','ANG',800000,false,'inj',70),
  ('Fechter','Mikk','Fechter','vfrk','TW',5800000,false,'fit',80),
  ('Filenberg','Daniel','Filenberg','vfrk','ABW',9342812,true,'fit',90),
  ('Klenk','Silas','Klenk','vfrk','MIT',6200000,false,'fit',100),
  ('Knoedler','Jakob','Knödler','vfrk','ABW',3200000,false,'fit',110),
  ('Krauss','Levin','Krauss','vfrk','MIT',6000000,false,'fit',120),
  ('Reule','Noah','Reule','vfrk','ABW',7400000,false,'fit',130),
  ('Schauss','Ben','Schauß','vfrk','MIT',6800000,false,'fit',140),
  ('Schoenenberg','Benedikt','Schönenberg','vfrk','ABW',7000000,false,'fit',150),
  ('Schwer','Benjamin','Schwer','vfrk','ANG',700000,false,'inj',160),
  ('Collin','Alexander','Collin','fornsbach','MIT',8000000,false,'fit',170),
  ('Collin2','Niklas','Collin','fornsbach','MIT',4500000,false,'fit',180)
on conflict (id) do nothing;
