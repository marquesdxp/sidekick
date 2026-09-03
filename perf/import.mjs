// Times app.project.importFiles for each file given, into the Sidekick bin (no clip is placed).
// usage: node import.mjs file1 file2 ... [--port 8099]
const port = 8099;
const files = process.argv.slice(2);
const targets = await (await fetch(`http://localhost:${port}/json`)).json();
const page = targets.find((t) => t.type === 'page' && /sidekick/i.test(t.title + t.url));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id) { pending.get(msg.id)?.(msg); pending.delete(msg.id); } };
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description); return r.result.value; };
await send('Runtime.enable');
for (const f of files) {
  for (let n = 0; n < 2; n++) {
    const r = await evaluate(`new Promise((res) => { const t0 = performance.now(); window.__adobe_cep__.evalScript(${JSON.stringify(
      `(function(){ var bin = sk_bin("Sidekick"); var d = new Date(); var ok = app.project.importFiles([${JSON.stringify(f)}], true, bin, false); var item = bin.children[bin.children.numItems - 1]; return (ok ? 'ok ' : 'FAIL ') + (new Date() - d) + 'ms inside; item=' + (item ? item.name : 'none'); })()`
    )}, (r) => res({ total: +(performance.now() - t0).toFixed(0), r })); })`);
    console.log(`${f.padEnd(60)} run ${n + 1}: ${r.total} ms  (${r.r})`);
  }
}
ws.close();
