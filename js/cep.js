/*
 * Sidekick - envoltorio minimo sobre la API nativa de CEP.
 *
 * Adobe distribuye CSInterface.js (~1000 lineas). De ahi solo se usan cuatro
 * cosas, asi que estan aqui en 40 lineas en vez de embarcar la libreria entera.
 */
// globalThis.window: fuera de CEP (los tests con node) no existe `window`,
// y un ReferenceError al importar el modulo se llevaria por delante el panel.
const cep = globalThis.window?.__adobe_cep__;

/** Ejecuta ExtendScript en Premiere y resuelve con lo que devuelva host.jsx. */
export function evalScript(script) {
  return new Promise((resolve, reject) => {
    if (!cep) { reject(new Error('Panel fuera de CEP: no hay host de Premiere.')); return; }
    cep.evalScript(script, (result) => {
      // CEP devuelve esta cadena literal cuando el script revienta al compilar.
      if (result === 'EvalScript error.') { console.error('[Sidekick] EvalScript error:', script); reject(new Error('Premiere could not run the script. Try Refresh from the panel menu.')); return; }
      resolve(result);
    });
  });
}

/** Llama a una funcion de host.jsx y parte la respuesta "ok\ta\tb". */
export async function host(fn, ...args) {
  const call = `${fn}(${args.map((a) => JSON.stringify(String(a))).join(',')})`;
  const raw = await evalScript(call);
  const [status, ...fields] = String(raw).split('\t');
  // El mensaje es una clave en ingles y lo que sigue son sus argumentos: el
  // panel lo traduce con t(err.message, ...err.args).
  if (status !== 'ok') {
    throw Object.assign(new Error(fields[0] || 'Unknown host error.'), { args: fields.slice(1) });
  }
  return fields;
}

/** Escucha un evento CSXS emitido por host.jsx. */
export function onHostEvent(type, handler) {
  if (!cep) { return; }
  cep.addEventListener(type, (ev) => handler(String(ev.data ?? '').split('\t')));
}

/* El menu del hamburguesa del panel (Close Panel / Undock Panel) lo pinta
 * Premiere; setPanelFlyoutMenu le anade lo nuestro sin quitar lo suyo. */
let onMenuClick = null;

/* Un item es { id, label, checked } o { label, children: [...] } para un
 * submenu; { id: "-" } es un separador. */
const menuXml = (items) => items.map((i) => {
  if (i.id === '-') { return '<MenuItem Label="---"/>'; }
  if (i.children) { return `<MenuItem Label="${i.label}">${menuXml(i.children)}</MenuItem>`; }
  return `<MenuItem Id="${i.id}" Label="${i.label}" Enabled="true" Checked="${!!i.checked}"/>`;
}).join('');

export function setFlyoutMenu(items, onClick) {
  if (!cep) { return; }
  // No es un metodo de __adobe_cep__: CSInterface lo despacha por invokeSync.
  // Llamarlo directo reventaba main.js a medio cargar (ni ajustes ni menu).
  cep.invokeSync('setPanelFlyoutMenu', `<Menu>${menuXml(items)}</Menu>`);

  // El menu se repinta cada vez que cambia el idioma; el oyente, no, o cada
  // clic llegaria multiplicado.
  const first = !onMenuClick;
  onMenuClick = onClick;
  if (!first) { return; }
  cep.addEventListener('com.adobe.csxs.events.flyoutMenuClicked', (ev) => {
    let d = ev.data;
    try { d = JSON.parse(d); } catch { /* ya era objeto */ }
    onMenuClick(d?.menuId ?? d);
  });
}

export function extensionPath() {
  return cep ? cep.getSystemPath('extension') : '';
}
