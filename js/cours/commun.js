/*
 * commun.js — outils partagés par les chapitres du cours M2 GRAF (page cours-m2graf.html).
 * Séries du cours, axes de temps, blocs « exercice corrigé », simulations des TP.
 */
(function (root) {
  'use strict';
  const D = root.CoursData, UI = root.UI, { monthlyDates } = root.TSData;

  const years = (y0, n) => Array.from({ length: n }, (_, i) => String(y0 + i));
  const SERIES = {
    usacc: { id: 'usacc', name: 'USAccDeaths : morts accidentelles aux États-Unis (1973–1978)', short: 'USAccDeaths', r: 'USAccDeaths',
      values: D.USAccDeaths.values, dates: monthlyDates(1973, 1, 72), freq: 'M', period: 12 },
    air: { ...UI.getDataset('air'), name: 'AirPassengers : passagers aériens, milliers (1949–1960)', short: 'AirPassengers', r: 'AirPassengers' },
    sunspot: { id: 'sunspot', name: 'sunspot.year : taches solaires annuelles (1700–1988)', short: 'sunspot.year', r: 'sunspot.year',
      values: D.sunspot.values, dates: years(1700, D.sunspot.values.length), freq: 'Y', period: 1 },
    co2: { id: 'co2', name: 'co2 : concentration en CO₂ à Mauna Loa, ppm (1959–1997)', short: 'co2', r: 'co2',
      values: D.co2.values, dates: monthlyDates(1959, 1, D.co2.values.length), freq: 'M', period: 12 },
    cac: { id: 'cac', name: 'CAC40 : clôtures journalières (1991–1998)', short: 'CAC40', r: 'EuStockMarkets[, "CAC"]',
      values: D.EuStockMarkets.CAC, dates: null, freq: null, period: 1, t0: D.EuStockMarkets.start, f: D.EuStockMarkets.frequency },
  };
  const EU = ['DAX', 'SMI', 'CAC', 'FTSE'];

  // Axe pour séries à temps décimal (EuStockMarkets : 260 jours ouvrés par an)
  function axis(ds, extra = 0) {
    if (!ds.t0) return UI.timeAxis(ds, extra);
    const yr = (i) => ds.t0 + i / ds.f;
    return {
      label: (i, full) => (full ? `${UI.f2(yr(i), 2)} (jour ${Math.round(i) + 1})` : String(Math.floor(yr(i) + 1e-9))),
      ticks: (count, lo, hi) => {
        const out = [];
        for (let y = Math.ceil(yr(lo)); y <= yr(hi); y++) out.push(Math.round((y - ds.t0) * ds.f));
        const step = Math.max(1, Math.ceil(out.length / count));
        return out.filter((_, k) => k % step === 0);
      },
    };
  }

  const line = (y, name = 'série', color = '--s1', off = 0, width = 1.5) => ({ type: 'line', x: y.map((_, i) => i + off), y, name, color, width });

  function acfChart(el, x, L, title, { pacf = false, theory = null, kind = 'correlation' } = {}) {
    const r = (pacf ? TS.pacf(x, L) : TS.acf(x, L)).slice(1), band = 1.96 / Math.sqrt(x.length);
    root.Charts.plot(el, { title, height: 210, yMin: -1, yMax: 1, xLabel: (v) => String(Math.round(v)),
      layers: [{ type: 'hline', value: band }, { type: 'hline', value: -band }, { type: 'hline', value: 0, dash: false },
        { type: 'stem', x: r.map((_, i) => i + 1), y: r, name: pacf ? 'r̂(h)' : 'ρ̂(h)', color: '--s1', colorFn: (v) => (Math.abs(v) > band ? '--s1' : '--ink-3') },
        theory ? { type: 'points', x: theory.map((_, i) => i + 1), y: theory, name: 'théorique', color: '--s2', r: 3.5 } : null] });
    return { r, band, out: r.filter((v) => Math.abs(v) > band).length };
  }

  // Exercice du cours avec correction dépliable
  function exo(num, enonce, solution) {
    return `<div class="exo"><div class="exo-head"><span class="exo-num">Exercice ${num}</span><span class="exo-src">énoncé du cours</span></div>
      <div class="exo-enonce">${enonce}</div>
      <details class="exo-sol"><summary>Voir la correction</summary><div class="prose">${solution}</div></details></div>`;
  }
  // Question de TP avec réponse rédigée
  function tpq(num, question, reponse) {
    return `<div class="tpq"><div class="tpq-q"><span class="tpq-num">${num}</span><div>${question}</div></div><div class="tpq-r">${reponse}</div></div>`;
  }
  const head = (sec, title, lede) => `<header class="ch-head"><div class="eyebrow">${sec}</div><h1>${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ''}</header>`;
  const missing = (file, hint) => `<div class="callout warn"><p><strong>Fichier non fourni avec le support :</strong> <code>${file}</code>. ${hint}</p></div>`;

  // Séries simulées des TP 1 et 2 : X1 = ε, X2 = 0,5t + 2ε, X3 = 0,5t + ε + 3cos(tπ/6), t = 1..n
  function tpSeries(kind, n, seed) {
    const g = TS.gaussianRng(seed);
    return Array.from({ length: n }, (_, i) => {
      const t = i + 1, e = g();
      if (kind === 'X1') return e;
      if (kind === 'X2') return 0.5 * t + 2 * e;
      return 0.5 * t + e + 3 * Math.cos((t * Math.PI) / 6);
    });
  }

  const pct = (v) => `${UI.f2(100 * v, 1)} %`;

  root.Cours = { SERIES, EU, axis, line, acfChart, exo, tpq, head, missing, tpSeries, pct };
})(window);
