# CLAUDE.md – Kreisliga Kickbase

Hinweise für Claude Code. Die README ist auf dem Stand v4.3 (Nov. 2026) – bei größeren Änderungen mitpflegen.
Im Zweifel gilt der Code und die Merge-Historie (`git log --merges`).

## Was das ist
„Kickbase KL“ (Logo `assets/icons/logo.svg`, „KL“ kursiv): PWA im Kickbase-Stil für Amateurfußball (Kreisliga A2/B2/B5, Saison 2026/2027). Am Spielfeldrand werden pro Spieler
Aktionen nach der Kickbase-Punktetabelle gebucht; daraus entstehen Punkte, Spielerprofile, Marktwerte, Hall of Fame
und eine Live-Ansicht für Zuschauer. Live: https://hoddee.github.io/kickbase_kreisliga/ (GitHub Pages, Branch `main`).

Nutzer und Sprache: deutsch. UI-Texte, Code-Kommentare, Commit-Messages und Antworten an den Nutzer auf Deutsch.
Der Nutzer ist Azubi Fachinformatiker Anwendungsentwicklung: Technik darf benannt werden, aber kurz. Antworten knapp,
Ergebnis zuerst, was er selbst tun muss (SQL ausführen, mergen) klar als eigener Schritt. UI-Texte kurz und nicht „KI-mäßig“.
**Keine erklärenden Hinweistexte in der Oberfläche** (z. B. „Nach dem Tor fragt die App …“, „Mit dem Link können alle …“,
Erklärzeilen unter Optionen). Beschriftungen knapp halten; Erklärungen gehören höchstens in die Rundgänge (`intro.js`).

## Technik
- Reines HTML/CSS/JS mit ES-Modulen. **Kein Build, kein npm, keine Frameworks, keine CDNs.** Schriften lokal.
  Einzige Ausnahme: `js/core/cutout.js` lädt bei Bedarf `@imgly/background-removal` von jsdelivr (KI-Freistellen von Fotos).
- Backend: Supabase (REST + Auth + Realtime + Storage). URL und Publishable Key in `js/config.js` (öffentlich, Rechte per RLS).
- Lokal testen: `python3 -m http.server` im Repo-Root, dann im Browser (Playwright ist vorinstalliert). Handy-Ansicht
  testen (390 px breit) – die App wird fast nur auf dem Smartphone benutzt. Supabase-Aufrufe im Test abfangen,
  nichts in die echte Datenbank schreiben.
- **Tests:** `node tests/run.js` (alle) bzw. `node tests/run.js halbzeit menue` (einzelne) – Playwright im iPhone-Format,
  startet selbst einen Server auf Port 8123, liest echte Daten, fängt alle Schreibzugriffe ab. Nach jeder Änderung laufen lassen;
  neue Abläufe als eigene Datei in `tests/` (Muster: `lib.js` → `setup()`, am Ende `console.log('Fehler:', …)`).
  Nicht abgedeckt und weiter von Hand prüfen: echtes iPhone (Home-Bildschirm, Gesten), Live mit zwei echten Geräten.

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
- `js/ui/goal.js` – Tor-Assistent: nach Team-Tor/Gegentor (oder „Tor“/„Elfmeter“ beim Spieler) Blatt mit Torschütze,
  Vorlage (+ Art, Boni wie absichtlich/Großchance) und Tor eingeleitet bzw. Gegentor-Verursacher. Team-Tor ist schon gebucht;
  jeder Tipp bucht sofort (`gg` = Tor-Gruppe, `ga: 1`), „Tor zurück“ entfernt die ganze Gruppe. Team-Tore haben jetzt immer `grp`.
  Begleitaktionen nie automatisch buchen (nicht jedes Tor bekommt sie bei Kickbase/Opta).
  Aufbau als Assistent in Schritten (Torschütze → Vorlage → Einleitung; Schritte ohne mögliche Auswahl fallen weg),
  Blatt mit fester Höhe: nur `.ga-body` scrollt, Fußzeile mit Zusammenfassung und „Fertig“ steht immer. Das `.ga-panel`
  wird nur einmal angelegt (sonst fährt es bei jedem Tipp neu ein). Optionen als Zeilen mit kurzer Erklärung.
- Aktionen in Angriff/Abwehr/Fehler nach Bedeutung gruppiert (`GROUPS` in `actions.js`), Suche über alle Reiter (`#aq`).
  Reihenfolge: kleine Punkte oben (schnell erreichbar), große unten – Gruppen nach Durchschnitt, in der Gruppe aufsteigend.
- Rundgänge (`js/ui/intro.js`): Einführung (`KEYS.intro2`) und „Punktevergabe erklärt“ (`KEYS.tourBook`, beim ersten
  „Punkte vergeben“). Je einmal pro Gerät; neue Fassung = neuer Schlüssel. Bilder: Screenshots als WebP in `assets/img/tut/`
  (600×676, Fenster 390×440 aufgenommen). Ändert sich die Oberfläche stark, die Bilder neu aufnehmen.
- Spiel-Detail: „Korrekturen (n)“ öffnet ein eigenes Blatt (Ansicht `corr`, Overlay über `match`).
  Admin: „Spiel löschen“ steht unauffällig unten im Korrektur-Modus (mit Rückfrage). „Eingetragen von …“ aus Spalte
  `erfasst_von` (Migration 011; angemeldet = Kontoname, sonst einmal „Dein Name“ abfragen, `KEYS.recorder`).
  Anzeige als Karte `reporterHtml` (components.js) – auch live („Trägt gerade ein“, `by`/`byP` im Live-Stand); mit Spielerprofil Foto + Link.
- Hall of Fame: Reiter Übersicht (Top-3-Ranglisten), Tabelle, MVP, Rekorde, Alle Spiele (je 30 nachladen).
  „Detaillierte Statistiken“ (Ansicht `ui.tab = 'stats'`): Ranglisten je Aktion aus allen Events (`loadAllEvents`, einmal pro Sitzung).
  Lädt beim Öffnen nur, wenn noch keine Daten da sind (Supabase-Traffic) – neu laden per Ziehen.
- Spieltag / MVP-Stage (`js/ui/mvp.js`, Ansicht `mvp`): Spieltag = Woche Mo–So (Gerätezeit), bestes Spiel je Spieler zählt.
  Montag danach 19:00 wird er „gelauncht“: Stage mit Top 3 öffnet sich einmal von selbst (`KEYS.mvpSeen` = Spieltag-ID),
  davor zeigt die Liga den vorigen Spieltag plus Countdown. Nur Spieltage mit mind. 3 verschiedenen Spielern zählen
  (`MIN_PLAYERS`); MVP-Verlauf und „Meiste MVP-Titel“ im Reiter MVP der Hall of Fame. Spieltag-Nummer über `ANCHOR` (09.11.2026 = 13.) + Wochen mit
  Spielen im Spielplan – zum Saisonwechsel anpassen. Klassen der Stage immer mit `mvp-` (`.go` gab es schon → Kollision).
- Punktevergabe: Leiste „Zuletzt gebucht“ unten (letzte 3, antippen = löschen / anderem Spieler geben), Halbzeit über
  `S.ht` (Halbzeitpfiff → „2. Halbzeit anpfeifen“, Hinweisleiste in allen Reitern ab 45’/90’).
- Live-Link: `?live=<Spiel-ID>` (= uid des ersten Spielers) öffnet den Live-Ticker, nach dem Abpfiff das gespeicherte Spiel.
  Team-Bild (`shareTeamCard` in `share.js`) bei Spielen mit mehreren Spielern.
- `js/ui/feel.js` + `css/feel.css` – App-Gefühl: Druck-Rückmeldung, Rand-Wischen = Zurück (nur iOS-Home-Bildschirm),
  Ziehen zum Aktualisieren (`REFRESH` je Ansicht), Service-Worker-Registrierung mit Update-Prüfung beim Zurückholen der App.
  Der Router merkt sich die Scrollposition je Ansicht und lässt Ansichten hereingleiten (`slideIn`); Ladezustände mit `skeleton()`.
- Installierte App (Home-Bildschirm) testen: iOS weckt sie nur auf statt neu zu starten – Updates kommen über `feel.js`.
- Look (seit v4.0): `css/brand.css` wird zuletzt geladen und setzt den Kickbase-Stil – Schwarz/Weiß, Knöpfe weiß,
  Auswahl mit weißer Kante, Farbe nur für Punkte-Stufen/Trends, Rot (`--live`) nur für Live. `--kb-red` ist dort absichtlich
  Weiß (alte Akzentfarbe). Schriften: „KL Pitch“ = Saira als variable Schrift (`assets/fonts/saira-kl-var.woff2`, Breite 70–100 %),
  Nachbau von KB Pitch: Überschriften mit `font-stretch: 88%` + `-0.02em` (`--font-head`), Zahlen normal breit (`--font-display`).
  Text, Spielernamen in Listen (normale Schreibweise, keine Großbuchstaben) und der kleine Name über der Punktzahl in Inter Tight (wie KB Volksans bei Kickbase).
  Die Original-Schriften von Kickbase nicht einbauen (keine Lizenz zur Weitergabe).
- Menü unten (`js/ui/tabbar.js`, `#tabbar`): Liga (`start`), Kader (`kader`, in `start.js`), Spiel (laufendes Spiel oder neues),
  Ranking (`hof`), Ich (`me`/`admin`). Menüpunkte rufen `show(name, { tab: true })` – der Verlauf wird ersetzt statt gestapelt.
  `body.has-tabbar` / `body.tab-root` steuern Abstand unten und den ausgeblendeten Zurück-Knopf. Router-Hook: `onShow(fn)`.
  Waagerecht wischen wechselt zwischen Liga ⇄ Kader ⇄ Ranking ⇄ Ich (`initSwipe` in `tabbar.js`, nur bei `tab-root`);
  Leisten, die selbst waagerecht scrollen, und `[data-noswipe]` sind ausgenommen.
- `css/` – `theme.css` muss nach den Basis-CSS eingebunden sein (Reihenfolge der `<link>` zählt); neue CSS-Dateien in `index.html` und `sw.js` eintragen.
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
- **Speichern ohne Anmeldung bleibt bewusst erlaubt** (Entscheidung des Nutzers, Nov. 2026) – erst bei echtem Missbrauch
  einschränken, nicht ungefragt vorschlagen. Schutz vor eingeschleustem Code: Daten aus `spiele` und `live_spiele` werden beim
  Laden geprüft (`cleanGame`/`cleanEvents` in `api.js`, `cleanLive` in `live.js`: Zahlen erzwingen, IDs prüfen), `fmt()` macht
  immer eine Zahl, Texte immer mit `esc()`. Neue Felder aus der DB dort mit aufnehmen.
- Bild-Traffic sparsam halten (Supabase-Limit): feste Bilder liegen im Repo unter `assets/img` als WebP
  (`p/` Spielerfotos 600×830, `p/s/` Vorschau 128 px, `c/` Wappen). Neue Spieler-ID dann in `LOCAL_PHOTOS`
  (`js/data/players.js`) eintragen und in der DB `foto` auf NULL lassen. Wird ein vorhandenes Bild ersetzt, `IMG` in `sw.js` hochzählen.

## Regeln bei jeder Änderung
- **`sw.js`: `VERSION` bei jeder Änderung hochzählen** (z. B. `kl-v3.11.0` → `kl-v3.11.1`, größere Features Minor-Sprung).
  Der Service Worker liefert App-Dateien **aus dem Cache** (schneller Start) – ohne neue VERSION bekommt niemand das Update.
  **`APP_VERSION` in `config.js` gleich mitziehen** (wird im Konto angezeigt).
- Neue JS-Datei: in `SHELL` (`sw.js`) und als `<link rel="modulepreload">` in `index.html`. Neue CSS-Datei: in `SHELL` und in
  `index.html` im selben Muster wie die anderen (`media="print" onload="this.media='all'"` + `<noscript>`-Zeile).
  Das CSS des Startbildschirms steht inline in `index.html`; `main.js` blendet ihn erst aus, wenn alle Stylesheets geladen sind.
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
- Supabase: Cached Egress (Gratis 5 GB/Monat) war im Okt./Nov. überschritten (Bilder aus dem Storage, inzwischen behoben).
  Grace Period bis 08.12.2026; danach gibt es beim nächsten Überschreiten **keine** Schonfrist mehr (sofort 402).
  Bild- und Abfrage-Traffic deshalb weiter sparsam halten.
- Saisonwechsel: `SEASON` steht fest in `config.js`, Plan für Marktwerte/Kader/Hall of Fame fehlt.
