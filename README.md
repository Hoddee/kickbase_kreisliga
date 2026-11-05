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
  data/                 Vereine (A2, B2, B5), Spielpläne, Kader (Offline-Stand), Aktionen/Punktetabelle
  core/cutout.js        Bilder freistellen (Hintergrund entfernen) und zuschneiden
  core/game.js          Spielzustand und komplette Punkteberechnung
  core/market.js        Marktwert-Modell
  core/util.js, icons.js
  services/api.js       REST-Zugriff (spiele, kader)
  services/auth.js      Admin-Login über Supabase Auth
  ui/                   start (Übersicht), profile (Spielerprofil), setup (Neues Spiel), live (Spielerkarte),
                        booking (Punktevergabe), hof, admin, share, components
supabase/migrations/    SQL für Tabellen und Rechte
assets/                 Schriften, Icons und Bilder (img/p = Spielerfotos 600 px, img/p/s = Vorschaubilder, img/c = Wappen; alles WebP)
```
## Datenbank (Supabase)

| Tabelle  | Inhalt | Rechte |
|----------|--------|--------|
| `spiele` | gespeicherte Spiele mit allen Aktionen | alle lesen und live eintragen; Nachträge, Ändern, Löschen nur Admin |
| `kader`  | Spieler, Position, Start-Marktwert, Status | alle lesen; ändern nur Admin |
| `admins` | Benutzer-IDs mit Admin-Rechten | nur per SQL |
| `spielplan` | Spielpläne aller Teams (Anstoß, Gegner, Heim) | alle lesen; ändern nur Admin (im Admin-Bereich) |
| `spieler_konten` | Spielerkonten: Nutzer ↔ Spieler, Status offen/frei/abgelehnt | eigener Antrag; freischalten nur Admin |

Registrierungen sind offen (ohne Bestätigungsmail): Spieler wählen beim Registrieren ihren Spieler, der Admin schaltet
das Konto im Admin-Bereich frei (`006_spielerkonten.sql`). Freigeschaltete Spieler dürfen eigene Spiele nachtragen,
bearbeiten und löschen. Admin werden: Benutzer unter Authentication → Users anlegen,
dann `supabase/migrations/003_admin_eintragen.sql` ausführen.

Fotos neuer Spieler landen im Bucket `kickbase` unter `spieler/<id>.png` (Upload nur für Admins, siehe
`supabase/migrations/004_spieler_fotos.sql`). Bilder von Gastspielern und eigenen Gegnern darf jeder unter
`gast/<zufall>.png` hochladen – nur neue Dateien, nichts überschreiben (`005_spielplan_gastbilder.sql`).
Die Spalten `team`, `player_foto`, `opp_foto` in `spiele` speichern Mannschaft (z. B. B5-Einsatz) und diese Bilder.
