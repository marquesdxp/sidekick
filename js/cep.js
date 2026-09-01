/*
 * TweakTools - envoltorio minimo sobre la API nativa de CEP.
 *
 * Adobe distribuye CSInterface.js (~1000 lineas). De ahi solo se usan cuatro
 * cosas, asi que estan aqui en 40 lineas en vez de embarcar la libreria entera.
 */
const cep = window.__adobe_cep__;

/** Ejecuta ExtendScript en Premiere y resuelve con lo que devuelva host.jsx. */
export function evalScript(script) {
  return new Promise((resolve, reject) => {
    if (!cep) { reject(new Error('Panel fuera de CEP: no hay host de Premiere.')); return; }
    cep.evalScript(script, (result) => {
      // CEP devuelve esta cadena literal cuando el script revienta al compilar.
      if (result === 'EvalScript error.') { reject(new Error('ExtendScript fallo al evaluar: ' + script)); return; }
      resolve(result);
    });
  });
}

/** Llama a una funcion de host.jsx y parte la respuesta "ok\ta\tb". */
export async function host(fn, ...args) {
  const call = `${fn}(${args.map((a) => JSON.stringify(String(a))).join(',')})`;
  const raw = await evalScript(call);
  const [status, ...fields] = String(raw).split('\t');
  if (status !== 'ok') { throw new Error(fields.join('\t') || 'Error desconocido en el host.'); }
  return fields;
}

/** Escucha un evento CSXS emitido por host.jsx. */
export function onHostEvent(type, handler) {
  if (!cep) { return; }
  cep.addEventListener(type, (ev) => handler(String(ev.data ?? '').split('\t')));
}

export function extensionPath() {
  return cep ? cep.getSystemPath('extension') : '';
}
