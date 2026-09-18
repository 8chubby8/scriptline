'use strict';

// IndexedDB is the live store. Entries and pictures are kept apart; entries refer to pictures by id,
// matching the folder layout planned for sync (one file per entry, pictures referenced by name).
const SLStore = (() => {
  const DB_NAME = 'scriptline';
  const DATA_VERSION = 1;

  // UPGRADES[n] turns a version n+1 entry into a version n+2 entry.
  // Add one here whenever the shape of an entry changes; old data and backups upgrade quietly on load.
  const UPGRADES = [];

  let db;

  const req = r => new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

  async function open() {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('entries', { keyPath: 'id' });
      d.createObjectStore('pictures', { keyPath: 'id' });
      d.createObjectStore('meta', { keyPath: 'key' });
    };
    db = await req(r);
  }

  const store = (name, mode = 'readonly') => db.transaction(name, mode).objectStore(name);

  function upgrade(e) {
    let v = e.v || 1;
    while (v < DATA_VERSION) e = UPGRADES[v++ - 1](e);
    e.v = DATA_VERSION;
    return e;
  }

  async function allEntries() {
    const list = await req(store('entries').getAll());
    const out = [];
    for (const e of list) {
      const was = e.v;
      const u = upgrade(e);
      if (was !== DATA_VERSION) await putEntry(u);
      out.push(u);
    }
    return out;
  }

  const putEntry = e => req(store('entries', 'readwrite').put(e));
  const deleteEntry = id => req(store('entries', 'readwrite').delete(id));
  const getPicture = id => req(store('pictures').get(id));
  const putPicture = p => req(store('pictures', 'readwrite').put(p));
  const deletePicture = id => req(store('pictures', 'readwrite').delete(id));

  async function getMeta(key, fallback) {
    const r = await req(store('meta').get(key));
    return r ? r.value : fallback;
  }
  const setMeta = (key, value) => req(store('meta', 'readwrite').put({ key, value }));

  // Ask the browser to treat our data as important, so it isn't cleared when space runs low
  // or (in Safari) after a week without a visit. Chrome decides silently; Firefox may ask the user.
  async function keepSafe() {
    try {
      if (!navigator.storage || !navigator.storage.persist) return false;
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    } catch { return false; }
  }

  async function isKeptSafe() {
    try { return !!(navigator.storage && navigator.storage.persisted && await navigator.storage.persisted()); }
    catch { return false; }
  }

  return { DATA_VERSION, open, keepSafe, isKeptSafe, allEntries, putEntry, deleteEntry, getPicture, putPicture, deletePicture, getMeta, setMeta };
})();
