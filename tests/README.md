# Tests

Browser-Tests der wichtigsten Abläufe (Playwright, iPhone-Format). Kein npm nötig, wenn Playwright installiert ist
(in Claude-Code-Cloud-Sitzungen vorinstalliert).

```bash
node tests/run.js
```

Einzelne Tests: `node tests/run.js halbzeit menue`. Ausgabe und Bilder in `tests/out/` (nicht im Repo).

- Gelesen werden **echte Daten** aus Supabase, alle Schreibzugriffe werden abgefangen – es wird nie etwas gespeichert.
- Ein Test gilt als bestanden, wenn er ohne JavaScript-Fehler durchläuft („Fehler: keine“).
- `tools/tutorial-bilder.js` nimmt die Bilder für die Rundgänge neu auf (`tests/out/tut/`, danach als WebP nach `assets/img/tut/`).
