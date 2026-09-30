/*
 * Chapitres 0 à 3 : introduction, anatomie/décomposition, stationnarité, autocorrélation & spectre.
 */
(function (root) {
  'use strict';
  const { ctl, bind, val, num, int, block, formula, pyCode, quiz, table, stats, pill, f2, fp, $, timeAxis, transformSeries,
    lambdaOptions, parseLambda, getDataset, STATE, typeset } = root.UI;
  const { plot } = root.Charts;
  const CH = (root.CHAPTERS = root.CHAPTERS || []);
  const R = String.raw;

  const seriesLine = (ds, y, name, color = '--s1', offset = 0) => ({ type: 'line', x: y.map((_, i) => i + offset), y, name, color });

  // ================================================================ 0. Introduction
  CH.push({
    id: 'intro', title: 'Qu’est-ce qu’une série temporelle ?', short: 'Introduction',
    desc: 'Définition, notations, ce qui change par rapport aux données i.i.d.',
    render(el) {
      const air = getDataset('air');
      el.innerHTML = R`
      <header class="ch-head">
        <div class="eyebrow">Chapitre 0 · Point de départ</div>
        <h1>Qu’est-ce qu’une série temporelle ?</h1>
        <p class="lede">Une série temporelle est une suite d’observations indexées par le temps. Ce qui la distingue d’un simple échantillon, c’est que <em>l’ordre porte l’information</em> : chaque valeur dépend de celles qui la précèdent.</p>
      </header>

      <div class="panel"><div id="intro-chart"></div>
        <p class="small muted">${air.note} Survolez la courbe pour lire les valeurs.</p></div>

      ${block('Définition', R`<div class="prose">
        <p>Formellement, une série temporelle est un <strong>processus stochastique</strong> \((X_t)_{t \in T}\), c’est-à-dire une famille de variables aléatoires indexée par le temps. On n’observe qu’<strong>une seule trajectoire</strong> \(x_1, x_2, \dots, x_n\) de ce processus.</p>
        <p>Tout le problème est là : en statistique classique, on dispose de \(n\) tirages indépendants de la même loi. Ici on a <em>un</em> tirage d’un objet de dimension \(n\). Pour apprendre quelque chose, il faut une hypothèse de régularité dans le temps : la <strong>stationnarité</strong> (chapitre 2), qui permet de remplacer les moyennes « sur les trajectoires » par des moyennes « le long du temps » (ergodicité).</p>
      </div>`)}

      ${block('Ce qui change par rapport aux données i.i.d.', R`<div class="grid-3">
        <div class="formula"><div class="ftitle">Dépendance</div><p class="small">Les observations sont corrélées. L’écart-type de la moyenne n’est plus \(\sigma/\sqrt{n}\) : avec une autocorrélation positive, on a moins d’information qu’il n’y paraît.</p>
          \[\operatorname{Var}(\bar X_n) = \frac{1}{n}\sum_{|h|<n}\Big(1-\frac{|h|}{n}\Big)\gamma(h)\]</div>
        <div class="formula"><div class="ftitle">Pas de mélange</div><p class="small">On ne peut pas mélanger les lignes. Une validation croisée classique (k-fold aléatoire) fait fuir le futur dans l’entraînement : on utilise un découpage chronologique (chapitre 7).</p></div>
        <div class="formula"><div class="ftitle">But : prévoir</div><p class="small">L’objectif est souvent la loi conditionnelle du futur sachant le passé, résumée par la prévision \(\hat X_{n+h|n} = \mathbb{E}[X_{n+h}\mid X_1,\dots,X_n]\) et un intervalle de prévision.</p></div>
      </div>`)}

      ${block('Notations utilisées dans l’atelier', R`<div class="grid-2">
        ${formula('Opérateur retard et différences', R`\[B X_t = X_{t-1}, \qquad B^k X_t = X_{t-k}\]
          \[\Delta = 1 - B, \qquad \Delta_s = 1 - B^s \quad(\text{différence saisonnière de période } s)\]`)}
        ${formula('Moments', R`\[\mu_t = \mathbb{E}[X_t], \qquad \gamma(t, t+h) = \operatorname{Cov}(X_t, X_{t+h})\]
          \[\rho(h) = \gamma(h)/\gamma(0) \quad \text{(cas stationnaire)}\]`)}
        ${formula('Bruit blanc', R`\[\varepsilon_t \sim \mathrm{BB}(0, \sigma^2) \iff \mathbb{E}[\varepsilon_t]=0,\ \operatorname{Var}(\varepsilon_t)=\sigma^2,\ \operatorname{Cov}(\varepsilon_t,\varepsilon_s)=0\ (t\neq s)\]
          <p class="small muted">Non corrélé ne veut pas dire indépendant. Le bruit blanc « fort » (i.i.d.) est un cas particulier.</p>`)}
        ${formula('Polynômes ARMA (convention R / statsmodels)', R`\[\phi(B) = 1 - \phi_1 B - \dots - \phi_p B^p\]
          \[\theta(B) = 1 + \theta_1 B + \dots + \theta_q B^q\]`)}
      </div>`)}

      ${block('Plan de l’atelier', `<nav class="map">${CH.filter((c) => c.id !== 'intro').map((c) =>
        `<a href="#${c.id}"><span class="t">Chapitre ${CH.indexOf(c)}</span><span class="n">${c.short}</span><span class="d">${c.desc}</span></a>`).join('')}</nav>`)}

      ${block('Reproduire en Python', `<div class="prose"><p>Chaque chapitre se termine par le code équivalent en Python. Environnement conseillé :</p></div>` + pyCode(
`# pip install numpy pandas matplotlib statsmodels
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import statsmodels.api as sm

# AirPassengers : fichier CSV classique (colonnes Month, #Passengers)
y = pd.read_csv("AirPassengers.csv", parse_dates=["Month"], index_col="Month")["#Passengers"]
y = y.asfreq("MS")          # fréquence explicite : début de mois
y.plot(title="Passagers aériens (milliers)")
plt.show()`))}
      `;
      const ax = timeAxis(air);
      plot(el.querySelector('#intro-chart'), {
        title: 'Passagers aériens internationaux, 1949–1960 (milliers)', height: 300, xLabel: ax.label, xTicks: ax.ticks,
        layers: [seriesLine(air, air.values, 'Passagers')],
      });
    },
  });

  // ================================================================ 1. Anatomie
  CH.push({
    id: 'anatomie', title: 'Anatomie d’une série', short: 'Anatomie & décomposition',
    desc: 'Tendance, saisonnalité, résidu. Modèles additif et multiplicatif, moyennes mobiles.',
    render(el) {
      el.innerHTML = R`
      <header class="ch-head">
        <div class="eyebrow">Chapitre 1 · Explication</div>
        <h1>Anatomie d’une série : tendance, saison, bruit</h1>
        <p class="lede">Avant tout modèle, on regarde la série et on la découpe en composantes interprétables. La décomposition classique n’est pas un modèle de prévision : c’est un instrument de diagnostic.</p>
      </header>

      ${block('Les deux formes de décomposition', R`<div class="grid-2">
        ${formula('Additive : l’amplitude saisonnière est constante', R`\[X_t = T_t + S_t + R_t\]`)}
        ${formula('Multiplicative : l’amplitude croît avec le niveau', R`\[X_t = T_t \times S_t \times R_t \;\Longleftrightarrow\; \log X_t = \log T_t + \log S_t + \log R_t\]`)}
      </div>
      <div class="prose"><p>\(T_t\) est la tendance-cycle (évolution lente), \(S_t\) la composante saisonnière de période \(s\) connue (12 pour du mensuel, 7 pour du journalier avec cycle hebdomadaire), \(R_t\) le reste. Le passage au logarithme transforme un modèle multiplicatif en modèle additif : c’est la raison pour laquelle on log-transforme si souvent les séries économiques.</p></div>`)}

      ${block('Algorithme de la décomposition classique', R`<div class="prose"><ol>
        <li><strong>Tendance</strong> par moyenne mobile centrée. Pour une période paire \(s = 2k\), on utilise la \(2\times s\)-MA, qui donne un poids \(\tfrac{1}{2s}\) aux deux extrémités :
        \[\hat T_t = \frac{1}{s}\Big(\tfrac12 X_{t-k} + X_{t-k+1} + \dots + X_{t+k-1} + \tfrac12 X_{t+k}\Big)\]
        Ce filtre annule exactement toute composante périodique de période \(s\) et de moyenne nulle.</li>
        <li><strong>Série corrigée de la tendance</strong> : \(X_t - \hat T_t\) (ou \(X_t / \hat T_t\)).</li>
        <li><strong>Coefficients saisonniers</strong> : moyenne de la série corrigée pour chaque position \(j = t \bmod s\), puis centrage (somme nulle en additif, moyenne 1 en multiplicatif).</li>
        <li><strong>Reste</strong> : \(\hat R_t = X_t - \hat T_t - \hat S_t\). Il est indéfini sur les \(k\) premières et dernières dates : c’est une limite connue de la méthode, avec l’hypothèse d’une saison figée. STL (Cleveland et al., 1990) lève ces deux limites par régressions locales (LOESS).</li>
      </ol></div>`)}

      ${block('Pratique : décomposer', R`<div class="panel" id="an-panel">
        <div class="controls">
          ${ctl.select('an-src', 'Série', [...STATE.datasets.filter((d) => d.period > 1).map((d) => [d.id, d.name]), ['gen', 'Générateur (paramétrable)']], 'air')}
          ${ctl.select('an-type', 'Décomposition', [['multiplicative', 'multiplicative'], ['additive', 'additive']], 'multiplicative')}
        </div>
        <div class="controls" id="an-gen" hidden>
          ${ctl.slider('an-slope', 'Pente de tendance', -1, 3, 0.1, 1)}
          ${ctl.slider('an-amp', 'Amplitude saisonnière', 0, 60, 1, 25)}
          ${ctl.slider('an-per', 'Période s', 4, 24, 1, 12)}
          ${ctl.slider('an-noise', 'Écart-type du bruit', 0, 20, 0.5, 5)}
          ${ctl.select('an-gtype', 'Saison générée', [['add', 'additive'], ['mul', 'multiplicative (en %)']], 'add')}
          ${ctl.slider('an-seed', 'Graine', 1, 50, 1, 4)}
        </div>
        <div id="an-stats"></div>
        <div id="an-c1"></div>
        <div class="grid-2"><div id="an-c2"></div><div id="an-c4"></div></div>
        <div id="an-c3"></div>
        <div id="an-read" class="callout"></div>
      </div>`)}

      ${block('Mesurer la force des composantes', R`<div class="prose"><p>Wang, Smith et Hyndman (2006) proposent deux indicateurs dans \([0, 1]\), calculés sur l’échelle additive (logarithmique si la décomposition est multiplicative) :</p></div>
        ${formula('', R`\[F_T = \max\!\Big(0,\ 1 - \frac{\operatorname{Var}(R_t)}{\operatorname{Var}(T_t + R_t)}\Big) \qquad F_S = \max\!\Big(0,\ 1 - \frac{\operatorname{Var}(R_t)}{\operatorname{Var}(S_t + R_t)}\Big)\]`)}
        <div class="prose"><p>Un \(F_S\) supérieur à 0,64 est le seuil utilisé par <code>forecast::nsdiffs</code> pour recommander une différence saisonnière (chapitre 6).</p></div>`)}

      ${block('En Python', pyCode(
`from statsmodels.tsa.seasonal import seasonal_decompose, STL

dec = seasonal_decompose(y, model="multiplicative", period=12)   # MA centrée 2x12
dec.plot()

# STL : saison évolutive, robuste aux points aberrants, pas de bords manquants
stl = STL(np.log(y), period=12, robust=True).fit()
stl.plot()

# Force de la saisonnalité (Wang, Smith & Hyndman)
F_S = max(0, 1 - np.var(stl.resid) / np.var(stl.seasonal + stl.resid))`))}

      ${block('Vérifier', quiz([
        { q: 'Sur AirPassengers, l’amplitude des pics estivaux grandit avec le niveau. Quelle décomposition choisir ?', opts: ['Additive', 'Multiplicative, ou additive sur le logarithme', 'Aucune : la série n’est pas saisonnière'], a: 1, expl: 'Une amplitude proportionnelle au niveau est la signature d’une saisonnalité multiplicative. Le log la rend additive.' },
        { q: 'Pourquoi une 2×12-MA plutôt qu’une 12-MA simple pour une série mensuelle ?', opts: ['Pour lisser davantage', 'Parce qu’une moyenne sur un nombre pair de points n’est pas centrée sur une date', 'Pour gérer les valeurs manquantes'], a: 1, expl: 'Une 12-MA est centrée entre deux mois. La 2×12-MA (moyenne de deux 12-MA décalées) est centrée et symétrique, et elle annule toute saison de période 12.' },
        { q: 'Quelle limite de la décomposition classique STL corrige-t-elle ?', opts: ['Elle suppose une saison figée et perd les bords', 'Elle ne gère pas la tendance', 'Elle ne fonctionne qu’en multiplicatif'], a: 0, expl: 'La décomposition classique impose des coefficients saisonniers identiques chaque année et laisse k valeurs indéfinies à chaque bord.' },
      ]))}
      `;

      const draw = () => {
        const src = val('an-src');
        el.querySelector('#an-gen').hidden = src !== 'gen';
        let ds;
        if (src === 'gen') {
          const g = TS.gaussianRng(int('an-seed')), s = int('an-per'), A = num('an-amp'), b = num('an-slope'), sd = num('an-noise');
          const mul = val('an-gtype') === 'mul';
          const values = Array.from({ length: 120 }, (_, t) => {
            const base = 100 + b * t, wave = Math.sin((2 * Math.PI * t) / s);
            return (mul ? base * (1 + (A / 100) * wave) : base + A * wave) + sd * g();
          });
          ds = { id: 'gen', name: 'Série générée', values, dates: null, freq: null, period: s };
        } else ds = getDataset(src);
        const type = val('an-type');
        if (type === 'multiplicative' && ds.values.some((v) => v <= 0)) {
          el.querySelector('#an-read').innerHTML = '<p>La décomposition multiplicative exige des valeurs strictement positives. Choisissez « additive ».</p>';
          return;
        }
        const d = TS.decompose(ds.values, ds.period, type);
        const ax = timeAxis(ds);
        const xs = ds.values.map((_, i) => i);
        el.querySelector('#an-stats').innerHTML = stats([
          ['Observations', ds.values.length], ['Période s', ds.period],
          ['Force de tendance F_T', f2(d.strengthTrend, 2)], ['Force saisonnière F_S', f2(d.strengthSeason, 2)],
        ]);
        const base = { xLabel: ax.label, xTicks: ax.ticks, height: 240 };
        plot(el.querySelector('#an-c1'), { ...base, title: 'Série et tendance estimée', layers: [
          { type: 'line', x: xs, y: ds.values, name: 'Série', color: '--s1', width: 1.6 },
          { type: 'line', x: xs, y: d.trend, name: 'Tendance (2×s-MA)', color: '--s2' },
        ] });
        plot(el.querySelector('#an-c2'), { ...base, height: 200, title: 'Composante saisonnière', layers: [
          { type: 'line', x: xs, y: d.seasonal, name: 'Saison', color: '--s3', width: 1.6 },
          { type: 'hline', value: type === 'multiplicative' ? 1 : 0 },
        ] });
        plot(el.querySelector('#an-c3'), { ...base, height: 200, title: 'Reste', layers: [
          { type: 'stem', x: xs, y: type === 'multiplicative' ? d.resid.map((v) => (v === null ? null : v - 1)) : d.resid, name: type === 'multiplicative' ? 'Reste − 1' : 'Reste', color: '--ink-3', base: 0 },
        ] });
        const lab = ds.freq === 'M' ? root.UI.MOIS : ds.freq === 'D' ? null : null;
        const startIdx = ds.dates && ds.freq === 'M' ? +ds.dates[0].split('-')[1] - 1 : 0;
        const dayNames = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
        const startDay = ds.dates && ds.freq === 'D' ? (new Date(ds.dates[0] + 'T00:00:00Z').getUTCDay() + 6) % 7 : 0;
        const figLabel = (j) => {
          j = Math.round(j);
          if (lab) return lab[(j + startIdx) % 12];
          if (ds.freq === 'D' && ds.period === 7) return dayNames[(j + startDay) % 7];
          return `j = ${j}`;
        };
        plot(el.querySelector('#an-c4'), { height: 200, title: 'Profil saisonnier (un cycle)', xLabel: figLabel,
          xTicks: d.figure.map((_, j) => j).filter((j) => d.figure.length <= 12 || j % 2 === 0),
          layers: [{ type: 'bar', x: d.figure.map((_, j) => j), y: d.figure, name: 'Coefficient', color: '--s3', base: type === 'multiplicative' ? 1 : 0 },
            { type: 'hline', value: type === 'multiplicative' ? 1 : 0 }], yMin: undefined });
        // Lecture automatique
        const maxI = d.figure.indexOf(Math.max(...d.figure)), minI = d.figure.indexOf(Math.min(...d.figure));
        const amp = type === 'multiplicative'
          ? `le coefficient va de ${f2(Math.min(...d.figure), 3)} (${figLabel(minI)}) à ${f2(Math.max(...d.figure), 3)} (${figLabel(maxI)}), soit ${f2((Math.max(...d.figure) - Math.min(...d.figure)) * 100, 1)} points de pourcentage d’écart autour de la tendance`
          : `la saison va de ${f2(Math.min(...d.figure), 2)} (${figLabel(minI)}) à +${f2(Math.max(...d.figure), 2)} (${figLabel(maxI)}) autour de la tendance`;
        el.querySelector('#an-read').innerHTML = `<p><strong>Lecture.</strong> Sur un cycle, ${amp}. F<sub>T</sub> = ${f2(d.strengthTrend, 2)} et F<sub>S</sub> = ${f2(d.strengthSeason, 2)} : ${d.strengthSeason > 0.64 ? 'la saisonnalité est forte, une différence saisonnière sera probablement nécessaire pour un ARIMA.' : 'la saisonnalité est modérée ou faible.'} Si le reste montre encore une structure régulière (vagues, amplitude qui varie), essayez l’autre type de décomposition.</p>`;
      };
      bind(el.querySelector('#an-panel'), draw, { debounce: 30 });
      draw();
    },
  });

  // ================================================================ 2. Stationnarité
  function simulateProcess(kind, phi, n, seed) {
    const g = TS.gaussianRng(seed);
    const out = [];
    let x = 0, h = 2; // h : variance conditionnelle du GARCH, initialisée à sa valeur inconditionnelle
    for (let t = 0; t < n; t++) {
      const e = g();
      if (kind === 'wn') x = e;
      else if (kind === 'ar1') x = phi * x + e;
      else if (kind === 'rw') x = x + e;
      else if (kind === 'rwd') x = x + 0.2 + e;
      else if (kind === 'trend') x = 0.05 * t + e;
      else if (kind === 'garch') { h = 0.1 + 0.15 * x * x + 0.8 * h; x = Math.sqrt(h) * e; }
      out.push(x);
    }
    return out;
  }

  function testsVerdict(adfR, kpssR) {
    const a = adfR.pvalue < 0.05, k = kpssR.pvalue < 0.05;
    if (a && !k) return ['good', 'Stationnaire', 'ADF rejette la racine unitaire et KPSS ne rejette pas la stationnarité.'];
    if (!a && k) return ['bad', 'Racine unitaire', 'ADF ne rejette pas la racine unitaire et KPSS rejette la stationnarité : différenciez.'];
    if (a && k) return ['warn', 'Conflit', 'Les deux tests rejettent : typique d’une stationnarité autour d’une tendance, d’une rupture ou d’une mémoire longue. Essayez la régression « constante + tendance ».'];
    return ['warn', 'Peu concluant', 'Aucun test ne rejette : les tests manquent de puissance (série courte ou racine proche de 1).'];
  }

  function testsTable(y, reg) {
    const a = TS.adf(y, { regression: reg }), k = TS.kpss(y, { regression: reg === 'n' ? 'c' : reg });
    const [kind, label, expl] = testsVerdict(a, k);
    const html = table(['Test', 'H0', 'Statistique', 'p-valeur', 'Valeurs critiques', 'Décision à 5 %'], [
      ['ADF', 'racine unitaire', f2(a.stat, 3), fp(a.pvalue), `1 % : ${f2(a.crit['1%'], 2)} · 5 % : ${f2(a.crit['5%'], 2)} · 10 % : ${f2(a.crit['10%'], 2)}`,
        a.pvalue < 0.05 ? pill('good', 'rejet de H0') : pill('warn', 'H0 non rejetée')],
      ['KPSS', 'stationnarité', f2(k.stat, 3), (k.bound ? k.bound + ' ' : '') + fp(k.pvalue), `10 % : ${k.crit['10%']} · 5 % : ${k.crit['5%']} · 1 % : ${k.crit['1%']}`,
        k.pvalue < 0.05 ? pill('bad', 'rejet de H0') : pill('good', 'H0 non rejetée')],
    ], { numCols: [2, 3] });
    return { html: html + `<p class="small muted">ADF : ${a.usedlag} retards (AIC), ${a.nobs} obs. utilisées. KPSS : ${k.nlags} retards de Newey-West. p-valeur KPSS interpolée dans la table de Kwiatkowski et al. (1992), bornée à [0,01 ; 0,10].</p>`, verdict: [kind, label, expl] };
  }

  CH.push({
    id: 'stationnarite', title: 'Stationnarité', short: 'Stationnarité & tests',
    desc: 'Définitions, racine unitaire, tests ADF et KPSS, Box-Cox et différenciation.',
    render(el) {
      el.innerHTML = R`
      <header class="ch-head">
        <div class="eyebrow">Chapitre 2 · Explication et tests</div>
        <h1>Stationnarité : la condition pour apprendre du passé</h1>
        <p class="lede">Un processus stationnaire a des propriétés statistiques invariantes dans le temps. C’est l’hypothèse qui rend l’estimation possible à partir d’une seule trajectoire, et le prérequis des modèles ARMA.</p>
      </header>

      ${block('Définitions', R`<div class="grid-2">
        ${formula('Stationnarité stricte', R`\[(X_{t_1},\dots,X_{t_k}) \overset{d}{=} (X_{t_1+h},\dots,X_{t_k+h}) \quad \forall k, t_i, h\]<p class="small muted">La loi jointe est invariante par translation. Trop fort pour être testé en pratique.</p>`)}
        ${formula('Stationnarité faible (au second ordre)', R`\[\mathbb{E}[X_t] = \mu,\qquad \operatorname{Var}(X_t) = \gamma(0) < \infty,\qquad \operatorname{Cov}(X_t, X_{t+h}) = \gamma(h)\]<p class="small muted">Moyenne constante, variance finie, autocovariance qui ne dépend que de l’écart h. C’est celle qu’on utilise.</p>`)}
      </div>
      <div class="prose">
        <p><strong>Contre-exemple canonique : la marche aléatoire</strong> \(X_t = X_{t-1} + \varepsilon_t\). En itérant, \(X_t = X_0 + \sum_{i=1}^t \varepsilon_i\), donc \(\operatorname{Var}(X_t) = t\sigma^2\) : la variance croît sans limite. Le polynôme \(\phi(z) = 1 - z\) a une <em>racine unitaire</em> \(z = 1\). La différence \(\Delta X_t = \varepsilon_t\) est, elle, stationnaire : on dit que \(X_t\) est intégrée d’ordre 1, noté \(I(1)\).</p>
        <p><strong>Tendance déterministe ou stochastique ?</strong> \(X_t = a + bt + \varepsilon_t\) est stationnaire autour d’une droite (<em>trend-stationary</em>) : on retire la tendance par régression. Une marche avec dérive \(X_t = \delta + X_{t-1} + \varepsilon_t\) a une tendance stochastique : on différencie. Différencier une série trend-stationary crée un MA non inversible (\(\Delta\varepsilon_t = \varepsilon_t - \varepsilon_{t-1}\)) : la distinction compte.</p>
      </div>`)}

      ${block('Pratique : galerie de processus', R`<div class="panel" id="st-gal">
        <div class="controls">
          ${ctl.select('st-kind', 'Processus', [['wn', 'Bruit blanc'], ['ar1', 'AR(1)'], ['rw', 'Marche aléatoire'], ['rwd', 'Marche aléatoire avec dérive'], ['trend', 'Tendance déterministe + bruit'], ['garch', 'GARCH(1,1) : variance conditionnelle']], 'ar1')}
          ${ctl.slider('st-phi', 'φ (AR(1))', -0.99, 1, 0.01, 0.9)}
          ${ctl.slider('st-win', 'Fenêtre glissante', 10, 80, 5, 30)}
          ${ctl.slider('st-seed', 'Graine', 1, 60, 1, 7)}
        </div>
        <div id="st-c1"></div>
        <div id="st-tests"></div>
        <div id="st-verdict" class="callout"></div>
      </div>`)}

      ${block('Les tests de racine unitaire', R`<div class="grid-2">
        ${formula('Dickey-Fuller augmenté (ADF) · H0 : racine unitaire', R`\[\Delta X_t = \alpha + \beta t + \gamma X_{t-1} + \sum_{i=1}^{p}\delta_i \Delta X_{t-i} + u_t\]
          <p class="small">On teste \(H_0 : \gamma = 0\) contre \(\gamma < 0\) avec la statistique \(t\) de \(\hat\gamma\). Sous \(H_0\), elle ne suit <em>pas</em> une loi de Student mais une loi de Dickey-Fuller (fonctionnelle d’un mouvement brownien), d’où les valeurs critiques de MacKinnon. Les retards \(\Delta X_{t-i}\) absorbent l’autocorrélation de \(u_t\) ; \(p\) est choisi par AIC.</p>`)}
        ${formula('KPSS · H0 : stationnarité', R`\[X_t = \xi t + r_t + \varepsilon_t,\quad r_t = r_{t-1} + u_t,\quad H_0 : \sigma_u^2 = 0\]
          \[\eta = \frac{1}{n^2\,\hat\sigma^2_{LR}}\sum_{t=1}^n S_t^2,\qquad S_t = \sum_{i\le t}\hat e_i\]
          <p class="small">\(\hat e_t\) : résidus de la régression sur constante (et tendance). \(\hat\sigma^2_{LR}\) : variance de long terme, estimée par Newey-West avec noyau de Bartlett.</p>`)}
      </div>
      <div class="callout"><p>Les deux tests ont des hypothèses nulles opposées. On les utilise ensemble : ADF seul manque de puissance quand la racine est proche de 1 (φ = 0,95 sur 150 points est souvent « non rejeté »).</p></div>`)}

      ${block('Transformer pour stationnariser', R`<div class="prose">
        <p><strong>1. Stabiliser la variance</strong> par une transformation de Box-Cox, définie pour \(x > 0\) :</p></div>
        ${formula('', R`\[y_t = \begin{cases} \dfrac{x_t^{\lambda} - 1}{\lambda} & \lambda \neq 0 \\[4pt] \log x_t & \lambda = 0\end{cases}\qquad \hat\lambda = \arg\max_\lambda\Big[-\tfrac n2 \log \hat\sigma^2(\lambda) + (\lambda - 1)\sum_t \log x_t\Big]\]`)}
        <div class="prose"><p><strong>2. Retirer la tendance stochastique</strong> par \(d\) différences, et la saisonnalité stochastique par \(D\) différences saisonnières : \(W_t = (1-B)^d(1-B^s)^D\, y_t\). En pratique \(d \le 2\), \(D \le 1\), et \(d + D \le 2\). Sur-différencier se repère à une autocorrélation d’ordre 1 proche de −0,5 et gonfle la variance.</p></div>
        <div class="panel" id="st-tr">
          <div class="controls">
            ${ctl.series('st-ds', 'air')}
            <span id="st-lam-wrap"></span>
            ${ctl.number('st-d', 'd', 1, 0, 2)}
            ${ctl.number('st-D', 'D', 1, 0, 1)}
            ${ctl.select('st-reg', 'Régression des tests', [['c', 'constante'], ['ct', 'constante + tendance']], 'c')}
          </div>
          <div id="st-sugg"></div>
          <div id="st-c2"></div>
          <div id="st-tests2"></div>
          <div id="st-verdict2" class="callout"></div>
        </div>`)}

      ${block('En Python', pyCode(
`from statsmodels.tsa.stattools import adfuller, kpss
from scipy.stats import boxcox

stat, p, usedlag, nobs, crit, icbest = adfuller(np.log(y), regression="c", autolag="AIC")
print(f"ADF = {stat:.3f}, p = {p:.3f}, retards = {usedlag}, critiques = {crit}")

stat, p, lags, crit = kpss(np.log(y), regression="c", nlags="legacy")
print(f"KPSS = {stat:.3f}, p = {p:.3f}")

# Box-Cox avec λ estimé par maximum de vraisemblance
y_bc, lam = boxcox(y)

# Différence simple puis saisonnière : (1-B)(1-B^12) log y
w = np.log(y).diff().diff(12).dropna()
print(adfuller(w)[1], kpss(w, nlags="legacy")[1])`))}

      ${block('Vérifier', quiz([
        { q: 'L’ADF donne p = 0,32 et le KPSS p < 0,01. Que conclure ?', opts: ['La série est stationnaire', 'La série a vraisemblablement une racine unitaire : on différencie', 'Il faut augmenter le nombre de retards de l’ADF jusqu’à rejeter'], a: 1, expl: 'ADF ne rejette pas H0 (racine unitaire) et KPSS rejette H0 (stationnarité) : les deux tests concordent vers I(1).' },
        { q: 'Pourquoi la statistique t de l’ADF n’utilise-t-elle pas les quantiles de Student ?', opts: ['Parce que les résidus ne sont pas gaussiens', 'Parce que sous H0 le régresseur X_{t-1} est non stationnaire et la loi limite n’est pas normale', 'Par convention historique'], a: 1, expl: 'Sous H0, la loi limite est une fonctionnelle du mouvement brownien (loi de Dickey-Fuller), décalée vers la gauche.' },
        { q: 'Après différenciation, l’ACF au retard 1 vaut −0,52. Qu’est-ce que cela suggère ?', opts: ['Une sur-différenciation', 'Un AR(1) positif', 'Une saisonnalité résiduelle'], a: 0, expl: 'Différencier un bruit blanc donne un MA(1) de coefficient −1, dont l’autocorrélation d’ordre 1 vaut exactement −0,5.' },
      ]))}
      `;

      // Galerie
      const drawGal = () => {
        const kind = val('st-kind');
        el.querySelector('#st-phi').closest('.ctl').style.display = kind === 'ar1' ? '' : 'none';
        const x = simulateProcess(kind, num('st-phi'), 300, int('st-seed'));
        const w = int('st-win');
        const rm = TS.rolling(x, w, TS.mean), rs = TS.rolling(x, w, (a) => TS.std(a, 1));
        const xs = x.map((_, i) => i);
        plot(el.querySelector('#st-c1'), { title: 'Trajectoire simulée (n = 300) avec moyenne et ±2 écarts-types glissants', height: 260,
          xLabel: (i) => String(Math.round(i) + 1),
          layers: [
            { type: 'band', x: xs, lo: rm.map((m, i) => (m === null ? null : m - 2 * rs[i])), hi: rm.map((m, i) => (m === null ? null : m + 2 * rs[i])), name: '±2σ glissant', color: '--s2', opacity: 0.14 },
            { type: 'line', x: xs, y: x, name: 'X_t', color: '--s1', width: 1.4 },
            { type: 'line', x: xs, y: rm, name: 'Moyenne glissante', color: '--s2' },
          ] });
        const reg = kind === 'trend' || kind === 'rwd' ? 'ct' : 'c';
        const t = testsTable(x, reg);
        el.querySelector('#st-tests').innerHTML = `<p class="small muted">Régression des tests : ${reg === 'ct' ? 'constante + tendance' : 'constante'}.</p>` + t.html;
        const truth = {
          wn: 'Vérité : stationnaire.', ar1: Math.abs(num('st-phi')) < 1 ? `Vérité : stationnaire (|φ| < 1). Plus φ approche 1, plus les tests peinent à le voir.` : 'Vérité : φ = 1, marche aléatoire, non stationnaire.',
          rw: 'Vérité : racine unitaire, I(1).', rwd: 'Vérité : racine unitaire avec dérive, I(1).', trend: 'Vérité : stationnaire autour d’une tendance linéaire (trend-stationary).',
          garch: 'Vérité : faiblement stationnaire (variance inconditionnelle finie), mais la variance conditionnelle varie : des grappes de volatilité apparaissent. Moyenne et autocovariance restent constantes.',
        }[kind];
        el.querySelector('#st-verdict').innerHTML = `<p>${pill(t.verdict[0], t.verdict[1])} ${t.verdict[2]}</p><p class="small">${truth}</p>`;
      };
      bind(el.querySelector('#st-gal'), drawGal, { debounce: 40 });
      drawGal();

      // Transformation
      const lamWrap = el.querySelector('#st-lam-wrap');
      const setLam = () => { const ds = getDataset(val('st-ds')); lamWrap.innerHTML = ctl.select('st-lam', 'Box-Cox', lambdaOptions(ds), ds.values.every((v) => v > 0) ? '0' : 'none'); };
      setLam();
      const drawTr = () => {
        const ds = getDataset(val('st-ds'));
        const lam = parseLambda(val('st-lam'), ds);
        const d = int('st-d'), D = ds.period > 1 ? int('st-D') : 0;
        el.querySelector('#st-D').disabled = !(ds.period > 1);
        const { y, offset } = transformSeries(ds, { lambda: lam, d, D });
        const base = TS.boxcox(ds.values, lam);
        const nd = TS.ndiffs(base), nsd = TS.nsdiffs(ds.values, ds.period);
        el.querySelector('#st-sugg').innerHTML = `<p class="small">Suggestions automatiques sur la série transformée : <strong>d = ${nd}</strong> (KPSS itéré, comme <code>ndiffs</code>) · <strong>D = ${nsd}</strong> (force saisonnière, comme <code>nsdiffs</code>)${ds.values.every((v) => v > 0) ? ` · λ̂ = ${f2(TS.boxcoxLambda(ds.values), 2)}` : ''}.</p>`;
        const ax = timeAxis(ds);
        const label = `W_t = ${d ? `(1−B)${d > 1 ? '²' : ''}` : ''}${D ? `(1−B^${ds.period})` : ''}${lam === null ? 'X_t' : Math.abs(lam) < 1e-12 ? 'log X_t' : `BoxCox(X_t, ${f2(lam, 2)})`}`;
        plot(el.querySelector('#st-c2'), { title: label, height: 240, xLabel: ax.label, xTicks: ax.ticks,
          layers: [{ type: 'line', x: y.map((_, i) => i + offset), y, name: 'W_t', color: '--s1', width: 1.5 }, { type: 'hline', value: TS.mean(y) }] });
        if (y.length < 20) { el.querySelector('#st-tests2').innerHTML = '<p>Série trop courte après différenciation.</p>'; return; }
        const t = testsTable(y, val('st-reg'));
        el.querySelector('#st-tests2').innerHTML = t.html;
        el.querySelector('#st-verdict2').innerHTML = `<p>${pill(t.verdict[0], t.verdict[1])} ${t.verdict[2]}</p>`;
      };
      el.querySelector('#st-tr').addEventListener('change', (e) => { if (e.target.id === 'st-ds') setLam(); });
      bind(el.querySelector('#st-tr'), drawTr, { debounce: 20 });
      lamWrap.addEventListener('change', drawTr);
      drawTr();
    },
  });

  // ================================================================ 3. ACF / PACF / spectre
  CH.push({
    id: 'acf', title: 'Autocorrélation et spectre', short: 'ACF, PACF & spectre',
    desc: 'Estimateurs, bandes de confiance, Durbin-Levinson, Ljung-Box, périodogramme.',
    render(el) {
      el.innerHTML = R`
      <header class="ch-head">
        <div class="eyebrow">Chapitre 3 · Outils de diagnostic</div>
        <h1>Autocorrélation, autocorrélation partielle et spectre</h1>
        <p class="lede">L’ACF et la PACF sont les empreintes digitales d’un processus stationnaire. Elles servent à identifier un modèle (chapitre 4) puis à vérifier que ses résidus sont du bruit blanc (chapitre 6).</p>
      </header>

      ${block('Fonction d’autocorrélation (ACF)', R`<div class="grid-2">
        ${formula('Estimateurs', R`\[\hat\gamma(h) = \frac1n\sum_{t=1}^{n-h}(x_t-\bar x)(x_{t+h}-\bar x),\qquad \hat\rho(h) = \frac{\hat\gamma(h)}{\hat\gamma(0)}\]
          <p class="small muted">Division par n et non n − h : l’estimateur est biaisé mais la matrice \([\hat\gamma(i-j)]\) reste définie positive, ce dont Yule-Walker a besoin.</p>`)}
        ${formula('Bandes de confiance', R`\[\text{Bruit blanc : } \hat\rho(h) \approx \mathcal N(0, 1/n) \Rightarrow \pm \frac{1{,}96}{\sqrt n}\]
          \[\text{Bartlett, sous MA}(h-1) : \operatorname{Var}\hat\rho(h) \approx \frac1n\Big(1 + 2\sum_{j=1}^{h-1}\rho(j)^2\Big)\]
          <p class="small muted">Les bandes de Bartlett, plus larges, testent « le processus est-il un MA(h−1) ? ». C’est ce que trace <code>plot_acf</code> par défaut.</p>`)}
      </div>`)}

      ${block('Autocorrélation partielle (PACF)', R`<div class="prose">
        <p>\(\alpha(h)\) est la corrélation entre \(X_t\) et \(X_{t+h}\) une fois retirée la part expliquée linéairement par \(X_{t+1},\dots,X_{t+h-1}\). C’est aussi le dernier coefficient \(\phi_{hh}\) de la meilleure prédiction linéaire d’ordre \(h\). On la calcule sans inverser de matrice par l’algorithme de <strong>Durbin-Levinson</strong>, en \(O(h^2)\) :</p></div>
        ${formula('', R`\[\phi_{kk} = \frac{\rho(k) - \sum_{j=1}^{k-1}\phi_{k-1,j}\,\rho(k-j)}{v_{k-1}},\qquad \phi_{k,j} = \phi_{k-1,j} - \phi_{kk}\,\phi_{k-1,k-j},\qquad v_k = v_{k-1}(1-\phi_{kk}^2)\]
        <p class="small muted">\(v_k\) est la variance relative de l’erreur de prédiction d’ordre k. Les bandes de la PACF sous bruit blanc sont aussi ±1,96/√n.</p>`)}
        <div id="acf-dl"></div>`)}

      ${block('Table d’identification', table(['Processus', 'ACF', 'PACF'], [
        ['AR(p)', 'décroissance exponentielle ou sinusoïdale amortie', '<strong>coupure après p</strong>'],
        ['MA(q)', '<strong>coupure après q</strong>', 'décroissance amortie'],
        ['ARMA(p, q)', 'décroissance après le retard q − p', 'décroissance après le retard p − q'],
        ['Non stationnaire', 'décroissance très lente, quasi linéaire', 'pic proche de 1 au retard 1'],
        ['Saisonnier (s)', 'pics aux retards s, 2s, …', 'pics aux retards s, 2s, … (AR saisonnier : coupure après Ps)'],
      ]))}

      ${block('Pratique : ACF, PACF, Ljung-Box, périodogramme', R`<div class="panel" id="acf-panel">
        <div class="controls">
          ${ctl.series('acf-ds', 'air')}
          <span id="acf-lam-wrap"></span>
          ${ctl.number('acf-d', 'd', 1, 0, 2)}
          ${ctl.number('acf-D', 'D', 1, 0, 1)}
          ${ctl.slider('acf-lag', 'Retard max.', 10, 60, 1, 36)}
          ${ctl.check('acf-bart', 'Bandes de Bartlett', true)}
        </div>
        <div class="grid-2"><div id="acf-c1"></div><div id="acf-c2"></div></div>
        <div id="acf-lb"></div>
        <div id="acf-c3"></div>
        <div id="acf-peaks"></div>
      </div>`)}

      ${block('Test du portemanteau de Ljung-Box', formula('', R`\[Q(L) = n(n+2)\sum_{k=1}^{L}\frac{\hat\rho(k)^2}{n-k} \;\overset{H_0}{\sim}\; \chi^2_{L - m}\]
        <p class="small">H0 : les L premières autocorrélations sont nulles. Appliqué aux résidus d’un ARMA(p, q), on retire \(m = p + q\) degrés de liberté. Le facteur \((n+2)/(n-k)\) corrige le biais de Box-Pierce en petit échantillon.</p>`))}

      ${block('Domaine fréquentiel', R`<div class="prose"><p>La densité spectrale est la transformée de Fourier de l’autocovariance : \(f(\omega) = \frac{1}{2\pi}\sum_h \gamma(h)e^{-ih\omega}\). Son estimateur brut est le <strong>périodogramme</strong>, qui décompose la variance par fréquence :</p></div>
        ${formula('', R`\[I(f_k) = \frac1n\Big|\sum_{t=1}^{n}(x_t-\bar x)\,e^{-2i\pi f_k t}\Big|^2,\qquad f_k = \frac kn,\ k = 1,\dots,\lfloor n/2\rfloor\]
        <p class="small muted">Un pic à la fréquence f révèle un cycle de période 1/f. Le périodogramme n’est pas convergent (sa variance ne diminue pas avec n) : on le lisse en pratique (fenêtres de Daniell, méthode de Welch).</p>`)}`)}

      ${block('En Python', pyCode(
`from statsmodels.graphics.tsaplots import plot_acf, plot_pacf
from statsmodels.tsa.stattools import acf, pacf
from statsmodels.stats.diagnostic import acorr_ljungbox
from scipy.signal import periodogram

w = np.log(y).diff().diff(12).dropna()
fig, ax = plt.subplots(1, 2, figsize=(11, 3.5))
plot_acf(w, lags=36, ax=ax[0])                    # bandes de Bartlett par défaut
plot_pacf(w, lags=36, ax=ax[1], method="ldb")     # Durbin-Levinson (estimateur biaisé)

print(acorr_ljungbox(w, lags=[12, 24]))           # colonnes lb_stat, lb_pvalue

f, Pxx = periodogram(np.log(y).diff().dropna())   # pic attendu à f = 1/12`))}

      ${block('Vérifier', quiz([
        { q: 'La PACF est significative aux retards 1 et 2 puis nulle, l’ACF décroît de façon amortie. Quel modèle ?', opts: ['MA(2)', 'AR(2)', 'ARMA(2, 2)'], a: 1, expl: 'Coupure de la PACF après p = 2 et ACF amortie : signature d’un AR(2).' },
        { q: 'Sur 36 retards d’un vrai bruit blanc, combien de dépassements des bandes à 95 % faut-il attendre ?', opts: ['Aucun', 'Environ 2', 'Environ 9'], a: 1, expl: '5 % de 36 ≈ 1,8. Un ou deux dépassements isolés ne signifient rien : c’est pourquoi on complète par un test joint comme Ljung-Box.' },
        { q: 'Que teste Ljung-Box sur les résidus d’un modèle ?', opts: ['Leur normalité', 'L’absence d’autocorrélation jusqu’au retard L', 'La constance de leur variance'], a: 1, expl: 'C’est un test joint de nullité des L premières autocorrélations. La normalité se teste avec Jarque-Bera, l’hétéroscédasticité avec ARCH-LM.' },
      ]))}
      `;

      const lamWrap = el.querySelector('#acf-lam-wrap');
      const setLam = () => { const ds = getDataset(val('acf-ds')); lamWrap.innerHTML = ctl.select('acf-lam', 'Box-Cox', lambdaOptions(ds), ds.values.every((v) => v > 0) ? '0' : 'none'); };
      setLam();
      const draw = () => {
        const ds = getDataset(val('acf-ds'));
        const lam = parseLambda(val('acf-lam'), ds);
        const D = ds.period > 1 ? int('acf-D') : 0;
        el.querySelector('#acf-D').disabled = !(ds.period > 1);
        const { y } = transformSeries(ds, { lambda: lam, d: int('acf-d'), D });
        const n = y.length, L = Math.min(int('acf-lag'), n - 2);
        const r = TS.acf(y, L), p = TS.pacf(y, L), band = 1.959964 / Math.sqrt(n);
        const lags = r.map((_, i) => i).slice(1);
        const bart = TS.bartlettBands(r, n).slice(1);
        const colorFn = (lim) => (v, i) => (Math.abs(v) > (Array.isArray(lim) ? lim[i] : lim) ? '--s1' : '--ink-3');
        const useB = val('acf-bart');
        const xt = (count) => { const st = ds.period > 1 && L / ds.period <= count ? ds.period : Math.ceil(L / count / 5) * 5 || 5; const o = []; for (let v = st; v <= L; v += st) o.push(v); return o; };
        plot(el.querySelector('#acf-c1'), { title: `ACF (n = ${n})`, height: 230, yMin: -1, yMax: 1, xTicks: xt, xLabel: (v) => String(Math.round(v)),
          layers: [
            useB ? { type: 'band', x: lags, lo: bart.map((b) => -b), hi: bart, name: 'Bartlett 95 %', color: '--s2', opacity: 0.14 } : null,
            { type: 'hline', value: band, dash: true }, { type: 'hline', value: -band, dash: true }, { type: 'hline', value: 0, dash: false },
            { type: 'stem', x: lags, y: r.slice(1), name: 'ρ̂(h)', color: '--s1', colorFn: colorFn(useB ? bart : band) },
          ], legend: false });
        plot(el.querySelector('#acf-c2'), { title: 'PACF (Durbin-Levinson)', height: 230, yMin: -1, yMax: 1, xTicks: xt, xLabel: (v) => String(Math.round(v)),
          layers: [{ type: 'hline', value: band }, { type: 'hline', value: -band }, { type: 'hline', value: 0, dash: false },
            { type: 'stem', x: lags, y: p.slice(1), name: 'α̂(h)', color: '--s1', colorFn: colorFn(band) }] });
        const lbl = ds.period > 1 ? [ds.period, 2 * ds.period].filter((v) => v < n - 1) : [10, 20];
        const lb = TS.ljungBox(y, lbl);
        el.querySelector('#acf-lb').innerHTML = `<p class="small">Barres pleines : dépassement de la bande ${useB ? 'de Bartlett' : '±1,96/√n'} ; pointillés : ±1,96/√n = ±${f2(band, 3)}.</p>` +
          table(['Ljung-Box', 'Q', 'ddl', 'p-valeur', 'Décision'], lb.map((b) => [`L = ${b.lag}`, f2(b.Q, 2), b.df, fp(b.pvalue),
            b.pvalue < 0.05 ? pill('bad', 'autocorrélation détectée') : pill('good', 'compatible bruit blanc')]), { numCols: [1, 2, 3] });
        // Durbin-Levinson pas à pas
        const dl = [];
        let v = 1, phi = [];
        for (let k = 1; k <= 5 && k <= L; k++) {
          let nm = r[k]; for (let j = 1; j < k; j++) nm -= phi[j - 1] * r[k - j];
          const pk = nm / v; const nx = phi.map((c, j) => c - pk * phi[k - 2 - j]); nx.push(pk); phi = nx; v *= 1 - pk * pk;
          dl.push([k, f2(r[k], 4), f2(pk, 4), f2(v, 4), phi.map((c) => f2(c, 3)).join(' ; ')]);
        }
        el.querySelector('#acf-dl').innerHTML = `<p class="small muted">Déroulé sur la série choisie ci-dessous (${ds.short || ds.name}, transformée) :</p>` +
          table(['k', 'ρ̂(k)', 'φ̂kk = PACF', 'v_k', 'φ̂k,1 … φ̂k,k (Yule-Walker)'], dl, { numCols: [1, 2, 3] });
        // Périodogramme
        const per = TS.periodogram(y);
        plot(el.querySelector('#acf-c3'), { title: 'Périodogramme', height: 220, xAxisTitle: 'fréquence (cycles par pas de temps)', xLabel: (f, full) => full ? `f = ${f2(f, 3)} · période ${f2(1 / f, 1)}` : f2(f, 2),
          layers: [{ type: 'line', x: per.map((q) => q.freq), y: per.map((q) => q.power), name: 'I(f)', color: '--s5', width: 1.5 }] });
        const top = [...per].sort((a, b) => b.power - a.power).slice(0, 3);
        el.querySelector('#acf-peaks').innerHTML = `<p class="small">Pics principaux : ${top.map((q) => `période ≈ <strong>${f2(q.period, 1)}</strong> (f = ${f2(q.freq, 3)})`).join(' · ')}.</p>`;
      };
      el.querySelector('#acf-panel').addEventListener('change', (e) => { if (e.target.id === 'acf-ds') setLam(); });
      bind(el.querySelector('#acf-panel'), draw, { debounce: 20 });
      lamWrap.addEventListener('change', draw);
      draw();
    },
  });
})(window);
