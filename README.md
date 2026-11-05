# Kreisliga Edition

Kickbase-Punkte für die Kreisliga: Aktionen live am Spielfeldrand buchen, Endübersicht im Kickbase-Look,
Hall of Fame mit Tabelle, Rekorden und Marktwerten. Läuft als statische Seite auf GitHub Pages,
Daten liegen in Supabase.

**Live:** https://hoddee.github.io/kickbase_kreisliga/

## Funktionen

- **Live buchen**: Spieluhr mit Halbzeit (springt auf 45:00), Ein-/Auswechslung, alle Aktionen der Kickbase-Punktetabelle
  für Torwart, Abwehr, Mittelfeld und Angriff, Schnellleiste, Rückgängig.
- **Automatische Punkte**: Startelf/Eingewechselt, Minutenbonus, „Zu null“ (nur Gegentore auf dem Platz,
  ab einer Halbzeit Einsatz), Sieg/Niederlage.
- **Endübersicht**: Balkendiagramm der Saison, Marktwert-Entwicklung, Punkte nach Bereich, Ergebnisbild zum Teilen.
- **Hall of Fame**: Top-Spiele, Tabelle mit Formkurve, Neueste, Rekorde, Spielerprofile, Spielansicht mit allen Aktionen.
- **Admin** (Login mit E-Mail/Passwort): Spiele nachtragen (mit Datum und Einsatzminuten), Spiele bearbeiten und löschen,
  Kader pflegen (Verletzungsstatus, Stammposition, Start-Marktwert).
- **App-Gefühl**: installierbar („Zum Home-Bildschirm“), funktioniert offline weiter, Bildschirm bleibt beim Buchen an.

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

Kein Build-Schritt nötig: reine ES-Module, die der Browser direkt lädt.

## Datenbank (Supabase)

| Tabelle  | Inhalt | Rechte |
|----------|--------|--------|
| `spiele` | gespeicherte Spiele mit allen Aktionen | alle lesen und live eintragen; Nachträge, Ändern, Löschen nur Admin |
| `kader`  | Spieler, Position, Start-Marktwert, Status | alle lesen; ändern nur Admin |
| `admins` | Benutzer-IDs mit Admin-Rechten | nur per SQL |

Neue Registrierungen sind in Supabase abgeschaltet. Admin werden: Benutzer unter Authentication → Users anlegen,
dann `supabase/migrations/003_admin_eintragen.sql` ausführen.

## Lokal starten

```
python3 -m http.server 8000
```
und http://localhost:8000 öffnen (ES-Module funktionieren nicht über `file://`).

## Marktwerte

Startwert aus dem Kader, leicht „krumm“ gemacht (fest pro Spieler). Pro gespeichertem Spiel:
(Punkte − 120) × 0,04 %, begrenzt auf −8 % bis +12 %, dazu ±0,6 % Markt-Rauschen.

## Schriften

Kickbase nutzt eigene Schriften („KB Pitch“, „KB volksans“). Ersatz mit nahezu gleichen Maßen:
Oxanium 800 (Zahlen, `letter-spacing: -0.035em`) und Inter Tight (Text). Beide SIL Open Font License.
