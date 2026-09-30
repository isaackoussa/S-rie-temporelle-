/*
 * charts.js — mini-bibliothèque de graphiques SVG.
 * Les couleurs sont des variables CSS (var(--s1)…), donc le thème clair/sombre suit sans re-rendu.
 *
 * plot(el, {
 *   layers: [{ type: 'line'|'band'|'stem'|'bar'|'points'|'hline'|'vline'|'shade',
 *              x?, y?, lo?, hi?, name?, color?, dash?, width?, value?, from?, to?, label? }],
 *   xLabel: (x) => string, yFmt, height, title, yMin, yMax, xMin, xMax, symmetricY, legend
 * })
 */
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs = {}, parent = null) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  }

  function niceTicks(min, max, count = 5) {
    if (!isFinite(min) || !isFinite(max)) return [0];
    if (min === max) { min -= 1; max += 1; }
    const span = max - min, raw = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    const out = [];
    for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return out;
  }

  function fmtNum(v) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    const a = Math.abs(v);
    if (a !== 0 && (a < 0.001 || a >= 1e6)) return v.toExponential(2);
    if (a >= 1000) return v.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
    if (a >= 100) return v.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
    if (a >= 1) return v.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
    return v.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
  }

  const colorVar = (c) => (c && c.startsWith('--') ? `var(${c})` : c || 'var(--s1)');

  function plot(container, opts) {
    container.classList.add('chart');
    container._opts = opts;
    render(container);
    if (!container._ro && 'ResizeObserver' in window) {
      let w = container.clientWidth;
      container._ro = new ResizeObserver(() => {
        if (Math.abs(container.clientWidth - w) > 2) { w = container.clientWidth; render(container); }
      });
      container._ro.observe(container);
    }
  }

  function render(container) {
    const opts = container._opts;
    const layers = opts.layers.filter(Boolean);
    container.innerHTML = '';
    const named = layers.filter((l) => l.name && ['line', 'band', 'stem', 'bar', 'points'].includes(l.type));
    if (opts.title || (named.length > 1 && opts.legend !== false)) {
      const head = document.createElement('div');
      head.className = 'chart-head';
      if (opts.title) { const t = document.createElement('div'); t.className = 'chart-title'; t.textContent = opts.title; head.appendChild(t); }
      if (named.length > 1 && opts.legend !== false) {
        const lg = document.createElement('div'); lg.className = 'chart-legend';
        named.forEach((l) => {
          const it = document.createElement('span'); it.className = 'lg-item';
          const sw = document.createElement('span'); sw.className = 'lg-swatch' + (l.type === 'band' ? ' band' : l.dash ? ' dash' : '');
          sw.style.setProperty('--c', colorVar(l.color));
          it.append(sw, document.createTextNode(l.name)); lg.appendChild(it);
        });
        head.appendChild(lg);
      }
      container.appendChild(head);
    }

    const W = Math.max(260, container.clientWidth || 600);
    const H = opts.height || 260;
    const m = { t: 10, r: 14, b: opts.xAxisTitle ? 44 : 28, l: 52 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;

    // Étendues
    let xs = [], ys = [];
    layers.forEach((l) => {
      if (l.x) xs.push(...l.x.filter((v) => v !== null && isFinite(v)));
      if (l.y) ys.push(...l.y.filter((v) => v !== null && isFinite(v)));
      if (l.lo) ys.push(...l.lo.filter((v) => v !== null && isFinite(v)));
      if (l.hi) ys.push(...l.hi.filter((v) => v !== null && isFinite(v)));
      if (l.type === 'hline' && l.includeInRange !== false) ys.push(l.value);
    });
    let xMin = opts.xMin ?? Math.min(...xs), xMax = opts.xMax ?? Math.max(...xs);
    if (xMin === xMax) { xMin -= 1; xMax += 1; }
    let yMin = opts.yMin ?? Math.min(...ys), yMax = opts.yMax ?? Math.max(...ys);
    if (opts.symmetricY) { const a = Math.max(Math.abs(yMin), Math.abs(yMax)); yMin = -a; yMax = a; }
    if (yMin === yMax) { yMin -= 1; yMax += 1; }
    const pad = (yMax - yMin) * 0.06;
    if (opts.yMin === undefined) yMin -= pad;
    if (opts.yMax === undefined) yMax += pad;
    const hasBars = layers.some((l) => l.type === 'bar' || l.type === 'stem');
    const xPad = hasBars ? 0.6 : 0;
    const sx = (v) => m.l + ((v - xMin + xPad) / (xMax - xMin + 2 * xPad)) * iw;
    const sy = (v) => m.t + (1 - (v - yMin) / (yMax - yMin)) * ih;

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': opts.ariaLabel || opts.title || 'graphique' }, container);
    svg.classList.add('chart-svg');
    const defs = el('defs', {}, svg);
    const clipId = 'c' + Math.random().toString(36).slice(2, 9);
    el('rect', { x: m.l, y: m.t, width: iw, height: ih }, el('clipPath', { id: clipId }, defs));

    // Grille & axes
    const yt = niceTicks(yMin, yMax, Math.max(3, Math.round(ih / 55)));
    const gGrid = el('g', { class: 'grid' }, svg);
    yt.forEach((v) => {
      if (v < yMin || v > yMax) return;
      el('line', { x1: m.l, x2: m.l + iw, y1: sy(v), y2: sy(v) }, gGrid);
      const t = el('text', { x: m.l - 8, y: sy(v) + 4, class: 'tick', 'text-anchor': 'end' }, svg);
      t.textContent = (opts.yFmt || fmtNum)(v);
    });
    const nX = Math.max(2, Math.round(iw / 90));
    const xt = typeof opts.xTicks === 'function' ? opts.xTicks(nX, xMin, xMax) : opts.xTicks || niceTicks(xMin, xMax, nX);
    xt.forEach((v) => {
      if (v < xMin - xPad || v > xMax + xPad) return;
      const t = el('text', { x: sx(v), y: m.t + ih + 18, class: 'tick', 'text-anchor': 'middle' }, svg);
      t.textContent = opts.xLabel ? opts.xLabel(v) : fmtNum(v);
    });
    el('line', { x1: m.l, x2: m.l + iw, y1: m.t + ih, y2: m.t + ih, class: 'axis' }, svg);
    if (opts.xAxisTitle) {
      const t = el('text', { x: m.l + iw / 2, y: H - 6, class: 'axis-title', 'text-anchor': 'middle' }, svg);
      t.textContent = opts.xAxisTitle;
    }

    const g = el('g', { 'clip-path': `url(#${clipId})` }, svg);
    const pathOf = (x, y) => {
      let d = '', pen = false;
      for (let i = 0; i < x.length; i++) {
        if (y[i] === null || y[i] === undefined || !isFinite(y[i])) { pen = false; continue; }
        d += (pen ? 'L' : 'M') + sx(x[i]).toFixed(2) + ',' + sy(y[i]).toFixed(2);
        pen = true;
      }
      return d;
    };

    layers.forEach((l) => {
      const c = colorVar(l.color);
      if (l.type === 'shade') {
        el('rect', { x: sx(l.from), y: m.t, width: Math.max(0, sx(l.to) - sx(l.from)), height: ih, class: 'shade' }, g);
        if (l.label) { const t = el('text', { x: sx(l.from) + 6, y: m.t + 14, class: 'shade-label' }, g); t.textContent = l.label; }
      } else if (l.type === 'band') {
        let d = '';
        const idx = l.x.map((_, i) => i).filter((i) => l.lo[i] !== null && l.hi[i] !== null && isFinite(l.lo[i]) && isFinite(l.hi[i]));
        idx.forEach((i, k) => { d += (k ? 'L' : 'M') + sx(l.x[i]) + ',' + sy(l.hi[i]); });
        [...idx].reverse().forEach((i) => { d += 'L' + sx(l.x[i]) + ',' + sy(l.lo[i]); });
        if (d) el('path', { d: d + 'Z', style: `fill:${c};opacity:${l.opacity ?? 0.16}` }, g);
      } else if (l.type === 'line') {
        el('path', {
          d: pathOf(l.x, l.y), fill: 'none',
          style: `stroke:${c};stroke-width:${l.width || 2};${l.dash ? 'stroke-dasharray:5 4;' : ''}${l.opacity ? `opacity:${l.opacity}` : ''}`,
          'stroke-linejoin': 'round', 'stroke-linecap': 'round',
        }, g);
      } else if (l.type === 'stem' || l.type === 'bar') {
        const bw = Math.max(2, Math.min(l.type === 'bar' ? 40 : 6, (iw / (xMax - xMin + 2 * xPad)) * (l.type === 'bar' ? 0.8 : 0.35)));
        l.x.forEach((xv, i) => {
          const yv = l.y[i];
          if (yv === null || !isFinite(yv)) return;
          const base = l.base ?? 0;
          const y0 = sy(Math.max(yv, base)), h = Math.abs(sy(yv) - sy(base));
          el('rect', { x: sx(xv) - bw / 2, y: y0, width: bw, height: Math.max(h, 0.5), rx: Math.min(2, bw / 2), style: `fill:${l.colorFn ? colorVar(l.colorFn(yv, i)) : c}` }, g);
        });
      } else if (l.type === 'points') {
        l.x.forEach((xv, i) => {
          if (l.y[i] === null || !isFinite(l.y[i])) return;
          el('circle', { cx: sx(xv), cy: sy(l.y[i]), r: l.r || 3, style: `fill:${c}` }, g);
        });
      } else if (l.type === 'hline') {
        el('line', { x1: m.l, x2: m.l + iw, y1: sy(l.value), y2: sy(l.value), style: `stroke:${l.color ? c : 'var(--ink-3)'};stroke-width:1;${l.dash !== false ? 'stroke-dasharray:4 4' : ''}` }, g);
        if (l.label) { const t = el('text', { x: m.l + iw - 4, y: sy(l.value) - 5, class: 'shade-label', 'text-anchor': 'end' }, g); t.textContent = l.label; }
      } else if (l.type === 'vline') {
        el('line', { x1: sx(l.value), x2: sx(l.value), y1: m.t, y2: m.t + ih, style: 'stroke:var(--ink-3);stroke-width:1;stroke-dasharray:4 4' }, g);
      }
    });

    // Survol : réticule + infobulle sur la valeur de x la plus proche
    const hoverLayers = layers.filter((l) => (l.type === 'line' || l.type === 'stem' || l.type === 'bar' || l.type === 'points') && l.hover !== false && l.name);
    if (opts.hover === false || !hoverLayers.length) return;
    const allX = [...new Set(hoverLayers.flatMap((l) => l.x))].sort((a, b) => a - b);
    const cross = el('line', { y1: m.t, y2: m.t + ih, class: 'crosshair', visibility: 'hidden' }, svg);
    const dots = el('g', { visibility: 'hidden' }, svg);
    const tip = document.createElement('div');
    tip.className = 'chart-tip'; tip.hidden = true;
    container.appendChild(tip);
    const hit = el('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent' }, svg);
    const move = (clientX) => {
      const r = svg.getBoundingClientRect();
      const px = ((clientX - r.left) / r.width) * W;
      const xv = xMin - xPad + ((px - m.l) / iw) * (xMax - xMin + 2 * xPad);
      let best = allX[0];
      for (const v of allX) if (Math.abs(v - xv) < Math.abs(best - xv)) best = v;
      cross.setAttribute('x1', sx(best)); cross.setAttribute('x2', sx(best));
      cross.setAttribute('visibility', 'visible');
      dots.innerHTML = ''; dots.setAttribute('visibility', 'visible');
      const rows = [];
      hoverLayers.forEach((l) => {
        const i = l.x.indexOf(best);
        if (i < 0 || l.y[i] === null || !isFinite(l.y[i])) return;
        if (l.type === 'line') el('circle', { cx: sx(best), cy: sy(l.y[i]), r: 4, class: 'hover-dot', style: `fill:${colorVar(l.color)}` }, dots);
        let extra = '';
        const band = layers.find((b) => b.type === 'band' && b.of === l.name);
        if (band) { const j = band.x.indexOf(best); if (j >= 0) extra = ` <span class="tip-muted">[${fmtNum(band.lo[j])} ; ${fmtNum(band.hi[j])}]</span>`; }
        rows.push(`<div class="tip-row"><span class="lg-swatch" style="--c:${colorVar(l.color)}"></span>${l.name}<b>${(opts.tipFmt || fmtNum)(l.y[i])}</b>${extra}</div>`);
      });
      if (!rows.length) { tip.hidden = true; return; }
      tip.innerHTML = `<div class="tip-x">${opts.xLabel ? opts.xLabel(best, true) : fmtNum(best)}</div>${rows.join('')}`;
      tip.hidden = false;
      const cx = (sx(best) / W) * r.width;
      const tw = tip.offsetWidth;
      tip.style.left = Math.min(Math.max(cx + 12, 0), r.width - tw - 4) + (cx + 12 + tw > r.width ? -tw - 24 : 0) + 'px';
      tip.style.top = (svg.offsetTop + 8) + 'px';
    };
    const leave = () => { cross.setAttribute('visibility', 'hidden'); dots.setAttribute('visibility', 'hidden'); tip.hidden = true; };
    hit.addEventListener('pointermove', (e) => move(e.clientX));
    hit.addEventListener('pointerdown', (e) => move(e.clientX));
    hit.addEventListener('pointerleave', leave);
  }

  // Plan complexe : racines + cercle unité
  function complexPlane(container, { groups, height = 260, title }) {
    container.classList.add('chart');
    container.innerHTML = '';
    const head = document.createElement('div'); head.className = 'chart-head';
    if (title) { const t = document.createElement('div'); t.className = 'chart-title'; t.textContent = title; head.appendChild(t); }
    const lg = document.createElement('div'); lg.className = 'chart-legend';
    groups.forEach((gr) => {
      const it = document.createElement('span'); it.className = 'lg-item';
      const sw = document.createElement('span'); sw.className = 'lg-swatch dot'; sw.style.setProperty('--c', colorVar(gr.color));
      it.append(sw, document.createTextNode(gr.name)); lg.appendChild(it);
    });
    head.appendChild(lg); container.appendChild(head);
    const all = groups.flatMap((g) => g.roots);
    const R = Math.min(4, Math.max(1.6, ...all.map((z) => Math.max(Math.abs(z.re), Math.abs(z.im)) * 1.15)));
    const S = height, c = S / 2, sc = (S / 2 - 18) / R;
    const svg = el('svg', { viewBox: `0 0 ${S} ${S}`, width: S, height: S, class: 'chart-svg square', role: 'img', 'aria-label': title || 'racines' }, container);
    const gg = el('g', { class: 'grid' }, svg);
    el('line', { x1: 0, x2: S, y1: c, y2: c }, gg);
    el('line', { y1: 0, y2: S, x1: c, x2: c }, gg);
    el('circle', { cx: c, cy: c, r: sc, class: 'unit-circle' }, svg);
    const t1 = el('text', { x: c + sc * 0.72 + 4, y: c - sc * 0.72 - 4, class: 'tick' }, svg); t1.textContent = '|z| = 1';
    [-R, R].forEach((v) => { const t = el('text', { x: c + v * sc * 0.92, y: c + 14, class: 'tick', 'text-anchor': 'middle' }, svg); t.textContent = fmtNum(Math.round(v * 10) / 10); });
    groups.forEach((gr) => gr.roots.forEach((z) => {
      const x = c + Math.max(-R, Math.min(R, z.re)) * sc, y = c - Math.max(-R, Math.min(R, z.im)) * sc;
      const inside = Math.hypot(z.re, z.im) <= 1 + 1e-9;
      const circ = el('circle', { cx: x, cy: y, r: 6, style: `fill:${inside ? 'var(--bg)' : colorVar(gr.color)};stroke:${colorVar(gr.color)};stroke-width:2.5` }, svg);
      const tt = el('title', {}, circ); tt.textContent = `${gr.name} : ${fmtNum(z.re)} ${z.im >= 0 ? '+' : '−'} ${fmtNum(Math.abs(z.im))}i  (|z| = ${fmtNum(Math.hypot(z.re, z.im))})`;
    }));
  }

  root.Charts = { plot, complexPlane, niceTicks, fmtNum };
})(window);
