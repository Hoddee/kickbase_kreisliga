-- Wer hat das Spiel eingetragen? Angemeldet: Name aus dem Konto, sonst der beim Spielstart eingegebene Name.
-- Wird im Spiel-Detail als „Eingetragen von …“ angezeigt. Alte Spiele bleiben leer.
alter table public.spiele add column if not exists erfasst_von text;
alter table public.spiele drop constraint if exists spiele_erfasst_von_chk;
alter table public.spiele add constraint spiele_erfasst_von_chk check (erfasst_von is null or char_length(erfasst_von) between 1 and 40);
