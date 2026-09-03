/*
 * Sidekick - panel logic.
 */
import { evalScript, extensionPath, host, setFlyoutMenu, systemPath } from './cep.js';
import { LANGS, applyDom, lang, setLang, t } from './i18n.js';
import { getPhrase } from './quotes.js';
import { clipboardToFile, copyFileToClipboard, pastedFilename, writeFileBase64 } from './clipboard.js';

const $ = (id) => document.getElementById(id);
const statusEl = $('status');
const bar = document.querySelector('.bar');

/* Which side the message opens towards: set by the button you just pressed,
 * used by the CSS to decide which button it pushes. */
let side = 'copy';

/* --- Preferences ---------------------------------------------------------- *
 * A JSON file in the user's data folder (~/Library/Application Support on
 * macOS, %APPDATA% on Windows), not localStorage: the panel runs on file://
 * and Premiere wipes its CEP cache whenever it likes, taking everything with
 * it. Not the home folder: cep.fs can't tell where that is, and the "/tmp"
 * fallback meant nothing was remembered on Windows. */
const CFG_FILE = `${systemPath('userData')}/sidekick.json`;
// Where 0.2.0 left it on macOS: read once so nothing is forgotten on upgrade.
const OLD_CFG_FILE = '/tmp/.sidekick.json';

function loadCfg() {
  for (const file of [CFG_FILE, OLD_CFG_FILE]) {
    const r = window.cep.fs.readFile(file, window.cep.encoding.UTF8);
    if (r.err) { continue; }
    try { return JSON.parse(r.data || '{}'); } catch { /* corrupt: try the next */ }
  }
  return {};
}

const cfg = loadCfg();
const saveCfg = () => window.cep.fs.writeFile(CFG_FILE, JSON.stringify(cfg, null, 2), window.cep.encoding.UTF8);

/* --- The message ---------------------------------------------------------- */

/* The quote and its film: one or the other is shown, never both. Clicking
 * switches between them by scrambling the letters. */
let shown = null;   // { text, film }
let showingFilm = false;
let scrambler = null;

const CHARS = '01<>[]{}/\\*+=$#@%&ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const rnd = () => CHARS[Math.floor(Math.random() * CHARS.length)];

/* Decoding: each letter settles at a different moment, left to right, and
 * flickers with a random character until its turn. Fast: a whole sentence
 * reads in half a second. 16 ms per frame is the browser's own rhythm; no rAF
 * needed for 30 letters. */
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

/* The message leaves on its own after 15 s: it's a receipt, not a sign, and
 * the panel has to be clean again without you doing anything. Counted from the
 * last thing you did, be it the action or revealing the film. The button's
 * COPIED goes with it; the bright yellow of the primary stays. */
let hideTimer = null;

function hide() {
  clearTimeout(hideTimer);
  statusEl.className = '';   // fades out with the #status transition
  bar.className = 'bar';     // and the buttons share the space again
  for (const b of tools) { b.classList.remove('is-done', 'is-err'); }
  shown = null;
}

/* In high performance the message is a box over the buttons: it leaves on its
 * own sooner, and a tap dismisses it. */
function scheduleHide() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hide, cfg.perf ? 4_000 : 15_000);
}

/* A forced reflow between removing and adding the class: without it the
 * browser merges both changes into one style and the entrance doesn't animate. */
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

/** Movie quote; the film is revealed by clicking. */
function quote(action, cls = '') {
  shown = { ...getPhrase(action, lang()), cls };
  showingFilm = false;
  say(shown.text, cls);
}

statusEl.addEventListener('click', () => {
  if (cfg.perf) { hide(); return; }
  if (!shown) { return; }
  showingFilm = !showingFilm;
  scrambleTo(showingFilm ? `🎬 ${shown.film}` : shown.text,
    showingFilm ? `is-film ${shown.cls}` : shown.cls);
  scheduleHide();
});

/* --- Buttons -------------------------------------------------------------- */

/* The pressed button flashes green with COPIED / PASTED while the message
 * lasts and becomes the primary; the other one goes back to dim. Removing and
 * re-adding is-done with a reflow in between replays the flash on a repeat. */
const tools = [$('copyFrame'), $('pasteImg')];

function mark(btn, cls) {
  for (const b of tools) { b.classList.remove('is-busy', 'is-done', 'is-err', 'is-primary'); }
  void btn.offsetWidth;
  btn.classList.add(cls, 'is-primary');
}

const flash = (btn) => mark(btn, 'is-done');

/* The click is answered in the same frame, before any work: the button pulses
 * until the result comes in (measured 0.4-1 s: Premiere renders the frame and
 * the clipboard process starts). Neither green nor red yet, there is no
 * result to show. A second press while busy is ignored. */
async function busy(btn) {
  if (btn.classList.contains('is-busy')) { return false; }
  for (const b of tools) { b.classList.remove('is-done', 'is-err'); }
  btn.classList.add('is-busy');
  // The class is on the DOM but not on the screen until the next frame, and
  // createProcess then blocks the thread for ~105 ms: measured, the pulse
  // showed up 110-140 ms after the click. Wait for that frame to be painted.
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  return true;
}

/* Frame under the playhead -> system clipboard. */
async function copyFrame() {
  const btn = $('copyFrame');
  if (!(await busy(btn))) { return; }
  side = 'copy';
  try {
    // Premiere 15-24 writes the frame to disk; Premiere 25 returns it as
    // base64 and the panel saves it. host.jsx says which of the two.
    const [kind, raw, data] = await host('skExportFrame');
    if (kind === 'b64') { writeFileBase64(raw, data); }
    const path = (await copyFileToClipboard(raw)) || raw;
    window.cep.fs.deleteFile(raw); // the temp file now lives in the clipboard
    if (path !== raw) { window.cep.fs.deleteFile(path); }
    flash(btn);
    quote('copy');
  } catch (err) { fail(btn, err); }
}

/* Clipboard image -> active sequence. */
async function pasteImage() {
  const btn = $('pasteImg');
  if (!(await busy(btn))) { return; }
  side = 'paste';
  try {
    // host.jsx picks the folder: next to the .prproj, never the system temp,
    // because Premiere stays linked to this file forever.
    const [dir] = await host('skPasteDir', cfg.dir || '');
    const path = `${dir}/${pastedFilename('image/png')}`;
    // An empty clipboard is the only thing told with a quote; any other
    // failure is said as it is, which is what helps fixing it.
    if (!(await clipboardToFile(path))) { mark(btn, 'is-err'); quote('error', 'err'); return; }
    await host('skImportImage', path, cfg.top ? 1 : 0);
    flash(btn);
    quote('paste');
  } catch (err) { fail(btn, err); }
}

/* Failure: the button turns red and the message is translated, as host.jsx
 * reports it. */
function fail(btn, err) {
  shown = null;
  mark(btn, 'is-err');
  // The detail host.jsx attaches (what Premiere answered) is for the console.
  console.error('[Sidekick]', err.message, ...(err.args || []));
  say(t(err.message, ...(err.args || [])), 'err');
}

$('copyFrame').addEventListener('click', copyFrame);
$('pasteImg').addEventListener('click', pasteImage);

/* The track toggle: stays the way you leave it, like Caps Lock. */
const top = $('topTrack');
const paintTop = () => top.setAttribute('aria-pressed', String(!!cfg.top));
// The menu is redrawn to move its check mark: button and menu are one state.
function toggleTop() { cfg.top = !cfg.top; saveCfg(); paintTop(); menu(); }
// blur(): the button kept keyboard focus and Space/Enter toggled it again.
top.addEventListener('click', () => { toggleTop(); top.blur(); });
paintTop();

/* High performance: no glass, no lights, no transitions; the message is a
 * plain box over the buttons. One class on <body>, the CSS does the rest. */
const paintPerf = () => document.body.classList.toggle('is-perf', !!cfg.perf);
function togglePerf() { cfg.perf = !cfg.perf; saveCfg(); paintPerf(); hide(); menu(); }
paintPerf();

/* --- Panel menu ----------------------------------------------------------- */

const LANG_LABELS = { en: 'EN', es: 'ES', pt: 'PT-BR' };

/* Signature, language and refresh live here: the bar only has room for the
 * two buttons that get used. The menu is redrawn on language change to move
 * the check mark. */
function menu() {
  setFlyoutMenu([
    { id: 'top', label: t('Paste on top'), checked: !!cfg.top },
    { id: 'perf', label: t('High performance'), checked: !!cfg.perf },
    {
      label: t('Paste folder'),
      children: [
        { id: 'dir-default', label: t('Sidekick, next to the project'), checked: !cfg.dir },
        ...(cfg.dir ? [{ id: 'dir-current', label: cfg.dir, checked: true }] : []),
        { id: 'dir-pick', label: t('Choose…') },
      ],
    },
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

/* The folder is picked with Premiere's native dialog and stored relative to
 * the project when possible ("../IMAGES"), so it follows the same structure
 * on every project and every machine. */
async function pickDir() {
  try {
    const [dir] = await host('skPickDir');
    if (!dir) { return; }
    cfg.dir = dir;
    saveCfg();
    menu();
  } catch (err) { fail($('pasteImg'), err); }
}

function onMenu(id) {
  if (id === 'top') { toggleTop(); return; }
  if (id === 'perf') { togglePerf(); return; }
  if (id === 'dir-default') { delete cfg.dir; saveCfg(); menu(); return; }
  if (id === 'dir-pick') { pickDir(); return; }
  if (id === 'refresh') { location.reload(); return; }
  if (id === 'ig') { window.cep.util.openURLInDefaultBrowser('https://www.instagram.com/marquesdxp/'); return; }
  if (id?.startsWith('lang-')) {
    cfg.lang = setLang(id.slice(5));
    saveCfg();
    applyDom();
    menu();
    // The message on screen keeps the language it came out in: the next one
    // is in the new language, and rewriting it now would lie about what you did.
  }
}

/* --- The ring ------------------------------------------------------------- */

/* The capsule outline in px, so the border light can travel along it
 * (offset-path doesn't take box percentages). Starts at the bottom centre and
 * runs clockwise. Redrawn whenever the panel is resized. */
const ring = document.querySelector('.ring');
const RING_R = 20;   // the CSS radius: calc(var(--r) + 6px)

function drawRing() {
  const w = ring.offsetWidth, h = ring.offsetHeight, r = Math.min(RING_R, w / 2, h / 2);
  const d = `M ${w / 2} ${h} L ${r} ${h} A ${r} ${r} 0 0 1 0 ${h - r} L 0 ${r} A ${r} ${r} 0 0 1 ${r} 0 `
          + `L ${w - r} 0 A ${r} ${r} 0 0 1 ${w} ${r} L ${w} ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} Z`;
  ring.style.setProperty('--ring-path', `path("${d}")`);
}

new ResizeObserver(drawRing).observe(ring);

/* --- Startup -------------------------------------------------------------- */

/* Premiere evaluates host.jsx only once, when the extension loads: reloading
 * the panel kept running the old ExtendScript. Loading it here on every start
 * means reloading the panel is enough, no Premiere restart. */
const reloadHost = () => evalScript(`$.evalFile(${JSON.stringify(`${extensionPath()}/host.jsx`)})`);

setLang(cfg.lang);
applyDom();
menu();
reloadHost();
