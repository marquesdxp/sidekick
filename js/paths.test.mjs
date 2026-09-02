/* Checks for the path helpers in host.jsx, run for both platforms:
 * node js/paths.test.mjs
 * They're ExtendScript, so the block is pulled out of the file and evaluated
 * with a fake $.os. A wrong ".." here writes images into the wrong folder. */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const src = readFileSync(new URL('../host.jsx', import.meta.url), 'utf8');
const body = src.slice(src.indexOf('var SK_WIN'), src.indexOf('/* Folder.create() only'));
for (const os of ['Macintosh OS', 'Windows 10']) {
  const fn = new Function('$', body + '; return { sk_isAbsolute, sk_resolve, sk_relative };');
  const { sk_isAbsolute, sk_resolve, sk_relative } = fn({ os });
  const win = os.startsWith('Windows');
  if (win) {
    assert.equal(sk_resolve('C:\\Proj\\PREMIERE', '../IMAGES'), 'C:/Proj/IMAGES');
    assert.equal(sk_resolve('C:\\Proj\\PREMIERE', 'Sidekick'), 'C:/Proj/PREMIERE/Sidekick');
    assert.equal(sk_resolve('C:\\Proj', '../../..'), 'C:', 'never climbs past the drive');
    assert.equal(sk_resolve('D:\\Img', ''), 'D:/Img');
    assert.equal(sk_relative('C:\\Proj\\PREMIERE', 'C:\\proj\\IMAGES'), '../IMAGES', 'case-insensitive on Windows');
    assert.equal(sk_relative('C:\\Proj\\PREMIERE', 'D:\\Img'), 'D:\\Img', 'other drive stays absolute');
    assert.ok(sk_isAbsolute('C:\\x') && sk_isAbsolute('\\\\server\\share') && !sk_isAbsolute('../x'));
  } else {
    assert.equal(sk_resolve('/Users/a/Proj/PREMIERE', '../IMAGES'), '/Users/a/Proj/IMAGES');
    assert.equal(sk_resolve('/Users/a/Proj/PREMIERE', 'Sidekick'), '/Users/a/Proj/PREMIERE/Sidekick');
    assert.equal(sk_resolve('/Users/a', '../../../..'), '/', 'never climbs past root');
    assert.equal(sk_resolve('/Volumes/Img', ''), '/Volumes/Img');
    assert.equal(sk_relative('/Users/a/Proj/PREMIERE', '/Users/a/Proj/IMAGES'), '../IMAGES');
    assert.equal(sk_relative('/Users/a/Proj/PREMIERE', '/Users/a/Proj/PREMIERE'), '.');
    assert.equal(sk_relative('/Users/a/Proj', '/Volumes/Img'), '/Volumes/Img', 'another volume stays absolute');
    assert.ok(sk_isAbsolute('/x') && !sk_isAbsolute('../x') && !sk_isAbsolute('IMAGES'));
  }
}
console.log('paths: all checks pass');
