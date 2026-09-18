'use strict';

// Backups: one zip file laid out like the planned sync folder —
//   backup.json              what this is, when it was made, which data version
//   entries/<title>--<id>.json   one file per entry
//   pictures/<id>.<ext>      pictures, referred to from entries by id
const SLBackup = (() => {
  const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/avif': 'avif' };
  const TYPE = Object.fromEntries(Object.entries(EXT).map(([t, e]) => [e, t]));
  TYPE.jpeg = 'image/jpeg';

  const slug = s => (s || 'untitled').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'untitled';
  const pictureIds = e => [e.bannerId, ...(e.gallery || []).map(g => g.pictureId)].filter(Boolean);

  async function make(entries, settings) {
    const enc = new TextEncoder();
    const json = obj => enc.encode(JSON.stringify(obj, null, 2) + '\n');
    const files = [{
      path: 'backup.json',
      data: json({ app: 'Scriptline', dataVersion: SLStore.DATA_VERSION, created: new Date().toISOString(), entryCount: entries.length, settings }),
    }];
    for (const e of entries) {
      files.push({ path: `entries/${slug(e.title)}--${e.id}.json`, data: json(e) });
    }
    const seen = new Set();
    for (const id of entries.flatMap(pictureIds)) {
      if (seen.has(id)) continue;
      seen.add(id);
      const p = await SLStore.getPicture(id);
      if (!p) continue;
      const ext = EXT[p.type || p.blob.type] || (p.name && p.name.split('.').pop().toLowerCase()) || 'bin';
      files.push({ path: `pictures/${id}.${ext}`, data: new Uint8Array(await p.blob.arrayBuffer()) });
    }
    return SLZip.write(files);
  }

  // Returns { info, entries, pictures: Map(id → { blob, name, type }) }, or throws with a readable message.
  async function read(file) {
    let files;
    try { files = await SLZip.read(file); } catch { throw new Error("This file isn't a Scriptline backup (it isn't a zip file)."); }

    // Accept backups that were unzipped and re-zipped inside an extra folder.
    const find = name => files.find(f => f.path === name || f.path.endsWith('/' + name));
    const infoFile = find('backup.json');
    if (!infoFile) throw new Error("This file isn't a Scriptline backup.");
    const root = infoFile.path.slice(0, -'backup.json'.length);
    const dec = new TextDecoder();
    const info = JSON.parse(dec.decode(infoFile.data));
    if (info.app !== 'Scriptline') throw new Error("This file isn't a Scriptline backup.");
    if (info.dataVersion > SLStore.DATA_VERSION) {
      throw new Error('This backup was made by a newer version of Scriptline. Reload the page to get the latest version, then try again.');
    }

    const entries = [];
    const pictures = new Map();
    for (const f of files) {
      if (!f.path.startsWith(root)) continue;
      const rel = f.path.slice(root.length);
      if (/^entries\/[^/]+\.json$/.test(rel)) {
        try { entries.push(SLStore.upgrade(JSON.parse(dec.decode(f.data)))); } catch { /* skip a damaged entry, keep the rest */ }
      } else if (/^pictures\/[^/]+$/.test(rel)) {
        const name = rel.slice('pictures/'.length);
        const dot = name.lastIndexOf('.');
        const id = dot > 0 ? name.slice(0, dot) : name;
        const type = TYPE[name.slice(dot + 1).toLowerCase()] || '';
        pictures.set(id, { blob: new Blob([f.data], { type }), name, type });
      }
    }
    return { info, entries: entries.filter(e => e && e.id && e.start), pictures };
  }

  // mode: 'merge' keeps current entries (backup wins where both have the same entry);
  //       'replace' wipes everything first.
  async function restore({ entries, pictures }, mode, current) {
    if (mode === 'replace') {
      await SLStore.clearAll();
    } else {
      // Pictures belonging to entries about to be overwritten, no longer used by the backup's version.
      const incoming = new Set(entries.map(e => e.id));
      const keep = new Set(entries.flatMap(pictureIds));
      for (const e of current) {
        if (!incoming.has(e.id)) continue;
        for (const id of pictureIds(e)) if (!keep.has(id)) await SLStore.deletePicture(id);
      }
    }
    for (const [id, p] of pictures) await SLStore.putPicture({ id, ...p });
    for (const e of entries) await SLStore.putEntry(e);
  }

  return { make, read, restore };
})();
