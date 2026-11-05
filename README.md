# Kreisliga Kickbase

**Live:** https://hoddee.github.io/kickbase_kreisliga/

## Aufbau

```
index.html              Grundgerüst aller Ansichten
manifest.webmanifest    App-Manifest (Icon, Name, Farben)
sw.js                   Service Worker (Offline-Cache)
css/
  fonts.css             Oxanium (Zahlen) + Inter Tight (Text), lokal eingebunden
  tokens.css            Farben (Kickbase-Palette) und Stufenfarben
  base.css, live.css, booking.css, views.css
  theme.css             Kickbase-Designschicht (muss nach den anderen geladen werden)
  admin.css             Admin-Bereich, Formulare, Rekorde
js/
  main.js               Einstieg: Ansichten verdrahten, Sekundentakt, Service Worker
  config.js             Supabase-URL/Key, Saison, Speicher-Schlüssel
  router.js             Ansichtswechsel
  data/                 Vereine, Kader (Offline-Stand), Aktionen/Punktetabelle
  core/game.js          Spielzustand und komplette Punkteberechnung
  core/market.js        Marktwert-Modell
  core/util.js, icons.js
  services/api.js       REST-Zugriff (spiele, kader)
  services/auth.js      Admin-Login über Supabase Auth
  ui/                   live (Spielerkarte), booking (Punktevergabe), setup, hof, admin, share, components
supabase/migrations/    SQL für Tabellen und Rechte
assets/                 Schriften und Icons
```
## Datenbank (Supabase)

| Tabelle  | Inhalt | Rechte |
|----------|--------|--------|
| `spiele` | gespeicherte Spiele mit allen Aktionen | alle lesen und live eintragen; Nachträge, Ändern, Löschen nur Admin |
| `kader`  | Spieler, Position, Start-Marktwert, Status | alle lesen; ändern nur Admin |
| `admins` | Benutzer-IDs mit Admin-Rechten | nur per SQL |

Neue Registrierungen sind in Supabase abgeschaltet. Admin werden: Benutzer unter Authentication → Users anlegen,
dann `supabase/migrations/003_admin_eintragen.sql` ausführen.

Fotos neuer Spieler landen im Bucket `kickbase` unter `spieler/<id>.png` (Upload nur für Admins, siehe
`supabase/migrations/004_spieler_fotos.sql`).

## Eigene Gegner, Gastspieler, neue Spieler

- **Anderer Gegner** (Kachel „+" in der Gegnerauswahl): für jeden Nutzer, z. B. Pokalspiele. Gilt nur für dieses
  Spiel, bekommt ein automatisch erzeugtes Wappen und taucht später nicht in der Auswahl auf.
- **Gastspieler** („+ Gastspieler hinzufügen"): für jeden Nutzer, nur für dieses Spiel, Platzhalter-Foto.
  Gespeicherte Spiele erscheinen in der Hall of Fame mit dem Hinweis „Gast".
- **Spieler hinzufügen** (Admin → Kader): dauerhaft für alle, mit Verein, Position, Start-Marktwert und optionalem Foto.
  Im Kader-Bearbeiten kann das Foto auch nachträglich getauscht werden.
