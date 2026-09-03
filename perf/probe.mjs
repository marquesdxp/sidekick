// Times a PowerShell run launched from inside the panel through cep.process.
// usage: node probe.mjs [empty|full] [port]
const port = process.argv[3] || 8099;
const targets = await (await fetch(`http://localhost:${port}/json`)).json();
const page = targets.find((t) => t.type === 'page' && /sidekick/i.test(t.title + t.url));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id) { pending.get(msg.id)?.(msg); pending.delete(msg.id); } };
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description); return r.result.value; };
await send('Runtime.enable');
const mode = process.argv[2] || 'full';
const dir = 'C:\\Users\\ander\\AppData\\Roaming\\sidekick';
const bodies = {
  empty: '$s=[DateTime]::UtcNow; $out="start=" + $s.ToString("HH:mm:ss.fff") + " end=" + [DateTime]::UtcNow.ToString("HH:mm:ss.fff")',
  full: '$s=[DateTime]::UtcNow; $sw=[Diagnostics.Stopwatch]::StartNew(); Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $a=$sw.ElapsedMilliseconds; $i=[Windows.Forms.Clipboard]::GetImage(); $g=$sw.ElapsedMilliseconds; $i.Save("' + dir.replace(/\\/g, '\\\\') + '\\\\probe.png",[System.Drawing.Imaging.ImageFormat]::Png); $p=$sw.ElapsedMilliseconds; $out="start=" + $s.ToString("HH:mm:ss.fff") + " addtype=" + $a + " getimage=" + ($g-$a) + " savepng=" + ($p-$g) + " end=" + [DateTime]::UtcNow.ToString("HH:mm:ss.fff")',
};
const body = bodies[mode] + "\nSet-Content -LiteralPath '" + dir + "\\probe.log' -Value $out -Encoding UTF8\n";
console.log(await evaluate(`(async () => {
  const PS = 'C:\\\\Windows\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe';
  const dir = ${JSON.stringify(dir)};
  const script = dir + '\\\\probe.ps1', log = dir + '\\\\probe.log';
  window.cep.fs.makedir(dir);
  window.cep.fs.writeFile(script, ${JSON.stringify(body)}, window.cep.encoding.UTF8);
  window.cep.fs.deleteFile(log);
  const wall = () => new Date().toISOString().slice(11, 23);
  const t0 = performance.now(); const w0 = wall();
  const p = window.cep.process.createProcess(PS, '-STA', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script);
  const tCreate = performance.now() - t0;
  let polls = 0, pollCost = 0, first = null;
  while (true) { const a = performance.now(); const r = window.cep.process.isRunning(p.data); pollCost += performance.now() - a; polls++; if (first === null) first = JSON.stringify(r); if (r.data !== true) break; await new Promise((r) => setTimeout(r, 25)); }
  const tExit = performance.now() - t0; const wExit = wall();
  const out = String(window.cep.fs.readFile(log, window.cep.encoding.UTF8).data || '').replace(/^\\uFEFF/, '').trim();
  return { pid: p.data, createProcessMs: +tCreate.toFixed(0), untilNotRunningMs: +tExit.toFixed(0), polls, avgPollMs: +(pollCost / polls).toFixed(2), firstPoll: first, panelCreateAt: w0, panelExitAt: wExit, script: out };
})()`));
ws.close();
