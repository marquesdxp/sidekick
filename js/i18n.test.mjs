/* Comprobacion de la eleccion de idioma: node js/i18n.test.mjs
 * Es la unica logica con ramas del modulo, y equivocarse aqui deja el panel en
 * un idioma que el usuario no habla. */
import assert from 'node:assert/strict';
import { pickLang, setLang, t } from './i18n.js';

const LANGS = ['en', 'es', 'pt'];

assert.equal(pickLang('es', LANGS), 'es');
assert.equal(pickLang('es-ES', LANGS), 'es', 'la variante regional cae en el idioma base');
assert.equal(pickLang('es-419', LANGS), 'es');
assert.equal(pickLang('pt-BR', LANGS), 'pt', 'la variante regional cae en el idioma base');
assert.equal(pickLang('PT-br', LANGS), 'pt', 'la etiqueta no distingue mayusculas');
assert.equal(pickLang('pt', LANGS), 'pt');
assert.equal(pickLang('fr-FR', LANGS), 'en', 'idioma sin traducir cae en ingles');
assert.equal(pickLang('', LANGS), 'en');
assert.equal(pickLang(undefined, LANGS), 'en');

// Sin setLang() el panel esta en ingles y la clave es la respuesta.
assert.equal(t('Copy'), 'Copy', 'sin idioma elegido, ingles');
assert.equal(setLang('es'), 'es');
assert.equal(t('Pasted'), 'Pegado', 'el boton habla el idioma elegido');
assert.equal(setLang('pt'), 'pt');
assert.equal(t('Pasted'), 'Colado');
assert.equal(t('Copied'), 'Copiado');
assert.equal(setLang('klingon'), pickLang(navigator?.language ?? 'en', ['en', 'es', 'pt']), 'idioma desconocido cae en el del sistema');
setLang('en');
assert.equal(t('“{0}” placed on V{1}.', 'foto.png', 2), '“foto.png” placed on V2.');
assert.equal(t('{0} {1}', 'a'), 'a {1}', 'un hueco sin argumento se deja tal cual');

console.log('i18n: todas las comprobaciones pasan');
