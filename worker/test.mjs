/* Comprobacion minima del Worker: node worker/test.mjs
 * Solo cubre auth y validacion, que es lo que evita que esto sea un relay
 * abierto. La llamada a Meta va mockeada; no se envia ningun WhatsApp. */
import assert from 'node:assert/strict';
import worker from './src/index.js';

const ENV = { SIDEKICK_TOKEN: 'secreto', META_TOKEN: 'meta', WABA_PHONE_ID: '123' };
const realFetch = globalThis.fetch;
let lastBody = null;
globalThis.fetch = async (_url, opts) => {
  lastBody = JSON.parse(opts.body);
  return new Response(JSON.stringify({ messages: [{ id: 'wamid.TEST' }] }), { status: 200 });
};

const post = (body, { token = 'secreto', env = ENV } = {}) =>
  worker.fetch(
    new Request('https://x/', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-sidekick-token': token },
      body: JSON.stringify(body),
    }),
    env,
  );

const ok = { to: '34600111222', text: 'Exportado.' };

assert.equal((await post(ok, { token: 'malo' })).status, 401, 'token erroneo debe dar 401');
assert.equal((await post(ok, { token: 'secretooo' })).status, 401, 'longitud distinta debe dar 401');
assert.equal((await post(ok, { env: { ...ENV, META_TOKEN: '' } })).status, 500, 'secreto ausente debe dar 500');
assert.equal((await post({ to: '123', text: 'hola' })).status, 400, 'numero corto debe dar 400');
assert.equal((await post({ to: ok.to, text: '   ' })).status, 400, 'texto vacio debe dar 400');
assert.equal(
  (await post(ok, { env: { ...ENV, ALLOWED_NUMBERS: '34999000111' } })).status,
  403,
  'numero fuera de la lista blanca debe dar 403',
);
assert.equal((await post({ ...ok, to: '+34 600 111 222' })).status, 200, 'debe normalizar espacios y +');
assert.equal(lastBody.to, '34600111222', 'el numero llega normalizado a Meta');

assert.equal((await post({ ...ok, text: 'x'.repeat(5000) })).status, 200);
assert.equal(lastBody.text.body.length, 1000, 'el texto se recorta a 1000 caracteres');

assert.equal(
  (await worker.fetch(new Request('https://x/', { method: 'GET' }), ENV)).status,
  405,
  'GET debe dar 405',
);
assert.equal(
  (await worker.fetch(new Request('https://x/', { method: 'OPTIONS' }), ENV)).status,
  204,
  'OPTIONS debe dar 204 para el preflight CORS',
);

globalThis.fetch = realFetch;
console.log('worker: todas las comprobaciones pasan');
