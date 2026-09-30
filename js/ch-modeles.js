/*
 * Chapitres 4 à 6 : processus ARMA, lissage exponentiel, méthodologie Box-Jenkins / SARIMA.
 */
(function (root) {
  'use strict';
  const { ctl, bind, val, num, int, block, formula, pyCode, quiz, table, stats, pill, f2, fp, $, $$, timeAxis,
    lambdaOptions, parseLambda, getDataset, STATE, typeset, tick, esc, wireCopy } = root.UI;
  const { plot, complexPlane } = root.Charts;
  const CH = (root.CHAPTERS = root.CHAPTERS || []);
  const R = String.raw;

  // ---------------------------------------------------------------- utilitaires TeX
  const texNum = (v, d = 3) => {
    const s = Math.abs(v).toFixed(d).replace(/0+$/, '').replace(/\.$/, '');
    return s.replace('.', '{,}');
  };
  // Polynôme 1 + Σ c_i B^{i·s} (c_i déjà signés)
  function polyTex(coefs, s = 1) {
    const terms = coefs.map((c, i) => {
      if (Math.abs(c) < 5e-4) return '';
      const pw = (i + 1) * s;
      return ` ${c < 0 ? '-' : '+'} ${texNum(c)}B${pw > 1 ? `^{${pw}}` : ''}`;
    }).join('');
    return terms ? `(1${terms})` : '';
  }
  function histogram(x, bins) {
    const lo = Math.min(...x), hi = Math.max(...x), w = (hi - lo) / bins || 1;
    const counts = new Array(bins).fill(0);
    x.forEach((v) => { counts[Math.min(bins - 1, Math.floor((v - lo) / w))]++; });
    return { centers: counts.map((_, i) => lo + (i + 0.5) * w), dens: counts.map((c) => c / (x.length * w)), w };
  }

  // ================================================================ 4. ARMA
  CH.push({
    id: 'arma', title: 'Processus ARMA', short: 'Modèles AR, MA, ARMA',
    desc: 'Causalité, inversibilité, racines, représentation de Wold, simulateur.',
    render(el) {
      el.innerHTML = R`
      <header class="ch-head">
        <div class="eyebrow">Chapitre 4 · Modèles linéaires stationnaires</div>
        <h1>Processus AR, MA et ARMA</h1>
        <p class="lede">Les modèles ARMA décrivent la dépendance d’un processus stationnaire avec peu de paramètres : une partie autorégressive (mémoire des valeurs passées) et une partie moyenne mobile (mémoire des chocs passés).</p>
      </header>

      ${block('Définitions', R`<div class="grid-3">
        ${formula('AR(p)', R`\[X_t = c + \sum_{i=1}^p \phi_i X_{t-i} + \varepsilon_t\]\[\phi(B)X_t = c + \varepsilon_t\]`)}
        ${formula('MA(q)', R`\[X_t = \mu + \varepsilon_t + \sum_{j=1}^q \theta_j\varepsilon_{t-j}\]\[X_t = \mu + \theta(B)\varepsilon_t\]`)}
        ${formula('ARMA(p, q)', R`\[\phi(B)(X_t - \mu) = \theta(B)\varepsilon_t\]<p class="small muted">\(\mu = c/\phi(1)\). φ et θ sans racine commune.</p>`)}
      </div>`)}

      ${block('Causalité, inversibilité, Wold', R`<div class="prose">
        <p><strong>Causalité (stationnarité).</strong> L’ARMA admet une solution stationnaire causale \(X_t - \mu = \sum_{j\ge0}\psi_j\varepsilon_{t-j}\) si et seulement si toutes les racines de \(\phi(z)\) sont <em>à l’extérieur du cercle unité</em> (\(|z| > 1\)). Les poids se calculent par identification \(\phi(B)\psi(B) = \theta(B)\) :</p></div>
        ${formula('', R`\[\psi_0 = 1,\qquad \psi_j = \theta_j + \sum_{i=1}^{\min(j,p)} \phi_i\,\psi_{j-i},\qquad \gamma(h) = \sigma^2\sum_{j\ge 0}\psi_j\psi_{j+h}\]`)}
        <div class="prose">
        <p><strong>Inversibilité.</strong> Symétriquement, si les racines de \(\theta(z)\) sont hors du cercle unité, on peut écrire \(\varepsilon_t = \pi(B)(X_t - \mu)\) : le choc est récupérable à partir du passé observé. Sans cette condition le modèle n’est pas identifiable : un MA(1) de paramètre θ et un MA(1) de paramètre 1/θ ont la même ACF, puisque \(\rho(1) = \theta/(1+\theta^2)\).</p>
        <p><strong>Théorème de Wold.</strong> Tout processus faiblement stationnaire purement non déterministe s’écrit comme un MA(∞) de ses innovations. L’ARMA est une approximation rationnelle \(\theta(B)/\phi(B)\) de ce MA(∞) : c’est ce qui justifie son usage général.</p>
        <p><strong>Cas de l’AR(1).</strong> \(\phi(z) = 1 - \phi z\) a pour racine \(1/\phi\) : stationnaire ssi \(|\phi|<1\). Alors \(\mu = c/(1-\phi)\), \(\gamma(0) = \sigma^2/(1-\phi^2)\), \(\rho(h) = \phi^{h}\). Pour l’AR(2), la région de stationnarité est le triangle \(\phi_2 < 1 - \phi_1,\ \phi_2 < 1 + \phi_1,\ |\phi_2| < 1\) ; sous la parabole \(\phi_1^2 + 4\phi_2 < 0\), les racines sont complexes et la série présente des pseudo-cycles de période \(2\pi/\arccos\!\big(\phi_1 / (2\sqrt{-\phi_2})\big)\).</p>
      </div>`)}

      ${block('Pratique : simulateur ARMA(2, 2)', R`<div class="panel" id="arma-panel">
        <div class="controls" id="arma-presets">
          <span class="small muted">Préréglages :</span>
          <button type="button" class="ghost" data-p="0.8,0,0,0">AR(1) φ = 0,8</button>
          <button type="button" class="ghost" data-p="-0.7,0,0,0">AR(1) φ = −0,7</button>
          <button type="button" class="ghost" data-p="1.2,-0.7,0,0">AR(2) pseudo-cycle</button>
          <button type="button" class="ghost" data-p="0,0,0.8,0">MA(1)</button>
          <button type="button" class="ghost" data-p="0.7,0,-0.4,0">ARMA(1,1)</button>
          <button type="button" class="ghost" data-p="0.6,0.5,0,0">Non stationnaire</button>
          <button type="button" class="ghost" data-p="0,0,1.8,0">MA non inversible</button>
        </div>
        <div class="controls">
          ${ctl.slider('ar-p1', 'φ₁', -2, 2, 0.05, 1.2)}
          ${ctl.slider('ar-p2', 'φ₂', -1, 1, 0.05, -0.7)}
          ${ctl.slider('ar-t1', 'θ₁', -2, 2, 0.05, 0)}
          ${ctl.slider('ar-t2', 'θ₂', -1, 1, 0.05, 0)}
          ${ctl.slider('ar-n', 'n', 100, 1000, 50, 300)}
          ${ctl.slider('ar-seed', 'Graine', 1, 60, 1, 5)}
        </div>
        <div class="eq-live" id="ar-eq"></div>
        <div id="ar-props"></div>
        <div id="ar-c1"></div>
        <div class="grid-2"><div id="ar-c2"></div><div id="ar-c3"></div></div>
        <div class="grid-3"><div id="ar-c4"></div><div id="ar-c5"></div><div id="ar-c6"></div></div>
      </div>`)}

      ${block('En Python', pyCode(
`from statsmodels.tsa.arima_process import ArmaProcess

# Attention au signe : statsmodels attend les polynômes complets
# φ(B) = 1 - 1.2B + 0.7B²   et   θ(B) = 1 + 0.4B
proc = ArmaProcess(ar=[1, -1.2, 0.7], ma=[1, 0.4])
print(proc.isstationary, proc.isinvertible, proc.arroots)

x = proc.generate_sample(nsample=300, scale=1.0, burnin=300)
rho = proc.acf(lags=25)          # ACF théorique
alpha = proc.pacf(lags=25)       # PACF théorique
psi = proc.arma2ma(lags=20)      # poids ψ de la représentation MA(∞)`))}

      ${block('Vérifier', quiz([
        { q: 'L’AR(2) φ₁ = 0,6, φ₂ = 0,5 est-il stationnaire ?', opts: ['Oui, car |φ₁| < 1 et |φ₂| < 1', 'Non, car φ₁ + φ₂ > 1', 'Oui, si σ² est petit'], a: 1, expl: 'Il faut φ₂ < 1 − φ₁, soit 0,5 < 0,4 : faux. Le polynôme 1 − 0,6z − 0,5z² a une racine de module inférieur à 1.' },
        { q: 'Quelle est la valeur maximale de |ρ(1)| pour un MA(1) ?', opts: ['1', '0,5', '1/√2'], a: 1, expl: 'ρ(1) = θ/(1+θ²) atteint son maximum 0,5 en θ = 1. Une ACF d’ordre 1 de 0,8 ne peut pas venir d’un MA(1).' },
        { q: 'Pourquoi impose-t-on l’inversibilité d’un MA ?', opts: ['Pour que la variance soit finie', 'Pour l’identifiabilité et pour pouvoir reconstruire les chocs à partir du passé', 'Pour que le processus soit stationnaire'], a: 1, expl: 'Un MA est toujours stationnaire. L’inversibilité choisit une représentation unique parmi celles qui ont la même ACF, et c’est celle que l’estimation par résidus récursifs utilise.' },
      ]))}
      `;

      const panel = el.querySelector('#arma-panel');
      $$('#arma-presets button', el).forEach((b) => b.addEventListener('click', () => {
        const v = b.dataset.p.split(',').map(Number);
        ['ar-p1', 'ar-p2', 'ar-t1', 'ar-t2'].forEach((id, i) => { const inp = el.querySelector('#' + id); inp.value = v[i]; el.querySelector('#' + id + '-out').textContent = v[i]; });
        draw();
      }));

      const draw = () => {
        const phi = [num('ar-p1'), num('ar-p2')], theta = [num('ar-t1'), num('ar-t2')];
        const phiT = phi[1] !== 0 ? phi : phi[0] !== 0 ? [phi[0]] : [];
        const thT = theta[1] !== 0 ? theta : theta[0] !== 0 ? [theta[0]] : [];
        const stat = TS.isStationary(phiT), inv = TS.isInvertible(thT);
        const n = int('ar-n');
        const eq = R`\[${polyTex(phiT.map((v) => -v)) || ''}X_t = ${polyTex(thT) || ''}\varepsilon_t,\qquad \varepsilon_t \sim \mathcal N(0,1)\]`;
        el.querySelector('#ar-eq').innerHTML = eq;
        typeset(el.querySelector('#ar-eq'));
        const arRoots = TS.polyRoots(TS.arPoly(phiT)), maRoots = TS.polyRoots(TS.maPoly(thT));
        let extra = '';
        if (phiT.length === 2 && phi[0] ** 2 + 4 * phi[1] < 0 && stat) {
          const T = (2 * Math.PI) / Math.acos(phi[0] / (2 * Math.sqrt(-phi[1])));
          extra = ` · racines complexes : pseudo-période ≈ <strong>${f2(T, 1)}</strong>`;
        }
        let g0 = '—';
        if (stat) { const psi = TS.psiWeights(TS.arPoly(phiT), TS.maPoly(thT), 3000); g0 = f2(psi.reduce((s, v) => s + v * v, 0), 3); }
        el.querySelector('#ar-props').innerHTML = `<p>${stat ? pill('good', 'causal / stationnaire') : pill('bad', 'non stationnaire')} ${inv ? pill('good', 'inversible') : pill('warn', 'non inversible')}
          <span class="small"> · modules des racines AR : ${arRoots.length ? arRoots.map((z) => f2(TS.modulus(z), 3)).join(', ') : '—'} · MA : ${maRoots.length ? maRoots.map((z) => f2(TS.modulus(z), 3)).join(', ') : '—'} · γ(0) théorique = ${g0}${extra}</span></p>`;

        const x = TS.simulateArma({ phi: phiT, theta: thT, n: stat ? n : Math.min(n, 120), seed: int('ar-seed'), burn: stat ? 300 : 0 });
        const xs = x.map((_, i) => i);
        plot(el.querySelector('#ar-c1'), { title: stat ? `Trajectoire simulée (n = ${n})` : 'Trajectoire (explosive : 120 premiers points, sans préchauffage)', height: 230,
          xLabel: (i) => String(Math.round(i) + 1), layers: [{ type: 'line', x: xs, y: x, name: 'X_t', color: '--s1', width: 1.4 }, { type: 'hline', value: 0 }] });

        const L = 25, lags = Array.from({ length: L }, (_, i) => i + 1);
        const re = TS.acf(x, L).slice(1), pe = TS.pacf(x, L).slice(1), band = 1.96 / Math.sqrt(x.length);
        const rt = stat ? TS.armaAcf(phiT, thT, L).slice(1) : null, pt = stat ? TS.armaPacf(phiT, thT, L).slice(1) : null;
        const mk = (emp, th, title) => ({ title, height: 220, yMin: -1, yMax: 1, xLabel: (v) => String(Math.round(v)),
          layers: [{ type: 'hline', value: band }, { type: 'hline', value: -band }, { type: 'hline', value: 0, dash: false },
            { type: 'stem', x: lags, y: emp, name: 'empirique', color: '--s1' },
            th ? { type: 'points', x: lags, y: th, name: 'théorique', color: '--s2', r: 3.5 } : null] });
        plot(el.querySelector('#ar-c2'), mk(re, rt, 'ACF'));
        plot(el.querySelector('#ar-c3'), mk(pe, pt, 'PACF'));

        complexPlane(el.querySelector('#ar-c4'), { title: 'Racines de φ(z) et θ(z)', height: 230,
          groups: [{ name: 'φ(z)', roots: arRoots, color: '--s1' }, { name: 'θ(z)', roots: maRoots, color: '--s2' }] });
        const par = Array.from({ length: 81 }, (_, i) => -2 + i * 0.05);
        plot(el.querySelector('#ar-c5'), { title: 'Triangle de stationnarité AR(2)', height: 230, xMin: -2.1, xMax: 2.1, yMin: -1.1, yMax: 1.1,
          xLabel: (v) => f2(v, 1), xAxisTitle: 'φ₁ (ordonnée : φ₂)',
          layers: [
            { type: 'line', x: [-2, 0, 2, -2], y: [-1, 1, -1, -1], color: '--ink-3', width: 1.5 },
            { type: 'line', x: par, y: par.map((a) => -(a * a) / 4), color: '--s3', dash: true, width: 1.5, name: 'φ₁² + 4φ₂ = 0' },
            { type: 'points', x: [phi[0]], y: [phi[1]], name: 'φ₂ (point actuel)', color: stat ? '--s1' : '--s4', r: 6 },
          ], legend: false });
        const psi = TS.psiWeights(TS.arPoly(phiT), TS.maPoly(thT), 21);
        plot(el.querySelector('#ar-c6'), { title: 'Poids ψⱼ (réponse à un choc)', height: 230, xLabel: (v) => String(Math.round(v)),
          layers: [{ type: 'hline', value: 0, dash: false }, { type: 'stem', x: psi.map((_, j) => j), y: psi, name: 'ψⱼ', color: '--s5' }] });
      };
      bind(panel, draw, { debounce: 25 });
      draw();
    },
  });

  // ================================================================ 5. Lissage exponentiel
  const ETS_METHODS = {
    ses: { label: 'Lissage simple (SES)', trend: 'none', season: 'none' },
    holt: { label: 'Holt (tendance linéaire)', trend: 'add', season: 'none' },
    damped: { label: 'Holt amorti', trend: 'damped', season: 'none' },
    hwa: { label: 'Holt-Winters additif', trend: 'add', season: 'add' },
    hwm: { label: 'Holt-Winters multiplicatif', trend: 'add', season: 'mul' },
  };

  CH.push({
    id: 'lissage', title: 'Lissage exponentiel', short: 'Lissage exponentiel',
    desc: 'SES, Holt, amortissement, Holt-Winters, forme ETS et intervalles de prévision.',
    render(el) {
      el.innerHTML = R`
      <header class="ch-head">
        <div class="eyebrow">Chapitre 5 · Modèles de prévision</div>
        <h1>Lissage exponentiel : de la moyenne pondérée à Holt-Winters</h1>
        <p class="lede">Des moyennes pondérées dont les poids décroissent géométriquement dans le passé. Simples, robustes et difficiles à battre en pratique : ce sont les références à dépasser.</p>
      </header>

      ${block('Lissage simple', R`<div class="grid-2">
        ${formula('Forme récursive et forme pondérée', R`\[\ell_t = \alpha\,y_t + (1-\alpha)\,\ell_{t-1},\qquad \hat y_{t+h|t} = \ell_t\]
          \[\hat y_{t+1|t} = \sum_{j=0}^{t-1}\alpha(1-\alpha)^j\,y_{t-j} + (1-\alpha)^t\ell_0\]`)}
        ${formula('Forme à correction d’erreur', R`\[e_t = y_t - \hat y_{t|t-1},\qquad \ell_t = \ell_{t-1} + \alpha\,e_t\]
          <p class="small">α proche de 1 : forte réactivité, mémoire courte. α proche de 0 : lissage fort. Le SES est l’ARIMA(0,1,1) avec \(\theta = \alpha - 1\).</p>`)}
      </div>`)}

      ${block('Tendance et saison', R`<div class="grid-2">
        ${formula('Holt (amorti si φ < 1)', R`\[\begin{aligned}\hat y_{t+h|t} &= \ell_t + (\phi + \phi^2 + \dots + \phi^h)\,b_t\\ \ell_t &= \alpha y_t + (1-\alpha)(\ell_{t-1} + \phi b_{t-1})\\ b_t &= \beta^*(\ell_t - \ell_{t-1}) + (1-\beta^*)\phi\,b_{t-1}\end{aligned}\]
          <p class="small muted">L’amortissement (Gardner & McKenzie, 1985) fait converger la prévision vers un plateau. Il améliore souvent la précision à long horizon.</p>`)}
        ${formula('Holt-Winters additif', R`\[\begin{aligned}\hat y_{t+h|t} &= \ell_t + h\,b_t + s_{t+h-m(k+1)}\\ \ell_t &= \alpha(y_t - s_{t-m}) + (1-\alpha)(\ell_{t-1}+b_{t-1})\\ b_t &= \beta^*(\ell_t-\ell_{t-1}) + (1-\beta^*)b_{t-1}\\ s_t &= \gamma(y_t - \ell_{t-1} - b_{t-1}) + (1-\gamma)s_{t-m}\end{aligned}\]
          <p class="small muted">Version multiplicative : on remplace les soustractions de la saison par des divisions et l’addition par une multiplication. Contrainte : \(0 \le \gamma \le 1-\alpha\).</p>`)}
      </div>
      <div class="prose"><p><strong>Cadre ETS (Error, Trend, Seasonal).</strong> Hyndman et al. (2002) réécrivent ces méthodes comme des modèles espace-état à une seule source d’erreur. Par exemple ETS(A,A,A) : \(y_t = \ell_{t-1} + b_{t-1} + s_{t-m} + \varepsilon_t\), \(\ell_t = \ell_{t-1} + b_{t-1} + \alpha\varepsilon_t\), \(b_t = b_{t-1} + \beta\varepsilon_t\), \(s_t = s_{t-m} + \gamma\varepsilon_t\) avec \(\beta = \alpha\beta^*\). Ce cadre donne une vraisemblance (donc l’AIC) et des variances de prévision exactes :</p></div>
      ${formula('', R`\[\operatorname{Var}(y_{t+h} - \hat y_{t+h|t}) = \sigma^2\Big[1 + \sum_{j=1}^{h-1} c_j^2\Big],\qquad c_j = \alpha + \beta\,(\phi + \dots + \phi^j) + \gamma\,\mathbb 1\{j \equiv 0 \bmod m\}\]
        <p class="small muted">Exact pour les modèles à erreur et saison additives ; pour la saison multiplicative, l’atelier utilise cette formule mise à l’échelle, une approximation (statsmodels simule).</p>`)}`)}

      ${block('Pratique : ajuster et prévoir', R`<div class="panel" id="es-panel">
        <div class="controls">
          ${ctl.series('es-ds', 'air')}
          ${ctl.select('es-m', 'Méthode', Object.entries(ETS_METHODS).map(([k, v]) => [k, v.label]), 'hwm')}
          ${ctl.slider('es-h', 'Horizon h', 1, 60, 1, 24)}
          ${ctl.check('es-manual', 'Réglage manuel des paramètres', false)}
        </div>
        <div class="controls" id="es-sliders" hidden>
          ${ctl.slider('es-a', 'α', 0.01, 1, 0.01, 0.3)}
          ${ctl.slider('es-b', 'β*', 0.01, 1, 0.01, 0.1)}
          ${ctl.slider('es-g', 'γ', 0.01, 1, 0.01, 0.1)}
          ${ctl.slider('es-phi', 'φ', 0.8, 1, 0.01, 0.95)}
        </div>
        <div id="es-msg"></div>
        <div id="es-stats"></div>
        <div id="es-c1"></div>
        <div class="grid-2"><div id="es-c2"></div><div id="es-c3"></div></div>
        <div id="es-c4"></div>
      </div>`)}

      ${block('En Python', pyCode(
`from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.exponential_smoothing.ets import ETSModel

# Méthode de Holt-Winters (paramètres estimés en minimisant la SSE)
hw = ExponentialSmoothing(y, trend="add", seasonal="mul", seasonal_periods=12,
                          damped_trend=False, initialization_method="estimated").fit()
print(hw.params_formatted)
fc = hw.forecast(24)

# Modèle ETS : vraisemblance, AIC et intervalles de prévision
ets = ETSModel(y, error="add", trend="add", seasonal="mul", seasonal_periods=12).fit(disp=False)
pred = ets.get_prediction(start=len(y), end=len(y) + 23)
print(pred.summary_frame(alpha=0.05))      # mean, pi_lower, pi_upper`))}

      ${block('Vérifier', quiz([
        { q: 'Avec α = 0,2, quel poids reçoit l’observation d’il y a 3 périodes dans la prévision SES ?', opts: ['0,2', '0,2 × 0,8³ ≈ 0,102', '0,8³ ≈ 0,512'], a: 1, expl: 'Le poids de y_{t−j} est α(1−α)^j. Pour j = 3 : 0,2 × 0,512 = 0,1024.' },
        { q: 'À quel modèle ARIMA le lissage exponentiel simple est-il équivalent ?', opts: ['AR(1)', 'ARIMA(0,1,1)', 'ARIMA(1,1,0)'], a: 1, expl: 'y_t − y_{t−1} = ε_t − (1−α)ε_{t−1} : un ARIMA(0,1,1) avec θ = α − 1.' },
        { q: 'Pourquoi préférer souvent une tendance amortie ?', opts: ['Elle réduit la variance d’estimation de α', 'Extrapoler indéfiniment une tendance linéaire surestime souvent le long terme', 'Elle supprime la saisonnalité'], a: 1, expl: 'Les tendances réelles s’essoufflent. Dans les compétitions M, la tendance amortie est l’une des méthodes les plus robustes.' },
      ]))}
      `;

      const panel = el.querySelector('#es-panel');
      const draw = () => {
        const ds = getDataset(val('es-ds'));
        const key = val('es-m'), M = ETS_METHODS[key];
        const manual = val('es-manual');
        el.querySelector('#es-sliders').hidden = !manual;
        const msg = el.querySelector('#es-msg');
        msg.innerHTML = '';
        if (M.season !== 'none' && !(ds.period > 1 && ds.values.length >= 2 * ds.period + 2)) {
          msg.innerHTML = '<div class="callout warn"><p>Cette série n’a pas de période saisonnière exploitable : choisissez une méthode sans saison.</p></div>'; return;
        }
        if (M.season === 'mul' && ds.values.some((v) => v <= 0)) { msg.innerHTML = '<div class="callout warn"><p>La saison multiplicative exige des valeurs strictement positives.</p></div>'; return; }
        const m = ds.period;
        ['es-b', 'es-g', 'es-phi'].forEach((id, i) => {
          const need = [M.trend !== 'none', M.season !== 'none', M.trend === 'damped'][i];
          el.querySelector('#' + id).closest('.ctl').style.display = need ? '' : 'none';
        });
        let model;
        if (manual) {
          const a = num('es-a');
          model = TS.etsModel(ds.values, { trend: M.trend, season: M.season, m, alpha: a, beta: num('es-b'), gamma: Math.min(num('es-g'), 1 - a), phi: num('es-phi') });
        } else {
          model = TS.etsFit(ds.values, { trend: M.trend, season: M.season, m });
          const pr = model.params;
          const setS = (id, v) => { const i = el.querySelector('#' + id); i.value = v.toFixed(2); el.querySelector('#' + id + '-out').textContent = i.value; };
          setS('es-a', pr.alpha); if (M.trend !== 'none') setS('es-b', pr.beta); if (M.season !== 'none') setS('es-g', Math.max(0.01, pr.gamma)); if (M.trend === 'damped') setS('es-phi', pr.phi);
        }
        const h = int('es-h'), n = ds.values.length;
        const iv = model.intervals(h);
        const p = model.params;
        el.querySelector('#es-stats').innerHTML = stats([
          ['α', f2(p.alpha, 3)], ...(M.trend !== 'none' ? [['β*', f2(p.beta, 3)]] : []), ...(M.season !== 'none' ? [['γ', f2(p.gamma, 3)]] : []),
          ...(M.trend === 'damped' ? [['φ', f2(p.phi, 3)]] : []),
          ['RMSE (1 pas, in-sample)', f2(Math.sqrt(model.sse / n), 2)], ['AIC', f2(model.aic, 1)],
        ]) + (manual ? '<p class="small muted">Réglage manuel : comparez la RMSE à celle des paramètres optimisés (décochez la case).</p>' : '<p class="small muted">Paramètres estimés par minimisation de la somme des carrés des erreurs à un pas (Nelder-Mead). États initiaux : moyennes de la première et de la deuxième saison, comme la méthode classique.</p>');
        const ax = timeAxis(ds, h);
        const xs = ds.values.map((_, i) => i), xf = Array.from({ length: h }, (_, k) => n + k);
        plot(el.querySelector('#es-c1'), { title: `${M.label} : ajustement et prévision à ${h} pas (IC 95 %)`, height: 300, xLabel: ax.label, xTicks: ax.ticks,
          layers: [
            { type: 'shade', from: n - 0.5, to: n + h, label: 'prévision' },
            { type: 'band', x: [n - 1, ...xf], lo: [ds.values[n - 1], ...iv.lo], hi: [ds.values[n - 1], ...iv.hi], name: 'IC 95 %', color: '--s2', of: 'Prévision' },
            { type: 'line', x: xs, y: ds.values, name: 'Observé', color: '--s1', width: 1.6 },
            { type: 'line', x: xs, y: model.fitted, name: 'Ajusté (1 pas)', color: '--s3', dash: true, width: 1.5 },
            { type: 'line', x: [n - 1, ...xf], y: [ds.values[n - 1], ...iv.mean], name: 'Prévision', color: '--s2' },
          ] });
        plot(el.querySelector('#es-c2'), { title: 'Niveau ℓₜ' + (M.trend !== 'none' ? ' et pente bₜ (échelle propre ci-dessous)' : ''), height: 200, xLabel: ax.label, xTicks: ax.ticks,
          layers: [{ type: 'line', x: xs, y: model.level, name: 'ℓₜ', color: '--s1' }] });
        if (M.season !== 'none') {
          plot(el.querySelector('#es-c3'), { title: 'Saison sₜ (évolue au rythme γ)', height: 200, xLabel: ax.label, xTicks: ax.ticks,
            layers: [{ type: 'line', x: xs, y: model.seasonal, name: 'sₜ', color: '--s3', width: 1.4 }, { type: 'hline', value: M.season === 'mul' ? 1 : 0 }] });
        } else if (M.trend !== 'none') {
          plot(el.querySelector('#es-c3'), { title: 'Pente bₜ', height: 200, xLabel: ax.label, xTicks: ax.ticks,
            layers: [{ type: 'line', x: xs, y: model.slope, name: 'bₜ', color: '--s5' }, { type: 'hline', value: 0 }] });
        } else el.querySelector('#es-c3').innerHTML = '';
        const J = 30, w = Array.from({ length: J }, (_, j) => p.alpha * Math.pow(1 - p.alpha, j));
        plot(el.querySelector('#es-c4'), { title: `Poids de y₍t−j₎ dans le niveau : α(1−α)ʲ, α = ${f2(p.alpha, 2)} · demi-vie ≈ ${f2(Math.log(0.5) / Math.log(1 - p.alpha), 1)} périodes`, height: 180,
          xLabel: (v) => 'j = ' + Math.round(v), layers: [{ type: 'bar', x: w.map((_, j) => j), y: w, name: 'poids', color: '--s1' }] });
      };
      bind(panel, draw, { debounce: 60 });
      draw();
    },
  });

  // ================================================================ 6. SARIMA / Box-Jenkins
  function sarimaEquationTex(fit) {
    const o = fit.order;
    const ar = polyTex(fit.phi.map((v) => -v)), sar = polyTex(fit.Phi.map((v) => -v), o.s);
    const ma = polyTex(fit.theta), sma = polyTex(fit.Theta, o.s);
    const df = (o.d ? `(1 - B)${o.d > 1 ? `^{${o.d}}` : ''}` : '') + (o.D ? `(1 - B^{${o.s}})${o.D > 1 ? `^{${o.D}}` : ''}` : '');
    const yv = fit.lambda === null ? 'X_t' : Math.abs(fit.lambda) < 1e-12 ? '\\log X_t' : `X_t^{(${texNum(fit.lambda, 2)})}`;
    const lhs = `${ar}${sar}${df}${fit.withMean ? `(${yv} - ${fit.mu < 0 ? '(-' + texNum(fit.mu, 4) + ')' : texNum(fit.mu, 4)})` : yv}`;
    return `\\[${lhs} = ${ma}${sma}\\varepsilon_t,\\qquad \\hat\\sigma^2 = ${texNum(fit.sigma2, 6)}\\]`;
  }

  function sarimaPython(ds, o, lambda, h) {
    const tr = lambda === null ? 'y' : Math.abs(lambda) < 1e-12 ? 'np.log(y)' : `boxcox(y, lmbda=${lambda})`;
    const back = lambda === null ? 'fc' : Math.abs(lambda) < 1e-12 ? 'np.exp(fc)' : `inv_boxcox(fc, ${lambda})`;
    return `from statsmodels.tsa.statespace.sarimax import SARIMAX
from statsmodels.stats.diagnostic import acorr_ljungbox${lambda !== null && Math.abs(lambda) > 1e-12 ? '\nfrom scipy.stats import boxcox\nfrom scipy.special import inv_boxcox' : ''}

z = ${tr}
mod = SARIMAX(z, order=(${o.p}, ${o.d}, ${o.q}), seasonal_order=(${o.P}, ${o.D}, ${o.Q}, ${o.s > 1 ? o.s : 0}),
              trend="${o.d + o.D === 0 ? 'c' : 'n'}")
res = mod.fit(disp=False)          # maximum de vraisemblance exact (filtre de Kalman)
print(res.summary())               # coefficients, erreurs-types, AIC, Ljung-Box, Jarque-Bera
res.plot_diagnostics(figsize=(11, 7))

print(acorr_ljungbox(res.resid[${o.d + o.D * o.s}:], lags=[${o.s > 1 ? `${o.s}, ${2 * o.s}` : '10, 20'}], model_df=${o.p + o.q + o.P + o.Q}))

pred = res.get_forecast(steps=${h})
fc = pred.summary_frame(alpha=0.05)    # mean, mean_ci_lower, mean_ci_upper
fc = ${back}                            # retour à l'échelle d'origine (médiane)
# Recherche automatique d'ordres : pmdarima.auto_arima ou statsforecast.AutoARIMA`;
  }

  CH.push({
    id: 'sarima', title: 'Box-Jenkins et SARIMA', short: 'Box-Jenkins & SARIMA',
    desc: 'Identification, estimation CSS, diagnostic des résidus, prévision par poids ψ.',
    render(el) {
      el.innerHTML = R`
      <header class="ch-head">
        <div class="eyebrow">Chapitre 6 · La méthode complète</div>
        <h1>La méthodologie Box-Jenkins et les modèles SARIMA</h1>
        <p class="lede">Identifier, estimer, diagnostiquer, prévoir. On itère jusqu’à obtenir des résidus indiscernables d’un bruit blanc avec le modèle le plus parcimonieux possible.</p>
      </header>

      ${block('Le modèle', R`<div class="prose"><p>Un processus \(X_t\) suit un <strong>ARIMA(p, d, q)</strong> si \(\Delta^d X_t\) est un ARMA(p, q) stationnaire. La version saisonnière multiplicative <strong>SARIMA(p,d,q)(P,D,Q)<sub>s</sub></strong> s’écrit :</p></div>
        ${formula('', R`\[\underbrace{\phi(B)}_{\text{AR}}\;\underbrace{\Phi(B^s)}_{\text{AR saisonnier}}\;(1-B)^d(1-B^s)^D\,X_t = \underbrace{\theta(B)}_{\text{MA}}\;\underbrace{\Theta(B^s)}_{\text{MA saisonnier}}\,\varepsilon_t\]
        <p class="small">Le produit des polynômes crée des termes croisés : le modèle <em>airline</em> \((0,1,1)(0,1,1)_{12}\) donne \(\varepsilon_t + \theta\varepsilon_{t-1} + \Theta\varepsilon_{t-12} + \theta\Theta\varepsilon_{t-13}\) avec seulement 2 paramètres. D’où un pic de l’ACF aux retards 1, 11, 12 et 13 sur la série différenciée.</p>`)}`)}

      ${block('Les quatre étapes', R`<div class="grid-2">
        <div class="formula"><div class="ftitle">1 · Identification</div><p class="small">Box-Cox si la variance croît avec le niveau. Choisir d et D (tests du chapitre 2). Lire l’ACF et la PACF de \(W_t\) : retards non saisonniers → p, q ; retards s, 2s → P, Q. Proposer quelques candidats.</p></div>
        <div class="formula"><div class="ftitle">2 · Estimation</div><p class="small">L’atelier minimise la somme des carrés conditionnelle (CSS) :
          \[S(\beta) = \sum_{t>p^*} e_t^2,\quad e_t = \frac{\phi(B)\Phi(B^s)}{\theta(B)\Theta(B^s)}(W_t - \mu)\]
          calculée récursivement avec \(e_t = 0\) avant le début. La vraisemblance est concentrée en σ² : \(\ell = -\tfrac{n}{2}\log(S/n) + \text{cste}\). statsmodels et R utilisent par défaut la vraisemblance exacte (filtre de Kalman) : les estimations diffèrent légèrement en petit échantillon.</p></div>
        <div class="formula"><div class="ftitle">Contraintes par reparamétrisation</div><p class="small">Chaque polynôme est paramétré par ses autocorrélations partielles \(r_k = \tanh(u_k)\in(-1,1)\), converties en coefficients par Durbin-Levinson (Jones, 1980). Tout \(u\in\mathbb R^p\) donne un polynôme stationnaire : l’optimiseur (Nelder-Mead) travaille sans contrainte. Les erreurs-types viennent du hessien numérique de \(-\ell\) dans l’espace des coefficients.</p></div>
        <div class="formula"><div class="ftitle">3 · Diagnostic et sélection</div><p class="small">Résidus : pas d’autocorrélation (Ljung-Box avec \(p+q+P+Q\) degrés retirés), variance stable, normalité (Jarque-Bera) pour que les intervalles soient justes. Entre candidats <em>de même d et D</em> :
          \[\begin{aligned}\text{AIC} &= -2\ell + 2k\\ \text{AICc} &= \text{AIC} + \tfrac{2k(k+1)}{n-k-1}\\ \text{BIC} &= -2\ell + k\log n\end{aligned}\]</p></div>
      </div>
      <div class="formula"><div class="ftitle">4 · Prévision</div>
        \[\hat X_{n+h|n}\ \text{: récursion du modèle avec } \varepsilon_{n+j} = 0,\qquad \operatorname{Var}(e_{n+h|n}) = \sigma^2\sum_{j=0}^{h-1}\psi_j^2\]
        <p class="small">Les \(\psi_j\) sont ceux du polynôme AR complet, différences incluses : \(\psi(B) = \theta(B)\Theta(B^s) / [\phi(B)\Phi(B^s)(1-B)^d(1-B^s)^D]\). Pour un modèle intégré, \(\sum\psi_j^2\) diverge et l’intervalle s’élargit sans limite. Après une transformation de Box-Cox, \(\text{BC}^{-1}(\hat y)\) estime la <em>médiane</em> de \(X_{n+h}\), pas sa moyenne ; les bornes de l’intervalle, elles, se transforment exactement.</p></div>`)}

      ${block('Pratique : estimer un SARIMA', R`<div class="panel" id="sa-panel">
        <div class="controls">
          ${ctl.series('sa-ds', 'air')}
          <span id="sa-lam-wrap"></span>
          ${ctl.slider('sa-h', 'Horizon h', 1, 60, 1, 24)}
        </div>
        <div class="orders">
          <div class="grp"><span class="grp-title">(p, d, q)</span>${ctl.number('sa-p', 'p', 0, 0, 3)}${ctl.number('sa-d', 'd', 1, 0, 2)}${ctl.number('sa-q', 'q', 1, 0, 3)}</div>
          <div class="grp"><span class="grp-title">(P, D, Q)ₛ</span>${ctl.number('sa-P', 'P', 0, 0, 2)}${ctl.number('sa-D', 'D', 1, 0, 1)}${ctl.number('sa-Q', 'Q', 1, 0, 2)}${ctl.number('sa-s', 's', 12, 1, 52)}</div>
          <button type="button" id="sa-fit">Estimer</button>
          <button type="button" id="sa-auto" class="ghost">Recherche automatique (AICc)</button>
        </div>
        <div id="sa-busy" class="busy"></div>
        <div id="sa-autores"></div>
        <div id="sa-out"></div>
      </div>`)}

      ${block('Code Python équivalent', '<div id="sa-py"></div>')}

      ${block('Vérifier', quiz([
        { q: 'On compare ARIMA(1,1,1) (AIC = −480) et ARIMA(2,0,1) (AIC = −530). Le second est-il meilleur ?', opts: ['Oui, l’AIC est plus faible', 'On ne peut pas conclure : les vraisemblances portent sur des séries différentes (d différent)', 'Oui, si ses résidus passent Ljung-Box'], a: 1, expl: 'Différencier change les données modélisées : les AIC ne sont comparables qu’à d et D égaux. Pour choisir d, on utilise des tests ou une validation hors échantillon.' },
        { q: 'Ljung-Box sur les résidus donne p = 0,002 au retard 24. Que faire ?', opts: ['Accepter le modèle : les coefficients sont significatifs', 'Enrichir le modèle : de l’autocorrélation reste inexploitée', 'Augmenter le nombre de retards du test jusqu’à ce que p > 0,05'], a: 1, expl: 'Des résidus autocorrélés signifient que de l’information prévisible reste dans les erreurs. Regardez à quels retards l’ACF des résidus dépasse les bandes.' },
        { q: 'Pourquoi l’intervalle de prévision d’un ARIMA avec d = 1 s’élargit-il indéfiniment ?', opts: ['À cause de l’incertitude sur les paramètres', 'Parce que les poids ψ du polynôme intégré ne tendent pas vers 0, donc Σψ² diverge', 'Parce que σ² augmente avec le temps'], a: 1, expl: 'Avec une racine unitaire, un choc a un effet permanent : ψ_j ne décroît pas vers 0 et la variance de l’erreur à h pas croît au moins linéairement en h.' },
      ]))}
      `;

      const lamWrap = el.querySelector('#sa-lam-wrap');
      const setDs = () => {
        const ds = getDataset(val('sa-ds'));
        lamWrap.innerHTML = ctl.select('sa-lam', 'Box-Cox', lambdaOptions(ds), ds.values.every((v) => v > 0) ? '0' : 'none');
        el.querySelector('#sa-s').value = ds.period > 1 ? ds.period : 1;
        if (!(ds.period > 1)) { el.querySelector('#sa-D').value = 0; el.querySelector('#sa-Q').value = 0; el.querySelector('#sa-P').value = 0; }
        else { el.querySelector('#sa-D').value = TS.nsdiffs(ds.values, ds.period); }
        const lam = parseLambda(val('sa-lam'), ds);
        let base = TS.boxcox(ds.values, lam);
        if (+val('sa-D') > 0) base = TS.diff(base, ds.period);
        el.querySelector('#sa-d').value = TS.ndiffs(base);
      };
      const orders = () => ({ p: int('sa-p'), d: int('sa-d'), q: int('sa-q'), P: int('sa-P'), D: int('sa-D'), Q: int('sa-Q'), s: int('sa-s') });

      const show = (fit, ds) => {
        const out = el.querySelector('#sa-out');
        const o = fit.order, h = int('sa-h'), n = ds.values.length;
        const fc = fit.forecast(h);
        const nPar = o.p + o.q + o.P + o.Q;
        const res = fit.resid;
        const lbLags = (o.s > 1 ? [o.s, 2 * o.s] : [10, 20]).filter((L) => L > nPar && L < res.length - 1);
        const lb = TS.ljungBox(res, lbLags, nPar), jb = TS.jarqueBera(res);
        const roots = [...(fit.phi.length ? TS.polyRoots(TS.arPoly(fit.phi)) : []), ...(fit.Phi.length ? TS.polyRoots(TS.arPoly(fit.Phi)) : [])];
        const mroots = [...(fit.theta.length ? TS.polyRoots(TS.maPoly(fit.theta)) : []), ...(fit.Theta.length ? TS.polyRoots(TS.maPoly(fit.Theta)) : [])];
        const nearUnit = mroots.some((z) => TS.modulus(z) < 1.02);
        out.innerHTML = `
          <h3>${TS.orderLabel(o)}${fit.lambda !== null ? ` sur ${Math.abs(fit.lambda) < 1e-12 ? 'log X' : `BoxCox(X, ${f2(fit.lambda, 2)})`}` : ''}</h3>
          <div class="eq-live" id="sa-eq">${sarimaEquationTex(fit)}</div>
          ${stats([['log-vraisemblance (CSS)', f2(fit.loglik, 2)], ['AIC', f2(fit.aic, 2)], ['AICc', f2(fit.aicc, 2)], ['BIC', f2(fit.bic, 2)], ['σ̂²', f2(fit.sigma2, 6)], ['n effectif', fit.nEff]])}
          ${fit.coefs.length ? table(['Coefficient', 'Estimation', 'Erreur-type', 'z', 'p-valeur', ''], fit.coefs.map((c) => [c.name, f2(c.value, 4), f2(c.se, 4), f2(c.z, 2), fp(c.pvalue),
            c.pvalue < 0.05 ? pill('good', 'significatif') : pill('warn', 'non significatif')]), { numCols: [1, 2, 3, 4] }) : '<p class="small muted">Aucun coefficient ARMA : modèle de pure différenciation.</p>'}
          ${nearUnit ? '<div class="callout warn"><p>Une racine MA est très proche du cercle unité : signe probable de sur-différenciation (essayez de réduire d ou D).</p></div>' : ''}
          <div id="sa-c1"></div>
          <h3>Diagnostic des résidus</h3>
          <div class="grid-2"><div id="sa-c2"></div><div id="sa-c3"></div></div>
          <div class="grid-2"><div id="sa-c4"></div><div id="sa-c5"></div></div>
          ${table(['Test', 'Statistique', 'ddl', 'p-valeur', 'Décision'], [
            ...lb.map((b) => [`Ljung-Box L = ${b.lag}`, f2(b.Q, 2), b.df, fp(b.pvalue), b.pvalue < 0.05 ? pill('bad', 'autocorrélation résiduelle') : pill('good', 'bruit blanc plausible')]),
            ['Jarque-Bera', f2(jb.JB, 2), 2, fp(jb.pvalue), jb.pvalue < 0.05 ? pill('warn', 'non normal') : pill('good', 'normalité plausible')],
          ], { numCols: [1, 2, 3] })}
          <p class="small muted">Asymétrie ${f2(jb.skew, 2)} · kurtosis ${f2(jb.kurtosis, 2)} (3 pour une loi normale). Racines AR : ${roots.length ? roots.map((z) => f2(TS.modulus(z), 2)).join(', ') : '—'} · racines MA : ${mroots.length ? mroots.map((z) => f2(TS.modulus(z), 2)).join(', ') : '—'} (modules, tous > 1 par construction).</p>`;
        typeset(out.querySelector('#sa-eq'));
        const ax = timeAxis(ds, h);
        const xs = ds.values.map((_, i) => i), xf = Array.from({ length: h }, (_, k) => n + k);
        plot(out.querySelector('#sa-c1'), { title: `Prévision à ${h} pas et intervalle à 95 %`, height: 300, xLabel: ax.label, xTicks: ax.ticks,
          layers: [
            { type: 'shade', from: n - 0.5, to: n + h, label: 'prévision' },
            { type: 'band', x: [n - 1, ...xf], lo: [ds.values[n - 1], ...fc.lo], hi: [ds.values[n - 1], ...fc.hi], name: 'IC 95 %', color: '--s2', of: 'Prévision' },
            { type: 'line', x: xs, y: ds.values, name: 'Observé', color: '--s1', width: 1.6 },
            { type: 'line', x: xs, y: fit.fitted, name: 'Ajusté (1 pas)', color: '--s3', dash: true, width: 1.4 },
            { type: 'line', x: [n - 1, ...xf], y: [ds.values[n - 1], ...fc.mean], name: 'Prévision', color: '--s2' },
          ] });
        const sd = Math.sqrt(fit.sigma2), off = n - res.length;
        plot(out.querySelector('#sa-c2'), { title: 'Résidus standardisés', height: 210, xLabel: ax.label, xTicks: ax.ticks,
          layers: [{ type: 'hline', value: 2, label: '±2' }, { type: 'hline', value: -2 }, { type: 'hline', value: 0, dash: false },
            { type: 'stem', x: res.map((_, i) => i + off), y: res.map((e) => e / sd), name: 'eₜ/σ̂', color: '--s1', colorFn: (v) => (Math.abs(v) > 2 ? '--s4' : '--ink-3') }] });
        const L = Math.min(o.s > 1 ? 3 * o.s : 30, res.length - 2), ra = TS.acf(res, L).slice(1), band = 1.96 / Math.sqrt(res.length);
        plot(out.querySelector('#sa-c3'), { title: 'ACF des résidus', height: 210, yMin: -0.5, yMax: 0.5, xLabel: (v) => String(Math.round(v)),
          layers: [{ type: 'hline', value: band }, { type: 'hline', value: -band }, { type: 'hline', value: 0, dash: false },
            { type: 'stem', x: ra.map((_, i) => i + 1), y: ra, name: 'ρ̂(h)', color: '--s1', colorFn: (v) => (Math.abs(v) > band ? '--s4' : '--s1') }] });
        const z = res.map((e) => e / sd), hg = histogram(z, Math.max(8, Math.round(Math.sqrt(z.length))));
        const grid = Array.from({ length: 61 }, (_, i) => -4 + (i * 8) / 60);
        plot(out.querySelector('#sa-c4'), { title: 'Distribution des résidus standardisés', height: 210, xMin: -4, xMax: 4, xLabel: (v) => f2(v, 1),
          layers: [{ type: 'bar', x: hg.centers, y: hg.dens, name: 'densité empirique', color: '--s1' },
            { type: 'line', x: grid, y: grid.map(TS.normPdf), name: 'N(0, 1)', color: '--s2' }] });
        plot(out.querySelector('#sa-c5'), { title: 'Poids ψⱼ du modèle complet (différences incluses)', height: 210, xLabel: (v) => String(Math.round(v)),
          layers: [{ type: 'hline', value: 0, dash: false }, { type: 'stem', x: fc.psi.map((_, j) => j), y: fc.psi, name: 'ψⱼ', color: '--s5' }] });
        const py = el.querySelector('#sa-py');
        py.innerHTML = pyCode(sarimaPython(ds, o, fit.lambda, h));
        wireCopy(py);
      };

      const fitNow = async () => {
        const ds = getDataset(val('sa-ds'));
        const busy = el.querySelector('#sa-busy');
        busy.textContent = 'Estimation…';
        await tick();
        try {
          const fit = TS.sarimaFit(ds.values, { ...orders(), lambda: parseLambda(val('sa-lam'), ds) });
          busy.textContent = '';
          show(fit, ds);
        } catch (err) { busy.textContent = err.message; }
      };

      el.querySelector('#sa-fit').addEventListener('click', fitNow);
      el.querySelector('#sa-auto').addEventListener('click', async (ev) => {
        const btn = ev.currentTarget, ds = getDataset(val('sa-ds')), o = orders();
        const lam = parseLambda(val('sa-lam'), ds);
        btn.disabled = true;
        const busy = el.querySelector('#sa-busy');
        busy.textContent = 'Recherche en cours…';
        await tick();
        const t0 = performance.now();
        const list = TS.autoSarima(ds.values, { d: o.d, D: o.D, s: o.s, lambda: lam });
        busy.textContent = `${list.length} modèles estimés en ${Math.round(performance.now() - t0)} ms, d = ${o.d} et D = ${o.D} fixés. Cliquez une ligne pour l’afficher.`;
        btn.disabled = false;
        const box = el.querySelector('#sa-autores');
        box.innerHTML = table(['Modèle', 'AICc', 'Δ AICc', 'BIC', 'k', 'σ̂²'], list.slice(0, 8).map((f) => [TS.orderLabel(f.order), f2(f.aicc, 2), f2(f.aicc - list[0].aicc, 2), f2(f.bic, 2), f.k, f2(f.sigma2, 6)]),
          { numCols: [1, 2, 3, 4, 5], rowClass: (_, i) => 'click' + (i === 0 ? ' best' : ''), rowAttr: (_, i) => `data-i="${i}"` });
        $$('tr[data-i]', box).forEach((tr) => tr.addEventListener('click', () => {
          const f = list[+tr.dataset.i];
          ['p', 'q', 'P', 'Q'].forEach((k) => { el.querySelector('#sa-' + k).value = f.order[k]; });
          show(f, ds);
        }));
        const best = list[0];
        ['p', 'q', 'P', 'Q'].forEach((k) => { el.querySelector('#sa-' + k).value = best.order[k]; });
        show(best, ds);
      });
      el.querySelector('#sa-ds').addEventListener('change', () => { setDs(); fitNow(); });
      lamWrap.addEventListener('change', fitNow);
      setDs();
      fitNow();
    },
  });
})(window);
