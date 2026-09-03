// Animation cost probe: renderer main-thread busy % and frame cadence, per CSS variant.
const port = 8099;
const targets = await (await fetch(`http://localhost:${port}/json`)).json();
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); let events = []; let traceDone;
ws.onmessage = (m) => { const msg = JSON.parse(m.data);
  if (msg.id) { pending.get(msg.id)?.(msg); pending.delete(msg.id); return; }
  if (msg.method === 'Tracing.dataCollected') { events.push(...msg.params.value); }
  if (msg.method === 'Tracing.tracingComplete') { traceDone?.(); } };
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send('Runtime.enable');
const TRACE = 'toplevel,devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame';

async function measure(label, seconds, setup = '', teardown = '') {
  await ev(`(()=>{ let s=document.getElementById('__v'); if(!s){s=document.createElement('style');s.id='__v';document.head.appendChild(s);} s.textContent=${JSON.stringify(setup)}; window.__g=[]; window.__last=performance.now(); if(!window.__raf){window.__raf=1; const t=(n)=>{window.__g.push(n-window.__last);window.__last=n;requestAnimationFrame(t)}; requestAnimationFrame(t);} return 1})()`);
  await sleep(300);
  events = [];
  await send('Tracing.start', { categories: TRACE, transferMode: 'ReportEvents' });
  await ev('window.__g.length=0');
  if (teardown) { await ev(teardown); }
  await sleep(seconds * 1000);
  const done = new Promise((r) => (traceDone = r)); await send('Tracing.end'); await done;
  const gaps = await ev('window.__g');
  // renderer main = pid whose thread_name has CrRendererMain
  const tn = events.filter((e) => e.name === 'thread_name');
  const rend = tn.find((e) => e.args.name === 'CrRendererMain');
  const isMain = (e) => e.pid === rend.pid && e.tid === rend.tid;
  const tasks = events.filter((e) => e.name === 'RunTask' && e.dur && isMain(e));
  const busy = tasks.reduce((s, e) => s + e.dur, 0) / 1000;
  const kinds = {};
  for (const e of events) if (isMain(e) && e.dur && /^(Layout|UpdateLayoutTree|Paint|PrePaint|FunctionCall|TimerFire|Animation|UpdateLayer|HitTest|ScheduleStyleRecalculation)/.test(e.name)) kinds[e.name] = (kinds[e.name] || 0) + e.dur / 1000;
  const raster = events.filter((e) => e.name === 'RasterTask' && e.dur).reduce((s, e) => s + e.dur, 0) / 1000;
  const gpu = events.filter((e) => e.name === 'GPUTask' && e.dur).reduce((s, e) => s + e.dur, 0) / 1000;
  const fps = gaps.length / seconds;
  const dropped = gaps.filter((g) => g > 40).length;
  console.log(`\n== ${label} (${seconds}s) ==`);
  console.log(`renderer main busy: ${busy.toFixed(0)} ms (${(100 * busy / (seconds * 1000)).toFixed(1)}%)  | raster threads: ${raster.toFixed(0)} ms | GPU tasks: ${gpu.toFixed(0)} ms`);
  console.log(`rAF: ${fps.toFixed(1)} fps, gaps >40ms: ${dropped}, worst ${Math.max(0, ...gaps).toFixed(0)} ms, median ${gaps.length ? gaps.sort((a, b) => a - b)[gaps.length >> 1].toFixed(1) : 0} ms`);
  console.log('by kind (ms):', Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, +v.toFixed(0)]).sort((a, b) => b[1] - a[1])));
}

const NO_RING = '.ring::before{animation:none!important}';
const NO_BLOBS = 'body::before,body::after{animation:none!important}';
const NO_BDF = '.bar::before,.tool,.toggle{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}';
const NO_BLUR = '#status,.ico svg,.lbl>span{filter:none!important}';
const FAST = ':root{--dur:.35s}';

await measure('IDLE as shipped', 4);
await measure('IDLE no ring light', 4, NO_RING);
await measure('IDLE no ring, no blobs', 4, NO_RING + NO_BLOBS);
await measure('IDLE no ring, no blobs, no backdrop-filter', 4, NO_RING + NO_BLOBS + NO_BDF);

// the message transition replayed without the host: same class flip main.js does
const SHOW = `(()=>{const s=document.getElementById('status'),b=document.querySelector('.bar');s.className='';void s.offsetWidth;s.textContent='Frame copied, go paste it somewhere nice';s.className='is-on';b.className='bar is-msg is-copy';document.getElementById('copyFrame').classList.add('is-done','is-primary');return 1})()`;
const HIDE = `(()=>{document.getElementById('status').className='';document.querySelector('.bar').className='bar';document.getElementById('copyFrame').classList.remove('is-done','is-primary');return 1})()`;
for (const [label, css] of [['MESSAGE IN as shipped', ''], ['MESSAGE IN no backdrop-filter', NO_BDF], ['MESSAGE IN no blur transitions', NO_BLUR], ['MESSAGE IN no bdf + no blur + ring/blobs off', NO_BDF + NO_BLUR + NO_RING + NO_BLOBS], ['MESSAGE IN --dur .35s only', FAST]]) {
  await ev(HIDE); await sleep(900);
  await measure(label, 1.2, css, SHOW);
}
await ev(HIDE); await ev("document.getElementById('__v').textContent=''");
ws.close();
