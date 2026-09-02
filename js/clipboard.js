/*
 * Sidekick - fotograma <-> portapapeles del sistema, como imagen.
 *
 * El portapapeles NO se toca con navigator.clipboard: el CEF que embarca
 * Premiere no da permiso de lectura y ClipboardItem no siempre existe, que es
 * justo por lo que Copiar y Pegar no funcionaban. Se usa el portapapeles del
 * sistema operativo (osascript en macOS, powershell en Windows) lanzado con
 * cep.process, que es API nativa de CEP y no necesita habilitar Node.js.
 *
 * El puente sigue siendo un PNG en disco, porque Premiere solo sabe escribir
 * fotogramas a disco e importar desde disco.
 */

/* atob/btoa trabajan con cadenas binarias; se trocean para no reventar la pila
 * con el apply de una imagen de varios megas. */
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

/* El usuario ve una frase limpia y traducible; el detalle tecnico (ruta,
 * salida del script, tipos del portapapeles) va a la consola, que es donde
 * sirve para arreglarlo. */
function fail(key, detail) {
  console.error(`[Sidekick] ${key}`, detail);
  return new Error(key);
}

export function readFileBase64(path) {
  const r = fs().readFile(path, window.cep.encoding.Base64);
  if (r.err) { throw fail('Could not read the image file.', path); }
  return r.data;
}

/* cep.fs.stat no trae tamano fiable: con existir basta. */
const exists = (path) => !fs().stat(path).err;

/* --- Portapapeles del sistema -------------------------------------------- */

const isMac = navigator.platform.startsWith('Mac');
const PS = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const TMP = () => (isMac ? '/tmp/sidekick' : `${window.cep.fs.getUserHomeDirectory?.().data || '.'}\\sidekick`);

function writeText(path, text) {
  window.cep.fs.makedir(TMP());
  const r = window.cep.fs.writeFile(path, text, window.cep.encoding.UTF8);
  if (r.err) { throw fail('Could not write to the temporary folder.', path); }
}

function readText(path) {
  const r = window.cep.fs.readFile(path, window.cep.encoding.UTF8);
  return r.err ? '' : String(r.data);
}

/* El script va a un fichero y la salida a otro, en vez de pelearse con el
 * escapado de comillas dentro de -e/-Command. Sin el log, un fallo de osascript
 * llegaba al panel disfrazado de "no hay imagen en el portapapeles", que es
 * exactamente lo que estaba pasando. */
const psPath = (path) => `'${path.replace(/'/g, "''")}'`;

function runScript(source) {
  const base = `${TMP()}/sk_${Date.now()}`;
  const script = base + (isMac ? '.js' : '.ps1');
  const log = `${base}.log`;
  // createProcess no redirige. En macOS lo hace sh; en Windows el propio .ps1
  // escribe su resultado al log (sin cmd de por medio, que se lia con las
  // comillas de las rutas). Bypass: la politica por defecto bloquea todo .ps1.
  writeText(script, isMac ? source : `$out='error'\ntry {\n${source}\n} catch { $out=\"error: $_\" }\nSet-Content -LiteralPath ${psPath(log)} -Value $out -Encoding UTF8\n`);

  const p = isMac
    ? window.cep.process.createProcess('/bin/sh', '-c', `/usr/bin/osascript -l JavaScript "${script}" >"${log}" 2>&1`)
    : window.cep.process.createProcess(PS, '-STA', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script);
  if (p.err || p.data === undefined) {
    throw fail('Could not reach the system clipboard.', p);
  }
  window.cep.process.waitfor(p.data);

  // Out-File con UTF8 mete BOM: fuera.
  const out = readText(log).replace(/^\uFEFF/, '').trim();
  window.cep.fs.deleteFile(script);
  window.cep.fs.deleteFile(log);
  // Sin salida es que el script ni llego a correr (osascript ausente, permisos,
  // /tmp de solo lectura). Devolver "" aqui se traducia en "no hay imagen".
  if (!out) { throw fail('Could not reach the system clipboard.', script); }
  return out;
}

/* macOS: JXA sobre NSPasteboard, no AppleScript. NSImage lee y escribe
 * cualquier formato que haya en el portapapeles (PNG, TIFF, PDF, JPEG...) sin
 * pasar por sips, y el script es ASCII puro. Probado fuera de Premiere en los
 * dos sentidos; si algo falla, el mensaje trae los tipos que si habia. */
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
  // 4 = NSBitmapImageFileTypePNG. Sale PNG ya, sin sips.
  `  : ($.NSBitmapImageRep.imageRepWithData(img.TIFFRepresentation).representationUsingTypeProperties(4, $()).writeToFileAtomically(${JSON.stringify(path)}, true) ? 'ok' : 'write-failed');`,
].join('\n');

/* Windows: System.Drawing y Windows.Forms, que estan en cualquier PowerShell 5
 * (-STA es obligatorio para tocar el portapapeles). Mismo contrato que los JXA:
 * dejan en $out 'ok' o el motivo, y el panel no distingue plataformas. */
export const PS_COPY = (path) => [
  'Add-Type -AssemblyName System.Windows.Forms,System.Drawing',
  `$i=[System.Drawing.Image]::FromFile(${psPath(path)})`,
  // copy=$true: sin esto el portapapeles se vacia al morir el powershell.
  '[Windows.Forms.Clipboard]::SetDataObject($i,$true)',
  "$out='ok'",
].join('\n');

export const PS_PASTE = (path) => [
  'Add-Type -AssemblyName System.Windows.Forms,System.Drawing',
  '$i=[Windows.Forms.Clipboard]::GetImage()',
  `if($i -eq $null){$out='no-image '+(([Windows.Forms.Clipboard]::GetDataObject().GetFormats()) -join ', ')}`,
  `else{$i.Save(${psPath(path)},[System.Drawing.Imaging.ImageFormat]::Png);$out='ok'}`,
].join('\n');

/** Deja la imagen de `path` en el portapapeles. Devuelve el fichero usado. */
export function copyFileToClipboard(path) {
  const out = runScript(isMac ? JXA_COPY(path) : PS_COPY(path));
  if (out !== 'ok') { throw fail('Could not put the image in the clipboard.', out); }
  return path;
}

/** Escribe la imagen del portapapeles en `path` (PNG). false si no habia. */
export function clipboardToFile(path) {
  window.cep.fs.deleteFile(path);
  const out = runScript(isMac ? JXA_PASTE(path) : PS_PASTE(path));
  if (out.startsWith('no-image')) {
    // Lo que si hay va a la consola: asi se ve si Premiere ha pisado el
    // portapapeles con lo suyo. Al usuario le vale con "no hay imagen".
    console.warn('[Sidekick] clipboard types:', out.slice(9) || 'empty');
    return false;
  }
  if (out !== 'ok') { throw fail('Could not read the image from the clipboard.', out); }
  return exists(path);
}

/** El panel escribe a disco lo que el host le da en base64. */
export function writeFileBase64(path, b64) {
  const r = window.cep.fs.writeFile(path, b64, window.cep.encoding.Base64);
  if (r.err) { throw fail('Could not save the frame to disk.', path); }
}

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/tiff': 'tif' };

/** Nombre unico y valido para la imagen pegada, con la extension que toque. */
export function pastedFilename(type, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `Sidekick_${stamp}.${EXT[type] || 'png'}`;
}
