/* Comprobacion de la conversion de bytes y del nombre de fichero:
 * node js/clipboard.test.mjs
 * Un fallo aqui corrompe la imagen en silencio, que es lo peor que puede pasar. */
import assert from 'node:assert/strict';
import { base64ToBlob, blobToBase64, pastedFilename } from './clipboard.js';

// Cabecera PNG real: bytes altos y un 0x00, justo lo que rompe una conversion
// hecha con cadenas en vez de con bytes.
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0x7f, 0x80]);
const b64 = Buffer.from(PNG).toString('base64');

const blob = base64ToBlob(b64, 'image/png');
assert.equal(blob.type, 'image/png');
assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), PNG, 'base64 -> bytes debe ser exacto');
assert.equal(await blobToBase64(blob), b64, 'ida y vuelta sin perdida');

// Mas de un trozo de 0x8000: verifica el troceado del apply.
const big = new Uint8Array(200_000).map((_, i) => i % 256);
const bigB64 = Buffer.from(big).toString('base64');
assert.equal(await blobToBase64(new Blob([big])), bigB64, 'las imagenes grandes se trocean bien');
assert.deepEqual(new Uint8Array(await base64ToBlob(bigB64).arrayBuffer()), big);

const at = new Date('2026-09-01T18:07:03Z');
assert.equal(pastedFilename('image/png', at), 'pegado_20260901180703.png');
assert.equal(pastedFilename('image/jpeg', at), 'pegado_20260901180703.jpg');
assert.equal(pastedFilename('image/heic', at), 'pegado_20260901180703.png', 'tipo desconocido cae en .png');
assert.ok(!/[\/\\:*?"<>|]/.test(pastedFilename('image/png', at)), 'nombre valido en disco');

console.log('clipboard: todas las comprobaciones pasan');
