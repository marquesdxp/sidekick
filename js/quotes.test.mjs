import assert from 'node:assert/strict';
import { QUOTES, applyKeys, getPhrase } from './quotes.js';

assert.equal(QUOTES.length, 77);
assert.equal(applyKeys('THIS. IS. {PASTE^}!', 'mac', false), 'THIS. IS. CMD+V!');
assert.equal(applyKeys('{MOD} pon, {COPY}', 'win', false), 'Ctrl pon, Ctrl+C');
assert.equal(applyKeys('¡{PASTE^}!', 'mac', true), '¡⌘V!');
// No quote comes out with an unresolved token, in any language or platform.
for (const q of QUOTES) for (const l of ['en', 'es', 'pt']) for (const p of ['win', 'mac']) {
  assert.doesNotMatch(applyKeys(q[l], p, false), /\{[A-Z^]+\}/, `${q.film} ${l} ${p}`);
}
assert.ok(['win', 'mac'].includes(getPhrase('copy', 'en').platform));
console.log('quotes: all checks pass');
