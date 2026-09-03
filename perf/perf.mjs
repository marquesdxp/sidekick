// Sidekick perf probe over the CEP remote-debugging port (no code changes in the panel).
// usage: node perf.mjs [copy|paste|idle] [port]
import { writeFileSync } from 'node:fs';

const action = process.argv[2] || 'copy';
const port = process.argv[3] || 8099;
const targets = await (await fetch(`http://localhost:${port}/json`)).json();
const page = targets.find((t) => t.type === 'page' && /sidekick|index\.html/i.test(t.title + t.url)) || targets[0];
if (!page) { throw new Error('no page target: ' + JSON.stringify(targets)); }
console.log('target:', page.title, page.url);

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const traceEvents = []; let traceDone;
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id) { pending.get(msg.id)?.(msg); pending.delete(msg.id); return; }
  if (msg.method === 'Tracing.dataCollected') { traceEvents.push(...msg.params.value); }
  if (msg.method === 'Tracing.tracingComplete') { traceDone?.(); }
  if (msg.method === 'Runtime.consoleAPICalled') {
    console.log('  [panel console]', msg.params.type, msg.params.args.map((a) => a.value ?? a.description).join(' '));
  }
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id; pending.set(i, (m) => (m.error ? rej(new Error(method + ': ' + JSON.stringify(m.error))) : res(m.result)));
  ws.send(JSON.stringify({ id: i, method, params }));
});
const evaluate = async (expression, awaitPromise = false) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
  if (r.exceptionDetails) { throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails)); }
  return r.result.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send('Runtime.enable');

// --- environment ---------------------------------------------------------
console.log('\n== environment ==');
console.log(await evaluate(`(() => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
  const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
  return {
    ua: navigator.userAgent,
    gpuRenderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : (gl ? 'webgl ok, no debug ext' : 'NO WEBGL'),
    dpr: devicePixelRatio, size: innerWidth + 'x' + innerHeight,
    cores: navigator.hardwareConcurrency,
  };
})()`));

// --- instrumentation: wrap the CEP bridge with timers -----------------------
await evaluate(`(() => {
  if (window.__sk) return 'already';
  const log = window.__sk = [];
  const now = () => performance.now();
  const mark = (name, t0, extra) => log.push({ name, at: +t0.toFixed(1), dur: +(now() - t0).toFixed(1), ...extra });
  const ac = window.__adobe_cep__, origEval = ac.evalScript.bind(ac);
  ac.evalScript = (script, cb) => { const t0 = now(); return origEval(script, (r) => { mark('evalScript ' + script.slice(0, 40), t0, { replyBytes: String(r).length }); cb && cb(r); }); };
  const wrap = (obj, key, label) => { const o = obj[key].bind(obj); obj[key] = (...a) => { const t0 = now(); const r = o(...a); mark(label || key, t0); return r; }; };
  wrap(window.cep.process, 'createProcess'); wrap(window.cep.process, 'waitfor');
  wrap(window.cep.fs, 'writeFile'); wrap(window.cep.fs, 'readFile'); wrap(window.cep.fs, 'deleteFile'); wrap(window.cep.fs, 'makedir'); wrap(window.cep.fs, 'stat');
  // first visible change on the buttons / status after the click
  new MutationObserver((muts) => { for (const m of muts) { log.push({ name: 'DOM ' + m.target.id + ' class="' + m.target.className + '"', at: +now().toFixed(1) }); } })
    .observe(document.querySelector('.bar'), { attributes: true, attributeFilter: ['class'], subtree: true });
  // rAF cadence: gaps > 34ms are dropped frames / main-thread stalls
  window.__frames = []; let last = now();
  const tick = (t) => { window.__frames.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  return 'instrumented';
})()`);

const TRACE = ['toplevel', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'blink.user_timing', 'v8.execute'].join(',');

async function trace(seconds, fn) {
  traceEvents.length = 0;
  await send('Tracing.start', { categories: TRACE, transferMode: 'ReportEvents' });
  await evaluate('window.__frames.length = 0; 0');
  await fn();
  await sleep(seconds * 1000);
  const done = new Promise((r) => (traceDone = r));
  await send('Tracing.end');
  await done;
  const frames = await evaluate('window.__frames');
  return { events: traceEvents.slice(), frames };
}

function summarize(label, { events, frames }) {
  const tasks = events.filter((e) => e.name === 'RunTask' && e.dur);
  const threads = {};
  for (const e of events) { if (e.name === 'thread_name') { threads[e.tid] = e.args.name; } }
  const mainTid = Object.entries(threads).find(([, n]) => n === 'CrRendererMain')?.[0];
  const main = tasks.filter((e) => String(e.tid) === String(mainTid));
  const busy = main.reduce((s, e) => s + e.dur, 0) / 1000;
  const span = main.length ? (Math.max(...main.map((e) => e.ts + e.dur)) - Math.min(...main.map((e) => e.ts))) / 1000 : 0;
  const long = main.filter((e) => e.dur > 50_000).sort((a, b) => b.dur - a.dur);
  const kinds = {};
  for (const e of events) { if (String(e.tid) === String(mainTid) && e.dur && /^(Layout|UpdateLayoutTree|Paint|PrePaint|Composite|FunctionCall|TimerFire|EventDispatch|Animation|UpdateLayer|RasterTask|HitTest)/.test(e.name)) { kinds[e.name] = (kinds[e.name] || 0) + e.dur / 1000; } }
  const drawn = events.filter((e) => e.name === 'DrawFrame').length;
  const dropped = frames.filter((g) => g > 34).length;
  console.log(`\n== ${label} ==`);
  console.log(`main thread busy: ${busy.toFixed(0)} ms of ${span.toFixed(0)} ms (${span ? (100 * busy / span).toFixed(0) : 0}%)`);
  console.log(`long tasks (>50ms): ${long.length}`, long.slice(0, 5).map((e) => (e.dur / 1000).toFixed(0) + 'ms').join(', '));
  console.log(`rAF frames: ${frames.length}, gaps >34ms (dropped): ${dropped}, worst gap: ${frames.length ? Math.max(...frames).toFixed(0) : 0} ms; compositor DrawFrame: ${drawn}`);
  console.log('main thread time by kind (ms):', Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, +v.toFixed(0)]).sort((a, b) => b[1] - a[1])));
}

if (action === 'idle') {
  summarize('idle 4s (nothing pressed)', await trace(4, async () => {}));
} else {
  // idle baseline first, short
  summarize('idle 3s baseline', await trace(3, async () => {}));
  await evaluate('window.__sk.length = 0; window.__t0 = performance.now(); 0');
  const btn = action === 'paste' ? 'pasteImg' : 'copyFrame';
  const res = await trace(5, async () => { await evaluate(`window.__t0 = performance.now(); document.getElementById('${btn}').click(); 0`); });
  const t0 = await evaluate('window.__t0');
  const log = await evaluate('window.__sk');
  console.log(`\n== ${action} click timeline (ms after click) ==`);
  for (const e of log) { console.log(`  +${(e.at - t0).toFixed(0).padStart(5)}  ${e.dur !== undefined ? ('dur ' + e.dur + 'ms').padEnd(14) : ''.padEnd(14)} ${e.name}${e.replyBytes ? ' (reply ' + e.replyBytes + ' bytes)' : ''}`);
  }
  const firstDom = log.find((e) => e.name.startsWith('DOM'));
  console.log(`\nFIRST VISIBLE CHANGE: ${firstDom ? (firstDom.at - t0).toFixed(0) + ' ms after click' : 'none within window'}`);
  summarize(`${action} click, 5s window`, res);
  const out = new URL('./trace-' + action + '.json', import.meta.url).pathname; // gitignored
  writeFileSync(out, JSON.stringify({ traceEvents: res.events }));
  console.log('trace saved:', out, '(open in chrome://tracing or DevTools Performance > Load)');
}
ws.close();
