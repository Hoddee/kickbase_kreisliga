/* Zweiter Speicher für das laufende Spiel (IndexedDB). iOS verliert bei weggewischten Home-Bildschirm-Apps manchmal
   die letzten localStorage-Änderungen; IndexedDB schreibt jede Transaktion fest. Fehler werden still ignoriert. */
const NAME = 'kl-vault', STORE = 'kv';
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    try {
      const r = indexedDB.open(NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  });
  return dbp;
}
export async function vaultGet(key) {
  try {
    const d = await db();
    return await new Promise(res => { const q = d.transaction(STORE).objectStore(STORE).get(key); q.onsuccess = () => res(q.result == null ? null : q.result); q.onerror = () => res(null); });
  } catch (e) { return null; }
}
/* Schreiben in Reihenfolge; ein späterer Stand überholt nie einen früheren */
let chain = Promise.resolve();
export function vaultSet(key, value) {
  chain = chain.then(async () => {
    try {
      const d = await db();
      await new Promise(res => { const t = d.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(value, key); t.oncomplete = res; t.onerror = res; t.onabort = res; });
    } catch (e) {}
  });
  return chain;
}
