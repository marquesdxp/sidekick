/*
 * Sidekick - logica del panel.
 *
 * Proyecto independiente. Sin relacion con Postline ni codigo compartido con el.
 */
import { host } from './cep.js';
import { DEFAULTS, initWatch, stepWatch } from './watcher.js';
import {
  base64ToBlob, blobToBase64, copyImage, imageFromPasteEvent, pastedFilename,
  readFileBase64, readImage, writeFileBase64,
} from './clipboard.js';

const CFG_KEY = 'sidekick.config';
const $ = (id) => document.getElementById(id);

/* --- Configuracion local ------------------------------------------------ *
 * localStorage y punto: la URL del Worker, el token y el telefono del cliente
 * son de cada usuario y no deben acabar nunca en un fichero del repositorio.
 * El telefono y la carpeta van por proyecto, porque cada proyecto es un cliente
 * distinto; la URL, el token y el retardo son los mismos siempre. */
const GLOBAL_FIELDS = ['workerUrl', 'workerToken', 'delay'];
const PROJECT_FIELDS = ['phone', 'watchdir'];

const cfg = { delay: '60', projects: {}, ...JSON.parse(localStorage.getItem(CFG_KEY) || '{}') };
let project = '';

const saveCfg = () => localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
const projectCfg = () => (cfg.projects[project] ??= {});

function bindFields() {
  for (const id of GLOBAL_FIELDS) {
    $(id).addEventListener('change', (e) => { cfg[id] = e.target.value.trim(); saveCfg(); });
  }
  for (const id of PROJECT_FIELDS) {
    $(id).addEventListener('change', (e) => { projectCfg()[id] = e.target.value.trim(); saveCfg(); });
  }
}

function renderFields() {
  for (const id of GLOBAL_FIELDS) { $(id).value = cfg[id] || ''; }
  for (const id of PROJECT_FIELDS) { $(id).value = projectCfg()[id] || ''; }
}

/* --- Envio a traves del Worker ------------------------------------------ */

/* El plugin nunca ve el token de Meta: solo conoce la URL del Worker del propio
 * usuario y un token compartido que autoriza la llamada. */
async function sendWhatsApp(text) {
  const url = (cfg.workerUrl || '').trim();
  const token = (cfg.workerToken || '').trim();
  const to = (projectCfg().phone || '').replace(/\D/g, '');
  if (!url) { throw new Error('Falta la URL del Worker en Ajustes.'); }
  if (!token) { throw new Error('Falta el token del Worker en Ajustes.'); }
  if (to.length < 8 || to.length > 15) {
    throw new Error(`Falta el WhatsApp del cliente de «${project}» en Ajustes (con prefijo de país).`);
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-sidekick-token': token },
    body: JSON.stringify({ to, text }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) { throw new Error(explainSendError(res.status, body)); }
  return body;
}

/* Codigos de la Cloud API que conviene traducir: el JSON crudo de Meta no dice
 * nada util en mitad de un render. */
const META_ERRORS = {
  131047: 'El cliente no te ha escrito en las últimas 24 h, así que WhatsApp no deja enviarle este mensaje. Pídele que te escriba y reintenta.',
  131026: 'WhatsApp no puede entregar el mensaje: comprueba que ese número tenga WhatsApp.',
  190: 'El META_TOKEN de tu Worker ha caducado. Genera uno nuevo y vuelve a hacer wrangler secret put.',
};

function explainSendError(status, body) {
  const meta = body?.meta?.error;
  const known = meta && META_ERRORS[meta.code];
  if (known) { return known; }
  if (status === 401) { return 'El Worker rechazó el token. Revísalo en Ajustes.'; }
  if (meta?.message) { return `Meta rechazó el mensaje: ${meta.message}`; }
  return `El Worker respondió ${status}: ${JSON.stringify(body).slice(0, 200)}`;
}

/* --- Vigilancia de la carpeta -------------------------------------------- */

/* cep.fs es sincrona y devuelve { err, data }; err === 0 es exito. Basta para
 * esto, asi que el panel no necesita habilitar Node.js. */
function listFiles(dir) {
  const r = window.cep.fs.readdir(dir);
  if (r.err) { throw new Error(`No puedo leer la carpeta: ${dir}`); }
  const out = new Map();
  for (const name of r.data) {
    if (name.startsWith('.')) { continue; }
    const st = window.cep.fs.stat(`${dir}/${name}`);
    if (st.err || !st.data.isFile()) { continue; }
    out.set(name, st.data.size);
  }
  return out;
}

let timer = null;

function setStatus(msg, cls = 'muted') {
  const el = $('status');
  el.textContent = msg;
  el.className = cls;
}

function stopWatching(msg, cls) {
  clearInterval(timer);
  timer = null;
  $('go').disabled = false;
  $('stop').hidden = true;
  if (msg) { setStatus(msg, cls); }
}

async function announceDone(filename) {
  const delay = Math.max(0, parseInt(cfg.delay, 10) || 0);
  setStatus(`«${filename}» terminado. Aviso al cliente en ${delay} s…`);
  await new Promise((r) => setTimeout(r, delay * 1000));
  try {
    await sendWhatsApp('Exportado.');
    setStatus(`Cliente avisado de «${filename}».`);
  } catch (err) {
    setStatus(`El fichero está listo, pero el aviso falló: ${err.message}`, 'err');
  }
}

async function startNotify() {
  const dir = projectCfg().watchdir;
  try {
    $('go').disabled = true;
    if (!dir) { throw new Error('Elige la carpeta de salida a vigilar.'); }

    const baseline = listFiles(dir); // antes de avisar: si la carpeta falla, no se manda nada
    setStatus(`Avisando al cliente de «${project}»…`);
    await sendWhatsApp(`Exportando el ${project}...`);

    let state = initWatch(baseline, Date.now());
    $('stop').hidden = false;
    setStatus('Aviso enviado. Vigilando la carpeta; exporta cuando quieras.');

    timer = setInterval(() => {
      try {
        state = stepWatch(state, listFiles(dir), Date.now());
      } catch (err) {
        stopWatching(err.message, 'err');
        return;
      }
      if (state.status === 'timeout') {
        stopWatching('Se acabó el tiempo de vigilancia sin ver ningún fichero nuevo.', 'warn');
      } else if (state.status === 'done') {
        stopWatching();
        announceDone(state.target);
      } else if (state.target) {
        setStatus(`Generando «${state.target}»…`);
      }
    }, DEFAULTS.pollMs);
  } catch (err) {
    stopWatching(err.message, 'err');
  }
}

/* --- Portapapeles de imagen --------------------------------------------- */

function setClipStatus(msg, cls = 'muted') {
  const el = $('clipStatus');
  el.textContent = msg;
  el.className = cls;
}

function preview(blob) {
  const img = $('preview');
  URL.revokeObjectURL(img.src);
  img.src = URL.createObjectURL(blob);
  img.hidden = false;
}

/* Fotograma bajo el cursor -> portapapeles del sistema. */
async function copyFrame() {
  try {
    setClipStatus('Exportando el fotograma…');
    const [path] = await host('skExportFrame');
    const blob = base64ToBlob(readFileBase64(path), 'image/png');
    window.cep.fs.deleteFile(path); // el PNG temporal ya vive en el portapapeles
    await copyImage(blob);
    preview(blob);
    setClipStatus('Fotograma copiado. Pégalo donde quieras.');
  } catch (err) {
    setClipStatus(err.message, 'err');
  }
}

/* Imagen del portapapeles -> secuencia activa. */
async function pasteImage(blob) {
  try {
    if (!blob) { throw new Error('No hay ninguna imagen en el portapapeles.'); }
    setClipStatus('Guardando la imagen junto al proyecto…');
    // La carpeta la decide host.jsx: junto al .prproj, nunca en el temporal del
    // sistema, porque Premiere queda enlazado a este fichero para siempre.
    const [dir] = await host('skPasteDir');
    const path = `${dir}/${pastedFilename(blob.type)}`;
    writeFileBase64(path, await blobToBase64(blob));
    const [name, track] = await host('skImportImage', path);
    preview(blob);
    setClipStatus(`«${name}» colocado en V${track}.`);
  } catch (err) {
    setClipStatus(err.message, 'err');
  }
}

/* --- Contexto ------------------------------------------------------------ */

/* El proyecto abierto puede cambiar mientras el panel sigue vivo, y con el
 * cambia el cliente al que hay que avisar. Se relee al recuperar el foco. */
async function refreshContext() {
  try {
    const [proj, seq] = await host('skGetContext');
    if (proj === project) { return; }
    if (timer) { stopWatching('Vigilancia detenida: has cambiado de proyecto.', 'warn'); }
    project = proj;
    $('ctx').textContent = seq ? `${proj} · ${seq}` : proj;
    $('cfgProject').textContent = proj;
    renderFields();
  } catch {
    $('ctx').textContent = 'sin proyecto abierto';
  }
}

/* --- Arranque ------------------------------------------------------------ */

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-on', t === tab));
    document.querySelectorAll('[data-panel]').forEach((p) => {
      p.hidden = p.dataset.panel !== tab.dataset.tab;
    });
  });
});

$('pickWatch').addEventListener('click', () => {
  const r = window.cep.fs.showOpenDialog(false, true, 'Elige la carpeta de salida', projectCfg().watchdir || '', []);
  const path = r?.data?.[0];
  if (!path) { return; }
  projectCfg().watchdir = path;
  $('watchdir').value = path;
  saveCfg();
});
$('go').addEventListener('click', startNotify);
$('stop').addEventListener('click', () => stopWatching('Vigilancia detenida.', 'warn'));
$('copyFrame').addEventListener('click', copyFrame);
$('pasteImg').addEventListener('click', async () => {
  try {
    await pasteImage(await readImage());
  } catch {
    // navigator.clipboard.read puede quedarse sin permiso segun la version de
    // Premiere; con Cmd+V sobre el panel el evento paste siempre llega.
    setClipStatus('No puedo leer el portapapeles desde el botón. Pulsa Cmd+V (Ctrl+V) con el panel enfocado.', 'warn');
  }
});
document.addEventListener('paste', (e) => {
  const blob = imageFromPasteEvent(e);
  if (!blob) { return; }
  e.preventDefault();
  pasteImage(blob);
});
$('test').addEventListener('click', async () => {
  const el = $('cfgStatus');
  try {
    await sendWhatsApp('Mensaje de prueba de Sidekick.');
    el.textContent = 'Enviado. Míralo en WhatsApp.';
    el.className = 'muted';
  } catch (err) {
    el.textContent = err.message;
    el.className = 'err';
  }
});

/* Un <a> normal navegaria dentro del propio panel y lo dejaria inservible:
 * en CEP los enlaces externos salen por el navegador del sistema. */
$('ig').addEventListener('click', (e) => {
  e.preventDefault();
  window.cep.util.openURLInDefaultBrowser(e.currentTarget.href);
});

bindFields();
refreshContext();
window.addEventListener('focus', refreshContext);
