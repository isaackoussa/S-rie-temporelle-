// Tests du moteur numérique : `node --test tests/`
const test = require('node:test');
const assert = require('node:assert/strict');
const TS = require('../js/stats.js');
const { AIR, DATASETS } = require('../js/data.js');

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} attendu ${b}, obtenu ${a}`);

test('distributions', () => {
  close(TS.normCdf(1.959964), 0.975, 1e-6);
  close(TS.normInv(0.975), 1.959964, 1e-5);
  close(TS.chi2Cdf(3.841459, 1), 0.95, 1e-6);
  close(TS.chi2Cdf(18.307038, 10), 0.95, 1e-6);
  close(TS.chi2Sf(5.991465, 2), 0.05, 1e-6);
});

test('ACF / PACF d’un AR(1) simulé', () => {
  const x = TS.simulateArma({ phi: [0.7], n: 5000, seed: 42 });
  const r = TS.acf(x, 3);
  close(r[1], 0.7, 0.03, 'r1');
  close(r[2], 0.49, 0.04, 'r2');
  const p = TS.pacf(x, 3);
  close(p[1], 0.7, 0.03, 'pacf1');
  close(p[2], 0, 0.04, 'pacf2');
});

test('ACF théorique ARMA', () => {
  const r = TS.armaAcf([0.5], [], 3);
  close(r[1], 0.5, 1e-9); close(r[3], 0.125, 1e-9);
  const m = TS.armaAcf([], [0.6], 2); // MA(1) : ρ1 = θ/(1+θ²)
  close(m[1], 0.6 / 1.36, 1e-9); close(m[2], 0, 1e-12);
  const pa = TS.armaPacf([0.5, 0.3], [], 3);
  close(pa[2], 0.3, 1e-9); close(pa[3], 0, 1e-9);
});

test('racines et stationnarité', () => {
  const r = TS.polyRoots([1, -0.5]); // 1 − 0.5 z → z = 2
  close(r[0].re, 2, 1e-9);
  assert.equal(TS.isStationary([0.5, 0.3]), true);
  assert.equal(TS.isStationary([0.5, 0.6]), false);
  assert.equal(TS.isStationary([1]), false);
  assert.equal(TS.isInvertible([0.5]), true);
  const rr = TS.polyRoots([1, -1.2, 0.8]).map(TS.modulus);
  rr.forEach((m) => close(m, Math.sqrt(1 / 0.8), 1e-8));
});

test('pacfToAr produit toujours un AR stationnaire', () => {
  const g = TS.gaussianRng(5);
  for (let i = 0; i < 200; i++) {
    const u = [1.5 * g(), 1.5 * g(), 1.5 * g()];
    assert.ok(TS.isStationary(TS.pacfToAr(u)));
  }
});

test('ADF et KPSS distinguent marche aléatoire et bruit blanc', () => {
  const g = TS.gaussianRng(9);
  const wn = Array.from({ length: 300 }, () => g());
  let s = 0; const rw = Array.from({ length: 300 }, () => (s += g()));
  assert.ok(TS.adf(wn).pvalue < 0.01, 'ADF rejette H0 sur bruit blanc');
  assert.ok(TS.adf(rw).pvalue > 0.1, 'ADF ne rejette pas sur marche aléatoire');
  assert.ok(TS.kpss(wn).pvalue >= 0.05, 'KPSS ne rejette pas sur bruit blanc');
  assert.ok(TS.kpss(rw).pvalue < 0.05, 'KPSS rejette sur marche aléatoire');
  const crit = TS.adf(wn).crit;
  close(crit['5%'], -2.87, 0.02);
  assert.equal(TS.ndiffs(rw), 1);
});

test('ADF sur log AirPassengers (valeurs connues statsmodels)', () => {
  // statsmodels adfuller(np.log(air)) : stat ≈ −1.717, p ≈ 0.422, lag 13
  const r = TS.adf(AIR.map(Math.log));
  close(r.stat, -1.717, 0.01, 'stat');
  close(r.pvalue, 0.422, 0.01, 'p');
  assert.equal(r.usedlag, 13);
});

test('Ljung-Box sur bruit blanc', () => {
  const g = TS.gaussianRng(21);
  const wn = Array.from({ length: 500 }, () => g());
  const [lb] = TS.ljungBox(wn, [10]);
  assert.ok(lb.pvalue > 0.05);
});

test('décomposition classique', () => {
  const x = Array.from({ length: 48 }, (_, t) => 10 + 0.5 * t + [3, -1, -2, 0][t % 4]);
  const dcp = TS.decompose(x, 4);
  close(dcp.trend[10], 10 + 0.5 * 10, 1e-9);
  close(dcp.figure[0], 3, 1e-9);
  close(dcp.resid[20], 0, 1e-9);
  assert.equal(TS.nsdiffs(AIR, 12), 1);
});

test('SARIMA : estimation d’un AR(2) simulé', () => {
  const x = TS.simulateArma({ phi: [0.6, -0.3], n: 2000, seed: 3, c: 2 });
  const f = TS.sarimaFit(x, { p: 2 });
  close(f.phi[0], 0.6, 0.05); close(f.phi[1], -0.3, 0.05);
  close(f.mu, 2 / (1 - 0.6 + 0.3), 0.1, 'moyenne');
  assert.ok(f.coefs.every((c) => isFinite(c.se) && c.se > 0));
});

test('SARIMA : estimation d’un MA(1) simulé', () => {
  const x = TS.simulateArma({ theta: [0.5], n: 3000, seed: 8 });
  const f = TS.sarimaFit(x, { q: 1 });
  close(f.theta[0], 0.5, 0.05);
});

test('modèle airline sur log AirPassengers', () => {
  // R arima(log(AirPassengers), c(0,1,1), seasonal=c(0,1,1)) en ML : ma1 ≈ −0.402, sma1 ≈ −0.557, σ² ≈ 0.00135
  const f = TS.sarimaFit(AIR, { d: 1, q: 1, D: 1, Q: 1, s: 12, lambda: 0 });
  close(f.theta[0], -0.40, 0.06, 'ma1');
  close(f.Theta[0], -0.56, 0.08, 'sma1');
  close(f.sigma2, 0.00135, 0.0003, 'sigma2');
  const fc = f.forecast(12);
  assert.equal(fc.mean.length, 12);
  // R/forecast : prévision de janvier 1961 ≈ 450
  close(fc.mean[0], 450, 12, 'jan 1961');
  assert.ok(fc.lo[11] < fc.mean[11] && fc.mean[11] < fc.hi[11]);
});

test('Holt-Winters multiplicatif sur AirPassengers', () => {
  const m = TS.etsFit(AIR, { trend: 'add', season: 'mul', m: 12 });
  const rmse = Math.sqrt(m.sse / AIR.length);
  assert.ok(rmse < 13, `RMSE in-sample ${rmse}`);
  const fc = m.forecast(12);
  close(fc[0], 450, 30);
  const iv = m.intervals(12);
  assert.ok(iv.lo[0] < fc[0] && fc[0] < iv.hi[0]);
});

test('métriques et baselines', () => {
  const m = TS.metrics([10, 20], [12, 18], [1, 2, 3, 4], 1);
  close(m.MAE, 2, 1e-12); close(m.RMSE, 2, 1e-12); close(m.MASE, 2, 1e-12);
  assert.deepEqual(TS.baselines.snaive([1, 2, 3, 4], 3, 2), [3, 4, 3]);
  assert.deepEqual(TS.baselines.drift([0, 1, 2], 2), [3, 4]);
});

test('jeux de données', () => {
  assert.equal(AIR.length, 144);
  DATASETS.forEach((d) => {
    assert.ok(d.values.every(Number.isFinite), d.id);
    if (d.dates) assert.equal(d.dates.length, d.values.length);
  });
});
