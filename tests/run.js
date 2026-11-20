/* Alle Tests nacheinander: node tests/run.js  (oder einzelne: node tests/run.js halbzeit menue)
   Startet einen lokalen Server, öffnet die App mit Playwright (vorinstalliert) im iPhone-Format und fängt alle
   Schreibzugriffe auf Supabase ab – gelesen werden echte Daten, geschrieben wird nie. Bilder landen in tests/out/. */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');
const dir = __dirname, root = path.join(dir, '..');
fs.mkdirSync(path.join(dir, 'out'), { recursive: true });
const want = process.argv.slice(2);
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && !['lib.js', 'run.js'].includes(f))
  .filter(f => !want.length || want.includes(f.replace(/\.js$/, '')));
const server = spawn('python3', ['-m', 'http.server', '8123'], { cwd: root, stdio: 'ignore' });
setTimeout(() => {
  const failed = [];
  for (const f of files) {
    const t0 = Date.now(), r = spawnSync('node', [f], { cwd: dir, encoding: 'utf8', timeout: 150000 });
    const out = (r.stdout || '') + (r.stderr || '');
    const ok = r.status === 0 && /Fehler: keine|keine Fehler/.test(out) && !/Fehler: \[|pageerror|Error:/.test(out.replace(/Fehler: keine/g, ''));
    console.log((ok ? '✓ ' : '✗ ') + f.padEnd(24) + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
    if (!ok) { failed.push(f); console.log(out.split('\n').map(l => '    ' + l).join('\n')); }
  }
  server.kill();
  console.log('\n' + (files.length - failed.length) + '/' + files.length + ' bestanden' + (failed.length ? ' – fehlgeschlagen: ' + failed.join(', ') : ''));
  process.exit(failed.length ? 1 : 0);
}, 1000);
