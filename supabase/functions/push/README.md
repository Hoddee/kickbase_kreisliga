# Edge Function „push“

Verschickt Push-Benachrichtigungen an alle, die sie im Konto eingeschaltet haben:

- **Live-Start:** ein Spieler → „Silas Klenk ist live“, mehrere → „3 Spieler von VfR Murrhardt sind live“, Text „Live verfolgen 🔻“ (ausgelöst vom Trigger auf `live_spiele`)
- **MVP-Stage:** montags 19 Uhr → „14. Spieltag: Die MVP-Stage ist live“ (Cron, nur wenn der Spieltag mind. 3 Spieler hat)

Auf dem iPhone nur in der installierten App (Home-Bildschirm, iOS 16.4+).

## Einrichten (einmalig)

1. **Secrets** (Dashboard → Edge Functions → Secrets): `PUSH_SECRET`, `VAPID_PUBLIC`, `VAPID_PRIVATE`.
   `VAPID_PUBLIC` ist derselbe Wert wie in `js/config.js`. Die beiden anderen Werte nie ins Repo schreiben.
2. **Function anlegen** (Dashboard → Edge Functions → Deploy a new function → Via Editor): Name `push`,
   Inhalt von `index.ts` einfügen, deployen. Danach in den Function-Einstellungen **„Verify JWT“ ausschalten**
   (die Function prüft selbst den Header `x-push-secret`).
   Alternativ mit der Supabase-CLI: `supabase functions deploy push --no-verify-jwt`.
3. **Geheimnis für die Datenbank** (SQL-Editor, Wert = `PUSH_SECRET`):
   `select vault.create_secret('<PUSH_SECRET>', 'push_secret');`
4. **Migration** `supabase/migrations/013_push.sql` im SQL-Editor ausführen (Tabellen, Trigger, Cron).

## Prüfen

- SQL-Editor: `select public.push_ausloesen('{"type":"mvp"}');` – außerhalb von Montag 19 Uhr passiert absichtlich nichts.
- Live: in der installierten App Benachrichtigungen einschalten, auf einem zweiten Gerät ein Spiel anpfeifen.
- Logs: Dashboard → Edge Functions → push → Logs.
