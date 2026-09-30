/*
 * ui.js — briques d'interface partagées par les chapitres :
 * contrôles, sélection de série, formatage, blocs de code R, quiz, tableaux.
 */
(function (root) {
  'use strict';
  const { fmtNum } = root.Charts;

  const store = {
    get(k, d) { try { const v = localStorage.getItem('ast:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ast:' + k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } },
  };

  const STATE = { datasets: [...root.TSData.DATASETS] };
  const listeners = [];
  function addDataset(ds) {
    STATE.datasets = STATE.datasets.filter((d) => d.id !== ds.id);
    STATE.datasets.push(ds);
    listeners.forEach((f) => f());
  }
  const getDataset = (id) => STATE.datasets.find((d) => d.id === id) || STATE.datasets[0];

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = (sel, r = document) => r.querySelector(sel);
  const $$ = (sel, r = document) => [...r.querySelectorAll(sel)];

  // ------------------------------------------------------------ Formatage
  const f2 = (v, d = 3) => (v === null || v === undefined || !isFinite(v) ? '—' : Number(v).toFixed(d).replace('.', ','));
  function fp(p) {
    if (p === null || p === undefined || !isFinite(p)) return '—';
    if (p < 0.0001) return '< 0,0001';
    return f2(p, 4);
  }
  const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  // Étiquette d'axe x et ticks adaptés à la fréquence de la série
  function timeAxis(ds, extra = 0) {
    const dates = ds.dates ? [...ds.dates, ...(root.TSData.extendDates(ds.dates, ds.freq, extra) || [])] : null;
    const label = (i, full) => {
      i = Math.round(i);
      if (!dates || i < 0 || i >= dates.length) return full ? `t = ${i + 1}` : String(i + 1);
      const d = dates[i];
      if (ds.freq === 'M') { const [y, m] = d.split('-'); return full ? `${MOIS[+m - 1]} ${y}` : y; }
      if (ds.freq === 'D' || ds.freq === 'W') { const [y, m, dd] = d.split('-'); return full ? `${dd}/${m}/${y}` : `${dd}/${m}`; }
      return d;
    };
    const ticks = (count, lo, hi) => {
      if (!dates) return root.Charts.niceTicks(lo, hi, count).map((v) => v - 1).filter((v) => v >= lo && v <= hi).map((v) => v);
      let unit = ds.freq === 'M' ? 12 : ds.freq === 'D' ? 7 : ds.freq === 'Q' ? 4 : 1;
      let off = 0;
      if (ds.freq === 'M') off = (12 - (+dates[0].split('-')[1] - 1)) % 12;
      const span = hi - lo;
      let step = unit;
      const mults = [1, 2, 3, 4, 5, 10, 20, 50];
      for (const k of mults) { step = unit * k; if (span / step <= count) break; }
      const out = [];
      for (let v = off; v <= hi; v += step) if (v >= lo) out.push(v);
      return out;
    };
    return { label, ticks, dates };
  }

  // ------------------------------------------------------------ Contrôles (HTML)
  const ctl = {
    slider: (id, label, min, max, step, value, unit = '') =>
      `<label class="ctl" for="${id}"><span>${label} <output id="${id}-out">${value}${unit}</output></span>` +
      `<input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" data-unit="${unit}"></label>`,
    select: (id, label, options, value) =>
      `<label class="ctl" for="${id}"><span>${label}</span><select id="${id}">${options.map(([v, t]) =>
        `<option value="${esc(v)}"${String(v) === String(value) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`,
    number: (id, label, value, min = 0, max = 99, step = 1) =>
      `<label class="ctl" for="${id}"><span>${label}</span><input type="number" id="${id}" value="${value}" min="${min}" max="${max}" step="${step}"></label>`,
    check: (id, label, checked) =>
      `<label class="ctl check" for="${id}"><input type="checkbox" id="${id}"${checked ? ' checked' : ''}> ${label}</label>`,
    series: (id, value, filter = null) => {
      const list = STATE.datasets.filter((d) => !filter || filter(d));
      return ctl.select(id, 'Série', list.map((d) => [d.id, d.name]), value || list[0].id);
    },
  };

  // Liaison : met à jour les <output> des sliders et appelle fn à chaque changement
  function bind(rootEl, fn, { debounce = 0 } = {}) {
    let timer = null;
    const run = () => { if (debounce) { clearTimeout(timer); timer = setTimeout(fn, debounce); } else fn(); };
    $$('input, select', rootEl).forEach((inp) => {
      if (inp.dataset.nobind !== undefined) return;
      const ev = inp.type === 'range' ? 'input' : 'change';
      inp.addEventListener(ev, () => {
        if (inp.type === 'range') { const o = $('#' + inp.id + '-out', rootEl); if (o) o.textContent = inp.value + (inp.dataset.unit || ''); }
        run();
      });
    });
  }
  const val = (id) => { const e = document.getElementById(id); if (!e) return null; if (e.type === 'checkbox') return e.checked; return e.value; };
  const num = (id) => parseFloat(val(id));
  const int = (id) => parseInt(val(id), 10);

  // ------------------------------------------------------------ Blocs de contenu
  function block(label, inner) { return `<section class="block"><div class="label">${label}</div>${inner}</section>`; }
  function formula(title, tex) { return `<div class="formula">${title ? `<div class="ftitle">${title}</div>` : ''}${tex}</div>`; }

  // Coloration minimale du R : commentaires, chaînes, mots-clés, opérateur d'affectation
  function highlightR(code) {
    const kw = /\b(function|if|else|for|in|while|repeat|return|next|break|TRUE|FALSE|NULL|NA|Inf|library|require)\b/g;
    return code.split('\n').map((line) => {
      // un # dans une chaîne ne commence pas un commentaire
      let i = -1, q = null;
      for (let k = 0; k < line.length; k++) {
        const ch = line[k];
        if (q) { if (ch === q) q = null; } else if (ch === '"' || ch === "'") q = ch; else if (ch === '#') { i = k; break; }
      }
      let body = i >= 0 ? line.slice(0, i) : line, com = i >= 0 ? line.slice(i) : '';
      body = esc(body).replace(/(&quot;[^&]*?&quot;|'[^']*')/g, '<span class="s">$1</span>')
        .replace(kw, '<span class="k">$1</span>').replace(/&lt;-|\|&gt;|%&gt;%/g, (m) => `<span class="k">${m}</span>`);
      return body + (com ? `<span class="c">${esc(com)}</span>` : '');
    }).join('\n');
  }
  function rCode(code, title = 'R · forecast, tseries') {
    return `<div class="code"><div class="code-title">${esc(title)}</div><pre data-raw="${esc(code)}">${highlightR(code)}</pre>` +
      `<button class="ghost copy" type="button">Copier</button></div>`;
  }
  function wireCopy(rootEl) {
    $$('.code .copy', rootEl).forEach((b) => {
      b.addEventListener('click', () => copyText($('pre', b.parentElement).dataset.raw, b, $('pre', b.parentElement)));
    });
  }
  function copyText(text, btn, selectEl) {
    const done = (ok) => { const t = btn.textContent; btn.textContent = ok ? 'Copié' : 'Sélectionné'; setTimeout(() => { btn.textContent = t; }, 1400); };
    const fallback = () => {
      if (selectEl) { const r = document.createRange(); r.selectNodeContents(selectEl); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
      done(false);
    };
    try { navigator.clipboard.writeText(text).then(() => done(true), fallback); } catch (e) { fallback(); }
  }

  // Quiz : [{ q, opts: [...], a: index, expl }]
  function quiz(items) {
    return `<div class="quiz">${items.map((it, qi) => `<div class="q" data-a="${it.a}">
      <div class="q-text">${qi + 1}. ${it.q}</div>
      <div class="q-opts">${it.opts.map((o, oi) => `<button type="button" data-i="${oi}">${o}</button>`).join('')}</div>
      <div class="q-expl" hidden>${it.expl}</div></div>`).join('')}</div>`;
  }
  function wireQuiz(rootEl) {
    $$('.q', rootEl).forEach((q) => {
      const a = +q.dataset.a;
      $$('.q-opts button', q).forEach((b) => b.addEventListener('click', () => {
        $$('.q-opts button', q).forEach((x) => x.classList.remove('right', 'wrong'));
        b.classList.add(+b.dataset.i === a ? 'right' : 'wrong');
        $$('.q-opts button', q)[a].classList.add('right');
        $('.q-expl', q).hidden = false;
      }));
    });
  }

  function table(head, rows, { numCols = [], rowClass = null, rowAttr = null } = {}) {
    return `<div class="table-wrap"><table><thead><tr>${head.map((h, i) => `<th class="${numCols.includes(i) ? 'num' : ''}">${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r, ri) => `<tr class="${rowClass ? rowClass(r, ri) : ''}" ${rowAttr ? rowAttr(r, ri) : ''}>${r.map((c, i) => `<td class="${numCols.includes(i) ? 'num' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  const stats = (items) => `<div class="stats">${items.map(([k, v]) => `<div class="stat"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}</div>`;
  const pill = (kind, text) => `<span class="pill ${kind}">${text}</span>`;

  function typeset(el) {
    if (root.MathJax && root.MathJax.typesetPromise) {
      root.MathJax.typesetClear && root.MathJax.typesetClear([el]);
      return root.MathJax.typesetPromise([el]).catch(() => {});
    }
    return Promise.resolve();
  }

  const tick = () => new Promise((r) => setTimeout(r, 16));

  // Série transformée : Box-Cox λ, d différences, D différences saisonnières
  function transformSeries(ds, { lambda = null, d = 0, D = 0 }) {
    let y = TS.boxcox(ds.values, lambda);
    y = TS.diff(y, 1, d);
    if (D > 0 && ds.period > 1) y = TS.diff(y, ds.period, D);
    const offset = ds.values.length - y.length;
    return { y, offset };
  }

  function lambdaOptions(ds) {
    const pos = ds.values.every((v) => v > 0);
    const opts = [['none', 'aucune']];
    if (pos) opts.push(['0', 'log (λ = 0)'], ['0.5', 'racine (λ = 0,5)'], ['auto', `auto (λ̂ = ${f2(TS.boxcoxLambda(ds.values), 2)})`]);
    return opts;
  }
  function parseLambda(v, ds) {
    if (v === 'none' || v === null) return null;
    if (v === 'auto') return TS.boxcoxLambda(ds.values);
    return parseFloat(v);
  }
  function lambdaTex(l) { return l === null ? 'aucune' : Math.abs(l) < 1e-12 ? '\\log' : `λ = ${f2(l, 2)}`; }

  // Ligne R qui crée l'objet ts de la série : AirPassengers est fourni par R ; les autres séries
  // sont écrites en clair (jusqu'à 600 valeurs) pour que le code s'exécute tel quel.
  function rStart(ds) {
    if (ds.dates && ds.freq === 'M') { const [yy, mm] = ds.dates[0].split('-'); return `c(${+yy}, ${+mm})`; }
    if (ds.dates && ds.freq === 'Q') { const [yy, q] = ds.dates[0].split('-Q'); return `c(${+yy}, ${+q})`; }
    if (ds.dates && ds.freq === 'Y') return String(+ds.dates[0]);
    return '1';
  }
  function rSeries(ds, name = 'y') {
    if (ds.id === 'air') return `${name} <- AirPassengers                 # fourni avec R`;
    const freq = ds.period > 1 ? ds.period : 1;
    const start = rStart(ds);
    if (ds.values.length > 600) return `${name} <- ts(read.csv("serie.csv")$valeur, start = ${start}, frequency = ${freq})`;
    const vals = ds.values.map((v) => +v.toFixed(4)).join(', ');
    return `${name} <- ts(c(${vals}),\n        start = ${start}, frequency = ${freq})   # ${ds.name}`;
  }

  function datasetCsv(ds) {
    return 'date,valeur\n' + ds.values.map((v, i) => `${ds.dates ? ds.dates[i] : i + 1},${v}`).join('\n');
  }

  // Icônes de chapitre : dessin au trait sur une grille 24×24, couleur héritée (currentColor)
  const ICONS = {
    intro: '<path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3z"/><path d="M21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z"/>',
    anatomie: '<path d="M12 3 3 7.5 12 12l9-4.5z"/><path d="m3 12 9 4.5 9-4.5"/><path d="m3 16.5 9 4.5 9-4.5"/>',
    stationnarite: '<path d="M3 12h18" stroke-dasharray="2 3"/><path d="M3 12c1.5-4 3-4 4.5 0s3 4 4.5 0 3-4 4.5 0 3 4 4.5 0"/>',
    acf: '<path d="M4 20h16"/><path d="M6.5 20V5"/><path d="M10.5 20v-9"/><path d="M14.5 20v-5"/><path d="M18.5 20v-2.5"/>',
    arma: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v4h-4"/><circle cx="12" cy="12" r="2"/>',
    lissage: '<path d="M3 17c4 0 5-10 9-10s5 6 9 6"/><path d="M5 13h.01M8.5 10.5h.01M15.5 12.5h.01M19 9.5h.01" stroke-width="3"/>',
    sarima: '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>',
    evaluation: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    labo: '<path d="M9 3h6M10 3v6l-5.2 9.1A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-2.9L14 9V3"/><path d="M7.4 15h9.2"/>',
    cas: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 4.5V3h6v1.5"/><path d="M8.5 10h7M8.5 13.5h7M8.5 17h4"/>',
    exercices: '<path d="M4 20l1.2-4.2L16.5 4.5l3 3L8.2 18.8z"/><path d="m14.5 6.5 3 3"/>',
  };
  const icon = (id, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[id] || ''}</svg>`;

  root.UI = {
    icon,
    STATE, store, addDataset, getDataset, onDatasets: (f) => listeners.push(f), esc, $, $$,
    f2, fp, fmtNum, MOIS, timeAxis, ctl, bind, val, num, int, block, formula, rCode, wireCopy, copyText,
    quiz, wireQuiz, table, stats, pill, typeset, tick, transformSeries, lambdaOptions, parseLambda, lambdaTex, datasetCsv, rSeries, rStart,
  };
})(window);
