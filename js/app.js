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
  $('#toc').innerHTML = CH.map((c, i) => `<li><a href="#${c.id}" data-id="${c.id}">${root.UI.icon(c.id)}<span>${c.short}</span><span class="t">t = ${i}</span></a></li>`).join('');

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

  // Installation comme application (PWA) : service worker + invite d'installation du navigateur
  const install = { prompt: null, listeners: [] };
  const framed = (() => { try { return root.top !== root; } catch (e) { return true; } })();
  install.standalone = root.matchMedia('(display-mode: standalone)').matches || root.navigator.standalone === true;
  install.ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  install.supported = 'serviceWorker' in navigator && root.isSecureContext && !framed;
  install.notify = () => install.listeners.forEach((f) => f());
  install.ask = async () => {
    if (!install.prompt) return false;
    install.prompt.prompt();
    const choice = await install.prompt.userChoice;
    install.prompt = null; install.notify();
    return choice.outcome === 'accepted';
  };
  root.AppInstall = install;
  if (install.supported) {
    root.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
  root.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); install.prompt = e; install.notify(); });
  root.addEventListener('appinstalled', () => { install.prompt = null; install.standalone = true; install.notify(); });
  const installBtn = $('#install-btn');
  const syncInstallBtn = () => { installBtn.hidden = !install.prompt; };
  install.listeners.push(syncInstallBtn);
  installBtn.addEventListener('click', () => install.ask());

  // Menu mobile : tiroir latéral ouvert par le bouton ☰
  const nav = $('#nav'), menuBtn = $('#menu-btn'), scrim = $('#scrim');
  const mobile = root.matchMedia('(max-width: 900px)');
  function setMenu(open) {
    nav.classList.toggle('open', open);
    scrim.hidden = !open;
    document.body.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Fermer le menu des chapitres' : 'Ouvrir le menu des chapitres');
    if (open) ($('#toc a[aria-current="page"]') || $('#toc a')).focus();
  }
  menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  scrim.addEventListener('click', () => setMenu(false));
  $('#toc').addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); menuBtn.focus(); }
  });
  mobile.addEventListener('change', () => setMenu(false));

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
    $('#topbar-sub').textContent = `Chapitre ${i} · ${ch.short}`;
    try { ch.render(art); } catch (err) {
      art.innerHTML += `<div class="callout bad"><p>Erreur de rendu : ${root.UI.esc(err.message)}</p></div>`;
      console.error(err);
    }
    const eb = art.querySelector('.ch-head .eyebrow');
    if (eb) eb.insertAdjacentHTML('afterbegin', root.UI.icon(ch.id));
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
