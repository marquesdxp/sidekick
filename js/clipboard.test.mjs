/* Checks for the byte conversion and the file name: node js/clipboard.test.mjs
 * A failure here corrupts the image silently, which is the worst that can happen. */
import assert from 'node:assert/strict';
import { PS_COPY, PS_PASTE, base64ToBlob, blobToBase64, pastedFilename } from './clipboard.js';

// Real PNG header: high bytes and a 0x00, exactly what breaks a conversion
// done with strings instead of bytes.
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0x7f, 0x80]);
const b64 = Buffer.from(PNG).toString('base64');

const blob = base64ToBlob(b64, 'image/png');
assert.equal(blob.type, 'image/png');
assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), PNG, 'base64 -> bytes must be exact');
assert.equal(await blobToBase64(blob), b64, 'round trip without loss');

// More than one 0x8000 chunk: verifies the apply chunking.
const big = new Uint8Array(200_000).map((_, i) => i % 256);
const bigB64 = Buffer.from(big).toString('base64');
assert.equal(await blobToBase64(new Blob([big])), bigB64, 'large images chunk correctly');
assert.deepEqual(new Uint8Array(await base64ToBlob(bigB64).arrayBuffer()), big);

const at = new Date('2026-09-01T18:07:03Z');
assert.equal(pastedFilename('image/png', at), 'Sidekick_20260901180703.png');
assert.equal(pastedFilename('image/jpeg', at), 'Sidekick_20260901180703.jpg');
assert.equal(pastedFilename('image/heic', at), 'Sidekick_20260901180703.png', 'unknown type falls back to .png');
assert.ok(!/[\/\\:*?"<>|]/.test(pastedFilename('image/png', at)), 'valid on-disk name');

console.log('clipboard: all checks pass');

// Windows: the panel reads 'ok' / 'no-image' from the output; a silent script
// reads as "could not reach the clipboard". And quotes are escaped the
// PowerShell way, by doubling, or a path with an apostrophe breaks the script.
assert.match(PS_COPY("C:\\a'b.png"), /'C:\\a''b.png'/);
assert.match(PS_COPY('x.png'), /\n\$out='ok'$/);
assert.match(PS_PASTE('x.png'), /'no-image '/);
assert.match(PS_PASTE('x.png'), /;\$out='ok'\}$/);

// systemPath: the raw CEP call answers a file:// URI with %20 for spaces. On
// macOS "Application Support" has one; a %20 left in would break every write.
const { cleanSystemPath } = await import('./cep.js');
assert.equal(cleanSystemPath('file:///Users/a/Library/Application%20Support'), '/Users/a/Library/Application Support');
assert.equal(cleanSystemPath('file:///C:/Users/a/AppData/Roaming'), 'C:/Users/a/AppData/Roaming');
assert.equal(cleanSystemPath('/Users/a/Library/Application Support'), '/Users/a/Library/Application Support', 'plain paths pass through');
console.log('systemPath: all checks pass');
