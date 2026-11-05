-- Migration 001: Tabelle "spiele" (Hall of Fame). Bereits im Projekt angelegt, hier zur Dokumentation.
create table if not exists public.spiele (
  id uuid primary key default gen_random_uuid(),
  uid text not null unique check (char_length(uid) between 8 and 64),
  created_at timestamptz not null default now(),
  season text not null default '2026/2027',
  player text not null check (char_length(player) between 1 and 40),
  opp text not null check (char_length(opp) between 1 and 40),
  home boolean not null,
  pos text not null check (pos in ('TW','ABW','MIT','ANG')),
  us int not null check (us between 0 and 50),
  them int not null check (them between 0 and 50),
  minutes int not null check (minutes between 0 and 150),
  points int not null check (points between -1000 and 3000),
  goals int not null default 0 check (goals between 0 and 50),
  assists int not null default 0 check (assists between 0 and 50),
  events jsonb not null default '[]'::jsonb
);
alter table public.spiele enable row level security;
drop policy if exists "alle lesen" on public.spiele;
create policy "alle lesen" on public.spiele for select to anon, authenticated using (true);
grant select, insert on public.spiele to anon, authenticated;
-- Die Einfüge-Regel wird in 002 verschärft (Nachträge nur für Admins).
