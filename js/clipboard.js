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

/* Not cep.process.waitfor: it blocks the panel's thread for as long as the
 * process runs (measured 160-330 ms for a 4K frame) and freezes every
 * animation with it. Polling isRunning leaves the panel free. */
const exited = (pid) => new Promise((resolve) => {
  const poll = () => (window.cep.process.isRunning(pid).data === true ? setTimeout(poll, 25) : resolve());
  poll();
});

/* --- Windows: one resident PowerShell --------------------------------------
 *
 * Starting powershell.exe costs ~300 ms warm and up to 5 s after a long pause
 * (measured: the whole delay was the process, the script itself 60 ms). One
 * PowerShell is started when the panel opens, loads .NET once and then runs
 * every job in-process: it watches TMP for job_*.ps1, runs the file, writes
 * job_*.log. It exits when Premiere does or when a newer worker replaces it
 * (worker.pid). While it isn't ready yet, or has died, a job falls back to a
 * fresh process as before, and the worker is started again. */
let worker = null;
const workerFile = (name) => `${TMP()}\\worker.${name}`;

const WORKER_SRC = String.raw`
param([string]$dir)
$ErrorActionPreference = 'Continue'
$pidFile = Join-Path $dir 'worker.pid'
$ready = Join-Path $dir 'worker.ready'
# One worker per machine: the previous one is stopped, and also notices the
# pid file changing in case that fails.
$old = "$(Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue)".Trim()
if ($old -and $old -ne "$PID") { Stop-Process -Id ([int]$old) -Force -ErrorAction SilentlyContinue }
Set-Content -LiteralPath $pidFile -Value $PID
# The parent is the panel's CEPHtmlEngine: when the panel closes, so does this.
$parent = [int](Get-CimInstance Win32_Process -Filter "ProcessId=$PID").ParentProcessId
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
# The job's first line is the file the script works on ($sk_path), the rest
# the script. The script text never changes, so PowerShell compiles it (and
# Defender scans it) once: a new text costs ~300 ms every time, measured.
function Run-Job([string]$sk_path, [string]$src) { $out = 'error'; try { Invoke-Expression $src } catch { $out = "error: $_" }; return $out }
$fsw = New-Object IO.FileSystemWatcher $dir, 'job_*.ps1'
# worker.log: one line per job, kept short. Read it when a paste felt slow.
$logFile = Join-Path $dir 'worker.log'
function Log([string]$m) { try { Add-Content -LiteralPath $logFile -Value ("{0:HH:mm:ss.fff} {1} {2}" -f (Get-Date), $PID, $m) } catch {} }
if ((Get-Item -LiteralPath $logFile -ErrorAction SilentlyContinue).Length -gt 200000) { Remove-Item -LiteralPath $logFile -Force -ErrorAction SilentlyContinue }
Log "start (parent $parent)"
Set-Content -LiteralPath $ready -Value $PID
while ($true) {
  $job = Get-ChildItem -LiteralPath $dir -Filter 'job_*.ps1' -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $job) {
    # Blocks at zero CPU until a job file appears, or 2 s to run the checks.
    $null = $fsw.WaitForChanged([IO.WatcherChangeTypes]::Created -bor [IO.WatcherChangeTypes]::Changed, 2000)
    try { $null = [Diagnostics.Process]::GetProcessById($parent) } catch { break }
    if ("$(Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue)".Trim() -ne "$PID") { break }
    continue
  }
  try { $src = [IO.File]::ReadAllText($job.FullName) } catch { Start-Sleep -Milliseconds 5; continue }
  # The panel writes the file in one go, but not atomically: wait for its last line.
  if (-not $src.TrimEnd().EndsWith('#END')) { Start-Sleep -Milliseconds 5; continue }
  Remove-Item -LiteralPath $job.FullName -Force
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $nl = $src.IndexOf([char]10)
  $out = Run-Job $src.Substring(0, $nl).Trim() $src.Substring($nl + 1)
  Set-Content -LiteralPath ($job.FullName -replace '\.ps1$', '.log') -Value $out -Encoding UTF8
  Log ("job {0} ms: {1}" -f $sw.ElapsedMilliseconds, "$out".Substring(0, [Math]::Min(60, "$out".Length)))
  [GC]::Collect()
}
Log "exit"
Remove-Item -LiteralPath $ready -Force -ErrorAction SilentlyContinue
`;

const workerReady = () => !!worker && exists(workerFile('ready'))
  && window.cep.process.isRunning(worker.pid).data === true;

/** Starts the resident PowerShell if it isn't running. Windows only; cheap to call. */
export function warmClipboard() {
  if (isMac || workerReady()) { return; }
  // Still loading .NET (~300 ms): a second start now would only restart it.
  if (worker && performance.now() - worker.startedAt < 5000 && window.cep.process.isRunning(worker.pid).data === true) { return; }
  const script = workerFile('ps1');
  writeText(script, WORKER_SRC);
  window.cep.fs.deleteFile(workerFile('ready'));
  const p = window.cep.process.createProcess(PS, '-STA', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', script, TMP());
  worker = p.err || p.data === undefined ? null : { pid: p.data, startedAt: performance.now() };
  if (!worker) { console.warn('[Sidekick] resident PowerShell did not start', p); return; }
  // The first run of a text costs 1.4 s (compile, Defender scan, .NET JIT of
  // the clipboard code), measured. Paid here, on a throwaway paste into TMP,
  // not on the first click. Copy isn't warmed: it would overwrite the
  // clipboard.
  const warmed = worker;
  const warm = async () => {
    if (worker !== warmed) { return; }
    if (!workerReady()) { setTimeout(warm, 100); return; }
    const path = `${TMP()}\\warm.png`;
    await runInWorker(PS_PASTE, path);
    window.cep.fs.deleteFile(path);
  };
  setTimeout(warm, 100);
}

/* A job for the worker: the script sets $out; the worker writes it to the log. */
async function runInWorker(source, path) {
  const base = `${TMP()}\\job_${Date.now()}`;
  const log = `${base}.log`;
  window.cep.fs.deleteFile(log);
  writeText(`${base}.ps1`, `${path}\n${source}\n#END`);
  const t0 = performance.now();
  await new Promise((resolve) => {
    const poll = () => {
      if (exists(log) && readText(log).trim()) { resolve(); return; }
      // The worker died mid-job: give up, the caller falls back to a process.
      if (!workerReady() && performance.now() - t0 > 3000) { resolve(); return; }
      setTimeout(poll, 15);
    };
    poll();
  });
  const out = readText(log).replace(/^\uFEFF/, '').trim();
  window.cep.fs.deleteFile(`${base}.ps1`);
  window.cep.fs.deleteFile(log);
  console.debug(`[Sidekick] clipboard job ${Math.round(performance.now() - t0)} ms (resident)`);
  return out;
}

async function runScript(source, path) {
  if (!isMac) {
    if (workerReady()) {
      const out = await runInWorker(source, path);
      if (out) { return out; }
    }
    // Not ready: this click pays the process, the next one won't.
    warmClipboard();
  }
  const base = `${TMP()}/sk_${Date.now()}`;
  const script = base + (isMac ? '.js' : '.ps1');
  const log = `${base}.log`;
  // createProcess doesn't redirect. On macOS sh does it; on Windows the .ps1
  // itself writes its result to the log (no cmd in between, which trips over
  // quoted paths). Bypass: the default policy blocks every .ps1.
  writeText(script, isMac ? source : `$sk_path=${psPath(path)}\n$out='error'\ntry {\n${source}\n} catch { $out=\"error: $_\" }\nSet-Content -LiteralPath ${psPath(log)} -Value $out -Encoding UTF8\n`);

  const p = isMac
    ? window.cep.process.createProcess('/bin/sh', '-c', `/usr/bin/osascript -l JavaScript "${script}" >"${log}" 2>&1`)
    : window.cep.process.createProcess(PS, '-STA', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script);
  if (p.err || p.data === undefined) {
    throw fail('Could not reach the system clipboard.', p);
  }
  await exited(p.data);

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
 * 'ok' or the reason in $out, and the panel doesn't tell platforms apart.
 * The file comes in $sk_path, set by the runner, so the text is constant
 * and the resident PowerShell compiles it once (see WORKER_SRC). */
export const PS_COPY = [
  'Add-Type -AssemblyName System.Windows.Forms,System.Drawing',
  '$i=[System.Drawing.Image]::FromFile($sk_path)',
  // copy=$true: without it the clipboard empties when powershell exits.
  '[Windows.Forms.Clipboard]::SetDataObject($i,$true)',
  "$out='ok'",
].join('\n');

export const PS_PASTE = [
  'Add-Type -AssemblyName System.Windows.Forms,System.Drawing',
  '$d=[Windows.Forms.Clipboard]::GetDataObject()',
  // Browsers and most apps that copy a PNG also leave the original bytes
  // under "PNG". Written as they are: alpha intact (GetImage flattens it to
  // 32bppRgb) and nothing to encode, which was 400 ms for a 4K frame.
  '$s=$null; foreach($f in "PNG","image/png"){ if($s -eq $null -and $d.GetDataPresent($f)){ $s=$d.GetData($f) } }',
  "if($s -is [IO.Stream]){ $fs=[IO.File]::Create($sk_path); $s.Position=0; $s.CopyTo($fs); $fs.Close(); $out='ok' }",
  "elseif($s -is [byte[]]){ [IO.File]::WriteAllBytes($sk_path,$s); $out='ok' }",
  'else{ $i=[Windows.Forms.Clipboard]::GetImage()',
  `if($i -eq $null){$out='no-image '+($d.GetFormats() -join ', ')}`,
  "else{$i.Save($sk_path,[System.Drawing.Imaging.ImageFormat]::Png);$out='ok'} }",
].join('\n');

/** Puts the image at `path` on the clipboard. Returns the file used. */
export async function copyFileToClipboard(path) {
  const out = await runScript(isMac ? JXA_COPY(path) : PS_COPY, path);
  if (out !== 'ok') { throw fail('Could not put the image in the clipboard.', out); }
  return path;
}

/** Writes the clipboard image to `path` (PNG). false if there was none. */
export async function clipboardToFile(path) {
  window.cep.fs.deleteFile(path);
  const out = await runScript(isMac ? JXA_PASTE(path) : PS_PASTE, path);
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
