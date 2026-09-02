/*
 * Sidekick - minimal wrapper over the native CEP API.
 *
 * Adobe ships CSInterface.js (~1000 lines). Only four things from it are used,
 * so they live here in 40 lines instead of bundling the whole library.
 */
// globalThis.window: outside CEP (node tests) there is no `window`, and a
// ReferenceError while importing the module would take the whole panel down.
const cep = globalThis.window?.__adobe_cep__;

/** Runs ExtendScript inside Premiere and resolves with whatever host.jsx returns. */
export function evalScript(script) {
  return new Promise((resolve, reject) => {
    if (!cep) { reject(new Error('Panel outside CEP: no Premiere host.')); return; }
    cep.evalScript(script, (result) => {
      // CEP returns this literal string when the script fails to compile.
      if (result === 'EvalScript error.') { console.error('[Sidekick] EvalScript error:', script); reject(new Error('Premiere could not run the script. Try Refresh from the panel menu.')); return; }
      resolve(result);
    });
  });
}

/** Calls a host.jsx function and splits the "ok\ta\tb" reply. */
export async function host(fn, ...args) {
  const call = `${fn}(${args.map((a) => JSON.stringify(String(a))).join(',')})`;
  const raw = await evalScript(call);
  const [status, ...fields] = String(raw).split('\t');
  // The message is an English key and what follows are its arguments: the
  // panel translates it with t(err.message, ...err.args).
  if (status !== 'ok') {
    throw Object.assign(new Error(fields[0] || 'Unknown host error.'), { args: fields.slice(1) });
  }
  return fields;
}

/** Listens for a CSXS event dispatched by host.jsx. */
export function onHostEvent(type, handler) {
  if (!cep) { return; }
  cep.addEventListener(type, (ev) => handler(String(ev.data ?? '').split('\t')));
}

/* The panel's hamburger menu (Close Panel / Undock Panel) is drawn by
 * Premiere; setPanelFlyoutMenu appends ours without removing theirs. */
let onMenuClick = null;

/* An item is { id, label, checked } or { label, children: [...] } for a
 * submenu; { id: "-" } is a separator. */
const xml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const menuXml = (items) => items.map((i) => {
  if (i.id === '-') { return '<MenuItem Label="---"/>'; }
  if (i.children) { return `<MenuItem Label="${xml(i.label)}">${menuXml(i.children)}</MenuItem>`; }
  // Labels can be paths (the paste folder): escape or "&" / "<" break the menu.
  return `<MenuItem Id="${i.id}" Label="${xml(i.label)}" Enabled="true" Checked="${!!i.checked}"/>`;
}).join('');

export function setFlyoutMenu(items, onClick) {
  if (!cep) { return; }
  // Not a method of __adobe_cep__: CSInterface dispatches it via invokeSync.
  // Calling it directly crashed main.js mid-load (no settings, no menu).
  cep.invokeSync('setPanelFlyoutMenu', `<Menu>${menuXml(items)}</Menu>`);

  // The menu is redrawn on every language change; the listener is not, or
  // every click would arrive multiplied.
  const first = !onMenuClick;
  onMenuClick = onClick;
  if (!first) { return; }
  cep.addEventListener('com.adobe.csxs.events.flyoutMenuClicked', (ev) => {
    let d = ev.data;
    try { d = JSON.parse(d); } catch { /* already an object */ }
    onMenuClick(d?.menuId ?? d);
  });
}

export function extensionPath() {
  return cep ? cep.getSystemPath('extension') : '';
}

/* CEP's own folders as plain paths. 'userData' is ~/Library/Application
 * Support on macOS and %APPDATA% on Windows: always writable, unlike anything
 * relative to Premiere's working directory.
 * The raw call answers a file:// URI with %20 for spaces; this is the same
 * clean-up CSInterface.getSystemPath does. Forward slashes on both platforms,
 * which cep.fs and PowerShell accept on Windows. */
export function cleanSystemPath(raw) {
  return decodeURI(String(raw))
    .replace(/^file:\/\/\/([a-zA-Z]:)/, '$1')   // file:///C:/x -> C:/x
    .replace(/^file:\/\//, '');                 // file:///Users/x -> /Users/x
}

export function systemPath(kind) {
  return cep ? cleanSystemPath(cep.getSystemPath(kind)) : '';
}
