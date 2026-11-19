# CLAUDE.md – Kreisliga Kickbase

Hinweise für Claude Code. Die README ist teilweise veraltet – im Zweifel gilt der Code und die Merge-Historie
(`git log --merges`), nicht die README.

## Was das ist
PWA im Kickbase-Stil für Amateurfußball (Kreisliga A2/B2/B5, Saison 2026/2027). Am Spielfeldrand werden pro Spieler
Aktionen nach der Kickbase-Punktetabelle gebucht; daraus entstehen Punkte, Spielerprofile, Marktwerte, Hall of Fame
und eine Live-Ansicht für Zuschauer. Live: https://hoddee.github.io/kickbase_kreisliga/ (GitHub Pages, Branch `main`).

Nutzer und Sprache: deutsch. UI-Texte, Code-Kommentare, Commit-Messages und Antworten an den Nutzer auf Deutsch.
Der Nutzer ist kein Entwickler – Erklärungen kurz und ohne Fachjargon, Ergebnisse konkret beschreiben.

## Technik
- Reines HTML/CSS/JS mit ES-Modulen. **Kein Build, kein npm, keine Frameworks, keine CDNs.** Schriften lokal.
- Backend: Supabase (REST + Auth + Realtime + Storage). URL und Publishable Key in `js/config.js` (öffentlich, Rechte per RLS).
- Lokal testen: `python3 -m http.server` im Repo-Root, dann im Browser (Playwright ist vorinstalliert). Handy-Ansicht
  testen – die App wird fast nur auf dem Smartphone benutzt.

## Aufbau (Stand Nov. 2026)
- `index.html` – alle Ansichten als Abschnitte; `js/router.js` blendet genau eine ein (Stapel-Verlauf, Overlays = Blätter von unten,
  Zurück-Taste des Handys wird abgefangen).
- `js/main.js` – Einstieg, Klick-Delegation (`data-nav`, `data-open="p:ID"|"g:UID"`, `data-match`), Sekundentakt, Wake Lock, SW.
- `js/core/game.js` – Spielzustand in localStorage (`KEYS.game`) und gesamte Punkteberechnung. Mehrere Spieler pro Spiel
  (bis `MAX_SQUAD` = 7): aktiver Spieler liegt direkt in `store.S`, die anderen in `store.S.squad`; `withPlayer/eachPlayer` tauschen um.
  Team-Tor/Gegentor (`tg`/`cg`) gelten für alle Spieler (`grp`); ohne Punkte = `silentGoal`, zählt nur fürs Ergebnis.
- `js/core/correct.js` – nachträgliche Korrekturen an gespeicherten Spielen (Admin/Spieler), Boni (Zu null, Sieg …) ziehen automatisch nach.
- `js/core/market.js` – Marktwert: Startwert + Bewertungspunkte je Spiel (1 Punkt = 1 %), rückwirkend aus allen Spielen berechnet.
- `js/core/cutout.js` – Fotos freistellen/zuschneiden im Browser.
- `js/data/` – `actions.js` (Punktetabelle, Zu-null-Werte), `clubs.js` (Vereine/Wappen), `players.js` (Offline-Kader; DB-Tabelle `kader` überschreibt),
  `schedule.js` (Spielpläne, DB-Tabelle `spielplan` überschreibt).
- `js/services/` – `api.js` (REST: spiele, kader, spielplan), `auth.js` (Login, Admin, Spielerkonten), `live.js` (Live senden/empfangen).
- `js/ui/` – start (Übersicht + Live-Kacheln), setup (Neues Spiel), live (Spielerkarte), booking (Punktevergabe), squad (Spielerleiste),
  match (Spiel-Detail-Blatt), profile (Spielerprofil-Blatt), hof (Hall of Fame), me (Mein Bereich), admin, watch (Zuschauer), share, intro, sheet, components.
- `css/` – `theme.css` muss nach den Basis-CSS geladen werden; neue CSS-Dateien in `index.html` und `sw.js` eintragen.

## Datenbank (Supabase)
Tabellen: `spiele` (gespeicherte Spiele inkl. `events` jsonb), `kader`, `admins`, `spielplan`, `spieler_konten`, `live_spiele`
(Schreibrecht per Geräte-Schlüssel im Header `x-live-key`, nur Hash gespeichert). Storage-Bucket `kickbase`.
- Schemaänderungen als neue Datei `supabase/migrations/0NN_name.sql` (fortlaufend nummeriert, idempotent mit `if not exists` /
  `drop policy if exists`). Der Nutzer führt sie selbst im Supabase-SQL-Editor aus – im PR/Antwort ausdrücklich darauf hinweisen.
- Supabase erlaubt kein direktes Löschen in `storage.objects` per SQL.
- Bild-Traffic sparsam halten (Supabase-Limit): feste Bilder liegen im Repo unter `assets/img` als WebP
  (`p/` Spielerfotos 600 px, `p/s/` Vorschau, `c/` Wappen).

## Regeln bei jeder Änderung
- **`sw.js`: `VERSION` bei jeder Änderung hochzählen** (z. B. `kl-v3.9.6` → `kl-v3.9.7`, größere Features Minor-Sprung),
  sonst bekommen Handys das Update nicht. Neue JS/CSS-Dateien in `SHELL` aufnehmen.
- localStorage-Schlüssel in `config.js` nicht umbenennen (laufende Spiele müssen Updates überstehen); Formatänderungen
  am Spielzustand abwärtskompatibel laden (`loadGame`).
- Punkte-/Marktwertregeln orientieren sich an Kickbase. Regeländerungen wirken sich auf gespeicherte Spiele aus –
  vorher klären, ob rückwirkend gewollt.
- Code-Stil: kompakt, 2 Leerzeichen, einfache Anführungszeichen, deutsche Kommentare; HTML-Strings mit `esc()` escapen.
- Commits: deutsche Betreffzeile (Umlaute als ae/oe/ue wie bisher ist ok), darunter Stichpunkte mit `-`.
  Arbeit läuft über Feature-Branches + PR nach `main`; der Nutzer merged selbst.
