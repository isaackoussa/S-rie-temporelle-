/*
 * Chapitre 9 : études de cas commentées, étape par étape.
 * Tous les nombres cités dans les explications sont calculés au chargement, jamais écrits en dur.
 */
(function (root) {
  'use strict';
  const { pyCode, table, stats, pill, f2, fp, $$, timeAxis, esc, getDataset, tick, typeset, wireCopy, store } = root.UI;
  const { plot } = root.Charts;
  const CH = (root.CHAPTERS = root.CHAPTERS || []);
  const R = String.raw;

  // ---------------------------------------------------------------- utilitaires
  function corr(a, b) {
    const ma = TS.mean(a), mb = TS.mean(b);
    let s = 0, sa = 0, sb = 0;
    for (let i = 0; i < a.length; i++) { s += (a[i] - ma) * (b[i] - mb); sa += (a[i] - ma) ** 2; sb += (b[i] - mb) ** 2; }
    return s / Math.sqrt(sa * sb);
  }
  // Amplitude (max − min) et moyenne de chaque cycle complet
  function cycles(y, s) {
    const amp = [], lvl = [];
    for (let k = 0; (k + 1) * s <= y.length; k++) {
      const c = y.slice(k * s, (k + 1) * s);
      amp.push(Math.max(...c) - Math.min(...c)); lvl.push(TS.mean(c));
    }
    return { amp, lvl };
  }
  function acfFig(el, x, L, title, { pacf = false, s = 1 } = {}) {
    const r = (pacf ? TS.pacf(x, L) : TS.acf(x, L)).slice(1), band = 1.96 / Math.sqrt(x.length);
    const lags = r.map((_, i) => i + 1);
    const xt = (count) => { const st = s > 1 && L / s <= count ? s : Math.max(1, Math.ceil(L / count)); const o = []; for (let v = st; v <= L; v += st) o.push(v); return o; };
    plot(el, { title, height: 210, yMin: -1, yMax: 1, xTicks: xt, xLabel: (v) => String(Math.round(v)),
      layers: [{ type: 'hline', value: band }, { type: 'hline', value: -band }, { type: 'hline', value: 0, dash: false },
        { type: 'stem', x: lags, y: r, name: pacf ? 'α̂(h)' : 'ρ̂(h)', color: '--s1', colorFn: (v) => (Math.abs(v) > band ? '--s1' : '--ink-3') }] });
    return { r, band, sig: lags.filter((h, i) => Math.abs(r[i]) > band) };
  }
  const sigList = (lags, max = 8) => (lags.length ? lags.slice(0, max).join(', ') + (lags.length > max ? '…' : '') : 'aucun');
  function testsRows(items) {
    return table(['Série testée', 'ADF (H0 : racine unitaire)', 'p', 'KPSS (H0 : stationnaire)', 'p', 'Verdict'], items.map(([name, x]) => {
      const a = TS.adf(x), k = TS.kpss(x);
      const ok = a.pvalue < 0.05 && k.pvalue >= 0.05, ko = a.pvalue >= 0.05 && k.pvalue < 0.05;
      return [name, f2(a.stat, 2), fp(a.pvalue), f2(k.stat, 3), (k.bound ? k.bound + ' ' : '') + fp(k.pvalue),
        ok ? pill('good', 'stationnaire') : ko ? pill('bad', 'non stationnaire') : pill('warn', 'ambigu')];
    }), { numCols: [1, 2, 3, 4] });
  }
  function metricsTable(rows, train, test, m) {
    const out = rows.map((r) => ({ ...r, m: TS.metrics(test, r.mean, train, m), cov: r.lo ? test.filter((v, k) => v >= r.lo[k] && v <= r.hi[k]).length / test.length : null }))
      .sort((a, b) => a.m.MASE - b.m.MASE);
    return {
      list: out,
      html: table(['Modèle', 'MAE', 'RMSE', 'MAPE %', 'MASE', 'Couverture IC 95 %'], out.map((r) => [esc(r.name), f2(r.m.MAE, 2), f2(r.m.RMSE, 2), f2(r.m.MAPE, 2), f2(r.m.MASE, 3), r.cov === null ? '—' : f2(100 * r.cov, 0) + ' %']),
        { numCols: [1, 2, 3, 4, 5], rowClass: (_, i) => (i === 0 ? 'best' : '') }),
    };
  }
  function forecastFig(el, ds, fcs, { T, h, title, from = 0, withBand = true }) {
    const ax = timeAxis(ds, Math.max(0, T + h - ds.values.length));
    const y = ds.values, n = y.length;
    const xsF = Array.from({ length: h }, (_, k) => T + k);
    const first = fcs[0];
    const colors = root.TSModels.MODEL_COLORS;
    plot(el, { title, height: 290, xLabel: ax.label, xTicks: ax.ticks, layers: [
      { type: 'shade', from: T - 0.5, to: T + h - 0.5, label: T < n ? 'test' : 'prévision' },
      withBand && first.lo ? { type: 'band', x: xsF, lo: first.lo, hi: first.hi, name: `IC 95 % (${first.name})`, color: colors[0], of: first.name } : null,
      { type: 'line', x: y.slice(from).map((_, i) => from + i), y: y.slice(from), name: 'Observé', color: '--s1', width: 1.7 },
      ...fcs.map((f, i) => ({ type: 'line', x: xsF, y: f.mean, name: f.name, color: colors[i % colors.length], dash: i > 0, width: i ? 1.6 : 2 })),
    ] });
  }

  // ================================================================ Cas 1 : AirPassengers
  const CASE_AIR = {
    id: 'air', title: 'Passagers aériens', tag: 'Le cas d’école Box-Jenkins',
    goal: 'Prévoir le trafic mensuel des deux années suivantes avec un intervalle de confiance, en suivant la méthode Box-Jenkins de bout en bout.',
    data: 'AirPassengers, 144 mois (1949–1960), milliers de passagers.',
    tools: [['anatomie', 'décomposition'], ['stationnarite', 'Box-Cox, ADF, KPSS'], ['acf', 'ACF/PACF'], ['sarima', 'SARIMA'], ['evaluation', 'MASE']],
    build() {
      const ds = getDataset('air'), y = ds.values, n = y.length, s = 12;
      const log = y.map(Math.log);
      const cy = cycles(y, s), cl = cycles(log, s);
      const w12 = TS.diff(log, 12), w = TS.diff(w12, 1);
      const airline = TS.sarimaFit(y, { d: 1, q: 1, D: 1, Q: 1, s, lambda: 0 });
      const auto = TS.autoSarima(y, { d: 1, D: 1, s, lambda: 0 });
      const lb = TS.ljungBox(airline.resid, [12, 24], 2), jb = TS.jarqueBera(airline.resid);
      const h = 24, T = n - h, train = y.slice(0, T), test = y.slice(T);
      const aT = TS.sarimaFit(train, { d: 1, q: 1, D: 1, Q: 1, s, lambda: 0 }).forecast(h);
      const hwT = TS.etsFit(train, { trend: 'add', season: 'mul', m: s }).intervals(h);
      const ev = metricsTable([
        { name: 'SARIMA airline (log)', ...aT }, { name: 'Holt-Winters multiplicatif', ...hwT },
        { name: 'Naïf saisonnier', mean: TS.baselines.snaive(train, h, s) },
      ], train, test, s);
      return { ds, y, n, s, log, cy, cl, w12, w, airline, auto, lb, jb, h, T, ev, fc: airline.forecast(24),
        corrRaw: corr(cy.amp, cy.lvl), corrLog: corr(cl.amp, cl.lvl) };
    },
    steps: [
      {
        title: 'Regarder la série et mesurer ce qu’on voit',
        body: (c) => `<p>Deux faits sautent aux yeux : une tendance croissante et un motif annuel (pic en juillet-août). Mais la question utile est quantitative : <strong>l’amplitude saisonnière dépend-elle du niveau ?</strong> On calcule, pour chaque année, l’écart max − min et la moyenne.</p>
          <p>L’amplitude passe de <strong>${f2(c.cy.amp[0], 0)}</strong> en 1949 à <strong>${f2(c.cy.amp[c.cy.amp.length - 1], 0)}</strong> en 1960, et sa corrélation avec le niveau annuel vaut <strong>${f2(c.corrRaw, 3)}</strong>. L’amplitude est proportionnelle au niveau : c’est une saisonnalité <em>multiplicative</em>.</p>`,
        draw: (el, c) => {
          plot(el, { title: 'Amplitude saisonnière (max − min) par année', height: 220, xLabel: (i) => String(1949 + Math.round(i)),
            layers: [{ type: 'bar', x: c.cy.amp.map((_, i) => i), y: c.cy.amp, name: 'amplitude', color: '--s1' }] });
        },
        takeaway: () => 'Une saisonnalité dont l’amplitude croît avec le niveau appelle une transformation logarithmique (ou un modèle multiplicatif).',
        py: `year = y.index.year
amp = y.groupby(year).agg(lambda v: v.max() - v.min())
lvl = y.groupby(year).mean()
print(np.corrcoef(amp, lvl)[0, 1])      # proche de 1 : multiplicatif`,
      },
      {
        title: 'Stabiliser la variance par le logarithme',
        body: (c) => `<p>Après passage au log, la même mesure donne une corrélation amplitude/niveau de <strong>${f2(c.corrLog, 3)}</strong> (contre ${f2(c.corrRaw, 3)} avant). L’amplitude annuelle du log varie entre ${f2(Math.min(...c.cl.amp), 3)} et ${f2(Math.max(...c.cl.amp), 3)}, sans tendance nette : la variance est stabilisée. Le λ de Box-Cox estimé par vraisemblance vaut ${f2(TS.boxcoxLambda(c.y), 2)}, assez proche de 0 pour préférer le log, plus interprétable (une différence de log est un taux de croissance).</p>`,
        draw: (el, c) => {
          const ax = timeAxis(c.ds);
          plot(el, { title: 'log(passagers)', height: 220, xLabel: ax.label, xTicks: ax.ticks, layers: [{ type: 'line', x: c.log.map((_, i) => i), y: c.log, name: 'log X', color: '--s1', width: 1.5 }] });
        },
        takeaway: () => 'On modélise désormais log X. Les prévisions seront repassées à l’exponentielle à la fin.',
        py: `z = np.log(y)
from scipy.stats import boxcox
_, lam = boxcox(y); print(lam)`,
      },
      {
        title: 'Rendre la série stationnaire : choisir d et D',
        body: () => `<p>On teste successivement le log, sa différence saisonnière \\(\\Delta_{12}\\log X_t\\), puis la double différence \\(\\Delta\\Delta_{12}\\log X_t\\). On combine ADF (H0 : racine unitaire) et KPSS (H0 : stationnarité), dont les hypothèses nulles sont opposées.</p>`,
        draw: (el, c) => {
          el.innerHTML = testsRows([['log X', c.log], ['Δ₁₂ log X', c.w12], ['ΔΔ₁₂ log X', c.w]]) + '<div class="fig"></div>';
          const ax = timeAxis(c.ds);
          plot(el.querySelector('.fig'), { title: 'W_t = ΔΔ₁₂ log X_t', height: 200, xLabel: ax.label, xTicks: ax.ticks,
            layers: [{ type: 'line', x: c.w.map((_, i) => i + 13), y: c.w, name: 'W_t', color: '--s1', width: 1.3 }, { type: 'hline', value: 0 }] });
        },
        takeaway: (c) => {
          const a = TS.adf(c.w12);
          return `La différence saisonnière seule laisse un cas limite (ADF p = ${fp(a.pvalue)}). Avec d = 1 et D = 1, les deux tests concordent : W<sub>t</sub> fluctue autour de 0 avec une variance stable. On retient d = D = 1.`;
        },
        py: `from statsmodels.tsa.stattools import adfuller, kpss
for name, x in [("log", z), ("D12", z.diff(12)), ("d1 D12", z.diff(12).diff())]:
    x = x.dropna()
    print(name, adfuller(x)[1], kpss(x, nlags="legacy")[1])`,
      },
      {
        title: 'Identifier les ordres sur l’ACF et la PACF',
        body: () => '<p>On lit les corrélogrammes de W<sub>t</sub> en séparant les retards courts (1, 2, 3 → partie non saisonnière) et les retards saisonniers (12, 24, 36 → partie saisonnière).</p>',
        draw: (el, c) => {
          el.innerHTML = '<div class="grid-2"><div class="f1"></div><div class="f2"></div></div>';
          const A = acfFig(el.querySelector('.f1'), c.w, 36, 'ACF de W_t', { s: 12 });
          c.acfSig = A.sig; c.acfR = A.r; c.band = A.band;
          c.pacfSig = acfFig(el.querySelector('.f2'), c.w, 36, 'PACF de W_t', { pacf: true, s: 12 }).sig;
        },
        takeaway: (c) => {
          const top = c.acfR.map((v, i) => [i + 1, v]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 2).sort((a, b) => a[0] - b[0]);
          const others = c.acfSig.filter((h) => !top.some((t) => t[0] === h));
          return `Retards significatifs de l’ACF : <strong>${sigList(c.acfSig)}</strong>. Les deux pics dominants sont ${top.map(([h, v]) => `ρ̂(${h}) = ${f2(v, 2)}`).join(' et ')}, tous deux négatifs : un MA(1) pour la partie non saisonnière et un MA(1)₁₂ pour la partie saisonnière. ${others.length ? `Les autres dépassements (${others.join(', ')}) restent proches de la bande ±${f2(c.band, 3)} ; sur 36 retards, on en attend environ 2 par pur hasard. On ne les modélise pas d’emblée : c’est le diagnostic des résidus qui dira s’ils comptent.` : ''} La PACF décroît autour de ces retards, ce qui confirme une structure MA. Candidat : <strong>SARIMA(0,1,1)(0,1,1)₁₂</strong>, le modèle « airline ».`;
        },
        py: `from statsmodels.graphics.tsaplots import plot_acf, plot_pacf
w = z.diff(12).diff().dropna()
plot_acf(w, lags=36); plot_pacf(w, lags=36, method="ldb")`,
      },
      {
        title: 'Estimer, puis confronter à une recherche automatique',
        body: (c) => {
          const a = c.airline;
          return `<p>Le modèle estimé s’écrit :</p>
          \\[(1-B)(1-B^{12})\\log X_t = (1 ${a.theta[0] < 0 ? '-' : '+'} ${f2(Math.abs(a.theta[0]), 3).replace(',', '{,}')}B)(1 ${a.Theta[0] < 0 ? '-' : '+'} ${f2(Math.abs(a.Theta[0]), 3).replace(',', '{,}')}B^{12})\\varepsilon_t\\]
          <p>Les deux coefficients sont très significatifs. Pour vérifier qu’on n’a pas manqué mieux, on compare à une recherche en grille sur p, q ≤ 2 et P, Q ≤ 1 (d et D fixés, sinon les AICc ne sont pas comparables).</p>`;
        },
        draw: (el, c) => {
          el.innerHTML = table(['Coefficient', 'Estimation', 'Erreur-type', 'p-valeur'], c.airline.coefs.map((k) => [k.name, f2(k.value, 4), f2(k.se, 4), fp(k.pvalue)]), { numCols: [1, 2, 3] }) +
            table(['Modèle (grille)', 'AICc', 'Δ AICc', 'k'], c.auto.slice(0, 5).map((f) => [TS.orderLabel(f.order), f2(f.aicc, 2), f2(f.aicc - c.auto[0].aicc, 2), f.k]),
              { numCols: [1, 2, 3], rowClass: (_, i) => (i === 0 ? 'best' : '') });
        },
        takeaway: (c) => `La recherche automatique retrouve ${TS.orderLabel(c.auto[0].order) === 'SARIMA(0,1,1)(0,1,1)12' ? 'exactement le modèle identifié à la main' : `${TS.orderLabel(c.auto[0].order)}, à ${f2(c.airline.aicc - c.auto[0].aicc, 2)} point d’AICc du modèle identifié à la main`}. Règle pratique : un écart d’AICc inférieur à 2 ne départage pas deux modèles ; on garde le plus simple.`,
        py: `from statsmodels.tsa.statespace.sarimax import SARIMAX
res = SARIMAX(z, order=(0, 1, 1), seasonal_order=(0, 1, 1, 12)).fit(disp=False)
print(res.summary())`,
      },
      {
        title: 'Diagnostiquer les résidus',
        body: () => '<p>Un modèle adéquat laisse des résidus sans autocorrélation. On retire 2 degrés de liberté au test de Ljung-Box (deux paramètres MA estimés).</p>',
        draw: (el, c) => {
          el.innerHTML = '<div class="f1"></div>' + table(['Test', 'Statistique', 'p-valeur', 'Décision'], [
            ...c.lb.map((b) => [`Ljung-Box L = ${b.lag}`, f2(b.Q, 2), fp(b.pvalue), b.pvalue < 0.05 ? pill('bad', 'autocorrélation') : pill('good', 'bruit blanc plausible')]),
            ['Jarque-Bera', f2(c.jb.JB, 2), fp(c.jb.pvalue), c.jb.pvalue < 0.05 ? pill('warn', 'non normal') : pill('good', 'normalité plausible')]], { numCols: [1, 2] });
          acfFig(el.querySelector('.f1'), c.airline.resid, 36, 'ACF des résidus', { s: 12 });
        },
        takeaway: (c) => {
          const ok = c.lb.every((b) => b.pvalue >= 0.05);
          return ok ? 'Aucune autocorrélation résiduelle détectée : le modèle a capté la dynamique. La normalité conditionne la justesse des intervalles.'
            : `Ljung-Box détecte encore une structure (p = ${fp(Math.min(...c.lb.map((b) => b.pvalue)))}). Avec l’estimation CSS le résultat est à la limite ; en maximum de vraisemblance exact (statsmodels), le modèle airline passe généralement le test. Dans un vrai projet, on essaierait aussi un terme AR.`;
        },
        py: `from statsmodels.stats.diagnostic import acorr_ljungbox
print(acorr_ljungbox(res.resid[13:], lags=[12, 24], model_df=2))
res.plot_diagnostics()`,
      },
      {
        title: 'Valider hors échantillon',
        body: (c) => `<p>On refait tout en cachant les ${c.h} derniers mois : chaque modèle est estimé sur 1949–1958 et prévoit 1959–1960. On le compare à Holt-Winters et au naïf saisonnier, la référence à battre.</p>`,
        draw: (el, c) => {
          el.innerHTML = '<div class="f1"></div>' + c.ev.html;
          forecastFig(el.querySelector('.f1'), c.ds, c.ev.list, { T: c.T, h: c.h, title: 'Prévisions sur 1959–1960 (test)', from: c.T - 36 });
        },
        takeaway: (c) => {
          const best = c.ev.list[0], sn = c.ev.list.find((r) => r.name.startsWith('Naïf'));
          const others = c.ev.list.filter((r) => r !== sn);
          const beat = others.every((r) => r.m.MASE < sn.m.MASE);
          return `Meilleur modèle au test : <strong>${esc(best.name)}</strong> (MASE ${f2(best.m.MASE, 3)}, MAPE ${f2(best.m.MAPE, 1)} %). ${beat ? `Les deux modèles structurés font mieux que le naïf saisonnier (MASE ${f2(sn.m.MASE, 3)}, MAPE ${f2(sn.m.MAPE, 1)} %).` : `Le naïf saisonnier (MASE ${f2(sn.m.MASE, 3)}) n’est pas battu par tous les modèles.`} Une MASE supérieure à 1 n’a rien d’anormal ici : son dénominateur est l’erreur du naïf saisonnier <em>à un pas</em> sur l’entraînement, alors qu’on prévoit jusqu’à 24 mois, sur une période où le trafic accélère. Un seul découpage ne suffit pas à départager deux bons modèles : la validation glissante du chapitre 7 le ferait.`;
        },
        py: `train, test = y[:-24], y[-24:]
fit = SARIMAX(np.log(train), order=(0,1,1), seasonal_order=(0,1,1,12)).fit(disp=False)
pred = np.exp(fit.get_forecast(24).predicted_mean)
print(np.mean(np.abs(test.values - pred.values)))`,
      },
      {
        title: 'Prévoir 1961–1962',
        body: () => '<p>Le modèle retenu est réestimé sur les 144 mois, puis on prévoit 24 mois. Les bornes de l’intervalle calculées sur le log sont repassées à l’exponentielle : l’intervalle devient asymétrique, plus large vers le haut.</p>',
        draw: (el, c) => {
          forecastFig(el, c.ds, [{ name: 'Prévision airline', ...c.fc }], { T: c.n, h: 24, title: 'Prévision à 24 mois et IC 95 %', from: 72 });
        },
        takeaway: (c) => `Prévision pour juillet 1961 : <strong>${f2(c.fc.mean[6], 0)}</strong> milliers de passagers, IC 95 % [${f2(c.fc.lo[6], 0)} ; ${f2(c.fc.hi[6], 0)}]. Pour juillet 1962 : ${f2(c.fc.mean[18], 0)} [${f2(c.fc.lo[18], 0)} ; ${f2(c.fc.hi[18], 0)}]. L’intervalle s’élargit avec l’horizon : c’est l’effet de la double différenciation.`,
        py: `fc = res.get_forecast(24).summary_frame(alpha=0.05)
fc_x = np.exp(fc[["mean", "mean_ci_lower", "mean_ci_upper"]])   # médiane et IC sur l'échelle d'origine`,
      },
    ],
  };

  // ================================================================ Cas 2 : Ventes (additif, vérité connue)
  const CASE_SALES = {
    id: 'sales', title: 'Ventes mensuelles', tag: 'Saison additive, vérité connue',
    goal: 'Choisir entre modèle additif et multiplicatif, puis vérifier ce que les modèles retrouvent d’une série dont on connaît le vrai mécanisme.',
    data: 'Ventes simulées sur 120 mois : 200 + 1,2 t + saison additive (périodes 12 et 6) + bruit AR(1) de coefficient 0,5.',
    tools: [['anatomie', 'décomposition'], ['lissage', 'Holt-Winters'], ['sarima', 'SARIMA'], ['evaluation', 'comparaison']],
    build() {
      const ds = getDataset('sales'), y = ds.values, n = y.length, s = 12;
      const cy = cycles(y, s);
      const dA = TS.decompose(y, s, 'additive'), dM = TS.decompose(y, s, 'multiplicative');
      const trueFig = Array.from({ length: s }, (_, t) => 25 * Math.sin((2 * Math.PI * t) / 12) + 12 * Math.cos((2 * Math.PI * t) / 6));
      const D = TS.nsdiffs(y, s), d = TS.ndiffs(D ? TS.diff(y, s) : y);
      let w = TS.diff(y, 1, d); if (D) w = TS.diff(w, s, D);
      const hw = TS.etsFit(y, { trend: 'add', season: 'add', m: s });
      const h = 24, T = n - h, train = y.slice(0, T), test = y.slice(T);
      const autoT = TS.autoSarima(train, { d, D, s });
      const ev = metricsTable([
        { name: 'Holt-Winters additif', ...TS.etsFit(train, { trend: 'add', season: 'add', m: s }).intervals(h) },
        { name: 'Holt-Winters multiplicatif', ...TS.etsFit(train, { trend: 'add', season: 'mul', m: s }).intervals(h) },
        { name: `${TS.orderLabel(autoT[0].order)} (auto)`, ...autoT[0].forecast(h) },
        { name: 'Naïf saisonnier', mean: TS.baselines.snaive(train, h, s) },
      ], train, test, s);
      const rv = (d0) => TS.variance(d0.resid.filter((v) => v !== null).map((v) => (d0.type === 'multiplicative' ? Math.log(v) : v)));
      return { ds, y, n, s, cy, dA, dM, trueFig, d, D, w, hw, h, T, ev, autoT, corrRaw: corr(cy.amp, cy.lvl), rvA: rv(dA), rvM: rv(dM) };
    },
    steps: [
      {
        title: 'Additif ou multiplicatif ? Le même test qu’en cas 1',
        body: (c) => `<p>Même mesure qu’au cas 1 : corrélation entre amplitude annuelle et niveau annuel. Ici elle vaut <strong>${f2(c.corrRaw, 3)}</strong> alors que le niveau progresse de ${f2(c.cy.lvl[0], 0)} à ${f2(c.cy.lvl[c.cy.lvl.length - 1], 0)}. L’amplitude ne suit pas le niveau.</p>`,
        draw: (el, c) => {
          el.innerHTML = '<div class="grid-2"><div class="f1"></div><div class="f2"></div></div>';
          const ax = timeAxis(c.ds);
          plot(el.querySelector('.f1'), { title: 'Série', height: 210, xLabel: ax.label, xTicks: ax.ticks, layers: [{ type: 'line', x: c.y.map((_, i) => i), y: c.y, name: 'ventes', color: '--s1', width: 1.5 }] });
          plot(el.querySelector('.f2'), { title: 'Amplitude annuelle', height: 210, xLabel: (i) => String(2015 + Math.round(i)), layers: [{ type: 'bar', x: c.cy.amp.map((_, i) => i), y: c.cy.amp, name: 'amplitude', color: '--s1' }] });
        },
        takeaway: () => 'Amplitude stable pendant que le niveau monte : saisonnalité additive. Pas de transformation logarithmique nécessaire.',
        py: `amp = y.groupby(y.index.year).agg(lambda v: v.max() - v.min())
print(np.corrcoef(amp, y.groupby(y.index.year).mean())[0, 1])`,
      },
      {
        title: 'Décomposer et comparer à la vérité',
        body: (c) => `<p>On décompose de façon additive. Comme la série est simulée, on connaît le vrai profil saisonnier : \\(25\\sin(2\\pi t/12) + 12\\cos(2\\pi t/6)\\). La variance du reste vaut ${f2(c.rvA, 2)} en additif ; la décomposition multiplicative, évaluée sur l’échelle log, n’est pas comparable directement mais son reste montre des vagues résiduelles.</p>`,
        draw: (el, c) => {
          const idx = c.trueFig.map((_, j) => j);
          plot(el, { title: 'Profil saisonnier : estimé vs vrai', height: 230, xLabel: (j) => root.UI.MOIS[Math.round(j) % 12],
            layers: [{ type: 'bar', x: idx, y: c.dA.figure, name: 'estimé (décomposition additive)', color: '--s1' },
              { type: 'points', x: idx, y: c.trueFig, name: 'vrai profil', color: '--s2', r: 5 }, { type: 'hline', value: 0 }] });
        },
        takeaway: (c) => `Écart moyen entre profil estimé et vrai profil : <strong>${f2(TS.mean(c.dA.figure.map((v, j) => Math.abs(v - c.trueFig[j]))), 2)}</strong> unités, pour une amplitude de ${f2(Math.max(...c.trueFig) - Math.min(...c.trueFig), 0)}. La décomposition classique retrouve bien la saison quand l’hypothèse additive est la bonne. Force saisonnière F<sub>S</sub> = ${f2(c.dA.strengthSeason, 2)}.`,
        py: `from statsmodels.tsa.seasonal import seasonal_decompose
dec = seasonal_decompose(y, model="additive", period=12)
print(dec.seasonal[:12])`,
      },
      {
        title: 'Holt-Winters additif : que retrouve-t-il ?',
        body: (c) => {
          const p = c.hw.params;
          return `<p>Paramètres estimés : α = ${f2(p.alpha, 3)}, β* = ${f2(p.beta, 3)}, γ = ${f2(p.gamma, 3)}. Un γ ${p.gamma < 0.15 ? 'faible' : 'élevé'} signifie que la saison ${p.gamma < 0.15 ? 'évolue peu, ce qui est exact : elle est fixe dans la simulation' : 'est jugée évolutive'}. La pente finale vaut b<sub>T</sub> = <strong>${f2(c.hw.slope[c.n - 1], 3)}</strong> par mois, pour une vraie pente de 1,2.</p>`;
        },
        draw: (el, c) => {
          const ax = timeAxis(c.ds);
          plot(el, { title: 'Pente bₜ estimée par Holt-Winters (vraie pente : 1,2)', height: 210, xLabel: ax.label, xTicks: ax.ticks,
            layers: [{ type: 'line', x: c.y.map((_, i) => i), y: c.hw.slope, name: 'bₜ', color: '--s5' }, { type: 'hline', value: 1.2, label: 'vraie pente 1,2' }] });
        },
        takeaway: () => 'La pente estimée oscille autour de la vraie valeur : le bruit AR(1) est en partie absorbé comme de petites variations de tendance. C’est le prix d’un modèle simple, qui reste très bon en prévision.',
        py: `from statsmodels.tsa.holtwinters import ExponentialSmoothing
hw = ExponentialSmoothing(y, trend="add", seasonal="add", seasonal_periods=12).fit()
print(hw.params["smoothing_level"], hw.params["smoothing_trend"], hw.params["smoothing_seasonal"])`,
      },
      {
        title: 'Stationnariser et laisser la grille choisir un SARIMA',
        body: (c) => `<p>Suggestions automatiques : d = ${c.d}, D = ${c.D}. Sur l’entraînement (96 mois), la grille AICc retient <strong>${TS.orderLabel(c.autoT[0].order)}</strong>.</p>`,
        draw: (el, c) => {
          el.innerHTML = '<div class="grid-2"><div class="f1"></div><div class="f2"></div></div>';
          c.wA = acfFig(el.querySelector('.f1'), c.w, 36, 'ACF de la série différenciée', { s: 12 });
          acfFig(el.querySelector('.f2'), c.w, 36, 'PACF de la série différenciée', { pacf: true, s: 12 });
        },
        takeaway: (c) => {
          const r1 = c.wA.r[0], r12 = c.wA.r[11], sig = c.wA.sig;
          return `ρ̂(1) = ${f2(r1, 2)} et ρ̂(12) = ${f2(r12, 2)} ; retards significatifs : ${sigList(sig)}. ${c.D && r12 < -c.wA.band ? 'Le pic négatif au retard 12 est la trace de la différence saisonnière appliquée à une saison fixe : elle appelle un MA saisonnier (Θ proche de −1). ' : ''}Le bruit AR(1) du vrai mécanisme, une fois différencié, se lit aux premiers retards. Les ordres retenus par la grille, ${TS.orderLabel(c.autoT[0].order)}, traduisent ces deux structures.`;
        },
        py: `import pmdarima as pm       # pip install pmdarima
m = pm.auto_arima(y[:-24], seasonal=True, m=12, information_criterion="aicc")
print(m.summary())`,
      },
      {
        title: 'Départager sur le test',
        body: (c) => `<p>Quatre modèles estimés sur les ${c.T} premiers mois, testés sur les ${c.h} derniers.</p>`,
        draw: (el, c) => {
          el.innerHTML = '<div class="f1"></div>' + c.ev.html;
          forecastFig(el.querySelector('.f1'), c.ds, c.ev.list, { T: c.T, h: c.h, title: 'Prévisions sur les 24 derniers mois', from: c.T - 36 });
        },
        takeaway: (c) => {
          const add = c.ev.list.find((r) => r.name === 'Holt-Winters additif'), mul = c.ev.list.find((r) => r.name === 'Holt-Winters multiplicatif');
          return `Holt-Winters additif : MASE ${f2(add.m.MASE, 3)} ; multiplicatif : MASE ${f2(mul.m.MASE, 3)}. Le diagnostic de l’étape 1 ${add.m.MASE <= mul.m.MASE ? 'est confirmé : le modèle additif prévoit mieux' : 'n’est pas confirmé sur ce découpage : l’écart est faible, les deux formes sont proches quand la saison pèse peu devant le niveau'}. Le meilleur modèle au test est ${esc(c.ev.list[0].name)}.`;
        },
        py: `for trend, seas in [("add", "add"), ("add", "mul")]:
    fit = ExponentialSmoothing(y[:-24], trend=trend, seasonal=seas, seasonal_periods=12).fit()
    print(seas, np.mean(np.abs(y[-24:].values - fit.forecast(24).values)))`,
      },
    ],
  };

  // ================================================================ Cas 3 : charge électrique journalière
  const CASE_LOAD = {
    id: 'load', title: 'Charge électrique', tag: 'Données journalières, saison hebdomadaire',
    goal: 'Prévoir 4 semaines de consommation journalière et comprendre les limites d’une saison unique.',
    data: 'Charge électrique simulée sur 364 jours : cycle annuel, saison hebdomadaire multiplicative (creux le week-end), niveau en marche aléatoire.',
    tools: [['acf', 'périodogramme'], ['lissage', 'Holt-Winters'], ['sarima', 'SARIMA'], ['evaluation', 'MASE']],
    async build(progress) {
      const ds = getDataset('load'), y = ds.values, n = y.length, s = 7;
      const dM = TS.decompose(y, s, 'multiplicative');
      const per = TS.periodogram(y.map(Math.log));
      const top = [...per].sort((a, b) => b.power - a.power).slice(0, 4);
      const h = 28, T = n - h, train = y.slice(0, T), test = y.slice(T);
      progress('Holt-Winters…'); await tick();
      const hw = TS.etsFit(train, { trend: 'add', season: 'mul', m: s }).intervals(h);
      const hwd = TS.etsFit(train, { trend: 'damped', season: 'mul', m: s }).intervals(h);
      progress('Recherche SARIMA (36 modèles sur 336 jours)…'); await tick();
      const D = TS.nsdiffs(train, s), d = TS.ndiffs(D ? TS.diff(train.map(Math.log), s) : train.map(Math.log));
      const auto = TS.autoSarima(train, { d, D, s, lambda: 0, maxp: 2, maxq: 2 });
      const ev = metricsTable([
        { name: `${TS.orderLabel(auto[0].order)} (log)`, ...auto[0].forecast(h) },
        { name: 'Holt-Winters multiplicatif', ...hw }, { name: 'Holt-Winters amorti multiplicatif', ...hwd },
        { name: 'Naïf saisonnier (7 j)', mean: TS.baselines.snaive(train, h, s) },
      ], train, test, s);
      const resid = auto[0].resid;
      return { ds, y, n, s, dM, per, top, h, T, ev, auto, d, D, resid };
    },
    steps: [
      {
        title: 'Zoomer : une série journalière se lit semaine par semaine',
        body: () => '<p>Sur 364 points, le motif hebdomadaire est illisible. On regarde les 8 dernières semaines : chaque semaine présente un plateau en jours ouvrés et un creux le samedi et le dimanche.</p>',
        draw: (el, c) => {
          const ax = timeAxis(c.ds), from = c.n - 56;
          el.innerHTML = '<div class="f1"></div><div class="f2"></div>';
          plot(el.querySelector('.f1'), { title: 'Année complète', height: 190, xLabel: ax.label, xTicks: ax.ticks, layers: [{ type: 'line', x: c.y.map((_, i) => i), y: c.y, name: 'MW', color: '--s1', width: 1.1 }] });
          plot(el.querySelector('.f2'), { title: '8 dernières semaines', height: 210, xLabel: ax.label, xTicks: (k, lo, hi) => { const o = []; for (let v = from; v <= hi; v += 7) o.push(v); return o; },
            layers: [{ type: 'line', x: c.y.slice(from).map((_, i) => from + i), y: c.y.slice(from), name: 'MW', color: '--s1', width: 1.8 }] });
        },
        takeaway: () => 'Deux cycles se superposent : hebdomadaire (s = 7) et annuel (≈ 365 j). Un SARIMA ou un Holt-Winters classique n’en gère qu’un.',
        py: `y[-56:].plot()                     # zoom sur 8 semaines
y.groupby(y.index.dayofweek).mean().plot(kind="bar")`,
      },
      {
        title: 'Quantifier l’effet jour de la semaine',
        body: () => '<p>La décomposition multiplicative de période 7 donne un coefficient par jour : 0,80 signifie une charge inférieure de 20 % à la tendance.</p>',
        draw: (el, c) => {
          const days = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
          const start = (new Date(c.ds.dates[0] + 'T00:00:00Z').getUTCDay() + 6) % 7;
          c.days = c.dM.figure.map((v, j) => [days[(j + start) % 7], v]);
          plot(el, { title: 'Coefficient saisonnier par jour', height: 210, xLabel: (j) => c.days[Math.round(j)][0], xTicks: c.days.map((_, j) => j),
            layers: [{ type: 'bar', x: c.days.map((_, j) => j), y: c.days.map((d) => d[1]), name: 'coefficient', color: '--s3', base: 1 }, { type: 'hline', value: 1 }] });
        },
        takeaway: (c) => {
          const lo = c.days.reduce((a, b) => (b[1] < a[1] ? b : a));
          return `Le jour le plus bas est le <strong>${lo[0]}</strong>, à ${f2((1 - lo[1]) * 100, 1)} % sous la tendance. F<sub>S</sub> = ${f2(c.dM.strengthSeason, 2)} : saison hebdomadaire forte.`;
        },
        py: `from statsmodels.tsa.seasonal import seasonal_decompose
dec = seasonal_decompose(y, model="multiplicative", period=7)
print(dec.seasonal[:7])`,
      },
      {
        title: 'Confirmer les cycles au périodogramme',
        body: () => '<p>Le périodogramme du log décompose la variance par fréquence. On attend un pic à la période 7 et ses harmoniques (3,5 ; 2,33), et de l’énergie aux très basses fréquences pour le cycle annuel et la dérive du niveau.</p>',
        draw: (el, c) => {
          plot(el, { title: 'Périodogramme de log(charge)', height: 220, xAxisTitle: 'fréquence (cycles par jour)', xLabel: (f, full) => (full ? `période ${f2(1 / f, 1)} j` : f2(f, 2)),
            layers: [{ type: 'line', x: c.per.map((q) => q.freq), y: c.per.map((q) => q.power), name: 'I(f)', color: '--s5', width: 1.3 }] });
        },
        takeaway: (c) => `Pics principaux : ${c.top.map((q) => `période ${f2(q.period, 1)} j`).join(' · ')}. La période hebdomadaire et ses harmoniques dominent ; les plus longues périodes traduisent le cycle annuel, qu’on ne peut pas estimer proprement avec un an de données seulement.`,
        py: `from scipy.signal import periodogram
f, P = periodogram(np.log(y).values - np.log(y).mean())
print(1 / f[np.argsort(P)[-4:]])        # périodes dominantes`,
      },
      {
        title: 'Comparer les modèles sur 4 semaines',
        body: (c) => `<p>Modèles estimés sur ${c.T} jours et testés sur les ${c.h} derniers. Pour le SARIMA : log, d = ${c.d}, D = ${c.D}, s = 7, ordres choisis par AICc.</p>`,
        draw: (el, c) => {
          el.innerHTML = '<div class="f1"></div>' + c.ev.html;
          forecastFig(el.querySelector('.f1'), c.ds, c.ev.list, { T: c.T, h: c.h, title: 'Prévisions sur les 28 derniers jours', from: c.T - 42 });
        },
        takeaway: (c) => {
          const sn = c.ev.list.find((r) => r.name.startsWith('Naïf')), best = c.ev.list[0];
          if (best === sn) {
            const second = c.ev.list[1];
            return `Aucun modèle ne bat le <strong>naïf saisonnier</strong> (répéter la dernière semaine, MASE ${f2(sn.m.MASE, 3)}) ; le suivant est ${esc(second.name)} (MASE ${f2(second.m.MASE, 3)}). C’est un résultat fréquent et instructif : le niveau suit une marche aléatoire, donc la dernière semaine observée est déjà une excellente estimation, et les modèles paient l’estimation de leurs paramètres. Sur données journalières, le naïf saisonnier est la référence à battre avant toute sophistication.`;
          }
          return `Meilleur : <strong>${esc(best.name)}</strong> (MASE ${f2(best.m.MASE, 3)}), devant le naïf saisonnier (répéter la dernière semaine, MASE ${f2(sn.m.MASE, 3)}). Sur données journalières, le naïf saisonnier reste une référence redoutable.`;
        },
        py: `from statsmodels.tsa.statespace.sarimax import SARIMAX
fit = SARIMAX(np.log(y[:-28]), order=(1, 1, 1), seasonal_order=(0, 1, 1, 7)).fit(disp=False)
pred = np.exp(fit.get_forecast(28).predicted_mean)`,
      },
      {
        title: 'Aller plus loin : saisonnalités multiples',
        body: () => R`<p>Le cycle annuel n’est capté que par la tendance locale. Les approches adaptées aux saisonnalités multiples :</p>
          <ul><li><strong>Régression harmonique</strong> : ARIMA avec régresseurs de Fourier \(\sin(2\pi k t/365{,}25), \cos(2\pi k t/365{,}25)\), \(k = 1..K\), \(K\) choisi par AICc.</li>
          <li><strong>MSTL</strong> (Bandara et al., 2021) : STL itérée sur plusieurs périodes (7 et 365), puis modèle sur la série corrigée.</li>
          <li><strong>TBATS</strong> : lissage exponentiel avec saisons trigonométriques, Box-Cox et erreurs ARMA.</li>
          <li><strong>Variables exogènes</strong> : température, jours fériés. Pour la charge électrique, ce sont souvent elles qui font la différence.</li></ul>`,
        draw: (el, c) => {
          const L = Math.min(60, c.resid.length - 2);
          acfFig(el, c.resid, L, 'ACF des résidus du SARIMA retenu (60 retards)', { s: 7 });
        },
        takeaway: () => 'Si des pics subsistent dans l’ACF des résidus, ils indiquent une structure non modélisée : c’est le signal pour ajouter des termes de Fourier ou des variables exogènes.',
        py: `from statsmodels.tsa.seasonal import MSTL
res = MSTL(y, periods=(7, 365)).fit()          # nécessite plus d'un an de données
# Régression harmonique : SARIMAX(y, exog=fourier_terms, order=..., seasonal_order=(P,D,Q,7))`,
      },
    ],
  };

  // ================================================================ Cas 4 : le piège de la marche aléatoire
  const CASE_RW = {
    id: 'rw', title: 'Marche aléatoire', tag: 'Pièges : tendances illusoires et régression fallacieuse',
    goal: 'Reconnaître une série imprévisible, éviter la régression fallacieuse et accepter que le modèle naïf soit le bon.',
    data: '250 points simulés : X_t = X_{t−1} + ε_t, ε_t ~ N(0, 1). Et une seconde marche aléatoire, indépendante de la première.',
    tools: [['stationnarite', 'racine unitaire'], ['acf', 'ACF'], ['evaluation', 'référence naïve']],
    build() {
      const ds = getDataset('rw'), y = ds.values, n = y.length;
      const g = TS.gaussianRng(99); let s0 = 50; const x = Array.from({ length: n }, () => (s0 += g()));
      const r = TS.acf(y, 30), dy = TS.diff(y), lbD = TS.ljungBox(dy, [10, 20]);
      const reg = (Y, X) => {
        const f = TS.ols(X.map((v) => [1, v]), Y);
        const tss = Y.reduce((a, v) => a + (v - TS.mean(Y)) ** 2, 0);
        let dw = 0; for (let t = 1; t < f.resid.length; t++) dw += (f.resid[t] - f.resid[t - 1]) ** 2;
        return { b: f.beta[1], t: f.beta[1] / f.se[1], r2: 1 - f.rss / tss, dw: dw / f.rss };
      };
      const lev = reg(y, x), dif = reg(dy, TS.diff(x));
      // Monte-Carlo : fréquence de « significativité » de la régression en niveau
      let rej = 0; const M = 300;
      for (let k = 0; k < M; k++) {
        const ga = TS.gaussianRng(1000 + k), gb = TS.gaussianRng(5000 + k); let a = 0, b = 0;
        const A = Array.from({ length: 100 }, () => (a += ga())), Bv = Array.from({ length: 100 }, () => (b += gb()));
        if (Math.abs(reg(A, Bv).t) > 1.96) rej++;
      }
      const h = 50, T = n - h, train = y.slice(0, T), test = y.slice(T);
      const ar = TS.autoSarima(train, { d: 1, D: 0, s: 1 });
      const ev = metricsTable([
        // ARIMA(0,1,0) = marche aléatoire : prévision naïve, avec ses intervalles en √h
        { ...TS.sarimaFit(train, { d: 1 }).forecast(h), name: 'Naïf' },
        { name: 'Dérive', mean: TS.baselines.drift(train, h) },
        { name: `${TS.orderLabel(ar[0].order)} (auto)`, ...ar[0].forecast(h) },
        { name: 'Tendance linéaire (régression sur t)', mean: (() => { const f = TS.ols(train.map((_, t) => [1, t]), train); return Array.from({ length: h }, (_, k) => f.beta[0] + f.beta[1] * (T + k)); })() },
      ], train, test, 1);
      return { ds, y, x, n, r, dy, lbD, lev, dif, rej, M, h, T, ev, adf: TS.adf(y), adfD: TS.adf(dy) };
    },
    steps: [
      {
        title: 'Des « tendances » qui n’en sont pas',
        body: () => '<p>Cette trajectoire semble présenter des phases de hausse et de baisse durables. Pourtant chaque pas est un tirage indépendant, de moyenne nulle : aucune de ces tendances n’est prévisible. Le cerveau voit des structures dans l’accumulation de bruit.</p>',
        draw: (el, c) => {
          plot(el, { title: 'X_t (marche aléatoire, 250 pas)', height: 230, xLabel: (i) => String(Math.round(i) + 1), layers: [{ type: 'line', x: c.y.map((_, i) => i), y: c.y, name: 'X_t', color: '--s1', width: 1.5 }] });
        },
        takeaway: (c) => `ADF sur X<sub>t</sub> : p = ${fp(c.adf.pvalue)} (racine unitaire non rejetée). ADF sur ΔX<sub>t</sub> : p = ${fp(c.adfD.pvalue)}. La série est I(1).`,
        py: `rw = np.cumsum(np.random.default_rng(3).normal(size=250)) + 100
print(adfuller(rw)[1], adfuller(np.diff(rw))[1])`,
      },
      {
        title: 'L’empreinte d’une racine unitaire dans l’ACF',
        body: (c) => `<p>L’ACF d’une série I(1) décroît très lentement, presque linéairement : ρ̂(1) = ${f2(c.r[1], 3)}, ρ̂(10) = ${f2(c.r[10], 3)}, ρ̂(20) = ${f2(c.r[20], 3)}. Après différenciation, on retrouve le bruit blanc d’origine.</p>`,
        draw: (el, c) => {
          el.innerHTML = '<div class="grid-2"><div class="f1"></div><div class="f2"></div></div>';
          acfFig(el.querySelector('.f1'), c.y, 30, 'ACF de X_t');
          acfFig(el.querySelector('.f2'), c.dy, 30, 'ACF de ΔX_t');
        },
        takeaway: (c) => `Ljung-Box sur ΔX<sub>t</sub> : p = ${fp(c.lbD[0].pvalue)} (L = 10) et ${fp(c.lbD[1].pvalue)} (L = 20). Aucune autocorrélation : il n’y a rien à modéliser dans les accroissements.`,
        py: `plot_acf(rw, lags=30); plot_acf(np.diff(rw), lags=30)`,
      },
      {
        title: 'La régression fallacieuse',
        body: (c) => R`<p>On régresse X<sub>t</sub> sur une <em>autre</em> marche aléatoire Z<sub>t</sub>, simulée indépendamment. Il n’existe aucun lien entre les deux. Pourtant la régression en niveau donne :</p>
          <ul><li>pente \(\hat b\) = ${f2(c.lev.b, 3)}, statistique t = <strong>${f2(c.lev.t, 1)}</strong></li>
          <li>R² = <strong>${f2(c.lev.r2, 3)}</strong></li>
          <li>Durbin-Watson = ${f2(c.lev.dw, 3)} (proche de 0 : résidus fortement autocorrélés)</li></ul>
          <p>Granger et Newbold (1974) donnent une règle d’alerte : un R² supérieur au Durbin-Watson signale une régression fallacieuse. La statistique t ne suit plus une loi de Student : elle diverge avec n (Phillips, 1986).</p>`,
        draw: (el, c) => {
          el.innerHTML = '<div class="f1"></div>' + table(['Régression', 'pente', 't', 'R²', 'Durbin-Watson'], [
            ['X_t sur Z_t (niveaux)', f2(c.lev.b, 3), f2(c.lev.t, 2), f2(c.lev.r2, 3), f2(c.lev.dw, 3)],
            ['ΔX_t sur ΔZ_t (différences)', f2(c.dif.b, 3), f2(c.dif.t, 2), f2(c.dif.r2, 3), f2(c.dif.dw, 3)]], { numCols: [1, 2, 3, 4] });
          plot(el.querySelector('.f1'), { title: 'Deux marches aléatoires indépendantes', height: 220, xLabel: (i) => String(Math.round(i) + 1),
            layers: [{ type: 'line', x: c.y.map((_, i) => i), y: c.y, name: 'X_t', color: '--s1', width: 1.5 }, { type: 'line', x: c.x.map((_, i) => i), y: c.x, name: 'Z_t (indépendante)', color: '--s2', width: 1.5 }] });
        },
        takeaway: (c) => `Sur ${c.M} paires de marches aléatoires indépendantes (n = 100), la pente est « significative à 5 % » dans <strong>${f2((100 * c.rej) / c.M, 0)} %</strong> des cas au lieu de 5 %. En différences, le lien disparaît (t = ${f2(c.dif.t, 2)}). Règle : ne jamais régresser des séries I(1) en niveau, sauf cointégration établie (test d’Engle-Granger ou de Johansen).`,
        py: `import statsmodels.api as sm
z = np.cumsum(np.random.default_rng(99).normal(size=250))
print(sm.OLS(rw, sm.add_constant(z)).fit().summary())            # t énorme, R² élevé : fallacieux
print(sm.OLS(np.diff(rw), sm.add_constant(np.diff(z))).fit().tvalues)`,
      },
      {
        title: 'Prévoir : le naïf est optimal',
        body: () => R`<p>Pour une marche aléatoire, \(\mathbb E[X_{n+h}\mid X_1..X_n] = X_n\) : la meilleure prévision est la dernière valeur. La variance d’erreur vaut \(h\sigma^2\), donc l’intervalle s’élargit comme \(\sqrt h\).</p>`,
        draw: (el, c) => {
          el.innerHTML = '<div class="f1"></div>' + c.ev.html;
          forecastFig(el.querySelector('.f1'), c.ds, c.ev.list.slice().sort((a, b) => (a.name === 'Naïf' ? -1 : b.name === 'Naïf' ? 1 : 0)), { T: c.T, h: c.h, title: 'Prévisions sur les 50 derniers points (IC du naïf, en √h)', from: 100 });
        },
        takeaway: (c) => {
          const tr = c.ev.list.find((r) => r.name.startsWith('Tendance')), nv = c.ev.list.find((r) => r.name === 'Naïf');
          const au = c.ev.list.find((r) => r.name.includes('auto')), lbl = au.name.replace(' (auto)', '');
          const autoTxt = lbl === 'ARIMA(0,1,0)'
            ? 'La recherche automatique retient ARIMA(0,1,0) : exactement la marche aléatoire.'
            : `La recherche automatique retient ${esc(lbl)} : sur 200 points, l’AICc peut préférer quelques coefficients qui ajustent du bruit. Au test, sa MASE (${f2(au.m.MASE, 3)}) est ${Math.abs(au.m.MASE - nv.m.MASE) < 0.05 * nv.m.MASE ? 'pratiquement celle du naïf' : au.m.MASE < nv.m.MASE ? 'un peu meilleure que celle du naïf, par chance sur ce découpage' : 'moins bonne que celle du naïf'} (${f2(nv.m.MASE, 3)}) : ces coefficients n’apportent aucune prévisibilité durable.`;
          return `La tendance linéaire, qui extrapole une « tendance » fortuite, obtient une MASE de ${f2(tr.m.MASE, 2)}. ${autoTxt} La leçon : un modèle sophistiqué ne crée pas de prévisibilité là où il n’y en a pas. Le naïf doit toujours figurer parmi les références.`;
        },
        py: `from statsmodels.tsa.arima.model import ARIMA
fit = ARIMA(rw[:-50], order=(0, 1, 0)).fit()      # marche aléatoire
fc = fit.get_forecast(50).summary_frame()          # IC en ± 1,96 σ √h`,
      },
    ],
  };

  const CASES = [CASE_AIR, CASE_SALES, CASE_LOAD, CASE_RW];

  // ================================================================ Rendu
  CH.push({
    id: 'cas', title: 'Études de cas', short: 'Études de cas',
    desc: 'Quatre analyses complètes, commentées étape par étape, avec le code Python.',
    render(el) {
      let current = store.get('case', 'air');
      if (!CASES.some((c) => c.id === current)) current = 'air';
      el.innerHTML = `
      <header class="ch-head">
        <div class="eyebrow">Chapitre 9 · Travaux réalisés</div>
        <h1>Études de cas : des analyses complètes, commentées</h1>
        <p class="lede">Chaque cas suit une démarche réelle du début à la fin. Chaque étape montre le calcul, explique ce qu’on regarde, conclut, et donne le code Python pour la refaire. Les chiffres du texte sont recalculés en direct.</p>
      </header>
      <div class="case-tabs" role="tablist">${CASES.map((c) => `<button type="button" role="tab" data-case="${c.id}" aria-selected="${c.id === current}"><span class="ct-title">${c.title}</span><span class="ct-tag">${c.tag}</span></button>`).join('')}</div>
      <div id="case-body"></div>`;

      const body = el.querySelector('#case-body');
      const load = async (id) => {
        current = id; store.set('case', id);
        $$('.case-tabs button', el).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.case === id)));
        const cs = CASES.find((c) => c.id === id);
        body.innerHTML = '<p class="busy">Calcul de l’étude de cas…</p>';
        await tick();
        let ctx;
        try { ctx = await cs.build((m) => { const b = body.querySelector('.busy'); if (b) b.textContent = m; }); } catch (err) {
          body.innerHTML = `<div class="callout bad"><p>Erreur de calcul : ${esc(err.message)}</p></div>`; console.error(err); return;
        }
        if (current !== id) return;
        body.innerHTML = `
          <div class="case-brief">
            <div><span class="k">Objectif</span><p>${cs.goal}</p></div>
            <div><span class="k">Données</span><p>${cs.data}</p></div>
            <div><span class="k">Outils mobilisés</span><p>${cs.tools.map(([ch, t]) => `<a class="chip" href="#${ch}">${t}</a>`).join(' ')}</p></div>
          </div>
          <ol class="steps">${cs.steps.map((st, i) => `
            <li class="step">
              <div class="step-num" aria-hidden="true">${i + 1}</div>
              <div class="step-body">
                <h3>${st.title}</h3>
                <div class="prose">${st.body(ctx)}</div>
                <div class="step-fig" id="fig-${i}"></div>
                <div class="callout good step-take" id="take-${i}"></div>
                ${st.py ? `<details class="step-py"><summary>Code Python de l’étape</summary>${pyCode(st.py)}</details>` : ''}
              </div>
            </li>`).join('')}</ol>`;
        cs.steps.forEach((st, i) => {
          if (st.draw) st.draw(body.querySelector('#fig-' + i), ctx);
          body.querySelector('#take-' + i).innerHTML = `<p><strong>Ce qu’on retient.</strong> ${st.takeaway(ctx)}</p>`;
        });
        wireCopy(body);
        typeset(body);
      };
      $$('.case-tabs button', el).forEach((b) => b.addEventListener('click', () => load(b.dataset.case)));
      load(current);
    },
  });
})(window);
