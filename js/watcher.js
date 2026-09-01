/*
 * TweakTools - deteccion de "el fichero ha terminado de generarse".
 *
 * Ni Premiere ni Media Encoder avisan a un panel de un export que no ha lanzado
 * el, asi que se vigila la carpeta de salida. La heuristica es la de siempre:
 * un fichero esta terminado cuando su tamano deja de crecer durante varios
 * sondeos seguidos. Se compara contra una foto de la carpeta tomada al empezar,
 * para no confundirse con lo que ya estaba ahi.
 *
 * Logica pura, sin temporizadores ni acceso a disco: main.js le pasa la lista de
 * ficheros en cada sondeo y watcher.test.mjs la ejercita sin esperar.
 */

export const DEFAULTS = {
  pollMs: 5000,
  stablePolls: 3,           // 3 sondeos x 5 s = 15 s sin crecer
  timeoutMs: 6 * 60 * 60 * 1000,
};

/** @param baseline Map<nombre, tamano> de la carpeta antes de exportar. */
export function initWatch(baseline, now) {
  return { baseline, target: null, lastSize: -1, stable: 0, startedAt: now, status: 'watching' };
}

/**
 * Un sondeo.
 * @param files Map<nombre, tamano> del contenido actual de la carpeta.
 * @returns nuevo estado; `status` pasa a 'done' o 'timeout' cuando toca.
 */
export function stepWatch(state, files, now, opts = DEFAULTS) {
  if (state.status !== 'watching') { return state; }
  if (now - state.startedAt > opts.timeoutMs) { return { ...state, status: 'timeout' }; }

  let { target, lastSize, stable } = state;

  // Media Encoder borra sus temporales a medio camino: si el candidato
  // desaparece, se vuelve a elegir en vez de quedarse colgado esperandolo.
  if (target !== null && !files.has(target)) {
    target = null;
    lastSize = -1;
    stable = 0;
  }

  if (target === null) {
    let best = -1;
    for (const [name, size] of files) {
      const before = state.baseline.get(name);
      if (before !== undefined && before === size) { continue; } // estaba y no ha cambiado
      if (size > best) { best = size; target = name; }
    }
    if (target === null) { return { ...state, target, lastSize, stable }; }
    lastSize = -1;
    stable = 0;
  }

  const size = files.get(target);
  // El tamano 0 no cuenta como estable: Premiere crea el fichero vacio y solo
  // despues empieza a escribir en el.
  if (size === lastSize && size > 0) { stable += 1; } else { stable = 0; lastSize = size; }

  const status = stable >= opts.stablePolls ? 'done' : 'watching';
  return { ...state, target, lastSize, stable, status };
}
