/*
 * Sidekick - fotograma <-> portapapeles del sistema, como imagen.
 *
 * El puente entre Premiere y el portapapeles es un fichero PNG en disco:
 * Premiere solo sabe escribir fotogramas a disco e importar desde disco, y el
 * portapapeles solo se toca desde el lado HTML. cep.fs mueve los bytes entre
 * ambos, asi que el panel no necesita habilitar Node.js.
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

export function readFileBase64(path) {
  const r = fs().readFile(path, window.cep.encoding.Base64);
  if (r.err) { throw new Error(`No puedo leer el fichero: ${path}`); }
  return r.data;
}

export function writeFileBase64(path, b64) {
  const r = fs().writeFile(path, b64, window.cep.encoding.Base64);
  if (r.err) { throw new Error(`No puedo escribir el fichero: ${path}`); }
}

/** Deja una imagen en el portapapeles del sistema. */
export async function copyImage(blob) {
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return;
  } catch {
    // ClipboardItem no esta en el CEF de las versiones viejas de Premiere.
    // El plan B es copiar una seleccion que contiene la imagen, que si funciona.
  }
  const b64 = await blobToBase64(blob);
  const holder = document.createElement('div');
  holder.contentEditable = 'true';
  holder.style.cssText = 'position:fixed;left:-9999px;top:0;';
  holder.innerHTML = `<img src="data:${blob.type};base64,${b64}">`;
  document.body.appendChild(holder);
  try {
    const range = document.createRange();
    range.selectNodeContents(holder);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    if (!document.execCommand('copy')) { throw new Error('El portapapeles rechazó la imagen.'); }
    sel.removeAllRanges();
  } finally {
    holder.remove();
  }
}

/** La imagen que haya ahora en el portapapeles, o null. */
export async function readImage() {
  const items = await navigator.clipboard.read();
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith('image/'));
    if (type) { return item.getType(type); }
  }
  return null;
}

/** La imagen de un evento paste (Cmd+V), o null. */
export function imageFromPasteEvent(event) {
  for (const item of event.clipboardData?.items ?? []) {
    if (item.type.startsWith('image/')) { return item.getAsFile(); }
  }
  return null;
}

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/tiff': 'tif' };

/** Nombre unico y valido para la imagen pegada, con la extension que toque. */
export function pastedFilename(type, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `pegado_${stamp}.${EXT[type] || 'png'}`;
}
