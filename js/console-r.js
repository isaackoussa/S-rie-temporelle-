/*
 * console-r.js — R dans le navigateur grâce à webR (R compilé en WebAssembly).
 * Éditeur de script + console, graphiques, installation des paquets à la demande (forecast, tseries…),
 * fichiers du dossier donnees/ copiés dans le répertoire de travail de R.
 * Le premier lancement télécharge R (~25 Mo) ; le service worker le garde ensuite en cache.
 */
const WEBR_URLS = ['https://webr.r-wasm.org/v0.6.0/webr.mjs', 'https://webr.r-wasm.org/latest/webr.mjs'];
const HOME = '/home/web_user';
const DATA_FILES = [
  'airpassengers', 'co2', 'eustock_cac', 'eustock_dax', 'eustock_ftse', 'eustock_smi', 'nyse', 'precipitations',
  'serie1', 'serie2', 'simulation', 'sunspot_year', 'taux_interet', 'usaccdeaths', 'varicelle',
].flatMap((f) => [`${f}.dat`, `${f}.csv`]);
const BASE_PKGS = new Set(['base', 'stats', 'utils', 'graphics', 'grDevices', 'methods', 'datasets', 'tools', 'grid',
  'parallel', 'splines', 'stats4', 'compiler', 'tcltk', 'webr']);

// Exécution côté R : chaque expression est affichée (marque \001), évaluée dans l'environnement global,
// imprimée si visible ; erreurs (\002) et avis (\003) sont écrits aussitôt, comme dans la console R.
const R_HELPERS = String.raw`
local({
  e <- new.env()
  emit <- function(mark, txt) {
    lines <- strsplit(paste(txt, collapse = "\n"), "\n", fixed = TRUE)[[1]]
    cat(paste0(mark, lines, "\n"), sep = "", file = stderr())
  }
  prompt <- function(lines) cat(paste0("\001", ifelse(seq_along(lines) == 1, "> ", "+ "), lines, "\n"), sep = "")
  e$run <- function(code, echo = TRUE, partial = FALSE) {
    exprs <- tryCatch(parse(text = code, keep.source = TRUE), error = function(err) err)
    if (inherits(exprs, "error")) {
      msg <- conditionMessage(exprs)
      if (partial && grepl("unexpected end of input|INCOMPLETE_STRING", msg)) return("incomplete")
      if (echo) prompt(strsplit(code, "\n", fixed = TRUE)[[1]])
      emit("\002", paste0("Erreur de syntaxe : ", sub("^<text>:", "ligne ", msg)))
      return("error")
    }
    srcs <- attr(exprs, "srcref")
    for (i in seq_along(exprs)) {
      if (echo) {
        src <- if (!is.null(srcs)) as.character(srcs[[i]]) else deparse(exprs[[i]])
        prompt(src)
      }
      ok <- withCallingHandlers(
        tryCatch({
          r <- withVisible(eval(exprs[[i]], envir = globalenv()))
          if (r$visible) print(r$value)
          TRUE
        }, error = function(err) {
          call <- conditionCall(err)
          if (identical(call, quote(eval(exprs[[i]], envir = globalenv())))) call <- NULL
          where <- if (is.null(call)) "" else paste0(" dans ", deparse(call, nlines = 1)[1])
          emit("\002", paste0("Erreur", where, " : ", conditionMessage(err)))
          FALSE
        }),
        warning = function(w) {
          call <- conditionCall(w)
          where <- if (is.null(call)) "" else paste0(" dans ", deparse(call, nlines = 1)[1])
          emit("\003", paste0("Avis", where, " : ", conditionMessage(w)))
          invokeRestart("muffleWarning")
        })
      if (!ok) return("error")
    }
    "ok"
  }
  installed <- function(p) nzchar(system.file(package = p))
  e$deps <- function(pkgs) {
    miss <- unique(pkgs[!vapply(pkgs, installed, logical(1))])
    if (!length(miss)) return(invisible())
    message("Installation de ", paste(miss, collapse = ", "), " (une fois par session)…")
    suppressWarnings(try(webr::install(miss), silent = TRUE))
    still <- miss[!vapply(miss, installed, logical(1))]
    if (length(still)) message("Paquet indisponible pour webR : ", paste(still, collapse = ", "))
    invisible()
  }
  attach(e, name = "tools:console")
})
try(webr::shim_install(), silent = TRUE)
`;

const EXAMPLES = [
  ['Premiers pas', `# Un échantillon gaussien
x <- rnorm(200, mean = 10, sd = 2)
summary(x)
hist(x, col = "steelblue", main = "Histogramme")`],
  ['AirPassengers : décomposition', `plot(AirPassengers)
dec <- decompose(log(AirPassengers))
plot(dec)`],
  ['ACF / PACF d’un AR(2)', `set.seed(1)
x <- arima.sim(list(ar = c(0.6, -0.3)), n = 300)
par(mfrow = c(2, 1))
acf(x)
pacf(x)`],
  ['Modèle airline (stats::arima)', `y <- log(AirPassengers)
fit <- arima(y, order = c(0, 1, 1), seasonal = c(0, 1, 1))
fit
Box.test(residuals(fit), lag = 24, type = "Ljung-Box", fitdf = 2)
p <- predict(fit, n.ahead = 24)
ts.plot(exp(y), exp(p$pred), exp(p$pred + 1.96 * p$se), exp(p$pred - 1.96 * p$se),
        col = c(1, 2, 4, 4), lty = c(1, 1, 2, 2))`],
  ['Holt-Winters sur co2', `hw <- HoltWinters(co2)
c(alpha = hw$alpha, beta = hw$beta, gamma = hw$gamma)
plot(hw, predict(hw, 48, prediction.interval = TRUE))`],
  ['forecast : auto.arima', `library(forecast)
fit <- auto.arima(AirPassengers, lambda = 0)
summary(fit)
plot(forecast(fit, h = 24))`],
  ['tseries : ADF et KPSS', `library(tseries)
adf.test(log(AirPassengers))
kpss.test(diff(log(AirPassengers)))`],
  ['Données des TP (donnees/)', `list.files("donnees")
x <- ts(scan("donnees/serie1.dat"))
plot(x)
acf(x)
Box.test(x, lag = 10, type = "Ljung-Box")`],
];

// ------------------------------------------------------------------ outils
const $ = (s) => document.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem('ast:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ast:' + k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } },
  del(k) { try { localStorage.removeItem('ast:' + k); } catch (e) { /* idem */ } },
};
const theme = store.get('theme', 'auto');
if (theme !== 'auto') document.documentElement.setAttribute('data-theme', theme);

const main = $('.rc-main'), out = $('#rc-out'), editor = $('#rc-editor'), input = $('#rc-input');
const statusEl = $('#rc-status');
function status(text, cls) { statusEl.textContent = text; statusEl.className = cls || ''; }

function setView(v) {
  main.dataset.view = v;
  $('#tab-script').setAttribute('aria-pressed', String(v === 'script'));
  $('#tab-console').setAttribute('aria-pressed', String(v === 'console'));
  store.set('console-r:view', v);
  if (v === 'console') scrollEnd();
}
$('#tab-script').addEventListener('click', () => setView('script'));
$('#tab-console').addEventListener('click', () => setView('console'));
const wide = matchMedia('(min-width: 900px)');

// ------------------------------------------------------------------ sortie
const scrollEnd = () => { out.scrollTop = out.scrollHeight; };
function newCell() { const c = document.createElement('div'); c.className = 'rc-cell'; out.appendChild(c); return c; }
function info(html, cell = newCell()) {
  const p = document.createElement('pre'); p.className = 'rc-info'; p.innerHTML = html; cell.appendChild(p); scrollEnd(); return cell;
}
function renderOutput(cell, output) {
  let pre = null, cls = null;
  for (const o of output) {
    if (o.type !== 'stdout' && o.type !== 'stderr') continue;
    for (let line of String(o.data).split('\n')) {
      let c = o.type === 'stdout' ? '' : 'rc-msg';
      if (line[0] === '\u0001') { c = 'rc-echo'; line = line.slice(1); }
      else if (line[0] === '\u0002') { c = 'rc-err'; line = line.slice(1); }
      else if (line[0] === '\u0003') { c = 'rc-warn'; line = line.slice(1); }
      if (!pre || c !== cls) { pre = document.createElement('pre'); if (c) pre.className = c; cls = c; cell.appendChild(pre); pre.textContent = line; }
      else pre.textContent += '\n' + line;
    }
  }
}
function addPlot(cell, bitmap) {
  const cv = document.createElement('canvas');
  cv.width = bitmap.width; cv.height = bitmap.height;
  cv.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const img = new Image();
  img.className = 'rc-plot'; img.alt = 'Graphique R (appui long pour enregistrer)';
  img.src = cv.toDataURL('image/png');
  cell.appendChild(img);
  img.addEventListener('load', scrollEnd);
}
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ------------------------------------------------------------------ démarrage de R
let webR = null, ready = null, queue = Promise.resolve();

async function start() {
  status('Téléchargement de R (≈ 25 Mo la première fois)…', 'busy');
  let mod = null, lastErr = null;
  for (const u of WEBR_URLS) { try { mod = await import(u); break; } catch (e) { lastErr = e; } }
  if (!mod) throw lastErr || new Error('webR introuvable');
  webR = new mod.WebR();
  await webR.init();
  status('Préparation…', 'busy');
  await webR.FS.mkdir(`${HOME}/donnees`).catch(() => {});
  await Promise.all(DATA_FILES.map(async (f) => {
    try {
      const res = await fetch(`donnees/${f}`);
      if (res.ok) await webR.FS.writeFile(`${HOME}/donnees/${f}`, new Uint8Array(await res.arrayBuffer()));
    } catch (e) { /* fichier absent hors ligne : sans gravité */ }
  }));
  await webR.evalRVoid(R_HELPERS);
  await syncWidth();
  status(`R ${webR.versionR || ''} prêt · webR ${webR.version || ''}`.replace(/\s+·\s+webR\s*$/, ''), 'ok');
}
function boot() {
  ready = start().catch((e) => {
    status('R n’a pas pu démarrer', 'bad');
    info(`<span class="rc-err">Impossible de charger R : ${esc(String(e && e.message || e))}</span>\n` +
      'Le premier lancement nécessite une connexion internet (R est téléchargé depuis webr.r-wasm.org).');
    throw e;
  });
  ready.catch(() => {});
}

// Toutes les exécutions passent par une file : R traite une commande à la fois.
function enqueue(fn) {
  const p = queue.then(() => ready).then(async () => {
    status('Calcul en cours…', 'busy');
    try { return await fn(); } finally { status(`R ${webR.versionR || ''} prêt`, 'ok'); }
  });
  queue = p.catch(() => {});
  return p;
}

function detectPkgs(code) {
  const src = code.replace(/#.*$/gm, '');
  const found = new Set();
  for (const m of src.matchAll(/\b(?:library|require|requireNamespace)\s*\(\s*["']?([A-Za-z][A-Za-z0-9.]*)/g)) found.add(m[1]);
  for (const m of src.matchAll(/\b([A-Za-z][A-Za-z0-9.]*):::?/g)) found.add(m[1]);
  return [...found].filter((p) => !BASE_PKGS.has(p));
}

function plotSize() {
  const w = Math.max(420, Math.min(760, Math.round((out.clientWidth - 24) * 1.3)));
  return { width: w, height: Math.round(w * 0.72), bg: 'white' };
}

async function syncWidth() {
  if (!webR) return;
  const probe = document.createElement('pre');
  probe.style.cssText = 'position:absolute;visibility:hidden;margin:0';
  probe.textContent = 'x'.repeat(50);
  out.appendChild(probe);
  const cw = probe.getBoundingClientRect().width / 50;
  probe.remove();
  const avail = (out.clientWidth || 360) - 26;
  const cols = Math.max(32, Math.min(160, Math.floor(avail / (cw || 7.8))));
  await webR.evalRVoid(`options(width = ${cols})`);
}

function runCode(code, { echo = true, partial = false } = {}) {
  return enqueue(async () => {
    const shelter = await new webR.Shelter();
    const c = newCell();
    try {
      const pkgs = detectPkgs(code);
      if (pkgs.length) {
        const d = await shelter.captureR('get("deps", "tools:console")(p)', { env: { p: pkgs }, captureConditions: false, captureGraphics: false });
        renderOutput(c, d.output);
        scrollEnd();
      }
      const r = await shelter.captureR('get("run", "tools:console")(code, echo, partial)', {
        env: { code, echo, partial }, captureConditions: false, captureGraphics: plotSize(),
      });
      const res = await r.result.toJs();
      const st = (res && res.values && res.values[0]) || 'ok';
      if (st === 'incomplete') { if (!c.childNodes.length) c.remove(); return st; }
      renderOutput(c, r.output);
      for (const img of r.images || []) addPlot(c, img);
      if (!c.childNodes.length) c.remove();
      return st;
    } catch (e) {
      info(`<span class="rc-err">${esc(String(e && e.message || e))}</span>`, c);
      return 'error';
    } finally {
      shelter.purge();
      scrollEnd();
    }
  }).catch(() => 'error'); // R n'a pas démarré : le message est déjà affiché
}

// ------------------------------------------------------------------ éditeur de script
const DEFAULT_SCRIPT = `# Console R complète dans le navigateur.
# « Tout exécuter » lance le script ; « Ligne / sélection » la ligne du curseur.
# Les paquets (forecast, tseries…) s'installent au premier library().

plot(AirPassengers)
fit <- arima(log(AirPassengers), order = c(0, 1, 1), seasonal = c(0, 1, 1))
fit
`;
editor.value = store.get('console-r:script', DEFAULT_SCRIPT);
let saveT = 0;
editor.addEventListener('input', () => { clearTimeout(saveT); saveT = setTimeout(() => store.set('console-r:script', editor.value), 400); });

function runAll() {
  const code = editor.value;
  if (!code.trim()) return;
  if (!wide.matches) setView('console');
  runCode(code);
}
function runSelection() {
  const { selectionStart: a, selectionEnd: b, value } = editor;
  let code;
  if (a !== b) code = value.slice(a, b);
  else {
    const s = value.lastIndexOf('\n', a - 1) + 1;
    let e = value.indexOf('\n', a); if (e < 0) e = value.length;
    code = value.slice(s, e);
    // avance au début de la ligne suivante, comme Ctrl+Entrée dans RStudio
    const next = Math.min(value.length, e + 1);
    editor.setSelectionRange(next, next);
  }
  if (!code.trim()) return;
  if (!wide.matches) setView('console');
  runCode(code);
}
$('#rc-run-all').addEventListener('click', runAll);
$('#rc-run-sel').addEventListener('click', runSelection);
editor.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (e.shiftKey) runAll(); else runSelection(); }
  else if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); insert(editor, '  '); }
});

// ------------------------------------------------------------------ console interactive
let pending = '';
const history = store.get('console-r:history', []);
let hIdx = history.length;
const ps = $('#rc-ps');
function autoGrow() { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight + 2, innerHeight * 0.3)}px`; }
input.addEventListener('input', autoGrow);

async function submit() {
  const line = input.value;
  if (!line.trim() && !pending) return;
  input.value = ''; autoGrow();
  if (line.trim()) {
    history.push(line); if (history.length > 200) history.splice(0, history.length - 200);
    store.set('console-r:history', history);
  }
  hIdx = history.length;
  const code = pending ? `${pending}\n${line}` : line;
  const st = await runCode(code, { partial: true });
  if (st === 'incomplete') {
    pending = code; ps.textContent = '+';
    const c = newCell(); const p = document.createElement('pre'); p.className = 'rc-echo';
    p.textContent = code.split('\n').map((l, i) => (i ? '+ ' : '> ') + l).join('\n'); c.appendChild(p); c.dataset.pending = '1'; scrollEnd();
  } else {
    pending = ''; ps.textContent = '>';
  }
  // l'écho provisoire d'une saisie incomplète est remplacé par celui de l'exécution
  if (st !== 'incomplete') out.querySelectorAll('.rc-cell[data-pending]').forEach((c) => c.remove());
  else out.querySelectorAll('.rc-cell[data-pending]').forEach((c, i, all) => { if (i < all.length - 1) c.remove(); });
}
$('#rc-form').addEventListener('submit', (e) => { e.preventDefault(); submit(); });
function browseHistory(dir) {
  if (!history.length) return;
  hIdx = Math.max(0, Math.min(history.length, hIdx + dir));
  input.value = history[hIdx] ?? ''; autoGrow();
  const n = input.value.length; input.setSelectionRange(n, n);
}
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); }
  else if (e.key === 'ArrowUp' && !input.value.slice(0, input.selectionStart).includes('\n')) { e.preventDefault(); browseHistory(-1); }
  else if (e.key === 'ArrowDown' && !input.value.slice(input.selectionEnd).includes('\n')) { e.preventDefault(); browseHistory(1); }
  else if (e.key === 'Escape' && pending) { pending = ''; ps.textContent = '>'; out.querySelectorAll('.rc-cell[data-pending]').forEach((c) => c.remove()); }
});

// ------------------------------------------------------------------ barre de touches (mobile)
let target = input;
editor.addEventListener('focus', () => { target = editor; });
input.addEventListener('focus', () => { target = input; });
function insert(el, text, pair) {
  const a = el.selectionStart, b = el.selectionEnd, sel = el.value.slice(a, b);
  const ins = pair ? text + sel + pair : text;
  el.setRangeText(ins, a, b, 'end');
  if (pair && !sel) el.setSelectionRange(a + text.length, a + text.length);
  el.dispatchEvent(new Event('input'));
}
const KEYS = [
  ['⇥', () => insert(target, '  ')], ['<-', () => insert(target, ' <- ')], ['|>', () => insert(target, ' |> ')],
  ['( )', () => insert(target, '(', ')')], [')', () => insert(target, ')')], ['[ ]', () => insert(target, '[', ']')],
  ['{ }', () => insert(target, '{', '}')], ['" "', () => insert(target, '"', '"')], ['$', () => insert(target, '$')],
  ['~', () => insert(target, '~')], ['=', () => insert(target, '=')], [',', () => insert(target, ', ')],
  [':', () => insert(target, ':')], ['#', () => insert(target, '# ')], ['^', () => insert(target, '^')],
  ['↑', () => { if (target === input) browseHistory(-1); }], ['↓', () => { if (target === input) browseHistory(1); }],
  ['⏎', () => { if (target === input) insert(input, '\n'); else insert(editor, '\n'); }],
];
const keysEl = $('#rc-keys');
KEYS.forEach(([label, fn]) => {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = label;
  b.setAttribute('aria-label', label === '⏎' ? 'Nouvelle ligne' : label === '⇥' ? 'Indentation' : label === '↑' ? 'Historique précédent' : label === '↓' ? 'Historique suivant' : label);
  b.addEventListener('pointerdown', (e) => e.preventDefault()); // garde le clavier ouvert
  b.addEventListener('click', () => { fn(); target.focus(); });
  keysEl.appendChild(b);
});

// ------------------------------------------------------------------ menu outils
const menu = $('#rc-menu'), menuBtn = $('#rc-menu-btn');
function setMenu(open) { menu.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); }
menuBtn.addEventListener('click', (e) => { e.stopPropagation(); setMenu(menu.hidden); });
document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) setMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });

const exSel = $('#rc-examples');
EXAMPLES.forEach(([name], i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = name; exSel.appendChild(o); });
exSel.addEventListener('change', () => {
  const ex = EXAMPLES[+exSel.value]; exSel.value = '';
  if (!ex) return;
  editor.value = ex[1]; store.set('console-r:script', editor.value);
  setMenu(false); setView('script');
});

$('#rc-pkg-btn').addEventListener('click', () => {
  const name = $('#rc-pkg').value.trim();
  if (!/^[A-Za-z][A-Za-z0-9.]*$/.test(name)) { $('#rc-pkg').focus(); return; }
  $('#rc-pkg').value = ''; setMenu(false); setView('console');
  runCode(`install.packages("${name}")\nlibrary(${name})`);
});

$('#rc-upload').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  setMenu(false); setView('console');
  const name = f.name.replace(/[^\w.\-]+/g, '_');
  const buf = new Uint8Array(await f.arrayBuffer());
  try {
    await enqueue(() => webR.FS.writeFile(`${HOME}/${name}`, buf));
    const how = /\.csv$/i.test(name) ? `read.csv("${name}")` : /\.(dat|txt)$/i.test(name) ? `scan("${name}")` : `readLines("${name}")`;
    info(`Fichier importé dans le répertoire de travail : <b>${esc(name)}</b> (${(buf.length / 1024).toFixed(1)} Ko)\nPour le lire : <code>${esc(how)}</code>`);
  } catch (err) { info(`<span class="rc-err">Import impossible : ${esc(String(err.message || err))}</span>`); }
});

$('#rc-download-script').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([editor.value], { type: 'text/plain' }));
  a.download = 'script.R'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  setMenu(false);
});
$('#rc-clear').addEventListener('click', () => { out.innerHTML = ''; setMenu(false); setView('console'); });
$('#rc-restart').addEventListener('click', async () => {
  setMenu(false); setView('console');
  try { webR && webR.close(); } catch (e) { /* déjà arrêté */ }
  webR = null; queue = Promise.resolve(); pending = ''; ps.textContent = '>';
  info('R redémarré : l’environnement de travail est vide.');
  boot();
});

let resizeT = 0;
addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (webR) enqueue(syncWidth).catch(() => {}); }, 300); });

// ------------------------------------------------------------------ lancement
if ('serviceWorker' in navigator && isSecureContext) {
  addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
setView(wide.matches ? 'console' : store.get('console-r:view', 'console'));
info('Bienvenue dans R. Tapez une commande ci-dessous (ex. <code>summary(AirPassengers)</code>) ou ouvrez l’onglet Script. ' +
  'Menu ⋯ : exemples, paquets, import de fichiers.');
boot();

// Code envoyé depuis un chapitre (« Exécuter dans R ») : chargé dans le script puis exécuté.
const handoff = store.get('console-r:handoff', null);
if (handoff && handoff.code) {
  store.del('console-r:handoff');
  if (editor.value.trim() && editor.value !== handoff.code) store.set('console-r:script-prev', editor.value);
  editor.value = handoff.code; store.set('console-r:script', editor.value);
  info(`Code reçu${handoff.from ? ` de « ${esc(handoff.from)} »` : ''} : exécution dès que R est prêt.`);
  setView('console');
  runCode(handoff.code);
}
