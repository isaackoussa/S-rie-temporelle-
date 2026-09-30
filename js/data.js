/*
 * data.js — jeux de données de l'atelier.
 * AirPassengers : Box & Jenkins (1976), passagers aériens internationaux mensuels (milliers), 1949–1960.
 * Les autres séries sont simulées (graine fixe) et signalées comme telles dans l'interface.
 */
(function (root) {
  'use strict';
  const TS = root.TS || (typeof require !== 'undefined' ? require('./stats.js') : null);

  const AIR = [
    112, 118, 132, 129, 121, 135, 148, 148, 136, 119, 104, 118,
    115, 126, 141, 135, 125, 149, 170, 170, 158, 133, 114, 140,
    145, 150, 178, 163, 172, 178, 199, 199, 184, 162, 146, 166,
    171, 180, 193, 181, 183, 218, 230, 242, 209, 191, 172, 194,
    196, 196, 236, 235, 229, 243, 264, 272, 237, 211, 180, 201,
    204, 188, 235, 227, 234, 264, 302, 293, 259, 229, 203, 229,
    242, 233, 267, 269, 270, 315, 364, 347, 312, 274, 237, 278,
    284, 277, 317, 313, 318, 374, 413, 405, 355, 306, 271, 306,
    315, 301, 356, 348, 355, 422, 465, 467, 404, 347, 305, 336,
    340, 318, 362, 348, 363, 435, 491, 505, 404, 359, 310, 337,
    360, 342, 406, 396, 420, 472, 548, 559, 463, 407, 362, 405,
    417, 391, 419, 461, 472, 535, 622, 606, 508, 461, 390, 432,
  ];

  function monthlyDates(startYear, startMonth, n) {
    return Array.from({ length: n }, (_, i) => {
      const y = startYear + Math.floor((startMonth - 1 + i) / 12);
      const m = ((startMonth - 1 + i) % 12) + 1;
      return `${y}-${String(m).padStart(2, '0')}`;
    });
  }
  function dailyDates(start, n) {
    const d0 = new Date(start + 'T00:00:00Z');
    return Array.from({ length: n }, (_, i) => new Date(d0.getTime() + i * 86400000).toISOString().slice(0, 10));
  }

  // Ventes mensuelles simulées : tendance linéaire + saison additive + bruit AR(1)
  function simulatedSales() {
    const n = 120, g = TS.gaussianRng(7);
    let u = 0;
    return Array.from({ length: n }, (_, t) => {
      u = 0.5 * u + 6 * g();
      return Math.round((200 + 1.2 * t + 25 * Math.sin((2 * Math.PI * t) / 12) + 12 * Math.cos((2 * Math.PI * t) / 6) + u) * 10) / 10;
    });
  }
  // Charge électrique journalière simulée : saisonnalité hebdomadaire + dérive lente
  function simulatedLoad() {
    const n = 364, g = TS.gaussianRng(11);
    const week = [1.0, 1.02, 1.03, 1.02, 0.98, 0.8, 0.74];
    let lvl = 500;
    return Array.from({ length: n }, (_, t) => {
      lvl += 0.4 * g();
      const yearly = 60 * Math.cos((2 * Math.PI * (t + 10)) / 365);
      return Math.round(((lvl + yearly) * week[t % 7] + 8 * g()) * 10) / 10;
    });
  }

  const DATASETS = [
    {
      id: 'air', name: 'Passagers aériens (1949–1960)', short: 'AirPassengers', values: AIR,
      dates: monthlyDates(1949, 1, AIR.length), freq: 'M', period: 12, unit: 'milliers de passagers',
      note: 'Box & Jenkins (1976). Tendance croissante, saisonnalité annuelle dont l’amplitude grandit avec le niveau : cas d’école du modèle multiplicatif.',
    },
    {
      id: 'sales', name: 'Ventes mensuelles (simulées)', short: 'Ventes', values: simulatedSales(),
      dates: monthlyDates(2015, 1, 120), freq: 'M', period: 12, unit: 'unités',
      note: 'Série simulée : 200 + 1,2 t + saison additive (périodes 12 et 6) + bruit AR(1) de coefficient 0,5.',
    },
    {
      id: 'load', name: 'Charge électrique journalière (simulée)', short: 'Charge', values: simulatedLoad(),
      dates: dailyDates('2024-01-01', 364), freq: 'D', period: 7, unit: 'MW',
      note: 'Série simulée : cycle annuel + saison hebdomadaire multiplicative (creux le week-end) + niveau en marche aléatoire.',
    },
    {
      id: 'rw', name: 'Marche aléatoire (simulée)', short: 'Marche aléatoire',
      values: (() => { const g = TS.gaussianRng(3); let s = 100; return Array.from({ length: 250 }, () => (s += g())); })().map((v) => Math.round(v * 100) / 100),
      dates: null, freq: null, period: 1, unit: '',
      note: 'X_t = X_{t−1} + ε_t, ε_t ~ N(0, 1). Non stationnaire : sa variance croît linéairement avec t.',
    },
  ];

  function extendDates(dates, freq, h) {
    if (!dates) return null;
    const last = dates[dates.length - 1], out = [];
    if (freq === 'M') {
      let [y, m] = last.split('-').map(Number);
      for (let k = 0; k < h; k++) { m++; if (m > 12) { m = 1; y++; } out.push(`${y}-${String(m).padStart(2, '0')}`); }
    } else if (freq === 'D' || freq === 'W') {
      const step = freq === 'D' ? 86400000 : 7 * 86400000;
      const t0 = new Date(last + 'T00:00:00Z').getTime();
      for (let k = 1; k <= h; k++) out.push(new Date(t0 + k * step).toISOString().slice(0, 10));
    } else if (freq === 'Y') {
      const y = parseInt(last, 10);
      for (let k = 1; k <= h; k++) out.push(String(y + k));
    } else if (freq === 'Q') {
      let [y, q] = last.split('-Q').map(Number);
      for (let k = 0; k < h; k++) { q++; if (q > 4) { q = 1; y++; } out.push(`${y}-Q${q}`); }
    } else return null;
    return out;
  }

  const API = { DATASETS, monthlyDates, dailyDates, extendDates, AIR };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.TSData = API;
})(typeof window !== 'undefined' ? window : this);
