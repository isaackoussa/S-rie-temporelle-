/*
 * stats.js — moteur numérique de l'atelier.
 * Aucune dépendance. Fonctionne dans le navigateur (window.TS) et sous Node (module.exports).
 *
 * Conventions :
 *   AR : X_t = c + φ1 X_{t-1} + … + φp X_{t-p} + ε_t + θ1 ε_{t-1} + … + θq ε_{t-q}
 *   Polynôme AR  φ(B) = 1 − φ1 B − … − φp B^p   → stocké comme [1, −φ1, …, −φp]
 *   Polynôme MA  θ(B) = 1 + θ1 B + … + θq B^q   → stocké comme [1, θ1, …, θq]
 *   (même convention que R et statsmodels)
 */
(function (root) {
  'use strict';

  // ------------------------------------------------------------------ RNG
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Gaussienne par la méthode polaire de Marsaglia
  function gaussianRng(seed) {
    const u = mulberry32(seed);
    let spare = null;
    return function () {
      if (spare !== null) { const s = spare; spare = null; return s; }
      let a, b, s;
      do { a = 2 * u() - 1; b = 2 * u() - 1; s = a * a + b * b; } while (s >= 1 || s === 0);
      const m = Math.sqrt(-2 * Math.log(s) / s);
      spare = b * m;
      return a * m;
    };
  }

  // ------------------------------------------------------------------ Bases
  const sum = (x) => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i]; return s; };
  const mean = (x) => sum(x) / x.length;
  function variance(x, ddof = 0) {
    const m = mean(x); let s = 0;
    for (let i = 0; i < x.length; i++) s += (x[i] - m) ** 2;
    return s / (x.length - ddof);
  }
  const std = (x, ddof = 0) => Math.sqrt(variance(x, ddof));

  function quantile(x, q) {
    const s = [...x].sort((a, b) => a - b);
    const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return s[lo] + (s[hi] - s[lo]) * (pos - lo);
  }

  function rolling(x, w, fn) {
    return x.map((_, i) => (i + 1 < w ? null : fn(x.slice(i + 1 - w, i + 1))));
  }

  function diff(x, lag = 1, times = 1) {
    let y = x;
    for (let k = 0; k < times; k++) y = y.slice(lag).map((v, i) => v - y[i]);
    return y;
  }

  // Box-Cox : y = (x^λ − 1)/λ, log si λ = 0
  function boxcox(x, lambda) {
    if (lambda === null || lambda === undefined) return x.slice();
    if (Math.abs(lambda) < 1e-12) return x.map(Math.log);
    return x.map((v) => (Math.pow(v, lambda) - 1) / lambda);
  }
  function invBoxcox(y, lambda) {
    if (lambda === null || lambda === undefined) return y;
    const f = Math.abs(lambda) < 1e-12 ? Math.exp : (v) => Math.pow(Math.max(lambda * v + 1, 0), 1 / lambda);
    return Array.isArray(y) ? y.map(f) : f(y);
  }
  // λ par maximum de vraisemblance profilée (hypothèse gaussienne i.i.d. sur la série transformée).
  // Simple et rapide ; sur une série à forte tendance, la méthode de Guerrero (forecast::BoxCox.lambda)
  // est plus fiable car elle vise la stabilisation de la variance par segment.
  function boxcoxLambda(x, { lo = -1, hi = 2, step = 0.01 } = {}) {
    if (x.some((v) => v <= 0)) return null;
    const n = x.length, slog = sum(x.map(Math.log));
    let best = null, bestLL = -Infinity;
    for (let l = lo; l <= hi + 1e-9; l += step) {
      const lam = Math.round(l * 100) / 100;
      const y = boxcox(x, lam);
      const ll = -n / 2 * Math.log(variance(y)) + (lam - 1) * slog;
      if (ll > bestLL) { bestLL = ll; best = lam; }
    }
    return best;
  }

  // ------------------------------------------------------------------ Algèbre linéaire
  function invert(A) {
    const n = A.length;
    const M = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
    for (let c = 0; c < n; c++) {
      let piv = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      if (Math.abs(M[piv][c]) < 1e-14) return null;
      [M[c], M[piv]] = [M[piv], M[c]];
      const d = M[c][c];
      for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r][c];
        if (f !== 0) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j];
      }
    }
    return M.map((row) => row.slice(n));
  }

  // Moindres carrés ordinaires : X (n×k, lignes), y (n)
  function ols(X, y) {
    const n = X.length, k = X[0].length;
    const XtX = Array.from({ length: k }, () => new Array(k).fill(0));
    const Xty = new Array(k).fill(0);
    for (let i = 0; i < n; i++) {
      const r = X[i];
      for (let a = 0; a < k; a++) {
        Xty[a] += r[a] * y[i];
        for (let b = a; b < k; b++) XtX[a][b] += r[a] * r[b];
      }
    }
    for (let a = 0; a < k; a++) for (let b = 0; b < a; b++) XtX[a][b] = XtX[b][a];
    const inv = invert(XtX);
    if (!inv) return null;
    const beta = inv.map((row) => row.reduce((s, v, j) => s + v * Xty[j], 0));
    const resid = y.map((v, i) => v - X[i].reduce((s, x, j) => s + x * beta[j], 0));
    const rss = resid.reduce((s, e) => s + e * e, 0);
    const sigma2 = rss / (n - k);
    const se = inv.map((row, i) => Math.sqrt(row[i] * sigma2));
    return { beta, se, resid, rss, sigma2, n, k };
  }

  // ------------------------------------------------------------------ Distributions
  function erf(x) {
    // Abramowitz & Stegun 7.1.26 raffiné (erreur < 1.2e-7)
    const t = 1 / (1 + 0.5 * Math.abs(x));
    const y = 1 - t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
      t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? y : -y;
  }
  const normCdf = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
  const normPdf = (x) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);

  // Quantile gaussien (algorithme d'Acklam)
  function normInv(p) {
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const pl = 0.02425;
    if (p < pl) {
      const q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > 1 - pl) return -normInv(1 - p);
    const q = p - 0.5, r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  function lgamma(z) {
    const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * z))) - lgamma(1 - z);
    z -= 1;
    let x = c[0];
    for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
    const t = z + g + 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }

  // Fonction gamma incomplète régularisée P(a, x)
  function gammaP(a, x) {
    if (x <= 0) return 0;
    if (x < a + 1) {
      let ap = a, s = 1 / a, del = s;
      for (let n = 0; n < 500; n++) { ap += 1; del *= x / ap; s += del; if (Math.abs(del) < Math.abs(s) * 1e-15) break; }
      return s * Math.exp(-x + a * Math.log(x) - lgamma(a));
    }
    // fraction continue (Lentz)
    let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d;
    for (let i = 1; i < 500; i++) {
      const an = -i * (i - a); b += 2;
      d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d; const del = d * c; h *= del;
      if (Math.abs(del - 1) < 1e-15) break;
    }
    return 1 - Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
  }
  const chi2Cdf = (x, k) => gammaP(k / 2, x / 2);
  const chi2Sf = (x, k) => 1 - chi2Cdf(x, k);

  // ------------------------------------------------------------------ Autocorrélation
  function autocov(x, h, m = mean(x)) {
    const n = x.length; let s = 0;
    for (let t = 0; t < n - h; t++) s += (x[t] - m) * (x[t + h] - m);
    return s / n; // estimateur biaisé : garantit une matrice d'autocovariance définie positive
  }
  function acf(x, maxLag) {
    const m = mean(x), g0 = autocov(x, 0, m);
    const r = [1];
    for (let h = 1; h <= maxLag; h++) r.push(autocov(x, h, m) / g0);
    return r;
  }

  // Durbin-Levinson : à partir de r[0..K] renvoie PACF et coefficients de Yule-Walker d'ordre K
  function durbinLevinson(r, maxLag) {
    const pacf = [1];
    let phi = [];
    let v = r[0];
    for (let k = 1; k <= maxLag; k++) {
      let num = r[k];
      for (let j = 1; j < k; j++) num -= phi[j - 1] * r[k - j];
      const phikk = num / v;
      const next = new Array(k);
      for (let j = 1; j < k; j++) next[j - 1] = phi[j - 1] - phikk * phi[k - j - 1];
      next[k - 1] = phikk;
      phi = next;
      v *= 1 - phikk * phikk;
      pacf.push(phikk);
    }
    return { pacf, phi, innovationVar: v };
  }
  const pacf = (x, maxLag) => durbinLevinson(acf(x, maxLag), maxLag).pacf;

  // Bandes de Bartlett pour l'ACF : sous H0 "MA(k-1)", Var(r_k) ≈ (1 + 2 Σ_{j<k} r_j²)/n
  function bartlettBands(r, n, z = 1.959964) {
    const out = [0]; let s = 0;
    for (let k = 1; k < r.length; k++) { out.push(z * Math.sqrt((1 + 2 * s) / n)); s += r[k] * r[k]; }
    return out;
  }

  function ljungBox(resid, lags, dof = 0) {
    const n = resid.length, r = acf(resid, Math.max(...lags));
    return lags.map((L) => {
      let q = 0;
      for (let k = 1; k <= L; k++) q += (r[k] * r[k]) / (n - k);
      q *= n * (n + 2);
      const df = Math.max(L - dof, 1);
      return { lag: L, Q: q, df, pvalue: chi2Sf(q, df) };
    });
  }

  function jarqueBera(x) {
    const n = x.length, m = mean(x);
    let m2 = 0, m3 = 0, m4 = 0;
    for (const v of x) { const d = v - m; m2 += d * d; m3 += d ** 3; m4 += d ** 4; }
    m2 /= n; m3 /= n; m4 /= n;
    const S = m3 / m2 ** 1.5, K = m4 / (m2 * m2);
    const JB = (n / 6) * (S * S + ((K - 3) ** 2) / 4);
    return { JB, skew: S, kurtosis: K, pvalue: chi2Sf(JB, 2) };
  }

  // Périodogramme I(f_k) = |Σ x_t e^{-2iπ f_k t}|² / n, f_k = k/n
  function periodogram(x) {
    const n = x.length, m = mean(x), out = [];
    for (let k = 1; k <= Math.floor(n / 2); k++) {
      let re = 0, im = 0; const w = (2 * Math.PI * k) / n;
      for (let t = 0; t < n; t++) { re += (x[t] - m) * Math.cos(w * t); im -= (x[t] - m) * Math.sin(w * t); }
      out.push({ freq: k / n, period: n / k, power: (re * re + im * im) / n });
    }
    return out;
  }

  // ------------------------------------------------------------------ Tests de racine unitaire
  // p-valeurs approchées de MacKinnon (1994), mêmes coefficients que statsmodels (N = 1)
  const MK = {
    c: { star: -1.61, min: -18.83, max: 2.74, small: [2.1659, 1.4412, 0.038269], large: [1.7339, 0.93202, -0.12745, -0.010368] },
    ct: { star: -2.89, min: -16.18, max: 0.7, small: [3.2512, 1.6047, 0.049588], large: [2.5261, 0.61654, -0.37956, -0.060285] },
    n: { star: -1.04, min: -19.04, max: Infinity, small: [0.6344, 1.2378, 0.032496], large: [0.4797, 0.93557, -0.06999, 0.033066] },
  };
  function mackinnonP(stat, reg) {
    const k = MK[reg];
    if (stat > k.max) return 1;
    if (stat < k.min) return 0;
    const c = stat <= k.star ? k.small : k.large;
    return normCdf(c.reduce((s, v, i) => s + v * stat ** i, 0));
  }
  // Valeurs critiques : surfaces de réponse de MacKinnon (2010)
  const MK_CRIT = {
    n: { '1%': [-2.56574, -2.2358, -3.627], '5%': [-1.941, -0.2686, -3.365, 31.223], '10%': [-1.61682, 0.2656, -2.714, 25.364] },
    c: { '1%': [-3.43035, -6.5393, -16.786, -79.433], '5%': [-2.86154, -2.8903, -4.234, -40.04], '10%': [-2.56677, -1.5384, -2.809] },
    ct: { '1%': [-3.95877, -9.0531, -28.428, -134.155], '5%': [-3.41049, -4.3904, -9.036, -45.374], '10%': [-3.12705, -2.5856, -3.925, -22.38] },
  };
  function mackinnonCrit(reg, T) {
    const o = {};
    for (const [lvl, c] of Object.entries(MK_CRIT[reg])) o[lvl] = c.reduce((s, v, i) => s + v / T ** i, 0);
    return o;
  }

  /**
   * Dickey-Fuller augmenté :  Δy_t = α + β t + γ y_{t-1} + Σ_{i=1}^{p} δ_i Δy_{t-i} + u_t
   * H0 : γ = 0 (racine unitaire). Sélection de p par AIC sur échantillon commun (comme statsmodels).
   */
  function adf(x, { regression = 'c', maxlag = null, autolag = 'AIC' } = {}) {
    const n = x.length;
    if (maxlag === null) maxlag = Math.floor(12 * Math.pow(n / 100, 0.25));
    const nreg = regression === 'n' ? 0 : regression === 'c' ? 1 : 2;
    maxlag = Math.max(0, Math.min(maxlag, Math.floor(n / 2) - nreg - 1));
    const dx = diff(x);
    const build = (p, start) => {
      const X = [], y = [];
      for (let t = start; t < dx.length; t++) {
        const row = [x[t]];
        if (nreg >= 1) row.push(1);
        if (nreg === 2) row.push(t + 1);
        for (let i = 1; i <= p; i++) row.push(dx[t - i]);
        X.push(row); y.push(dx[t]);
      }
      return ols(X, y);
    };
    let usedlag = maxlag;
    if (autolag) {
      let best = Infinity;
      for (let p = 0; p <= maxlag; p++) {
        const f = build(p, maxlag);
        if (!f) continue;
        const aic = f.n * Math.log(f.rss / f.n) + 2 * f.k;
        if (aic < best) { best = aic; usedlag = p; }
      }
    }
    const fit = build(usedlag, usedlag);
    const stat = fit.beta[0] / fit.se[0];
    return {
      stat, pvalue: mackinnonP(stat, regression), usedlag, nobs: fit.n,
      crit: mackinnonCrit(regression, fit.n), gamma: fit.beta[0], regression,
    };
  }

  /**
   * KPSS : y_t = ξ t + r_t + ε_t, r_t marche aléatoire. H0 : stationnarité (Var du choc de r_t = 0).
   * η = Σ S_t² / (n² σ̂²_LR), σ̂²_LR estimée par Newey-West (noyau de Bartlett).
   */
  function kpss(x, { regression = 'c', nlags = null } = {}) {
    const n = x.length;
    let e;
    if (regression === 'c') { const m = mean(x); e = x.map((v) => v - m); }
    else { e = ols(x.map((_, t) => [1, t + 1]), x).resid; }
    if (nlags === null) nlags = Math.ceil(12 * Math.pow(n / 100, 0.25));
    nlags = Math.min(nlags, n - 1);
    let S = 0, eta = 0;
    for (const v of e) { S += v; eta += S * S; }
    eta /= n * n;
    let s2 = e.reduce((a, v) => a + v * v, 0);
    for (let l = 1; l <= nlags; l++) {
      let g = 0;
      for (let t = l; t < n; t++) g += e[t] * e[t - l];
      s2 += 2 * (1 - l / (nlags + 1)) * g;
    }
    s2 /= n;
    const stat = eta / s2;
    const table = regression === 'c'
      ? { pv: [0.1, 0.05, 0.025, 0.01], cv: [0.347, 0.463, 0.574, 0.739] }
      : { pv: [0.1, 0.05, 0.025, 0.01], cv: [0.119, 0.146, 0.176, 0.216] };
    let pvalue, bound = null;
    if (stat <= table.cv[0]) { pvalue = 0.1; bound = '>'; }
    else if (stat >= table.cv[3]) { pvalue = 0.01; bound = '<'; }
    else {
      for (let i = 0; i < 3; i++) if (stat <= table.cv[i + 1]) {
        const w = (stat - table.cv[i]) / (table.cv[i + 1] - table.cv[i]);
        pvalue = table.pv[i] + w * (table.pv[i + 1] - table.pv[i]); break;
      }
    }
    const crit = { '10%': table.cv[0], '5%': table.cv[1], '2.5%': table.cv[2], '1%': table.cv[3] };
    return { stat, pvalue, bound, nlags, crit, regression };
  }

  // Nombre de différences suggéré. On différencie tant que KPSS rejette la stationnarité (5 %,
  // fenêtre de Newey-West « courte » trunc(4 (n/100)^{1/4}) comme urca::ur.kpss) OU que l'ADF ne
  // rejette pas la racine unitaire (5 %). Plus prudent que forecast::ndiffs (KPSS seul) sur les
  // cas limites, au prix d'un risque de sur-différenciation d'une série trend-stationary.
  function ndiffs(x, max = 2) {
    let d = 0, y = x;
    const short = (n) => Math.trunc(4 * Math.pow(n / 100, 0.25));
    const needs = (v) => kpss(v, { nlags: short(v.length) }).pvalue < 0.05 || adf(v).pvalue > 0.05;
    while (d < max && y.length > 20 && needs(y)) { y = diff(y); d++; }
    return d;
  }

  // ------------------------------------------------------------------ Décomposition classique
  function centeredMA(x, m) {
    const n = x.length, out = new Array(n).fill(null);
    if (m % 2 === 1) {
      const k = (m - 1) / 2;
      for (let t = k; t < n - k; t++) { let s = 0; for (let j = -k; j <= k; j++) s += x[t + j]; out[t] = s / m; }
    } else {
      // 2×m-MA : poids 1/(2m) aux extrémités, 1/m ailleurs
      const k = m / 2;
      for (let t = k; t < n - k; t++) {
        let s = 0.5 * (x[t - k] + x[t + k]);
        for (let j = -k + 1; j <= k - 1; j++) s += x[t + j];
        out[t] = s / m;
      }
    }
    return out;
  }

  function decompose(x, period, type = 'additive') {
    const n = x.length, mult = type === 'multiplicative';
    const trend = centeredMA(x, period);
    const detr = x.map((v, t) => (trend[t] === null ? null : mult ? v / trend[t] : v - trend[t]));
    const idx = new Array(period).fill(0), cnt = new Array(period).fill(0);
    detr.forEach((v, t) => { if (v !== null) { idx[t % period] += v; cnt[t % period]++; } });
    let fig = idx.map((s, i) => s / cnt[i]);
    const avg = mean(fig);
    fig = fig.map((v) => (mult ? v / avg : v - avg));
    const seasonal = x.map((_, t) => fig[t % period]);
    const resid = x.map((v, t) => (trend[t] === null ? null : mult ? v / (trend[t] * seasonal[t]) : v - trend[t] - seasonal[t]));
    // Force de tendance et de saisonnalité (Wang, Smith & Hyndman 2006), calculées sur l'échelle additive
    const R = [], TR = [], SR = [];
    for (let t = 0; t < n; t++) if (resid[t] !== null) {
      const r = mult ? Math.log(resid[t]) : resid[t];
      const s = mult ? Math.log(seasonal[t]) : seasonal[t];
      const tr = mult ? Math.log(trend[t]) : trend[t];
      R.push(r); TR.push(tr + r); SR.push(s + r);
    }
    const vr = variance(R);
    return {
      trend, seasonal, resid, figure: fig, type,
      strengthTrend: Math.max(0, 1 - vr / variance(TR)),
      strengthSeason: Math.max(0, 1 - vr / variance(SR)),
    };
  }

  // Différenciation saisonnière suggérée (heuristique nsdiffs : force saisonnière > 0.64)
  function nsdiffs(x, period) {
    if (!period || period < 2 || x.length < 2 * period + 1) return 0;
    const y = x.every((v) => v > 0) ? x.map(Math.log) : x;
    return decompose(y, period).strengthSeason > 0.64 ? 1 : 0;
  }

  // ------------------------------------------------------------------ Polynômes
  function polyMul(a, b) {
    const out = new Array(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
    return out;
  }
  // Polynôme saisonnier : coefficients c aux retards s, 2s, …  (signe déjà inclus)
  function seasonalPoly(coefs, s, sign) {
    const out = new Array(coefs.length * s + 1).fill(0);
    out[0] = 1;
    coefs.forEach((c, i) => { out[(i + 1) * s] = sign * c; });
    return out;
  }
  const arPoly = (phi) => [1, ...phi.map((v) => -v)];
  const maPoly = (theta) => [1, ...theta];

  // Racines complexes (Durand-Kerner) du polynôme c0 + c1 z + … + cp z^p
  function polyRoots(c) {
    let coef = c.slice();
    while (coef.length > 1 && Math.abs(coef[coef.length - 1]) < 1e-12) coef.pop();
    const p = coef.length - 1;
    if (p < 1) return [];
    if (p === 1) return [{ re: -coef[0] / coef[1], im: 0 }];
    const lead = coef[p];
    const a = coef.map((v) => v / lead);
    const mul = (x, y) => ({ re: x.re * y.re - x.im * y.im, im: x.re * y.im + x.im * y.re });
    const div = (x, y) => { const d = y.re * y.re + y.im * y.im; return { re: (x.re * y.re + x.im * y.im) / d, im: (x.im * y.re - x.re * y.im) / d }; };
    const evalP = (z) => { let r = { re: 1, im: 0 }; for (let i = p - 1; i >= 0; i--) { r = mul(r, z); r.re += a[i]; } return r; };
    const bound = 1 + Math.max(...a.slice(0, p).map(Math.abs));
    let roots = Array.from({ length: p }, (_, k) => {
      const ang = (2 * Math.PI * k) / p + 0.4;
      return { re: bound * 0.9 * Math.cos(ang), im: bound * 0.9 * Math.sin(ang) };
    });
    for (let it = 0; it < 500; it++) {
      let delta = 0;
      roots = roots.map((z, i) => {
        let den = { re: 1, im: 0 };
        roots.forEach((w, j) => { if (i !== j) den = mul(den, { re: z.re - w.re, im: z.im - w.im }); });
        const step = div(evalP(z), den);
        delta = Math.max(delta, Math.hypot(step.re, step.im));
        return { re: z.re - step.re, im: z.im - step.im };
      });
      if (delta < 1e-13) break;
    }
    return roots.map((z) => ({ re: z.re, im: Math.abs(z.im) < 1e-9 ? 0 : z.im }));
  }
  const modulus = (z) => Math.hypot(z.re, z.im);

  // ------------------------------------------------------------------ Processus ARMA
  // ψ-poids : θ(B)/φ(B) = Σ ψ_j B^j   (ar, ma : polynômes complets [1, …])
  function psiWeights(ar, ma, n) {
    const psi = new Array(n).fill(0);
    for (let j = 0; j < n; j++) {
      let v = j < ma.length ? ma[j] : 0;
      for (let i = 1; i < ar.length && i <= j; i++) v -= ar[i] * psi[j - i];
      psi[j] = v;
    }
    return psi;
  }

  // ACF théorique : γ(h) = σ² Σ ψ_j ψ_{j+h} (troncature longue)
  function armaAcf(phi, theta, maxLag, trunc = 3000) {
    const psi = psiWeights(arPoly(phi), maPoly(theta), trunc + maxLag);
    const g = [];
    for (let h = 0; h <= maxLag; h++) { let s = 0; for (let j = 0; j < trunc; j++) s += psi[j] * psi[j + h]; g.push(s); }
    return g.map((v) => v / g[0]);
  }
  const armaPacf = (phi, theta, maxLag) => durbinLevinson(armaAcf(phi, theta, maxLag), maxLag).pacf;

  function simulateArma({ phi = [], theta = [], n = 200, sigma = 1, c = 0, seed = 1, burn = 300 }) {
    const g = gaussianRng(seed), N = n + burn;
    const x = new Array(N).fill(0), e = new Array(N).fill(0);
    for (let t = 0; t < N; t++) {
      e[t] = sigma * g();
      let v = c + e[t];
      for (let i = 0; i < phi.length; i++) if (t - i - 1 >= 0) v += phi[i] * x[t - i - 1];
      for (let j = 0; j < theta.length; j++) if (t - j - 1 >= 0) v += theta[j] * e[t - j - 1];
      x[t] = v;
    }
    return x.slice(burn);
  }

  function isStationary(phi) {
    if (!phi.length) return true;
    return polyRoots(arPoly(phi)).every((z) => modulus(z) > 1 + 1e-9);
  }
  function isInvertible(theta) {
    if (!theta.length) return true;
    return polyRoots(maPoly(theta)).every((z) => modulus(z) > 1 + 1e-9);
  }

  // Reparamétrisation de Jones (1980) / Monahan (1984) : u ∈ ℝ^p → AR stationnaire.
  // Autocorrélations partielles r_k = tanh(u_k) ∈ (−1, 1) puis récursion de Durbin-Levinson.
  function pacfToAr(u) {
    let phi = [];
    for (let k = 0; k < u.length; k++) {
      const r = Math.tanh(u[k]);
      const next = phi.map((v, j) => v - r * phi[k - 1 - j]);
      next.push(r);
      phi = next;
    }
    return phi;
  }

  // ------------------------------------------------------------------ Optimisation
  function nelderMead(f, x0, { maxIter = null, tol = 1e-9, step = 0.3 } = {}) {
    const n = x0.length;
    if (n === 0) return { x: [], fx: f([]), iter: 0 };
    maxIter = maxIter || 400 * n;
    let simplex = [x0.slice()];
    for (let i = 0; i < n; i++) { const p = x0.slice(); p[i] += p[i] !== 0 ? step * Math.max(1, Math.abs(p[i])) : step; simplex.push(p); }
    let vals = simplex.map(f);
    let iter = 0;
    for (; iter < maxIter; iter++) {
      const order = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]);
      simplex = order.map((i) => simplex[i]); vals = order.map((i) => vals[i]);
      if (Math.abs(vals[n] - vals[0]) <= tol * (Math.abs(vals[0]) + tol)) break;
      const cen = new Array(n).fill(0);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) cen[j] += simplex[i][j] / n;
      const pt = (a) => cen.map((c, j) => c + a * (simplex[n][j] - c));
      const xr = pt(-1), fr = f(xr);
      if (fr < vals[0]) {
        const xe = pt(-2), fe = f(xe);
        if (fe < fr) { simplex[n] = xe; vals[n] = fe; } else { simplex[n] = xr; vals[n] = fr; }
      } else if (fr < vals[n - 1]) { simplex[n] = xr; vals[n] = fr; }
      else {
        const xc = fr < vals[n] ? pt(-0.5) : pt(0.5), fc = f(xc);
        if (fc < Math.min(fr, vals[n])) { simplex[n] = xc; vals[n] = fc; }
        else {
          for (let i = 1; i <= n; i++) { simplex[i] = simplex[i].map((v, j) => simplex[0][j] + 0.5 * (v - simplex[0][j])); vals[i] = f(simplex[i]); }
        }
      }
    }
    const b = vals.indexOf(Math.min(...vals));
    return { x: simplex[b], fx: vals[b], iter };
  }

  function numericHessian(f, x) {
    const n = x.length, H = Array.from({ length: n }, () => new Array(n).fill(0));
    const h = x.map((v) => 1e-4 * Math.max(1, Math.abs(v)));
    const f0 = f(x);
    for (let i = 0; i < n; i++) for (let j = i; j < n; j++) {
      const e = (di, dj) => { const y = x.slice(); y[i] += di; y[j] += dj; return f(y); };
      let v;
      if (i === j) v = (e(h[i], 0) - 2 * f0 + e(-h[i], 0)) / (h[i] * h[i]);
      else v = (e(h[i], h[j]) - e(h[i], -h[j]) - e(-h[i], h[j]) + e(-h[i], -h[j])) / (4 * h[i] * h[j]);
      H[i][j] = H[j][i] = v;
    }
    return H;
  }

  const sigmoid = (u) => 1 / (1 + Math.exp(-u));
  const logit = (p) => Math.log(p / (1 - p));

  // ------------------------------------------------------------------ Lissage exponentiel (Holt-Winters)
  /**
   * Forme par composantes (Hyndman & Athanasopoulos, FPP3, ch. 8) :
   *   ŷ_{t|t-1} = (ℓ_{t-1} + φ b_{t-1}) ⊕ s_{t-m}
   *   ℓ_t = α (y_t ⊖ s_{t-m}) + (1−α)(ℓ_{t-1} + φ b_{t-1})
   *   b_t = β* (ℓ_t − ℓ_{t-1}) + (1−β*) φ b_{t-1}
   *   s_t = γ (y_t ⊖ (ℓ_{t-1} + φ b_{t-1})) + (1−γ) s_{t-m}
   * ⊕/⊖ = +/− (additif) ou ×/÷ (multiplicatif).
   */
  function etsRun(x, o) {
    const { trend = 'none', season = 'none', m = 1, alpha, beta = 0, gamma = 0, phi = 1 } = o;
    const n = x.length, hasT = trend !== 'none', hasS = season !== 'none', mul = season === 'mul';
    const ph = trend === 'damped' ? phi : 1;
    let l, b = 0;
    const S = [];
    if (hasS) {
      l = mean(x.slice(0, m));
      if (hasT) b = (mean(x.slice(m, 2 * m)) - l) / m;
      for (let i = 0; i < m; i++) S.push(mul ? x[i] / l : x[i] - l);
    } else {
      l = x[0];
      if (hasT) b = x[1] - x[0];
    }
    const fitted = [], level = [], slope = [], seas = [];
    let sse = 0;
    for (let t = 0; t < n; t++) {
      const s = hasS ? S[t] : mul ? 1 : 0;
      const base = l + ph * b;
      const yhat = mul ? base * s : base + s;
      fitted.push(yhat);
      const e = x[t] - yhat; sse += e * e;
      const lNew = alpha * (mul ? x[t] / s : x[t] - s) + (1 - alpha) * base;
      const bNew = hasT ? beta * (lNew - l) + (1 - beta) * ph * b : 0;
      if (hasS) S.push(gamma * (mul ? x[t] / base : x[t] - base) + (1 - gamma) * s);
      l = lNew; b = bNew;
      level.push(l); slope.push(b); seas.push(hasS ? S[t + m] : null);
    }
    const resid = x.map((v, t) => v - fitted[t]);
    const forecast = (h) => {
      const out = []; let cum = 0;
      for (let k = 1; k <= h; k++) {
        cum += Math.pow(ph, k);
        const base = l + (hasT ? cum * b : 0);
        const s = hasS ? S[n + ((k - 1) % m)] : mul ? 1 : 0;
        out.push(mul ? base * s : base + s);
      }
      return out;
    };
    return { fitted, resid, sse, level, slope, seasonal: seas, forecast, params: { ...o, phi: ph } };
  }

  function etsFit(x, { trend = 'none', season = 'none', m = 1, fixed = {} } = {}) {
    const hasT = trend !== 'none', hasS = season !== 'none', damp = trend === 'damped';
    const names = ['alpha'];
    if (hasT) names.push('beta');
    if (hasS) names.push('gamma');
    if (damp) names.push('phi');
    const decode = (u) => {
      const p = { alpha: 0.5, beta: 0, gamma: 0, phi: 1 };
      names.forEach((k, i) => { p[k] = sigmoid(u[i]); });
      p.alpha = 0.0001 + 0.9998 * p.alpha;
      if (hasT) p.beta = 0.0001 + 0.9998 * p.beta;
      if (hasS) p.gamma = (1 - p.alpha) * p.gamma; // contrainte admissible 0 ≤ γ ≤ 1−α
      if (damp) p.phi = 0.8 + 0.18 * p.phi;
      return p;
    };
    const f = (u) => { const r = etsRun(x, { trend, season, m, ...decode(u) }); return isFinite(r.sse) ? r.sse : 1e300; };
    const init = names.map((k) => (k === 'alpha' ? logit(0.3) : k === 'beta' ? logit(0.1) : k === 'gamma' ? logit(0.1) : 0));
    let best = nelderMead(f, init, { maxIter: 3000 });
    // redémarrage depuis l'optimum : Nelder-Mead s'arrête parfois prématurément
    best = nelderMead(f, best.x, { maxIter: 3000, step: 0.1 });
    const p = decode(best.x);
    return etsModel(x, { trend, season, m, ...p });
  }

  function etsModel(x, o) {
    const run = etsRun(x, o);
    const { trend, season, m } = o, hasS = season !== 'none';
    const n = x.length;
    const k = 1 + (trend !== 'none' ? 1 : 0) + (hasS ? 1 : 0) + (trend === 'damped' ? 1 : 0) + 1 + (trend !== 'none' ? 1 : 0) + (hasS ? m - 1 : 0);
    const sigma2 = run.sse / n;
    const ll = -0.5 * n * (Math.log(2 * Math.PI * sigma2) + 1);
    const aic = -2 * ll + 2 * k;
    const ph = run.params.phi;
    // Intervalles : forme à correction d'erreur, c_j = α + αβ*(φ+…+φ^j) + γ·1{j ≡ 0 mod m}
    // Exact pour les modèles additifs, approximation pour la saisonnalité multiplicative.
    const intervals = (h, level = 0.95) => {
      const z = normInv(0.5 + level / 2), fc = run.forecast(h), sig = Math.sqrt(run.sse / (n - 1));
      const lo = [], hi = []; let acc = 0, cum = 0;
      for (let k2 = 1; k2 <= h; k2++) {
        const sd = sig * Math.sqrt(1 + acc);
        const scale = season === 'mul' ? fc[k2 - 1] / Math.max(1e-9, run.level[n - 1]) : 1;
        lo.push(fc[k2 - 1] - z * sd * scale); hi.push(fc[k2 - 1] + z * sd * scale);
        cum += Math.pow(ph, k2);
        const c = run.params.alpha + (trend !== 'none' ? run.params.alpha * run.params.beta * cum : 0) +
          (hasS && k2 % m === 0 ? run.params.gamma : 0);
        acc += c * c;
      }
      return { mean: fc, lo, hi };
    };
    return { ...run, sigma2, loglik: ll, aic, k, intervals };
  }

  // ------------------------------------------------------------------ SARIMA (moindres carrés conditionnels)
  function sarimaResiduals(w, mu, ar, ma) {
    const n = w.length, P = ar.length - 1, Q = ma.length - 1;
    const e = new Array(n).fill(0);
    let css = 0;
    for (let t = P; t < n; t++) {
      let v = 0;
      for (let i = 0; i <= P; i++) v += ar[i] * (w[t - i] - mu);
      for (let j = 1; j <= Q; j++) if (t - j >= 0) v -= ma[j] * e[t - j];
      e[t] = v; css += v * v;
    }
    return { e, css, nEff: n - P };
  }

  function buildPolys(c, o) {
    const { p, q, P, Q, s } = o;
    const phi = c.slice(0, p), theta = c.slice(p, p + q);
    const Phi = c.slice(p + q, p + q + P), Theta = c.slice(p + q + P, p + q + P + Q);
    const ar = polyMul(arPoly(phi), seasonalPoly(Phi, s, -1));
    const ma = polyMul(maPoly(theta), seasonalPoly(Theta, s, 1));
    return { phi, theta, Phi, Theta, ar, ma };
  }

  function differencePoly(d, D, s) {
    let poly = [1];
    for (let i = 0; i < d; i++) poly = polyMul(poly, [1, -1]);
    for (let i = 0; i < D; i++) poly = polyMul(poly, seasonalPoly([1], s, -1));
    return poly;
  }

  /**
   * SARIMA(p,d,q)(P,D,Q)_s par CSS.
   * Paramétrisation contrainte : chaque bloc (φ, θ, Φ, Θ) passe par pacfToAr → stationnarité et
   * inversibilité garanties pendant l'optimisation. Erreurs-types : Hessien numérique de
   * −log L concentrée, calculé dans l'espace des coefficients d'origine.
   */
  function sarimaFit(y, { p = 0, d = 0, q = 0, P = 0, D = 0, Q = 0, s = 1, lambda = null, includeMean = null } = {}) {
    if (!(s > 1)) { P = 0; D = 0; Q = 0; s = 1; }
    const yt = boxcox(y, lambda);
    let w = diff(yt, 1, d);
    if (D > 0) w = diff(w, s, D);
    const withMean = includeMean === null ? d + D === 0 : includeMean;
    const o = { p, q, P, Q, s };
    const nc = p + q + P + Q;
    const scale = std(w) || 1;
    const decode = (u) => {
      const blocks = [[0, p, 1], [p, q, -1], [p + q, P, 1], [p + q + P, Q, -1]];
      const c = [];
      for (const [st, len, sg] of blocks) c.push(...pacfToAr(u.slice(st, st + len)).map((v) => sg * v));
      const mu = withMean ? u[nc] * scale : 0;
      return { c, mu };
    };
    const minNeeded = (p + P * s) + 5;
    if (w.length < minNeeded) throw new Error(`Série trop courte pour ces ordres (n après différenciation = ${w.length}).`);
    const obj = (u) => {
      const { c, mu } = decode(u);
      const { ar, ma } = buildPolys(c, o);
      const r = sarimaResiduals(w, mu, ar, ma);
      return r.nEff / 2 * Math.log(r.css / r.nEff);
    };
    const u0 = new Array(nc).fill(0);
    if (withMean) u0.push(mean(w) / scale);
    let opt = nelderMead(obj, u0, { maxIter: 600 * Math.max(1, u0.length) });
    opt = nelderMead(obj, opt.x, { maxIter: 600 * Math.max(1, u0.length), step: 0.05 });
    const { c, mu } = decode(opt.x);
    const polys = buildPolys(c, o);
    const res = sarimaResiduals(w, mu, polys.ar, polys.ma);
    const sigma2 = res.css / res.nEff;
    const k = nc + (withMean ? 1 : 0) + 1;
    const nEff = res.nEff;
    const loglik = -nEff / 2 * (Math.log(2 * Math.PI * sigma2) + 1);
    const aic = -2 * loglik + 2 * k;
    const aicc = aic + (2 * k * (k + 1)) / Math.max(1, nEff - k - 1);
    const bic = -2 * loglik + k * Math.log(nEff);

    // Erreurs-types (espace des coefficients)
    const theta0 = withMean ? [...c, mu] : c.slice();
    const f2 = (v) => {
      const pol = buildPolys(v.slice(0, nc), o);
      const r = sarimaResiduals(w, withMean ? v[nc] : 0, pol.ar, pol.ma);
      return r.nEff / 2 * Math.log(r.css / r.nEff);
    };
    let se = theta0.map(() => NaN);
    if (theta0.length) {
      const inv = invert(numericHessian(f2, theta0));
      if (inv) se = inv.map((row, i) => (row[i] > 0 ? Math.sqrt(row[i]) : NaN));
    }
    const names = [
      ...Array.from({ length: p }, (_, i) => `ar${i + 1}`), ...Array.from({ length: q }, (_, i) => `ma${i + 1}`),
      ...Array.from({ length: P }, (_, i) => `sar${(i + 1) * s}`), ...Array.from({ length: Q }, (_, i) => `sma${(i + 1) * s}`),
      ...(withMean ? ['mu'] : []),
    ];
    const coefs = names.map((nm, i) => {
      const z = theta0[i] / se[i];
      return { name: nm, value: theta0[i], se: se[i], z, pvalue: isFinite(z) ? 2 * (1 - normCdf(Math.abs(z))) : NaN };
    });

    // Alignement des résidus sur l'échelle de y
    const off = d + D * s, Pord = polys.ar.length - 1;
    const residY = new Array(y.length).fill(null);
    for (let t = Pord; t < w.length; t++) residY[t + off] = res.e[t];
    const fullAr = polyMul(polys.ar, differencePoly(d, D, s));
    const fittedT = yt.map((v, t) => (residY[t] === null ? null : v - residY[t]));
    const fitted = fittedT.map((v) => (v === null ? null : invBoxcox(v, lambda)));

    const forecast = (h, level = 0.95) => {
      const z = yt.map((v) => v - mu);
      const eAll = residY.map((v) => (v === null ? 0 : v));
      const L = fullAr.length - 1, Qm = polys.ma.length - 1;
      const n = z.length;
      for (let k2 = 0; k2 < h; k2++) {
        const t = n + k2;
        let v = 0;
        for (let i = 1; i <= L; i++) v -= fullAr[i] * z[t - i];
        for (let j = 1; j <= Qm; j++) v += polys.ma[j] * (t - j < n ? eAll[t - j] : 0);
        z.push(v);
      }
      const meanT = z.slice(n).map((v) => v + mu);
      const psi = psiWeights(fullAr, polys.ma, h);
      const zq = normInv(0.5 + level / 2);
      let acc = 0;
      const lo = [], hi = [], sd = [];
      for (let k2 = 0; k2 < h; k2++) {
        acc += psi[k2] * psi[k2];
        const sdk = Math.sqrt(sigma2 * acc);
        sd.push(sdk); lo.push(meanT[k2] - zq * sdk); hi.push(meanT[k2] + zq * sdk);
      }
      return { mean: invBoxcox(meanT, lambda), lo: invBoxcox(lo, lambda), hi: invBoxcox(hi, lambda), sd, psi };
    };

    return {
      order: { p, d, q, P, D, Q, s }, lambda, withMean, coefs, mu, sigma2, loglik, aic, aicc, bic, k, nEff,
      phi: polys.phi, theta: polys.theta, Phi: polys.Phi, Theta: polys.Theta, arPoly: polys.ar, maPoly: polys.ma, fullAr,
      resid: res.e.slice(Pord), residY, fitted, forecast, w,
    };
  }

  function orderLabel(o) {
    const base = `ARIMA(${o.p},${o.d},${o.q})`;
    return o.s > 1 && (o.P || o.D || o.Q) ? `S${base}(${o.P},${o.D},${o.Q})${o.s}` : base;
  }

  // Recherche en grille par AICc (d et D fixés : l'AIC n'est comparable qu'à différenciation égale)
  function autoSarima(y, { d, D, s = 1, lambda = null, maxp = 2, maxq = 2, maxP = 1, maxQ = 1, onProgress = null } = {}) {
    const seasonal = s > 1;
    const cands = [];
    for (let p = 0; p <= maxp; p++) for (let q = 0; q <= maxq; q++)
      for (let P = 0; P <= (seasonal ? maxP : 0); P++) for (let Q = 0; Q <= (seasonal ? maxQ : 0); Q++)
        cands.push({ p, d, q, P, D: seasonal ? D : 0, Q, s });
    const results = [];
    cands.forEach((o, i) => {
      try { results.push(sarimaFit(y, { ...o, lambda })); } catch (err) { /* ordre non estimable */ }
      if (onProgress) onProgress(i + 1, cands.length);
    });
    results.sort((a, b) => a.aicc - b.aicc);
    return results;
  }

  // ------------------------------------------------------------------ Prévisions de référence & métriques
  const baselines = {
    naive: (x, h) => new Array(h).fill(x[x.length - 1]),
    snaive: (x, h, m) => Array.from({ length: h }, (_, k) => x[x.length - m + (k % m)]),
    drift: (x, h) => { const n = x.length, sl = (x[n - 1] - x[0]) / (n - 1); return Array.from({ length: h }, (_, k) => x[n - 1] + sl * (k + 1)); },
    mean: (x, h) => new Array(h).fill(mean(x)),
  };

  function metrics(actual, pred, train = null, m = 1) {
    const n = actual.length;
    let ae = 0, se = 0, ape = 0, sape = 0;
    for (let i = 0; i < n; i++) {
      const e = actual[i] - pred[i];
      ae += Math.abs(e); se += e * e;
      ape += Math.abs(e / actual[i]);
      sape += (2 * Math.abs(e)) / (Math.abs(actual[i]) + Math.abs(pred[i]));
    }
    const out = { MAE: ae / n, RMSE: Math.sqrt(se / n), MAPE: (100 * ape) / n, sMAPE: (100 * sape) / n };
    if (train && train.length > m) {
      let s = 0;
      for (let t = m; t < train.length; t++) s += Math.abs(train[t] - train[t - m]);
      out.MASE = out.MAE / (s / (train.length - m));
    }
    return out;
  }

  // Validation croisée à origine glissante : moyenne des erreurs par horizon
  function rollingOrigin(x, forecaster, { h = 12, minTrain = 48, step = 1 } = {}) {
    const errs = Array.from({ length: h }, () => []);
    for (let T = minTrain; T + 1 <= x.length; T += step) {
      const H = Math.min(h, x.length - T);
      const fc = forecaster(x.slice(0, T), H);
      for (let k = 0; k < H; k++) errs[k].push(Math.abs(x[T + k] - fc[k]));
    }
    return errs.map((e) => (e.length ? mean(e) : NaN));
  }

  // ------------------------------------------------------------------ Compléments du cours M2 GRAF
  /**
   * Lissage exponentiel double (Brown). Droite ajustée localement, prévision x̂_{n,h} = â1(n) + â2(n) h.
   * Mise à jour à correction d'erreur, e_n = x_n − x̂_{n−1,1} :
   *   â1(n) = â1(n−1) + â2(n−1) + α(2−α) e_n,   â2(n) = â2(n−1) + α² e_n,
   * initialisation â1(0) = x1, â2(0) = x2 − x1. Équivaut à Holt avec α_H = α(2−α) et β_H = α/(2−α).
   */
  function brownDouble(x, alpha) {
    let a1 = x[0], a2 = x[1] - x[0];
    const fitted = [], A1 = [], A2 = [];
    let sse = 0;
    for (let t = 0; t < x.length; t++) {
      const f = a1 + a2; fitted.push(f);
      const e = x[t] - f; sse += e * e;
      a1 = a1 + a2 + alpha * (2 - alpha) * e;
      a2 = a2 + alpha * alpha * e;
      A1.push(a1); A2.push(a2);
    }
    return { fitted, a1: A1, a2: A2, sse, forecast: (h) => Array.from({ length: h }, (_, k) => a1 + a2 * (k + 1)) };
  }

  // Lissage exponentiel simple du cours : x̂_{n,h} = α x_n + (1−α) x̂_{n−1,h}, initialisé à x̂_{1,h} = x1
  function sesCourse(x, alpha) {
    let l = x[0];
    const fitted = [x[0]];
    for (let t = 1; t < x.length; t++) { fitted.push(l); l = alpha * x[t] + (1 - alpha) * l; }
    return { fitted, level: l, forecast: (h) => new Array(h).fill(l) };
  }

  // Moyenne mobile du cours : fenêtre 2q+1, bords répliqués (x_t = x_1 si t < 1, x_t = x_n si t > n)
  function movingAverageCourse(x, q) {
    const n = x.length;
    return x.map((_, t) => { let s = 0; for (let k = -q; k <= q; k++) s += x[Math.min(n - 1, Math.max(0, t + k))]; return s / (2 * q + 1); });
  }

  // Tendance linéaire par les formules explicites du cours (t = 1..n)
  function linearTrendCourse(x) {
    const n = x.length, xb = mean(x);
    let stx = 0; for (let t = 1; t <= n; t++) stx += t * x[t - 1];
    const a = (6 / (n * (n - 1))) * (((2 * n + 1) / 3) * n * xb - stx);
    const b = (12 / (n * (n * n - 1))) * (stx - ((n + 1) / 2) * n * xb);
    return { a, b, trend: x.map((_, t) => a + b * (t + 1)) };
  }

  // Autocovariance « du cours » : normalisation 1/(n−h) (R et l'atelier utilisent 1/n)
  function autocovCourse(x, h) {
    const n = x.length, m = mean(x); let s = 0;
    for (let t = 0; t < n - h; t++) s += (x[t] - m) * (x[t + h] - m);
    return s / (n - h);
  }

  function boxPierce(x, H, dof = 0) {
    const n = x.length, r = acf(x, H);
    let q = 0; for (let k = 1; k <= H; k++) q += r[k] * r[k];
    q *= n;
    return { Q: q, df: H - dof, pvalue: chi2Sf(q, Math.max(1, H - dof)) };
  }

  // AR(p) par Yule-Walker ; ordre choisi par AIC si p = null (comme ar(aic = TRUE) de R)
  function arYuleWalker(x, p = null, maxOrder = null) {
    const n = x.length, m = mean(x), xc = x.map((v) => v - m);
    if (p === null) {
      const K = maxOrder ?? Math.min(n - 1, Math.floor(10 * Math.log10(n)));
      const r = acf(xc, K), g0 = variance(xc);
      let best = 0, bestAic = n * Math.log(g0), aics = [bestAic];
      for (let k = 1; k <= K; k++) {
        const dl = durbinLevinson(r, k);
        const aic = n * Math.log(g0 * dl.innovationVar) + 2 * k;
        aics.push(aic);
        if (aic < bestAic) { bestAic = aic; best = k; }
      }
      const fit = arYuleWalker(x, best);
      return { ...fit, aics };
    }
    if (p === 0) return { order: 0, coef: [], sigma2: variance(xc), mean: m };
    const r = acf(xc, p), dl = durbinLevinson(r, p);
    return { order: p, coef: dl.phi, sigma2: variance(xc) * dl.innovationVar * n / (n - p - 1), mean: m };
  }
  function arForecast(x, fit, h) {
    const z = x.map((v) => v - fit.mean);
    for (let k = 0; k < h; k++) { let v = 0; fit.coef.forEach((a, j) => { v += a * z[z.length - 1 - j]; }); z.push(v); }
    return z.slice(x.length).map((v) => v + fit.mean);
  }

  /**
   * GARCH(p, q) au sens du cours : X_t = ε_t, ε_t | passé ~ N(0, σ_t²),
   * σ_t² = α0 + Σ_{i≤p} α_i X²_{t−i} + Σ_{j≤q} β_j σ²_{t−j}.   ARCH(p) = GARCH(p, 0).
   */
  function simulateGarch({ alpha0, alpha = [], beta = [], n = 1000, seed = 1, burn = 500 }) {
    const g = gaussianRng(seed), N = n + burn;
    const persist = alpha.reduce((a, b) => a + b, 0) + beta.reduce((a, b) => a + b, 0);
    const v0 = persist < 1 ? alpha0 / (1 - persist) : alpha0;
    const x = new Array(N).fill(0), s2 = new Array(N).fill(v0);
    for (let t = 0; t < N; t++) {
      let v = alpha0;
      alpha.forEach((a, i) => { v += a * (t - i - 1 >= 0 ? x[t - i - 1] ** 2 : v0); });
      beta.forEach((b, j) => { v += b * (t - j - 1 >= 0 ? s2[t - j - 1] : v0); });
      s2[t] = v; x[t] = Math.sqrt(v) * g();
    }
    return { x: x.slice(burn), sigma2: s2.slice(burn) };
  }

  function garchFilter(x, alpha0, alpha, beta) {
    const n = x.length, v0 = variance(x);
    const s2 = new Array(n);
    let ll = 0;
    for (let t = 0; t < n; t++) {
      let v = alpha0;
      alpha.forEach((a, i) => { v += a * (t - i - 1 >= 0 ? x[t - i - 1] ** 2 : v0); });
      beta.forEach((b, j) => { v += b * (t - j - 1 >= 0 ? s2[t - j - 1] : v0); });
      s2[t] = v;
      ll += -0.5 * (Math.log(2 * Math.PI) + Math.log(v) + (x[t] * x[t]) / v);
    }
    return { sigma2: s2, loglik: ll };
  }

  // Estimation par maximum de vraisemblance gaussien (Nelder-Mead, contraintes α0 > 0, α_i, β_j ≥ 0, Σ < 1)
  function garchFit(x, p = 1, q = 1) {
    const k = 1 + p + q;
    const v0 = variance(x);
    const decode = (u) => {
      const w = u.slice(1).map(Math.exp), tot = 1 + w.reduce((a, b) => a + b, 0);
      const shares = w.map((v) => v / tot);                 // Σ parts < 1 : stationnarité au second ordre
      return { alpha0: Math.exp(u[0]), alpha: shares.slice(0, p), beta: shares.slice(p) };
    };
    const f = (u) => { const d = decode(u); const r = garchFilter(x, d.alpha0, d.alpha, d.beta); return isFinite(r.loglik) ? -r.loglik : 1e300; };
    const init = [Math.log(v0 * 0.1), ...new Array(p).fill(Math.log(0.15 / Math.max(1, p) * 4)), ...new Array(q).fill(Math.log(0.7 / Math.max(1, q) * 4))];
    let opt = nelderMead(f, init, { maxIter: 4000 });
    opt = nelderMead(f, opt.x, { maxIter: 4000, step: 0.1 });
    const d = decode(opt.x);
    const theta = [d.alpha0, ...d.alpha, ...d.beta];
    const nll = (th) => { if (th.some((v) => v < 0)) return 1e300; const r = garchFilter(x, th[0], th.slice(1, 1 + p), th.slice(1 + p)); return -r.loglik; };
    let se = theta.map(() => NaN);
    const inv = invert(numericHessian(nll, theta));
    if (inv) se = inv.map((row, i) => (row[i] > 0 ? Math.sqrt(row[i]) : NaN));
    const filt = garchFilter(x, d.alpha0, d.alpha, d.beta);
    const names = ['a0', ...d.alpha.map((_, i) => `a${i + 1}`), ...d.beta.map((_, j) => `b${j + 1}`)];
    const persist = [...d.alpha, ...d.beta].reduce((a, b) => a + b, 0);
    const forecastVar = (h) => {
      // E[σ²_{n+h}] : on remplace X² futurs par leur espérance σ² futurs
      const s = filt.sigma2.slice(), xx = x.map((v) => v * v), n = x.length, out = [];
      for (let t = n; t < n + h; t++) {
        let v = d.alpha0;
        d.alpha.forEach((a, i) => { v += a * xx[t - i - 1]; });
        d.beta.forEach((b, j) => { v += b * s[t - j - 1]; });
        s.push(v); xx.push(v); out.push(v);
      }
      return out;
    };
    return {
      p, q, alpha0: d.alpha0, alpha: d.alpha, beta: d.beta, loglik: filt.loglik, aic: -2 * filt.loglik + 2 * k,
      sigma2: filt.sigma2, persistence: persist, uncondVar: persist < 1 ? d.alpha0 / (1 - persist) : Infinity,
      coefs: names.map((nm, i) => ({ name: nm, value: theta[i], se: se[i], z: theta[i] / se[i], pvalue: 2 * (1 - normCdf(Math.abs(theta[i] / se[i]))) })),
      stdResid: x.map((v, t) => v / Math.sqrt(filt.sigma2[t])), forecastVar,
    };
  }

  /**
   * Holt-Winters exactement comme stats::HoltWinters de R (formules du cours §3.3) :
   *   â1(n) = α(x_n − ŝ_{n−T}) + (1−α)(â1(n−1) + â2(n−1))      (÷ au lieu de − en multiplicatif)
   *   â2(n) = β(â1(n) − â1(n−1)) + (1−β) â2(n−1)
   *   ŝ_n   = γ(x_n − â1(n)) + (1−γ) ŝ_{n−T}                       (÷ en multiplicatif)
   * Initialisation de R : LES → â1 = x1 (départ t = 2) ; tendance → â1 = x2, â2 = x2 − x1 (départ t = 3) ;
   * saison → décomposition par moyenne mobile des 2 premières périodes, droite sur la tendance (départ t = T+1).
   * beta / gamma = false désactivent la composante, comme dans R.
   */
  function hwR(x, { alpha, beta = false, gamma = false, seasonal = 'additive', f = 1 }) {
    const doT = beta !== false, doS = gamma !== false, mul = seasonal === 'multiplicative';
    const b = doT ? beta : 0, g = doS ? gamma : 0;
    let l, tr = 0, S = [], start;
    if (doS) {
      const dcp = decompose(x.slice(0, 2 * f), f, mul ? 'multiplicative' : 'additive');
      const tt = dcp.trend.map((v, i) => [i, v]).filter((p) => p[1] !== null);
      const fit = ols(tt.map((_, k) => [1, k + 1]), tt.map((p) => p[1]));
      l = fit.beta[0]; tr = doT ? fit.beta[1] : 0; S = dcp.figure.slice(); start = f;
    } else if (doT) { l = x[1]; tr = x[1] - x[0]; start = 2; }
    else { l = x[0]; start = 1; }
    const level = [], trend = [], season = [], fitted = new Array(x.length).fill(null);
    let sse = 0;
    for (let i = start; i < x.length; i++) {
      const sPrev = doS ? S[S.length - f] : (mul ? 1 : 0);
      let xhat = l + (doT ? tr : 0);
      xhat = doS ? (mul ? xhat * sPrev : xhat + sPrev) : xhat;
      fitted[i] = xhat;
      const e = x[i] - xhat; sse += e * e;
      const lNew = alpha * (doS ? (mul ? x[i] / sPrev : x[i] - sPrev) : x[i]) + (1 - alpha) * (l + (doT ? tr : 0));
      if (doT) tr = b * (lNew - l) + (1 - b) * tr;
      l = lNew;
      if (doS) S.push(g * (mul ? x[i] / l : x[i] - l) + (1 - g) * sPrev);
      level.push(l); trend.push(tr); season.push(doS ? S[S.length - 1] : null);
    }
    const resid = fitted.map((v, i) => (v === null ? null : x[i] - v)).filter((v) => v !== null);
    const lastS = doS ? S.slice(-f) : null;
    const predict = (h, level95 = true) => {
      const mean = [], lo = [], hi = [];
      const v = variance(resid, 1), z = 1.959964;
      let acc = 0;
      const psi = (j) => alpha * (1 + j * b) + (doS && j % f === 0 ? g * (1 - alpha) : 0);
      // vecteur de coefficients de R (indices à partir de 1) : a, [b], s1..sT
      const coef = [null, l, ...(doT ? [tr] : []), ...(doS ? lastS : [])];
      for (let k = 1; k <= h; k++) {
        let m = l + (doT ? k * tr : 0);
        if (doS) m = mul ? m * lastS[(k - 1) % f] : m + lastS[(k - 1) % f];
        mean.push(m);
        let fac;
        if (doS && mul) {
          // formule de predict.HoltWinters pour le multiplicatif, reproduite telle quelle
          const rel = 1 + ((k - 1) % f);
          fac = 0;
          for (let j = 0; j <= k - 1; j++) { const q = psi(j) * coef[2 + rel] / coef[2 + (((rel - j) % f) + f) % f]; fac += q * q; }
        } else {
          if (k > 1) acc += psi(k - 1) ** 2;
          fac = 1 + acc;
        }
        const sd = Math.sqrt(v * fac);
        if (level95) { lo.push(m - z * sd); hi.push(m + z * sd); }
      }
      return { mean, lo, hi };
    };
    return { alpha, beta: doT ? b : false, gamma: doS ? g : false, seasonal, f, sse, fitted, level, trend, season, resid, start, predict, a1: l, a2: tr, s: lastS };
  }

  // Estimation des constantes comme R : minimisation de la SSE à un pas (point de départ 0,3 / 0,1 / 0,1)
  function hwRFit(x, { beta = true, gamma = true, seasonal = 'additive', f = 1, alpha = null } = {}) {
    const doT = beta !== false, doS = gamma !== false && f > 1;
    const free = [];
    if (alpha === null) free.push('alpha');
    if (doT && beta === true) free.push('beta');
    if (doS && gamma === true) free.push('gamma');
    const fixed = { alpha, beta: doT ? (beta === true ? null : beta) : false, gamma: doS ? (gamma === true ? null : gamma) : false };
    const build = (u) => {
      const p = { ...fixed };
      free.forEach((k, i) => { p[k] = 1 / (1 + Math.exp(-u[i])); });
      return p;
    };
    const f0 = (u) => { const p = build(u); const r = hwR(x, { ...p, seasonal, f }); return isFinite(r.sse) ? r.sse : 1e300; };
    // plusieurs départs (dont celui de R : 0,3 / 0,1 / 0,1) : la SSE est souvent plate près des bornes
    const starts = [[0.3, 0.1, 0.1], [0.7, 0.02, 0.3], [0.95, 0.005, 0.6], [0.1, 0.05, 0.05]];
    let best = null;
    for (const st of starts) {
      const init = free.map((k) => logit(k === 'alpha' ? st[0] : k === 'beta' ? st[1] : st[2]));
      let opt = nelderMead(f0, init, { maxIter: 3000 });
      opt = nelderMead(f0, opt.x, { maxIter: 3000, step: 0.2 });
      if (!best || opt.fx < best.fx) best = opt;
    }
    return hwR(x, { ...build(best.x), seasonal, f });
  }

  const TS = {
    hwR, hwRFit,
    brownDouble, sesCourse, movingAverageCourse, linearTrendCourse, autocovCourse, boxPierce, arYuleWalker, arForecast,
    simulateGarch, garchFilter, garchFit,
    mulberry32, gaussianRng, sum, mean, variance, std, quantile, rolling, diff, boxcox, invBoxcox, boxcoxLambda,
    invert, ols, erf, normCdf, normPdf, normInv, lgamma, gammaP, chi2Cdf, chi2Sf,
    autocov, acf, pacf, durbinLevinson, bartlettBands, ljungBox, jarqueBera, periodogram,
    adf, kpss, mackinnonP, mackinnonCrit, ndiffs, nsdiffs, centeredMA, decompose,
    polyMul, seasonalPoly, arPoly, maPoly, polyRoots, modulus, psiWeights, armaAcf, armaPacf, simulateArma,
    isStationary, isInvertible, pacfToAr, nelderMead, numericHessian,
    etsRun, etsFit, etsModel, sarimaFit, autoSarima, orderLabel, differencePoly,
    baselines, metrics, rollingOrigin,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = TS;
  else root.TS = TS;
})(typeof window !== 'undefined' ? window : this);
