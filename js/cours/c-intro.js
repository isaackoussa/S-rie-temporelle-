/*
 * Cours M2 GRAF : guide de lecture, §1 Introduction et premières définitions, §2 TP 1.
 */
(function (root) {
  'use strict';
  const { ctl, bind, val, num, int, block, formula, rCode, quiz, table, stats, pill, f2, fp, esc, MOIS } = root.UI;
  const { plot } = root.Charts;
  const { SERIES, axis, line, acfChart, exo, tpq, head, missing, tpSeries, fileLinks } = root.Cours;
  const CH = (root.CHAPTERS = root.CHAPTERS || []);
  const R = String.raw;

  // ================================================================ Guide
  CH.push({
    id: 'guide', icon: 'guide', short: 'Guide du cours',
    render(el) {
      el.innerHTML = head('Cours M2 GRAF · IUA', 'Introduction aux séries temporelles, en version interactive',
        'Cette page suit pas à pas le support de cours du Master 2 GRAF : mêmes chapitres, mêmes notations, mêmes exemples, mêmes TP. Chaque notion est complétée par une manipulation en direct, les corrections des exercices et des TP, et le code R qui s’exécute tel quel.') + `
      ${block('Correspondance avec le support', table(['Support (PDF)', 'Dans cette page', 'Ce qui est ajouté'], [
        ['§1 Introduction et premières définitions', '<a href="#c1">Chapitre 1</a>', 'nuages (x<sub>t</sub>, x<sub>t+k</sub>) interactifs, propositions 1 et 2 vérifiées numériquement, exercices 1 à 3 corrigés'],
        ['§2 TP 1 : Introduction', '<a href="#tp1">TP 1 corrigé</a>', 'simulations en direct, analyse complète du vrai fichier de varicelle'],
        ['§3 Lissages exponentiels', '<a href="#c3">Chapitre 3</a>', 'LES, LED, Holt-Winters pas à pas, choix de α par erreur test, exercices 4 à 6'],
        ['§4 TP 2 : Lissage exponentiel', '<a href="#tp2">TP 2 corrigé</a>', 'séries X1, X2, X3, co2 et CAC40 traités, tableaux d’erreurs'],
        ['§5 Tendance et saisonnalité', '<a href="#c5">Chapitre 5</a>', 'moindres carrés, moyenne mobile, différences, Box-Pierce et Ljung-Box, exercices 7 à 10'],
        ['§6 TP 3 : Tendance et saisonnalité', '<a href="#tp3">TP 3 corrigé</a>', 'AirPassengers complet, série mystère à deviner'],
        ['§7 Séries stationnaires (AR, MA, ARMA)', '<a href="#c7">Chapitre 7</a>', 'figures 18 à 25 en direct, Yule-Walker, AIC/BIC, prévision, exercices 11 à 18'],
        ['§8 ARIMA et SARIMA', '<a href="#c8">Chapitre 8</a>', 'reconstruction des prévisions, intervalles construits à la main, exercice 19'],
        ['§9 TP 4 : ARMA et ARIMA', '<a href="#tp4">TP 4 corrigé</a>', 'serie1 / serie2, Monte-Carlo de l’AR<sub>3</sub>, précipitations et taux d’intérêt traités'],
        ['§10 ARCH et GARCH', '<a href="#c10">Chapitre 10</a>', 'simulateur, estimation par maximum de vraisemblance, volatilité du CAC40, exercice 20'],
        ['§11 TP 5 : ARCH et GARCH', '<a href="#tp5">TP 5 corrigé</a>', 'ARCH<sub>2</sub> simulé, GARCH sur les 4 indices européens et sur le NYSE'],
      ]))}
      ${block('Notations', R`<div class="prose"><p>Les notations du support sont conservées. Pour faire le lien avec l’<a href="./">Atelier</a> et avec la littérature anglo-saxonne :</p></div>` + table(['Objet', 'Ce cours', 'Atelier / R'], [
        ['Coefficients AR', '\\(a_1,\\dots,a_p\\), \\(A(z) = 1 - a_1z - \\dots - a_pz^p\\)', '\\(\\phi_1,\\dots,\\phi_p\\), <code>ar = c(...)</code>'],
        ['Coefficients MA', '\\(b_1,\\dots,b_q\\), \\(B(z) = 1 + b_1z + \\dots + b_qz^q\\)', '\\(\\theta_1,\\dots,\\theta_q\\), <code>ma = c(...)</code>'],
        ['Auto-covariance', '\\(\\sigma(h)\\), empirique \\(\\hat\\sigma_n(h)\\)', '\\(\\gamma(h)\\), <code>acf(type = "covariance")</code>'],
        ['Auto-corrélation partielle', '\\(r(h)\\)', '\\(\\alpha(h)\\), <code>pacf()</code>'],
        ['Prévision à l’horizon h', '\\(\\hat x_{n,h}\\)', '\\(\\hat x_{n+h|n}\\), <code>predict()</code>, <code>forecast()</code>'],
        ['Période', '\\(T\\), opérateur \\(\\Delta_T X_t = X_t - X_{t-T}\\)', '\\(s\\) ou <code>frequency</code>, <code>diff(x, lag = T)</code>'],
      ]))}
      ${block('Points d’attention en lisant le support', R`<div class="prose"><ul>
        <li><strong>Auto-covariance empirique (§1.2.3).</strong> Le support divise par \(n-h\) ; la fonction <code>acf</code> de R divise par \(n\). Les deux sont asymptotiquement équivalentes ; la version en \(1/n\) garantit une matrice d’auto-covariance définie positive. Le chapitre 1 compare les deux.</li>
        <li><strong>Lissage exponentiel double (§3.2).</strong> Dans les formules récursives, la mise à jour de la pente s’écrit \(\hat a_2(n) = \hat a_2(n-1) + \alpha^2(x_n - \hat x_{n-1,1})\) : le coefficient est \(\alpha^2\), et non \(\alpha(2-\alpha)\) comme imprimé. Le chapitre 3 le démontre (exercice 6) et le vérifie numériquement.</li>
        <li><strong>Auto-corrélation partielle (§7.1).</strong> L’algorithme cité est celui de <em>Durbin-Levinson</em> (Durbin-Watson est un test d’autocorrélation des résidus). Il est détaillé au chapitre 7.</li>
        <li><strong>Critère BIC (§7.6.2).</strong> La pénalité est \(\nu\log n\) : \(\text{BIC} = -2\log L(\hat\theta) + \nu\log n\).</li>
        <li><strong>SARIMA (§8.2).</strong> Le support utilise une version simplifiée \(\text{SARIMA}_{p,d,q,T}\) : \(\Delta_T\circ\Delta^d X_t\) est un ARMA<sub>p,q</sub>. Le modèle complet ajoute une partie ARMA saisonnière d’ordres (P, D, Q) ; le chapitre 8 présente les deux.</li>
      </ul></div>`)}
      ${block('Données des TP', `<div class="prose"><p>Toutes les données sont dans le dossier <code>donnees/</code> du dépôt, en <code>.dat</code> (une valeur par ligne, à lire avec <code>scan()</code> comme dans le cours) et en <code>.csv</code> (importable dans le <a href="./#labo">laboratoire de l’Atelier</a>). Le script <code>donnees/generer_donnees.R</code> les reconstruit depuis leurs sources.</p></div>` +
        table(['Fichier', 'TP', 'Contenu', 'Source'], [
          ['<a href="donnees/varicelle.dat">varicelle</a>', 'TP 1', 'cas mensuels de varicelle à New York, 1931–1972', 'Hipel &amp; McLeod (1994)'],
          ['<a href="donnees/simulation.dat">simulation</a>', 'TP 3', 'série à deviner, 180 valeurs', 'simulée (solution dans <code>SOLUTIONS_SIMULATIONS.md</code>)'],
          ['<a href="donnees/serie1.dat">serie1</a>, <a href="donnees/serie2.dat">serie2</a>', 'TP 4', 'séries à identifier, 300 valeurs', 'simulées (idem)'],
          ['<a href="donnees/precipitations.dat">precipitations</a>', 'TP 4', 'précipitations mensuelles 1932–1966, <em>substitut de sanfran.dat</em>', 'Hipel &amp; McLeod (1994)'],
          ['<a href="donnees/taux_interet.dat">taux_interet</a>', 'TP 4', 'taux obligataires australiens à 2 ans 1969–1994, <em>substitut de UKinterestrates.dat</em>', 'Reserve Bank of Australia'],
          ['<a href="donnees/nyse.dat">nyse</a>', '§10, TP 5', 'rendements journaliers de la bourse de New York, 1984–1991', 'Shumway &amp; Stoffer, paquet <code>astsa</code>'],
          ['usaccdeaths, airpassengers, co2, sunspot_year, eustock_*', 'tous', 'copies des séries fournies avec R', 'R, paquet <code>datasets</code>'],
        ]) + `<p class="small muted">Les substituts sont de vraies séries de même nature et de même période (précipitations) ou de même type (taux d’intérêt) ; si vous avez les fichiers originaux, le code des corrigés s’applique tel quel.</p>`)}

      ${block('Avant de commencer sous R', rCode(`# Placez-vous à la racine du dépôt cloné : les corrigés lisent les fichiers de donnees/
# setwd("chemin/vers/S-rie-temporelle-")

# Packages utilisés dans les corrections
install.packages(c("tseries", "forecast"))   # garch(), adf.test() ; auto.arima(), checkresiduals()
library(tseries)

# Séries du cours fournies par R
data(USAccDeaths); data(AirPassengers); data(sunspot.year); data(co2); data(EuStockMarkets)
par(mfrow = c(2, 2))
plot.ts(USAccDeaths); plot.ts(AirPassengers); plot.ts(sunspot.year); plot.ts(EuStockMarkets[, "CAC"])`, 'R · support M2 GRAF'))}`;
    },
  });

  // ================================================================ §1 Introduction
  CH.push({
    id: 'c1', icon: 'intro', short: '1 · Introduction et définitions',
    render(el) {
      el.innerHTML = head('Cours §1 · Introduction et premières définitions', 'Séries temporelles : premières définitions',
        'Une série temporelle à temps discret est une suite réelle finie \\((x_t)_{1\\le t\\le n}\\), où \\(t\\) représente le temps. On cherche à en prévoir les réalisations futures, avec un intervalle qui mesure la précision de la prévision.') + `

      ${block('Les exemples du cours (figures 1 à 5)', `<div class="grid-2"><div id="i-f1"></div><div id="i-f2"></div><div id="i-f3"></div><div id="i-f4"></div></div>
        <p class="small muted">La population française 1985–2005 (figure 4) n’est pas fournie par R ; c’est une tendance linéaire croissante sans saisonnalité.</p>`)}

      ${block('Le programme du cours', R`<div class="prose"><p>Trois familles de modèles, de la plus simple à la plus riche :</p><ul>
        <li><strong>Régression sur le temps</strong>, par exemple \(x_t = \alpha_1t^2 + \alpha_2t + \alpha_3 + \epsilon_t\), d’où la prévision \(\hat x_{t+1} = \hat\alpha_1(t+1)^2 + \hat\alpha_2(t+1) + \hat\alpha_3\) ;</li>
        <li><strong>lissages exponentiels</strong> (§3), très simples à mettre en œuvre ;</li>
        <li><strong>modèles ARMA</strong> (§7 à §10) : on retire tendance et saisonnalité, puis on modélise le résidu.</li></ul>
        <p>Les défis : définir un modèle à nombre fini de paramètres, l’estimer, vérifier la qualité d’ajustement en partageant l’échantillon (80 % apprentissage, 20 % test) et prévoir.</p></div>`)}

      ${block('§1.1 Tendances et composantes saisonnières', `<div class="grid-2">
        ${formula('Tendance', R`\[x_t = \sum_{j=1}^m \alpha_j f_j(t) + \epsilon_t\]<p class="small">Linéaire : \(x_t = \alpha t + \beta + \epsilon_t\). Polynomiale : \(x_t = \alpha_1t^p + \dots + \alpha_{p+1} + \epsilon_t\).</p>`)}
        ${formula('Composante périodique', R`\[x_t = s_t + \epsilon_t,\qquad s_{t+T} = s_t\]<p class="small">Pour une période de 6 mois ou 1 an, on parle de composante saisonnière.</p>`)}</div>`)}

      ${block('Exercices 1 et 2 du cours', exo(1, 'Repérer les tendances (croissance, décroissance, linéaire, quadratique…) et saisonnalités (périodicités) de chacune de ces séries.', R`
        <p>L’auto-corrélation (propositions 1 et 2 plus bas) objective ce que l’œil voit. Valeurs calculées sur les données :</p><div id="i-ex1"></div>
        <ul><li><strong>USAccDeaths</strong> : pas de tendance nette (légère baisse jusqu’en 1976 puis remontée), saisonnalité annuelle marquée, pic en juillet. L’ACF oscille avec une période de 12.</li>
        <li><strong>AirPassengers</strong> : tendance croissante, à peu près linéaire, saisonnalité de période 12 dont l’amplitude grandit avec le niveau. L’ACF décroît lentement (tendance) avec des bosses aux retards 12, 24 (saison).</li>
        <li><strong>sunspot.year</strong> : pas de tendance, un cycle d’environ 11 ans. Ce n’est pas une saisonnalité au sens strict : la durée du cycle varie (entre 9 et 14 ans). L’ACF oscille avec un premier creux vers 5–6 ans et un pic vers 11 ans.</li>
        <li><strong>Population française</strong> : tendance linéaire croissante, pas de saisonnalité.</li>
        <li><strong>CAC40</strong> : tendance non linéaire et irrégulière (stagnation 1991–1995, forte hausse 1996–1998), pas de saisonnalité. L’ACF reste proche de 1 sur des dizaines de retards : comportement de marche aléatoire, très difficile à prévoir.</li></ul>`) +
        exo(2, 'Comment semble être la tendance dans l’exemple 5 ?', R`<p>Elle n’est ni linéaire ni polynomiale de faible degré : plateau puis accélération, avec de longues phases de hausse et de baisse. Une régression \(\alpha t+\beta\) laisse des résidus fortement autocorrélés. On verra (§5, §8) qu’une tendance de ce type se traite mieux par différenciation : les rendements \(\log x_t - \log x_{t-1}\) n’ont plus de tendance.</p>`))}

      ${block('§1.2 Indices descriptifs', `<div class="grid-3">
        ${formula('Tendance centrale', R`\[\bar x_n = \frac1n\sum_{t=1}^n x_t\]`)}
        ${formula('Dispersion', R`\[\hat\sigma_n(0) = \frac1n\sum_{t=1}^n(x_t-\bar x_n)^2\]`)}
        ${formula('Dépendance', R`\[\hat\sigma_n(h) = \frac{1}{n-h}\sum_{t=1}^{n-h}(x_t-\bar x_n)(x_{t+h}-\bar x_n),\quad \hat\rho_n(h) = \frac{\hat\sigma_n(h)}{\hat\sigma_n(0)}\]`)}</div>
        <div class="panel" id="i-desc">
          <div class="controls">${ctl.select('i-ser', 'Série', Object.values(SERIES).map((s) => [s.id, s.short]), 'usacc')}${ctl.slider('i-k', 'Nombre de nuages', 4, 12, 4, 8)}</div>
          <div id="i-stats"></div>
          <p class="small">Visualisation de l’auto-corrélation (figure 6 du cours) : plus le nuage \\((x_t, x_{t+k})\\) est allongé, plus \\(\\hat\\rho_n(k)\\) est proche de 1 ; arrondi, proche de 0.</p>
          <div class="lagplots" id="i-lags"></div>
          <div id="i-tab"></div>
        </div>`)}

      ${block('Première analyse par les auto-corrélations', `<div class="grid-2">
        ${formula('Proposition 1 · tendance linéaire pure', R`\[x_t = at + b \;\Longrightarrow\; \hat\rho_n(h) \xrightarrow[n\to\infty]{} 1\]`)}
        ${formula('Proposition 2 · série périodique pure', R`\[x_t = a\cos\frac{2t\pi}{T} \;\Longrightarrow\; \hat\rho_n(h) \xrightarrow[n\to\infty]{} \cos\frac{2h\pi}{T}\]`)}</div>
        <div class="panel" id="i-prop"><div class="controls">${ctl.select('i-pk', 'Série pure', [['lin', 'tendance linéaire x_t = 2t + 5'], ['cos', 'périodique x_t = 3 cos(2tπ/T)']], 'cos')}${ctl.slider('i-pn', 'n', 20, 2000, 10, 120)}${ctl.slider('i-pT', 'Période T', 3, 24, 1, 12)}</div>
          <div id="i-pc"></div><p class="small" id="i-pt"></p></div>` +
        exo(3, 'Faire la preuve (des propositions 1 et 2).', R`
        <p><strong>Proposition 1.</strong> Avec \(x_t = at+b\), on a \(\bar x_n = a\frac{n+1}{2}+b\), donc \(x_t - \bar x_n = a(t-c)\) avec \(c = \frac{n+1}{2}\). Alors
        \[\hat\rho_n(h) = \frac{\frac{1}{n-h}\sum_{t=1}^{n-h}(t-c)(t+h-c)}{\frac1n\sum_{t=1}^{n}(t-c)^2}.\]
        Le dénominateur vaut \(\frac{n^2-1}{12}\). Au numérateur, \((t-c)(t+h-c) = (t-c)^2 + h(t-c)\) : pour \(h\) fixé, retirer \(h\) termes et ajouter \(h(t-c)\) ne modifie la moyenne que d’un \(O(hn)\), négligeable devant \(n^2\). Le rapport tend donc vers 1.</p>
        <p><strong>Proposition 2.</strong> Avec \(\omega = 2\pi/T\) et \(x_t = a\cos(\omega t)\) : \(\bar x_n = O(1/n) \to 0\) et
        \[\cos(\omega t)\cos(\omega(t+h)) = \tfrac12\cos(\omega h) + \tfrac12\cos(\omega(2t+h)).\]
        La moyenne du second terme sur \(t\) tend vers 0 (somme d’un cosinus non constant, bornée). Donc \(\hat\sigma_n(h) \to \frac{a^2}{2}\cos(\omega h)\), \(\hat\sigma_n(0) \to \frac{a^2}{2}\) et \(\hat\rho_n(h) \to \cos\frac{2h\pi}{T}\). Le panneau ci-dessus vérifie les deux limites numériquement.</p>`))}

      ${block('§1.3 Mise en œuvre sous R', rCode(`# Lire un fichier en sautant les k premières lignes, puis créer un objet série temporelle
# data <- scan(file = "donnee.dat", skip = k)
# serie <- ts(data, start = c(1990, 1), end = c(1999, 6), frequency = 12)

x <- USAccDeaths
plot.ts(x)
mean(x); var(x) * (length(x) - 1) / length(x)        # moyenne et variance empirique (en 1/n)
acf(x, lag.max = 24, type = "covariance", plot = FALSE)  # auto-covariances (R divise par n)
acf(x, lag.max = 24)                                    # auto-corrélations avec bandes ±1,96/√n

# Nuages (x_t, x_{t+k}) de la figure 6
par(mfrow = c(3, 3))
for (k in 1:8) plot(x[1:(length(x) - k)], x[(k + 1):length(x)], xlab = "x_t", ylab = paste0("x_{t+", k, "}"))
acf(x)
# lag.plot(x, lags = 8, do.lines = FALSE) fait la même chose en une commande

# Auto-covariance « du cours » (division par n - h) pour comparer
sig_cours <- function(x, h) { n <- length(x); m <- mean(x); sum((x[1:(n-h)] - m) * (x[(1+h):n] - m)) / (n - h) }
sapply(1:5, function(h) sig_cours(x, h))

# Exporter un graphique : jpeg("fig%d.jpeg"); plot(...); dev.off()`, 'R · §1.3'))}

      ${block('Vérifier', quiz([
        { q: 'L’auto-corrélation empirique d’une série reste proche de 1 sur les 30 premiers retards. Qu’en déduire ?', opts: ['La série est périodique de période 30', 'La série présente une tendance (proposition 1)', 'La série est un bruit blanc'], a: 1, expl: 'Une ACF qui décroît très lentement depuis 1 est la signature d’une tendance (ou d’une racine unitaire).' },
        { q: 'Pour x_t = cos(2tπ/12), que vaut approximativement ρ̂(6) ?', opts: ['1', '0', '−1'], a: 2, expl: 'cos(2·6·π/12) = cos(π) = −1 : à une demi-période d’écart, la série est en opposition de phase.' },
      ]))}`;

      // Figures 1 à 5
      ['usacc', 'air', 'sunspot', 'cac'].forEach((k, i) => {
        const s = SERIES[k], ax = axis(s);
        plot(el.querySelector('#i-f' + (i + 1)), { title: s.name, height: 190, xLabel: ax.label, xTicks: ax.ticks, layers: [line(s.values, s.short, '--s1', 0, 1.3)] });
      });
      el.querySelector('#i-ex1').innerHTML = table(['Série', 'ρ̂(1)', 'ρ̂(6)', 'ρ̂(12)', 'ρ̂(24)'], ['usacc', 'air', 'sunspot', 'cac'].map((k) => {
        const r = TS.acf(SERIES[k].values, 24);
        return [SERIES[k].short, f2(r[1], 2), f2(r[6], 2), f2(r[12], 2), f2(r[24], 2)];
      }), { numCols: [1, 2, 3, 4] });

      const drawDesc = () => {
        const s = SERIES[val('i-ser')], x = s.values, n = x.length, K = int('i-k');
        const m = TS.mean(x);
        el.querySelector('#i-stats').innerHTML = stats([['n', n], ['moyenne x̄ₙ', f2(m, 2)], ['variance σ̂ₙ(0)', f2(TS.variance(x), 2)], ['écart-type', f2(TS.std(x), 2)]]);
        const box = el.querySelector('#i-lags');
        box.innerHTML = Array.from({ length: K }, (_, k) => `<div id="i-lag${k + 1}"></div>`).join('');
        const r = TS.acf(x, K);
        for (let k = 1; k <= K; k++) {
          const xs = x.slice(0, n - k), ys = x.slice(k);
          plot(box.querySelector('#i-lag' + k), { title: `k = ${k} · ρ̂ = ${f2(r[k], 2)}`, height: 150, hover: false, legend: false, xLabel: (v) => root.Charts.fmtNum(v),
            layers: [{ type: 'points', x: xs, y: ys, color: '--s1', r: n > 500 ? 1.2 : 2.2 }] });
        }
        el.querySelector('#i-tab').innerHTML = `<p class="small">Comparaison des estimateurs d’auto-covariance : celui du cours (division par \\(n-h\\)) et celui de R (division par \\(n\\)).</p>` +
          table(['h', 'σ̂ₙ(h) cours, 1/(n−h)', 'R acf, 1/n', 'ρ̂ₙ(h) cours', 'ρ̂(h) R'], [1, 2, 3, 6, 12].filter((h) => h < n / 2).map((h) => {
            const c = TS.autocovCourse(x, h), rr = TS.autocov(x, h), v0 = TS.autocov(x, 0);
            return [h, f2(c, 2), f2(rr, 2), f2(c / v0, 3), f2(rr / v0, 3)];
          }), { numCols: [1, 2, 3, 4] });
        root.UI.typeset(el.querySelector('#i-tab'));
      };
      bind(el.querySelector('#i-desc'), drawDesc, { debounce: 40 });
      drawDesc();

      const drawProp = () => {
        const kind = val('i-pk'), n = int('i-pn'), T = int('i-pT');
        el.querySelector('#i-pT').closest('.ctl').style.display = kind === 'cos' ? '' : 'none';
        const x = Array.from({ length: n }, (_, i) => (kind === 'lin' ? 2 * (i + 1) + 5 : 3 * Math.cos((2 * (i + 1) * Math.PI) / T)));
        const L = Math.min(30, n - 2), hs = Array.from({ length: L }, (_, i) => i + 1);
        const rc = hs.map((h) => TS.autocovCourse(x, h) / TS.autocov(x, 0));
        const lim = hs.map((h) => (kind === 'lin' ? 1 : Math.cos((2 * h * Math.PI) / T)));
        plot(el.querySelector('#i-pc'), { title: `ρ̂ₙ(h) pour n = ${n} et limite théorique`, height: 220, yMin: -1.1, yMax: 1.1, xLabel: (v) => String(Math.round(v)),
          layers: [{ type: 'hline', value: 0, dash: false }, { type: 'stem', x: hs, y: rc, name: 'ρ̂ₙ(h)', color: '--s1' }, { type: 'points', x: hs, y: lim, name: 'limite', color: '--s2', r: 3.5 }] });
        const err = Math.max(...rc.map((v, i) => Math.abs(v - lim[i])).slice(0, 5));
        el.querySelector('#i-pt').textContent = `Écart maximal sur h = 1..5 : ${f2(err, 4)}. Augmentez n : l’écart tend vers 0.`;
      };
      bind(el.querySelector('#i-prop'), drawProp, { debounce: 30 });
      drawProp();
    },
  });

  // ================================================================ §2 TP 1
  CH.push({
    id: 'tp1', icon: 'tp', short: 'TP 1 · Introduction (corrigé)',
    render(el) {
      const V = SERIES.varicelle, vs = (() => {
        const x = V.values, monthly = Array.from({ length: 12 }, (_, m) => TS.mean(x.filter((_, i) => i % 12 === m)));
        const peak = monthly.indexOf(Math.max(...monthly)), low = monthly.indexOf(Math.min(...monthly));
        const yearly = []; for (let k = 0; k < 41; k++) yearly.push(TS.sum(x.slice(12 * k, 12 * k + 12)));
        const amp = (y) => { const a = [], m = []; for (let k = 0; k < 41; k++) { const c = y.slice(12 * k, 12 * k + 12); a.push(Math.max(...c) - Math.min(...c)); m.push(TS.mean(c)); } return [a, m]; };
        const cor = (a, b) => { const ma = TS.mean(a), mb = TS.mean(b); let s = 0, sa = 0, sb = 0; a.forEach((v, i) => { s += (v - ma) * (b[i] - mb); sa += (v - ma) ** 2; sb += (b[i] - mb) ** 2; }); return s / Math.sqrt(sa * sb); };
        const [ar, mr] = amp(x), [al, ml] = amp(x.map(Math.log));
        return { monthly, peak, low, peakVal: monthly[peak], lowVal: monthly[low], yearly, r: TS.acf(x, 24), corrRaw: cor(ar, mr), corrLog: cor(al, ml),
          yMeanFirst: TS.mean(yearly.slice(0, 10)), yMeanLast: TS.mean(yearly.slice(31, 41)) };
      })();
      el.innerHTML = head('Cours §2 · TP 1 corrigé', 'TP 1 : premiers pas avec une série temporelle',
        'Durée prévue : 2 h. Les réponses sont rédigées comme un compte-rendu : code R, résultat, interprétation.') + `
      ${block('2.1 Données de varicelle', `<p class="small">Fichier : ${fileLinks(V)} (Hipel &amp; McLeod, 1994, via la Time Series Data Library). Les valeurs ci-dessous sont calculées sur ce fichier.</p>
        <div class="panel"><div id="v-stats"></div><div id="v-c1"></div><div class="grid-2"><div id="v-c4"></div><div id="v-c2"></div></div><div class="grid-2"><div id="v-c5"></div><div id="v-c3"></div></div></div>
        <div class="tpq-list">
          ${tpq('1', 'Créer un objet série temporelle et le représenter.', `<code>${esc(V.rRead)}</code> puis <code>plot.ts(varicelle)</code> : ${V.values.length} mois, de janvier 1931 à juin 1972.`)}
          ${tpq('2', 'Analyser qualitativement la série (changer d’échelle si besoin).', `Saisonnalité annuelle très marquée : en moyenne <strong>${f2(vs.peakVal, 0)} cas en ${MOIS[vs.peak]}</strong> contre <strong>${f2(vs.lowVal, 0)} en ${MOIS[vs.low]}</strong>, soit un rapport de ${f2(vs.peakVal / vs.lowVal, 0)} entre le pic du printemps et le creux de la fin de l’été. L’amplitude des pics varie beaucoup d’une année à l’autre et grandit avec le niveau (corrélation amplitude annuelle / niveau annuel : ${f2(vs.corrRaw, 2)}). Sur l’échelle log, la saison devient beaucoup plus régulière (corrélation ${f2(vs.corrLog, 2)}) : saisonnalité <em>multiplicative</em>.`)}
          ${tpq('3', 'Nombre moyen mensuel de cas ?', `<code>mean(varicelle)</code> = <strong>${f2(TS.mean(V.values), 1)}</strong> cas par mois sur l’ensemble de la période (médiane ${f2(TS.quantile(V.values, 0.5), 0)} : la distribution est très asymétrique à cause des pics épidémiques).`)}
          ${tpq('4', 'Tracer les 25 premières auto-corrélations. Que représentent les pointillés ?', `L’ACF oscille avec une période de 12 : ρ̂(6) = ${f2(vs.r[6], 2)} (opposition de phase), ρ̂(12) = ${f2(vs.r[12], 2)}, ρ̂(24) = ${f2(vs.r[24], 2)}, signature d’une forte saisonnalité annuelle (proposition 2). Les pointillés sont les bornes \\(\\pm1{,}96/\\sqrt n = \\pm${f2(1.96 / Math.sqrt(V.values.length), 3)}\\) : sous l’hypothèse de bruit blanc, 95 % des auto-corrélations empiriques y tombent (§5.6.1).`)}
          ${tpq('5', 'Évolution annuelle du nombre de cas.', `<code>aggregate(varicelle, FUN = sum)</code> donne les cas par année civile, ce qui élimine la saison. Moyenne annuelle ${f2(vs.yMeanFirst, 0)} cas sur 1931–1940 contre ${f2(vs.yMeanLast, 0)} sur 1962–1971 : ${vs.yMeanLast < vs.yMeanFirst ? 'tendance à la baisse sur la fin de la période' : 'pas de baisse sur la fin de la période'}, avec de fortes fluctuations d’une année à l’autre (années épidémiques). L’année 1972 n’a que 6 mois : elle est exclue du graphique.`)}
        </div>`)}

      ${block('2.2 Simulations de séries temporelles', `<div class="tpq-list">
        ${tpq('1', 'Quelle est la fonction d’auto-corrélation d’un bruit blanc ?', R`\(\rho(0) = 1\) et \(\rho(h) = 0\) pour tout \(h \ne 0\) : les variables sont indépendantes, donc non corrélées.`)}
        </div>
        <div class="panel" id="s-panel">
          <div class="controls">${ctl.select('s-kind', 'Série', [['bb', 'bruit blanc ε_t'], ['X2', 'X(t) = 0,5t + 2ε_t'], ['X3', 'X(t) = 0,5t + ε_t + 3cos(tπ/6)']], 'bb')}${ctl.slider('s-n', 'Taille n', 20, 1000, 10, 100)}<button type="button" id="s-new" class="ghost">Nouvelle simulation</button></div>
          <div class="grid-2"><div id="s-c1"></div><div id="s-c2"></div></div>
          <div id="s-txt" class="callout"></div>
        </div>
        <div class="tpq-list">
        ${tpq('2–4', 'Simuler un bruit blanc gaussien de taille 100, tracer son ACF, recommencer, jouer sur n.', 'D’une simulation à l’autre, quelques auto-corrélations sortent des bornes (environ 1 sur 20, par définition du niveau 95 %), jamais aux mêmes retards. Quand n augmente, les bornes \\(\\pm1{,}96/\\sqrt n\\) se resserrent et les \\(\\hat\\rho(h)\\) se concentrent autour de 0.')}
        ${tpq('5–6', 'Simuler X(t) = 0,5t + 2ε<sub>t</sub> et l’interpréter.', 'Tendance linéaire croissante de pente 0,5 bruitée. L’ACF décroît lentement depuis 1 (proposition 1) : la série n’est pas stationnaire, sa moyenne dépend de t.')}
        ${tpq('7', 'Même chose pour X(t) = 0,5t + ε<sub>t</sub> + 3cos(tπ/6).', 'Tendance linéaire plus une composante périodique de période \\(T = 12\\) (car \\(\\cos(t\\pi/6) = \\cos(2t\\pi/12)\\)). L’ACF combine décroissance lente (tendance) et oscillation de période 12 (proposition 2).')}
        </div>`)}

      ${block('Corrigé complet sous R', rCode(`## 2.2 Simulations
set.seed(1)
bb <- rnorm(100)                                # bruit blanc gaussien
par(mfrow = c(1, 2)); plot.ts(bb); acf(bb, lag.max = 25)
for (n in c(50, 100, 1000)) acf(rnorm(n), main = paste("n =", n))   # variabilité et longueur

t <- 1:100
X2 <- 0.5 * t + 2 * rnorm(100)
X3 <- 0.5 * t + rnorm(100) + 3 * cos(t * pi / 6)
par(mfrow = c(2, 2)); plot.ts(X2); acf(X2); plot.ts(X3); acf(X3)

## 2.1 Varicelle (depuis la racine du dépôt)
varicelle <- ts(scan("donnees/varicelle.dat"), start = c(1931, 1), frequency = 12)
par(mfrow = c(2, 1)); plot.ts(varicelle); plot.ts(log(varicelle))   # Q1, Q2
mean(varicelle)                                                      # Q3
tapply(varicelle, cycle(varicelle), mean)                            # profil mensuel moyen
acf(varicelle, lag.max = 25)                                         # Q4
annuel <- aggregate(window(varicelle, end = c(1971, 12)), FUN = sum) # Q5 (1972 incomplète)
plot(annuel, main = "Cas annuels")`, 'R · TP 1'))}`;

      // 2.1 Varicelle : vraies données
      const vx = V.values, vax = axis(V), lg = vx.map((v) => Math.log(v));
      plot(el.querySelector('#v-c1'), { title: 'Q1 · Cas mensuels de varicelle à New York', height: 230, xLabel: vax.label, xTicks: vax.ticks, layers: [line(vx, 'cas', '--s1', 0, 1.2)] });
      plot(el.querySelector('#v-c4'), { title: 'Q2 · Échelle logarithmique', height: 200, xLabel: vax.label, xTicks: vax.ticks, layers: [line(lg, 'log(cas)', '--s3', 0, 1.1)] });
      acfChart(el.querySelector('#v-c2'), vx, 25, 'Q4 · 25 premières auto-corrélations');
      plot(el.querySelector('#v-c5'), { title: 'Q2 · Profil mensuel moyen', height: 200, xLabel: (j) => MOIS[Math.round(j)], xTicks: Array.from({ length: 12 }, (_, j) => j),
        layers: [{ type: 'bar', x: vs.monthly.map((_, j) => j), y: vs.monthly, name: 'cas moyens', color: '--s1' }] });
      plot(el.querySelector('#v-c3'), { title: 'Q5 · Cas par année (1931–1971)', height: 200, xLabel: (i) => String(1931 + Math.round(i)),
        layers: [{ type: 'bar', x: vs.yearly.map((_, i) => i), y: vs.yearly, name: 'cas', color: '--s3' }] });
      el.querySelector('#v-stats').innerHTML = stats([['n (mois)', vx.length], ['moyenne mensuelle', f2(TS.mean(vx), 1)], ['écart-type', f2(TS.std(vx), 1)], ['minimum', f2(Math.min(...vx), 0)], ['maximum', f2(Math.max(...vx), 0)], ['mois de pic moyen', MOIS[vs.peak]]]);

      // Simulations 2.2
      let seed = 1;
      const drawSim = () => {
        const kind = val('s-kind'), n = int('s-n');
        const x = kind === 'bb' ? tpSeries('X1', n, seed) : tpSeries(kind, n, seed);
        plot(el.querySelector('#s-c1'), { title: 'Série simulée', height: 210, xLabel: (i) => String(Math.round(i) + 1), layers: [line(x, 'X(t)'), { type: 'hline', value: 0 }] });
        const a = acfChart(el.querySelector('#s-c2'), x, 25, 'ACF (25 retards)');
        el.querySelector('#s-txt').innerHTML = kind === 'bb'
          ? `<p>${a.out} auto-corrélation(s) sur 25 hors des bornes ±${f2(a.band, 3)} ; on en attend environ ${f2(25 * 0.05, 1)} par hasard.</p>`
          : `<p>ρ̂(1) = ${f2(a.r[0], 2)}, ρ̂(12) = ${f2(a.r[11], 2)} : décroissance lente due à la tendance${kind === 'X3' ? ', oscillation de période 12 due au cosinus' : ''}.</p>`;
      };
      el.querySelector('#s-new').addEventListener('click', () => { seed++; drawSim(); });
      bind(el.querySelector('#s-panel'), drawSim, { debounce: 30 });
      drawSim();
    },
  });
})(window);
