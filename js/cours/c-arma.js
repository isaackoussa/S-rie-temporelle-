/*
 * Cours M2 GRAF : §7 Modélisation des séries stationnaires, §8 ARIMA et SARIMA, §9 TP 4.
 * Notations du cours : X_t = Σ a_k X_{t−k} + ε_t + Σ b_j ε_{t−j}.
 */
(function (root) {
  'use strict';
  const { ctl, bind, val, num, int, block, formula, rCode, quiz, table, stats, pill, f2, fp, esc, tick, MOIS } = root.UI;
  const { plot, complexPlane } = root.Charts;
  const { SERIES, axis, line, acfChart, exo, tpq, head, missing, fileLinks } = root.Cours;
  const CH = (root.CHAPTERS = root.CHAPTERS || []);
  const R = String.raw;
  const tx = (v, d = 2) => (v < 0 ? '-' : '') + Math.abs(v).toFixed(d).replace(/0+$/, '').replace(/\.$/, '').replace('.', '{,}');
  const procTex = (a, b) => {
    const ar = a.map((v, i) => (Math.abs(v) < 1e-9 ? '' : ` ${v < 0 ? '-' : '+'} ${tx(Math.abs(v))}X_{t-${i + 1}}`)).join('');
    const ma = b.map((v, i) => (Math.abs(v) < 1e-9 ? '' : ` ${v < 0 ? '-' : '+'} ${tx(Math.abs(v))}\\epsilon_{t-${i + 1}}`)).join('');
    return `X_t =${ar.replace(/^ \+/, '')}${ar ? ' +' : ''} \\epsilon_t${ma}`;
  };

  const PRESETS = {
    f18: { label: 'Figure 18 · AR₁, a = 0,8', a: [0.8], b: [] },
    f19: { label: 'Figure 19 · AR₁, a = −0,8', a: [-0.8], b: [] },
    f20: { label: 'Figure 20 · AR₂, X_t = 0,9X_{t−2} + ε_t', a: [0, 0.9], b: [] },
    f21: { label: 'Figure 21 · AR₂, a = (−0,5 ; −0,9)', a: [-0.5, -0.9], b: [] },
    f22: { label: 'Figure 22 · MA₁, b = −0,8', a: [], b: [-0.8] },
    f23: { label: 'Figure 23 · MA₁, b = 0,8', a: [], b: [0.8] },
    f24: { label: 'Figure 24 · MA₃, b = (0,8 ; 0,5 ; 0,3)', a: [], b: [0.8, 0.5, 0.3] },
    f25: { label: 'Figure 25 · ARMA₂,₂', a: [0.5, -0.3], b: [0.6, 0.3] },
    ex11: { label: 'Exercice 11 · A(z) = 1 − z − ½z²', a: [1, 0.5], b: [] },
  };

  // ================================================================ §7
  CH.push({
    id: 'c7', icon: 'arma', short: '7 · AR, MA, ARMA',
    render(el) {
      el.innerHTML = head('Cours §7 · Modélisation des séries stationnaires', 'Processus AR, MA et ARMA',
        'Une fois tendance et saison retirées, on modélise la dépendance du résidu stationnaire. Retirer tendance et saison ne suffit pas toujours à rendre la série stationnaire : la variance et l’auto-covariance doivent aussi être stables.') + `

      ${block('7.1 Auto-corrélation partielle', `${formula('', R`\[r_{X_2,\dots,X_{n-1}}(X_1,X_n) = \operatorname{corr}\big(X_1 - P_{X_2,\dots,X_{n-1}}(X_1),\; X_n - P_{X_2,\dots,X_{n-1}}(X_n)\big)\]
        \[r(h) = r_{X_2,\dots,X_h}(X_1, X_{h+1})\ (h\ge2),\qquad r(1) = \rho(1),\qquad r(-h) = r(h)\]`)}
        <div class="prose"><p>C’est la corrélation entre \\(X_1\\) et \\(X_{h+1}\\) une fois retirée la part expliquée linéairement par les variables intermédiaires. On la calcule sans inverser de matrice par l’algorithme de <strong>Durbin-Levinson</strong> (le support le nomme « Durbin-Watson », qui est en réalité un test sur les résidus) :</p></div>
        ${formula('', R`\[r(k) = \phi_{kk} = \frac{\rho(k) - \sum_{j=1}^{k-1}\phi_{k-1,j}\,\rho(k-j)}{1 - \sum_{j=1}^{k-1}\phi_{k-1,j}\,\rho(j)},\qquad \phi_{k,j} = \phi_{k-1,j} - \phi_{kk}\,\phi_{k-1,k-j}\]`)}`)}

      ${block('7.2 Processus auto-régressifs AR<sub>p</sub>', `<div class="grid-2">
        ${formula('Définition 2', R`\[X_t = \epsilon_t + \sum_{j=1}^p a_j X_{t-j}\]<p class="small">\(\epsilon_t\) : innovation, bruit blanc centré de variance \(\sigma^2\). Stationnarité si toutes les racines de \(A(z) = 1 - a_1z - \dots - a_pz^p\) sont de module strictement supérieur à 1. Alors \(\mu = 0\) (remarque 1).</p>`)}
        ${formula('Proposition 5 (équations de Yule-Walker)', R`\[\sigma(0) = \sigma^2 + \sum_{j=1}^p a_j\sigma(j),\qquad \sigma(h) = \sum_{j=1}^p a_j\sigma(h-j)\ \ (h>0)\]<p class="small">Solutions \(\sigma(h) = \sum_i c_i\lambda_i^h\), \(\lambda_i\) inverses des racines de \(A\), \(|\lambda_i| < 1\) : décroissance exponentielle. PACF : \(r(h) = 0\) pour \(h > p\) et \(r(p) = a_p\).</p>`)}</div>` +
        exo(11, 'Vérifier la stationnarité et expliciter l’expression du processus autorégressif de polynôme caractéristique \\(A(z) = 1 - z - \\frac12 z^2\\).', R`
          <p>Par identification \(a_1 = 1\), \(a_2 = \frac12\) : \(X_t = X_{t-1} + \tfrac12X_{t-2} + \epsilon_t\).</p>
          <p>Racines de \(A\) : \(1 - z - \frac12z^2 = 0 \iff z^2 + 2z - 2 = 0 \iff z = -1 \pm\sqrt3\), soit \(z_1 \approx 0{,}732\) et \(z_2 \approx -2{,}732\). Comme \(|z_1| < 1\), <strong>le processus n’est pas stationnaire</strong>. Vérification par les conditions du triangle de l’AR₂ : il faudrait \(a_2 < 1 - a_1\), soit \(0{,}5 < 0\), ce qui est faux.</p>
          <p>Dans le simulateur ci-dessous, le préréglage « Exercice 11 » montre une trajectoire qui explose : la racine \(0{,}732\) est à l’intérieur du cercle unité.</p>`) +
        exo(12, 'Démontrer la proposition 5.', R`<p>Multiplions \(X_t = \sum_j a_jX_{t-j} + \epsilon_t\) par \(X_{t-h}\) et prenons l’espérance (processus centré) :
          \(\sigma(h) = \sum_j a_j\sigma(h-j) + \mathbb E[\epsilon_tX_{t-h}]\).
          Pour \(h > 0\), \(X_{t-h}\) ne dépend que des innovations passées, indépendantes de \(\epsilon_t\) : \(\mathbb E[\epsilon_tX_{t-h}] = 0\). Pour \(h = 0\), \(\mathbb E[\epsilon_tX_t] = \mathbb E[\epsilon_t^2] = \sigma^2\), d’où \(\sigma(0) = \sigma^2 + \sum_j a_j\sigma(j)\) (avec \(\sigma(-j) = \sigma(j)\), exercice 7).</p>`))}

      ${block('7.2.1 Exercice : le cas de l’AR<sub>1</sub>, \\(X_t = aX_{t-1} + \\epsilon_t\\)', `<div class="tpq-list">
        ${tpq('1', 'Condition de stationnarité ?', R`\(A(z) = 1 - az\) a pour racine \(1/a\) : il faut \(|1/a| > 1\), soit \(|a| < 1\).`)}
        ${tpq('2', 'Variance ?', R`\(\sigma(0) = a^2\sigma(0) + \sigma^2\) (car \(\epsilon_t\) est indépendant de \(X_{t-1}\)), donc \(\sigma(0) = \dfrac{\sigma^2}{1-a^2}\).`)}
        ${tpq('3', 'Montrer que \\(\\sigma(h) = \\sigma^2 a^h/(1-a^2)\\).', R`Yule-Walker : \(\sigma(h) = a\,\sigma(h-1)\) pour \(h \ge 1\), donc \(\sigma(h) = a^h\sigma(0) = \sigma^2\dfrac{a^h}{1-a^2}\).`)}
        ${tpq('4', 'Décroissance vers 0 ?', R`\(|a| < 1 \Rightarrow |a|^h \to 0\) géométriquement ; si \(a < 0\), l’auto-covariance alterne de signe (figure 19).`)}
        ${tpq('5', 'Auto-corrélation partielle ?', R`\(r(1) = \rho(1) = a\) et \(r(h) = 0\) pour \(h \ge 2\) : une fois \(X_{t-1}\) connu, les valeurs plus anciennes n’apportent rien.`)}</div>`)}

      ${block('7.3 Processus moyenne mobile MA<sub>q</sub>', `<div class="grid-2">
        ${formula('Définition 3 et proposition 6', R`\[X_t = \epsilon_t + b_1\epsilon_{t-1} + \dots + b_q\epsilon_{t-q}\]\[\sigma(h) = \sigma^2\sum_{k=0}^{q-h}b_kb_{k+h}\ (h\le q),\qquad \sigma(h) = 0\ (h>q),\quad b_0 = 1\]`)}
        ${formula('Proposition 7', R`<p class="small">Un AR est un MA d’ordre infini et, si \(B(z) = 1 + b_1z + \dots + b_qz^q\) a ses racines hors du cercle unité, un MA est un AR d’ordre infini. D’où la symétrie : l’ACF d’un MA<sub>q</sub> coupe après \(q\), sa PACF décroît exponentiellement.</p>`)}</div>` +
        exo(13, 'Démontrer la proposition 6.', R`<p>\(\sigma(h) = \operatorname{Cov}\big(\sum_{k=0}^q b_k\epsilon_{t-k},\, \sum_{l=0}^q b_l\epsilon_{t+h-l}\big) = \sum_{k,l} b_kb_l\operatorname{Cov}(\epsilon_{t-k}, \epsilon_{t+h-l})\). Seuls les termes \(t-k = t+h-l\), c’est-à-dire \(l = k+h\), sont non nuls (et valent \(\sigma^2\)) : \(\sigma(h) = \sigma^2\sum_{k=0}^{q-h}b_kb_{k+h}\). Si \(h > q\), aucun couple ne convient : \(\sigma(h) = 0\).</p>`) +
        exo(14, 'De la définition d’un MA, extraire l’innovation au temps t, réécrire le MA<sub>q</sub> en remplaçant les innovations par leur valeur. Conclure.', R`<p>Cas \(q = 1\) : \(\epsilon_t = X_t - b\,\epsilon_{t-1}\). En remplaçant \(\epsilon_{t-1} = X_{t-1} - b\,\epsilon_{t-2}\), puis \(\epsilon_{t-2}\), etc. :
          \[\epsilon_t = X_t - bX_{t-1} + b^2X_{t-2} - \dots = \sum_{j\ge0}(-b)^jX_{t-j},\]
          série convergente si \(|b| < 1\). D’où \(X_t = -\sum_{j\ge1}(-b)^jX_{t-j} + \epsilon_t\) : un <strong>AR(∞)</strong>. En général, \(\epsilon_t = B(L)^{-1}X_t\) dès que les racines de \(B\) sont hors du cercle unité (inversibilité, note 4 du cours). C’est la proposition 7, et l’explication de la PACF d’un MA qui décroît sans s’annuler.</p>`))}

      ${block('7.3.1 Exercice : le MA<sub>1</sub>', R`<div class="prose"><p>\(X_t = \epsilon_t + b\epsilon_{t-1}\) : \(\sigma(0) = (1+b^2)\sigma^2\), \(\sigma(1) = b\sigma^2\), \(\sigma(h) = 0\) pour \(h \ge 2\). D’où \(\rho(1) = \dfrac{b}{1+b^2}\) et \(\rho(h) = 0\) pour \(h \ge 2\). Remarque : \(|\rho(1)| \le \tfrac12\), maximum atteint pour \(b = \pm1\) ; \(b\) et \(1/b\) donnent la même ACF, on choisit \(|b| < 1\) (inversible).</p></div>`)}

      ${block('7.4 Processus ARMA<sub>p,q</sub>', `${formula('Définition 4', R`\[X_t - a_1X_{t-1} - \dots - a_pX_{t-p} = \epsilon_t + b_1\epsilon_{t-1} + \dots + b_q\epsilon_{t-q}\]<p class="small">Stationnaire si les racines de \(A\) sont de module > 1 ; \(A\) et \(B\) sans racine commune. Pour \(h > q\), l’auto-covariance suit la récurrence de l’AR<sub>p</sub> : décroissance exponentielle à partir de l’ordre \(q+1\).</p>`)}` +
        exo(15, 'Soit \\(X_t + aX_{t-1} = \\epsilon_t + a\\epsilon_{t-1}\\). Est-ce un processus stationnaire ? Existe-t-il une écriture plus simple ?', R`<p>Ici \(A(z) = 1 + az\) et \(B(z) = 1 + az\) : <strong>les deux polynômes ont la même racine</strong> \(-1/a\). En notant \(L\) l’opérateur retard, l’équation s’écrit \((1 + aL)X_t = (1 + aL)\epsilon_t\). Pour \(|a| < 1\), \(1 + aL\) est inversible et \(X_t = \epsilon_t\) : le processus est un simple <strong>bruit blanc</strong>, stationnaire. C’est pourquoi la définition exige que \(A\) et \(B\) n’aient pas de racine commune : sinon la représentation n’est pas la plus courte, et les paramètres ne sont pas identifiables.</p>`))}

      ${block('7.4.1 Exercice : l’ARMA<sub>1,1</sub>, \\(X_t = aX_{t-1} + \\epsilon_t + b\\epsilon_{t-1}\\)', `<div class="tpq-list">
        ${tpq('1', 'Montrer que \\(\\sigma(0) = \\sigma^2\\frac{1+b^2+2ab}{1-a^2}\\).', R`\(\mathbb E[X_t\epsilon_t] = \sigma^2\) et \(\mathbb E[X_t\epsilon_{t-1}] = a\sigma^2 + b\sigma^2\). En multipliant l’équation par \(X_t\) : \(\sigma(0) = a\sigma(1) + \sigma^2 + b(a+b)\sigma^2\). En la multipliant par \(X_{t-1}\) : \(\sigma(1) = a\sigma(0) + b\sigma^2\). En substituant : \(\sigma(0)(1-a^2) = \sigma^2(1 + 2ab + b^2)\).`)}
        ${tpq('2', 'Montrer que \\(\\sigma(1) = \\sigma^2\\frac{(a+b)(1+ab)}{1-a^2}\\).', R`\(\sigma(1) = a\sigma(0) + b\sigma^2 = \sigma^2\dfrac{a + ab^2 + 2a^2b + b - a^2b}{1-a^2} = \sigma^2\dfrac{a + b + ab^2 + a^2b}{1-a^2} = \sigma^2\dfrac{(a+b)(1+ab)}{1-a^2}\).`)}
        ${tpq('3', 'En déduire \\(\\rho(1)\\) et \\(\\rho(h)\\).', R`\(\rho(1) = \dfrac{(a+b)(1+ab)}{1+2ab+b^2}\) et, pour \(h \ge 2\), \(\sigma(h) = a\sigma(h-1)\) (le terme MA ne joue plus), donc \(\rho(h) = a^{h-1}\rho(1)\).`)}</div>`)}

      ${block('Simulateur : figures 18 à 25 du cours', `<div class="panel" id="sim-panel">
        <div class="controls">${ctl.select('sim-p', 'Processus', [...Object.entries(PRESETS).map(([k, v]) => [k, v.label]), ['custom', 'Personnalisé']], 'f21')}${ctl.slider('sim-n', 'n', 100, 1000, 50, 200)}${ctl.slider('sim-seed', 'Graine', 1, 40, 1, 3)}</div>
        <div class="controls" id="sim-custom" hidden>${['a1', 'a2', 'b1', 'b2', 'b3'].map((k) => ctl.number('sim-' + k, k, 0, -2, 2, 0.05)).join('')}</div>
        <div class="eq-live" id="sim-eq"></div><div id="sim-st"></div>
        <div id="sim-c1"></div><div class="grid-3"><div id="sim-c2"></div><div id="sim-c3"></div><div id="sim-c4"></div></div></div>`)}

      ${block('7.5 Récapitulatif (table 1 du cours)', table(['', 'MA<sub>q</sub>', 'AR<sub>p</sub>', 'ARMA<sub>p,q</sub>'], [
        ['auto-covariance σ(h)', '= 0 pour h > q', '→ 0 exponentiellement', '→ 0 exponentiellement pour h > q'],
        ['auto-corrélation ρ(h)', '<strong>= 0 pour h > q</strong>', '→ 0 exponentiellement', '→ 0 exponentiellement pour h > q'],
        ['auto-corrélation partielle r(h)', '→ 0 exponentiellement', '<strong>= 0 pour h > p</strong>, r(p) = a<sub>p</sub>', '→ 0'],
      ]))}

      ${block('7.6.1 Estimation : l’exemple de l’AR<sub>2</sub>', `${formula('', R`\[\sigma(1) = \frac{a_1}{1-a_2}\sigma(0),\quad \sigma(2) = a_1\sigma(1) + a_2\sigma(0)\;\Longrightarrow\; a_1 = \frac{\sigma(1)\big(\sigma(0) - \sigma(2)\big)}{\sigma(0)^2 - \sigma(1)^2},\quad a_2 = \frac{\sigma(0)\sigma(2) - \sigma(1)^2}{\sigma(0)^2 - \sigma(1)^2}\]<p class="small">On remplace les \(\sigma(h)\) par leurs estimations empiriques (estimateurs de Yule-Walker), puis \(\hat\sigma^2 = \hat\sigma(0) - \hat a_1\hat\sigma(1) - \hat a_2\hat\sigma(2)\). En pratique, R maximise la vraisemblance (<code>arima</code>).</p>`)}
        <div class="panel" id="yw-panel"><div class="controls">${ctl.slider('yw-a1', 'a₁', -1.5, 1.5, 0.05, 0.5)}${ctl.slider('yw-a2', 'a₂', -0.95, 0.95, 0.05, 0.3)}${ctl.slider('yw-n', 'n', 50, 2000, 50, 200)}${ctl.slider('yw-seed', 'Graine', 1, 40, 1, 1)}</div><div id="yw-out"></div></div>` +
        exo(16, 'Montrer les expressions de \\(\\sigma(1)\\) et \\(\\sigma(2)\\).', R`<p>Yule-Walker (proposition 5) pour \(h = 1\) : \(\sigma(1) = a_1\sigma(0) + a_2\sigma(-1) = a_1\sigma(0) + a_2\sigma(1)\), d’où \(\sigma(1) = \frac{a_1}{1-a_2}\sigma(0)\). Pour \(h = 2\) : \(\sigma(2) = a_1\sigma(1) + a_2\sigma(0)\).</p>`) +
        exo(17, 'En déduire \\(a_1\\) et \\(a_2\\) en fonction de \\(\\sigma(0), \\sigma(1), \\sigma(2)\\).', R`<p>Le système \(\begin{cases}\sigma(1) = a_1\sigma(0) + a_2\sigma(1)\\ \sigma(2) = a_1\sigma(1) + a_2\sigma(0)\end{cases}\) a pour matrice \(\begin{pmatrix}\sigma(0)&\sigma(1)\\\sigma(1)&\sigma(0)\end{pmatrix}\), de déterminant \(\sigma(0)^2 - \sigma(1)^2\). Par Cramer : \(a_1 = \dfrac{\sigma(1)\sigma(0) - \sigma(1)\sigma(2)}{\sigma(0)^2-\sigma(1)^2}\) et \(a_2 = \dfrac{\sigma(0)\sigma(2) - \sigma(1)^2}{\sigma(0)^2-\sigma(1)^2}\).</p>`))}

      ${block('7.6.2 Choix de modèle : AIC et BIC', `<div class="grid-2">${formula('AIC (objectif : prévoir)', R`\[\text{AIC} = -2\log L(\hat\theta) + 2\nu\]`)}${formula('BIC (objectif : s’ajuster)', R`\[\text{BIC} = -2\log L(\hat\theta) + \nu\log n\]<p class="small">\(\nu\) : nombre de paramètres, \(n\) : nombre d’observations. Le support écrit \(n\nu\) : la pénalité correcte est \(\nu\log n\).</p>`)}</div>
        <div class="panel" id="ic-panel"><div class="controls">${ctl.select('ic-p', 'Vrai processus simulé', Object.entries(PRESETS).filter(([k]) => k !== 'ex11').map(([k, v]) => [k, v.label]), 'f21')}${ctl.slider('ic-n', 'n', 100, 1000, 50, 300)}</div><div id="ic-out"></div></div>`)}

      ${block('7.6.3 Prévision', `<div class="prose">${R`<p>On prévoit \(X_{n+h}\) par la combinaison linéaire \(\hat X_{n,h} = c_{1,h}X_1 + \dots + c_{n,h}X_n\) qui minimise \(\mathbb E[(X_{n+h} - \hat X_{n,h})^2]\) : c’est la projection de \(X_{n+h}\) sur l’espace engendré par le passé.</p>`}</div>` +
        exo(18, 'Montrer que la prévision au rang 1 d’un AR<sub>p</sub> est \\(\\hat X_{n+1} = a_1X_n + \\dots + a_pX_{n+1-p}\\). En déduire que l’erreur de prévision à horizon 1 est le bruit d’innovation.', R`<p>\(X_{n+1} = \sum_j a_jX_{n+1-j} + \epsilon_{n+1}\). Le premier terme est une combinaison du passé ; \(\epsilon_{n+1}\) est indépendant du passé, donc orthogonal à l’espace sur lequel on projette. La projection de \(X_{n+1}\) est donc \(\sum_j a_jX_{n+1-j}\), et l’erreur \(X_{n+1} - \hat X_{n+1} = \epsilon_{n+1}\), de variance \(\sigma^2\).</p>`) + `
        ${formula('Proposition 8', R`<p class="small">L’erreur à horizon 1 est l’innovation \(\epsilon_{n+1}\). La variance de l’erreur à horizon \(h\) croît de \(\sigma^2\) (pour \(h = 1\)) jusqu’à la variance du processus \(\sigma(0)\) : \(\operatorname{Var}(e_{n,h}) = \sigma^2\sum_{j=0}^{h-1}\psi_j^2 \to \sigma^2\sum_{j\ge0}\psi_j^2 = \sigma(0)\), où les \(\psi_j\) sont les coefficients de l’écriture MA(∞). Sous hypothèse gaussienne : \(\hat X_{n,h} \pm 1{,}96\sqrt{\operatorname{Var}(e_{n,h})}\).</p>`)}
        <div class="panel" id="pv-panel"><div class="controls">${ctl.select('pv-p', 'Processus', Object.entries(PRESETS).filter(([k]) => k !== 'ex11').map(([k, v]) => [k, v.label]), 'f18')}</div><div id="pv-c"></div></div>`)}

      ${block('Sous R', rCode(`# Simulation et corrélogrammes (figures 18 à 25)
ar1 <- arima.sim(model = list(ar = 0.8), n = 200)
ar2 <- arima.sim(model = list(ar = c(-0.5, -0.9)), n = 200)
ma1 <- arima.sim(model = list(ma = -0.8), n = 200)
arma22 <- arima.sim(model = list(ar = c(0.5, -0.3), ma = c(0.6, 0.3)), n = 200)
par(mfrow = c(1, 3)); plot(ar2); acf(ar2); pacf(ar2)

# Racines du polynôme caractéristique (exercice 11 : A(z) = 1 - z - z^2/2)
Mod(polyroot(c(1, -1, -0.5)))      # 0,732 < 1 : non stationnaire
ARMAacf(ar = c(-0.5, -0.9), lag.max = 20)               # ACF théorique
ARMAacf(ar = c(-0.5, -0.9), lag.max = 20, pacf = TRUE)  # PACF théorique

# Estimation : Yule-Walker (ar) ou maximum de vraisemblance (arima)
ar(ar2, aic = FALSE, order.max = 2, method = "yule-walker")
fit <- arima(ar2, order = c(2, 0, 0)); fit$coef; fit$aic; BIC(fit)

# Prévision et intervalle construit à la main
p <- predict(fit, n.ahead = 10)
cbind(prev = p$pred, inf = p$pred - 1.96 * p$se, sup = p$pred + 1.96 * p$se)`, 'R · §7'))}`;

      // Simulateur
      const getP = () => {
        if (val('sim-p') !== 'custom') return PRESETS[val('sim-p')];
        const a = [num('sim-a1'), num('sim-a2')], b = [num('sim-b1'), num('sim-b2'), num('sim-b3')];
        while (a.length && a[a.length - 1] === 0) a.pop(); while (b.length && b[b.length - 1] === 0) b.pop();
        return { a, b };
      };
      const drawSim = () => {
        el.querySelector('#sim-custom').hidden = val('sim-p') !== 'custom';
        const P = getP(), stat = TS.isStationary(P.a), inv = TS.isInvertible(P.b), n = int('sim-n');
        el.querySelector('#sim-eq').innerHTML = `\\[${procTex(P.a, P.b)}\\]`;
        root.UI.typeset(el.querySelector('#sim-eq'));
        const rA = TS.polyRoots(TS.arPoly(P.a)), rB = TS.polyRoots(TS.maPoly(P.b));
        el.querySelector('#sim-st').innerHTML = `<p>${stat ? pill('good', 'stationnaire') : pill('bad', 'non stationnaire')} ${P.b.length ? (inv ? pill('good', 'inversible') : pill('warn', 'non inversible')) : ''} <span class="small">modules des racines de A : ${rA.map((z) => f2(TS.modulus(z), 3)).join(' ; ') || '—'} · de B : ${rB.map((z) => f2(TS.modulus(z), 3)).join(' ; ') || '—'}</span></p>`;
        const x = TS.simulateArma({ phi: P.a, theta: P.b, n: stat ? n : 60, seed: int('sim-seed'), burn: stat ? 300 : 0 });
        plot(el.querySelector('#sim-c1'), { title: stat ? 'Trajectoire simulée' : 'Trajectoire (explosive : 60 premiers points)', height: 200, xLabel: (i) => String(Math.round(i) + 1), layers: [line(x, 'X_t', '--s1', 0, 1.3), { type: 'hline', value: 0 }] });
        const L = 20;
        acfChart(el.querySelector('#sim-c2'), x, L, 'ACF', { theory: stat ? TS.armaAcf(P.a, P.b, L).slice(1) : null });
        acfChart(el.querySelector('#sim-c3'), x, L, 'PACF', { pacf: true, theory: stat ? TS.armaPacf(P.a, P.b, L).slice(1) : null });
        complexPlane(el.querySelector('#sim-c4'), { title: 'Racines de A(z) et B(z)', height: 210, groups: [{ name: 'A(z)', roots: rA, color: '--s1' }, { name: 'B(z)', roots: rB, color: '--s2' }] });
      };
      bind(el.querySelector('#sim-panel'), drawSim, { debounce: 30 }); drawSim();

      // Yule-Walker AR2
      const drawYW = () => {
        const a = [num('yw-a1'), num('yw-a2')], out = el.querySelector('#yw-out');
        if (!TS.isStationary(a)) { out.innerHTML = '<div class="callout warn"><p>Ces coefficients ne vérifient pas les conditions de stationnarité de l’AR₂ (a₂ < 1 − a₁, a₂ < 1 + a₁, |a₂| < 1).</p></div>'; return; }
        const x = TS.simulateArma({ phi: a, n: int('yw-n'), seed: int('yw-seed') });
        const s0 = TS.autocov(x, 0), s1 = TS.autocov(x, 1), s2 = TS.autocov(x, 2), D = s0 * s0 - s1 * s1;
        const ha1 = (s1 * (s0 - s2)) / D, ha2 = (s0 * s2 - s1 * s1) / D, hs2 = s0 - ha1 * s1 - ha2 * s2;
        const ml = TS.sarimaFit(x, { p: 2 });
        out.innerHTML = table(['', 'a₁', 'a₂', 'σ²'], [['Vraie valeur', f2(a[0], 3), f2(a[1], 3), '1'], ['Yule-Walker (formules ci-dessus)', f2(ha1, 3), f2(ha2, 3), f2(hs2, 3)], ['Moindres carrés / vraisemblance', f2(ml.phi[0], 3), f2(ml.phi[1], 3), f2(ml.sigma2, 3)]], { numCols: [1, 2, 3] }) +
          '<p class="small muted">Augmentez n : les deux estimateurs convergent vers les vraies valeurs. En petit échantillon, Yule-Walker est un peu plus biaisé quand les racines sont proches du cercle unité.</p>';
      };
      bind(el.querySelector('#yw-panel'), drawYW, { debounce: 40 }); drawYW();

      // AIC / BIC
      const drawIC = () => {
        const P = PRESETS[val('ic-p')], x = TS.simulateArma({ phi: P.a, theta: P.b, n: int('ic-n'), seed: 5 }), n = x.length;
        const cands = [[1, 0], [2, 0], [3, 0], [0, 1], [0, 2], [0, 3], [1, 1], [2, 1], [1, 2], [2, 2]];
        const rows = cands.map(([p, q]) => { const f = TS.sarimaFit(x, { p, q }); return { p, q, aic: f.aic, bic: -2 * f.loglik + f.k * Math.log(f.nEff) }; });
        const ba = rows.reduce((m, r) => (r.aic < m.aic ? r : m)), bb = rows.reduce((m, r) => (r.bic < m.bic ? r : m));
        el.querySelector('#ic-out').innerHTML = table(['Modèle', 'AIC', 'BIC', ''], rows.map((r) => [`ARMA(${r.p},${r.q})`, f2(r.aic, 1), f2(r.bic, 1),
          (r.p === P.a.length && r.q === P.b.length ? pill('good', 'vrai') + ' ' : '') + (r === ba ? pill('warn', 'min AIC') + ' ' : '') + (r === bb ? pill('warn', 'min BIC') : '')]), { numCols: [1, 2] }) +
          `<p class="small">Le BIC pénalise plus fortement chaque paramètre (\\(\\log ${n} = ${f2(Math.log(n), 2)}\\) contre 2) : il choisit des modèles plus petits. Pour la figure 20, l’AR₂ vrai a \\(a_1 = 0\\) : un ARMA de même qualité peut lui être préféré.</p>`;
        root.UI.typeset(el.querySelector('#ic-out'));
      };
      bind(el.querySelector('#ic-panel'), drawIC, { debounce: 60 }); drawIC();

      // Variance de l'erreur de prévision
      const drawPV = () => {
        const P = PRESETS[val('pv-p')], H = 20, psi = TS.psiWeights(TS.arPoly(P.a), TS.maPoly(P.b), 3000);
        const s0 = psi.reduce((s, v) => s + v * v, 0); let acc = 0;
        const v = Array.from({ length: H }, (_, h) => (acc += psi[h] ** 2));
        plot(el.querySelector('#pv-c'), { title: 'Variance de l’erreur de prévision selon h (σ² = 1)', height: 220, yMin: 0, xLabel: (h) => 'h = ' + Math.round(h),
          layers: [{ type: 'hline', value: s0, label: `σ(0) = ${f2(s0, 2)}`, color: '--s2' }, { type: 'hline', value: 1, label: 'σ² = 1' }, { type: 'line', x: v.map((_, h) => h + 1), y: v, name: 'Var(e_{n,h})', color: '--s1' }, { type: 'points', x: v.map((_, h) => h + 1), y: v, name: 'Var(e_{n,h})', color: '--s1', r: 3 }] });
      };
      bind(el.querySelector('#pv-panel'), drawPV); drawPV();
    },
  });

  // ================================================================ §8 ARIMA / SARIMA
  CH.push({
    id: 'c8', icon: 'sarima', short: '8 · ARIMA et SARIMA',
    render(el) {
      const u = SERIES.usacc, x = u.values, n = x.length, ax = axis(u, 24);
      const y = TS.diff(x, 12), arY = TS.arYuleWalker(y), yF = TS.arForecast(y, arY, 24);
      const xF = []; for (let h = 0; h < 24; h++) xF.push(yF[h] + (h < 12 ? x[n - 12 + h] : xF[h - 12]));
      el.innerHTML = head('Cours §8 · Processus non stationnaires', 'ARIMA et SARIMA',
        'En pratique les séries ne sont pas stationnaires. On différencie, on modélise la série différenciée par un ARMA, puis on revient à la série initiale pour prévoir.') + `
      ${block('8.1 Exemple : revenir à la série initiale', `${formula('', R`\[y_t = x_t - x_{t-12}\;\Longrightarrow\; x_t = y_t + x_{t-12} = y_t + y_{t-12} + x_{t-24} = \dots\]`)}
        <div class="prose"><p>Illustration sur USAccDeaths : on modélise \\(y_t = \\Delta_{12}x_t\\) par un AR dont l’ordre est choisi par AIC (fonction <code>ar</code>), on prévoit \\(y\\), puis on reconstruit \\(\\hat x_{n+h} = \\hat y_{n+h} + x_{n+h-12}\\) (ou la prévision \\(\\hat x\\) déjà calculée au-delà de 12 mois).</p></div>
        <div class="panel"><div id="r-c1"></div><div id="r-tab"></div></div>` +
        exo(19, 'Écrire pour cet exemple la prévision à l’horizon 1 de la série \\((x_t)\\).', R`<p>\(x_{n+1} = y_{n+1} + x_{n-11}\), donc \(\hat x_{n,1} = \hat y_{n,1} + x_{n-11}\) : la valeur du même mois l’an dernier, corrigée de la variation annuelle prévue par le modèle ARMA de \((y_t)\). Pour \(h \le 12\), \(\hat x_{n,h} = \hat y_{n,h} + x_{n+h-12}\) ; au-delà, on remplace \(x_{n+h-12}\) par sa propre prévision.</p>`))}

      ${block('8.2 Définitions', `<div class="grid-2">
        ${formula('Définition 5 · ARIMA<sub>p,d,q</sub>', R`\[Y_t = \Delta^dX_t \text{ est un ARMA}_{p,q}\]<p class="small">Adapté à une tendance polynomiale de degré \(d-1\)… et plus généralement à une tendance stochastique (marche aléatoire : \(d = 1\)).</p>`)}
        ${formula('Définition 6 · SARIMA<sub>p,d,q,T</sub> (version du cours)', R`\[Y_t = \Delta_T\circ\Delta^dX_t \text{ est un ARMA}_{p,q}\]<p class="small">Période \(T\) et tendance polynomiale.</p>`)}</div>
        <div class="callout"><p><strong>Le modèle SARIMA complet</strong> (Box et Jenkins), celui de <code>arima(..., seasonal = list(order = c(P, D, Q), period = T))</code>, ajoute une partie ARMA saisonnière : \\(A(L)\\,\\mathcal A(L^T)\\,\\Delta^d\\Delta_T^D X_t = B(L)\\,\\mathcal B(L^T)\\,\\epsilon_t\\). La version du cours correspond à \\((P, D, Q) = (0, 1, 0)\\). Le support conseille par défaut \\((P, D, Q) = (p, d, q)\\) ; le modèle « airline » \\((0,1,1)(0,1,1)_{12}\\) en est un exemple célèbre.</p></div>`)}

      ${block('8.3 Mise en œuvre : estimer et prévoir', `<div class="panel" id="sa-panel">
        <div class="controls">${ctl.select('sa-ser', 'Série', [['usacc', 'USAccDeaths'], ['airlog', 'log(AirPassengers)'], ['co2', 'co2']], 'usacc')}${ctl.select('sa-conv', 'Partie saisonnière', [['cours', 'version du cours : (P,D,Q) = (0,1,0)'], ['pdq', 'conseil du cours : (P,D,Q) = (p,d,q)'], ['airline', '(0,1,1) : modèle airline']], 'airline')}</div>
        <div class="orders"><div class="grp"><span class="grp-title">(p, d, q)</span>${ctl.number('sa-p', 'p', 0, 0, 3)}${ctl.number('sa-d', 'd', 1, 0, 2)}${ctl.number('sa-q', 'q', 1, 0, 3)}</div><span class="small muted">T = 12</span></div>
        <div id="sa-out"></div></div>`)}

      ${block('Sous R', rCode(`x <- USAccDeaths
## 8.1 Reconstruction à la main
y <- diff(x, lag = 12)                         # y_t = x_t - x_{t-12}
fy <- ar(y, aic = TRUE)                        # ordre choisi par AIC
py <- predict(fy, n.ahead = 24)$pred
xh <- numeric(24); xs <- as.numeric(x)
for (h in 1:24) xh[h] <- py[h] + (if (h <= 12) xs[length(xs) - 12 + h] else xh[h - 12])
xh

## 8.3 Simulation d'un ARIMA et estimation d'un SARIMA
sim <- arima.sim(model = list(order = c(1, 1, 0), ar = 0.7), n = 200)
fit <- arima(x, order = c(0, 1, 1), seasonal = list(order = c(0, 1, 1), period = 12))
fit$coef; fit$aic; Box.test(fit$resid, lag = 20, type = "Ljung-Box", fitdf = 2)
p <- predict(fit, n.ahead = 24)
inf <- p$pred - 1.96 * p$se; sup <- p$pred + 1.96 * p$se      # IC à 95 % construit à la main
ts.plot(x, p$pred, inf, sup, lty = c(1, 1, 2, 2), col = c(1, 2, 2, 2))`, 'R · §8'))}`;

      plot(el.querySelector('#r-c1'), { title: `Prévision par reconstruction (AR(${arY.order}) sur Δ₁₂x, ordre choisi par AIC)`, height: 250, xLabel: ax.label, xTicks: ax.ticks,
        layers: [{ type: 'shade', from: n - 0.5, to: n + 24, label: 'prévision' }, line(x, 'USAccDeaths', '--s1', 0, 1.4), { type: 'line', x: xF.map((_, h) => n + h), y: xF, name: 'x̂ reconstruit', color: '--s2', width: 2 }] });
      const dts = root.TSData.extendDates(u.dates, 'M', 3);
      el.querySelector('#r-tab').innerHTML = table(['Mois', 'ŷ (AR sur Δ₁₂x)', '+ x du même mois en 1978', '= x̂'], [0, 1, 2].map((h) => [`${MOIS[+dts[h].slice(5) - 1]} ${dts[h].slice(0, 4)}`, f2(yF[h], 1), f2(x[n - 12 + h], 0), f2(xF[h], 1)]), { numCols: [1, 2, 3] }) +
        `<p class="small muted">Coefficients AR estimés (Yule-Walker, comme <code>ar()</code>) : ${arY.coef.map((c) => f2(c, 4)).join(' ; ')}. Résultats identiques à R.</p>`;

      const drawSA = () => {
        const id = val('sa-ser'), s = id === 'airlog' ? { ...SERIES.air, values: SERIES.air.values.map(Math.log) } : SERIES[id];
        const p = int('sa-p'), d = int('sa-d'), q = int('sa-q'), conv = val('sa-conv');
        const PDQ = conv === 'cours' ? [0, 1, 0] : conv === 'pdq' ? [p, d, q] : [0, 1, 1];
        const out = el.querySelector('#sa-out');
        let fit;
        try { fit = TS.sarimaFit(s.values, { p, d, q, P: PDQ[0], D: PDQ[1], Q: PDQ[2], s: 12 }); } catch (e) { out.innerHTML = `<div class="callout warn"><p>${esc(e.message)}</p></div>`; return; }
        const H = 24, fc = fit.forecast(H), nS = s.values.length, ax2 = axis(s, H), nPar = p + q + PDQ[0] + PDQ[2];
        const lb = TS.ljungBox(fit.resid, [20], nPar)[0];
        out.innerHTML = `<p><strong>SARIMA(${p},${d},${q})(${PDQ.join(',')})₁₂</strong> · AIC ${f2(fit.aic, 1)} · σ̂² ${f2(fit.sigma2, 5)} · Ljung-Box (20 retards) p = ${fp(lb.pvalue)} ${lb.pvalue < 0.05 ? pill('bad', 'résidus non blancs') : pill('good', 'résidus blancs')}</p>` +
          (fit.coefs.length ? table(['Coefficient', 'Estimation', 'Écart-type', 'p-valeur'], fit.coefs.map((c) => [c.name, f2(c.value, 4), f2(c.se, 4), fp(c.pvalue)]), { numCols: [1, 2, 3] }) : '') +
          '<div id="sa-c"></div>' + table(['h', 'p$pred', 'p$se', 'p$pred − 1,96 p$se', 'p$pred + 1,96 p$se'], [0, 1, 2, 11, 23].map((h) => {
            const se = fc.sd[h], pr = fc.mean[h];
            return [h + 1, f2(pr, 4), f2(se, 4), f2(pr - 1.96 * se, 4), f2(pr + 1.96 * se, 4)];
          }), { numCols: [1, 2, 3, 4] }) + `<p class="small muted">Estimation par moindres carrés conditionnels ; R (<code>arima</code>, vraisemblance exacte) donne des valeurs très proches.${id === 'airlog' ? ' La série modélisée est log(AirPassengers) : les bornes ci-dessus sont sur l’échelle log.' : ''}</p>`;
        plot(out.querySelector('#sa-c'), { title: 'Prévision et intervalle à 95 %', height: 250, xLabel: ax2.label, xTicks: ax2.ticks,
          layers: [{ type: 'shade', from: nS - 0.5, to: nS + H, label: 'prévision' }, { type: 'band', x: fc.mean.map((_, h) => nS + h), lo: fc.lo, hi: fc.hi, name: 'IC 95 %', color: '--s2', of: 'prévision' },
            line(s.values, 'série', '--s1', 0, 1.3), { type: 'line', x: fc.mean.map((_, h) => nS + h), y: fc.mean, name: 'prévision', color: '--s2', width: 2 }] });
      };
      bind(el.querySelector('#sa-panel'), drawSA, { debounce: 60 }); drawSA();
    },
  });

  // ================================================================ §9 TP 4
  CH.push({
    id: 'tp4', icon: 'tp', short: 'TP 4 · ARMA et ARIMA (corrigé)',
    render(el) {
      el.innerHTML = head('Cours §9 · TP 4 corrigé', 'TP 4 : simuler, identifier, prévoir',
        'Durée prévue : 4 h. Simulation (9.1) avec le simulateur du chapitre 7, identification d’une série inconnue (9.2), étude par Monte-Carlo de l’erreur de prévision d’un AR₃ (9.3).') + `
      ${block('9.1 Simulation de processus ARMA', `<div class="tpq-list">
        ${tpq('1', 'Définition d’un ARMA<sub>p,q</sub> et conditions de stationnarité.', R`\(X_t - \sum_{k=1}^pa_kX_{t-k} = \epsilon_t + \sum_{j=1}^qb_j\epsilon_{t-j}\), stationnaire si toutes les racines de \(A(z) = 1 - a_1z - \dots - a_pz^p\) sont de module \(> 1\) (et, pour l’inversibilité, celles de \(B\)).`)}
        ${tpq('2–4', 'Simuler des AR<sub>p</sub>, MA<sub>q</sub>, ARMA<sub>p,q</sub> et observer les corrélogrammes.', 'Voir le <a href="#c7">simulateur du chapitre 7</a> (figures 18 à 25). On constate la table 1 : coupure de la PACF après p pour un AR, de l’ACF après q pour un MA, décroissance des deux pour un ARMA.')}
        ${tpq('5', 'Même chose avec un ARIMA<sub>p,d,q</sub>.', 'Avec d = 1 la trajectoire erre sans revenir vers une moyenne (somme cumulée d’un ARMA) et l’ACF décroît très lentement depuis 1 : il faut différencier avant d’identifier p et q.')}</div>
        <div class="panel" id="ar-panel"><div class="controls">${ctl.slider('ar-a', 'a (partie AR de ΔX)', -0.9, 0.9, 0.1, 0.6)}${ctl.slider('ar-seed', 'Graine', 1, 30, 1, 2)}</div><div class="grid-3"><div id="ar-c1"></div><div id="ar-c2"></div><div id="ar-c3"></div></div></div>`)}

      ${block('9.2 Identification d’un processus ARMA', `<p class="small">Fichiers : <a href="donnees/serie1.dat">serie1.dat</a> · <a href="donnees/serie2.dat">serie2.dat</a> (et leurs versions .csv). La solution est dans <code>donnees/SOLUTIONS_SIMULATIONS.md</code>, à n’ouvrir qu’après avoir cherché.</p>
        <div class="panel" id="id-panel">
          <div class="controls">${ctl.select('id-src', 'Série', [['serie1', 'serie1.dat (question 1 à 6)'], ['serie2', 'serie2.dat (question 7)'], ['random', 'série d’entraînement aléatoire']], 'serie1')}<button type="button" id="id-new" class="ghost">Autre série d’entraînement</button></div>
          <div class="grid-2"><div id="id-c1"></div><div id="id-c2"></div></div>
          <div class="grid-2"><div id="id-c3"></div><div id="id-c4"></div></div>
          <div class="controls">${ctl.select('id-p', 'Modèle AR proposé', [['1', 'AR₁'], ['2', 'AR₂'], ['3', 'AR₃']], '1')}${ctl.select('id-q', 'Modèle MA proposé', [['1', 'MA₁'], ['2', 'MA₂'], ['3', 'MA₃']], '1')}<button type="button" id="id-go">Estimer et tester</button></div>
          <div id="id-out"></div></div>
        <div class="tpq-list">
          ${tpq('1', 'Ce processus est-il modélisable par un ARMA ?', 'Non directement : il n’est pas stationnaire (niveau qui dérive, ACF qui décroît très lentement).')}
          ${tpq('2', 'Quelle transformation fait <code>diff</code> ? Pourquoi ?', R`\(\Delta X_t = X_t - X_{t-1}\) : elle retire une tendance (stochastique ou polynomiale de degré 1) pour obtenir une série stationnaire.`)}
          ${tpq('3–6', 'Proposer un AR<sub>p</sub> et un MA<sub>q</sub> d’ordre faible, estimer, tester la blancheur des résidus, conclure.', 'Lire la PACF pour p (dernier retard significatif), l’ACF pour q. Retenir le modèle dont les résidus passent le test de Ljung-Box et dont l’AIC est le plus faible.')}
        </div>`)}

      ${block('9.3 Prévision dans un processus ARMA (Monte-Carlo)', `${formula('', R`\[X_t - X_{t-1} + \tfrac12X_{t-2} - \tfrac13X_{t-3} = \epsilon_t \iff X_t = X_{t-1} - \tfrac12X_{t-2} + \tfrac13X_{t-3} + \epsilon_t\]<p class="small">C’est un AR₃ (\(a_1 = 1,\ a_2 = -\tfrac12,\ a_3 = \tfrac13\)) ; les racines de \(A(z) = 1 - z + \tfrac12z^2 - \tfrac13z^3\) ont pour modules <span id="mc-roots"></span> : il est stationnaire.</p>`)}
        <div class="panel" id="mc-panel"><div class="controls">${ctl.slider('mc-n', 'Longueur d’observation', 100, 1000, 50, 100)}${ctl.slider('mc-R', 'Nombre de simulations', 50, 1000, 50, 50)}<button type="button" id="mc-go">Lancer</button></div><div id="mc-busy" class="busy"></div><div id="mc-out"></div></div>
        <div class="tpq-list">
          ${tpq('1–3', 'Simuler 50 réalisations de longueur 105, estimer un AR₃ sur les 100 premières valeurs, prévoir les 5 suivantes.', 'C’est ce que fait le bouton « Lancer » (estimation par moindres carrés conditionnels, très proche de <code>arima</code>).')}
          ${tpq('4', 'Biais et variance de l’erreur de prévision à 1, 2, 3, 4, 5 pas.', 'Le biais est proche de 0 (la prévision est sans biais). La variance croît avec l’horizon, en partant de σ² = 1 à un pas (proposition 8), et reste un peu au-dessus de la valeur théorique à cause de l’erreur d’estimation des coefficients.')}
          ${tpq('5', 'Allonger la durée d’observation et comparer.', 'Avec 500 ou 1000 observations, les coefficients sont mieux estimés : la variance empirique se rapproche de la variance théorique \\(\\sigma^2\\sum_{j=0}^{h-1}\\psi_j^2\\). L’écart restant est l’incertitude due à l’estimation, en \\(O(1/n)\\).')}
        </div>`)}

      ${block('9.4 Précipitations mensuelles, 1932–1966', `<p class="small">Fichier : ${fileLinks(SERIES.precip)}. Substitut de <code>sanfran.dat</code> : même période (1932–1966), précipitations mensuelles en mm (Hipel &amp; McLeod, 1994, région montagneuse du sud-ouest des États-Unis). Apprentissage : 1932–1963 ; test : 1964–1966.</p>
        <div class="panel"><div class="grid-2"><div id="pr-c1"></div><div id="pr-c2"></div></div><div id="pr-c3"></div><div id="pr-tab"></div><div class="tpq-list" id="pr-q"></div></div>`)}

      ${block('9.5 Taux d’intérêt', `<p class="small">Fichier : ${fileLinks(SERIES.taux)}. Substitut de <code>UKinterestrates.dat</code>, introuvable dans les sources publiques : taux des obligations d’État australiennes à 2 ans, mensuel, janvier 1969 – septembre 1994 (Reserve Bank of Australia). La démarche demandée est la même.</p>
        <div class="panel"><div class="grid-2"><div id="tx-c1"></div><div id="tx-c2"></div></div><div class="grid-2"><div id="tx-c3"></div><div id="tx-c4"></div></div><div id="tx-tab"></div><div id="tx-c5"></div><div class="tpq-list" id="tx-q"></div></div>`)}

      ${block('Corrigé sous R', rCode(`## 9.2 Identification (depuis la racine du dépôt)
s <- ts(scan("donnees/serie1.dat")); plot(s); acf(s)       # non stationnaire
ds <- diff(s); plot(ds); acf(ds); pacf(ds)                  # PACF : coupure après 1
f_ar <- arima(s, order = c(1, 1, 0)); f_ma <- arima(s, order = c(0, 1, 1))
Box.test(f_ar$resid, lag = 20, type = "Ljung-Box", fitdf = 1); c(AR = f_ar$aic, MA = f_ma$aic)
s2 <- ts(scan("donnees/serie2.dat")); acf(diff(s2)); pacf(diff(s2))   # ACF : coupure après 2
arima(s2, order = c(0, 1, 2))

## 9.3 Monte-Carlo de l'erreur de prévision d'un AR3
a <- c(1, -1/2, 1/3); Mod(polyroot(c(1, -a)))     # tous > 1 : stationnaire
n <- 100; R <- 50; H <- 5
err <- matrix(NA, R, H)
for (r in 1:R) {
  x <- arima.sim(model = list(ar = a), n = n + H)
  fit <- arima(x[1:n], order = c(3, 0, 0))
  err[r, ] <- x[(n + 1):(n + H)] - predict(fit, n.ahead = H)$pred
}
colMeans(err)                 # biais par horizon
apply(err, 2, var)            # variance empirique de l'erreur
cumsum(c(1, ARMAtoMA(ar = a, lag.max = H - 1)^2))     # variance théorique (σ² = 1)

## 9.4 Précipitations : apprentissage 1932-1963, test 1964-1966
precip <- ts(scan("donnees/precipitations.dat"), start = c(1932, 1), frequency = 12)
train <- window(precip, end = c(1963, 12)); test <- window(precip, start = c(1964, 1))
acf(train, lag.max = 36); acf(diff(train, lag = 12), lag.max = 36)
ar(diff(train, lag = 12), aic = TRUE)$order                    # 24 : un AR mime mal un MA saisonnier
f_s <- arima(train, order = c(2, 0, 0), seasonal = list(order = c(0, 1, 0), period = 12))   # SARIMA{2,0,0,12}
Box.test(f_s$resid, lag = 24, type = "Ljung-Box", fitdf = 2)
f_a <- arima(train, order = c(0, 0, 0), seasonal = list(order = c(0, 1, 1), period = 12))   # MA saisonnier
prev <- list(sarima_200_12 = predict(f_s, 36)$pred, sma = predict(f_a, 36)$pred,
             hw_saison = predict(HoltWinters(train), 36), hw_sans = predict(HoltWinters(train, gamma = FALSE), 36),
             moyenne_mensuelle = rep(tapply(train, cycle(train), mean), 3))
sapply(prev, function(p) sqrt(mean((as.numeric(p) - test)^2)))   # RMSE sur 1964-1966
ts.plot(test, ts(prev$sma, start = c(1964, 1), frequency = 12), col = 1:2)

## 9.5 Taux d'intérêt
taux <- ts(scan("donnees/taux_interet.dat"), start = c(1969, 1), frequency = 12)
plot(taux); acf(taux); tseries::adf.test(taux)
dt <- diff(taux); acf(dt); pacf(dt)
fits <- list(); for (p in 0:2) for (q in 0:2) fits[[paste(p, q)]] <- arima(taux, order = c(p, 1, q))
sort(sapply(fits, AIC))[1:5]
best <- arima(taux, order = c(1, 1, 1)); Box.test(best$resid, lag = 20, type = "Ljung-Box", fitdf = 2)
p <- predict(best, 24); ts.plot(taux, p$pred, p$pred - 1.96 * p$se, p$pred + 1.96 * p$se, lty = c(1, 1, 2, 2))`, 'R · TP 4'))}`;

      // 9.1 ARIMA(1,1,0)
      const drawAR = () => {
        const dx = TS.simulateArma({ phi: [num('ar-a')], n: 300, seed: int('ar-seed') });
        let s = 0; const x = dx.map((v) => (s += v));
        plot(el.querySelector('#ar-c1'), { title: 'ARIMA(1,1,0) simulé', height: 200, xLabel: (i) => String(Math.round(i) + 1), layers: [line(x, 'X_t')] });
        acfChart(el.querySelector('#ar-c2'), x, 25, 'ACF de X_t');
        acfChart(el.querySelector('#ar-c3'), TS.diff(x), 25, 'ACF de ΔX_t');
      };
      bind(el.querySelector('#ar-panel'), drawAR, { debounce: 30 }); drawAR();

      // 9.2 identification
      let seed = 21, truth;
      const MODELS = [{ a: [0.7], b: [] }, { a: [0.5, 0.3], b: [] }, { a: [], b: [0.7] }, { a: [], b: [0.6, 0.4] }, { a: [-0.6], b: [] }, { a: [], b: [-0.7] }];
      const FILES = { serie1: { a: [0.7], b: [], x: root.CoursTP.serie1 }, serie2: { a: [], b: [0.6, 0.4], x: root.CoursTP.serie2 } };
      const newId = () => {
        const src = val('id-src');
        if (src === 'random') {
          const r = TS.mulberry32(seed); truth = { ...MODELS[Math.floor(r() * MODELS.length)] };
          const dx = TS.simulateArma({ phi: truth.a, theta: truth.b, n: 300, seed }); let s = 50; truth.x = dx.map((v) => (s += v));
        } else truth = FILES[src];
        plot(el.querySelector('#id-c1'), { title: val('id-src') === 'random' ? 'Série d’entraînement' : val('id-src') + '.dat', height: 200, xLabel: (i) => String(Math.round(i) + 1), layers: [line(truth.x, 'X_t')] });
        plot(el.querySelector('#id-c2'), { title: 'Série différenciée ΔX_t', height: 200, xLabel: (i) => String(Math.round(i) + 2), layers: [line(TS.diff(truth.x), 'ΔX_t', '--s3'), { type: 'hline', value: 0 }] });
        acfChart(el.querySelector('#id-c3'), TS.diff(truth.x), 20, 'ACF de ΔX_t');
        acfChart(el.querySelector('#id-c4'), TS.diff(truth.x), 20, 'PACF de ΔX_t', { pacf: true });
        el.querySelector('#id-out').innerHTML = '';
      };
      el.querySelector('#id-new').addEventListener('click', () => { seed += 13; el.querySelector('#id-src').value = 'random'; newId(); });
      el.querySelector('#id-src').addEventListener('change', newId);
      el.querySelector('#id-go').addEventListener('click', () => {
        const p = int('id-p'), q = int('id-q');
        const fa = TS.sarimaFit(truth.x, { p, d: 1 }), fm = TS.sarimaFit(truth.x, { q, d: 1 });
        const la = TS.ljungBox(fa.resid, [20], p)[0], lm = TS.ljungBox(fm.resid, [20], q)[0];
        const rows = [[`ARIMA(${p},1,0)`, fa.coefs.map((c) => `${c.name} = ${f2(c.value, 3)}`).join(', '), f2(fa.aic, 1), fp(la.pvalue), la.pvalue < 0.05 ? pill('bad', 'non blancs') : pill('good', 'blancs')],
          [`ARIMA(0,1,${q})`, fm.coefs.map((c) => `${c.name} = ${f2(c.value, 3)}`).join(', '), f2(fm.aic, 1), fp(lm.pvalue), lm.pvalue < 0.05 ? pill('bad', 'non blancs') : pill('good', 'blancs')]];
        const best = fa.aic < fm.aic ? rows[0][0] : rows[1][0];
        const tr = `ARIMA(${truth.a.length},1,${truth.b.length})`;
        el.querySelector('#id-out').innerHTML = table(['Modèle', 'Coefficients', 'AIC', 'Ljung-Box p', 'Résidus'], rows, { numCols: [2, 3] }) +
          `<div class="callout"><p>Choix à l’AIC parmi vos deux propositions : <strong>${best}</strong>. Le vrai processus était <strong>${tr}</strong> avec ${truth.a.length ? `a = (${truth.a.map((v) => f2(v, 1)).join(' ; ')})` : ''}${truth.b.length ? `b = (${truth.b.map((v) => f2(v, 1)).join(' ; ')})` : ''}. ${truth.a.length ? 'Indice qu’il fallait voir : PACF de ΔX qui coupe après ' + truth.a.length + ', ACF qui décroît.' : 'Indice qu’il fallait voir : ACF de ΔX qui coupe après ' + truth.b.length + ', PACF qui décroît.'}</p></div>`;
      });
      newId();

      // 9.4 Précipitations
      (() => {
        const P = SERIES.precip, px = P.values, nTr = 32 * 12, ptr = px.slice(0, nTr), pte = px.slice(nTr), pax = axis(P);
        const d12 = TS.diff(ptr, 12), r12x = TS.acf(ptr, 24), r12d = TS.acf(d12, 24), pAIC = TS.arYuleWalker(d12, null, 30).order;
        const fS = TS.sarimaFit(ptr, { p: 2, D: 1, s: 12 }), lbS = TS.ljungBox(fS.resid, [24], 2)[0];
        const fA = TS.sarimaFit(ptr, { Q: 1, D: 1, s: 12 }), lbA = TS.ljungBox(fA.resid, [24], 1)[0];
        const clim = Array.from({ length: 12 }, (_, m) => TS.mean(ptr.filter((_, i) => i % 12 === m)));
        const models = [
          { name: 'SARIMA{2,0,0,12} (énoncé)', fc: fS.forecast(36).mean },
          { name: `MA saisonnier (0,0,0)(0,1,1)₁₂, Θ = ${f2(fA.Theta[0], 2)}`, fc: fA.forecast(36).mean },
          { name: 'Holt-Winters avec saison', fc: TS.hwRFit(ptr, { f: 12 }).predict(36, false).mean },
          { name: 'Holt-Winters sans saison', fc: TS.hwRFit(ptr, { gamma: false }).predict(36, false).mean },
          { name: 'Moyenne mensuelle 1932–1963', fc: Array.from({ length: 36 }, (_, k) => clim[k % 12]) },
        ].map((m) => ({ ...m, rmse: Math.sqrt(TS.mean(m.fc.map((v, k) => (v - pte[k]) ** 2))), mae: TS.mean(m.fc.map((v, k) => Math.abs(v - pte[k]))) })).sort((a, b) => a.rmse - b.rmse);
        plot(el.querySelector('#pr-c1'), { title: 'Précipitations mensuelles (mm)', height: 200, xLabel: pax.label, xTicks: pax.ticks, layers: [line(px, 'mm', '--s1', 0, 1)] });
        acfChart(el.querySelector('#pr-c2'), ptr, 36, 'ACF de la série (1932–1963)');
        const colors = root.TSModels ? root.TSModels.MODEL_COLORS : ['--s2', '--s3', '--s5', '--s4', '--ink-3'];
        plot(el.querySelector('#pr-c3'), { title: 'Q4–Q6 · Prévisions de 1964–1966 et valeurs réelles', height: 260, xLabel: pax.label, xTicks: pax.ticks, xMin: nTr - 48,
          layers: [{ type: 'shade', from: nTr - 0.5, to: px.length - 0.5, label: 'test' }, line(px.slice(nTr - 48), 'observé', '--s1', nTr - 48, 1.8),
            ...models.map((m, i) => ({ type: 'line', x: m.fc.map((_, k) => nTr + k), y: m.fc, name: m.name, color: ['--s2', '--s3', '--s5', '--s4', '--ink-3'][i], dash: i > 0, width: 1.6 }))] });
        el.querySelector('#pr-tab').innerHTML = table(['Modèle (estimé sur 1932–1963)', 'RMSE 1964–1966', 'MAE'], models.map((m) => [esc(m.name), f2(m.rmse, 2), f2(m.mae, 2)]), { numCols: [1, 2], rowClass: (_, i) => (i === 0 ? 'best' : '') });
        const best = models[0], sar = models.find((m) => m.name.startsWith('SARIMA{2'));
        el.querySelector('#pr-q').innerHTML = [
          tpq('1', 'La série semble-t-elle stationnaire ? Sinon, la rendre stationnaire.', `Pas de tendance, mais une saison annuelle nette : ρ̂(12) = ${f2(r12x[12], 2)}, ρ̂(24) = ${f2(r12x[24], 2)}. La moyenne dépend du mois : la série n’est pas stationnaire au sens strict du cours. On applique \\(\\Delta_{12}\\) (ou on retire la moyenne de chaque mois).`),
          tpq('2', 'Proposer un AR<sub>p</sub> pour la série stationnarisée et tester les résidus.', `Sur \\(\\Delta_{12}x_t\\), l’ACF vaut ${f2(r12d[12], 2)} au retard 12 et s’annule ensuite : c’est la signature d’un <strong>MA saisonnier</strong>, pas d’un AR. Le critère AIC de <code>ar()</code> réclame un ordre p = <strong>${pAIC}</strong> pour l’imiter : un AR<sub>p</sub> n’est pas adapté ici.`),
          tpq('3', 'SARIMA{2,0,0,12} jusqu’à fin 1963 : que dire de ce choix ? Tester les résidus.', `Le modèle impose un AR₂ sur \\(\\Delta_{12}x_t\\). Ses résidus ne sont pas blancs : Ljung-Box à 24 retards, p = ${fp(lbS.pvalue)}. La différence saisonnière d’une saison <em>stable</em> crée l’auto-corrélation −0,5 au retard 12 que l’AR₂ ne sait pas représenter. Un MA saisonnier l’absorbe (Θ = ${f2(fA.Theta[0], 2)}, Ljung-Box p = ${fp(lbA.pvalue)}) ; Θ proche de −1 indique que la différence saisonnière était superflue.`),
          tpq('4–6', 'Prévoir 1964–1966 et comparer graphiquement avec Holt-Winters, avec et sans saison.', `Holt-Winters sans saison est très mauvais (RMSE ${f2(models.find((m) => m.name.includes('sans')).rmse, 1)}) : il prévoit une constante. Les modèles saisonniers suivent le cycle annuel ; le SARIMA{2,0,0,12} a un RMSE de ${f2(sar.rmse, 1)}.`),
          tpq('7', 'Comment répondre de façon moins subjective ?', `Avec une erreur de prévision sur la période test (RMSE, MAE). Ici le meilleur est <strong>${esc(best.name)}</strong> (RMSE ${f2(best.rmse, 2)} mm). La simple moyenne de chaque mois sur 1932–1963 fait aussi bien que les modèles plus complexes : la série est une saison stable plus un bruit, et le reste n’est pas prévisible.`),
        ].join('');
        root.UI.typeset(el.querySelector('#pr-q'));
      })();

      // 9.5 Taux d'intérêt
      (() => {
        const T = SERIES.taux, tx = T.values, H = 24, tax = axis(T, H), dt = TS.diff(tx), adf = TS.adf(tx), adfD = TS.adf(dt);
        const grid = TS.autoSarima(tx, { d: 1, D: 0, s: 1, maxp: 2, maxq: 2 }).sort((a, b) => a.aic - b.aic);
        const best = grid[0], lb = TS.ljungBox(best.resid, [20], best.order.p + best.order.q)[0], fc = best.forecast(H), n = tx.length;
        plot(el.querySelector('#tx-c1'), { title: 'Taux à 2 ans (%)', height: 200, xLabel: tax.label, xTicks: tax.ticks, layers: [line(tx, 'taux', '--s1', 0, 1.3)] });
        acfChart(el.querySelector('#tx-c2'), tx, 30, 'ACF de la série');
        acfChart(el.querySelector('#tx-c3'), dt, 24, 'ACF de Δx_t');
        acfChart(el.querySelector('#tx-c4'), dt, 24, 'PACF de Δx_t', { pacf: true });
        el.querySelector('#tx-tab').innerHTML = table(['Modèle', 'AIC', 'Coefficients'], grid.slice(0, 5).map((f) => [TS.orderLabel(f.order), f2(f.aic, 2), f.coefs.map((c) => `${c.name} = ${f2(c.value, 3)}`).join(', ') || '—']), { numCols: [1], rowClass: (_, i) => (i === 0 ? 'best' : '') });
        plot(el.querySelector('#tx-c5'), { title: `Prévision à 24 mois, ${TS.orderLabel(best.order)} (IC 95 %)`, height: 240, xLabel: tax.label, xTicks: tax.ticks, xMin: n - 120,
          layers: [{ type: 'shade', from: n - 0.5, to: n + H, label: 'prévision' }, { type: 'band', x: fc.mean.map((_, h) => n + h), lo: fc.lo, hi: fc.hi, name: 'IC 95 %', color: '--s2', of: 'prévision' },
            line(tx.slice(n - 120), 'taux', '--s1', n - 120, 1.5), { type: 'line', x: fc.mean.map((_, h) => n + h), y: fc.mean, name: 'prévision', color: '--s2', width: 2 }] });
        el.querySelector('#tx-q').innerHTML = [
          tpq('Stationnarité', 'La série est-elle stationnaire ?', `Non : l’ACF décroît très lentement et le test ADF ne rejette pas la racine unitaire (p = ${fp(adf.pvalue)}). Après une différence, ADF p = ${fp(adfD.pvalue)} : \\(\\Delta x_t\\) est stationnaire. Pas de saisonnalité visible (données financières mensuelles) : pas de \\(\\Delta_{12}\\).`),
          tpq('Modèle', 'Quel modèle ARMA, ARIMA ou SARIMA ?', `On compare les ARIMA(p,1,q), p, q ≤ 2, par AIC : <strong>${TS.orderLabel(best.order)}</strong> arrive en tête (tableau). Ljung-Box sur ses résidus (20 retards) : p = ${fp(lb.pvalue)} ${lb.pvalue < 0.05 ? '— il reste un peu de dépendance, en partie due aux changements de régime de la politique monétaire.' : '— résidus compatibles avec un bruit blanc.'} ${TS.orderLabel(best.order) === 'ARIMA(1,1,1)' ? 'Dans R, <code>arima</code> (vraisemblance exacte) classe aussi ARIMA(1,1,1) en tête.' : 'Dans R, <code>arima</code> (vraisemblance exacte, et non moindres carrés conditionnels) classe ARIMA(1,1,1) en tête : les AIC des premiers candidats sont très proches.'}`),
          tpq('Prévision', 'Que vaut la prévision ?', `Prévision à 24 mois : ${f2(fc.mean[H - 1], 2)} %, intervalle à 95 % [${f2(fc.lo[H - 1], 2)} ; ${f2(fc.hi[H - 1], 2)}]. L’intervalle s’élargit vite : avec d = 1, un taux d’intérêt se prévoit à peine mieux que par sa dernière valeur.`),
        ].join('');
        root.UI.typeset(el.querySelector('#tx-q'));
      })();

      // 9.3 Monte-Carlo
      const a3 = [1, -0.5, 1 / 3];
      el.querySelector('#mc-roots').textContent = TS.polyRoots(TS.arPoly(a3)).map((z) => f2(TS.modulus(z), 3)).join(' ; ');
      const run = async (ev) => {
        const btn = ev ? ev.currentTarget : null; if (btn) btn.disabled = true;
        const n = int('mc-n'), Rn = int('mc-R'), H = 5, busy = el.querySelector('#mc-busy');
        const err = Array.from({ length: H }, () => []);
        for (let r = 0; r < Rn; r++) {
          const x = TS.simulateArma({ phi: a3, n: n + H, seed: 1000 + r });
          const fit = TS.sarimaFit(x.slice(0, n), { p: 3, includeMean: true });
          const fc = fit.forecast(H).mean;
          for (let h = 0; h < H; h++) err[h].push(x[n + h] - fc[h]);
          if (r % 25 === 0) { busy.textContent = `Simulation ${r + 1} / ${Rn}…`; await tick(); }
        }
        busy.textContent = '';
        const psi = TS.psiWeights(TS.arPoly(a3), [1], H); let acc = 0;
        const th = psi.map((v) => (acc += v * v));
        el.querySelector('#mc-out').innerHTML = table(['Horizon h', 'Biais (moyenne des erreurs)', 'Variance empirique', 'Variance théorique σ²Σψ²', 'Écart relatif'],
          err.map((e, h) => [h + 1, f2(TS.mean(e), 3), f2(TS.variance(e, 1), 3), f2(th[h], 3), `${f2(100 * (TS.variance(e, 1) / th[h] - 1), 1)} %`]), { numCols: [1, 2, 3, 4] }) + '<div id="mc-c"></div>';
        plot(el.querySelector('#mc-c'), { title: `Variance de l’erreur selon l’horizon (${Rn} simulations, n = ${n})`, height: 220, yMin: 0, xLabel: (h) => 'h = ' + Math.round(h),
          layers: [{ type: 'line', x: th.map((_, h) => h + 1), y: th, name: 'théorique', color: '--s2' }, { type: 'points', x: th.map((_, h) => h + 1), y: err.map((e) => TS.variance(e, 1)), name: 'empirique', color: '--s1', r: 5 }] });
        if (btn) btn.disabled = false;
      };
      el.querySelector('#mc-go').addEventListener('click', run);
      run();
    },
  });
})(window);
