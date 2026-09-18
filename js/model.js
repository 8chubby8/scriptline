'use strict';

// Helpers for entries and the families they form.
const SLModel = (() => {
  // Tracks are a list so a third one could be added later. `dir` is which way the track stacks
  // away from the central date ruler: -1 upward, 1 downward.
  const TRACKS = [
    { id: 'bible', name: 'Biblical history', short: 'Biblical', colour: '#b7791f', dir: -1 },
    { id: 'world', name: 'World history', short: 'World', colour: '#2b6cb0', dir: 1 },
  ];
  const track = id => TRACKS.find(t => t.id === id) || TRACKS[0];

  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  function rootOf(e, byId) {
    const seen = new Set();
    let cur = e;
    while (cur.parentId && byId.has(cur.parentId) && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = byId.get(cur.parentId);
    }
    return cur;
  }

  function colourOf(e, byId) {
    const r = rootOf(e, byId);
    return r.colour || track(r.track).colour;
  }

  const byStart = (a, b) =>
    SLDates.startValue(a.start) - SLDates.startValue(b.start) || a.tier - b.tier;

  const childrenOf = (id, entries) => entries.filter(e => e.parentId === id).sort(byStart);

  function descendantIds(id, entries) {
    const out = [];
    const queue = [id];
    while (queue.length) {
      const cur = queue.shift();
      for (const e of entries) {
        if (e.parentId === cur && !out.includes(e.id) && e.id !== id) {
          out.push(e.id);
          queue.push(e.id);
        }
      }
    }
    return out;
  }

  function blankEntry() {
    const now = new Date().toISOString();
    return {
      v: SLStore.DATA_VERSION, id: newId(), title: '', track: 'bible', tier: 1, parentId: null,
      start: { year: '', era: 'BCE', precision: 'year', approx: false }, end: null,
      summary: '', colour: null, bannerId: null, notes: [], gallery: [], sources: [],
      created: now, updated: now,
    };
  }

  return { TRACKS, track, newId, rootOf, colourOf, byStart, childrenOf, descendantIds, blankEntry };
})();
