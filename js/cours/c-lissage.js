/*
 * Cours M2 GRAF : §3 Lissages exponentiels, §4 TP 2.
 * Holt-Winters calculé exactement comme stats::HoltWinters de R (TS.hwR / TS.hwRFit).
 */
(function (root) {
  'use strict';
  const { ctl, bind, val, num, int, block, formula, rCode, quiz, table, stats, pill, f2, fp, esc, tick } = root.UI;
  const { plot } = root.Charts;
  const { SERIES, axis, line, exo, tpq, head, tpSeries } = root.Cours;
  const CH = (root.CHAPTERS = root.CHAPTERS || []);
  const R = String.raw;

  // Les trois lissages du cours, paramétrés par α (et β, γ pour Holt-Winters)
  // LED de Brown exprimé dans HoltWinters : α_H = α(2−α), β_H = α/(2−α) (exercice 6)
  const LES = (x, a) => TS.hwR(x, { alpha: a });
  const LED = (x, a) => TS.hwR(x, { alpha: a * (2 - a), beta: a / (2 - a) });
  const testError = (fc, test) => fc.reduce((s, v, k) => s + (v - test[k]) ** 2, 0);
  const SER_OPTS = [['X1', 'X1(t) = ε_t (simulée)'], ['X2', 'X2(t) = 0,5t + 2ε_t (simulée)'], ['X3', 'X3(t) = 0,5t + ε_t + 3cos(tπ/6) (simulée)'],
    ['usacc', 'USAccDeaths'], ['air', 'AirPassengers'], ['co2', 'co2'], ['cac', 'CAC40']];
  const getSer = (id, seed = 4) => (['X1', 'X2', 'X3'].includes(id)
    ? { id, values: tpSeries(id, 100, seed), dates: null, freq: null, period: id === 'X3' ? 12 : 1, short: id }
    : SERIES[id]);

  // ================================================================ §3
  CH.push({
    id: 'c3', icon: 'lissage', short: '3 · Lissages exponentiels',
    render(el) {
      el.innerHTML = head('Cours §3 · Lissages exponentiels', 'Lissages exponentiels : simple, double, Holt-Winters',
        'Des méthodes de prévision simples, utilisées en masse dans l’industrie (prévoir les ventes de centaines de produits). Le lissage simple ajuste localement une constante, le double une droite, Holt-Winters une droite plus une saison.') + `

      ${block('3.1 Lissage exponentiel simple (LES)', `<div class="grid-2">
        ${formula('Définition (1)', R`\[\hat x_{n,h} = \alpha\sum_{j=0}^{n-1}(1-\alpha)^j x_{n-j},\qquad 0<\alpha<1\]<p class="small">Moyenne de tout le passé, pondérée géométriquement. La prévision ne dépend pas de \(h\).</p>`)}
        ${formula('Formule récursive', R`\[\hat x_{n,h} = \alpha x_n + (1-\alpha)\,\hat x_{n-1,h},\qquad \hat x_{1,h} = x_1\]<p class="small">\(\alpha \le 0{,}3\) : le passé lointain compte. \(\alpha \ge 0{,}7\) : on le néglige.</p>`)}</div>
        <div class="panel" id="w-panel"><div class="controls">${ctl.slider('w-a', 'α', 0.05, 0.95, 0.05, 0.3)}</div><div id="w-c"></div></div>` +
        exo(4, 'Écrire et interpréter la valeur de \\(\\hat x_{n,1}\\) à partir de l’équation de récurrence.', R`
          <p>\(\hat x_{n,1} = \alpha x_n + (1-\alpha)\hat x_{n-1,1} = \hat x_{n-1,1} + \alpha\,(x_n - \hat x_{n-1,1})\).</p>
          <p>La nouvelle prévision est l’ancienne, corrigée d’une fraction \(\alpha\) de la dernière erreur de prévision \(x_n - \hat x_{n-1,1}\). \(\alpha\) est un gain de correction : proche de 1, on suit immédiatement la dernière observation ; proche de 0, on corrige très peu (lissage fort).</p>`) +
        exo(5, 'Montrer que \\(\\hat x_{n,h}\\) défini en (1) est solution asymptotique d’un problème de moindres carrés pondérés.', R`
          <p>On cherche la constante \(a\) qui ajuste au mieux le passé avec des poids décroissants : \(\min_a \sum_{j=0}^{n-1}(1-\alpha)^j(x_{n-j}-a)^2\).</p>
          <p>En annulant la dérivée : \(\sum_j (1-\alpha)^j (x_{n-j}-a) = 0\), d’où \(\hat a = \dfrac{\sum_{j=0}^{n-1}(1-\alpha)^j x_{n-j}}{\sum_{j=0}^{n-1}(1-\alpha)^j}\).</p>
          <p>Or \(\sum_{j=0}^{n-1}(1-\alpha)^j = \dfrac{1-(1-\alpha)^n}{\alpha} \xrightarrow[n\to\infty]{} \dfrac1\alpha\). Donc asymptotiquement \(\hat a = \alpha\sum_j(1-\alpha)^jx_{n-j} = \hat x_{n,h}\).</p>`))}

      ${block('Choix de la constante de lissage', R`<div class="prose"><p>Méthode du cours : on estime le lissage sur les 80 % premières observations \(x_1,\dots,x_m\) (\(m\) entier le plus proche de \(\tfrac{8}{10}n\)), on prévoit les 20 % restantes depuis l’origine \(m\), et on retient l’\(\alpha\) qui minimise</p></div>
        ${formula('', R`\[\text{erreur}(\alpha) = \sum_{h=1}^{n-m}(\hat x_{m,h} - x_{m+h})^2\]`)}
        <div class="panel" id="a-panel">
          <div class="controls">${ctl.select('a-ser', 'Série', SER_OPTS, 'X2')}${ctl.select('a-meth', 'Lissage', [['les', 'simple (LES)'], ['led', 'double (LED)']], 'led')}</div>
          <div class="grid-2"><div id="a-c1"></div><div id="a-c2"></div></div><div id="a-txt" class="callout"></div>
        </div>`)}

      ${block('3.2 Lissage exponentiel double (LED)', `<div class="stack">
        ${formula('Droite ajustée localement', R`\[\hat x_{n,h} = \hat a_1(n) + \hat a_2(n)\,h,\quad (\hat a_1,\hat a_2) = \arg\min\sum_{j=0}^{n-1}(1-\alpha)^j\big(x_{n-j}-(a_1+a_2j)\big)^2\]
          \[\hat a_1(n) = 2L_1(n) - L_2(n),\qquad \hat a_2(n) = \frac{\alpha}{1-\alpha}\big(L_1(n)-L_2(n)\big)\]<p class="small">\(L_1\) et \(L_2\) : deux lissages simples successifs (\(L_2\) lisse \(L_1\)).</p>`)}
        ${formula('Formules récursives (avec \\(e_n = x_n - \\hat x_{n-1,1}\\))', R`\[\begin{aligned}\hat a_1(n) &= \hat a_1(n-1) + \hat a_2(n-1) + \alpha(2-\alpha)\,e_n\\ \hat a_2(n) &= \hat a_2(n-1) + \alpha^2\,e_n\end{aligned}\]
          <p class="small">Initialisation \(\hat a_1(0) = x_1\), \(\hat a_2(0) = x_2 - x_1\). Le support imprime \(\alpha(2-\alpha)\) dans la seconde ligne : le bon coefficient est \(\alpha^2\) (voir exercice 6).</p>`)}</div>`)}

      ${block('3.3 Méthode de Holt-Winters', `<div class="stack">
        ${formula('Non saisonnière', R`\[\begin{aligned}\hat a_1(n) &= \alpha x_n + (1-\alpha)[\hat a_1(n-1)+\hat a_2(n-1)]\\ \hat a_2(n) &= \beta[\hat a_1(n)-\hat a_1(n-1)] + (1-\beta)\hat a_2(n-1)\end{aligned}\]\[\hat x_{n,h} = \hat a_1 + \hat a_2h\]`)}
        ${formula('Saisonnière additive', R`\[\begin{aligned}\hat a_1(n) &= \alpha(x_n-\hat s_{n-T}) + (1-\alpha)[\hat a_1(n-1)+\hat a_2(n-1)]\\ \hat s_n &= \gamma[x_n-\hat a_1(n)] + (1-\gamma)\hat s_{n-T}\end{aligned}\]\[\hat x_{n,h} = \hat a_1 + \hat a_2h + \hat s_{n+h-T}\]`)}
        ${formula('Saisonnière multiplicative', R`\[\begin{aligned}\hat a_1(n) &= \alpha\frac{x_n}{\hat s_{n-T}} + (1-\alpha)[\hat a_1(n-1)+\hat a_2(n-1)]\\ \hat s_n &= \gamma\frac{x_n}{\hat a_1(n)} + (1-\gamma)\hat s_{n-T}\end{aligned}\]\[\hat x_{n,h} = [\hat a_1 + \hat a_2h]\,\hat s_{n+h-T}\]`)}</div>
        <p class="small">Pour \\(h > T\\), on réutilise le coefficient de la même position dans la période (\\(\\hat s_{n+h-2T}\\), etc.). La pente \\(\\hat a_2\\) suit la même mise à jour dans les trois cas.</p>` +
        exo(6, 'Montrer que les formules de mise à jour du lissage exponentiel double sont un cas particulier de celles de Holt-Winters non saisonnier.', R`
          <p>Récrivons Holt-Winters avec \(e_n = x_n - (\hat a_1(n-1)+\hat a_2(n-1))\) :</p>
          \[\hat a_1(n) = \hat a_1(n-1)+\hat a_2(n-1) + \alpha_H e_n,\qquad \hat a_1(n)-\hat a_1(n-1) = \hat a_2(n-1) + \alpha_H e_n,\]
          \[\hat a_2(n) = \hat a_2(n-1) + \beta_H\big(\hat a_1(n)-\hat a_1(n-1)-\hat a_2(n-1)\big) = \hat a_2(n-1) + \alpha_H\beta_H\,e_n.\]
          <p>On retrouve le LED en posant \(\alpha_H = \alpha(2-\alpha)\) et \(\alpha_H\beta_H = \alpha^2\), soit \(\beta_H = \dfrac{\alpha}{2-\alpha}\). Le LED est donc un Holt-Winters non saisonnier à <em>un seul</em> paramètre, et le coefficient de la pente est bien \(\alpha^2\). L’atelier vérifie cette égalité numériquement (test automatique, écart < 10⁻⁸).</p>`))}

      ${block('Manipuler Holt-Winters (calculs identiques à HoltWinters de R)', `<div class="panel" id="h-panel">
        <div class="controls">${ctl.select('h-ser', 'Série', SER_OPTS.filter((o) => o[0] !== 'X1' && o[0] !== 'X2'), 'co2')}${ctl.select('h-type', 'Méthode', [['les', 'lissage simple'], ['ns', 'non saisonnière'], ['add', 'saisonnière additive'], ['mul', 'saisonnière multiplicative']], 'add')}${ctl.slider('h-h', 'Horizon h', 1, 60, 1, 24)}${ctl.check('h-man', 'Constantes fixées à la main', false)}</div>
        <div class="controls" id="h-sl" hidden>${ctl.slider('h-a', 'α', 0.01, 1, 0.01, 0.3)}${ctl.slider('h-b', 'β', 0, 1, 0.01, 0.1)}${ctl.slider('h-g', 'γ', 0, 1, 0.01, 0.1)}</div>
        <div id="h-stats"></div><div id="h-c1"></div><div class="grid-2"><div id="h-c2"></div><div id="h-c3"></div></div>
      </div>`)}

      ${block('3.4 Mise en œuvre sous R', rCode(`x <- co2
# Lissage exponentiel simple
les <- HoltWinters(x, alpha = 0.3, beta = FALSE, gamma = FALSE)
# Lissage exponentiel double de Brown, écrit dans HoltWinters (exercice 6)
a <- 0.3
led <- HoltWinters(x, alpha = a * (2 - a), beta = a / (2 - a), gamma = FALSE)
# Holt-Winters non saisonnier, additif, multiplicatif (constantes estimées si NULL)
hw_ns  <- HoltWinters(x, gamma = FALSE)
hw_add <- HoltWinters(x, seasonal = "additive")
hw_mul <- HoltWinters(x, seasonal = "multiplicative")

summary(hw_add); c(hw_add$alpha, hw_add$beta, hw_add$gamma); hw_add$coefficients
plot(hw_add)                       # observé et lissé
plot(hw_add$fitted[, 1])           # ajustement mis à jour à chaque observation
p <- predict(hw_add, n.ahead = 24, prediction.interval = TRUE)
plot(hw_add, p)

# Choix de alpha par erreur sur l'échantillon test (80 % / 20 %)
m <- round(0.8 * length(x)); train <- ts(x[1:m], frequency = 12); test <- x[(m + 1):length(x)]
err <- sapply(seq(0.05, 0.95, by = 0.05), function(a)
  sum((predict(HoltWinters(train, alpha = a, beta = FALSE, gamma = FALSE), length(test)) - test)^2))
seq(0.05, 0.95, by = 0.05)[which.min(err)]`, 'R · §3.4'))}

      ${block('Vérifier', quiz([
        { q: 'Avec un LES, la prévision à 1 pas et à 10 pas sont…', opts: ['identiques', 'différentes, celle à 10 pas est plus lissée', 'différentes, celle à 10 pas prolonge la tendance'], a: 0, expl: 'Le LES ajuste une constante : x̂ₙ,ₕ ne dépend pas de h.' },
        { q: 'Quelle méthode choisir pour une série avec tendance et saison dont l’amplitude croît avec le niveau ?', opts: ['LED', 'Holt-Winters additif', 'Holt-Winters multiplicatif'], a: 2, expl: 'Le modèle multiplicatif [a₁ + a₂h]·s fait croître la saison avec le niveau.' },
      ]))}`;

      // Poids du LES
      const drawW = () => {
        const a = num('w-a'), J = 25, w = Array.from({ length: J }, (_, j) => a * (1 - a) ** j);
        plot(el.querySelector('#w-c'), { title: `Poids α(1−α)ʲ de x₍ₙ₋ⱼ₎ · les 5 dernières observations pèsent ${f2(100 * (1 - (1 - a) ** 5), 0)} %`, height: 180,
          xLabel: (v) => 'j = ' + Math.round(v), layers: [{ type: 'bar', x: w.map((_, j) => j), y: w, name: 'poids', color: '--s1' }] });
      };
      bind(el.querySelector('#w-panel'), drawW); drawW();

      // Choix de α
      const drawA = () => {
        const s = getSer(val('a-ser')), x = s.values, n = x.length, m = Math.round(0.8 * n);
        const train = x.slice(0, m), test = x.slice(m), meth = val('a-meth');
        const grid = Array.from({ length: 49 }, (_, i) => 0.02 + i * 0.02);
        const errs = grid.map((a) => testError((meth === 'les' ? LES : LED)(train, a).predict(n - m, false).mean, test));
        const bi = errs.indexOf(Math.min(...errs)), ab = grid[bi];
        plot(el.querySelector('#a-c1'), { title: `Erreur test selon α (${meth === 'les' ? 'LES' : 'LED'})`, height: 220, xLabel: (v) => f2(v, 2), xAxisTitle: 'α',
          layers: [{ type: 'line', x: grid, y: errs, name: 'erreur', color: '--s1' }, { type: 'points', x: [ab], y: [errs[bi]], name: 'minimum', color: '--s2', r: 5 }] });
        const fc = (meth === 'les' ? LES : LED)(train, ab).predict(n - m, false).mean, ax = axis(s);
        plot(el.querySelector('#a-c2'), { title: `Prévision depuis m = ${m} avec α = ${f2(ab, 2)}`, height: 220, xLabel: ax.label, xTicks: ax.ticks,
          layers: [{ type: 'shade', from: m - 0.5, to: n - 0.5, label: 'test 20 %' }, line(x, 'observé'), { type: 'line', x: fc.map((_, k) => m + k), y: fc, name: 'prévision', color: '--s2', width: 2 }] });
        el.querySelector('#a-txt').innerHTML = `<p>α optimal sur cette série : <strong>${f2(ab, 2)}</strong> (erreur ${f2(errs[bi], 1)}). ${ab > 0.8 ? 'Un α proche de 1 signifie que la meilleure prévision est presque la dernière valeur observée : le passé lointain n’apporte rien.' : ab < 0.2 ? 'Un α faible signifie qu’on gagne à moyenner sur un long passé : la série est très bruitée autour d’un niveau (ou d’une droite) stable.' : 'Compromis entre réactivité et lissage.'}${meth === 'les' && ['X2', 'X3', 'air', 'co2'].includes(val('a-ser')) ? ' Le LES ne peut pas suivre une tendance : sa prévision est plate. Essayez le LED.' : ''}</p>`;
      };
      bind(el.querySelector('#a-panel'), drawA, { debounce: 30 }); drawA();

      // Holt-Winters
      const drawH = () => {
        const s = getSer(val('h-ser')), x = s.values, type = val('h-type'), man = val('h-man'), H = int('h-h');
        el.querySelector('#h-sl').hidden = !man;
        el.querySelector('#h-b').closest('.ctl').style.display = type === 'les' ? 'none' : '';
        el.querySelector('#h-g').closest('.ctl').style.display = type === 'add' || type === 'mul' ? '' : 'none';
        const f = s.period > 1 ? s.period : 12;
        if ((type === 'add' || type === 'mul') && !(s.period > 1)) { el.querySelector('#h-stats').innerHTML = '<div class="callout warn"><p>Cette série n’a pas de saisonnalité : choisissez une méthode non saisonnière.</p></div>'; ['#h-c1', '#h-c2', '#h-c3'].forEach((q) => { el.querySelector(q).innerHTML = ''; }); return; }
        const opt = { beta: type === 'les' ? false : true, gamma: type === 'add' || type === 'mul' ? true : false, seasonal: type === 'mul' ? 'multiplicative' : 'additive', f };
        const m = man ? TS.hwR(x, { alpha: num('h-a'), beta: opt.beta === false ? false : num('h-b'), gamma: opt.gamma === false ? false : num('h-g'), seasonal: opt.seasonal, f })
          : TS.hwRFit(x, opt);
        const p = m.predict(H), n = x.length, ax = axis(s, H);
        el.querySelector('#h-stats').innerHTML = stats([['α', f2(m.alpha, 4)], ['β', m.beta === false ? 'FALSE' : f2(m.beta, 4)], ['γ', m.gamma === false ? 'FALSE' : f2(m.gamma, 4)],
          ['â₁(n)', f2(m.a1, 3)], ['â₂(n)', m.beta === false ? '—' : f2(m.a2, 4)], ['SSE', f2(m.sse, 2)]]) + `<p class="small muted">${man ? 'Constantes fixées.' : 'Constantes estimées comme R (minimisation de la SSE à un pas).'} Les résultats coïncident avec <code>HoltWinters()</code> au millième près.</p>`;
        const xf = Array.from({ length: H }, (_, k) => n + k);
        plot(el.querySelector('#h-c1'), { title: 'Série, valeurs lissées et prévision (IC 95 %)', height: 280, xLabel: ax.label, xTicks: ax.ticks,
          layers: [{ type: 'shade', from: n - 0.5, to: n + H, label: 'prévision' }, { type: 'band', x: xf, lo: p.lo, hi: p.hi, name: 'IC 95 %', color: '--s2', of: 'prévision' },
            line(x, 'observé', '--s1', 0, 1.4), { type: 'line', x: x.map((_, i) => i), y: m.fitted, name: 'lissé', color: '--s3', dash: true, width: 1.4 },
            { type: 'line', x: xf, y: p.mean, name: 'prévision', color: '--s2', width: 2 }] });
        const off = m.start;
        plot(el.querySelector('#h-c2'), { title: 'Niveau â₁(n)', height: 190, xLabel: ax.label, xTicks: ax.ticks, layers: [line(m.level, 'â₁', '--s1', off)] });
        if (m.gamma !== false) plot(el.querySelector('#h-c3'), { title: 'Saison ŝₙ', height: 190, xLabel: ax.label, xTicks: ax.ticks, layers: [line(m.season, 'ŝ', '--s3', off), { type: 'hline', value: type === 'mul' ? 1 : 0 }] });
        else if (m.beta !== false) plot(el.querySelector('#h-c3'), { title: 'Pente â₂(n)', height: 190, xLabel: ax.label, xTicks: ax.ticks, layers: [line(m.trend, 'â₂', '--s5', off), { type: 'hline', value: 0 }] });
        else el.querySelector('#h-c3').innerHTML = '';
      };
      bind(el.querySelector('#h-panel'), drawH, { debounce: 60 }); drawH();
    },
  });

  // ================================================================ §4 TP 2
  CH.push({
    id: 'tp2', icon: 'tp', short: 'TP 2 · Lissage exponentiel (corrigé)',
    render(el) {
      el.innerHTML = head('Cours §4 · TP 2 corrigé', 'TP 2 : lisser et prévoir',
        'Trois séries simulées, la concentration en CO₂ de Mauna Loa et le CAC40. Les calculs ci-dessous sont refaits en direct ; pour les séries simulées, vos tirages R différeront mais les conclusions sont les mêmes.') + `
      ${block('4.1 Données simulées : 70 observations pour prévoir les 30 suivantes', `<div class="panel" id="t-panel">
        <div class="controls">${ctl.select('t-ser', 'Série', [['X1', 'X1 = ε_t'], ['X2', 'X2 = 0,5t + 2ε_t'], ['X3', 'X3 = 0,5t + ε_t + 3cos(tπ/6)']], 'X3')}${ctl.slider('t-seed', 'Graine', 1, 30, 1, 4)}</div>
        <div id="t-c1"></div><div id="t-tab"></div><div id="t-txt" class="callout"></div></div>
        <div class="tpq-list">
          ${tpq('1', 'LES et LED pour 4 à 5 valeurs de α ; quel lissage semble le plus adapté ?', '<strong>X1</strong> (bruit blanc) : le LES avec α petit (moyenne longue) est le meilleur ; le LED extrapole une pente fictive. <strong>X2</strong> (tendance) : le LES reste plat et sous-estime de plus en plus, le LED suit la pente. <strong>X3</strong> (tendance + saison) : le LED suit la tendance mais ignore les oscillations.')}
          ${tpq('2', 'Somme des carrés des erreurs et choix du modèle.', 'Le tableau ci-dessus calcule \\(\\sum_{h=1}^{30}(\\hat x_{70,h} - x_{70+h})^2\\) pour chaque méthode et chaque α ; la ligne en vert est la meilleure.')}
          ${tpq('3–4', 'Holt-Winters avec saison additive puis multiplicative. Les prédictions sont-elles meilleures ?', 'Pour <strong>X3</strong>, oui, nettement : la saison de période 12 est captée. Le modèle additif est le bon (amplitude 3 constante). Pour X1 et X2, la saison estimée n’est que du bruit : pas de gain, parfois une perte. Le multiplicatif n’a pas de sens pour X1, qui prend des valeurs négatives.')}
        </div>`)}

      ${block('4.2 Concentration en CO₂ (Mauna Loa, 1959–1997)', `<div class="panel"><div id="co-c1"></div><div id="co-tab"></div><div id="co-c2"></div><div id="co-txt" class="callout"></div></div>`)}

      ${block('4.3 CAC40', `<div class="panel"><div id="cac-c1"></div><div id="cac-tab"></div><div id="cac-txt" class="callout"></div></div>`)}

      ${block('Corrigé complet sous R', rCode(`## 4.1
set.seed(4); t <- 1:100; eps <- rnorm(100)
X <- list(X1 = eps, X2 = 0.5 * t + 2 * eps, X3 = 0.5 * t + eps + 3 * cos(t * pi / 6))
erreur <- function(fit, test) sum((predict(fit, n.ahead = length(test)) - test)^2)
for (nom in names(X)) {
  x <- ts(X[[nom]], frequency = 12); train <- ts(x[1:70], frequency = 12); test <- x[71:100]
  res <- c()
  for (a in c(0.1, 0.3, 0.5, 0.7, 0.9)) {
    res[paste0("LES a=", a)] <- erreur(HoltWinters(train, alpha = a, beta = FALSE, gamma = FALSE), test)
    res[paste0("LED a=", a)] <- erreur(HoltWinters(train, alpha = a * (2 - a), beta = a / (2 - a), gamma = FALSE), test)
  }
  res["HW additif"] <- erreur(HoltWinters(train, seasonal = "additive"), test)
  if (all(train > 0)) res["HW multiplicatif"] <- erreur(HoltWinters(train, seasonal = "multiplicative"), test)
  cat(nom, ":", names(which.min(res)), "\\n"); print(round(res, 1))
}

## 4.2 co2 : apprentissage 1959-1989, test 1990-1997
train <- window(co2, end = c(1989, 12)); test <- window(co2, start = c(1990, 1))
fits <- list(add = HoltWinters(train), mul = HoltWinters(train, seasonal = "mult"),
             ns = HoltWinters(train, gamma = FALSE))
sapply(fits, erreur, test = test)
plot(co2); lines(predict(fits$add, n.ahead = length(test)), col = 2)
final <- HoltWinters(co2)                                  # modèle retenu, sur toute la série
p <- predict(final, n.ahead = 120, prediction.interval = TRUE)   # 1998 à 2007
plot(final, p)

## 4.3 CAC40 : apprentissage 1991-1997, test 1998
cac <- EuStockMarkets[, "CAC"]
train <- window(cac, end = c(1997, 260)); test <- window(cac, start = c(1998, 1))
f_les <- HoltWinters(train, beta = FALSE, gamma = FALSE)
f_hw  <- HoltWinters(train, gamma = FALSE)
c(LES = erreur(f_les, test), HW = erreur(f_hw, test))`, 'R · TP 2'))}`;

      // 4.1
      const drawT = () => {
        const kind = val('t-ser'), x = tpSeries(kind, 100, int('t-seed'));
        const train = x.slice(0, 70), test = x.slice(70), rows = [];
        for (const a of [0.1, 0.3, 0.5, 0.7, 0.9]) {
          rows.push({ name: `LES α = ${a}`, fc: LES(train, a).predict(30, false).mean });
          rows.push({ name: `LED α = ${a}`, fc: LED(train, a).predict(30, false).mean });
        }
        rows.push({ name: 'Holt-Winters additif (T = 12)', fc: TS.hwRFit(train, { f: 12 }).predict(30, false).mean });
        if (train.every((v) => v > 0)) rows.push({ name: 'Holt-Winters multiplicatif (T = 12)', fc: TS.hwRFit(train, { f: 12, seasonal: 'multiplicative' }).predict(30, false).mean });
        rows.forEach((r) => { r.err = testError(r.fc, test); });
        const best = rows.reduce((a, b) => (b.err < a.err ? b : a));
        const bestLes = rows.filter((r) => r.name.startsWith('LES')).reduce((a, b) => (b.err < a.err ? b : a));
        const bestLed = rows.filter((r) => r.name.startsWith('LED')).reduce((a, b) => (b.err < a.err ? b : a));
        const hwA = rows.find((r) => r.name.startsWith('Holt-Winters additif'));
        plot(el.querySelector('#t-c1'), { title: `${kind} : apprentissage (1–70) et prévisions (71–100)`, height: 260, xLabel: (i) => String(Math.round(i) + 1),
          layers: [{ type: 'shade', from: 69.5, to: 99.5, label: 'test' }, line(x, 'observé'),
            ...[bestLes, bestLed, hwA].map((r, i) => ({ type: 'line', x: r.fc.map((_, k) => 70 + k), y: r.fc, name: r.name, color: ['--s2', '--s3', '--s5'][i], dash: i > 0, width: 1.8 }))] });
        el.querySelector('#t-tab').innerHTML = table(['Méthode', 'Somme des carrés des erreurs (30 prévisions)'], rows.map((r) => [r.name, f2(r.err, 1)]),
          { numCols: [1], rowClass: (r) => (rows[rows.findIndex((z) => z.name === r[0])] === best ? 'best' : '') });
        el.querySelector('#t-txt').innerHTML = `<p>Meilleure méthode pour ${kind} : <strong>${best.name}</strong>. Meilleur LES : ${bestLes.name} (${f2(bestLes.err, 0)}) ; meilleur LED : ${bestLed.name} (${f2(bestLed.err, 0)}) ; Holt-Winters additif : ${f2(hwA.err, 0)}.${kind === 'X1' && train.some((v) => v <= 0) ? ' Le Holt-Winters multiplicatif est exclu : X1 prend des valeurs négatives.' : ''}</p>`;
      };
      bind(el.querySelector('#t-panel'), drawT, { debounce: 40 }); drawT();

      // 4.2 co2
      const co = SERIES.co2, cx = co.values, Tco = 31 * 12;
      const ctr = cx.slice(0, Tco), cte = cx.slice(Tco), cax = axis(co, 120);
      const cfits = [
        { name: 'Holt-Winters additif', m: TS.hwRFit(ctr, { f: 12 }) },
        { name: 'Holt-Winters multiplicatif', m: TS.hwRFit(ctr, { f: 12, seasonal: 'multiplicative' }) },
        { name: 'Holt-Winters non saisonnier', m: TS.hwRFit(ctr, { gamma: false }) },
      ].map((r) => ({ ...r, fc: r.m.predict(cte.length, false).mean })).map((r) => ({ ...r, err: testError(r.fc, cte) })).sort((a, b) => a.err - b.err);
      plot(el.querySelector('#co-c1'), { title: 'Validation : apprentissage 1959–1989, prévision 1990–1997', height: 260, xLabel: cax.label, xTicks: cax.ticks, xMin: 300,
        layers: [{ type: 'shade', from: Tco - 0.5, to: cx.length - 0.5, label: 'test' }, line(cx, 'co2', '--s1', 0, 1.3),
          ...cfits.map((r, i) => ({ type: 'line', x: r.fc.map((_, k) => Tco + k), y: r.fc, name: r.name, color: ['--s2', '--s3', '--s5'][i], dash: i > 0, width: 1.8 }))] });
      el.querySelector('#co-tab').innerHTML = table(['Méthode', 'α', 'β', 'γ', 'Erreur test (96 mois)'], cfits.map((r) => [r.name, f2(r.m.alpha, 3), r.m.beta === false ? '—' : f2(r.m.beta, 4), r.m.gamma === false ? '—' : f2(r.m.gamma, 3), f2(r.err, 1)]),
        { numCols: [1, 2, 3, 4], rowClass: (_, i) => (i === 0 ? 'best' : '') });
      const fin = TS.hwRFit(cx, { f: 12 }), pf = fin.predict(120), nC = cx.length, xf = Array.from({ length: 120 }, (_, k) => nC + k);
      plot(el.querySelector('#co-c2'), { title: 'Prévision 1998–2007 (Holt-Winters additif sur toute la série, IC 95 %)', height: 260, xLabel: cax.label, xTicks: cax.ticks, xMin: 300,
        layers: [{ type: 'shade', from: nC - 0.5, to: nC + 120, label: 'prévision' }, { type: 'band', x: xf, lo: pf.lo, hi: pf.hi, name: 'IC 95 %', color: '--s2', of: 'prévision' },
          line(cx, 'co2', '--s1', 0, 1.3), { type: 'line', x: xf, y: pf.mean, name: 'prévision', color: '--s2', width: 2 }] });
      el.querySelector('#co-txt').innerHTML = `<p><strong>Choix du modèle.</strong> La série a une tendance croissante régulière et une saison annuelle d’amplitude constante (≈ ${f2(Math.max(...TS.decompose(cx, 12).figure) - Math.min(...TS.decompose(cx, 12).figure), 1)} ppm) : Holt-Winters <em>additif</em> est le choix naturel. La validation le confirme : ${esc(cfits[0].name)} a la plus petite erreur sur 1990–1997. Prévision pour décembre 2007 : <strong>${f2(pf.mean[119], 1)} ppm</strong> [${f2(pf.lo[119], 1)} ; ${f2(pf.hi[119], 1)}]. Pour mémoire, la valeur mesurée à Mauna Loa en décembre 2007 était d’environ 384 ppm.</p>`;

      // 4.3 CAC40
      const cs = SERIES.cac, y = cs.values, T98 = Math.round((1998 - cs.t0) * cs.f);
      const ytr = y.slice(0, T98), yte = y.slice(T98), yax = axis(cs);
      const cr = [
        { name: 'Lissage simple (α estimé)', m: TS.hwRFit(ytr, { beta: false, gamma: false }) },
        { name: 'Holt-Winters non saisonnier', m: TS.hwRFit(ytr, { gamma: false }) },
      ].map((r) => ({ ...r, fc: r.m.predict(yte.length, false).mean }));
      cr.push({ name: 'Naïf (dernière valeur)', fc: new Array(yte.length).fill(ytr[ytr.length - 1]) });
      cr.forEach((r) => { r.err = testError(r.fc, yte); r.mape = 100 * TS.mean(r.fc.map((v, k) => Math.abs(v - yte[k]) / yte[k])); });
      plot(el.querySelector('#cac-c1'), { title: 'CAC40 : apprentissage 1991–1997, prévision de 1998', height: 260, xLabel: yax.label, xTicks: yax.ticks,
        layers: [{ type: 'shade', from: T98 - 0.5, to: y.length - 0.5, label: '1998' }, line(y, 'CAC40', '--s1', 0, 1.2),
          ...cr.map((r, i) => ({ type: 'line', x: r.fc.map((_, k) => T98 + k), y: r.fc, name: r.name, color: ['--s2', '--s3', '--ink-3'][i], dash: i > 0, width: 1.8 }))] });
      el.querySelector('#cac-tab').innerHTML = table(['Méthode', 'α', 'Erreur quadratique', 'MAPE'], cr.map((r) => [r.name, r.m ? f2(r.m.alpha, 4) : '—', f2(r.err, 0), f2(r.mape, 1) + ' %']), { numCols: [1, 2, 3] });
      const les = cr[0];
      el.querySelector('#cac-txt').innerHTML = `<p>Le α estimé du lissage simple vaut ${f2(les.m.alpha, 3)} : la meilleure prévision à un pas est quasiment la dernière cotation, ce qui est la signature d’une marche aléatoire. La hausse de 1998 (${f2(100 * (yte[yte.length - 1] / ytr[ytr.length - 1] - 1), 0)} % sur la période test) n’était prévisible par aucune méthode : le Holt-Winters non saisonnier extrapole la pente récente et fait ${cr[1].err < cr[2].err ? 'mieux que le naïf, par chance sur ce découpage' : 'moins bien que le naïf'}. C’est le constat du cours : les marchés boursiers sont « beaucoup plus difficiles à prévoir ». Le §10 modélisera plutôt leur volatilité.</p>`;
    },
  });
})(window);
