/*
 * TweakTools - logica del panel.
 *
 * Proyecto independiente. Sin relacion con Postline ni codigo compartido con el.
 */
import { host, onHostEvent } from './cep.js';

const HOST_EVENT = 'com.andersonmarques.tweaktools.encode';
const CFG_KEY = 'tweaktools.config';
const $ = (id) => document.getElementById(id);

/* --- Configuracion local ------------------------------------------------ *
 * localStorage y punto: la URL del Worker, el token y el telefono del cliente
 * son de cada usuario y no deben acabar nunca en un fichero del repositorio. */
const CFG_FIELDS = ['workerUrl', 'workerToken', 'phone', 'delay', 'preset', 'outdir'];
const cfg = { delay: '60', ...JSON.parse(localStorage.getItem(CFG_KEY) || '{}') };

function saveCfg() {
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
}

function bindCfg() {
  for (const id of CFG_FIELDS) {
    const el = $(id);
    el.value = cfg[id] || '';
    el.addEventListener('change', () => { cfg[id] = el.value.trim(); saveCfg(); });
  }
}

/* --- Envio a traves del Worker ------------------------------------------ */

/* El plugin nunca ve el token de Meta: solo conoce la URL del Worker del propio
 * usuario y un token compartido que autoriza la llamada. */
async function sendWhatsApp(text) {
  const url = (cfg.workerUrl || '').trim();
  const token = (cfg.workerToken || '').trim();
  const to = (cfg.phone || '').replace(/\D/g, '');
  if (!url) { throw new Error('Falta la URL del Worker en Ajustes.'); }
  if (!token) { throw new Error('Falta el token del Worker en Ajustes.'); }
  if (to.length < 8 || to.length > 15) { throw new Error('El teléfono debe tener el prefijo de país y entre 8 y 15 dígitos.'); }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tweaktools-token': token },
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

/* --- Exportar y avisar --------------------------------------------------- */

let pendingJob = null; // jobID que estamos esperando; ignora renders ajenos.

function setStatus(msg, cls = 'muted') {
  const el = $('status');
  el.textContent = msg;
  el.className = cls;
}

async function startExport() {
  const btn = $('go');
  try {
    btn.disabled = true;
    if (!cfg.preset) { throw new Error('Elige un preset .epr.'); }
    if (!cfg.outdir) { throw new Error('Elige una carpeta de salida.'); }

    const [project, sequence] = await host('ttGetContext');
    setStatus(`Avisando de que empieza «${sequence}»…`);
    await sendWhatsApp(`Exportando el ${project} — ${sequence}...`);

    const [jobID] = await host('ttStartExport', cfg.outdir, cfg.preset);
    pendingJob = jobID;
    setStatus(`Renderizando en Media Encoder (trabajo ${jobID}). Te aviso al terminar.`);
  } catch (err) {
    setStatus(err.message, 'err');
  } finally {
    btn.disabled = false;
  }
}

onHostEvent(HOST_EVENT, async ([kind, jobID, info]) => {
  if (jobID !== pendingJob) { return; } // otro render, no es nuestro
  pendingJob = null;

  if (kind === 'canceled') { setStatus('Exportación cancelada. No se envía aviso.', 'warn'); return; }
  if (kind === 'error') { setStatus(`Media Encoder falló: ${info}`, 'err'); return; }

  const delay = Math.max(0, parseInt(cfg.delay, 10) || 0);
  setStatus(`Exportado. Aviso al cliente en ${delay} s…`);
  await new Promise((r) => setTimeout(r, delay * 1000));
  try {
    await sendWhatsApp('Exportado.');
    setStatus('Exportado y cliente avisado.');
  } catch (err) {
    setStatus(`Se exportó, pero el aviso falló: ${err.message}`, 'err');
  }
});

/* --- Selectores de fichero ---------------------------------------------- */

function pick(id, { directory, title, types }) {
  const r = window.cep.fs.showOpenDialog(false, directory, title, cfg[id] || '', types);
  const path = r && r.data && r.data[0];
  if (!path) { return; }
  cfg[id] = path;
  $(id).value = path;
  saveCfg();
}

/* --- Portapapeles -------------------------------------------------------- */

/* navigator.clipboard existe en CEF pero readText puede quedarse sin permiso
 * segun la version de Premiere; execCommand sobre el textarea es el plan B. */
async function readClipboard() {
  try {
    const t = await navigator.clipboard.readText();
    if (t) { return t; }
  } catch { /* sin permiso: seguimos con el plan B */ }
  const box = $('clipbox');
  box.value = '';
  box.focus();
  document.execCommand('paste');
  return box.value;
}

async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch { /* plan B */ }
  const box = $('clipbox');
  box.focus();
  box.select();
  document.execCommand('copy');
}

function setClipStatus(msg, cls = 'muted') {
  const el = $('clipStatus');
  el.textContent = msg;
  el.className = cls;
}

async function copyMarkers() {
  try {
    const [count, text] = await host('ttMarkersToText');
    $('clipbox').value = text || '';
    await writeClipboard(text || '');
    setClipStatus(`${count} marcador(es) en el portapapeles.`);
  } catch (err) {
    setClipStatus(err.message, 'err');
  }
}

async function pasteMarkers() {
  try {
    const text = (await readClipboard()) || $('clipbox').value;
    if (!text.trim()) { throw new Error('El portapapeles está vacío.'); }
    $('clipbox').value = text;
    const [added] = await host('ttMarkersFromText', text);
    setClipStatus(`${added} marcador(es) creados en la secuencia activa.`);
  } catch (err) {
    setClipStatus(err.message, 'err');
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

$('pickPreset').addEventListener('click', () => pick('preset', { directory: false, title: 'Elige un preset de exportación', types: ['epr'] }));
$('pickOut').addEventListener('click', () => pick('outdir', { directory: true, title: 'Elige la carpeta de salida', types: [] }));
$('go').addEventListener('click', startExport);
$('copyMk').addEventListener('click', copyMarkers);
$('pasteMk').addEventListener('click', pasteMarkers);
$('test').addEventListener('click', async () => {
  const el = $('cfgStatus');
  try {
    await sendWhatsApp('Mensaje de prueba de TweakTools.');
    el.textContent = 'Enviado. Míralo en WhatsApp.';
    el.className = 'muted';
  } catch (err) {
    el.textContent = err.message;
    el.className = 'err';
  }
});

bindCfg();
host('ttGetContext')
  .then(([project, sequence]) => { $('ctx').textContent = `${project} · ${sequence}`; })
  .catch(() => { $('ctx').textContent = 'sin secuencia activa'; });
