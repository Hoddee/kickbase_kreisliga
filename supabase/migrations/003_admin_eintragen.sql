-- Einmalig nach dem Anlegen des Admin-Kontos (Authentication → Users → Add user) ausführen:
insert into public.admins (user_id)
select id from auth.users where email = 'collinniklas@yahoo.de'
on conflict (user_id) do nothing;
