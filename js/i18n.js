/*
 * Sidekick - traduccion.
 *
 * La clave ES el texto en ingles: lo que no este traducido sale en ingles, sin
 * necesidad de un fichero de respaldo.
 * El idioma sale del menu del panel si lo has elegido. Si no, del sistema, con
 * una pega conocida: en el CEF de Premiere navigator.language es el idioma de
 * PREMIERE, no el del sistema operativo. De ahi que el menu exista.
 */
import { STRINGS } from '../i18n/strings.js';

export const LANGS = ['en', 'es', 'pt'];

/** "pt-BR", "pt", "es-419"... -> el bloque del diccionario que toque. */
export function pickLang(tag, langs) {
  const low = String(tag || '').toLowerCase();
  const hit = langs.find((l) => low === l.toLowerCase())
    || langs.find((l) => low.startsWith(`${l.toLowerCase()}-`))
    || langs.find((l) => l.toLowerCase().startsWith(`${low.split('-')[0]}-`));
  return hit || 'en';
}

let strings = {};
let current = 'en';

/** Fija el idioma: 'en' | 'es' | 'pt', o nada para el del sistema. */
export function setLang(code) {
  current = LANGS.includes(code) ? code : pickLang(navigator.language, LANGS);
  strings = STRINGS[current] || {};
  return current;
}

/** El idioma en uso, para quien no traduce por clave (las frases de cine). */
export const lang = () => current;

/** t("“{0}” placed on V{1}.", name, track) */
export function t(key, ...args) {
  return (strings[key] || key).replace(/\{(\d)\}/g, (m, i) => (args[i] ?? m));
}

/** Traduce el HTML estatico: data-t en el texto, data-t-ph en el placeholder. */
export function applyDom(root = document) {
  for (const el of root.querySelectorAll('[data-t]')) {
    // textContent se llevaria por delante los hijos: hay etiquetas con nodos
    // dentro, y traducir el panel las dejaba vacias.
    const node = [...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.data.trim());
    if (node) { node.data = t(el.dataset.t); } else { el.textContent = t(el.dataset.t); }
  }
  for (const el of root.querySelectorAll('[data-t-ph]')) { el.placeholder = t(el.dataset.tPh); }
  for (const el of root.querySelectorAll('[data-t-title]')) { el.title = t(el.dataset.tTitle); }
}
