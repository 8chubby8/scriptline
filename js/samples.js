'use strict';

// Optional sample entries, offered only on an empty timeline so a new user can see how things look.
// Every one is marked `sample: true` so they can all be removed again from Settings.
// Dates are one common chronology, included for illustration — not a recommendation.
const SLSamples = (() => {
  const yr = (year, approx = false) => ({ year, era: 'BCE', precision: 'year', approx });
  const c = year => yr(year, true);

  function build() {
    const now = new Date().toISOString();
    const id = s => 'sample-' + s;
    const E = (key, title, track, tier, parent, start, end, extra = {}) => ({
      v: SLStore.DATA_VERSION, id: id(key), sample: true, title, track, tier,
      parentId: parent ? id(parent) : null, start, end,
      summary: '', colour: null, bannerId: null, gallery: [],
      created: now, updated: now, ...extra,
      notes: (extra.notes || []).map(text => ({ id: SLModel.newId(), at: now, text })),
      sources: (extra.sources || []).map(([text, url]) => ({ id: SLModel.newId(), text, url: url || '' })),
    });

    return [
      E('judah', 'Kingdom of Judah', 'bible', 1, null, c(931), yr(586), {
        colour: '#b7791f',
        summary: 'The southern kingdom, ruled from Jerusalem by the line of David, from the division of the kingdom after Solomon until its fall to Babylon.',
        sources: [['1 Kings 12'], ['2 Kings 25']],
      }),
      E('hezekiah', "Hezekiah's reign", 'bible', 2, 'judah', c(715), c(686), {
        summary: 'King of Judah remembered for religious reform, the water tunnel under Jerusalem, and resisting Assyria.',
        notes: ['Some chronologies begin his reign in 729 BCE, as a co-regency with Ahaz. Worth comparing with the Assyrian records.'],
        sources: [['2 Kings 18–20'], ['2 Chronicles 29–32'], ['Isaiah 36–39']],
      }),
      E('siege', "Sennacherib's siege of Jerusalem", 'bible', 3, 'hezekiah', yr(701), null, {
        summary: 'The Assyrian army surrounds Jerusalem, but the city is not taken.',
        sources: [['2 Kings 18:13 – 19:37'], ["Sennacherib's Annals", 'https://en.wikipedia.org/wiki/Sennacherib%27s_Annals']],
      }),
      E('rabshakeh', 'The Rabshakeh speaks at the wall', 'bible', 4, 'siege', yr(701), null, {
        summary: 'The Assyrian field commander calls on Jerusalem to surrender.',
        sources: [['2 Kings 18:17–37']],
      }),
      E('josiah', "Josiah's reign", 'bible', 2, 'judah', c(640), yr(609)),
      E('lawbook', 'Book of the Law found in the Temple', 'bible', 3, 'josiah', c(622), null, {
        sources: [['2 Kings 22']],
      }),
      E('jerusalem', 'Fall of Jerusalem', 'bible', 2, 'judah', yr(586), null, {
        notes: ['Some scholars date this to 587 BCE instead.'],
        sources: [['2 Kings 25'], ['Jeremiah 52']],
      }),
      E('israel', 'Kingdom of Israel', 'bible', 1, null, c(931), yr(722), {
        colour: '#c05621',
        summary: 'The northern kingdom, ruled from Samaria for most of its history, until its conquest by Assyria.',
      }),
      E('samaria', 'Fall of Samaria', 'bible', 2, 'israel', yr(722), null, { sources: [['2 Kings 17']] }),
      E('exile', 'Babylonian exile', 'bible', 1, null, yr(586), yr(539), { colour: '#6b8e23' }),

      E('assyria', 'Neo-Assyrian Empire', 'world', 1, null, yr(911), yr(609), { colour: '#2b6cb0' }),
      E('sennacherib', "Sennacherib's reign", 'world', 2, 'assyria', yr(705), yr(681)),
      E('lachish', 'Siege of Lachish', 'world', 3, 'sennacherib', yr(701), null, {
        summary: "Captured by Sennacherib, and carved in stone on the walls of his palace at Nineveh.",
        sources: [['Lachish reliefs', 'https://en.wikipedia.org/wiki/Lachish_reliefs']],
      }),
      E('ashurbanipal', "Ashurbanipal's reign", 'world', 2, 'assyria', yr(668), c(631)),
      E('nineveh', 'Fall of Nineveh', 'world', 2, 'assyria', yr(612), null),
      E('babylon', 'Neo-Babylonian Empire', 'world', 1, null, yr(626), yr(539), { colour: '#6b46c1' }),
      E('nebuchadnezzar', "Nebuchadnezzar II's reign", 'world', 2, 'babylon', yr(605), yr(562)),
      E('cyrus', 'Babylon falls to Cyrus', 'world', 2, 'babylon', yr(539), null),
      E('persia', 'Achaemenid Persian Empire', 'world', 1, null, yr(550), yr(330), { colour: '#2c7a7b' }),
    ];
  }

  return { build };
})();
