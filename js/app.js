/*
 * app.js — navigation par ancre (#id), sommaire, thème, rendu des chapitres.
 */
(function (root) {
  'use strict';
  const { $, $$, store, typeset, wireCopy, wireQuiz } = root.UI;
  const CH = root.CHAPTERS;
  const main = $('#content');

  // MathJax se charge après ce script (defer) : on compose la page courante dès qu'il est prêt.
  root.MathJax.startup.ready = () => {
    root.MathJax.startup.defaultReady();
    root.MathJax.startup.promise.then(() => typeset(main));
  };

  // Sommaire
  $('#toc').innerHTML = CH.map((c, i) => `<li><a href="#${c.id}" data-id="${c.id}"><span class="t">t = ${i}</span><span>${c.short}</span></a></li>`).join('');

  // Petite courbe AirPassengers dans l'en-tête
  (function spark() {
    const v = root.TSData.AIR, lo = Math.min(...v), hi = Math.max(...v);
    const d = v.map((y, i) => `${i ? 'L' : 'M'}${(i / (v.length - 1)) * 220},${32 - ((y - lo) / (hi - lo)) * 30}`).join('');
    $('#brand-spark path').setAttribute('d', d);
  })();

  // Thème : auto → clair → sombre
  const themes = ['auto', 'light', 'dark'], names = { auto: 'auto', light: 'clair', dark: 'sombre' };
  let theme = store.get('theme', 'auto');
  const applyTheme = () => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    $('#theme-toggle').textContent = `Thème : ${names[theme]}`;
  };
  $('#theme-toggle').addEventListener('click', () => { theme = themes[(themes.indexOf(theme) + 1) % 3]; store.set('theme', theme); applyTheme(); });
  applyTheme();

  function show(id) {
    const i = Math.max(0, CH.findIndex((c) => c.id === id));
    const ch = CH[i];
    $$('#toc a').forEach((a) => a.removeAttribute('aria-current'));
    const cur = $(`#toc a[data-id="${ch.id}"]`);
    cur.setAttribute('aria-current', 'page');
    cur.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    main.innerHTML = '<article class="chapter" id="chapter"></article>';
    const art = $('#chapter');
    document.title = `${ch.short} · Atelier Séries Temporelles`;
    try { ch.render(art); } catch (err) {
      art.innerHTML += `<div class="callout bad"><p>Erreur de rendu : ${root.UI.esc(err.message)}</p></div>`;
      console.error(err);
    }
    const prev = CH[i - 1], next = CH[i + 1];
    art.insertAdjacentHTML('beforeend', `<nav class="pager">${prev ? `<a href="#${prev.id}"><span>← chapitre ${i - 1}</span>${prev.short}</a>` : ''}${next ? `<a class="next" href="#${next.id}"><span>chapitre ${i + 1} →</span>${next.short}</a>` : ''}</nav>`);
    wireCopy(art);
    wireQuiz(art);
    typeset(art);
    store.set('chapter', ch.id);
    root.scrollTo(0, 0);
  }

  const route = () => show(location.hash.slice(1) || store.get('chapter', 'intro'));
  root.addEventListener('hashchange', route);
  route();
})(window);
