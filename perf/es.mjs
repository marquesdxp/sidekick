// Runs one ExtendScript expression in Premiere through the panel: node perf/es.mjs "<script>"
const targets = await (await fetch('http://localhost:8099/json')).json();
const page = targets.find((t) => t.type === 'page' && /sidekick/i.test(t.title + t.url));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id) { pending.get(msg.id)?.(msg); pending.delete(msg.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, (m) => res(m.result)); ws.send(JSON.stringify({ id: i, method, params })); });
const es = (script) => send('Runtime.evaluate', { expression: `new Promise(r => window.__adobe_cep__.evalScript(${JSON.stringify(script)}, r))`, awaitPromise: true, returnByValue: true }).then((r) => r.result.value);
for (const s of process.argv.slice(2)) { console.log(s.slice(0, 70).padEnd(72), '=>', await es(s)); }
ws.close();
