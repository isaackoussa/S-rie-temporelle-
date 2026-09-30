/*
 * Chapitre 10 : exercices appliqués, corrigés et expliqués.
 *  A. Identifier un processus ARMA à partir de l'ACF/PACF
 *  B. Diagnostiquer la stationnarité et choisir la transformation
 *  C. Calculs à la main (énoncés aléatoires, solution rédigée)
 *  D. Défi de prévision sur un échantillon caché
 */
(function (root) {
  'use strict';
  const { ctl, val, int, block, table, stats, pill, f2, fp, $, $$, timeAxis, esc, getDataset, STATE, tick, typeset } = root.UI;
  const { plot } = root.Charts;
  const CH = (root.CHAPTERS = root.CHAPTERS || []);
  const R = String.raw;

  const rnd = (a, b) => a + (b - a) * Math.random();
  const sgn = () => (Math.random() < 0.5 ? -1 : 1);
  const round2 = (v) => Math.round(v * 100) / 100;
  const tex = (v, d = 2) => (v < 0 ? '-' : '') + Math.abs(v).toFixed(d).replace('.', '{,}');
  const parseIn = (s) => parseFloat(String(s).replace(',', '.').replace(/\s/g, ''));

  function acfFig(el, x, L, title, pacf = false) {
    const r = (pacf ? TS.pacf(x, L) : TS.acf(x, L)).slice(1), band = 1.96 / Math.sqrt(x.length);
    plot(el, { title, height: 200, yMin: -1, yMax: 1, xLabel: (v) => String(Math.round(v)),
      layers: [{ type: 'hline', value: band }, { type: 'hline', value: -band }, { type: 'hline', value: 0, dash: false },
        { type: 'stem', x: r.map((_, i) => i + 1), y: r, name: pacf ? 'α̂(h)' : 'ρ̂(h)', color: '--s1', colorFn: (v) => (Math.abs(v) > band ? '--s1' : '--ink-3') }] });
  }

  const score = { A: [0, 0], B: [0, 0], C: [0, 0] };
  const scoreText = (k) => `${score[k][0]} / ${score[k][1]}`;

  // ================================================================ A. Identification
  const ID_TYPES = {
    ar1: { label: 'AR(1)', order: { p: 1, q: 0 }, gen: () => ({ phi: [round2(sgn() * rnd(0.55, 0.85))], theta: [] }),
      expl: 'ACF à décroissance géométrique (alternée si φ < 0), PACF avec un seul pic au retard 1.' },
    ar2: { label: 'AR(2)', order: { p: 2, q: 0 }, gen: () => { let phi; do { phi = [round2(rnd(0.3, 1.3)), round2(-rnd(0.25, 0.7))]; } while (!TS.isStationary(phi)); return { phi, theta: [] }; },
      expl: 'ACF amortie, souvent en oscillation (racines complexes si φ₁² + 4φ₂ < 0), PACF qui coupe après le retard 2.' },
    ma1: { label: 'MA(1)', order: { p: 0, q: 1 }, gen: () => ({ phi: [], theta: [round2(sgn() * rnd(0.55, 0.9))] }),
      expl: 'ACF avec un seul pic au retard 1 (|ρ(1)| ≤ 0,5), PACF amortie, alternée si θ > 0.' },
    ma2: { label: 'MA(2)', order: { p: 0, q: 2 }, gen: () => { let theta; do { theta = [round2(sgn() * rnd(0.3, 0.8)), round2(sgn() * rnd(0.4, 0.7))]; } while (!TS.isInvertible(theta)); return { phi: [], theta }; },
      expl: 'ACF qui coupe après le retard 2, PACF amortie.' },
    arma11: { label: 'ARMA(1,1)', order: { p: 1, q: 1 }, gen: () => { const phi = round2(sgn() * rnd(0.55, 0.85)); return { phi: [phi], theta: [round2(Math.sign(phi) * rnd(0.35, 0.7))] }; },
      expl: 'ACF et PACF décroissent toutes les deux sans coupure nette : aucune des deux ne s’annule brutalement.' },
  };

  function exA(el) {
    let cur = null;
    const box = el.querySelector('#exA');
    const newSeries = () => {
      const keys = Object.keys(ID_TYPES), key = keys[Math.floor(Math.random() * keys.length)];
      const par = ID_TYPES[key].gen(), seed = Math.floor(Math.random() * 1e9);
      const x = TS.simulateArma({ ...par, n: 400, seed });
      cur = { key, par, x, answered: false };
      box.innerHTML = `
        <div class="ex-score">Score : <strong id="exA-score">${scoreText('A')}</strong></div>
        <div id="exA-c1"></div>
        <div class="grid-2"><div id="exA-c2"></div><div id="exA-c3"></div></div>
        <p><strong>Quel processus a généré cette série ?</strong></p>
        <div class="controls ex-answers">${Object.entries(ID_TYPES).map(([k, t]) => `<button type="button" class="ghost" data-k="${k}">${t.label}</button>`).join('')}</div>
        <div id="exA-res"></div>
        <div class="controls"><button type="button" id="exA-new">Nouvelle série</button></div>`;
      plot(box.querySelector('#exA-c1'), { title: 'Série simulée (n = 400)', height: 190, xLabel: (i) => String(Math.round(i) + 1), layers: [{ type: 'line', x: x.map((_, i) => i), y: x, name: 'X_t', color: '--s1', width: 1.2 }, { type: 'hline', value: 0 }] });
      acfFig(box.querySelector('#exA-c2'), x, 20, 'ACF');
      acfFig(box.querySelector('#exA-c3'), x, 20, 'PACF', true);
      $$('.ex-answers button', box).forEach((b) => b.addEventListener('click', () => answer(b)));
      box.querySelector('#exA-new').addEventListener('click', newSeries);
    };
    const answer = (btn) => {
      if (cur.answered) return;
      cur.answered = true;
      const ok = btn.dataset.k === cur.key, T = ID_TYPES[cur.key];
      score.A[1]++; if (ok) score.A[0]++;
      $$('.ex-answers button', box).forEach((b) => { b.disabled = true; if (b.dataset.k === cur.key) b.classList.add('right'); else if (b === btn) b.classList.add('wrong'); });
      box.querySelector('#exA-score').textContent = scoreText('A');
      // Estimation de tous les candidats, classés par AICc
      const fits = Object.entries(ID_TYPES).map(([k, t]) => ({ k, t, f: TS.sarimaFit(cur.x, { ...t.order }) })).sort((a, b) => a.f.aicc - b.f.aicc);
      const truth = fits.find((f) => f.k === cur.key);
      const eqPhi = cur.par.phi.map((v, i) => `${v < 0 ? '-' : '+'} ${tex(Math.abs(v))}X_{t-${i + 1}}`).join(' ');
      const eqTh = cur.par.theta.map((v, i) => `${v < 0 ? '-' : '+'} ${tex(Math.abs(v))}\\varepsilon_{t-${i + 1}}`).join(' ');
      const est = truth.f.coefs.filter((c) => c.name !== 'mu').map((c) => `${c.name} = ${f2(c.value, 3)} (± ${f2(1.96 * c.se, 3)})`).join(', ');
      box.querySelector('#exA-res').innerHTML = `
        <div class="callout ${ok ? 'good' : 'bad'}"><p>${ok ? pill('good', 'Correct') : pill('bad', `Non : c’était un ${T.label}`)}</p>
        <p>Vrai processus : \\(X_t = ${eqPhi.replace(/^\+ /, '')} ${eqPhi ? '+' : ''} \\varepsilon_t ${eqTh}\\)</p>
        <p><strong>Ce qu’il fallait voir.</strong> ${T.expl}</p>
        <p>Estimation du vrai modèle sur la série : ${est}. Les vraies valeurs sont dans l’intervalle à 95 % dans la grande majorité des tirages.</p></div>
        <p class="small">Classement par AICc des cinq candidats estimés sur cette série (ce qu’une recherche automatique aurait choisi) :</p>
        ${table(['Modèle', 'AICc', 'Δ AICc', ''], fits.map((x) => [x.t.label, f2(x.f.aicc, 2), f2(x.f.aicc - fits[0].f.aicc, 2), x.k === cur.key ? pill('good', 'vrai') : '']), { numCols: [1, 2], rowClass: (_, i) => (i === 0 ? 'best' : '') })}
        <p class="small muted">Quand le vrai modèle n’est pas premier, c’est souvent qu’un modèle voisin l’approche aussi bien avec 400 points (Δ AICc < 2) : l’identification est une affaire de parcimonie, pas de vérité unique.</p>`;
      typeset(box.querySelector('#exA-res'));
    };
    newSeries();
  }

  // ================================================================ B. Stationnarité
  const ST_KINDS = {
    wn: { label: 'bruit blanc', answer: 'none', expl: 'Moyenne et variance constantes, ACF nulle : déjà stationnaire. Différencier créerait un MA(1) non inversible (θ = −1).' },
    ar: { label: 'AR(1) avec φ = 0,7', answer: 'none', expl: 'Stationnaire : la série revient vers sa moyenne, l’ACF décroît géométriquement. On la modélise directement par un ARMA.' },
    near: { label: 'AR(1) avec φ = 0,97', answer: 'none', expl: 'Techniquement stationnaire (|φ| < 1), mais les tests peinent à la distinguer d’une marche aléatoire sur 200 points. Différencier ne serait pas une erreur grave en pratique : c’est le cas limite classique où ADF manque de puissance.' },
    rw: { label: 'marche aléatoire', answer: 'diff', expl: 'Racine unitaire : ACF à décroissance très lente, ADF non rejeté, KPSS rejeté. La différence première donne un bruit blanc.' },
    rwd: { label: 'marche aléatoire avec dérive', answer: 'diff', expl: 'Tendance stochastique : la pente n’est pas fixe, les écarts à une droite ne se résorbent pas. Différencier donne un bruit blanc de moyenne égale à la dérive.' },
    trend: { label: 'tendance déterministe + bruit AR(0,5)', answer: 'detrend', expl: 'Les écarts à la droite sont stationnaires et reviennent vers 0 : on retire la tendance par régression sur t. Différencier fonctionnerait mais introduirait un MA non inversible.' },
  };
  const ACTIONS = { none: 'Aucune transformation : déjà stationnaire', diff: 'Différencier (d = 1)', detrend: 'Retirer une tendance linéaire' };

  function simulateKind(kind, n, seed) {
    const g = TS.gaussianRng(seed); let x = 0, u = 0;
    return Array.from({ length: n }, (_, t) => {
      const e = g();
      if (kind === 'wn') return e;
      if (kind === 'ar') return (x = 0.7 * x + e);
      if (kind === 'near') return (x = 0.97 * x + e);
      if (kind === 'rw') return (x += e);
      if (kind === 'rwd') return (x += 0.25 + e);
      u = 0.5 * u + e; return 0.08 * t + u;
    });
  }

  function exB(el) {
    const box = el.querySelector('#exB');
    let cur = null;
    const newSeries = () => {
      const keys = Object.keys(ST_KINDS), key = keys[Math.floor(Math.random() * keys.length)];
      const x = simulateKind(key, 200, Math.floor(Math.random() * 1e9));
      cur = { key, x, answered: false };
      box.innerHTML = `
        <div class="ex-score">Score : <strong id="exB-score">${scoreText('B')}</strong></div>
        <div class="grid-2"><div id="exB-c1"></div><div id="exB-c2"></div></div>
        <div class="controls"><button type="button" class="ghost" id="exB-tests">Afficher les tests ADF et KPSS (indice)</button></div>
        <div id="exB-t"></div>
        <p><strong>Quelle transformation appliquer avant de modéliser ?</strong></p>
        <div class="controls ex-answers">${Object.entries(ACTIONS).map(([k, t]) => `<button type="button" class="ghost" data-k="${k}">${t}</button>`).join('')}</div>
        <div id="exB-res"></div>
        <div class="controls"><button type="button" id="exB-new">Nouvelle série</button></div>`;
      plot(box.querySelector('#exB-c1'), { title: 'Série (n = 200)', height: 200, xLabel: (i) => String(Math.round(i) + 1), layers: [{ type: 'line', x: x.map((_, i) => i), y: x, name: 'X_t', color: '--s1', width: 1.3 }] });
      acfFig(box.querySelector('#exB-c2'), x, 25, 'ACF');
      box.querySelector('#exB-tests').addEventListener('click', (e) => {
        e.currentTarget.disabled = true;
        const rows = ['c', 'ct'].map((reg) => { const a = TS.adf(x, { regression: reg }), k = TS.kpss(x, { regression: reg }); return [reg === 'c' ? 'constante' : 'constante + tendance', f2(a.stat, 2), fp(a.pvalue), f2(k.stat, 3), (k.bound ? k.bound + ' ' : '') + fp(k.pvalue)]; });
        box.querySelector('#exB-t').innerHTML = table(['Régression', 'ADF', 'p (H0 : racine unitaire)', 'KPSS', 'p (H0 : stationnaire)'], rows, { numCols: [1, 2, 3, 4] });
      });
      $$('.ex-answers button', box).forEach((b) => b.addEventListener('click', () => answer(b)));
      box.querySelector('#exB-new').addEventListener('click', newSeries);
    };
    const answer = (btn) => {
      if (cur.answered) return;
      cur.answered = true;
      const K = ST_KINDS[cur.key], ok = btn.dataset.k === K.answer || (cur.key === 'near' && btn.dataset.k === 'diff');
      score.B[1]++; if (ok) score.B[0]++;
      $$('.ex-answers button', box).forEach((b) => { b.disabled = true; if (b.dataset.k === K.answer) b.classList.add('right'); else if (b === btn && !ok) b.classList.add('wrong'); });
      box.querySelector('#exB-score').textContent = scoreText('B');
      const x = cur.x;
      const tr = K.answer === 'diff' ? TS.diff(x) : K.answer === 'detrend' ? TS.ols(x.map((_, t) => [1, t]), x).resid : x;
      box.querySelector('#exB-res').innerHTML = `<div class="callout ${ok ? 'good' : 'bad'}"><p>${ok ? pill('good', cur.key === 'near' && btn.dataset.k === 'diff' ? 'Acceptable' : 'Correct') : pill('bad', 'Non')} Il s’agissait d’un(e) <strong>${K.label}</strong>.</p><p>${K.expl}</p></div><div id="exB-c3"></div>`;
      plot(box.querySelector('#exB-c3'), { title: `Après la bonne transformation : ${ACTIONS[K.answer]}`, height: 180, xLabel: (i) => String(Math.round(i) + 1),
        layers: [{ type: 'line', x: tr.map((_, i) => i), y: tr, name: 'série transformée', color: '--s3', width: 1.2 }, { type: 'hline', value: 0 }] });
    };
    newSeries();
  }

  // ================================================================ C. Calculs à la main
  const PROBLEMS = [
    () => {
      const phi = round2(sgn() * rnd(0.3, 0.9)), s2 = [1, 2, 4][Math.floor(Math.random() * 3)];
      const ans = s2 / (1 - phi * phi);
      return { title: 'Variance d’un AR(1)', q: R`\(X_t = ${tex(phi)}X_{t-1} + \varepsilon_t\) avec \(\sigma^2 = ${s2}\). Calculez \(\gamma(0) = \operatorname{Var}(X_t)\).`, ans,
        sol: R`En stationnarité, \(\operatorname{Var}(X_t) = \phi^2\operatorname{Var}(X_{t-1}) + \sigma^2\), donc \(\gamma(0) = \dfrac{\sigma^2}{1-\phi^2} = \dfrac{${s2}}{1 - ${tex(phi * phi, 4)}} = ${tex(ans, 4)}\).` };
    },
    () => {
      const th = round2(sgn() * rnd(0.2, 1.5)), ans = th / (1 + th * th);
      return { title: 'Autocorrélation d’un MA(1)', q: R`\(X_t = \varepsilon_t + ${tex(th)}\varepsilon_{t-1}\). Calculez \(\rho(1)\).`, ans,
        sol: R`\(\gamma(0) = (1+\theta^2)\sigma^2\) et \(\gamma(1) = \theta\sigma^2\), donc \(\rho(1) = \dfrac{\theta}{1+\theta^2} = \dfrac{${tex(th)}}{${tex(1 + th * th, 4)}} = ${tex(ans, 4)}\). ${Math.abs(th) > 1 ? R`Remarque : \(\theta\) et \(1/\theta = ${tex(1 / th, 4)}\) donnent le même \(\rho(1)\) ; seul \(|\theta| < 1\) est inversible.` : ''}` };
    },
    () => {
      const phi = round2(sgn() * rnd(0.4, 0.9)), h = 2 + Math.floor(Math.random() * 3), ans = Math.pow(phi, h);
      return { title: 'ACF d’un AR(1)', q: R`Pour \(X_t = ${tex(phi)}X_{t-1} + \varepsilon_t\), calculez \(\rho(${h})\).`, ans,
        sol: R`En multipliant par \(X_{t-h}\) et en prenant l’espérance : \(\gamma(h) = \phi\gamma(h-1)\), donc \(\rho(h) = \phi^h = (${tex(phi)})^{${h}} = ${tex(ans, 4)}\).` };
    },
    () => {
      const a = round2(rnd(0.1, 0.6)), l = Math.round(rnd(80, 120)), y = Math.round(l + rnd(-20, 20)), ans = a * y + (1 - a) * l;
      return { title: 'Une mise à jour de lissage exponentiel', q: R`Lissage simple avec \(\alpha = ${tex(a)}\). Le niveau vaut \(\ell_{t-1} = ${l}\) et on observe \(y_t = ${y}\). Quelle est la prévision \(\hat y_{t+1|t}\) ?`, ans,
        sol: R`\(\ell_t = \alpha y_t + (1-\alpha)\ell_{t-1} = ${tex(a)}\times ${y} + ${tex(1 - a)}\times ${l} = ${tex(ans, 3)}\). En SES la prévision à tout horizon est le niveau : \(\hat y_{t+1|t} = ${tex(ans, 3)}\). Forme équivalente : \(\ell_t = \ell_{t-1} + \alpha e_t\) avec \(e_t = ${y - l}\).` };
    },
    () => {
      const n = [80, 100, 120, 150][Math.floor(Math.random() * 4)];
      const r = [round2(rnd(-0.25, 0.25)), round2(rnd(-0.2, 0.2)), round2(rnd(-0.2, 0.2))];
      const ans = n * (n + 2) * r.reduce((s, v, k) => s + (v * v) / (n - k - 1), 0);
      return { title: 'Statistique de Ljung-Box', q: R`Sur \(n = ${n}\) résidus, \(\hat\rho(1) = ${tex(r[0])}\), \(\hat\rho(2) = ${tex(r[1])}\), \(\hat\rho(3) = ${tex(r[2])}\). Calculez \(Q(3)\). (Seuil \(\chi^2_3\) à 5 % : 7,815.)`, ans,
        sol: R`\(Q = n(n+2)\sum_{k=1}^{3}\dfrac{\hat\rho_k^2}{n-k} = ${n}\times${n + 2}\Big(\dfrac{${tex(r[0] ** 2, 4)}}{${n - 1}} + \dfrac{${tex(r[1] ** 2, 4)}}{${n - 2}} + \dfrac{${tex(r[2] ** 2, 4)}}{${n - 3}}\Big) = ${tex(ans, 3)}\). ${ans > 7.815 ? 'Q > 7,815 : on rejette l’hypothèse de bruit blanc à 5 %.' : 'Q < 7,815 : on ne rejette pas l’hypothèse de bruit blanc à 5 %.'}` };
    },
    () => {
      const l = Math.round(rnd(100, 300)), b = round2(rnd(0.5, 4)), phi = round2(rnd(0.8, 0.95)), h = 3 + Math.floor(Math.random() * 4);
      let cum = 0; for (let k = 1; k <= h; k++) cum += Math.pow(phi, k);
      const ans = l + cum * b;
      return { title: 'Prévision d’un Holt amorti', q: R`Niveau \(\ell_T = ${l}\), pente \(b_T = ${tex(b)}\), amortissement \(\phi = ${tex(phi)}\). Calculez \(\hat y_{T+${h}|T}\).`, ans,
        sol: R`\(\hat y_{T+h|T} = \ell_T + (\phi + \phi^2 + \dots + \phi^h)\,b_T\). Ici \(\sum_{k=1}^{${h}}\phi^k = \phi\dfrac{1-\phi^{${h}}}{1-\phi} = ${tex(cum, 4)}\), d’où \(${l} + ${tex(cum, 4)}\times${tex(b)} = ${tex(ans, 3)}\). Sans amortissement on aurait \(${l} + ${h}\times ${tex(b)} = ${tex(l + h * b, 2)}\).` };
    },
    () => {
      let p1, p2; p1 = round2(rnd(-1.5, 1.5)); p2 = round2(rnd(-0.9, 0.9));
      const st = TS.isStationary([p1, p2]);
      return { title: 'Stationnarité d’un AR(2)', choice: ['Stationnaire', 'Non stationnaire'], ans: st ? 0 : 1,
        q: R`\(X_t = ${tex(p1)}X_{t-1} ${p2 < 0 ? '-' : '+'} ${tex(Math.abs(p2))}X_{t-2} + \varepsilon_t\) est-il stationnaire ?`,
        sol: R`Conditions du triangle : \(\phi_2 < 1 - \phi_1\) (\(${tex(p2)} < ${tex(1 - p1)}\) : ${p2 < 1 - p1 ? 'oui' : 'non'}), \(\phi_2 < 1 + \phi_1\) (\(${tex(p2)} < ${tex(1 + p1)}\) : ${p2 < 1 + p1 ? 'oui' : 'non'}), \(|\phi_2| < 1\) (oui). ${st ? 'Les trois sont vérifiées : stationnaire.' : 'Une condition échoue : non stationnaire.'} Modules des racines de \(\phi(z)\) : ${TS.polyRoots(TS.arPoly([p1, p2])).map((z) => tex(TS.modulus(z), 3)).join(' ; ')}.` };
    },
  ];

  function exC(el) {
    const box = el.querySelector('#exC');
    const next = (idx = null) => {
      const i = idx === null ? Math.floor(Math.random() * PROBLEMS.length) : idx;
      const P = PROBLEMS[i]();
      box.innerHTML = `
        <div class="ex-score">Score : <strong id="exC-score">${scoreText('C')}</strong></div>
        <div class="controls">${ctl.select('exC-type', 'Type d’exercice', [['rand', 'au hasard'], ...PROBLEMS.map((f, k) => [k, f().title])], idx === null ? 'rand' : idx)}</div>
        <h3>${P.title}</h3>
        <p class="ex-q">${P.q}</p>
        ${P.choice ? `<div class="controls ex-answers">${P.choice.map((c, k) => `<button type="button" class="ghost" data-k="${k}">${c}</button>`).join('')}</div>`
          : `<div class="controls"><label class="ctl" for="exC-in"><span>Votre réponse</span><input type="text" id="exC-in" inputmode="decimal" autocomplete="off" placeholder="ex. 1,56"></label><button type="button" id="exC-check">Vérifier</button></div>`}
        <div id="exC-res"></div>
        <div class="controls"><button type="button" class="ghost" id="exC-sol">Voir la solution</button><button type="button" id="exC-next">Nouvel énoncé</button></div>`;
      let done = false;
      const reveal = (ok, given) => {
        if (!done) { score.C[1]++; if (ok) score.C[0]++; done = true; box.querySelector('#exC-score').textContent = scoreText('C'); }
        box.querySelector('#exC-res').innerHTML = `<div class="callout ${ok === null ? '' : ok ? 'good' : 'bad'}">${ok === null ? '' : `<p>${ok ? pill('good', 'Juste') : pill('bad', 'Pas tout à fait')}${given !== undefined && !P.choice ? ` Votre réponse : ${esc(given)} · attendu : ${f2(P.ans, 4)}` : ''}</p>`}<p><strong>Solution.</strong> ${P.sol}</p></div>`;
        typeset(box.querySelector('#exC-res'));
      };
      if (P.choice) $$('.ex-answers button', box).forEach((b) => b.addEventListener('click', () => {
        $$('.ex-answers button', box).forEach((x) => { x.disabled = true; if (+x.dataset.k === P.ans) x.classList.add('right'); else if (x === b) x.classList.add('wrong'); });
        reveal(+b.dataset.k === P.ans);
      }));
      else {
        const check = () => {
          const v = parseIn(box.querySelector('#exC-in').value);
          if (!isFinite(v)) { box.querySelector('#exC-res').innerHTML = '<p class="small">Entrez un nombre (la virgule est acceptée).</p>'; return; }
          reveal(Math.abs(v - P.ans) <= Math.max(0.01 * Math.abs(P.ans), 0.006), box.querySelector('#exC-in').value);
        };
        box.querySelector('#exC-check').addEventListener('click', check);
        box.querySelector('#exC-in').addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });
      }
      box.querySelector('#exC-sol').addEventListener('click', () => {
        if (!done) { score.C[1]++; done = true; box.querySelector('#exC-score').textContent = scoreText('C'); }
        reveal(null);
      });
      const sel = () => (val('exC-type') === 'rand' ? null : int('exC-type'));
      box.querySelector('#exC-next').addEventListener('click', () => next(sel()));
      box.querySelector('#exC-type').addEventListener('change', () => next(sel()));
      typeset(box);
    };
    next();
  }

  // ================================================================ D. Défi de prévision
  const METHODS = {
    naive: 'Naïf', snaive: 'Naïf saisonnier', drift: 'Dérive', ses: 'Lissage simple', holt: 'Holt', damped: 'Holt amorti',
    hwa: 'Holt-Winters additif', hwm: 'Holt-Winters multiplicatif', sarima: 'SARIMA (ordres au choix)',
  };

  function exD(el) {
    const box = el.querySelector('#exD');
    const attempts = [];
    const refCache = {};
    box.innerHTML = `
      <div class="controls">
        ${ctl.select('exD-ds', 'Série', STATE.datasets.filter((d) => d.values.length >= 60).map((d) => [d.id, d.name]), 'sales')}
        ${ctl.select('exD-m', 'Votre modèle', Object.entries(METHODS), 'hwa')}
      </div>
      <div class="orders" id="exD-orders" hidden>
        <div class="grp"><span class="grp-title">(p, d, q)</span>${ctl.number('exD-p', 'p', 1, 0, 3)}${ctl.number('exD-d', 'd', 1, 0, 2)}${ctl.number('exD-q', 'q', 1, 0, 3)}</div>
        <div class="grp"><span class="grp-title">(P, D, Q)ₛ</span>${ctl.number('exD-P', 'P', 0, 0, 2)}${ctl.number('exD-D', 'D', 1, 0, 1)}${ctl.number('exD-Q', 'Q', 1, 0, 2)}</div>
        ${ctl.check('exD-log', 'log', true)}
      </div>
      <div id="exD-info"></div>
      <div id="exD-c1"></div>
      <div class="controls"><button type="button" id="exD-go">Soumettre ma prévision</button></div>
      <div id="exD-res"></div>
      <div id="exD-board"></div>`;
    const info = () => {
      const ds = getDataset(val('exD-ds'));
      const h = ds.period > 1 ? Math.min(2 * ds.period, 28) : 20, T = ds.values.length - h;
      return { ds, h, T, train: ds.values.slice(0, T), test: ds.values.slice(T), m: ds.period > 1 ? ds.period : 1 };
    };
    const drawTrain = () => {
      const { ds, h, T, train } = info();
      box.querySelector('#exD-orders').hidden = val('exD-m') !== 'sarima';
      box.querySelector('#exD-info').innerHTML = `<p class="small">Les <strong>${h}</strong> dernières observations sont cachées. Vous voyez les ${T} premières. Période saisonnière s = ${ds.period > 1 ? ds.period : 'aucune'}. Objectif : la MASE la plus basse (moins de 1 = mieux que le naïf${ds.period > 1 ? ' saisonnier' : ''}).</p>`;
      const ax = timeAxis(ds);
      plot(box.querySelector('#exD-c1'), { title: 'Données d’entraînement (la zone grisée est cachée)', height: 240, xLabel: ax.label, xTicks: ax.ticks, xMax: ds.values.length - 1,
        layers: [{ type: 'shade', from: T - 0.5, to: ds.values.length - 0.5, label: '?' }, { type: 'line', x: train.map((_, i) => i), y: train, name: 'entraînement', color: '--s1', width: 1.5 }] });
    };
    const fitUser = (method, I) => {
      const { train, h, m } = I, pos = train.every((v) => v > 0);
      const seas = m > 1;
      if (['snaive', 'hwa', 'hwm'].includes(method) && !seas) throw new Error('Cette série n’a pas de saison : choisissez une autre méthode.');
      if (method === 'hwm' && !pos) throw new Error('Holt-Winters multiplicatif exige des valeurs positives.');
      switch (method) {
        case 'naive': return { mean: TS.baselines.naive(train, h) };
        case 'snaive': return { mean: TS.baselines.snaive(train, h, m) };
        case 'drift': return { mean: TS.baselines.drift(train, h) };
        case 'ses': return TS.etsFit(train, {}).intervals(h);
        case 'holt': return TS.etsFit(train, { trend: 'add' }).intervals(h);
        case 'damped': return TS.etsFit(train, { trend: 'damped' }).intervals(h);
        case 'hwa': return TS.etsFit(train, { trend: 'add', season: 'add', m }).intervals(h);
        case 'hwm': return TS.etsFit(train, { trend: 'add', season: 'mul', m }).intervals(h);
        default: {
          const o = { p: int('exD-p'), d: int('exD-d'), q: int('exD-q'), P: seas ? int('exD-P') : 0, D: seas ? int('exD-D') : 0, Q: seas ? int('exD-Q') : 0, s: m };
          const lam = val('exD-log') && pos ? 0 : null;
          const f = TS.sarimaFit(train, { ...o, lambda: lam });
          return { ...f.forecast(h), label: TS.orderLabel(o) + (lam === 0 ? ' log' : '') };
        }
      }
    };
    const reference = async (I) => {
      if (refCache[I.ds.id]) return refCache[I.ds.id];
      const fl = root.TSModels.forecasters(I.ds).filter((f) => ['hw', 'holt', 'sarima'].includes(f.id));
      let best = null;
      for (const f of fl) {
        await tick();
        try { const r = f.fn(I.train, I.h); const s = TS.metrics(I.test, r.mean, I.train, I.m).MASE; if (!best || s < best.mase) best = { name: f.name + (r.label ? ` · ${r.label}` : ''), mase: s }; } catch (e) { /* ignoré */ }
      }
      refCache[I.ds.id] = best;
      return best;
    };
    box.querySelector('#exD-go').addEventListener('click', async (e) => {
      const btn = e.currentTarget, I = info(), method = val('exD-m');
      btn.disabled = true;
      const res = box.querySelector('#exD-res');
      res.innerHTML = '<p class="busy">Estimation…</p>';
      await tick();
      let fc;
      try { fc = fitUser(method, I); } catch (err) { res.innerHTML = `<div class="callout warn"><p>${esc(err.message)}</p></div>`; btn.disabled = false; return; }
      const mt = TS.metrics(I.test, fc.mean, I.train, I.m);
      const cov = fc.lo ? I.test.filter((v, k) => v >= fc.lo[k] && v <= fc.hi[k]).length / I.h : null;
      const name = METHODS[method] + (fc.label ? ` · ${fc.label}` : '');
      attempts.push({ ds: I.ds.short || I.ds.name, name, mase: mt.MASE, rmse: mt.RMSE, cov });
      const ref = await reference(I);
      btn.disabled = false;
      const ax = timeAxis(I.ds), xsF = Array.from({ length: I.h }, (_, k) => I.T + k), from = Math.max(0, I.T - 3 * I.h);
      res.innerHTML = `<div class="callout ${mt.MASE < 1 ? 'good' : 'warn'}"><p>${mt.MASE < 1 ? pill('good', 'Bat la référence naïve') : pill('warn', 'Ne bat pas la référence naïve')} MASE <strong>${f2(mt.MASE, 3)}</strong> · RMSE ${f2(mt.RMSE, 2)} · MAPE ${f2(mt.MAPE, 1)} %${cov === null ? '' : ` · couverture IC 95 % : ${f2(100 * cov, 0)} %`}.</p>
        ${ref ? `<p>Meilleur modèle automatique de l’atelier sur ce découpage : ${esc(ref.name)} (MASE ${f2(ref.mase, 3)}). ${mt.MASE <= ref.mase + 1e-9 ? 'Vous faites au moins aussi bien.' : `Écart : ${f2(mt.MASE - ref.mase, 3)}.`}</p>` : ''}
        <p class="small">${mt.MASE >= 1 ? 'Piste : regardez si la série a une saison (naïf saisonnier, Holt-Winters) et si son amplitude croît avec le niveau (multiplicatif, ou log dans le SARIMA).' : 'Piste : comparez avec la validation glissante du chapitre 7 pour vérifier que ce résultat n’est pas un coup de chance sur un seul découpage.'}</p></div><div id="exD-c2"></div>`;
      plot(res.querySelector('#exD-c2'), { title: 'Votre prévision face aux valeurs cachées', height: 260, xLabel: ax.label, xTicks: ax.ticks,
        layers: [{ type: 'shade', from: I.T - 0.5, to: I.ds.values.length - 0.5, label: 'révélé' },
          fc.lo ? { type: 'band', x: xsF, lo: fc.lo, hi: fc.hi, name: 'IC 95 %', color: '--s2', of: 'Votre prévision' } : null,
          { type: 'line', x: I.ds.values.slice(from).map((_, i) => from + i), y: I.ds.values.slice(from), name: 'Réel', color: '--s1', width: 1.8 },
          { type: 'line', x: xsF, y: fc.mean, name: 'Votre prévision', color: '--s2', width: 2 }] });
      const sorted = attempts.map((a, i) => ({ ...a, i })).sort((a, b) => a.mase - b.mase);
      box.querySelector('#exD-board').innerHTML = `<h3>Vos essais</h3>` + table(['#', 'Série', 'Modèle', 'MASE', 'RMSE', 'Couverture'], sorted.map((a) => [a.i + 1, esc(a.ds), esc(a.name), f2(a.mase, 3), f2(a.rmse, 2), a.cov === null ? '—' : f2(100 * a.cov, 0) + ' %']),
        { numCols: [3, 4, 5], rowClass: (_, i) => (i === 0 ? 'best' : '') });
    });
    box.querySelector('#exD-ds').addEventListener('change', () => { box.querySelector('#exD-res').innerHTML = ''; drawTrain(); });
    box.querySelector('#exD-m').addEventListener('change', drawTrain);
    drawTrain();
  }

  CH.push({
    id: 'exercices', title: 'Exercices', short: 'Exercices appliqués',
    desc: 'Identifier, diagnostiquer, calculer, prévoir : à vous de jouer, avec corrections détaillées.',
    render(el) {
      el.innerHTML = `
      <header class="ch-head">
        <div class="eyebrow">Chapitre 10 · À vous d’appliquer</div>
        <h1>Exercices appliqués, corrigés et expliqués</h1>
        <p class="lede">Chaque exercice est tiré au hasard : vous pouvez en refaire autant que vous voulez. La correction montre la bonne réponse, le raisonnement attendu et ce que les outils automatiques auraient conclu.</p>
      </header>
      ${block('A · Identifier un processus ARMA', `<div class="prose"><p>Une série de 400 points a été simulée par l’un des cinq processus ci-dessous. Lisez l’ACF et la PACF (chapitre 3) et choisissez. Rappel : barres pleines = hors de la bande ±1,96/√n.</p></div><div class="panel" id="exA"></div>`)}
      ${block('B · Diagnostiquer la stationnarité', `<div class="prose"><p>Série de 200 points, processus caché. Décidez de la transformation à appliquer avant de modéliser. Essayez d’abord sans les tests, sur le graphique et l’ACF seuls.</p></div><div class="panel" id="exB"></div>`)}
      ${block('C · Calculs à la main', `<div class="prose"><p>Les résultats du cours à appliquer sur papier. Réponse numérique acceptée à 1 % près.</p></div><div class="panel" id="exC"></div>`)}
      ${block('D · Défi de prévision', `<div class="prose"><p>La fin de la série est cachée. Choisissez et paramétrez un modèle, soumettez : la vérité est révélée et votre prévision est notée. Tentez de battre le meilleur modèle automatique de l’atelier.</p></div><div class="panel" id="exD"></div>`)}`;
      exA(el); exB(el); exC(el); exD(el);
    },
  });
})(window);
