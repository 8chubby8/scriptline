'use strict';

(async () => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const state = {
    entries: [], byId: new Map(), eraStyle: 'BCE',
    overlay: null,             // { mode: 'card' | 'form', id }
    draft: null, draftOrig: null, draftFiles: new Map(),
  };

  await SLStore.open();
  state.eraStyle = await SLStore.getMeta('eraStyle', 'BCE');

  let saveViewTimer = 0;
  const timeline = new SLTimeline($('#timeline'), {
    onOpen: id => openCard(id),
    onViewChange: view => {
      clearTimeout(saveViewTimer);
      saveViewTimer = setTimeout(() => {
        try { localStorage.setItem('scriptline.view', JSON.stringify(view)); } catch { /* not essential */ }
      }, 300);
    },
  });
  timeline.eraStyle = state.eraStyle;

  async function reload() {
    state.entries = await SLStore.allEntries();
    state.byId = new Map(state.entries.map(e => [e.id, e]));
    timeline.setEntries(state.entries);
    $('#empty').hidden = state.entries.length > 0;
    renderList();
  }

  const fmtRange = e => SLDates.formatRange(e.start, e.end, state.eraStyle);
  const fmtStamp = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  function safeUrl(u) {
    u = (u || '').trim();
    if (!u) return null;
    if (/^https?:\/\//i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return null;   // refuse javascript: and the like
    return 'https://' + u;
  }

  // ---------- pictures ----------

  const urlCache = new Map();
  async function pictureURL(id) {
    if (!id) return null;
    if (urlCache.has(id)) return urlCache.get(id);
    const p = await SLStore.getPicture(id);
    if (!p) return null;
    const url = URL.createObjectURL(p.blob);
    urlCache.set(id, url);
    return url;
  }

  // ---------- header ----------

  $('#btn-new').onclick = () => openForm(null);
  $('#btn-first').onclick = () => openForm(null);
  $('#btn-fit').onclick = () => timeline.fitAll();
  $('#btn-zoom-in').onclick = () => timeline.zoomBy(1.6);
  $('#btn-zoom-out').onclick = () => timeline.zoomBy(1 / 1.6);
  $('#btn-list').onclick = () => {
    const open = document.body.classList.toggle('list-open');
    $('#btn-list').setAttribute('aria-pressed', open);
    if (open) $('#list-search').focus();
  };

  $('#btn-samples').onclick = async () => {
    for (const e of SLSamples.build()) await SLStore.putEntry(e);
    await reload();
    timeline.fitAll();
  };

  // ---------- settings ----------

  const settings = $('#settings');
  $('#btn-settings').onclick = () => {
    settings.querySelector(`input[name=era][value="${state.eraStyle}"]`).checked = true;
    $('#sample-row').hidden = !state.entries.some(e => e.sample);
    settings.showModal();
  };
  settings.addEventListener('change', async ev => {
    if (ev.target.name !== 'era') return;
    state.eraStyle = ev.target.value;
    timeline.eraStyle = state.eraStyle;
    await SLStore.setMeta('eraStyle', state.eraStyle);
    timeline.invalidate();
    renderList();
  });
  $('#btn-remove-samples').onclick = async () => {
    const samples = state.entries.filter(e => e.sample);
    if (!confirm(`Remove all ${samples.length} sample entries? Your own entries are kept.`)) return;
    const gone = new Set(samples.map(e => e.id));
    for (const e of state.entries) {
      if (!gone.has(e.id) && gone.has(e.parentId)) { e.parentId = null; await SLStore.putEntry(e); }
    }
    for (const e of samples) await deleteEntryAndPictures(e);
    await reload();
    $('#sample-row').hidden = true;
  };

  // ---------- list view ----------

  $('#list-search').addEventListener('input', renderList);
  $('#list-track').addEventListener('change', renderList);
  $('#list-sort').addEventListener('change', renderList);

  function renderList() {
    const q = $('#list-search').value.trim().toLowerCase();
    const trackFilter = $('#list-track').value;
    const sort = $('#list-sort').value;
    let list = state.entries.filter(e =>
      (!trackFilter || e.track === trackFilter) &&
      (!q || (e.title + ' ' + e.summary).toLowerCase().includes(q)));
    if (sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'updated') list.sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
    else list.sort(SLModel.byStart);

    $('#list').innerHTML = list.length ? list.map(e => `
      <li><button data-id="${esc(e.id)}">
        <span class="dot" style="background:${esc(SLModel.colourOf(e, state.byId))}"></span>
        <span class="list-text">
          <span class="list-title">${esc(e.title)}</span>
          <span class="list-meta">${esc(fmtRange(e))} · ${SLModel.track(e.track).short} · Tier ${e.tier}</span>
        </span>
      </button></li>`).join('')
      : `<li class="muted list-none">${state.entries.length ? 'No entries match.' : 'No entries yet.'}</li>`;
  }

  $('#list').addEventListener('click', ev => {
    const b = ev.target.closest('button[data-id]');
    if (!b) return;
    timeline.focusOn(b.dataset.id);
    openCard(b.dataset.id);
  });

  // ---------- overlay: card and form ----------

  const overlay = $('#overlay');

  function showOverlay(html) {
    overlay.innerHTML = html;
    overlay.hidden = false;
    overlay.scrollTop = 0;
    document.body.classList.add('overlay-open');
  }

  function closeOverlay() {
    overlay.hidden = true;
    overlay.innerHTML = '';
    state.overlay = null;
    document.body.classList.remove('overlay-open');
  }

  async function openCard(id) {
    const e = state.byId.get(id);
    if (!e) return closeOverlay();
    state.overlay = { mode: 'card', id };
    const colour = SLModel.colourOf(e, state.byId);
    const parent = e.parentId && state.byId.get(e.parentId);
    const kids = SLModel.childrenOf(e.id, state.entries);
    const banner = await pictureURL(e.bannerId);
    const gallery = await Promise.all(e.gallery.map(async g => ({ ...g, url: await pictureURL(g.pictureId) })));
    const notes = [...e.notes].sort((a, b) => b.at.localeCompare(a.at));
    state.gallery = gallery;

    showOverlay(`
      <article class="card" style="--c:${esc(colour)}">
        <div class="card-bar">
          <button class="btn" data-act="close">← Back to timeline</button>
          <span class="spacer"></span>
          <button class="btn primary" data-act="edit">Edit</button>
        </div>
        <header class="banner ${banner ? 'has-img' : ''}" ${banner ? `style="background-image:url('${banner}')"` : ''}></header>
        <div class="card-body">
          <div class="card-head">
            <div class="meta"><span class="swatch"></span>${SLModel.track(e.track).name} · Tier ${e.tier}</div>
            <h2>${esc(e.title)}</h2>
            <p class="when">${esc(fmtRange(e))}</p>
            ${parent ? `<p class="rel">Part of <button class="link" data-open="${esc(parent.id)}">${esc(parent.title)}</button></p>` : ''}
          </div>

          <section>
            <h3>What happened</h3>
            ${e.summary ? `<p class="summary">${esc(e.summary)}</p>` : '<p class="muted">Nothing written yet.</p>'}
          </section>

          ${kids.length ? `
          <section>
            <h3>Within this</h3>
            <ul class="kids">${kids.map(k => `
              <li><button class="link" data-open="${esc(k.id)}">${esc(k.title)}</button>
                <span class="muted">${esc(fmtRange(k))}</span></li>`).join('')}
            </ul>
          </section>` : ''}

          <section>
            <div class="sec-head">
              <h3>Research notes</h3>
              <button class="btn small" data-act="add-note">+ Add note</button>
            </div>
            <div id="note-new" class="note-new" hidden>
              <textarea rows="4" placeholder="What have you found?"></textarea>
              <div class="row-end">
                <button class="btn" data-act="cancel-note">Cancel</button>
                <button class="btn primary" data-act="save-note">Save note</button>
              </div>
            </div>
            ${notes.length ? `<ol class="notes">${notes.map(n => `
              <li><time>${esc(fmtStamp(n.at))}</time><p>${esc(n.text)}</p></li>`).join('')}</ol>`
              : '<p class="muted">No notes yet.</p>'}
          </section>

          <section>
            <h3>Gallery</h3>
            ${gallery.length ? `<div class="gallery">${gallery.map((g, n) => `
              <figure>
                <button class="thumb" data-view="${n}">${g.url ? `<img src="${g.url}" alt="${esc(g.caption)}">` : ''}</button>
                ${g.caption || g.credit ? `<figcaption>${esc(g.caption)}${g.credit ? `<small>${esc(g.credit)}</small>` : ''}</figcaption>` : ''}
              </figure>`).join('')}</div>`
              : '<p class="muted">No pictures yet.</p>'}
          </section>

          <section>
            <h3>Sources</h3>
            ${e.sources.length ? `<ul class="sources">${e.sources.map(s => {
              const url = safeUrl(s.url);
              const text = esc(s.text || s.url);
              return `<li>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${text}</a>` : text}</li>`;
            }).join('')}</ul>` : '<p class="muted">No sources yet.</p>'}
          </section>
        </div>
      </article>`);
  }

  function showLightbox(n) {
    const g = state.gallery && state.gallery[n];
    if (!g || !g.url) return;
    const lb = $('#lightbox');
    lb.innerHTML = `<figure><img src="${g.url}" alt="${esc(g.caption)}">
      ${g.caption || g.credit ? `<figcaption>${esc(g.caption)}${g.credit ? `<small>${esc(g.credit)}</small>` : ''}</figcaption>` : ''}
      </figure><p class="muted small">Click anywhere to close</p>`;
    lb.hidden = false;
  }
  $('#lightbox').onclick = () => { $('#lightbox').hidden = true; };

  // ---------- the edit form ----------

  function openForm(id) {
    const orig = id ? state.byId.get(id) : null;
    state.draftOrig = orig;
    state.draft = orig ? structuredClone(orig) : SLModel.blankEntry();
    state.draftFiles = new Map();
    state.overlay = { mode: 'form', id };
    renderForm();
  }

  const MONTH_OPTIONS = sel => SLDates.MONTHS.map((m, n) =>
    `<option value="${n + 1}" ${sel === n + 1 ? 'selected' : ''}>${m}</option>`).join('');

  function dateFields(prefix, d, legend) {
    const era = e => SLDates.eraName(e, state.eraStyle);
    return `
      <div class="date-fields">
        <label class="f-year"><span>Year</span>
          <input name="${prefix}-year" type="number" min="1" step="1" inputmode="numeric" value="${esc(d.year)}" placeholder="e.g. 701"></label>
        <label><span>Era</span>
          <select name="${prefix}-era">
            <option value="BCE" ${d.era === 'BCE' ? 'selected' : ''}>${era('BCE')}</option>
            <option value="CE" ${d.era === 'CE' ? 'selected' : ''}>${era('CE')}</option>
          </select></label>
        <label><span>How precise</span>
          <select name="${prefix}-precision" data-rerender>
            <option value="year" ${d.precision === 'year' ? 'selected' : ''}>Year only</option>
            <option value="month" ${d.precision === 'month' ? 'selected' : ''}>Month and year</option>
            <option value="day" ${d.precision === 'day' ? 'selected' : ''}>Exact day</option>
          </select></label>
        ${d.precision !== 'year' ? `<label><span>Month</span><select name="${prefix}-month">${MONTH_OPTIONS(d.month || 1)}</select></label>` : ''}
        ${d.precision === 'day' ? `<label class="f-day"><span>Day</span><input name="${prefix}-day" type="number" min="1" max="31" value="${esc(d.day || 1)}"></label>` : ''}
        <label class="check"><input type="checkbox" name="${prefix}-approx" ${d.approx ? 'checked' : ''}> Approximate (c.)</label>
      </div>`;
  }

  function renderForm() {
    const d = state.draft, orig = state.draftOrig;
    const excluded = new Set(orig ? [orig.id, ...SLModel.descendantIds(orig.id, state.entries)] : []);
    const kids = orig ? state.entries.filter(e => e.parentId === orig.id) : [];
    const minChildTier = kids.length ? Math.min(...kids.map(k => k.tier)) : 5;

    // Only entries of a shallower tier can be a parent, so a child can never draw above its parent.
    const parents = state.entries
      .filter(e => !excluded.has(e.id) && e.tier < 4 && e.tier + 1 < minChildTier)
      .sort(SLModel.byStart);
    const parent = d.parentId && state.byId.get(d.parentId);
    const tiers = [1, 2, 3, 4].filter(t => t > (parent ? parent.tier : 0) && t < minChildTier);
    if (!tiers.includes(d.tier)) d.tier = tiers[0];
    if (parent) d.track = parent.track;

    const inherited = parent ? SLModel.colourOf(parent, state.byId) : null;
    const colour = inherited || d.colour || SLModel.track(d.track).colour;
    const byTrack = SLModel.TRACKS.map(t => {
      const list = parents.filter(p => p.track === t.id);
      return list.length ? `<optgroup label="${t.name}">${list.map(p =>
        `<option value="${esc(p.id)}" ${p.id === d.parentId ? 'selected' : ''}>${'— '.repeat(p.tier - 1)}${esc(p.title)} (Tier ${p.tier})</option>`).join('')}</optgroup>` : '';
    }).join('');

    const notes = [...d.notes].sort((a, b) => b.at.localeCompare(a.at));

    showOverlay(`
      <form class="card form" novalidate style="--c:${esc(colour)}">
        <div class="card-bar">
          <button type="button" class="btn" data-act="cancel-edit">Cancel</button>
          <span class="spacer"></span>
          ${orig ? '<button type="button" class="btn danger" data-act="delete">Delete entry</button>' : ''}
          <button type="submit" class="btn primary">Save</button>
        </div>
        <div class="card-body">
          <h2>${orig ? 'Edit entry' : 'New entry'}</h2>
          <p class="form-error" role="alert" hidden></p>

          <label class="field"><span>Title</span>
            <input name="title" value="${esc(d.title)}" placeholder="e.g. Hezekiah's reign" required></label>

          <div class="field-row">
            <label class="field"><span>Part of (parent)</span>
              <select name="parent" data-rerender>
                <option value="">— None: this starts its own family —</option>${byTrack}
              </select></label>
            <label class="field narrow"><span>Tier</span>
              <select name="tier" data-rerender>${tiers.map(t =>
                `<option value="${t}" ${t === d.tier ? 'selected' : ''}>${t}${t === 1 ? ' (broadest)' : t === 4 ? ' (most specific)' : ''}</option>`).join('')}
              </select></label>
          </div>

          <div class="field-row">
            <label class="field"><span>Track</span>
              <select name="track" data-rerender ${parent ? 'disabled' : ''}>${SLModel.TRACKS.map(t =>
                `<option value="${t.id}" ${t.id === d.track ? 'selected' : ''}>${t.name}</option>`).join('')}
              </select>
              ${parent ? '<small class="muted">Follows its parent.</small>' : ''}</label>
            <label class="field narrow"><span>Colour</span>
              <input name="colour" type="color" value="${esc(colour)}" ${parent ? 'disabled' : ''}>
              ${parent ? '<small class="muted">Shared with its family.</small>' : ''}</label>
          </div>

          <fieldset class="field"><legend>Start date</legend>${dateFields('start', d.start)}</fieldset>

          <fieldset class="field">
            <legend>End date</legend>
            <label class="check"><input type="checkbox" name="has-end" data-rerender ${d.end ? 'checked' : ''}> This has an end date</label>
            ${d.end ? dateFields('end', d.end) : '<p class="muted small">Leave unticked for a single event, or when the end is unknown.</p>'}
          </fieldset>

          <label class="field"><span>What happened</span>
            <textarea name="summary" rows="5">${esc(d.summary)}</textarea></label>

          <fieldset class="field">
            <legend>Banner picture</legend>
            ${d.bannerId ? `<div class="banner-edit"><img src="${urlCache.get(d.bannerId) || ''}" alt="" data-pic="${esc(d.bannerId)}">
              <button type="button" class="btn small" data-act="remove-banner">Remove</button></div>` : ''}
            <input type="file" accept="image/*" data-act-change="banner">
          </fieldset>

          <fieldset class="field">
            <legend>Research notes</legend>
            ${notes.length ? notes.map(n => `
              <div class="note-row" data-id="${esc(n.id)}">
                <time>${esc(fmtStamp(n.at))}</time>
                <textarea rows="3">${esc(n.text)}</textarea>
                <button type="button" class="btn small" data-act="remove-note" data-id="${esc(n.id)}">Delete</button>
              </div>`).join('') : '<p class="muted small">No notes yet. Add them from the entry card.</p>'}
          </fieldset>

          <fieldset class="field">
            <legend>Gallery</legend>
            ${d.gallery.map(g => `
              <div class="gallery-row" data-id="${esc(g.id)}">
                <img src="${urlCache.get(g.pictureId) || ''}" alt="" data-pic="${esc(g.pictureId)}">
                <div class="gallery-fields">
                  <input class="g-caption" value="${esc(g.caption)}" placeholder="Caption (optional)">
                  <input class="g-credit" value="${esc(g.credit)}" placeholder="Credit: who made it, where it's from (optional)">
                </div>
                <button type="button" class="btn small" data-act="remove-gallery" data-id="${esc(g.id)}">Remove</button>
              </div>`).join('')}
            <input type="file" accept="image/*" multiple data-act-change="gallery">
          </fieldset>

          <fieldset class="field">
            <legend>Sources</legend>
            ${d.sources.map(s => `
              <div class="source-row" data-id="${esc(s.id)}">
                <input class="s-text" value="${esc(s.text)}" placeholder="e.g. 2 Kings 18:13">
                <input class="s-url" value="${esc(s.url)}" placeholder="Web link (optional)">
                <button type="button" class="btn small" data-act="remove-source" data-id="${esc(s.id)}">Remove</button>
              </div>`).join('')}
            <button type="button" class="btn small" data-act="add-source">+ Add source</button>
          </fieldset>
        </div>
      </form>`);

    // Pictures already stored but not yet loaded into the cache.
    overlay.querySelectorAll('img[data-pic]').forEach(async img => {
      if (!img.getAttribute('src')) img.src = (await pictureURL(img.dataset.pic)) || '';
    });
  }

  function readDate(f, prefix) {
    const precision = f.elements[prefix + '-precision'].value;
    const d = {
      year: parseInt(f.elements[prefix + '-year'].value, 10) || '',
      era: f.elements[prefix + '-era'].value,
      precision,
      approx: f.elements[prefix + '-approx'].checked,
    };
    if (precision !== 'year') d.month = parseInt((f.elements[prefix + '-month'] || {}).value, 10) || 1;
    if (precision === 'day') d.day = parseInt((f.elements[prefix + '-day'] || {}).value, 10) || 1;
    return d;
  }

  // Copy everything typed in the form back into the draft, before re-drawing or saving.
  function syncDraft() {
    const f = overlay.querySelector('form');
    if (!f) return;
    const d = state.draft, el = f.elements;
    d.title = el.title.value.trim();
    d.parentId = el.parent.value || null;
    d.tier = parseInt(el.tier.value, 10) || 1;
    if (!el.track.disabled) d.track = el.track.value;
    if (!el.colour.disabled) d.colour = el.colour.value;
    d.start = readDate(f, 'start');
    if (el['has-end'].checked) d.end = el['end-year'] ? readDate(f, 'end') : { ...d.start, year: '', approx: false };
    else d.end = null;
    d.summary = el.summary.value.trim();
    f.querySelectorAll('.note-row').forEach(row => {
      const n = d.notes.find(x => x.id === row.dataset.id);
      if (n) n.text = row.querySelector('textarea').value;
    });
    f.querySelectorAll('.gallery-row').forEach(row => {
      const g = d.gallery.find(x => x.id === row.dataset.id);
      if (g) { g.caption = row.querySelector('.g-caption').value.trim(); g.credit = row.querySelector('.g-credit').value.trim(); }
    });
    f.querySelectorAll('.source-row').forEach(row => {
      const s = d.sources.find(x => x.id === row.dataset.id);
      if (s) { s.text = row.querySelector('.s-text').value.trim(); s.url = row.querySelector('.s-url').value.trim(); }
    });
  }

  function rerender() {
    syncDraft();
    const y = overlay.scrollTop;
    renderForm();
    overlay.scrollTop = y;
  }

  function addPicture(file) {
    const id = SLModel.newId();
    state.draftFiles.set(id, file);
    urlCache.set(id, URL.createObjectURL(file));
    return id;
  }

  overlay.addEventListener('change', ev => {
    const t = ev.target;
    if (t.dataset.actChange === 'banner' && t.files[0]) {
      syncDraft();
      state.draft.bannerId = addPicture(t.files[0]);
      rerender();
    } else if (t.dataset.actChange === 'gallery' && t.files.length) {
      syncDraft();
      for (const file of t.files) state.draft.gallery.push({ id: SLModel.newId(), pictureId: addPicture(file), caption: '', credit: '' });
      rerender();
    } else if (t.name === 'parent') {
      syncDraft();
      const p = state.byId.get(state.draft.parentId);
      if (p) { state.draft.tier = p.tier + 1; state.draft.track = p.track; }
      rerender();
    } else if (t.hasAttribute('data-rerender')) {
      rerender();
    }
  });

  overlay.addEventListener('submit', async ev => {
    ev.preventDefault();
    await saveForm();
  });

  function formError(msg) {
    const p = overlay.querySelector('.form-error');
    p.textContent = msg;
    p.hidden = false;
    overlay.scrollTop = 0;
  }

  async function saveForm() {
    syncDraft();
    const d = state.draft, orig = state.draftOrig;
    if (!d.title) return formError('Please give the entry a title.');
    if (!SLDates.isValid(d.start)) return formError('Please check the start date — the year must be a whole number of 1 or more.');
    if (d.end && !SLDates.isValid(d.end)) return formError('Please check the end date — the year must be a whole number of 1 or more.');
    if (d.end && SLDates.startValue(d.end) < SLDates.startValue(d.start)) return formError('The end date is before the start date.');

    const refs = new Set([d.bannerId, ...d.gallery.map(g => g.pictureId)].filter(Boolean));
    for (const [id, file] of state.draftFiles) {
      if (refs.has(id)) await SLStore.putPicture({ id, blob: file, name: file.name, type: file.type });
    }
    if (orig) {
      for (const id of [orig.bannerId, ...orig.gallery.map(g => g.pictureId)].filter(Boolean)) {
        if (!refs.has(id)) await SLStore.deletePicture(id);
      }
    }

    if (d.parentId) d.colour = null;
    d.notes = d.notes.filter(n => n.text.trim());
    d.sources = d.sources.filter(s => s.text || s.url);
    d.updated = new Date().toISOString();
    await SLStore.putEntry(d);

    // A family always shares one track.
    for (const id of SLModel.descendantIds(d.id, state.entries)) {
      const c = state.byId.get(id);
      if (c.track !== d.track) { c.track = d.track; await SLStore.putEntry(c); }
    }

    await reload();
    openCard(d.id);
  }

  async function deleteEntryAndPictures(e) {
    for (const id of [e.bannerId, ...e.gallery.map(g => g.pictureId)].filter(Boolean)) await SLStore.deletePicture(id);
    await SLStore.deleteEntry(e.id);
  }

  overlay.addEventListener('click', async ev => {
    const t = ev.target.closest('[data-act], [data-open], [data-view]');
    if (!t) return;
    if (t.dataset.open) return openCard(t.dataset.open);
    if (t.dataset.view) return showLightbox(+t.dataset.view);
    const d = state.draft;

    switch (t.dataset.act) {
      case 'close': return closeOverlay();
      case 'edit': return openForm(state.overlay.id);

      case 'add-note': {
        const box = $('#note-new');
        box.hidden = false;
        box.querySelector('textarea').focus();
        return;
      }
      case 'cancel-note': $('#note-new').hidden = true; return;
      case 'save-note': {
        const text = $('#note-new textarea').value.trim();
        if (!text) return;
        const e = state.byId.get(state.overlay.id);
        e.notes.push({ id: SLModel.newId(), at: new Date().toISOString(), text });
        e.updated = new Date().toISOString();
        await SLStore.putEntry(e);
        await reload();
        return openCard(e.id);
      }

      case 'cancel-edit':
        return state.draftOrig ? openCard(state.draftOrig.id) : closeOverlay();
      case 'delete': {
        const e = state.draftOrig;
        const kids = SLModel.childrenOf(e.id, state.entries);
        const msg = `Delete "${e.title}"? This can't be undone.` +
          (kids.length ? `\n\nIts ${kids.length} sub-${kids.length === 1 ? 'entry' : 'entries'} will be kept, but will no longer be part of it.` : '');
        if (!confirm(msg)) return;
        for (const k of kids) { k.parentId = null; await SLStore.putEntry(k); }
        await deleteEntryAndPictures(e);
        await reload();
        return closeOverlay();
      }
      case 'remove-banner': syncDraft(); d.bannerId = null; return rerender();
      case 'remove-note':
        if (!confirm('Delete this note?')) return;
        syncDraft(); d.notes = d.notes.filter(n => n.id !== t.dataset.id); return rerender();
      case 'remove-gallery': syncDraft(); d.gallery = d.gallery.filter(g => g.id !== t.dataset.id); return rerender();
      case 'remove-source': syncDraft(); d.sources = d.sources.filter(s => s.id !== t.dataset.id); return rerender();
      case 'add-source': {
        syncDraft();
        d.sources.push({ id: SLModel.newId(), text: '', url: '' });
        rerender();
        const rows = overlay.querySelectorAll('.s-text');
        rows[rows.length - 1].focus();
        return;
      }
    }
  });

  // ---------- keyboard ----------

  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') {
      if (!$('#lightbox').hidden) { $('#lightbox').hidden = true; return; }
      if (state.overlay && state.overlay.mode === 'card') { closeOverlay(); return; }
    }
    if (state.overlay || settings.open || ev.target.closest('input, textarea, select')) return;
    if (ev.key === '+' || ev.key === '=') timeline.zoomBy(1.6);
    else if (ev.key === '-') timeline.zoomBy(1 / 1.6);
    else if (ev.key === 'ArrowLeft') timeline.pan(120, 0);
    else if (ev.key === 'ArrowRight') timeline.pan(-120, 0);
    else if (ev.key === 'ArrowUp') timeline.pan(0, 60);
    else if (ev.key === 'ArrowDown') timeline.pan(0, -60);
    else if (ev.key === 'f') timeline.fitAll();
  });

  // ---------- start ----------

  await reload();
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('scriptline.view')); } catch { /* not essential */ }
  if (saved && Number.isFinite(saved.center) && saved.ppy > 0) timeline.setView(saved);
  else timeline.fitAll(false);
})();
