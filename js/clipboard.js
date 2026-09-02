/*
 * Sidekick - frame <-> system clipboard, as an image.
 *
 * The clipboard is NOT touched through navigator.clipboard: the CEF embedded
 * in Premiere denies read access and ClipboardItem doesn't always exist, which
 * is exactly why Copy and Paste didn't work. The operating system's clipboard
 * is used instead (osascript on macOS, powershell on Windows), launched with
 * cep.process, a native CEP API that needs no Node.js enabled.
 *
 * The bridge is still a PNG on disk, because Premiere can only write frames
 * to disk and import from disk.
 */

import { systemPath } from './cep.js';

/* atob/btoa work on binary strings; chunked so a multi-megabyte image doesn't
 * blow the stack through apply. */
const CHUNK = 0x8000;

export function base64ToBlob(b64, type = 'image/png') {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i); }
  return new Blob([bytes], { type });
}

export async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

const fs = () => window.cep.fs;

/* The user sees a clean, translatable sentence; the technical detail (path,
 * script output, clipboard types) goes to the console, where it's useful. */
function fail(key, detail) {
  console.error(`[Sidekick] ${key}`, detail);
  return new Error(key);
}

export function readFileBase64(path) {
  const r = fs().readFile(path, window.cep.encoding.Base64);
  if (r.err) { throw fail('Could not read the image file.', path); }
  return r.data;
}

/* cep.fs.stat doesn't report a reliable size: existing is enough. */
const exists = (path) => !fs().stat(path).err;

/* --- System clipboard ----------------------------------------------------- */

const isMac = navigator.platform.startsWith('Mac');
const PS = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
// cep.fs has no "home" call: getUserHomeDirectory?.() was always undefined and
// Windows ended up with ".\sidekick", relative to Premiere's folder in Program
// Files, which is read-only. userData (%APPDATA%) is always writable.
const TMP = () => (isMac ? '/tmp/sidekick' : `${systemPath('userData').replace(/\//g, '\\')}\\sidekick`);

function writeText(path, text) {
  window.cep.fs.makedir(TMP());
  const r = window.cep.fs.writeFile(path, text, window.cep.encoding.UTF8);
  if (r.err) { throw fail('Could not write to the temporary folder.', path); }
}

function readText(path) {
  const r = window.cep.fs.readFile(path, window.cep.encoding.UTF8);
  return r.err ? '' : String(r.data);
}

/* The script goes to one file and its output to another, instead of fighting
 * quote escaping inside -e/-Command. Without the log, an osascript failure
 * reached the panel disguised as "no image in the clipboard". */
const psPath = (path) => `'${path.replace(/'/g, "''")}'`;

function runScript(source) {
  const base = `${TMP()}/sk_${Date.now()}`;
  const script = base + (isMac ? '.js' : '.ps1');
  const log = `${base}.log`;
  // createProcess doesn't redirect. On macOS sh does it; on Windows the .ps1
  // itself writes its result to the log (no cmd in between, which trips over
  // quoted paths). Bypass: the default policy blocks every .ps1.
  writeText(script, isMac ? source : `$out='error'\ntry {\n${source}\n} catch { $out=\"error: $_\" }\nSet-Content -LiteralPath ${psPath(log)} -Value $out -Encoding UTF8\n`);

  const p = isMac
    ? window.cep.process.createProcess('/bin/sh', '-c', `/usr/bin/osascript -l JavaScript "${script}" >"${log}" 2>&1`)
    : window.cep.process.createProcess(PS, '-STA', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script);
  if (p.err || p.data === undefined) {
    throw fail('Could not reach the system clipboard.', p);
  }
  window.cep.process.waitfor(p.data);

  // Set-Content with UTF8 adds a BOM: strip it.
  const out = readText(log).replace(/^\uFEFF/, '').trim();
  window.cep.fs.deleteFile(script);
  window.cep.fs.deleteFile(log);
  // No output means the script never ran (osascript missing, permissions,
  // read-only temp). Returning "" here used to read as "no image".
  if (!out) { throw fail('Could not reach the system clipboard.', script); }
  return out;
}

/* macOS: JXA over NSPasteboard, not AppleScript. NSImage reads and writes any
 * format the clipboard holds (PNG, TIFF, PDF, JPEG...) without going through
 * sips, and the script is pure ASCII. Tested outside Premiere both ways; on
 * failure the output carries the types that were there. */
const JXA_COPY = (path) => [
  "ObjC.import('AppKit');",
  'var pb = $.NSPasteboard.generalPasteboard; pb.clearContents;',
  `var img = $.NSImage.alloc.initWithContentsOfFile(${JSON.stringify(path)});`,
  "img.isNil() ? 'read-failed' : (pb.writeObjects($.NSArray.arrayWithObject(img)) ? 'ok' : 'write-failed');",
].join('\n');

const JXA_PASTE = (path) => [
  "ObjC.import('AppKit');",
  'var pb = $.NSPasteboard.generalPasteboard;',
  'var img = $.NSImage.alloc.initWithPasteboard(pb);',
  "img.isNil() ? 'no-image ' + ObjC.deepUnwrap(pb.types).join(', ')",
  // 4 = NSBitmapImageFileTypePNG. Comes out as PNG already, no sips.
  `  : ($.NSBitmapImageRep.imageRepWithData(img.TIFFRepresentation).representationUsingTypeProperties(4, $()).writeToFileAtomically(${JSON.stringify(path)}, true) ? 'ok' : 'write-failed');`,
].join('\n');

/* Windows: System.Drawing and Windows.Forms, present in any PowerShell 5
 * (-STA is mandatory to touch the clipboard). Same contract as the JXA: leave
 * 'ok' or the reason in $out, and the panel doesn't tell platforms apart. */
export const PS_COPY = (path) => [
  'Add-Type -AssemblyName System.Windows.Forms,System.Drawing',
  `$i=[System.Drawing.Image]::FromFile(${psPath(path)})`,
  // copy=$true: without it the clipboard empties when powershell exits.
  '[Windows.Forms.Clipboard]::SetDataObject($i,$true)',
  "$out='ok'",
].join('\n');

export const PS_PASTE = (path) => [
  'Add-Type -AssemblyName System.Windows.Forms,System.Drawing',
  '$i=[Windows.Forms.Clipboard]::GetImage()',
  `if($i -eq $null){$out='no-image '+(([Windows.Forms.Clipboard]::GetDataObject().GetFormats()) -join ', ')}`,
  `else{$i.Save(${psPath(path)},[System.Drawing.Imaging.ImageFormat]::Png);$out='ok'}`,
].join('\n');

/** Puts the image at `path` on the clipboard. Returns the file used. */
export function copyFileToClipboard(path) {
  const out = runScript(isMac ? JXA_COPY(path) : PS_COPY(path));
  if (out !== 'ok') { throw fail('Could not put the image in the clipboard.', out); }
  return path;
}

/** Writes the clipboard image to `path` (PNG). false if there was none. */
export function clipboardToFile(path) {
  window.cep.fs.deleteFile(path);
  const out = runScript(isMac ? JXA_PASTE(path) : PS_PASTE(path));
  if (out.startsWith('no-image')) {
    // What IS there goes to the console: that shows whether Premiere has
    // overwritten the clipboard with its own stuff. "No image" is enough for
    // the user.
    console.warn('[Sidekick] clipboard types:', out.slice(9) || 'empty');
    return false;
  }
  if (out !== 'ok') { throw fail('Could not read the image from the clipboard.', out); }
  return exists(path);
}

/** The panel writes to disk what the host hands over as base64. */
export function writeFileBase64(path, b64) {
  const r = window.cep.fs.writeFile(path, b64, window.cep.encoding.Base64);
  if (r.err) { throw fail('Could not save the frame to disk.', path); }
}

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/tiff': 'tif' };

/** Unique, disk-safe name for the pasted image, with the right extension. */
export function pastedFilename(type, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `Sidekick_${stamp}.${EXT[type] || 'png'}`;
}
