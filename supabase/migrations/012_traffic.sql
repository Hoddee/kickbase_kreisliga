-- Geschätzter Supabase-Traffic: Jedes Gerät meldet einmal am Tag, wie viel es von Supabase geladen hat (Summe je Tag).
-- Nur über Funktionen erreichbar: melden darf jeder, lesen nur Admins (Anzeige im Admin-Bereich).
create table if not exists public.traffic_tage (
  tag date not null,
  geraet text not null,
  bytes bigint not null default 0,
  primary key (tag, geraet)
);
alter table public.traffic_tage enable row level security;
revoke all on public.traffic_tage from anon, authenticated;

create or replace function public.traffic_melden(p_tag date, p_geraet text, p_bytes bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_geraet !~ '^[a-f0-9]{16,32}$' or p_bytes < 0 or p_bytes > 2000000000
     or p_tag < current_date - 2 or p_tag > current_date + 1 then return; end if;
  insert into public.traffic_tage (tag, geraet, bytes) values (p_tag, p_geraet, p_bytes)
  on conflict (tag, geraet) do update set bytes = greatest(public.traffic_tage.bytes, excluded.bytes);
end $$;
revoke all on function public.traffic_melden(date, text, bigint) from public;
grant execute on function public.traffic_melden(date, text, bigint) to anon, authenticated;

create or replace function public.traffic_monat() returns table (tag date, bytes bigint, geraete integer)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'nur Admins'; end if;
  return query select t.tag, sum(t.bytes)::bigint, count(*)::integer from public.traffic_tage t
    where t.tag >= date_trunc('month', current_date)::date group by t.tag order by t.tag;
end $$;
revoke all on function public.traffic_monat() from public;
grant execute on function public.traffic_monat() to authenticated;

-- Alte Einträge (älter als 3 Monate) beim Melden nicht nötig – bei Bedarf: delete from public.traffic_tage where tag < current_date - 90;
