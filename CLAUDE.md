# CLAUDE.md – Kreisliga Kickbase

Hinweise für Claude Code. Die README ist teilweise veraltet – im Zweifel gilt der Code und die Merge-Historie
(`git log --merges`), nicht die README.

## Was das ist
PWA im Kickbase-Stil für Amateurfußball (Kreisliga A2/B2/B5, Saison 2026/2027). Am Spielfeldrand werden pro Spieler
Aktionen nach der Kickbase-Punktetabelle gebucht; daraus entstehen Punkte, Spielerprofile, Marktwerte, Hall of Fame
und eine Live-Ansicht für Zuschauer. Live: https://hoddee.github.io/kickbase_kreisliga/ (GitHub Pages, Branch `main`).

Nutzer und Sprache: deutsch. UI-Texte, Code-Kommentare, Commit-Messages und Antworten an den Nutzer auf Deutsch.
Der Nutzer ist Azubi Fachinformatiker Anwendungsentwicklung: Technik darf benannt werden, aber kurz. Antworten knapp,
Ergebnis zuerst, was er selbst tun muss (SQL ausführen, mergen) klar als eigener Schritt. UI-Texte kurz und nicht „KI-mäßig“.

## Technik
- Reines HTML/CSS/JS mit ES-Modulen. **Kein Build, kein npm, keine Frameworks, keine CDNs.** Schriften lokal.
  Einzige Ausnahme: `js/core/cutout.js` lädt bei Bedarf `@imgly/background-removal` von jsdelivr (KI-Freistellen von Fotos).
- Backend: Supabase (REST + Auth + Realtime + Storage). URL und Publishable Key in `js/config.js` (öffentlich, Rechte per RLS).
- Lokal testen: `python3 -m http.server` im Repo-Root, dann im Browser (Playwright ist vorinstalliert). Handy-Ansicht
  testen (390 px breit) – die App wird fast nur auf dem Smartphone benutzt. Supabase-Aufrufe im Test abfangen,
  nichts in die echte Datenbank schreiben.
- Es gibt noch **keine Tests im Repo**. Wichtige Abläufe, die nach jeder Änderung laufen sollten: Live-Spiel mit
  1 und mehreren Spielern (Tore, Wechsel, Bank, Spieler nachträglich dazu, Abpfiff, Speichern), Nachtrag, Profil-Blatt
  mit Reitern, Spiel-Detail aus Profil und Hall of Fame, Admin-Korrektur, Live-Zuschauer mit zwei Browsern.

## Aufbau (Stand Nov. 2026)
- `index.html` – alle Ansichten als Abschnitte; `js/router.js` blendet genau eine ein (Stapel-Verlauf, Overlays = Blätter von unten,
  Zurück-Taste des Handys wird abgefangen).
- `js/main.js` – Einstieg, Klick-Delegation (`data-nav`, `data-open="p:ID"|"g:UID"`, `data-match`), Sekundentakt, Wake Lock, SW.
- `js/core/game.js` – Spielzustand in localStorage (`KEYS.game`) und gesamte Punkteberechnung. Mehrere Spieler pro Spiel
  (bis `MAX_SQUAD` = 7): aktiver Spieler liegt direkt in `store.S`, die anderen in `store.S.squad`; `withPlayer/eachPlayer` tauschen um.
  Team-Tor/Gegentor (`tg`/`cg`) gelten für alle Spieler (`grp`); ohne Punkte = `silentGoal`, zählt nur fürs Ergebnis.
- `js/core/correct.js` – nachträgliche Korrekturen an gespeicherten Spielen (nur Admin, im Spiel-Detail): Aktionen entfernen
  (`x: 1`, bleiben ausgegraut), nachtragen (`c: 1`), Ergebnis per +/−; Zu null und Sieg/Niederlage ziehen automatisch nach
  (`ac`/`ax`). Freigeschaltete Spieler dürfen bei eigenen Spielen nur die Spieldaten ändern.
- `js/core/market.js` – Marktwert: Startwert + Bewertungspunkte je Spiel (1 Punkt = 1 %), rückwirkend aus allen Spielen berechnet.
- `js/core/cutout.js` – Fotos freistellen/zuschneiden im Browser.
- `js/data/` – `actions.js` (Punktetabelle, Zu-null-Werte), `clubs.js` (Vereine/Wappen), `players.js` (Offline-Kader; DB-Tabelle `kader` überschreibt),
  `schedule.js` (Spielpläne, DB-Tabelle `spielplan` überschreibt).
- `js/services/` – `api.js` (REST: spiele, kader, spielplan), `auth.js` (Login, Admin, Spielerkonten), `live.js` (Live senden/empfangen).
- `js/ui/` – start (Übersicht + Live-Kacheln), setup (Neues Spiel), live (Spielerkarte), booking (Punktevergabe), squad (Spielerleiste),
  match (Spiel-Detail-Blatt), profile (Spielerprofil-Blatt), hof (Hall of Fame), me (Mein Bereich), admin, watch (Zuschauer), share, intro, sheet, components.
- `js/ui/feel.js` + `css/feel.css` – App-Gefühl: Druck-Rückmeldung, Rand-Wischen = Zurück (nur iOS-Home-Bildschirm),
  Ziehen zum Aktualisieren (`REFRESH` je Ansicht), Service-Worker-Registrierung mit Update-Prüfung beim Zurückholen der App.
  Der Router merkt sich die Scrollposition je Ansicht und lässt Ansichten hereingleiten (`slideIn`); Ladezustände mit `skeleton()`.
- Installierte App (Home-Bildschirm) testen: iOS weckt sie nur auf statt neu zu starten – Updates kommen über `feel.js`.
- `css/` – `theme.css` muss nach den Basis-CSS geladen werden; neue CSS-Dateien in `index.html` und `sw.js` eintragen.
  Vor neuen Klassennamen per `grep` prüfen, dass es sie noch nicht gibt – Kollisionen haben schon die Startseite verbreitert.

## Datenbank (Supabase)
Tabellen: `spiele` (gespeicherte Spiele inkl. `events` jsonb), `kader`, `admins`, `spielplan`, `spieler_konten`, `live_spiele`
(Schreibrecht per Geräte-Schlüssel im Header `x-live-key`, nur Hash gespeichert). Storage-Bucket `kickbase`.
- Schemaänderungen als neue Datei `supabase/migrations/0NN_name.sql` (fortlaufend nummeriert, idempotent mit `if not exists` /
  `drop policy if exists`). Der Nutzer führt sie selbst im Supabase-SQL-Editor aus – im PR/Antwort ausdrücklich darauf hinweisen.
- Supabase erlaubt kein direktes Löschen in `storage.objects` per SQL.
- Foto-Upload ohne `x-upsert` (das verlangt zusätzliche Storage-Rechte und scheiterte mit einer RLS-Meldung):
  jedes Foto bekommt einen eigenen Dateinamen.
- Lesen geht anonym per REST (`apikey` = Publishable Key) – gut zum Nachprüfen echter Daten. Schreiben/SQL nur über den Nutzer.
- Bild-Traffic sparsam halten (Supabase-Limit): feste Bilder liegen im Repo unter `assets/img` als WebP
  (`p/` Spielerfotos 600×830, `p/s/` Vorschau 128 px, `c/` Wappen). Neue Spieler-ID dann in `LOCAL_PHOTOS`
  (`js/data/players.js`) eintragen und in der DB `foto` auf NULL lassen. Wird ein vorhandenes Bild ersetzt, `IMG` in `sw.js` hochzählen.

## Regeln bei jeder Änderung
- **`sw.js`: `VERSION` bei jeder Änderung hochzählen** (z. B. `kl-v3.10.0` → `kl-v3.10.1`, größere Features Minor-Sprung),
  sonst bekommen Handys das Update nicht. **`APP_VERSION` in `config.js` gleich mitziehen** (wird im Konto angezeigt).
  Neue JS/CSS-Dateien in `SHELL` aufnehmen.
- localStorage-Schlüssel in `config.js` nicht umbenennen (laufende Spiele müssen Updates überstehen); Formatänderungen
  am Spielzustand abwärtskompatibel laden (`loadGame`).
- Punkte-/Marktwertregeln orientieren sich an Kickbase. Punkte werden beim Buchen gespeichert (neue Regeln gelten
  nur für neue Spiele), Marktwert und Anzeige werden aus allen Spielen neu berechnet – vorher klären, ob rückwirkend gewollt.
- Festgelegte Regeln: Zu null wächst wie der Minutenbonus (je 10 Min. × Positionswert, ohne 45-Min.-Grenze).
  Live gebuchte Spieler ohne Einsatzminuten werden nicht gespeichert und nicht angezeigt; Nachträge immer.
  Tore ohne Punkte (Spieler nicht auf dem Platz) erscheinen nirgends.
- Code-Stil: kompakt, 2 Leerzeichen, einfache Anführungszeichen, deutsche Kommentare; HTML-Strings mit `esc()` escapen.
- Commits: deutsche Betreffzeile (Umlaute als ae/oe/ue wie bisher ist ok), darunter Stichpunkte mit `-`.
  Arbeit läuft über Feature-Branches + PR nach `main`; der Nutzer merged selbst. Im PR stehen, was sich ändert,
  was getestet ist und ob eine Migration auszuführen ist.

## Offene Punkte (Stand 19.11.2026)
- Sicherheit: Punktwerte aus der DB werden teils ohne `esc()` angezeigt (`fmt(...)` in `components.js` u. a.) –
  ein präpariertes Spiel könnte Code einschleusen. `spiele` nimmt anonyme Einträge ungeprüft an (Punkte bis 3000,
  Größe von `events` unbegrenzt). Entscheidung offen, ob Speichern ohne Anmeldung bleiben soll.
- Supabase: Cached Egress (Gratis 5 GB/Monat) war im Okt./Nov. überschritten (Bilder aus dem Storage, inzwischen behoben).
  Grace Period bis 08.12.2026; danach gibt es beim nächsten Überschreiten **keine** Schonfrist mehr (sofort 402).
  Bild- und Abfrage-Traffic deshalb weiter sparsam halten.
- Saisonwechsel: `SEASON` steht fest in `config.js`, Plan für Marktwerte/Kader/Hall of Fame fehlt.
- README ist veraltet.
