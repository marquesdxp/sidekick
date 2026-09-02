/*
 * Sidekick - translation.
 *
 * The key IS the English text: anything not translated shows up in English,
 * with no fallback file needed.
 * The language comes from the panel menu if you picked one. Otherwise from the
 * system, with a known catch: inside Premiere's CEF, navigator.language is
 * PREMIERE's language, not the operating system's. Hence the menu.
 */
import { STRINGS } from '../i18n/strings.js';

export const LANGS = ['en', 'es', 'pt'];

/** "pt-BR", "pt", "es-419"... -> the matching dictionary block. */
export function pickLang(tag, langs) {
  const low = String(tag || '').toLowerCase();
  const hit = langs.find((l) => low === l.toLowerCase())
    || langs.find((l) => low.startsWith(`${l.toLowerCase()}-`))
    || langs.find((l) => l.toLowerCase().startsWith(`${low.split('-')[0]}-`));
  return hit || 'en';
}

let strings = {};
let current = 'en';

/** Sets the language: 'en' | 'es' | 'pt', or nothing for the system's. */
export function setLang(code) {
  current = LANGS.includes(code) ? code : pickLang(navigator.language, LANGS);
  strings = STRINGS[current] || {};
  return current;
}

/** The language in use, for code that doesn't translate by key (movie quotes). */
export const lang = () => current;

/** t("“{0}” placed on V{1}.", name, track) */
export function t(key, ...args) {
  return (strings[key] || key).replace(/\{(\d)\}/g, (m, i) => (args[i] ?? m));
}

/** Translates the static HTML: data-t for text, data-t-ph for placeholders. */
export function applyDom(root = document) {
  for (const el of root.querySelectorAll('[data-t]')) {
    // textContent would wipe the children: some labels have nodes inside, and
    // translating the panel used to leave them empty.
    const node = [...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.data.trim());
    if (node) { node.data = t(el.dataset.t); } else { el.textContent = t(el.dataset.t); }
  }
  for (const el of root.querySelectorAll('[data-t-ph]')) { el.placeholder = t(el.dataset.tPh); }
  for (const el of root.querySelectorAll('[data-t-title]')) { el.title = t(el.dataset.tTitle); }
}
