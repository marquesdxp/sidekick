/* Comprobacion de la heuristica de fichero terminado: node js/watcher.test.mjs */
import assert from 'node:assert/strict';
import { initWatch, stepWatch } from './watcher.js';

const OPTS = { pollMs: 1000, stablePolls: 3, timeoutMs: 60_000 };
const files = (o) => new Map(Object.entries(o));

/** Encadena sondeos, uno por segundo. */
function run(state, polls) {
  let t = state.startedAt;
  for (const f of polls) {
    t += OPTS.pollMs;
    state = stepWatch(state, files(f), t, OPTS);
  }
  return state;
}

// Un fichero nuevo que crece y luego se queda quieto: terminado.
let s = run(initWatch(files({ 'viejo.mov': 100 }), 0), [
  { 'viejo.mov': 100, 'render.mp4': 0 },
  { 'viejo.mov': 100, 'render.mp4': 500 },
  { 'viejo.mov': 100, 'render.mp4': 900 },
  { 'viejo.mov': 100, 'render.mp4': 900 },
  { 'viejo.mov': 100, 'render.mp4': 900 },
]);
assert.equal(s.status, 'watching', 'dos sondeos quietos aun no bastan');
assert.equal(s.target, 'render.mp4');
s = stepWatch(s, files({ 'viejo.mov': 100, 'render.mp4': 900 }), 6000, OPTS);
assert.equal(s.status, 'done', 'tres sondeos quietos = terminado');

// Lo que ya estaba en la carpeta y no cambia nunca se ignora.
s = run(initWatch(files({ 'viejo.mov': 100 }), 0), Array(8).fill({ 'viejo.mov': 100 }));
assert.equal(s.status, 'watching');
assert.equal(s.target, null, 'un fichero preexistente e intacto no es candidato');

// Un fichero vacio no puede considerarse estable.
s = run(initWatch(new Map(), 0), Array(6).fill({ 'render.mp4': 0 }));
assert.equal(s.status, 'watching', 'tamano 0 nunca cuenta como terminado');

// Un temporal que desaparece no deja el vigilante colgado.
s = run(initWatch(new Map(), 0), [
  { 'temp.tmp': 50 },
  { 'temp.tmp': 80 },
  { 'render.mp4': 700 },
  { 'render.mp4': 700 },
  { 'render.mp4': 700 },
  { 'render.mp4': 700 },
]);
assert.equal(s.target, 'render.mp4', 'reelige cuando el candidato se borra');
assert.equal(s.status, 'done');

// Sobrescribir un fichero existente tambien cuenta: cambia de tamano.
s = run(initWatch(files({ 'render.mp4': 100 }), 0), [
  { 'render.mp4': 300 }, { 'render.mp4': 600 },
  { 'render.mp4': 600 }, { 'render.mp4': 600 }, { 'render.mp4': 600 },
]);
assert.equal(s.status, 'done', 'reexportar encima del mismo nombre se detecta');

// Se rinde en vez de sondear para siempre.
s = stepWatch(initWatch(new Map(), 0), files({}), 61_000, OPTS);
assert.equal(s.status, 'timeout');

// Un estado terminado no se reabre con sondeos posteriores.
assert.equal(stepWatch({ ...s, status: 'done' }, files({ a: 1 }), 99_000, OPTS).status, 'done');

console.log('watcher: todas las comprobaciones pasan');
