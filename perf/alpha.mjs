// Asks Premiere how it interprets the alpha of the items in the Sidekick bin.
const targets = await (await fetch('http://localhost:8099/json')).json();
const page = targets.find((t) => t.type === 'page' && /sidekick/i.test(t.title + t.url));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id) { pending.get(msg.id)?.(msg); pending.delete(msg.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, (m) => res(m.result)); ws.send(JSON.stringify({ id: i, method, params })); });
const es = (script) => send('Runtime.evaluate', { expression: `new Promise(r => window.__adobe_cep__.evalScript(${JSON.stringify(script)}, r))`, awaitPromise: true, returnByValue: true }).then((r) => r.result.value);
console.log(await es(`(function(){ try {
  var bin = sk_bin("Sidekick"); var out = [];
  var n = bin.children.numItems;
  for (var k = Math.max(0, n - 4); k < n; k++) {
    var it = bin.children[k]; var fi = it.getFootageInterpretation ? it.getFootageInterpretation() : null;
    out.push(it.name + " | alphaUsage=" + (fi ? fi.alphaUsage : "n/a") + " ignoreAlpha=" + (fi ? fi.ignoreAlpha : "n/a") + " invertAlpha=" + (fi ? fi.invertAlpha : "n/a") + " removePulldown=" + (fi ? fi.removePulldown : ""));
  }
  return out.join("\n");
} catch (e) { return "ERR " + e.toString() + " line " + e.line; } })()`));
ws.close();
