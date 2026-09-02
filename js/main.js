/*
 * Sidekick - logica del panel.
 *
 * Proyecto independiente. Sin relacion con Postline ni codigo compartido con el.
 */
import { evalScript, extensionPath, host, setFlyoutMenu } from './cep.js';
import { LANGS, applyDom, lang, setLang, t } from './i18n.js';
import { getPhrase } from './quotes.js';
import { clipboardToFile, copyFileToClipboard, pastedFilename, writeFileBase64 } from './clipboard.js';

const $ = (id) => document.getElementById(id);
const statusEl = $('status');
const bar = document.querySelector('.bar');

/* Hacia que lado se abre la frase: la fija el boton que acabas de pulsar y la
 * usa el CSS para decidir a quien empuja. */
let side = 'copy';

/* --- Preferencias -------------------------------------------------------- *
 * Un JSON en el home, no localStorage: el panel corre sobre file:// y Premiere
 * vacia su cache de CEP cuando le parece, llevandose lo que hubiera ahi. */
const CFG_FILE = `${window.cep.fs.getUserHomeDirectory?.().data || '/tmp'}/.sidekick.json`;

function loadCfg() {
  const r = window.cep.fs.readFile(CFG_FILE, window.cep.encoding.UTF8);
  try { return r.err ? {} : JSON.parse(r.data || '{}'); } catch { return {}; }
}

const cfg = loadCfg();
const saveCfg = () => window.cep.fs.writeFile(CFG_FILE, JSON.stringify(cfg, null, 2), window.cep.encoding.UTF8);

/* --- El mensaje ---------------------------------------------------------- */

/* La frase y su pelicula: se ve una u otra, nunca las dos. Pinchando se pasa de
 * una a la otra descifrando las letras. */
let shown = null;   // { text, film }
let showingFilm = false;
let scrambler = null;

const CHARS = '01<>[]{}/\\*+=$#@%&ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const rnd = () => CHARS[Math.floor(Math.random() * CHARS.length)];

/* Desciframiento: cada letra se fija en un momento distinto, de izquierda a
 * derecha, y hasta que le toca parpadea con un caracter al azar. Rapido: una
 * frase entera se lee en medio segundo. 16 ms por fotograma es el ritmo del
 * propio navegador; no hace falta rAF para 30 letras. */
function scrambleTo(text, cls) {
  clearInterval(scrambler);
  const settle = Array.from(text, (_, i) => i * 0.3 + Math.random() * 3);
  let frame = 0;

  scrambler = setInterval(() => {
    statusEl.textContent = Array.from(text, (ch, i) => {
      if (frame >= settle[i] || ch === ' ') { return ch; }
      return rnd();
    }).join('');
    if (frame++ > Math.max(...settle)) {
      clearInterval(scrambler);
      scrambler = null;
      statusEl.textContent = text;
    }
  }, 16);

  statusEl.className = `is-on ${cls}`;
}

/* La frase se va sola a los 15 s: es un acuse de recibo, no un cartel, y el
 * panel tiene que volver a estar limpio sin que hagas nada. Se cuentan desde lo
 * ultimo que hiciste, sea la accion o descubrir la pelicula. Con ella se va el
 * COPIED del boton; el amarillo vivo del primario se queda. */
let hideTimer = null;

function scheduleHide() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    statusEl.className = '';   // se desvanece con la transicion de #status
    bar.className = 'bar';     // y los botones vuelven a repartirse el sitio
    for (const b of tools) { b.classList.remove('is-done', 'is-err'); }
    shown = null;
  }, 15_000);
}

/* Un reflow forzado entre quitar y poner la clase: sin el, el navegador une los
 * dos cambios en un solo estilo y la entrada no se anima. */
function say(text, cls = '') {
  clearInterval(scrambler);
  scrambler = null;
  clearTimeout(hideTimer);
  statusEl.className = '';
  void statusEl.offsetWidth;
  statusEl.textContent = text;
  statusEl.className = `is-on ${cls}`;
  bar.className = `bar is-msg is-${side}`;
  scheduleHide();
}

/** Frase de cine; la pelicula se descubre pinchando. */
function quote(action, cls = '') {
  shown = { ...getPhrase(action, lang()), cls };
  showingFilm = false;
  say(shown.text, cls);
}

statusEl.addEventListener('click', () => {
  if (!shown) { return; }
  showingFilm = !showingFilm;
  scrambleTo(showingFilm ? `🎬 ${shown.film}` : shown.text,
    showingFilm ? `is-film ${shown.cls}` : shown.cls);
  scheduleHide();
});

/* --- Botones -------------------------------------------------------------- */

/* El boton pulsado parpadea en verde con COPIED / PASTED mientras dura la frase
 * y pasa a ser el primario; el otro vuelve a apagado. Quitar y volver a poner
 * is-done con un reflow en medio relanza el parpadeo si repites el mismo. */
const tools = [$('copyFrame'), $('pasteImg')];

function mark(btn, cls) {
  for (const b of tools) { b.classList.remove('is-done', 'is-err', 'is-primary'); }
  void btn.offsetWidth;
  btn.classList.add(cls, 'is-primary');
}

const flash = (btn) => mark(btn, 'is-done');

/* Fotograma bajo el cursor -> portapapeles del sistema. */
async function copyFrame() {
  side = 'copy';
  try {
    // Premiere 15-24 escribe el fotograma a disco; Premiere 25 lo devuelve en
    // base64 y es el panel quien lo guarda. host.jsx dice cual de las dos.
    const [kind, raw, data] = await host('skExportFrame');
    if (kind === 'b64') { writeFileBase64(raw, data); }
    const path = copyFileToClipboard(raw) || raw;
    window.cep.fs.deleteFile(raw); // el temporal ya vive en el portapapeles
    if (path !== raw) { window.cep.fs.deleteFile(path); }
    flash($('copyFrame'));
    quote('copy');
  } catch (err) { fail($('copyFrame'), err); }
}

/* Imagen del portapapeles -> secuencia activa. */
async function pasteImage() {
  side = 'paste';
  try {
    // La carpeta la decide host.jsx: junto al .prproj, nunca en el temporal del
    // sistema, porque Premiere queda enlazado a este fichero para siempre.
    const [dir] = await host('skPasteDir');
    const path = `${dir}/${pastedFilename('image/png')}`;
    // Portapapeles sin imagen es lo unico que se cuenta con una frase; cualquier
    // otro fallo se dice tal cual, que es lo que sirve para arreglarlo.
    if (!clipboardToFile(path)) { mark($('pasteImg'), 'is-err'); quote('error', 'err'); return; }
    await host('skImportImage', path, cfg.top ? 1 : 0);
    flash($('pasteImg'));
    quote('paste');
  } catch (err) { fail($('pasteImg'), err); }
}

/* Fallo: el boton en rojo y el mensaje traducido, tal cual lo cuenta host.jsx.
 * Los errores que no vienen de ahi (los de ExtendScript) salen como llegan. */
function fail(btn, err) {
  shown = null;
  mark(btn, 'is-err');
  say(t(err.message, ...(err.args || [])), 'err');
}

$('copyFrame').addEventListener('click', copyFrame);
$('pasteImg').addEventListener('click', pasteImage);

/* El conmutador de pista: se queda como lo dejes, como el CapsLock. */
const top = $('topTrack');
const paintTop = () => top.setAttribute('aria-pressed', String(!!cfg.top));
// El menu se repinta para mover su marca: boton y menu son el mismo estado.
function toggleTop() { cfg.top = !cfg.top; saveCfg(); paintTop(); menu(); }
// blur(): el boton se quedaba con el foco y Espacio/Intro lo volvian a pulsar.
top.addEventListener('click', () => { toggleTop(); top.blur(); });
paintTop();

/* --- Menu del panel ------------------------------------------------------- */

const LANG_LABELS = { en: 'EN', es: 'ES', pt: 'PT-BR' };

/* La firma, el idioma y el recargar viven aqui: en la barra solo caben los dos
 * botones que se usan. El menu se repinta al cambiar de idioma para mover la
 * marca de seleccion. */
function menu() {
  setFlyoutMenu([
    { id: 'top', label: t('Paste on top'), checked: !!cfg.top },
    { id: '-' },
    {
      label: t('Language'),
      children: LANGS.map((code) => ({ id: `lang-${code}`, label: LANG_LABELS[code], checked: lang() === code })),
    },
    { id: 'refresh', label: t('Refresh') },
    { id: '-' },
    { id: 'ig', label: '@marquesdxp' },
  ], onMenu);
}

function onMenu(id) {
  if (id === 'top') { toggleTop(); return; }
  if (id === 'refresh') { location.reload(); return; }
  if (id === 'ig') { window.cep.util.openURLInDefaultBrowser('https://www.instagram.com/marquesdxp/'); return; }
  if (id?.startsWith('lang-')) {
    cfg.lang = setLang(id.slice(5));
    saveCfg();
    applyDom();
    menu();
    // La frase a la vista se queda en el idioma en que salio: la siguiente ya
    // sale en el nuevo, y reescribirla ahora seria mentir sobre lo que hiciste.
  }
}

/* --- El anillo ------------------------------------------------------------ */

/* El contorno de la capsula en px, para que la luz del borde lo recorra
 * (offset-path no admite porcentajes de caja). Empieza abajo, en el centro, y
 * gira en el sentido del reloj. Se redibuja cuando el panel cambia de tamano. */
const ring = document.querySelector('.ring');
const RING_R = 20;   // el radio del CSS: calc(var(--r) + 6px)

function drawRing() {
  const w = ring.offsetWidth, h = ring.offsetHeight, r = Math.min(RING_R, w / 2, h / 2);
  const d = `M ${w / 2} ${h} L ${r} ${h} A ${r} ${r} 0 0 1 0 ${h - r} L 0 ${r} A ${r} ${r} 0 0 1 ${r} 0 `
          + `L ${w - r} 0 A ${r} ${r} 0 0 1 ${w} ${r} L ${w} ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} Z`;
  ring.style.setProperty('--ring-path', `path("${d}")`);
}

new ResizeObserver(drawRing).observe(ring);

/* --- Arranque ------------------------------------------------------------- */

/* Premiere evalua host.jsx una sola vez, al cargar la extension: recargando el
 * panel se seguia ejecutando el ExtendScript viejo. Cargarlo aqui en cada
 * arranque hace que recargar el panel baste, sin reiniciar Premiere. */
const reloadHost = () => evalScript(`$.evalFile(${JSON.stringify(`${extensionPath()}/host.jsx`)})`);

setLang(cfg.lang);
applyDom();
menu();
reloadHost();
