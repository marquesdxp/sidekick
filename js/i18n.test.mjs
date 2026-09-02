/* Checks for the language choice: node js/i18n.test.mjs
 * It's the module's only branching logic, and getting it wrong leaves the
 * panel in a language the user doesn't speak. */
import assert from 'node:assert/strict';
import { pickLang, setLang, t } from './i18n.js';

const LANGS = ['en', 'es', 'pt'];

assert.equal(pickLang('es', LANGS), 'es');
assert.equal(pickLang('es-ES', LANGS), 'es', 'regional variant falls back to the base language');
assert.equal(pickLang('es-419', LANGS), 'es');
assert.equal(pickLang('pt-BR', LANGS), 'pt', 'regional variant falls back to the base language');
assert.equal(pickLang('PT-br', LANGS), 'pt', 'the tag is case-insensitive');
assert.equal(pickLang('pt', LANGS), 'pt');
assert.equal(pickLang('fr-FR', LANGS), 'en', 'untranslated language falls back to English');
assert.equal(pickLang('', LANGS), 'en');
assert.equal(pickLang(undefined, LANGS), 'en');

// Without setLang() the panel is in English and the key is the answer.
assert.equal(t('Copy'), 'Copy', 'no language chosen, English');
assert.equal(setLang('es'), 'es');
assert.equal(t('Pasted'), 'Pegado', 'the button speaks the chosen language');
assert.equal(setLang('pt'), 'pt');
assert.equal(t('Pasted'), 'Colado');
assert.equal(t('Copied'), 'Copiado');
assert.equal(setLang('klingon'), pickLang(navigator?.language ?? 'en', ['en', 'es', 'pt']), 'unknown language falls back to the system one');
setLang('en');
assert.equal(t('“{0}” placed on V{1}.', 'foto.png', 2), '“foto.png” placed on V2.');
assert.equal(t('{0} {1}', 'a'), 'a {1}', 'a slot without argument is left as is');

console.log('i18n: all checks pass');
