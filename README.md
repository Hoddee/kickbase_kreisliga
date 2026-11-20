# Kickbase KL

Kickbase-Punkte für die Kreisliga (A2, B2, B5 · Saison 2026/2027). Am Spielfeldrand werden pro Spieler Aktionen
nach der Kickbase-Punktetabelle gebucht – daraus entstehen Punkte, Profile, Marktwerte, die Hall of Fame und ein
Live-Ticker für Zuschauer. Installierbar als App (Home-Bildschirm).

**Live:** https://hoddee.github.io/kickbase_kreisliga/ (GitHub Pages, Branch `main`)

## Funktionen

- **Liga:** Live-Spiele, nächste Spiele, Spieler der Woche, letzte Spiele. Menü unten (Liga, Kader, Spiel, Ranking, Ich),
  zwischen den Bereichen wischen.
- **Punkte vergeben:** bis zu 15 Spieler pro Spiel, Spieluhr mit Halbzeit, Ein-/Auswechseln, Aktionen nach Reitern
  (Angriff, Abwehr, Fehler) mit Suche, Leiste „Zuletzt gebucht“ (löschen oder anderem Spieler geben).
- **Mitbuchen:** bis zu 3 weitere Handys buchen per QR-Code mit (ohne Konto, nur Name). Jeder sperrt seine Spieler,
  Tore darf jeder melden; Uhr, Wechsel, Abpfiff und Speichern bleiben beim Gastgeber.
- **Ein-Hand-Modus:** sechs große Kacheln im Daumenbereich.
- **Tor-Assistent:** nach dem Team-Tor in Schritten Torschütze → Vorlage (mit Extras) → Einleitung, beim Gegentor der Verursacher.
- **Nachtrag:** Spiele nachträglich mit Minuten und Ergebnis eintragen.
- **Profil:** Punkte pro Spiel, Marktwert-Verlauf, Form, Erfolge; Spiel-Detail mit allen Aktionen und Korrekturen.
- **Hall of Fame / Ranking:** Top-Spiele, Tabelle, Neueste, Rekorde.
- **Live:** Zuschauer sehen jede Aktion sofort (Supabase Realtime), Live-Link `?live=<Spiel-ID>` zum Teilen.
- **Teilen:** Spielerkarte und Team-Bild als Bild.
- **Konten:** Registrieren, vom Admin freischalten lassen, eigene Spiele nachtragen; Admins korrigieren gespeicherte Spiele.
- **Rundgänge:** mit App-Bildern und eigenen Fotos – Einführung beim ersten Start und „Punktevergabe erklärt“ beim ersten Punkte vergeben (im Konto erneut aufrufbar).

## Technik

Reines HTML/CSS/JS mit ES-Modulen – kein Build, kein npm, keine Frameworks. Schriften liegen lokal.
Backend ist Supabase (REST, Auth, Realtime, Storage); URL und Publishable Key stehen in `js/config.js`, die Rechte regelt RLS.

Lokal starten:

```bash
python3 -m http.server
```

Dann http://localhost:8000 öffnen (am besten in Handy-Breite, die App wird fast nur am Smartphone genutzt).

**Updates:** Der Service Worker liefert die App aus dem Cache. Bei jeder Änderung `VERSION` in `sw.js` und
`APP_VERSION` in `js/config.js` hochzählen – sonst bekommt niemand das Update.

## Aufbau

```
index.html              alle Ansichten als Abschnitte, Startbildschirm-CSS inline
manifest.webmanifest    App-Manifest (Name, Icon, Farben)
sw.js                   Service Worker (App-Dateien aus dem Cache, Bilder einmal laden)
css/
  fonts.css             KL Pitch (Saira, variabel), Oxanium, Inter Tight
  tokens.css, base.css, live.css, booking.css, views.css, theme.css, admin.css, profile.css, sheet.css, feel.css
  brand.css             Kickbase-Look (Schwarz/Weiß), wird zuletzt geladen
js/
  main.js               Einstieg, Klick-Delegation, Sekundentakt, Wake Lock
  config.js             Supabase, Saison, Version, Speicher-Schlüssel
  router.js             Ansichten mit Verlauf, Blätter von unten
  core/                 game (Spielzustand + Punkte), correct (Korrekturen), market (Marktwert), cutout (Fotos freistellen), qr (QR-Code), util, icons
  data/                 actions (Punktetabelle), clubs, players (Offline-Kader), schedule (Spielpläne)
  services/             api (REST), auth (Login, Konten), live (Live senden/empfangen), mit (Mitbuchen), push, traffic
  ui/                   start, tabbar, setup, live, booking, goal, squad, match, profile, hof, me, admin, watch,
                        share, intro, feel, sheet, components, onehand, mit, mvp
supabase/migrations/    SQL für Tabellen und Rechte (fortlaufend nummeriert)
assets/                 fonts, icons (Logo, App-Icons), img (p = Spielerfotos, p/s = Vorschau, c = Wappen, tut = Rundgang-Bilder; WebP)
```

## Datenbank (Supabase)

| Tabelle | Inhalt | Rechte |
|---------|--------|--------|
| `spiele` | gespeicherte Spiele mit allen Aktionen (`events`) | alle lesen und live eintragen; Nachträge, Ändern, Löschen nur Admin bzw. freigeschaltete Spieler (eigene) |
| `kader` | Spieler, Position, Start-Marktwert, Status, Foto | alle lesen; ändern nur Admin |
| `spielplan` | Spielpläne aller Teams | alle lesen; ändern nur Admin |
| `spieler_konten` | Nutzer ↔ Spieler, Status offen/frei/abgelehnt | eigener Antrag; freischalten nur Admin |
| `live_spiele` | Stand laufender Spiele für den Live-Ticker | alle lesen; schreiben per Geräte-Schlüssel (`x-live-key`, nur Hash gespeichert) |
| `admins` | Benutzer-IDs mit Admin-Rechten | nur per SQL |

Storage-Bucket `kickbase`: Spielerfotos (nur Admins) und Bilder von Gastspielern/eigenen Gegnern unter `gast/`
(nur neue Dateien). Feste Bilder liegen im Repo unter `assets/img`, um den Supabase-Traffic klein zu halten.

**Schemaänderungen:** neue Datei `supabase/migrations/0NN_name.sql` (idempotent) und im Supabase-SQL-Editor ausführen.
**Admin werden:** Benutzer unter Authentication → Users anlegen, dann `003_admin_eintragen.sql` ausführen.

## Mitarbeiten

Arbeit auf Feature-Branches, Pull Request nach `main`. Hinweise für Claude Code und Projektregeln stehen in [`CLAUDE.md`](CLAUDE.md).
