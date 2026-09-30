/*
 * Chapitres 7 et 8 : évaluation des prévisions, laboratoire sur données utilisateur.
 */
(function (root) {
  'use strict';
  const { ctl, bind, val, num, int, block, formula, rCode, quiz, table, stats, pill, f2, fp, $, $$, timeAxis, esc,
    getDataset, addDataset, STATE, tick, wireCopy, copyText, datasetCsv } = root.UI;
  const { plot } = root.Charts;
  const CH = (root.CHAPTERS = root.CHAPTERS || []);
  const R = String.raw;

  const MODEL_COLORS = ['--s2', '--s3', '--s5', '--s4', '--ink-3', '--s1'];

  // Construit les prévisionnistes disponibles pour une série
  function forecasters(ds) {
    const m = ds.period, pos = ds.values.every((v) => v > 0), seasonal = m > 1;
    const list = [
      { id: 'naive', name: 'Naïf', fn: (x, h) => ({ mean: TS.baselines.naive(x, h) }) },
      { id: 'drift', name: 'Dérive', fn: (x, h) => ({ mean: TS.baselines.drift(x, h) }) },
    ];
    if (seasonal) list.push({ id: 'snaive', name: 'Naïf saisonnier', fn: (x, h) => ({ mean: TS.baselines.snaive(x, h, m) }) });
    list.push({ id: 'ses', name: 'Lissage simple', fn: (x, h) => TS.etsFit(x, {}).intervals(h) });
    if (seasonal) {
      list.push({ id: 'hw', name: `Holt-Winters ${pos ? 'multiplicatif' : 'additif'}`, fn: (x, h) => TS.etsFit(x, { trend: 'add', season: pos ? 'mul' : 'add', m }).intervals(h), minTrain: 2 * m + 2 });
    } else {
      list.push({ id: 'holt', name: 'Holt amorti', fn: (x, h) => TS.etsFit(x, { trend: 'damped' }).intervals(h) });
    }
    list.push({
      id: 'sarima', name: seasonal ? 'SARIMA auto' : 'ARIMA auto',
      fn: (x, h, ctx = {}) => {
        const lambda = pos ? 0 : null;
        let fit;
        if (ctx.order) fit = TS.sarimaFit(x, { ...ctx.order, lambda });
        else {
          const base = TS.boxcox(x, lambda);
          const D = seasonal ? TS.nsdiffs(x, m) : 0;
          const d = TS.ndiffs(D ? TS.diff(base, m) : base);
          fit = TS.autoSarima(x, { d, D, s: seasonal ? m : 1, lambda })[0];
          ctx.order = fit.order;
        }
        const f = fit.forecast(h);
        return { mean: f.mean, lo: f.lo, hi: f.hi, label: TS.orderLabel(fit.order) + (lambda === 0 ? ' log' : '') };
      },
      minTrain: seasonal ? 3 * m : 20,
    });
    return list;
  }

  root.TSModels = { forecasters, MODEL_COLORS };

  // ================================================================ 7. Évaluation
  CH.push({
    id: 'evaluation', title: 'Évaluer une prévision', short: 'Évaluation & validation',
    desc: 'Découpage chronologique, MAE, RMSE, MAPE, MASE, validation à origine glissante.',
    render(el) {
      const ds0 = getDataset('air');
      el.innerHTML = R`
      <header class="ch-head">
        <div class="eyebrow">Chapitre 7 · Pratique</div>
        <h1>Évaluer une prévision honnêtement</h1>
        <p class="lede">Un bon ajustement in-sample ne prouve rien. On juge un modèle sur des données qu’il n’a pas vues, en respectant la flèche du temps, et on le compare à des références naïves.</p>
      </header>

      ${block('Découpage chronologique', R`<div class="prose">
        <p>On coupe la série en un <strong>entraînement</strong> \(y_1,\dots,y_T\) et un <strong>test</strong> \(y_{T+1},\dots,y_{T+h}\). Toute décision (transformation, ordres, paramètres, choix entre modèles) doit être prise sur l’entraînement seul. Une normalisation calculée sur toute la série ou un choix d’ordre fait en regardant le test sont des fuites d’information.</p>
        <p>Un seul découpage est bruité. La <strong>validation à origine glissante</strong> (Tashman, 2000) répète l’exercice pour plusieurs origines \(T_0, T_0+1, \dots\) : on réestime à chaque origine et on moyenne les erreurs par horizon.</p>
      </div>`)}

      ${block('Métriques', R`<div class="grid-2">
        ${formula('Dépendantes de l’échelle', R`\[\text{MAE} = \frac1h\sum|e_{T+k}|,\qquad \text{RMSE} = \sqrt{\frac1h\sum e_{T+k}^2}\]<p class="small muted">MAE : optimale pour la médiane. RMSE : pour la moyenne, pénalise les grosses erreurs.</p>`)}
        ${formula('En pourcentage', R`\[\text{MAPE} = \frac{100}{h}\sum\Big|\frac{e_{T+k}}{y_{T+k}}\Big|\]<p class="small muted">Indéfinie si y = 0, asymétrique : elle favorise les sous-prévisions. Le sMAPE ne corrige que partiellement.</p>`)}
        ${formula('Erreur absolue moyenne mise à l’échelle (Hyndman & Koehler, 2006)', R`\[\text{MASE} = \frac{\text{MAE}}{\frac{1}{T-m}\sum_{t=m+1}^{T}|y_t - y_{t-m}|}\]<p class="small muted">Dénominateur : MAE in-sample du naïf saisonnier. MASE < 1 : mieux que cette référence. Comparable entre séries.</p>`)}
        ${formula('Couverture des intervalles', R`\[\text{couverture} = \frac1h\sum\mathbb 1\{\ell_{T+k}\le y_{T+k}\le u_{T+k}\}\]<p class="small muted">Doit approcher 95 % pour un IC à 95 %. Une couverture très inférieure signale des intervalles trop optimistes.</p>`)}
      </div>`)}

      ${block('Pratique : comparer des modèles sur l’échantillon test', R`<div class="panel" id="ev-panel">
        <div class="controls">
          ${ctl.series('ev-ds', 'air')}
          ${ctl.slider('ev-h', 'Taille du test h', 6, 48, 1, 24)}
          <button type="button" id="ev-run">Comparer</button>
        </div>
        <div id="ev-busy" class="busy"></div>
        <div id="ev-c1"></div>
        <div id="ev-table"></div>
      </div>`)}

      ${block('Pratique : validation à origine glissante', R`<div class="panel" id="cv-panel">
        <div class="controls">
          ${ctl.slider('cv-h', 'Horizon max.', 1, 24, 1, 12)}
          ${ctl.slider('cv-step', 'Pas entre origines', 1, 12, 1, 3)}
          <button type="button" id="cv-run">Lancer la validation croisée</button>
        </div>
        <p class="small muted">Utilise la série choisie ci-dessus. À chaque origine, chaque modèle est réestimé sur le passé seul (pour le SARIMA, les ordres sont choisis une fois sur la première fenêtre puis les coefficients sont réestimés).</p>
        <div id="cv-busy" class="busy"></div>
        <div id="cv-c1"></div>
        <div id="cv-table"></div>
      </div>`)}

      ${block('En R', rCode(
`library(forecast)
y <- AirPassengers
train <- window(y, end = c(1958, 12))
test  <- window(y, start = c(1959, 1))

prev <- list(
  naif_saisonnier = snaive(train, h = 24),
  holt_winters    = hw(train, seasonal = "multiplicative", h = 24),
  ets_auto        = forecast(ets(train), h = 24),
  sarima_auto     = forecast(auto.arima(train, lambda = 0), h = 24)
)
# accuracy() calcule la MASE avec le naïf saisonnier in-sample, comme l'atelier
t(sapply(prev, function(f) accuracy(f, test)["Test set", c("MAE", "RMSE", "MAPE", "MASE")]))

# Couverture de l'intervalle à 95 %
sapply(prev, function(f) mean(test >= f$lower[, "95%"] & test <= f$upper[, "95%"]))

# Validation à origine glissante : erreurs par horizon (matrice n × h)
f_hw <- function(x, h) hw(x, seasonal = "multiplicative", h = h)
e <- tsCV(y, f_hw, h = 12, initial = 72)
mae_par_h <- colMeans(abs(e), na.rm = TRUE)
plot(mae_par_h, type = "b", xlab = "horizon h", ylab = "MAE")
# Test de Diebold-Mariano entre deux modèles : dm.test(e1, e2, h = 1)`))}

      ${block('Vérifier', quiz([
        { q: 'Un modèle a une MASE de 1,3 sur le test. Qu’en déduire ?', opts: ['Il fait 30 % mieux que le naïf saisonnier', 'Son erreur absolue moyenne est 30 % plus grande que celle du naïf saisonnier in-sample', 'Il est biaisé'], a: 1, expl: 'MASE > 1 : pire que la référence naïve (mesurée in-sample). À ce stade le modèle n’apporte rien.' },
        { q: 'Pourquoi le k-fold aléatoire est-il inadapté ?', opts: ['Il est trop lent', 'Il entraîne sur des observations postérieures aux points prédits et casse la dépendance temporelle', 'Il ne donne pas de RMSE'], a: 1, expl: 'Le modèle « voit » le futur. Bergmeir & Benítez (2012) montrent qu’un k-fold peut rester acceptable pour des AR purs, mais le découpage chronologique est la règle.' },
        { q: 'Votre IC à 95 % ne couvre que 60 % des valeurs test. Cause probable ?', opts: ['L’incertitude sur les paramètres et le choix du modèle sont ignorés, ou les résidus ne sont pas bruit blanc', 'Le test est trop long', 'La MAPE est trop grande'], a: 0, expl: 'Les intervalles classiques supposent le modèle vrai et les paramètres connus. Vérifiez aussi l’hétéroscédasticité et la normalité des résidus.' },
      ]))}
      `;
      el.querySelector('#ev-h').value = Math.min(24, 2 * ds0.period);

      let lastDs = null;
      const run = async () => {
        const ds = getDataset(val('ev-ds')); lastDs = ds;
        const h = Math.min(int('ev-h'), Math.floor(ds.values.length / 3));
        const busy = el.querySelector('#ev-busy'); busy.textContent = 'Estimation des modèles…';
        await tick();
        const n = ds.values.length, T = n - h;
        const train = ds.values.slice(0, T), test = ds.values.slice(T);
        const fcs = [];
        for (const f of forecasters(ds)) {
          if (f.minTrain && train.length < f.minTrain) continue;
          try { const r = f.fn(train, h); fcs.push({ ...f, ...r, name: r.label ? `${f.name} · ${r.label}` : f.name }); } catch (e) { /* ignoré */ }
          await tick();
        }
        busy.textContent = '';
        const ax = timeAxis(ds);
        const from = Math.max(0, T - 4 * h);
        const xsT = Array.from({ length: T - from }, (_, i) => from + i), xsF = Array.from({ length: h }, (_, k) => T + k);
        plot(el.querySelector('#ev-c1'), { title: `Entraînement (fin) · test des ${h} dernières observations`, height: 320, xLabel: ax.label, xTicks: ax.ticks,
          layers: [
            { type: 'shade', from: T - 0.5, to: n - 0.5, label: 'test' },
            { type: 'line', x: xsT, y: train.slice(from), name: 'Entraînement', color: '--s1', width: 1.6 },
            { type: 'line', x: xsF, y: test, name: 'Test (réel)', color: '--s1', width: 2.4 },
            ...fcs.map((f, i) => ({ type: 'line', x: xsF, y: f.mean, name: f.name, color: MODEL_COLORS[i % MODEL_COLORS.length], dash: true, width: 1.8 })),
          ] });
        const rows = fcs.map((f) => {
          const m = TS.metrics(test, f.mean, train, ds.period > 1 ? ds.period : 1);
          const cov = f.lo ? test.filter((v, k) => v >= f.lo[k] && v <= f.hi[k]).length / h : null;
          return { f, m, cov };
        }).sort((a, b) => a.m.MASE - b.m.MASE);
        el.querySelector('#ev-table').innerHTML = table(['Modèle', 'MAE', 'RMSE', 'MAPE %', 'MASE', 'Couverture IC 95 %'],
          rows.map((r) => [esc(r.f.name), f2(r.m.MAE, 2), f2(r.m.RMSE, 2), f2(r.m.MAPE, 2), f2(r.m.MASE, 3), r.cov === null ? '—' : `${f2(100 * r.cov, 0)} %`]),
          { numCols: [1, 2, 3, 4, 5], rowClass: (_, i) => (i === 0 ? 'best' : '') }) +
          `<p class="small muted">Trié par MASE (dénominateur : naïf ${ds.period > 1 ? 'saisonnier' : 'simple'} in-sample sur l’entraînement). Sur un seul découpage, des écarts de quelques pourcents ne sont pas significatifs : voir la validation glissante ci-dessous, ou le test de Diebold-Mariano.</p>`;
      };

      const runCv = async (ev) => {
        const btn = ev.currentTarget; btn.disabled = true;
        const ds = lastDs || getDataset(val('ev-ds'));
        const H = int('cv-h'), step = int('cv-step');
        const busy = el.querySelector('#cv-busy');
        const fl = forecasters(ds).filter((f) => f.id !== 'drift');
        const minTrain = Math.max(ds.period > 1 ? 4 * ds.period : 30, Math.floor(ds.values.length / 2));
        const curves = [];
        for (let i = 0; i < fl.length; i++) {
          busy.textContent = `Validation : ${fl[i].name} (${i + 1}/${fl.length})…`;
          await tick();
          const ctx = {};
          try { curves.push({ name: fl[i].name, mae: TS.rollingOrigin(ds.values, (x, h) => fl[i].fn(x, h, ctx).mean, { h: H, minTrain, step }), label: ctx.order ? TS.orderLabel(ctx.order) : '' }); } catch (e) { /* ignoré */ }
        }
        const nOrig = Math.floor((ds.values.length - 1 - minTrain) / step) + 1;
        busy.textContent = `${nOrig} origines, de t = ${minTrain} à t = ${ds.values.length - 1}.`;
        btn.disabled = false;
        const hs = Array.from({ length: H }, (_, k) => k + 1);
        plot(el.querySelector('#cv-c1'), { title: 'MAE moyenne selon l’horizon de prévision', height: 280, xLabel: (v, full) => (full ? `h = ${Math.round(v)}` : String(Math.round(v))), xAxisTitle: 'horizon h',
          layers: curves.map((c, i) => ({ type: 'line', x: hs, y: c.mae, name: c.name + (c.label ? ` (${c.label})` : ''), color: MODEL_COLORS[i % MODEL_COLORS.length] })) });
        const avg = curves.map((c) => ({ c, m: TS.mean(c.mae.filter(isFinite)) })).sort((a, b) => a.m - b.m);
        el.querySelector('#cv-table').innerHTML = table(['Modèle', 'MAE moyenne (tous horizons)', 'MAE à h = 1', `MAE à h = ${H}`],
          avg.map((a) => [esc(a.c.name + (a.c.label ? ` (${a.c.label})` : '')), f2(a.m, 2), f2(a.c.mae[0], 2), f2(a.c.mae[H - 1], 2)]), { numCols: [1, 2, 3], rowClass: (_, i) => (i === 0 ? 'best' : '') });
      };

      el.querySelector('#ev-run').addEventListener('click', run);
      el.querySelector('#ev-ds').addEventListener('change', () => { const ds = getDataset(val('ev-ds')); el.querySelector('#ev-h').value = ds.period > 1 ? Math.min(48, 2 * ds.period) : 20; el.querySelector('#ev-h-out').textContent = el.querySelector('#ev-h').value; run(); });
      el.querySelector('#ev-h').addEventListener('input', (e) => { el.querySelector('#ev-h-out').textContent = e.target.value; });
      el.querySelector('#ev-h').addEventListener('change', run);
      el.querySelector('#cv-run').addEventListener('click', runCv);
      el.querySelector('#ev-h-out').textContent = el.querySelector('#ev-h').value;
      run();
    },
  });

  // ================================================================ 8. Laboratoire
  function parseNumber(s) {
    if (s === undefined) return NaN;
    s = String(s).trim().replace(/\s/g, '').replace(/^"|"$/g, '');
    if (s === '' || /^(na|nan|null|-)$/i.test(s)) return NaN;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(',', '.');
    return Number(s);
  }
  function parseDate(s) {
    s = String(s || '').trim().replace(/^"|"$/g, '');
    let m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
    if ((m = s.match(/^(\d{4})[-/](\d{1,2})$/))) return Date.UTC(+m[1], +m[2] - 1, 1);
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
    if ((m = s.match(/^(\d{4})[-\s]?Q([1-4])$/i))) return Date.UTC(+m[1], (+m[2] - 1) * 3, 1);
    if ((m = s.match(/^(\d{4})$/))) return Date.UTC(+m[1], 0, 1);
    const t = Date.parse(s);
    return isNaN(t) ? null : t;
  }
  function parseCsv(text) {
    const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '');
    if (!lines.length) return null;
    const first = lines[0];
    const delim = ['\t', ';', ','].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = lines.map((l) => l.split(delim).map((c) => c.trim()));
    const header = rows[0].some((c) => c !== '' && isNaN(parseNumber(c)) && parseDate(c) === null);
    const ncol = Math.max(...rows.map((r) => r.length));
    const names = header ? rows[0].map((c, i) => c.replace(/^"|"$/g, '') || `col${i + 1}`) : Array.from({ length: ncol }, (_, i) => `col${i + 1}`);
    return { names, rows: header ? rows.slice(1) : rows };
  }
  function detectFreq(times) {
    const d = [];
    for (let i = 1; i < times.length; i++) d.push((times[i] - times[i - 1]) / 86400000);
    const med = TS.quantile(d, 0.5);
    if (med < 1.5) return ['D', 7];
    if (med < 8) return ['W', 52];
    if (med < 40) return ['M', 12];
    if (med < 100) return ['Q', 4];
    return ['Y', 1];
  }
  function fmtDate(t, freq) {
    const d = new Date(t), y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
    if (freq === 'M') return `${y}-${String(m).padStart(2, '0')}`;
    if (freq === 'Q') return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
    if (freq === 'Y') return String(y);
    return d.toISOString().slice(0, 10);
  }

  function labR(ds, plan, best, H) {
    const s = ds.period > 1 ? ds.period : 1;
    const lam = plan.lambda === null ? 'NULL' : String(plan.lambda);
    const col = /^[A-Za-z.][A-Za-z0-9._]*$/.test(plan.valueName) ? `df$${plan.valueName}` : `df[["${plan.valueName}"]]`;
    const pos = ds.values.every((v) => v > 0);
    const o = best.order;
    const model = {
      sarima: o ? `fit <- Arima(y, order = c(${o.p}, ${o.d}, ${o.q})${s > 1 ? `, seasonal = list(order = c(${o.P}, ${o.D}, ${o.Q}), period = ${s})` : ''},
             lambda = ${lam})
summary(fit)
checkresiduals(fit)                     # résidus, ACF, Ljung-Box
fc <- forecast(fit, h = ${H}, level = 95)` : `fc <- forecast(auto.arima(y, lambda = ${lam}), h = ${H}, level = 95)`,
      hw: `fc <- hw(y, seasonal = "${pos ? 'multiplicative' : 'additive'}", h = ${H}, level = 95)`,
      snaive: `fc <- snaive(y, h = ${H}, level = 95)`,
      holt: `fc <- holt(y, damped = TRUE, h = ${H}, level = 95)`,
      ses: `fc <- ses(y, h = ${H}, level = 95)`,
      drift: `fc <- rwf(y, drift = TRUE, h = ${H}, level = 95)`,
      naive: `fc <- naive(y, h = ${H}, level = 95)`,
    }[best.id];
    return `library(forecast); library(tseries)

df <- read.csv("mes_donnees.csv")         # adaptez le nom du fichier (sep = ";", dec = "," si besoin)
y  <- ts(${col}, start = ${root.UI.rStart(ds)}, frequency = ${s})
y  <- na.interp(y)                        # valeurs manquantes : interpolation
autoplot(y)
${s > 1 ? `
# 1. Structure : décomposition STL${pos ? ' du logarithme' : ''}
plot(stl(${pos ? 'log(y)' : 'y'}, s.window = 13, robust = TRUE))
` : ''}
# 2. Stationnarité : ${plan.lambda === null ? 'pas de transformation' : plan.lambda === 0 ? 'logarithme' : 'Box-Cox, lambda = ' + plan.lambda}, d = ${plan.d}, D = ${plan.D}
lambda <- ${lam}
z <- ${plan.lambda === null ? 'y' : 'BoxCox(y, lambda)'}
w <- z${plan.d ? `\nw <- diff(w, differences = ${plan.d})` : ''}${plan.D ? `\nw <- diff(w, lag = ${s}, differences = ${plan.D})` : ''}
adf.test(w); kpss.test(w)
ggtsdisplay(w, lag.max = ${s > 1 ? 3 * s : 30})   # série + ACF + PACF
ndiffs(z); ${s > 1 ? 'nsdiffs(z)' : ''}

# 3. Modèle retenu par l'atelier : ${best.name}
${model}
autoplot(fc)
print(fc)
write.csv(as.data.frame(fc), "prevision.csv")`;
  }

  CH.push({
    id: 'labo', title: 'Laboratoire', short: 'Labo : vos données',
    desc: 'Importez un CSV : diagnostic, choix automatique du modèle, prévision exportable.',
    render(el) {
      el.innerHTML = R`
      <header class="ch-head">
        <div class="eyebrow">Chapitre 8 · Pratique pure</div>
        <h1>Laboratoire : de vos données brutes à une prévision</h1>
        <p class="lede">Collez ou importez un CSV. L’atelier enchaîne le diagnostic, la stationnarisation, la sélection de modèle sur un échantillon test et la prévision finale, puis génère le script R correspondant.</p>
      </header>

      <div class="panel">
        <div class="dropzone" id="lab-drop">
          <div class="controls">
            <label class="ctl" for="lab-file"><span>Fichier CSV</span><input type="file" id="lab-file" accept=".csv,.txt,.tsv,text/csv" data-nobind></label>
            <button type="button" class="ghost" id="lab-example">Charger l’exemple (AirPassengers)</button>
          </div>
          <label class="ctl" for="lab-text"><span>… ou collez les données (séparateur , ; ou tabulation, avec ou sans en-tête)</span>
            <textarea id="lab-text" data-nobind spellcheck="false"></textarea></label>
          <p class="small muted">Les données restent dans votre navigateur. Formats de date reconnus : AAAA-MM-JJ, AAAA-MM, JJ/MM/AAAA, AAAA-Q1, AAAA.</p>
        </div>
        <div class="controls" id="lab-cols"></div>
        <div id="lab-msg"></div>
      </div>

      <div id="lab-out" class="chapter" style="gap:22px"></div>
      `;

      const textEl = el.querySelector('#lab-text');
      const colsEl = el.querySelector('#lab-cols');
      let parsed = null;

      const loadText = (text, name = 'Vos données') => {
        textEl.value = text;
        parsed = parseCsv(text);
        if (!parsed || !parsed.rows.length) { colsEl.innerHTML = ''; el.querySelector('#lab-msg').innerHTML = '<div class="callout warn"><p>Aucune ligne lisible.</p></div>'; return; }
        parsed.label = name;
        const opts = parsed.names.map((nm, i) => [i, nm]);
        const dateGuess = parsed.names.findIndex((_, i) => parsed.rows.slice(0, 5).every((r) => parseDate(r[i]) !== null && isNaN(parseNumber(r[i])) || /^\d{4}(-\d{2})?$/.test(r[i] || '')));
        const valGuess = parsed.names.findIndex((_, i) => i !== dateGuess && parsed.rows.slice(0, 5).some((r) => !isNaN(parseNumber(r[i]))));
        colsEl.innerHTML = ctl.select('lab-date', 'Colonne de date', [[-1, '(aucune : index 1, 2, …)'], ...opts], dateGuess) +
          ctl.select('lab-val', 'Colonne de valeurs', opts, valGuess < 0 ? 0 : valGuess) +
          ctl.select('lab-freq', 'Fréquence', [['auto', 'détection automatique'], ['D', 'journalière'], ['W', 'hebdomadaire'], ['M', 'mensuelle'], ['Q', 'trimestrielle'], ['Y', 'annuelle'], ['none', 'aucune']], 'auto') +
          ctl.number('lab-per', 'Période saisonnière s', 0, 0, 400) +
          ctl.number('lab-H', 'Horizon de prévision', 0, 1, 500) +
          '<button type="button" id="lab-run">Lancer l’analyse complète</button>';
        el.querySelector('#lab-per').value = '';
        el.querySelector('#lab-H').value = '';
        el.querySelector('#lab-run').addEventListener('click', analyse);
        el.querySelector('#lab-msg').innerHTML = `<p class="small">${parsed.rows.length} lignes, ${parsed.names.length} colonnes. Vérifiez les colonnes puis lancez l’analyse. Laissez s et l’horizon vides pour les valeurs automatiques.</p>`;
      };

      el.querySelector('#lab-example').addEventListener('click', () => { loadText(datasetCsv(getDataset('air')), 'AirPassengers (exemple)'); analyse(); });
      el.querySelector('#lab-file').addEventListener('change', (e) => {
        const f = e.target.files[0]; if (!f) return;
        const r = new FileReader(); r.onload = () => loadText(String(r.result), f.name.replace(/\.[^.]+$/, '')); r.readAsText(f);
      });
      textEl.addEventListener('change', () => loadText(textEl.value));
      const drop = el.querySelector('#lab-drop');
      drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('over'));
      drop.addEventListener('drop', (e) => {
        e.preventDefault(); drop.classList.remove('over');
        const f = e.dataTransfer.files[0]; if (!f) return;
        const r = new FileReader(); r.onload = () => loadText(String(r.result), f.name.replace(/\.[^.]+$/, '')); r.readAsText(f);
      });

      async function analyse() {
        const out = el.querySelector('#lab-out');
        const msg = el.querySelector('#lab-msg');
        const di = int('lab-date'), vi = int('lab-val');
        let recs = parsed.rows.map((r) => ({ t: di >= 0 ? parseDate(r[di]) : null, v: parseNumber(r[vi]) }));
        if (di >= 0) {
          const bad = recs.filter((r) => r.t === null).length;
          recs = recs.filter((r) => r.t !== null).sort((a, b) => a.t - b.t);
          if (bad) msg.innerHTML = `<div class="callout warn"><p>${bad} ligne(s) sans date lisible ont été ignorées.</p></div>`;
        }
        // Interpolation linéaire des valeurs manquantes
        const vals = recs.map((r) => r.v);
        let missing = 0;
        for (let i = 0; i < vals.length; i++) if (!isFinite(vals[i])) {
          missing++;
          let a = i - 1; while (a >= 0 && !isFinite(vals[a])) a--;
          let b = i + 1; while (b < vals.length && !isFinite(vals[b])) b++;
          vals[i] = a < 0 ? vals[b] : b >= vals.length ? vals[a] : vals[a] + ((vals[b] - vals[a]) * (i - a)) / (b - a);
        }
        if (vals.length < 16 || vals.some((v) => !isFinite(v))) { msg.innerHTML = '<div class="callout bad"><p>Il faut au moins 16 valeurs numériques. Vérifiez la colonne de valeurs et le séparateur décimal.</p></div>'; return; }
        let freq = val('lab-freq'), period = parseInt(val('lab-per'), 10);
        let dates = null;
        if (di >= 0) {
          const [fq, pr] = detectFreq(recs.map((r) => r.t));
          if (freq === 'auto') freq = fq;
          if (!(period >= 0)) period = freq === fq ? pr : { D: 7, W: 52, M: 12, Q: 4, Y: 1 }[freq] || 1;
          if (freq !== 'none') dates = recs.map((r) => fmtDate(r.t, freq));
        } else { if (!(period >= 0)) period = 1; freq = null; }
        if (freq === 'none') freq = null;
        if (period < 2 || vals.length < 2 * period + 2) period = 1;
        const ds = { id: 'user', name: `Vos données : ${parsed.label}`, short: parsed.label, values: vals, dates, freq, period, unit: '', note: 'Importées dans le laboratoire.' };
        addDataset(ds);
        const n = vals.length;
        let H = parseInt(val('lab-H'), 10);
        if (!(H > 0)) H = period > 1 ? 2 * period : Math.max(5, Math.round(n / 10));

        out.innerHTML = '<p class="busy">Analyse en cours…</p>';
        await tick();
        const ax = timeAxis(ds, H);
        const xs = vals.map((_, i) => i);
        const pos = vals.every((v) => v > 0);
        const sec = (title, inner) => `<section class="panel"><h2>${title}</h2>${inner}</section>`;
        let html = '';

        // 1. Aperçu
        html += sec('1 · Aperçu', stats([['Observations', n], ['Valeurs interpolées', missing], ['Fréquence', freq ? { D: 'journalière', W: 'hebdomadaire', M: 'mensuelle', Q: 'trimestrielle', Y: 'annuelle' }[freq] : 'index'], ['Période s', period > 1 ? period : 'aucune'],
          ['Moyenne', f2(TS.mean(vals), 2)], ['Écart-type', f2(TS.std(vals, 1), 2)], ['Min', f2(Math.min(...vals), 2)], ['Max', f2(Math.max(...vals), 2)]]) + '<div id="lab-c1"></div>' +
          '<p class="small muted">La série est désormais disponible sous le nom « Vos données » dans tous les chapitres.</p>');

        // 2. Structure
        let dcp = null;
        if (period > 1) {
          dcp = TS.decompose(pos ? vals.map(Math.log) : vals, period, 'additive');
          html += sec('2 · Structure', `<p>Décomposition classique ${pos ? 'du logarithme' : ''} avec s = ${period} : force de tendance <strong>F<sub>T</sub> = ${f2(dcp.strengthTrend, 2)}</strong>, force saisonnière <strong>F<sub>S</sub> = ${f2(dcp.strengthSeason, 2)}</strong>.</p><div class="grid-2"><div id="lab-c2"></div><div id="lab-c3"></div></div>`);
        } else html += sec('2 · Structure', '<p>Pas de période saisonnière retenue (fréquence inconnue, annuelle, ou série trop courte). Seule la tendance est examinée.</p>');

        // 3. Stationnarité
        const lamHat = pos ? TS.boxcoxLambda(vals) : null;
        let lambda = null;
        if (pos) lambda = Math.abs(lamHat) < 0.25 ? 0 : Math.abs(lamHat - 1) < 0.25 ? null : Math.round(lamHat * 100) / 100;
        const base = TS.boxcox(vals, lambda);
        const D = period > 1 ? TS.nsdiffs(vals, period) : 0;
        const d = TS.ndiffs(D ? TS.diff(base, period) : base);
        let w = TS.diff(base, 1, d); if (D) w = TS.diff(w, period, D);
        const adfR = TS.adf(w), kpssR = TS.kpss(w);
        html += sec('3 · Stationnarité', `<p>Transformation retenue : <strong>${lambda === null ? 'aucune' : lambda === 0 ? 'logarithme' : `Box-Cox λ = ${f2(lambda, 2)}`}</strong>${pos ? ` (λ̂ = ${f2(lamHat, 2)} ; arrondi à 0 ou 1 s’il en est proche, pour l’interprétabilité)` : ' (valeurs non positives : pas de Box-Cox)'}.
          Différences : <strong>d = ${d}</strong> (KPSS itéré) et <strong>D = ${D}</strong>${period > 1 ? ` (force saisonnière ${dcp.strengthSeason > 0.64 ? '> 0,64' : '≤ 0,64'})` : ''}.</p>` +
          table(['Test sur W_t', 'Statistique', 'p-valeur', 'Décision'], [
            ['ADF (H0 : racine unitaire)', f2(adfR.stat, 3), fp(adfR.pvalue), adfR.pvalue < 0.05 ? pill('good', 'stationnaire') : pill('warn', 'non rejetée')],
            ['KPSS (H0 : stationnarité)', f2(kpssR.stat, 3), (kpssR.bound ? kpssR.bound + ' ' : '') + fp(kpssR.pvalue), kpssR.pvalue < 0.05 ? pill('bad', 'rejetée') : pill('good', 'non rejetée')],
          ], { numCols: [1, 2] }) + '<div id="lab-c4"></div><div class="grid-2"><div id="lab-c5"></div><div id="lab-c6"></div></div>');

        // 4. Sélection de modèle sur test
        const hTest = Math.min(period > 1 ? period * 2 : Math.max(5, Math.round(n / 5)), Math.floor(n / 4));
        const T = n - hTest, train = vals.slice(0, T), test = vals.slice(T);
        const res = [];
        for (const f of forecasters(ds)) {
          if (f.minTrain && train.length < f.minTrain) continue;
          try {
            const ctx = {};
            const r = f.fn(train, hTest, ctx);
            res.push({ f, r, ctx, m: TS.metrics(test, r.mean, train, period > 1 ? period : 1), cov: r.lo ? test.filter((v, k) => v >= r.lo[k] && v <= r.hi[k]).length / hTest : null });
          } catch (e) { /* modèle non estimable */ }
          out.querySelector('.busy') && (out.querySelector('.busy').textContent = `Analyse en cours… (${f.name})`);
          await tick();
        }
        res.sort((a, b) => a.m.MASE - b.m.MASE);
        const best = res[0];
        html += sec('4 · Sélection du modèle sur un échantillon test', `<p>Les ${hTest} dernières observations sont mises de côté ; chaque modèle est estimé sur les ${T} premières.</p>` +
          table(['Modèle', 'MAE', 'RMSE', 'MAPE %', 'MASE', 'Couverture IC 95 %'], res.map((x) => [esc(x.f.name + (x.r.label ? ` · ${x.r.label}` : '')), f2(x.m.MAE, 2), f2(x.m.RMSE, 2), f2(x.m.MAPE, 2), f2(x.m.MASE, 3), x.cov === null ? '—' : `${f2(100 * x.cov, 0)} %`]),
            { numCols: [1, 2, 3, 4, 5], rowClass: (_, i) => (i === 0 ? 'best' : '') }) + '<div id="lab-c7"></div>');

        // 5. Prévision finale : modèle retenu réestimé sur toute la série
        const ctxFull = {};
        const finalFc = best.f.fn(vals, H, ctxFull);
        const fDates = ds.dates ? root.TSData.extendDates(ds.dates, freq, H) : null;
        const rows = finalFc.mean.map((v, k) => [fDates ? fDates[k] : `t = ${n + k + 1}`, f2(v, 2), finalFc.lo ? f2(finalFc.lo[k], 2) : '—', finalFc.hi ? f2(finalFc.hi[k], 2) : '—']);
        const csv = 'date,prevision,ic95_bas,ic95_haut\n' + finalFc.mean.map((v, k) => `${fDates ? fDates[k] : n + k + 1},${v.toFixed(4)},${finalFc.lo ? finalFc.lo[k].toFixed(4) : ''},${finalFc.hi ? finalFc.hi[k].toFixed(4) : ''}`).join('\n');
        html += sec('5 · Prévision finale', `<p>Modèle retenu (meilleure MASE) : <strong>${esc(best.f.name)}${finalFc.label ? ` · ${finalFc.label}` : ''}</strong>, réestimé sur les ${n} observations.</p><div id="lab-c8"></div>
          <div class="controls"><button type="button" id="lab-copy" class="ghost">Copier la prévision (CSV)</button><button type="button" id="lab-dl" class="ghost">Télécharger le CSV</button></div>
          ${table(['Date', 'Prévision', 'IC 95 % bas', 'IC 95 % haut'], rows.slice(0, 60), { numCols: [1, 2, 3] })}`);

        // 6. Script
        const plan = { lambda, d, D, hasDates: di >= 0, dateName: di >= 0 ? parsed.names[di] : '', valueName: parsed.names[vi] };
        html += sec('6 · Script R reproductible', rCode(labR(ds, plan, { id: best.f.id, name: best.f.name, order: ctxFull.order || best.ctx.order }, H)));
        out.innerHTML = html;
        wireCopy(out);

        // Graphiques
        plot(out.querySelector('#lab-c1'), { title: ds.name, height: 260, xLabel: ax.label, xTicks: ax.ticks, layers: [{ type: 'line', x: xs, y: vals, name: 'Série', color: '--s1', width: 1.6 }] });
        if (dcp) {
          const t2 = pos ? dcp.trend.map((v) => (v === null ? null : Math.exp(v))) : dcp.trend;
          plot(out.querySelector('#lab-c2'), { title: 'Tendance (2×s-MA)', height: 200, xLabel: ax.label, xTicks: ax.ticks,
            layers: [{ type: 'line', x: xs, y: vals, name: 'Série', color: '--ink-3', width: 1 }, { type: 'line', x: xs, y: t2, name: 'Tendance', color: '--s2' }] });
          plot(out.querySelector('#lab-c3'), { title: `Profil saisonnier${pos ? ' (log)' : ''}`, height: 200, xLabel: (j) => String(Math.round(j) + 1),
            layers: [{ type: 'bar', x: dcp.figure.map((_, j) => j), y: dcp.figure, name: 'coefficient', color: '--s3' }, { type: 'hline', value: 0 }] });
        }
        const offW = n - w.length;
        plot(out.querySelector('#lab-c4'), { title: 'Série stationnarisée W_t', height: 200, xLabel: ax.label, xTicks: ax.ticks,
          layers: [{ type: 'line', x: w.map((_, i) => i + offW), y: w, name: 'W_t', color: '--s1', width: 1.3 }, { type: 'hline', value: 0 }] });
        const L = Math.min(period > 1 ? 3 * period : 30, w.length - 2), band = 1.96 / Math.sqrt(w.length);
        const ra = TS.acf(w, L).slice(1), pa = TS.pacf(w, L).slice(1), lg = ra.map((_, i) => i + 1);
        const acfOpts = (y, t) => ({ title: t, height: 200, yMin: -1, yMax: 1, xLabel: (v) => String(Math.round(v)),
          layers: [{ type: 'hline', value: band }, { type: 'hline', value: -band }, { type: 'hline', value: 0, dash: false },
            { type: 'stem', x: lg, y, name: t, color: '--s1', colorFn: (v) => (Math.abs(v) > band ? '--s1' : '--ink-3') }] });
        plot(out.querySelector('#lab-c5'), acfOpts(ra, 'ACF de W_t'));
        plot(out.querySelector('#lab-c6'), acfOpts(pa, 'PACF de W_t'));
        const from = Math.max(0, T - 3 * hTest), xsF = Array.from({ length: hTest }, (_, k) => T + k);
        plot(out.querySelector('#lab-c7'), { title: 'Prévisions sur l’échantillon test', height: 280, xLabel: ax.label, xTicks: ax.ticks,
          layers: [{ type: 'shade', from: T - 0.5, to: n - 0.5, label: 'test' },
            { type: 'line', x: xs.slice(from), y: vals.slice(from), name: 'Observé', color: '--s1', width: 1.8 },
            ...res.map((x, i) => ({ type: 'line', x: xsF, y: x.r.mean, name: x.f.name, color: MODEL_COLORS[i % MODEL_COLORS.length], dash: true, width: 1.6 }))] });
        const xf = Array.from({ length: H }, (_, k) => n + k);
        plot(out.querySelector('#lab-c8'), { title: `Prévision à ${H} pas`, height: 300, xLabel: ax.label, xTicks: ax.ticks,
          layers: [{ type: 'shade', from: n - 0.5, to: n + H, label: 'prévision' },
            finalFc.lo ? { type: 'band', x: [n - 1, ...xf], lo: [vals[n - 1], ...finalFc.lo], hi: [vals[n - 1], ...finalFc.hi], name: 'IC 95 %', color: '--s2', of: 'Prévision' } : null,
            { type: 'line', x: xs, y: vals, name: 'Observé', color: '--s1', width: 1.6 },
            { type: 'line', x: [n - 1, ...xf], y: [vals[n - 1], ...finalFc.mean], name: 'Prévision', color: '--s2' }] });
        out.querySelector('#lab-copy').addEventListener('click', (e) => copyText(csv, e.currentTarget, null));
        out.querySelector('#lab-dl').addEventListener('click', () => {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
          a.download = 'prevision.csv'; document.body.appendChild(a); a.click(); a.remove();
        });
        root.UI.typeset(out);
      }

      // Démarrage : exemple préchargé, clairement signalé
      loadText(datasetCsv(getDataset('air')), 'AirPassengers (exemple)');
      analyse();
    },
  });
})(window);
