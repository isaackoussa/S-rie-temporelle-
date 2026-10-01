/*
 * Cours M2 GRAF : §5 Estimation et élimination de la tendance et de la saisonnalité, §6 TP 3.
 */
(function (root) {
  'use strict';
  const { ctl, bind, val, num, int, block, formula, rCode, quiz, table, stats, pill, f2, fp, esc, MOIS } = root.UI;
  const { plot } = root.Charts;
  const { SERIES, axis, line, acfChart, exo, tpq, head, tpSeries } = root.Cours;
  const CH = (root.CHAPTERS = root.CHAPTERS || []);
  const R = String.raw;

  function polyFit(x, deg) {
    const X = x.map((_, i) => Array.from({ length: deg + 1 }, (_, k) => (i + 1) ** k));
    const f = TS.ols(X, x);
    return { coef: f.beta, trend: X.map((r) => r.reduce((s, v, k) => s + v * f.beta[k], 0)), resid: f.resid };
  }
  const fig17 = (n = 120, seed = 2) => { const g = TS.gaussianRng(seed); return Array.from({ length: n }, (_, i) => 2 * (i + 1) + 3 * Math.cos(((i + 1) * Math.PI) / 6) + g()); };

  // ================================================================ §5
  CH.push({
    id: 'c5', icon: 'stationnarite', short: '5 · Tendance et saisonnalité',
    render(el) {
      el.innerHTML = head('Cours §5 · Estimation et élimination de la tendance et de la saisonnalité', 'Retirer la tendance et la saisonnalité',
        'Une série observée est la réalisation d’un processus \\((X_t)\\). Démarche : représenter la série, estimer et supprimer la partie déterministe (tendance, saison), modéliser le résidu aléatoire, puis prévoir.') + `

      ${block('5.1–5.2 Bruit blanc et stationnarité', `<div class="grid-2">
        ${formula('Définition 1 · bruit blanc', R`<p class="small">Suite de variables aléatoires \((X_t)\) indépendantes, d’espérance et de variance constantes. Centré si l’espérance est nulle, gaussien si les \(X_t\) sont gaussiennes.</p>`)}
        ${formula('Processus stationnaire', R`\[\mathbb E[X_t] = \mu\ \ \forall t,\qquad \operatorname{Cov}(X_t, X_{t+h}) = \sigma(h)\ \ \forall t,h\]\[\rho(h) = \frac{\sigma(h)}{\sigma(0)}\]`)}</div>` +
        exo(7, 'Montrer que \\(\\sigma(h) = \\sigma(-h)\\).', R`<p>Par stationnarité, la covariance est invariante par translation du temps. En translatant de \(-h\) puis par symétrie de la covariance :
        \(\sigma(-h) = \operatorname{Cov}(X_t, X_{t-h}) = \operatorname{Cov}(X_{t+h}, X_t) = \operatorname{Cov}(X_t, X_{t+h}) = \sigma(h)\). L’auto-covariance est une fonction paire : on ne la trace que pour \(h \ge 0\).</p>`))}

      ${block('5.3 Estimation paramétrique de la tendance', R`<div class="prose"><p>Modèle \(X_t = m_t + \epsilon_t\) avec \(m_t = a + bt\) estimé par moindres carrés, \(\min_{a,b}\sum_{t=1}^n(x_t - a - bt)^2\) :</p></div>
        ${formula('', R`\[\hat a = \frac{6}{n(n-1)}\Big(\frac{2n+1}{3}\,n\bar x - \sum_{t=1}^n t\,x_t\Big),\qquad \hat b = \frac{12}{n(n^2-1)}\Big(\sum_{t=1}^n t\,x_t - \frac{n+1}{2}\,n\bar x\Big)\]`)}
        <div class="panel" id="p-panel"><div class="controls">${ctl.select('p-ser', 'Série', [['air', 'AirPassengers'], ['usacc', 'USAccDeaths'], ['co2', 'co2'], ['cac', 'CAC40'], ['X2', 'X2 = 0,5t + 2ε_t']], 'air')}${ctl.select('p-deg', 'Tendance', [['1', 'linéaire a + bt'], ['2', 'quadratique a + bt + ct²'], ['3', 'cubique']], '1')}</div>
          <div id="p-stats"></div><div class="grid-2"><div id="p-c1"></div><div id="p-c2"></div></div><div id="p-c3"></div></div>` +
        exo(8, 'Écrire le problème sous forme matricielle… et le résoudre.', R`
          <p>Avec \(\mathbf x = (x_1,\dots,x_n)^\top\), \(\mathbf X = \begin{pmatrix}1&1\\1&2\\\vdots&\vdots\\1&n\end{pmatrix}\) et \(\theta = (a,b)^\top\), on minimise \(\|\mathbf x - \mathbf X\theta\|^2\), d’où les équations normales \(\mathbf X^\top\mathbf X\,\hat\theta = \mathbf X^\top\mathbf x\) :</p>
          \[\begin{pmatrix} n & \frac{n(n+1)}{2}\\ \frac{n(n+1)}{2} & \frac{n(n+1)(2n+1)}{6}\end{pmatrix}\begin{pmatrix}\hat a\\ \hat b\end{pmatrix} = \begin{pmatrix} n\bar x\\ \sum t x_t\end{pmatrix}.\]
          <p>Le déterminant vaut \(\frac{n^2(n+1)(2n+1)}{6} - \frac{n^2(n+1)^2}{4} = \frac{n^2(n^2-1)}{12}\). En inversant la matrice 2×2 on obtient exactement les formules ci-dessus. Le panneau compare ces formules à la régression <code>lm</code> : elles coïncident.</p>`))}

      ${block('5.4 Estimation non paramétrique : moyenne mobile', `${formula('', R`\[\hat m_t = \frac{1}{2q+1}\sum_{k=-q}^{q}x_{t+k},\qquad x_t = x_1 \text{ si } t<1,\quad x_t = x_n \text{ si } t>n\]`)}
        <div class="panel" id="m-panel"><div class="controls">${ctl.select('m-ser', 'Série', [['usacc', 'USAccDeaths'], ['air', 'AirPassengers'], ['co2', 'co2'], ['cac', 'CAC40']], 'usacc')}${ctl.slider('m-q', 'q (fenêtre 2q + 1)', 1, 30, 1, 6)}</div><div id="m-c"></div><p class="small" id="m-t"></p></div>
        <div class="prose"><p><strong>Tendance et saisonnalité</strong>, \\(X_t = m_t + s_t + \\epsilon_t\\) : on estime la tendance moyenne sur une période, puis la saison en moyennant sur toutes les périodes les écarts à la tendance. C’est la fonction <code>decompose</code> de R, appliquée ci-dessous à USAccDeaths (figures 12 à 16 du cours).</p></div>
        <div class="panel"><div class="grid-2"><div id="d-f12"></div><div id="d-f13"></div><div id="d-f14"></div><div id="d-f15"></div></div><div id="d-f16"></div><p class="small" id="d-t"></p></div>`)}

      ${block('5.5 Élimination par la méthode des différences', `<div class="grid-2">
        ${formula('Opérateur', R`\[\Delta_T X_t = X_t - X_{t-T},\qquad \Delta = \Delta_1,\qquad \Delta_T^k = \underbrace{\Delta_T\circ\dots\circ\Delta_T}_{k\text{ fois}}\]`)}
        ${formula('Propositions 3 et 4', R`<p class="small">Si \(m_t\) est polynomiale de degré \(k\), \(\Delta X_t\) a une tendance de degré \(k-1\) : \(k\) différences l’éliminent.<br>Si \(X_t = m_t + s_t + \epsilon_t\) avec \(s_t\) de période \(T\), \(\Delta_T X_t = (m_t - m_{t-T}) + (\epsilon_t - \epsilon_{t-T})\) est désaisonnalisé, et sans tendance si \(m_t\) est linéaire.</p>`)}</div>
        <div class="panel" id="f-panel"><div class="controls">${ctl.select('f-ser', 'Série', [['fig17', 'x_t = 2t + 3cos(tπ/6) + ε_t (figure 17)'], ['air', 'AirPassengers'], ['usacc', 'USAccDeaths'], ['co2', 'co2']], 'fig17')}${ctl.number('f-d', 'Nombre de Δ', 1, 0, 3)}${ctl.number('f-D', 'Nombre de Δ₁₂', 1, 0, 2)}</div>
          <div class="grid-2"><div id="f-c1"></div><div id="f-c2"></div></div><p class="small" id="f-t"></p></div>` +
        exo(9, 'Faire la preuve de la proposition 3.', R`<p>Pour \(m_t = \sum_{j=0}^k a_jt^j\) : \(\Delta m_t = \sum_{j=0}^k a_j\big(t^j - (t-1)^j\big)\). Par la formule du binôme, \(t^j - (t-1)^j = jt^{j-1} - \binom j2 t^{j-2} + \dots\) est de degré \(j-1\). Le terme dominant devient \(k a_k t^{k-1}\) : \(\Delta m_t\) est de degré \(k-1\). La partie aléatoire \(\Delta\epsilon_t = \epsilon_t - \epsilon_{t-1}\) reste stationnaire. Après \(k\) différences, la tendance est la constante \(k!\,a_k\).</p>`) +
        exo(10, 'Faire la preuve de la proposition 4.', R`<p>\(\Delta_T X_t = (m_t - m_{t-T}) + (s_t - s_{t-T}) + (\epsilon_t - \epsilon_{t-T})\) et \(s_t - s_{t-T} = 0\) par périodicité : la saison disparaît. Si \(m_t = a + bt\), \(m_t - m_{t-T} = bT\) est une constante : la tendance disparaît aussi (il reste une moyenne \(bT\)). Si \(m_t\) est de degré \(k \ge 2\), \(m_t - m_{t-T}\) est de degré \(k-1\) (même calcul qu’à l’exercice 9) et on termine avec des \(\Delta\).</p>`))}

      ${block('5.6 Tester si la série résiduelle est un bruit blanc', `<div class="grid-2">
        ${formula('Par l’auto-corrélation', R`<p class="small">Pour un bruit blanc et \(n\) grand, \(\hat\rho(h) \approx \mathcal N(0, 1/n)\). Sur les 40 premières auto-corrélations, pas plus de 2 ou 3 en dehors de \(\pm 1{,}96/\sqrt n\).</p>`)}
        ${formula('Test du portemanteau', R`\[Q = n\sum_{j=1}^h\hat\rho^2(j) \;\;\text{(Box-Pierce)},\qquad Q_{LB} = n(n+2)\sum_{j=1}^h\frac{\hat\rho^2(j)}{n-j}\]<p class="small">Sous H0 (bruit blanc), \(Q \approx \chi^2_h\) : on rejette si \(Q > \chi^2_{h,1-\alpha}\). La correction de Ljung-Box approche mieux la loi \(\chi^2\) ; c’est le test de <code>Box.test</code>.</p>`)}</div>
        <div class="panel" id="b-panel"><div class="controls">${ctl.select('b-ser', 'Série résiduelle', [['bb', 'bruit blanc simulé (n = 100)'], ['ar', 'AR₁ faible, a = 0,3 (n = 100)'], ['usr', 'USAccDeaths − tendance − saison'], ['airdd', 'Δ Δ₁₂ AirPassengers'], ['airddl', 'Δ Δ₁₂ log AirPassengers']], 'usr')}${ctl.slider('b-H', 'H (nombre de retards testés)', 5, 40, 1, 20)}</div>
          <div class="grid-2"><div id="b-c1"></div><div id="b-tab"></div></div><div id="b-txt" class="callout"></div></div>`)}

      ${block('5.7 Mise en œuvre sous R', rCode(`x <- USAccDeaths
# Tendance linéaire par moindres carrés
t <- 1:length(x); fit <- lm(x ~ t); coef(fit)
plot(x); lines(ts(fitted(fit), start = start(x), frequency = 12), col = 2)

# Décomposition par moyenne mobile (figures 12 à 16)
m <- decompose(x, type = "additive")
plot(m$trend); plot(m$seasonal); plot(x - m$trend); plot(x - m$trend - m$seasonal)  # = m$random

# Moyenne mobile 2q + 1 avec bords répliqués, comme dans le cours
q <- 6; xe <- c(rep(x[1], q), x, rep(x[length(x)], q))
mm <- stats::filter(xe, rep(1 / (2 * q + 1), 2 * q + 1))[(q + 1):(q + length(x))]

# Différences : diff(serie, lag = T, differences = k)
bb <- ts(2 * (1:120) + 3 * cos((1:120) * pi / 6) + rnorm(120), frequency = 12)
par(mfrow = c(3, 1)); plot(bb); plot(diff(bb)); plot(diff(bb, lag = 12))

# Le résidu est-il un bruit blanc ?
acf(na.omit(m$random), lag.max = 40)
Box.test(na.omit(m$random), lag = 20)                       # Box-Pierce
Box.test(na.omit(m$random), lag = 20, type = "Ljung-Box")   # Ljung-Box`, 'R · §5.7'))}

      ${block('Vérifier', quiz([
        { q: 'On applique Δ₁₂ à une série X_t = 5 + 0,3t + s_t + ε_t (s_t de période 12). Que reste-t-il ?', opts: ['ε_t − ε_{t−12}', '3,6 + ε_t − ε_{t−12}', '0,3t + ε_t'], a: 1, expl: 'La saison s’annule et la tendance linéaire devient la constante 0,3 × 12 = 3,6.' },
        { q: 'Box.test(x, lag = 20) renvoie une p-valeur de 0,002. Conclusion ?', opts: ['x est un bruit blanc', 'On rejette l’hypothèse de bruit blanc : il reste de la dépendance à modéliser', 'Il faut plus de retards'], a: 1, expl: 'H0 = « les 20 premières auto-corrélations sont nulles ». p < 0,05 : rejet, la série résiduelle contient encore de la structure (à modéliser par un ARMA, §7).' },
      ]))}`;

      // 5.3
      const getS = (id) => (id === 'X2' ? { values: tpSeries('X2', 100, 4), dates: null, period: 1 } : SERIES[id]);
      const drawP = () => {
        const s = getS(val('p-ser')), x = s.values, deg = int('p-deg'), ax = axis(s);
        const pf = polyFit(x, deg), lt = TS.linearTrendCourse(x);
        el.querySelector('#p-stats').innerHTML = deg === 1
          ? stats([['â (formule du cours)', f2(lt.a, 4)], ['b̂ (formule du cours)', f2(lt.b, 5)], ['â (lm)', f2(pf.coef[0], 4)], ['b̂ (lm)', f2(pf.coef[1], 5)], ['moyenne des résidus', f2(TS.mean(pf.resid), 6)]])
          : stats(pf.coef.map((c, k) => [`coefficient de t^${k}`, f2(c, 6)]).concat([['moyenne des résidus', f2(TS.mean(pf.resid), 6)]]));
        plot(el.querySelector('#p-c1'), { title: 'Série et tendance estimée', height: 220, xLabel: ax.label, xTicks: ax.ticks, layers: [line(x, 'série', '--s1', 0, 1.3), line(pf.trend, 'tendance', '--s2', 0, 2)] });
        plot(el.querySelector('#p-c2'), { title: 'Série sans la tendance', height: 220, xLabel: ax.label, xTicks: ax.ticks, layers: [line(pf.resid, 'résidu', '--s1', 0, 1.2), { type: 'hline', value: 0 }] });
        const a = acfChart(el.querySelector('#p-c3'), pf.resid, 40, 'ACF du résidu (40 retards)');
      };
      bind(el.querySelector('#p-panel'), drawP, { debounce: 30 }); drawP();

      // 5.4
      const drawM = () => {
        const s = SERIES[val('m-ser')], q = int('m-q'), ax = axis(s), mm = TS.movingAverageCourse(s.values, q);
        plot(el.querySelector('#m-c'), { title: `Moyenne mobile d’ordre ${2 * q + 1}`, height: 240, xLabel: ax.label, xTicks: ax.ticks, layers: [line(s.values, 'série', '--s1', 0, 1.2), line(mm, 'm̂_t', '--s2', 0, 2.2)] });
        el.querySelector('#m-t').textContent = s.period > 1 && (2 * q + 1) % s.period !== 0
          ? `La fenêtre ${2 * q + 1} n’est pas un multiple de la période ${s.period} : la saison n’est pas entièrement filtrée (ondulations résiduelles). Essayez q = ${(s.period - 1) / 2 % 1 === 0 ? (s.period - 1) / 2 : s.period / 2} ou un multiple ; decompose utilise une 2×12-MA centrée.`
          : 'Plus q est grand, plus la tendance est lisse… et plus les bords, où l’on réplique x₁ et xₙ, sont biaisés.';
      };
      bind(el.querySelector('#m-panel'), drawM, { debounce: 30 }); drawM();

      // Figures 12 à 16
      const u = SERIES.usacc, ux = u.values, uax = axis(u), dc = TS.decompose(ux, 12, 'additive');
      const fig = (id, title, y) => plot(el.querySelector(id), { title, height: 180, xLabel: uax.label, xTicks: uax.ticks, layers: [line(y, title.split(' :')[0], '--s1', 0, 1.3)] });
      fig('#d-f12', 'Figure 12 : USAccDeaths', ux);
      fig('#d-f13', 'Figure 13 : tendance m$trend', dc.trend);
      fig('#d-f14', 'Figure 14 : saison m$seasonal', dc.seasonal);
      fig('#d-f15', 'Figure 15 : série − tendance', ux.map((v, i) => (dc.trend[i] === null ? null : v - dc.trend[i])));
      fig('#d-f16', 'Figure 16 : série − tendance − saison', dc.resid);
      const pk = dc.figure.indexOf(Math.max(...dc.figure)), lo = dc.figure.indexOf(Math.min(...dc.figure));
      el.querySelector('#d-t').innerHTML = `Saison estimée : pic en ${MOIS[pk]} (+${f2(dc.figure[pk], 0)} décès), creux en ${MOIS[lo]} (${f2(dc.figure[lo], 0)}). La série de la figure 16 est supposée stationnaire ; le §5.6 teste si c’est un bruit blanc.`;

      // 5.5
      const drawF = () => {
        const id = val('f-ser'), s = id === 'fig17' ? { values: fig17(), dates: null, period: 12 } : SERIES[id];
        let y = s.values; for (let k = 0; k < int('f-d'); k++) y = TS.diff(y); for (let k = 0; k < int('f-D'); k++) y = TS.diff(y, 12);
        const off = s.values.length - y.length, ax = axis(s);
        plot(el.querySelector('#f-c1'), { title: 'Série initiale', height: 200, xLabel: ax.label, xTicks: ax.ticks, layers: [line(s.values, 'x_t')] });
        plot(el.querySelector('#f-c2'), { title: `Après ${int('f-d')} Δ et ${int('f-D')} Δ₁₂`, height: 200, xLabel: ax.label, xTicks: ax.ticks, layers: [line(y, 'série différenciée', '--s3', off), { type: 'hline', value: TS.mean(y), label: `moyenne ${f2(TS.mean(y), 2)}` }] });
        el.querySelector('#f-t').textContent = id === 'fig17'
          ? (int('f-D') >= 1 && int('f-d') === 0 ? 'Δ₁₂ seul suffit : la saison s’annule et la tendance 2t devient la constante 24 (proposition 4).' : int('f-D') === 0 && int('f-d') === 1 ? 'Δ seul retire la tendance (il reste la constante 2) mais pas la saison.' : 'Combinez Δ et Δ₁₂ pour voir l’effet de chaque opérateur.')
          : 'Pour AirPassengers, une Δ et une Δ₁₂ retirent tendance et saison, mais la variance croît encore avec le temps : passez au log avant de différencier.';
      };
      bind(el.querySelector('#f-panel'), drawF, { debounce: 30 }); drawF();

      // 5.6
      const drawB = () => {
        const id = val('b-ser'), H = int('b-H');
        let x;
        if (id === 'bb') x = tpSeries('X1', 100, 9);
        else if (id === 'ar') x = TS.simulateArma({ phi: [0.3], n: 100, seed: 9 });
        else if (id === 'usr') x = dc.resid.filter((v) => v !== null);
        else { const a = id === 'airddl' ? SERIES.air.values.map(Math.log) : SERIES.air.values; x = TS.diff(TS.diff(a, 12)); }
        const a = acfChart(el.querySelector('#b-c1'), x, 40, `ACF (n = ${x.length}, 40 retards)`);
        const bp = TS.boxPierce(x, H), lb = TS.ljungBox(x, [H])[0], q95 = chi2Quantile(H);
        el.querySelector('#b-tab').innerHTML = table(['Test (H = ' + H + ')', 'Statistique', 'χ²_H à 95 %', 'p-valeur', 'Décision'], [
          ['Box-Pierce Q', f2(bp.Q, 2), f2(q95, 2), fp(bp.pvalue), bp.pvalue < 0.05 ? pill('bad', 'pas un bruit blanc') : pill('good', 'bruit blanc plausible')],
          ['Ljung-Box Q_LB', f2(lb.Q, 2), f2(q95, 2), fp(lb.pvalue), lb.pvalue < 0.05 ? pill('bad', 'pas un bruit blanc') : pill('good', 'bruit blanc plausible')]], { numCols: [1, 2, 3] });
        el.querySelector('#b-txt').innerHTML = `<p>${a.out} auto-corrélation(s) sur 40 hors des bornes (on en tolère 2 ou 3). ${lb.pvalue < 0.05 ? 'La série résiduelle n’est pas un bruit blanc : il reste une dépendance à modéliser par un processus ARMA (§7).' : 'La série résiduelle est compatible avec un bruit blanc : il suffit d’estimer sa moyenne et sa variance.'} Q<sub>LB</sub> ≥ Q toujours, car \\(\\frac{n+2}{n-j} > 1\\).</p>`;
        root.UI.typeset(el.querySelector('#b-txt'));
      };
      const chi2Quantile = (k) => { let lo = 0, hi = 200; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (TS.chi2Cdf(m, k) < 0.95) lo = m; else hi = m; } return (lo + hi) / 2; };
      bind(el.querySelector('#b-panel'), drawB, { debounce: 30 }); drawB();
    },
  });

  // ================================================================ §6 TP 3
  function mystery(seed) {
    const r = TS.mulberry32(seed);
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    const a = pick([0.1, 0.2, 0.3, 0.5, 0.8]), b = pick([2, 3, 4, 6]), c = pick([2, 3, 4, 5]), fn = pick(['cos', 'sin']), sd = pick([0.5, 1, 1.5]);
    const g = TS.gaussianRng(seed + 7);
    const x = Array.from({ length: 120 }, (_, i) => { const t = i + 1; return a * t + c * Math[fn]((t * Math.PI) / b) + sd * g(); });
    return { a, b, c, fn, sd, x, T: 2 * b };
  }

  CH.push({
    id: 'tp3', icon: 'tp', short: 'TP 3 · Tendance et saison (corrigé)',
    render(el) {
      const air = SERIES.air, x = air.values, n = x.length, ax = axis(air);
      const lt = TS.linearTrendCourse(x), res = x.map((v, i) => v - lt.trend[i]);
      const d1 = TS.diff(x), d12 = TS.diff(d1, 12), dcA = TS.decompose(x, 12, 'multiplicative'), dcAa = TS.decompose(x, 12, 'additive');
      const rnd = dcAa.resid.filter((v) => v !== null), bt = TS.ljungBox(rnd, [20])[0], bp = TS.boxPierce(rnd, 20);
      el.innerHTML = head('Cours §6 · TP 3 corrigé', 'TP 3 : tendance et saisonnalité',
        'AirPassengers traité par les trois méthodes du cours, puis une série mystère dont il faut retrouver le processus générateur.') + `
      ${block('6.1 AirPassengers · 1. Estimation paramétrique de la tendance', `<div class="tpq-list">
        ${tpq('(a)', 'Représenter la série. Est-elle stationnaire ?', 'Non : la moyenne croît avec le temps (tendance), une saison de période 12 est visible, et l’amplitude des oscillations grandit avec le niveau (la variance n’est pas constante non plus).')}
        ${tpq('(b)', 'Estimer une tendance linéaire at + b.', `Moindres carrés (formules du §5.3, avec \\(t = 1\\) en janvier 1949) : ordonnée à l’origine <strong>${f2(lt.a, 2)}</strong>, pente <strong>${f2(lt.b, 3)}</strong> milliers de passagers par mois, soit environ ${f2(12 * lt.b, 1)} par an.`)}
        ${tpq('(c)', 'Supprimer la tendance ; le résidu est-il de moyenne nulle ?', `Oui : moyenne des résidus = ${f2(TS.mean(res), 8)}, nulle par construction des moindres carrés avec constante (la première équation normale impose \\(\\sum \\hat\\epsilon_t = 0\\)). Mais le résidu garde la saison et une forme en « sourire » : la tendance n’est pas tout à fait linéaire.`)}
        ${tpq('(d)', 'Auto-corrélation des résidus.', 'Pics aux retards 12, 24, 36 : la saison reste entière. La décroissance lente aux petits retards montre que la tendance n’est pas totalement retirée.')}</div>
        <div class="panel"><div class="grid-2"><div id="a-c1"></div><div id="a-c2"></div></div><div id="a-c3"></div></div>`)}
      ${block('2. Méthode des différences', `<div class="tpq-list">
        ${tpq('(a)', 'Appliquer les différences. Période ? Degré du polynôme ?', 'Période T = 12 (mensuel, saison annuelle) : on applique Δ₁₂. Tendance de degré 1 : une seule Δ suffit (proposition 3). On travaille donc sur \\(\\Delta\\Delta_{12}X_t\\).')}
        ${tpq('(b)', 'La série obtenue semble-t-elle stationnaire ?', 'La moyenne est stable autour de 0, mais l’amplitude augmente nettement en fin de période : la variance n’est pas constante. On recommence avec \\(\\log X_t\\) : \\(\\Delta\\Delta_{12}\\log X_t\\) est d’allure stationnaire (c’est la série modélisée au §8).')}</div>
        <div class="panel"><div class="grid-2"><div id="a-c4"></div><div id="a-c5"></div></div></div>`)}
      ${block('3. Méthode des moyennes mobiles', `<div class="tpq-list">
        ${tpq('(a)', 'Enlever tendance et saison par moyennes mobiles.', '<code>decompose(AirPassengers)</code> (additif) ou <code>type = "multiplicative"</code>, plus adapté ici puisque l’amplitude croît avec le niveau.')}
        ${tpq('(b)', 'La série obtenue est-elle stationnaire ? Est-ce un bruit blanc ?', `Le résidu additif garde une variance croissante. Test sur les 20 premiers retards : Box-Pierce Q = ${f2(bp.Q, 1)} (p = ${fp(bp.pvalue)}), Ljung-Box Q = ${f2(bt.Q, 1)} (p = ${fp(bt.pvalue)}). ${bt.pvalue < 0.05 ? 'On rejette l’hypothèse de bruit blanc : il reste de la dépendance, à modéliser par un ARMA.' : 'On ne rejette pas le bruit blanc.'}`)}</div>
        <div class="panel"><div class="grid-2"><div id="a-c6"></div><div id="a-c7"></div></div></div>`)}

      ${block('6.2 Données simulées : retrouver le processus', `<div class="callout warn"><p>Le fichier <code>simulation.dat</code> n’est pas fourni avec le support. Voici un générateur du même type : \\(X_t = a\\,t + c\\,f\\big(\\tfrac{t\\pi}{b}\\big) + \\sigma\\epsilon_t\\) avec \\(f = \\cos\\) ou \\(\\sin\\), comme l’indique l’énoncé. À vous de deviner les paramètres.</p></div>
        <div class="panel" id="y-panel">
          <div class="controls"><button type="button" id="y-new" class="ghost">Nouvelle série mystère</button></div>
          <div id="y-c1"></div><div class="grid-2"><div id="y-c2"></div><div id="y-c3"></div></div>
          <div class="controls">${ctl.number('y-a', 'pente a', '', -5, 5, 0.01)}${ctl.number('y-b', 'b (période T = 2b)', '', 1, 30, 1)}${ctl.number('y-c', 'amplitude c', '', 0, 20, 0.1)}${ctl.select('y-f', 'fonction', [['cos', 'cos'], ['sin', 'sin']], 'cos')}<button type="button" id="y-check">Vérifier</button></div>
          <div id="y-res"></div>
        </div>`)}

      ${block('Corrigé complet sous R', rCode(`x <- AirPassengers; t <- 1:length(x)
## 1. Tendance linéaire
fit <- lm(x ~ t); coef(fit)                    # (b) ordonnée à l'origine et pente
res <- x - fitted(fit); mean(res)              # (c) nulle par construction
plot(res); acf(res, lag.max = 40)              # (d) la saison reste

## 2. Différences : période 12, tendance de degré 1
y <- diff(diff(x, lag = 12)); plot(y)          # variance non constante
yl <- diff(diff(log(x), lag = 12)); plot(yl); acf(yl, lag.max = 40)

## 3. Moyennes mobiles
m <- decompose(x)                              # ou type = "multiplicative"
plot(m); r <- na.omit(m$random)
Box.test(r, lag = 20); Box.test(r, lag = 20, type = "Ljung-Box")

## 6.2 Série simulée : démarche
# s <- ts(scan("simulation.dat"))
# plot(s); a <- coef(lm(s ~ seq_along(s)))[2]              # pente
# r <- s - a * seq_along(s); spec.pgram(r, taper = 0)       # pic à la fréquence 1/(2b)
# acf(r)                                                    # période = 2b
# summary(lm(r ~ cos(seq_along(r) * pi / b) + sin(seq_along(r) * pi / b)))  # amplitude et phase`, 'R · TP 3'))}`;

      plot(el.querySelector('#a-c1'), { title: '(a)(b) Série et tendance linéaire', height: 210, xLabel: ax.label, xTicks: ax.ticks, layers: [line(x, 'AirPassengers', '--s1', 0, 1.3), line(lt.trend, 'tendance at + b', '--s2', 0, 2)] });
      plot(el.querySelector('#a-c2'), { title: '(c) Série sans tendance', height: 210, xLabel: ax.label, xTicks: ax.ticks, layers: [line(res, 'résidu'), { type: 'hline', value: 0 }] });
      acfChart(el.querySelector('#a-c3'), res, 40, '(d) ACF des résidus');
      plot(el.querySelector('#a-c4'), { title: 'Δ Δ₁₂ X_t', height: 200, xLabel: ax.label, xTicks: ax.ticks, layers: [line(d12, 'ΔΔ₁₂X', '--s1', 13), { type: 'hline', value: 0 }] });
      const dl = TS.diff(TS.diff(x.map(Math.log)), 12);
      plot(el.querySelector('#a-c5'), { title: 'Δ Δ₁₂ log X_t', height: 200, xLabel: ax.label, xTicks: ax.ticks, layers: [line(dl, 'ΔΔ₁₂ log X', '--s3', 13), { type: 'hline', value: 0 }] });
      plot(el.querySelector('#a-c6'), { title: 'decompose : partie aléatoire (additif)', height: 200, xLabel: ax.label, xTicks: ax.ticks, layers: [line(dcAa.resid, 'random'), { type: 'hline', value: 0 }] });
      acfChart(el.querySelector('#a-c7'), rnd, 40, 'ACF de la partie aléatoire');

      // Série mystère
      let seed = 17, M = mystery(seed);
      const drawY = () => {
        plot(el.querySelector('#y-c1'), { title: 'Série mystère (n = 120)', height: 220, xLabel: (i) => String(Math.round(i) + 1), layers: [line(M.x, 'X_t')] });
        const t = M.x.map((_, i) => i + 1), f = TS.ols(t.map((v) => [1, v]), M.x), r = f.resid;
        acfChart(el.querySelector('#y-c2'), r, 30, 'Indice : ACF de la série sans tendance linéaire');
        const per = TS.periodogram(r);
        plot(el.querySelector('#y-c3'), { title: 'Indice : périodogramme du résidu', height: 210, xLabel: (v, full) => (full ? `période ${f2(1 / v, 1)}` : f2(v, 2)), xAxisTitle: 'fréquence',
          layers: [{ type: 'line', x: per.map((p) => p.freq), y: per.map((p) => p.power), name: 'I(f)', color: '--s5' }] });
        el.querySelector('#y-res').innerHTML = '';
        ['y-a', 'y-b', 'y-c'].forEach((id) => { el.querySelector('#' + id).value = ''; });
      };
      el.querySelector('#y-new').addEventListener('click', () => { seed += 11; M = mystery(seed); drawY(); });
      el.querySelector('#y-check').addEventListener('click', () => {
        const ga = parseFloat(String(el.querySelector('#y-a').value).replace(',', '.')), gb = parseFloat(el.querySelector('#y-b').value), gc = parseFloat(String(el.querySelector('#y-c').value).replace(',', '.')), gf = val('y-f');
        const t = M.x.map((_, i) => i + 1), f = TS.ols(t.map((v) => [1, v]), M.x), r = f.resid;
        const per = TS.periodogram(r), top = per.reduce((p, q) => (q.power > p.power ? q : p));
        const bEst = Math.round(1 / top.freq / 2);
        const reg = TS.ols(t.map((v) => [1, v, Math.cos((v * Math.PI) / bEst), Math.sin((v * Math.PI) / bEst)]), M.x);
        const ok = (v, w, tol) => isFinite(v) && Math.abs(v - w) <= tol;
        const rows = [['pente a', isFinite(ga) ? f2(ga, 2) : '—', f2(M.a, 2), f2(f.beta[1], 3), ok(ga, M.a, 0.06) ? pill('good', 'juste') : pill('bad', 'à revoir')],
          ['b', isFinite(gb) ? gb : '—', M.b, `${f2(1 / top.freq, 1)} / 2 ≈ ${bEst}`, ok(gb, M.b, 0) ? pill('good', 'juste') : pill('bad', 'à revoir')],
          ['amplitude c', isFinite(gc) ? f2(gc, 1) : '—', M.c, f2(Math.hypot(reg.beta[2], reg.beta[3]), 2), ok(gc, M.c, 0.6) ? pill('good', 'juste') : pill('bad', 'à revoir')],
          ['fonction', gf, M.fn, Math.abs(reg.beta[2]) > Math.abs(reg.beta[3]) ? 'cos' : 'sin', gf === M.fn ? pill('good', 'juste') : pill('bad', 'à revoir')]];
        el.querySelector('#y-res').innerHTML = table(['Paramètre', 'Votre réponse', 'Vrai', 'Estimation par la méthode', ''], rows, { numCols: [1, 2, 3] }) +
          `<div class="callout"><p><strong>Le processus était</strong> \\(X_t = ${M.a}\\,t + ${M.c}\\,\\${M.fn}(t\\pi/${M.b}) + ${M.sd}\\,\\epsilon_t\\).</p>
          <p><strong>Méthode.</strong> 1) la pente par moindres carrés sur \\(t\\) ; 2) la période sur le résidu : l’ACF oscille avec une période \\(T = 2b\\), le périodogramme a un pic en \\(f = 1/T\\) ; 3) l’amplitude et la fonction par régression sur \\(\\cos(t\\pi/b)\\) et \\(\\sin(t\\pi/b)\\) : le coefficient dominant donne la fonction, \\(\\sqrt{\\beta_{\\cos}^2 + \\beta_{\\sin}^2}\\) l’amplitude ; 4) l’écart-type du bruit avec les résidus de cette régression (ici ${f2(Math.sqrt(reg.sigma2), 2)}).</p></div>`;
        root.UI.typeset(el.querySelector('#y-res'));
      });
      drawY();
    },
  });
})(window);
