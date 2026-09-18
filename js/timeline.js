'use strict';

// The painted timeline. Two tracks mirrored around a central date ruler: tier 1 sits furthest out
// and deeper tiers appear between it and the ruler as you zoom in, pushing it outward. Whichever
// tier is currently the most detailed on screen is drawn larger, so it stands out.
class SLTimeline {
  static LANE_H = 30;          // height of one lane (row) of entries
  static BAR_H = 24;           // height of an entry's bar within its lane
  static TIER_GAP = 12;        // space between tiers
  static RULER_H = 40;
  // A tier fades in as the visible span shrinks from 1.6× to 1× this many years.
  static TIER_SPAN = { 1: Infinity, 2: 2500, 3: 500, 4: 100 };
  static PROMINENT = 1.6;      // size of the most detailed tier on screen, relative to the others
  static MIN_SPAN = 0.05;      // most zoomed in: about 18 days across the screen
  static MAX_SPAN = 12000;     // most zoomed out: 12,000 years across the screen
  static MIN_V = -10000;
  static MAX_V = 3000;

  constructor(canvas, { onOpen, onViewChange } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onOpen = onOpen || (() => {});
    this.onViewChange = onViewChange || (() => {});
    this.items = [];
    this.eraStyle = 'BCE';
    this.center = -1000;
    this.ppy = 0.2;            // pixels per year
    this.panY = 0;
    this.cssW = 1;
    this.cssH = 1;
    this.hits = [];
    this.hoverId = null;
    this.pointers = new Map();
    this.trackHeight = {};
    this.bindInput();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  // ---------- data & layout ----------

  setEntries(entries) {
    const byId = new Map(entries.map(e => [e.id, e]));
    const items = entries.map(e => ({
      id: e.id, e, tier: e.tier, track: e.track,
      s: SLDates.startValue(e.start),
      end: SLDates.endValue(e.end || e.start),
      openFade: false,
      colour: SLModel.colourOf(e, byId),
    }));
    const itemById = new Map(items.map(i => [i.id, i]));

    // A parent with no end date stretches over its children and fades out at its right-hand edge.
    for (const i of [...items].sort((a, b) => b.tier - a.tier)) {
      const p = i.e.parentId && itemById.get(i.e.parentId);
      if (p && !p.e.end) {
        p.openFade = true;
        p.end = Math.max(p.end, i.end);
      }
    }

    // Lanes: within a tier, entries overlapping in time are nudged into extra lanes.
    // Lane counts come from the whole dataset, so rows never reshuffle while panning.
    this.laneCount = {};
    for (const t of SLModel.TRACKS) {
      this.laneCount[t.id] = {};
      for (let tier = 1; tier <= 4; tier++) {
        const list = items.filter(i => i.track === t.id && i.tier === tier).sort((a, b) => a.s - b.s);
        const laneEnds = [];
        for (const i of list) {
          let lane = laneEnds.findIndex(end => end <= i.s);
          if (lane < 0) { lane = laneEnds.length; laneEnds.push(i.end); } else laneEnds[lane] = i.end;
          i.lane = lane;
        }
        // Where the next entry in the same lane begins — a label may run on until there.
        const lanes = Math.max(1, laneEnds.length);
        for (let l = 0; l < lanes; l++) {
          const inLane = list.filter(i => i.lane === l);
          inLane.forEach((i, n) => { i.nextS = n + 1 < inLane.length ? inLane[n + 1].s : Infinity; });
        }
        this.laneCount[t.id][tier] = laneEnds.length;
      }
    }

    this.items = items;
    this.itemById = itemById;
    this.layoutSpan = null;
    this.invalidate();
  }

  // Row positions for a given zoom. Stacking outward from the ruler: tier 4, 3, 2, then 1.
  // A tier fading in grows out of the ruler side and pushes the broader tiers outward.
  // The most detailed tier showing is drawn at PROMINENT size, shrinking as the next one arrives.
  layout(span = this.cssW / this.ppy) {
    if (this.layoutSpan === span) return;
    this.layoutSpan = span;
    const T = SLTimeline;
    this.tierPos = {};
    for (const t of SLModel.TRACKS) {
      this.tierPos[t.id] = {};
      const lanes = (this.laneCount && this.laneCount[t.id]) || {};
      let offset = 0;
      let deeper = 0;   // how far a more detailed tier (with entries) has faded in
      for (let tier = 4; tier >= 1; tier--) {
        const a = this.tierAlpha(tier, span);
        const k = (T.PROMINENT + (1 - T.PROMINENT) * deeper) * a;
        this.tierPos[t.id][tier] = { offset, k };
        if (lanes[tier]) {
          offset += lanes[tier] * T.LANE_H * k + T.TIER_GAP * a;
          deeper = Math.max(deeper, a);
        }
      }
      this.trackHeight[t.id] = offset;
    }
  }

  // Signed distance of an item's bar top from the ruler's centre line, and its bar height.
  place(i, span) {
    this.layout(span);
    const T = SLTimeline;
    const p = this.tierPos[i.track][i.tier];
    const barH = T.BAR_H * p.k;
    const dist = T.RULER_H / 2 + 8 + p.offset + i.lane * T.LANE_H * p.k;
    return { rel: SLModel.track(i.track).dir < 0 ? -(dist + barH) : dist, barH, k: p.k };
  }

  tierAlpha(tier, span = this.cssW / this.ppy) {
    const T = SLTimeline.TIER_SPAN[tier];
    if (T === Infinity) return 1;
    return Math.min(1, Math.max(0, (T * 1.6 - span) / (T * 0.6)));
  }

  // ---------- view ----------

  toX(v) { return (v - this.center) * this.ppy + this.cssW / 2; }
  fromX(x) { return (x - this.cssW / 2) / this.ppy + this.center; }

  getView() { return { center: this.center, ppy: this.ppy, panY: this.panY }; }

  setView(v) {
    this.center = v.center;
    this.ppy = v.ppy;
    this.panY = v.panY || 0;
    this.changed();
  }

  clampView() {
    const T = SLTimeline;
    this.ppy = Math.min(this.cssW / T.MIN_SPAN, Math.max(this.cssW / T.MAX_SPAN, this.ppy));
    this.center = Math.min(T.MAX_V, Math.max(T.MIN_V, this.center));
    this.layout();
    const room = this.cssH / 2 - T.RULER_H / 2 - 30;
    const up = Math.max(0, (this.trackHeight.bible || 0) - room);
    const down = Math.max(0, (this.trackHeight.world || 0) - room);
    this.panY = Math.min(up, Math.max(-down, this.panY));
  }

  changed() {
    this.clampView();
    this.invalidate();
    this.onViewChange(this.getView());
  }

  pan(dx, dy) {
    this.center -= dx / this.ppy;
    this.panY += dy;
    this.changed();
  }

  zoomAt(x, factor) {
    const v = this.fromX(x);
    this.ppy *= factor;
    this.clampView();
    this.center = v - (x - this.cssW / 2) / this.ppy;
    this.changed();
  }

  zoomBy(factor) {
    this.animateTo(this.center, this.ppy * factor);
  }

  cancelAnim() {
    if (this.anim) cancelAnimationFrame(this.anim);
    this.anim = 0;
  }

  animateTo(center, ppy, panY = this.panY) {
    this.cancelAnim();
    const from = { c: this.center, l: Math.log(this.ppy), p: this.panY };
    const T = SLTimeline;
    ppy = Math.min(this.cssW / T.MIN_SPAN, Math.max(this.cssW / T.MAX_SPAN, ppy));
    const to = { c: center, l: Math.log(ppy), p: panY };
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / 450);
      const e = 1 - Math.pow(1 - k, 3);
      this.center = from.c + (to.c - from.c) * e;
      this.ppy = Math.exp(from.l + (to.l - from.l) * e);
      this.panY = from.p + (to.p - from.p) * e;
      this.changed();
      this.anim = k < 1 ? requestAnimationFrame(step) : 0;
    };
    this.anim = requestAnimationFrame(step);
  }

  fitAll(animate = true) {
    let lo = Infinity, hi = -Infinity;
    for (const i of this.items) { lo = Math.min(lo, i.s); hi = Math.max(hi, i.end); }
    if (!this.items.length) { lo = -4000; hi = 2000; }
    const span = Math.max(hi - lo, 1) * 1.15;
    const center = (lo + hi) / 2;
    if (animate) this.animateTo(center, this.cssW / span, 0);
    else this.setView({ center, ppy: this.cssW / span, panY: 0 });
  }

  // Bring an entry into view, zoomed in far enough that its tier is showing.
  focusOn(id) {
    const i = this.itemById && this.itemById.get(id);
    if (!i) return;
    const T = SLTimeline;
    const span = Math.min(Math.max((i.end - i.s) * 1.8, T.MIN_SPAN * 2, 20), T.TIER_SPAN[i.tier] * 0.9);
    const y = this.cssH / 2 + this.panY + this.place(i, span).rel;
    let panY = this.panY;
    if (y < 50) panY += 70 - y;
    if (y > this.cssH - 70) panY -= y - (this.cssH - 90);
    this.animateTo((i.s + i.end) / 2, this.cssW / span, panY);
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.dpr = window.devicePixelRatio || 1;
    this.cssW = r.width;
    this.cssH = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.clampView();
    this.invalidate();
  }

  invalidate() {
    if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.draw(); });
  }

  // ---------- input ----------
  // Hand-written for now: drag to pan, wheel / trackpad / pinch to zoom.

  bindInput() {
    const c = this.canvas;

    c.addEventListener('wheel', ev => {
      ev.preventDefault();
      this.cancelAnim();
      let dx = ev.deltaX, dy = ev.deltaY;
      if (ev.deltaMode === 1) { dx *= 33; dy *= 33; }
      if (ev.deltaMode === 2) { dx *= this.cssW; dy *= this.cssH; }
      if (ev.ctrlKey) this.zoomAt(ev.offsetX, Math.exp(-dy * 0.01));        // trackpad pinch
      else if (ev.shiftKey) this.pan(-(dy || dx), 0);
      else if (Math.abs(dx) > Math.abs(dy)) this.pan(-dx, 0);                // sideways swipe
      else this.zoomAt(ev.offsetX, Math.exp(-dy * 0.002));                   // mouse wheel
    }, { passive: false });

    c.addEventListener('pointerdown', ev => {
      this.cancelAnim();
      c.setPointerCapture(ev.pointerId);
      this.pointers.set(ev.pointerId, { x: ev.offsetX, y: ev.offsetY });
      if (this.pointers.size === 1) {
        this.downAt = { x: ev.offsetX, y: ev.offsetY };
        this.dragged = false;
      } else {
        this.dragged = true;
        this.pinch = this.pinchState();
      }
      c.classList.add('dragging');
    });

    c.addEventListener('pointermove', ev => {
      const p = this.pointers.get(ev.pointerId);
      if (!p) { this.hover(ev.offsetX, ev.offsetY); return; }
      const nx = ev.offsetX, ny = ev.offsetY;
      if (this.pointers.size === 1) {
        if (!this.dragged && Math.hypot(nx - this.downAt.x, ny - this.downAt.y) > 4) this.dragged = true;
        if (this.dragged) this.pan(nx - p.x, ny - p.y);
        p.x = nx; p.y = ny;
      } else {
        p.x = nx; p.y = ny;
        const s = this.pinchState();
        if (this.pinch && this.pinch.d > 0) {
          this.zoomAt(s.x, s.d / this.pinch.d);
          this.pan(s.x - this.pinch.x, s.y - this.pinch.y);
        }
        this.pinch = s;
      }
    });

    const end = ev => {
      if (!this.pointers.has(ev.pointerId)) return;
      const single = this.pointers.size === 1;
      this.pointers.delete(ev.pointerId);
      if (ev.type === 'pointerup' && single && !this.dragged) {
        const h = this.hitAt(ev.offsetX, ev.offsetY);
        if (h) this.onOpen(h.id);
      }
      if (this.pointers.size < 2) this.pinch = null;
      if (!this.pointers.size) c.classList.remove('dragging');
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('pointerleave', () => { if (!this.pointers.size) this.hover(-1, -1); });
  }

  pinchState() {
    const [a, b] = [...this.pointers.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) };
  }

  hitAt(x, y) {
    for (let n = this.hits.length - 1; n >= 0; n--) {
      const h = this.hits[n];
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h;
    }
    return null;
  }

  hover(x, y) {
    const h = this.hitAt(x, y);
    const id = h ? h.id : null;
    if (id !== this.hoverId) {
      this.hoverId = id;
      this.canvas.style.cursor = id ? 'pointer' : '';
      this.invalidate();
    }
  }

  // ---------- painting ----------

  draw() {
    const ctx = this.ctx, W = this.cssW, H = this.cssH, T = SLTimeline;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const rulerY = Math.round(H / 2 + this.panY);

    ctx.fillStyle = '#fbf7ee';
    ctx.fillRect(0, 0, W, rulerY);
    ctx.fillStyle = '#f2f5f9';
    ctx.fillRect(0, rulerY, W, H - rulerY);

    const v0 = this.fromX(0), v1 = this.fromX(W);
    const ticks = this.ticks(v0, v1);

    ctx.strokeStyle = 'rgba(70, 60, 40, 0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const t of ticks) {
      const x = Math.round(this.toX(t.v)) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    ctx.stroke();

    // The BCE / CE boundary.
    if (v0 < 0 && v1 > 0) {
      const x = Math.round(this.toX(0)) + 0.5;
      ctx.save();
      ctx.strokeStyle = 'rgba(70, 60, 40, 0.3)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
      ctx.restore();
    }

    this.hits = [];
    for (let tier = 1; tier <= 4; tier++) {
      const a = this.tierAlpha(tier);
      if (a <= 0.01) continue;
      for (const i of this.items) if (i.tier === tier) this.drawItem(i, a, rulerY, v0, v1);
    }

    this.drawRuler(rulerY, ticks);
  }

  drawItem(i, alpha, rulerY, v0, v1) {
    if (i.end < v0 && i.nextS < v0) return;
    if (i.s > v1) return;
    const ctx = this.ctx, T = SLTimeline, W = this.cssW;
    const x0 = this.toX(i.s), x1 = this.toX(i.end);
    const narrow = x1 - x0 < 6;
    const bx = narrow ? (x0 + x1) / 2 - 3 : x0;
    const bw = narrow ? 6 : x1 - x0;
    const { rel, barH, k } = this.place(i);
    const y = rulerY + rel;
    if (y + barH < 0 || y > this.cssH || barH < 1) return;

    const rgb = hexToRgb(i.colour);
    const strong = i.tier === 1 ? 0.5 : 0.3;
    const softL = i.e.start.approx;
    const softR = i.e.end ? i.e.end.approx : false;

    // Approximate dates get a soft, fading edge; an open-ended parent fades out further.
    const fade = Math.min(40, bw * 0.3) / bw;
    const longFade = Math.min(0.45, Math.max(fade, 120 / bw));
    const stops = (a) => {
      const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, rgba(rgb, softL ? 0 : a));
      if (softL) g.addColorStop(fade, rgba(rgb, a));
      if (i.openFade) g.addColorStop(1 - longFade, rgba(rgb, a));
      else if (softR) g.addColorStop(1 - fade, rgba(rgb, a));
      g.addColorStop(1, rgba(rgb, i.openFade || softR ? 0 : a));
      return g;
    };

    ctx.globalAlpha = alpha;
    ctx.fillStyle = stops(strong);
    roundRect(ctx, bx, y, bw, barH, 4);
    ctx.fill();
    // A firm stripe of family colour along the edge nearest the ruler.
    ctx.fillStyle = stops(0.95);
    const dir = SLModel.track(i.track).dir;
    ctx.fillRect(bx, dir < 0 ? y + barH - 3 : y, bw, 3);

    // Label: sticks to the left edge of the screen while its bar is partly off-screen,
    // and may run past a short bar up to where the next entry in the lane begins.
    const fontPx = (i.tier === 1 ? 13 : 12.5) * k;
    ctx.font = (i.tier === 1 ? '600 ' : '') + fontPx.toFixed(1) + 'px system-ui, sans-serif';
    const text = i.e.title || '(untitled)';
    const tw = ctx.measureText(text).width;
    const lx = Math.max(bx + 6, Math.min(6, bx + bw - tw - 6));
    const clipR = Math.min(Number.isFinite(i.nextS) ? this.toX(i.nextS) - 6 : W, W);
    if (clipR - lx > 14 && fontPx >= 8) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(lx - 2, y, clipR - lx + 2, barH);
      ctx.clip();
      ctx.fillStyle = '#1f2328';
      ctx.fillText(text, lx, y + barH / 2 + fontPx * 0.35);
      ctx.restore();
    }

    const hitR = Math.max(bx + bw, Math.min(lx + tw, clipR));
    if (this.hoverId === i.id) {
      ctx.strokeStyle = 'rgba(31, 35, 40, 0.55)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, bx - 1, y - 1, hitR - bx + 2, barH + 2, 5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (alpha > 0.3) this.hits.push({ id: i.id, x: bx, y, w: hitR - bx, h: barH });
  }

  drawRuler(rulerY, ticks) {
    const ctx = this.ctx, W = this.cssW, T = SLTimeline;
    const top = rulerY - T.RULER_H / 2;
    ctx.fillStyle = '#fffdf8';
    ctx.fillRect(0, top, W, T.RULER_H);
    ctx.fillStyle = '#d9d1bf';
    ctx.fillRect(0, top, W, 1);
    ctx.fillRect(0, top + T.RULER_H - 1, W, 1);

    ctx.textAlign = 'center';
    for (const t of ticks) {
      const x = Math.round(this.toX(t.v)) + 0.5;
      ctx.fillStyle = '#b9ae96';
      ctx.fillRect(x - 0.5, top, 1, 6);
      ctx.fillRect(x - 0.5, top + T.RULER_H - 6, 1, 6);
      ctx.fillStyle = t.major ? '#3d382c' : '#6b6353';
      ctx.font = (t.major ? '600 ' : '') + '11.5px system-ui, sans-serif';
      ctx.fillText(t.label, x, rulerY + 4);
    }
    ctx.textAlign = 'left';

    // Which track is which, pinned to the left of the ruler.
    ctx.fillStyle = '#fffdf8';
    ctx.fillRect(0, top + 1, 96, T.RULER_H - 2);
    ctx.fillStyle = '#e5dece';
    ctx.fillRect(96, top + 1, 1, T.RULER_H - 2);
    ctx.font = '600 10.5px system-ui, sans-serif';
    ctx.fillStyle = SLModel.track('bible').colour;
    ctx.fillText('▲ Biblical', 10, top + 16);
    ctx.fillStyle = SLModel.track('world').colour;
    ctx.fillText('▼ World', 10, top + 31);
  }

  yearLabel(v) {
    const y = SLDates.yearAt(v);
    return y.year + ' ' + SLDates.eraName(y.era, this.eraStyle);
  }

  ticks(v0, v1) {
    const out = [];
    const minYears = 90 / this.ppy;   // aim for a label every 90px or so
    const MS = SLDates.MONTHS_SHORT, DIM = SLDates.DIM;

    if (minYears >= 1) {
      const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000].find(s => s >= minYears) || 5000;
      const era = e => SLDates.eraName(e, this.eraStyle);
      // BCE year N starts at axis value -N; CE year N starts at N - 1.
      for (let N = Math.max(step, Math.ceil(-v1 / step) * step); N <= -v0; N += step) out.push({ v: -N, label: N + ' ' + era('BCE') });
      for (let N = Math.max(step, Math.ceil((v0 + 1) / step) * step); N - 1 <= v1; N += step) out.push({ v: N - 1, label: N + ' ' + era('CE') });
    } else if (minYears >= 1 / 12) {
      const mStep = [1, 2, 3, 6].find(s => s / 12 >= minYears) || 6;
      for (let y = Math.floor(v0); y <= v1; y++) {
        for (let m = 0; m < 12; m += mStep) {
          const v = y + m / 12;
          if (v < v0 || v > v1) continue;
          out.push({ v, label: m === 0 ? this.yearLabel(y) : MS[m], major: m === 0 });
        }
      }
    } else {
      const dStep = [1, 2, 5, 10].find(s => s / 365 >= minYears) || 10;
      for (let y = Math.floor(v0); y <= v1; y++) {
        for (let m = 0; m < 12; m++) {
          const mv = y + m / 12;
          if (mv > v1 || mv + 1 / 12 < v0) continue;
          for (let d = 1; d <= DIM[m]; d += dStep) {
            if (d > 1 && DIM[m] - d < dStep / 2) continue;
            const v = mv + (d - 1) / (12 * DIM[m]);
            if (v < v0 || v > v1) continue;
            const first = d === 1;
            out.push({ v, label: first ? MS[m] + (m === 0 ? ' ' + this.yearLabel(y) : '') : String(d), major: first });
          }
        }
      }
    }
    return out;
  }
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const n = m ? parseInt(m[1], 16) : 0x777777;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const rgba = (rgb, a) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, Math.min(r, w / 2));
  else ctx.rect(x, y, w, h);
}
