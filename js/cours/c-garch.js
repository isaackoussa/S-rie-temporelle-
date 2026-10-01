/*
 * Cours M2 GRAF : §10 Processus ARCH et GARCH, §11 TP 5.
 * Notation du cours : σ_t² = α0 + Σ_{i≤p} α_i X²_{t−i} + Σ_{j≤q} β_j σ²_{t−j} (GARCH_{p,q}, ARCH_p = GARCH_{p,0}).
 */
(function (root) {
  'use strict';
  const { ctl, bind, val, num, int, block, formula, rCode, quiz, table, stats, pill, f2, fp, esc, tick } = root.UI;
  const { plot } = root.Charts;
  const { SERIES, EU, axis, line, acfChart, exo, tpq, head, missing } = root.Cours;
  const D = root.CoursData;
  const CH = (root.CHAPTERS = root.CHAPTERS || []);
  const R = String.raw;

  const returns = (name) => TS.diff(D.EuStockMarkets[name].map(Math.log)).map((v) => 100 * v);
  const euDs = (name) => ({ values: returns(name), dates: null, t0: D.EuStockMarkets.start + 1 / D.EuStockMarkets.frequency, f: D.EuStockMarkets.frequency });
  function histogram(x, bins) {
    const lo = Math.min(...x), hi = Math.max(...x), w = (hi - lo) / bins || 1, c = new Array(bins).fill(0);
    x.forEach((v) => { c[Math.min(bins - 1, Math.floor((v - lo) / w))]++; });
    return { x: c.map((_, i) => lo + (i + 0.5) * w), y: c.map((k) => k / (x.length * w)) };
  }
  function densityChart(el, x, title) {
    const m = TS.mean(x), s = TS.std(x), h = histogram(x, 50), g = Array.from({ length: 101 }, (_, i) => m - 5 * s + (i * 10 * s) / 100);
    plot(el, { title, height: 210, xLabel: (v) => f2(v, 1), layers: [{ type: 'bar', x: h.x, y: h.y, name: 'densité empirique', color: '--s1' },
      { type: 'line', x: g, y: g.map((v) => TS.normPdf((v - m) / s) / s), name: 'loi normale de même variance', color: '--s2' }] });
  }

  // ================================================================ §10
  CH.push({
    id: 'c10', icon: 'garch', short: '10 · ARCH et GARCH',
    render(el) {
      const cac = euDs('CAC'), r = cac.values, ax = axis(cac);
      el.innerHTML = head('Cours §10 · Processus ARCH et GARCH', 'Quand la variance change avec le temps',
        'Certaines séries résiduelles ont une moyenne constante mais une variance qui varie, avec des périodes calmes et des périodes agitées regroupées. Les ARIMA supposent une variance constante (homoscédasticité) : ils ne conviennent pas. Engle (1982) introduit les processus ARCH, généralisés par Bollerslev (1986) en GARCH.') + `
      ${block('Le phénomène (figures 26 et 27)', missing('nyse.dat (bourse de New York, 1984–1991)', 'Les rendements journaliers du CAC40, fournis par R, montrent le même phénomène.') + `<div class="panel"><div id="g-c1"></div><div class="grid-2"><div id="g-c2"></div><div id="g-c3"></div></div><p class="small" id="g-t"></p></div>`)}

      ${block('10.1 Définition des ARCH<sub>p</sub>', `${formula('', R`\[X_t = \epsilon_t,\qquad \epsilon_t \mid X_{t-1}, X_{t-2},\dots \sim \mathcal N(0, \sigma_t^2),\qquad \sigma_t^2 = \alpha_0 + \alpha_1X_{t-1}^2 + \dots + \alpha_pX_{t-p}^2\]<p class="small">Si les valeurs passées sont grandes en valeur absolue, la variance conditionnelle est grande : un choc est suivi d’une période de forte volatilité, d’autant plus longue que \(p\) est grand.</p>`)}` +
        exo(20, 'Pensez-vous que cela correspond à la série NYSE (figure 26) ?', R`<p>Oui. La série NYSE (comme le CAC40 ci-dessus) a une moyenne à peu près constante et nulle, mais des <strong>grappes de volatilité</strong> : les grandes variations se suivent (krach d’octobre 1987 pour le NYSE). Les rendements sont peu autocorrélés, alors que leurs carrés le sont fortement, et leur distribution a des queues plus épaisses qu’une loi normale (kurtosis > 3) : ce sont exactement les propriétés d’un ARCH (§10.3).</p>`))}

      ${block('10.2 Rappels de probabilités', `${formula('', R`\[f_{X|Y}(x,y) = \frac{f(x,y)}{f_Y(y)},\qquad \mathbb E[X\mid Y=y] = \int_{\mathbb R}x\,f_{X|Y}(x,y)\,dx\]
        \[\sigma_t^2 = \mathbb V(X_t\mid\mathcal I_{t-1}) = \mathbb E[X_t^2\mid\mathcal I_{t-1}] - \big(\mathbb E[X_t\mid\mathcal I_{t-1}]\big)^2,\qquad \mathcal I_{s-1} = \{X_{s-1}, X_{s-2},\dots\}\]
        \[\mathbb E[X_t\mid\mathcal I_s] = X_t\ (t\le s),\qquad \mathbb E[X_t\mid\mathcal I_r] = \mathbb E\big[\mathbb E[X_t\mid\mathcal I_s]\mid\mathcal I_r\big]\ (r\le s),\qquad \mathbb E[X_t] = \mathbb E\big[\mathbb E[X_t\mid\mathcal I_s]\big]\]<p class="small">Dans le support, le carré de l’espérance conditionnelle manque dans la formule de la variance conditionnelle.</p>`)}`)}

      ${block('10.3 Propriétés des ARCH', `<div class="stack">${formula('Moments', R`\[\mathbb E[X_t] = 0,\qquad \mathbb E[X_t\mid\mathcal I_{t-1}] = 0,\qquad \operatorname{Cov}(X_t, X_{t+h}) = 0\ (h>0)\]
        \[\mathbb V(X_t) = \frac{\alpha_0}{1-\sum_{i=1}^p\alpha_i}\quad\text{si }\sum\alpha_i < 1,\qquad \mathbb V(X_t\mid\mathcal I_{t-1}) = \alpha_0 + \sum_i\alpha_iX_{t-i}^2\]`)}
        ${formula('Forme de la distribution', R`<p class="small">Conditionnellement hétéroscédastique mais inconditionnellement homoscédastique. Skewness nul (distribution symétrique), kurtosis > 3 (queues épaisses). Pour un ARCH₁ : \(\kappa = 3\,\dfrac{1-\alpha_1^2}{1-3\alpha_1^2}\) si \(3\alpha_1^2 < 1\).</p>
        <p class="small"><strong>Pourquoi \(\mathbb V(X_t) = \alpha_0/(1-\sum\alpha_i)\)</strong> : \(\mathbb V(X_t) = \mathbb E[\mathbb E[X_t^2\mid\mathcal I_{t-1}]] = \alpha_0 + \sum\alpha_i\mathbb E[X_{t-i}^2]\) ; en stationnarité tous les \(\mathbb E[X_{t-i}^2]\) sont égaux à \(\mathbb V(X_t)\).</p>`)}</div>`)}

      ${block('10.4 Processus GARCH<sub>p,q</sub>', `${formula('', R`\[\sigma_t^2 = \alpha_0 + \sum_{i=1}^p\alpha_iX_{t-i}^2 + \sum_{j=1}^q\beta_j\sigma_{t-j}^2,\qquad \alpha_0>0,\ \alpha_i\ge0,\ \beta_j\ge0\]<p class="small">Un GARCH est un ARCH d’ordre infini, plus parcimonieux. \(\text{GARCH}_{p,0} = \text{ARCH}_p\). Stationnarité au second ordre si \(\sum\alpha_i + \sum\beta_j < 1\), et alors \(\mathbb V(X_t) = \alpha_0/(1 - \sum\alpha_i - \sum\beta_j)\).</p>`)}
        <div class="prose"><p><strong>Identification.</strong> Avec \\(m = \\max(p,q)\\), le processus \\(X_t^2\\) admet une représentation ARMA\\((m,q)\\) : on identifie d’abord cet ARMA sur les carrés (ACF et PACF de \\(X_t^2\\)), puis on teste la significativité des \\(\\alpha_i\\).</p></div>
        <div class="panel" id="gs-panel">
          <div class="controls">${ctl.slider('gs-a0', 'α₀', 0.01, 1, 0.01, 0.1)}${ctl.slider('gs-a1', 'α₁', 0, 0.9, 0.01, 0.5)}${ctl.slider('gs-a2', 'α₂', 0, 0.9, 0.01, 0.2)}${ctl.slider('gs-b1', 'β₁', 0, 0.98, 0.01, 0)}${ctl.slider('gs-n', 'n', 300, 3000, 100, 1000)}${ctl.slider('gs-seed', 'Graine', 1, 40, 1, 1)}</div>
          <div class="eq-live" id="gs-eq"></div><div id="gs-st"></div>
          <div id="gs-c1"></div><div class="grid-3"><div id="gs-c2"></div><div id="gs-c3"></div><div id="gs-c4"></div></div></div>`)}

      ${block('Estimation : GARCH(1,1) sur les rendements du CAC40', `<div class="prose"><p>Paramètres estimés par <strong>maximum de vraisemblance gaussien</strong> : on maximise \\(\\log L = -\\frac12\\sum_t\\big(\\log 2\\pi + \\log\\sigma_t^2 + X_t^2/\\sigma_t^2\\big)\\), où \\(\\sigma_t^2\\) est calculé par la récurrence. Résultats comparés à <code>tseries::garch</code> : coefficients identiques au millième (a0 = 0,083, a1 = 0,051, b1 = 0,881 dans R). Les écarts-types diffèrent : R utilise le produit extérieur des gradients, l’atelier l’inverse de la hessienne.</p></div>
        <div class="panel" id="ge-panel"><div class="controls">${ctl.select('ge-idx', 'Indice', EU.map((k) => [k, k]), 'CAC')}${ctl.select('ge-ord', 'Modèle', [['1,1', 'GARCH(1,1)'], ['1,0', 'ARCH(1)'], ['2,0', 'ARCH(2)'], ['2,1', 'GARCH(2,1)']], '1,1')}</div>
          <div id="ge-out"></div></div>`)}

      ${block('10.5 Mise en œuvre sous R', rCode(`library(tseries)
r <- diff(log(EuStockMarkets[, "CAC"])) * 100     # rendements journaliers en %
plot(r); acf(r); acf(r^2)                          # pas d'autocorrélation, mais les carrés si
kurtosis <- mean((r - mean(r))^4) / var(r)^2; kurtosis   # > 3 : queues épaisses

# garch(x, order = c(q, p)) : q = nombre de β (partie GARCH), p = nombre de α (partie ARCH)
f <- garch(r, order = c(1, 1), trace = FALSE)      # GARCH(1,1)
summary(f)                                         # coefficients a0, a1, b1, tests sur les résidus
plot(f)
sig <- f$fitted.values[, 1]                        # écart-type conditionnel estimé σ_t

# Prévision de la variance : récurrence σ²_{n+h} = a0 + (a1 + b1) σ²_{n+h-1}
co <- coef(f); n <- length(r)
v <- co["a0"] + co["a1"] * r[n]^2 + co["b1"] * sig[n]^2
prev <- numeric(30); prev[1] <- v
for (h in 2:30) prev[h] <- co["a0"] + (co["a1"] + co["b1"]) * prev[h - 1]
sqrt(prev)                                         # écart-type prévu, converge vers sqrt(a0 / (1 - a1 - b1))`, 'R · §10.5'))}

      ${block('Vérifier', quiz([
        { q: 'Pour un ARCH, Cov(X_t, X_{t+h}) pour h > 0 vaut…', opts: ['0 : la série n’est pas autocorrélée', 'α₁^h', 'σ_t² σ_{t+h}²'], a: 0, expl: 'Les X_t ne sont pas corrélés (E[X_t | passé] = 0), mais ils ne sont pas indépendants : leurs carrés sont corrélés.' },
        { q: 'Pour un GARCH(1,1), α₁ + β₁ = 0,98. Qu’en déduire ?', opts: ['La volatilité est très persistante : un choc met longtemps à s’estomper', 'Le processus n’est pas stationnaire', 'La variance inconditionnelle est 0,98'], a: 0, expl: 'α₁ + β₁ < 1 : stationnaire, mais la prévision de la variance revient vers sa moyenne au rythme 0,98^h, soit une demi-vie de ln(0,5)/ln(0,98) ≈ 34 jours.' },
      ]))}`;

      // Phénomène sur le CAC40
      plot(el.querySelector('#g-c1'), { title: 'Rendements journaliers du CAC40, en % (100 · Δ log)', height: 220, xLabel: ax.label, xTicks: ax.ticks, layers: [line(r, 'rendement', '--s1', 0, 0.9), { type: 'hline', value: 0 }] });
      const a1 = acfChart(el.querySelector('#g-c2'), r, 30, 'ACF des rendements X_t');
      const a2 = acfChart(el.querySelector('#g-c3'), r.map((v) => v * v), 30, 'ACF des carrés X_t²');
      const jb = TS.jarqueBera(r);
      el.querySelector('#g-t').innerHTML = `Moyenne ${f2(TS.mean(r), 3)} %, écart-type ${f2(TS.std(r), 2)} %. Rendements : ${a1.out} auto-corrélation(s) sur 30 hors des bornes ; carrés : ${a2.out} sur 30. Skewness ${f2(jb.skew, 2)}, kurtosis <strong>${f2(jb.kurtosis, 2)}</strong> (3 pour une loi normale). Les rendements sont presque non corrélés mais pas indépendants : la volatilité se regroupe.`;

      // Simulateur
      const drawS = () => {
        const a0 = num('gs-a0'), al = [num('gs-a1'), num('gs-a2')].filter((v, i) => i === 0 || v > 0), be = num('gs-b1') > 0 ? [num('gs-b1')] : [];
        const pers = al.reduce((s, v) => s + v, 0) + be.reduce((s, v) => s + v, 0), n = int('gs-n');
        el.querySelector('#gs-eq').innerHTML = `\\[\\sigma_t^2 = ${f2(a0, 2).replace(',', '{,}')}${al.map((v, i) => ` + ${f2(v, 2).replace(',', '{,}')}X_{t-${i + 1}}^2`).join('')}${be.map((v) => ` + ${f2(v, 2).replace(',', '{,}')}\\sigma_{t-1}^2`).join('')}\\]`;
        root.UI.typeset(el.querySelector('#gs-eq'));
        if (pers >= 1) { el.querySelector('#gs-st').innerHTML = `<div class="callout warn"><p>Σα + Σβ = ${f2(pers, 2)} ≥ 1 : la variance inconditionnelle est infinie (pas de stationnarité au second ordre). Réduisez les coefficients.</p></div>`; return; }
        const sim = TS.simulateGarch({ alpha0: a0, alpha: al, beta: be, n, seed: int('gs-seed') }), x = sim.x, sd = sim.sigma2.map(Math.sqrt);
        const jbS = TS.jarqueBera(x), vth = a0 / (1 - pers);
        const kth = !be.length && al.length === 1 && 3 * al[0] ** 2 < 1 ? 3 * (1 - al[0] ** 2) / (1 - 3 * al[0] ** 2) : null;
        el.querySelector('#gs-st').innerHTML = stats([['moyenne', f2(TS.mean(x), 3)], ['variance empirique', f2(TS.variance(x), 3)], ['variance théorique α₀/(1−Σ)', f2(vth, 3)], ['kurtosis', f2(jbS.kurtosis, 2) + (kth ? ` (théorie ${f2(kth, 2)})` : '')], ['persistance Σα + Σβ', f2(pers, 2)]]);
        const xs = x.map((_, i) => i);
        plot(el.querySelector('#gs-c1'), { title: 'Trajectoire et bande ±2σ_t', height: 220, xLabel: (i) => String(Math.round(i) + 1),
          layers: [{ type: 'band', x: xs, lo: sd.map((v) => -2 * v), hi: sd.map((v) => 2 * v), name: '±2σ_t', color: '--s2', opacity: 0.18 }, line(x, 'X_t', '--s1', 0, 0.9)] });
        acfChart(el.querySelector('#gs-c2'), x, 25, 'ACF de X_t');
        acfChart(el.querySelector('#gs-c3'), x.map((v) => v * v), 25, 'ACF de X_t²');
        densityChart(el.querySelector('#gs-c4'), x, 'Distribution de X_t');
      };
      bind(el.querySelector('#gs-panel'), drawS, { debounce: 40 }); drawS();

      // Estimation
      const drawE = async () => {
        const idx = val('ge-idx'), [p, q] = val('ge-ord').split(',').map(Number), ds = euDs(idx), x = ds.values, axE = axis(ds, 30);
        const out = el.querySelector('#ge-out'); out.innerHTML = '<p class="busy">Estimation…</p>'; await tick();
        const fit = TS.garchFit(x, p, q), fv = fit.forecastVar(30), n = x.length;
        const lbz2 = TS.ljungBox(fit.stdResid.map((v) => v * v), [10])[0], lbx2 = TS.ljungBox(x.map((v) => v * v), [10])[0];
        out.innerHTML = table(['Coefficient', 'Estimation', 'Écart-type', 'p-valeur'], fit.coefs.map((c) => [c.name, f2(c.value, 4), f2(c.se, 4), fp(c.pvalue)]), { numCols: [1, 2, 3] }) +
          stats([['log-vraisemblance', f2(fit.loglik, 1)], ['AIC', f2(fit.aic, 1)], ['persistance', f2(fit.persistence, 3)], ['volatilité de long terme (annuelle)', `${f2(Math.sqrt(260 * fit.uncondVar), 1)} %`]]) +
          `<p class="small">Ljung-Box (10 retards) sur X² : p = ${fp(lbx2.pvalue)} ; sur les résidus standardisés au carré X²/σ²_t : p = ${fp(lbz2.pvalue)}. ${lbz2.pvalue >= 0.05 ? 'Le modèle a capté l’hétéroscédasticité.' : 'Il reste de la dépendance dans les carrés : essayez un autre ordre.'}</p><div id="ge-c1"></div><div id="ge-c2"></div>`;
        const sd = fit.sigma2.map(Math.sqrt);
        plot(out.querySelector('#ge-c1'), { title: `${idx} : |rendement| et volatilité conditionnelle σ_t estimée`, height: 220, xLabel: axE.label, xTicks: axE.ticks,
          layers: [line(x.map(Math.abs), '|X_t|', '--ink-3', 0, 0.7), line(sd, 'σ_t', '--s2', 0, 1.6)] });
        const last = sd.slice(-120), off = n - 120, fs = fv.map(Math.sqrt);
        plot(out.querySelector('#ge-c2'), { title: 'Prévision de l’écart-type conditionnel à 30 jours', height: 200, xLabel: axE.label, xTicks: axE.ticks,
          layers: [{ type: 'shade', from: n - 0.5, to: n + 30, label: 'prévision' }, line(last, 'σ_t estimé', '--s2', off, 1.6), { type: 'line', x: fs.map((_, h) => n + h), y: fs, name: 'σ prévu', color: '--s1', width: 2 },
            { type: 'hline', value: Math.sqrt(fit.uncondVar), label: 'niveau de long terme' }] });
      };
      bind(el.querySelector('#ge-panel'), drawE); drawE();
    },
  });

  // ================================================================ §11 TP 5
  CH.push({
    id: 'tp5', icon: 'tp', short: 'TP 5 · ARCH et GARCH (corrigé)',
    render(el) {
      el.innerHTML = head('Cours §11 · TP 5 corrigé', 'TP 5 : ARCH et GARCH en pratique', 'Durée prévue : 2 h. Nécessite le package <code>tseries</code>.') + `
      ${block('11.1 Données simulées', `${formula('', R`\[X_t\mid X_{t-1},X_{t-2},\dots \sim \mathcal N(0,\sigma_t^2),\qquad \sigma_t^2 = 0{,}1 + 0{,}5X_{t-1}^2 + 0{,}2X_{t-2}^2\]`)}
        <div class="panel" id="s1-panel"><div class="controls">${ctl.slider('s1-seed', 'Graine', 1, 40, 1, 3)}</div><div id="s1-out"></div></div>
        <div class="tpq-list">
          ${tpq('1', 'Reconnaissez-vous ce processus ?', R`Un <strong>ARCH₂</strong> avec \(\alpha_0 = 0{,}1\), \(\alpha_1 = 0{,}5\), \(\alpha_2 = 0{,}2\). Comme \(\alpha_1 + \alpha_2 = 0{,}7 < 1\), il est stationnaire, de variance \(0{,}1/(1-0{,}7) = 0{,}333\).`)}
          ${tpq('2', 'Simuler 1000 réalisations ; analyser moyenne, variance et auto-covariance empiriques.', 'Moyenne proche de 0, variance proche de 0,333, auto-corrélations de X non significatives, mais celles de X² très significatives (tableau et graphiques ci-dessus).')}
          ${tpq('3', 'Ajuster un ARCH<sub>p</sub>.', 'On compare ARCH₁, ARCH₂, ARCH₃ par AIC : l’ARCH₂ est retenu, ses coefficients estimés sont proches des vrais, et α₃ n’est pas significatif dans l’ARCH₃.')}
        </div>`)}

      ${block('11.2 EuStockMarkets : les quatre indices européens', `<div class="prose"><p>Transformation préalable indispensable : les cours ne sont pas stationnaires, on modélise les <strong>rendements</strong> \\(r_t = 100\\,(\\log x_t - \\log x_{t-1})\\). Un GARCH(1,1) est estimé pour chaque indice, puis la volatilité est prévue à 30 jours.</p></div>
        <div class="panel"><div id="eu-out" class="busy">Estimation des quatre modèles…</div><div id="eu-c"></div></div>`)}

      ${block('11.3 NYSE', missing('nyse.dat', 'La démarche est celle de 11.2 : rendements, ACF de X et de X², GARCH(1,1) en premier essai, comparaison par AIC, contrôle des résidus standardisés, prévision à 30 jours.'))}

      ${block('Corrigé complet sous R', rCode(`library(tseries)
## 11.1 Simulation d'un ARCH2
set.seed(3); n <- 1000; x <- numeric(n)
for (t in 3:n) x[t] <- rnorm(1, 0, sqrt(0.1 + 0.5 * x[t - 1]^2 + 0.2 * x[t - 2]^2))
plot.ts(x); mean(x); var(x); 0.1 / (1 - 0.7)       # variance théorique
par(mfrow = c(1, 2)); acf(x); acf(x^2)
fits <- lapply(1:3, function(p) garch(x, order = c(0, p), trace = FALSE))
sapply(fits, AIC)                                  # ARCH2 retenu
summary(fits[[2]])

## 11.2 Les quatre indices
r <- diff(log(EuStockMarkets)) * 100
g <- lapply(colnames(r), function(j) garch(r[, j], order = c(1, 1), trace = FALSE))
names(g) <- colnames(r)
t(sapply(g, coef))                                 # a0, a1, b1 par indice
prev_sd <- function(f, x, h = 30) {
  co <- coef(f); n <- length(x); s <- f$fitted.values[n, 1]
  v <- co["a0"] + co["a1"] * x[n]^2 + co["b1"] * s^2; out <- v
  for (k in 2:h) { v <- co["a0"] + (co["a1"] + co["b1"]) * v; out <- c(out, v) }
  sqrt(out)
}
sapply(colnames(r), function(j) prev_sd(g[[j]], r[, j])[c(1, 10, 30)])`, 'R · TP 5'))}`;

      const drawS1 = async () => {
        const out = el.querySelector('#s1-out'); out.innerHTML = '<p class="busy">Simulation et estimation…</p>'; await tick();
        const x = TS.simulateGarch({ alpha0: 0.1, alpha: [0.5, 0.2], n: 1000, seed: int('s1-seed') }).x, x2 = x.map((v) => v * v);
        const fits = [1, 2, 3].map((p) => TS.garchFit(x, p, 0)), best = fits.reduce((a, b) => (b.aic < a.aic ? b : a));
        out.innerHTML = stats([['moyenne', f2(TS.mean(x), 4)], ['variance empirique', f2(TS.variance(x), 3)], ['variance théorique', '0,333'], ['ρ̂(1) de X', f2(TS.acf(x, 1)[1], 3)], ['ρ̂(1) de X²', f2(TS.acf(x2, 1)[1], 3)], ['kurtosis', f2(TS.jarqueBera(x).kurtosis, 2)]]) +
          '<div id="s1-c1"></div><div class="grid-2"><div id="s1-c2"></div><div id="s1-c3"></div></div>' +
          table(['Modèle', 'Coefficients estimés', 'AIC', ''], fits.map((f, i) => [`ARCH${['₁', '₂', '₃'][i]}`, f.coefs.map((c) => `${c.name} = ${f2(c.value, 3)}${c.pvalue > 0.05 ? ' (n.s.)' : ''}`).join(', '), f2(f.aic, 1), f === best ? pill('good', 'min AIC') : '']), { numCols: [2] }) +
          '<p class="small muted">Vraies valeurs : a0 = 0,1, a1 = 0,5, a2 = 0,2. « n.s. » : coefficient non significatif à 5 %. Vos chiffres sous R diffèrent (autres tirages) ; la conclusion est la même.</p>';
        plot(out.querySelector('#s1-c1'), { title: '1000 réalisations de l’ARCH₂', height: 200, xLabel: (i) => String(Math.round(i) + 1), layers: [line(x, 'X_t', '--s1', 0, 0.9)] });
        acfChart(out.querySelector('#s1-c2'), x, 25, 'ACF de X_t');
        acfChart(out.querySelector('#s1-c3'), x2, 25, 'ACF de X_t²');
      };
      bind(el.querySelector('#s1-panel'), drawS1, { debounce: 60 }); drawS1();

      (async () => {
        await tick();
        const rows = [], curves = [];
        for (const k of EU) {
          const x = returns(k), f = TS.garchFit(x, 1, 1), fv = f.forecastVar(30).map(Math.sqrt);
          rows.push([k, f2(f.alpha0, 4), f2(f.alpha[0], 4), f2(f.beta[0], 4), f2(f.persistence, 3), f2(Math.sqrt(f.sigma2[f.sigma2.length - 1]), 2), f2(fv[0], 2), f2(fv[29], 2), `${f2(Math.sqrt(260 * f.uncondVar), 1)} %`]);
          curves.push({ k, fv });
          await tick();
        }
        el.querySelector('#eu-out').className = '';
        el.querySelector('#eu-out').innerHTML = table(['Indice', 'a0', 'a1', 'b1', 'a1 + b1', 'σ dernier jour (%)', 'σ prévu J+1', 'σ prévu J+30', 'volatilité annuelle de long terme'], rows, { numCols: [1, 2, 3, 4, 5, 6, 7, 8] }) +
          '<p class="small">Pour les quatre indices, a1 + b1 est proche de 1 : la volatilité est très persistante. La prévision de σ part du niveau actuel et converge lentement vers le niveau de long terme. b1 élevé et a1 faible : la volatilité réagit modérément à chaque choc mais s’en souvient longtemps.</p>';
        plot(el.querySelector('#eu-c'), { title: 'Écart-type conditionnel prévu sur 30 jours ouvrés (%)', height: 230, xLabel: (h) => 'J+' + (Math.round(h) + 1),
          layers: curves.map((c, i) => ({ type: 'line', x: c.fv.map((_, h) => h), y: c.fv, name: c.k, color: ['--s1', '--s2', '--s3', '--s5'][i] })) });
      })();
    },
  });
})(window);
