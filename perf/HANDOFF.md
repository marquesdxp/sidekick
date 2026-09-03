# Performance work: handoff (2026-09-03)

Branch `perf/instant-feedback`. Read this before continuing on Windows.
Session that produced it: https://claude.ai/code/session_01KQYcg4GMuWSWtWisQTxC6F

## The complaint

Copy and Paste gave no visible reaction for 1-2 s. Animations felt like they
moved in blocks.

## What was measured (Mac, Premiere 26.3.2, M3 Max, 4K vertical sequence)

| Finding | Number |
|---|---|
| First visible change after clicking Copy | 1061 ms |
| QE `exportFramePNG` of a 4K frame (PNG compression, not the render) | 740 ms |
| QE `exportFrameTIFF`, same frame | 36-97 ms |
| `cep.process.createProcess`, even for `/usr/bin/true` | ~125 ms, synchronous, unavoidable |
| `cep.process.waitfor` for osascript | 160 ms (copy), 330 ms (paste), blocks the renderer |
| CEF paint rate, idle or animating, any CSS variant | 30 fps flat (33.3 ms/frame) |
| Main-thread cost of backdrop-filter + ring + blobs + blur transitions | ~5%, zero dropped frames |

Conclusion: the animations were never the CPU problem. They look stepped
because CEP paints at 30 fps. The delay was PNG encoding plus a blocking wait.

## What changed

1. `main.js`: `is-busy` class set in the same tick as the click, before any
   `await`. CSS opacity pulse (compositor-driven, survives a blocked thread).
   Second click while busy is ignored.
2. `host.jsx`: QE export is TIFF, not PNG. Copy went 1061 -> 242 ms.
3. `clipboard.js`: `waitfor` replaced by polling `cep.process.isRunning`
   every 25 ms. `copyFileToClipboard` and `clipboardToFile` are now async.
4. `style.css`: `--dur` 0.7 s -> 0.3 s, every `filter: blur` transition
   removed, sheen shortened. Designed for 30 fps.
5. Menu option **High performance** (`cfg.perf`, `body.is-perf`): no glass,
   no lights, no transitions, flat rounded buttons, message as a box over the
   capsule, tap to dismiss, auto-hide 4 s.
6. Frame-rate cap: tried and rejected. `--disable-frame-rate-limit` +
   `--disable-gpu-vsync` removed the cap entirely (794 fps, CEF GPU helper at
   100% CPU idle, still felt stepped). `--off-screen-frame-rate=144` is
   ignored by CEP (31 fps). The 30 fps cap is Premiere's; nothing left in the
   manifest. Design for 30 fps.
7. `busy()` waits for the pulse to be painted (rAF + setTimeout) before the
   105 ms synchronous `createProcess`; the keyframe starts dim so the first
   frame is a step. Pulse on screen: 19-29 ms after the click, both buttons,
   message open or closed. Before: Paste showed nothing for 110-140 ms.
 8. Paste refused a 52 s gap as "too short" on a 60 fps sequence: the still
   snaps to the indeterminate-media timebase (25 fps), 2.2 sequence frames
   short of the gap, past the two-frame slack. Slack is now max(2 frames,
   1/20 s). Verified on Mac: same spot, pasted.

After: first visible change at 1 ms for both buttons. Copy 242 ms total.
Paste 580 ms total (330 ms is the 4K PNG encode inside osascript, no longer
blocking; kept PNG because that file lives in the project).

## What to test on Windows

Nothing was run on Windows. The specific risks, in order:

1. **TIFF through GDI+**: `System.Drawing.Image.FromFile` on Premiere's 33 MB
   TIFF (may carry alpha). Symptom if it fails: red button, "Could not put the
   image in the clipboard." Rollback: change `TIFF`/`.tif` back to `PNG`/`.png`
   in `sk_qeFrame` and `skExportFrame` in `host.jsx` (three lines).
2. **`isRunning` on the PowerShell pid**: documented for both platforms. Symptom
   if it misbehaves: "Could not reach the system clipboard." on every click.
3. Windows won't reach 242 ms: PowerShell startup + `Add-Type` is 0.6-1.5 s and
   untouched. What changes there is that the panel no longer freezes and the
   button reacts instantly.

## How to measure again

```
sh install.command --link          # Mac; on Windows use install.bat
# close and reopen the panel in Premiere so it restarts and opens port 8099
node perf/perf.mjs copy            # click timeline + first visible change
node perf/perf.mjs paste
node perf/perf.mjs idle            # rAF fps: is the 30 fps cap gone?
node perf/anim.mjs                 # CSS variants, main-thread cost
```

Needs Node 22 (global WebSocket). The scripts monkeypatch `evalScript`,
`createProcess`, `isRunning` and `cep.fs` inside the panel; they change no
files. `.debug` must be inside the installed extension folder and
`PlayerDebugMode` must be 1 for the port to open. On Windows that key is
`HKCU\Software\Adobe\CSXS.12\PlayerDebugMode` (string "1"); `install.bat`
sets it and copies `.debug`.

## Not done

- Pre-warming PowerShell on Windows to hide the 0.6-1.5 s startup.
- A TIFF/JPEG choice for the pasted file (PNG kept on purpose).
- Committing to `main`: the branch waits for the Windows test.

## Windows test (2026-09-03, RTX 3080, Premiere 26.3.2, same 4K vertical sequence)

Session: https://claude.ai/code/session_01FmLWxr9AX38NQcL2MgdrQs

First thing found: the 1.0.0 `.zxp` copy in `Program Files (x86)\Common Files\
Adobe\CEP\extensions\Sidekick` shares the extension ID and Premiere loaded it
instead of the `install.bat` copy in `%APPDATA%`. Moved to the Desktop as
`Sidekick-zxp-backup`. With two copies of the same ID, Program Files wins.

Both risks from the list above passed: TIFF through GDI+ copies fine, and
`isRunning` polling works (0.03 ms per call, exit seen within 25 ms).

| Finding | Number |
|---|---|
| First visible change after Paste | 0 ms; pulse on screen at 12-60 ms |
| Dropped frames during Paste, 5 s window | 0 (30 fps cap here too) |
| Paste, warm, 4K frame from Sidekick Copy | 1260 ms |
| Paste, cold (PowerShell not run for a while) | 4800 ms, all of it in the PowerShell process |
| PowerShell startup + `Add-Type` | ~300 ms |
| `Clipboard.GetImage` | 30 ms |
| PNG encode of the 4K frame, GDI+ or WIC | 400-500 ms (zlib, encoder-independent) |
| TIFF uncompressed / JPEG 95 / BMP encode | 45 / 25 / 28 ms |
| `app.project.importFiles` inside ExtendScript, any format | 50-70 ms |
| `evalScript skImportImage` round trip | 340-400 ms (Premiere refreshing, not ours) |
| Writing 15 MB to the project folder | 5 ms (NVMe, Dropbox running, no effect) |

### Fixed here

`PS_PASTE` in `clipboard.js`: a transparent PNG copied from Chrome pasted with
the alpha flattened (WinForms `GetImage` returns 32bppRgb). The clipboard also
carries the original file bytes under the "PNG" format (that is what Copy
Pasta reads). Those bytes are now written as they are: alpha intact, no
encode, Paste 860 ms for a browser image. `GetImage` stays as the fallback.
Verified: pasted file 32bppArgb with transparent pixels.

Not verified on Mac (one licence, Premiere was open on Windows). `JXA_PASTE`
goes through `NSImage`, which keeps alpha, so it should already work there.

### Scripts added

```
node perf/probe.mjs [empty|full]   # PowerShell launched from the panel: create, script start/end, poll cost
node perf/import.mjs file...       # importFiles timing per format (imports into the Sidekick bin)
node perf/reload.mjs               # Page.reload of the panel after install.bat, no need to reopen it
```

`perf.mjs` trace path fixed for Windows (`fileURLToPath`).

### Resident PowerShell (done, Windows)

"Paste takes forever after a pause" was the process: powershell.exe took up to
5 s to start cold, and Copy Pasta ships a native `bin/CopyPasta.exe` so it
never pays it. Sidekick now keeps one PowerShell alive (`WORKER_SRC` in
`clipboard.js`): started when the panel opens, .NET loaded once, blocks on a
FileSystemWatcher for `job_*.ps1` in `%APPDATA%\sidekick`, runs the job
in-process, writes `job_*.log`. Exits when its parent CEPHtmlEngine does or
when a newer worker writes `worker.pid`. If it isn't ready the click falls
back to a fresh process as before.

Second finding on the way: PowerShell compiles (and Defender scans) each
distinct script text once, ~300 ms, then caches it. The job text used to
embed the timestamped file name, so every click was a new text. `PS_COPY` /
`PS_PASTE` are now constant strings; the file travels as the job's first line
into `$sk_path`. A throwaway paste into TMP at start pays the first compile.

| Paste, Windows, warm | before | now |
|---|---|---|
| clipboard job, browser PNG (alpha kept) | 890 ms (process + encode) | 17 ms |
| clipboard job, 4K frame copied by Sidekick | 890 ms | 445 ms (PNG encode, see PNG vs TIFF) |
| total, browser PNG | 1260 ms | 180-385 ms (Premiere import is the rest) |
| after a long pause | up to 5 s | same as warm (not yet confirmed over hours) |

Copy: job 670 ms warm (GDI+ reads the 33 MB TIFF, SetDataObject serialises
it), 763 ms total; was ~1.1 s.

`%APPDATA%\sidekick\worker.log` has one line per job with its duration:
read it when a paste felt slow. `perf/workers.ps1` lists live workers;
`perf/job.mjs` sends a timing job straight to the worker.

### macOS resident worker (written on Windows, NOT TESTED on Mac)

Same design in JXA (`WORKER_JXA` in `clipboard.js`): `osascript -l
JavaScript worker.js /tmp/sidekick` stays up, polls `/tmp/sidekick` for
`job_*.js` every 20 ms with `delay()`, `eval()`s each job with `sk_path` in
scope, writes `job_*.log` and `worker.log`. `JXA_COPY` / `JXA_PASTE` are
constants now (`sk_path`), and `JXA_PASTE` writes the pasteboard's
`public.png` bytes as they are when there is one (browsers), NSImage
otherwise. The direct osascript path is unchanged apart from the
`var sk_path = ...` line prepended, and it is the fallback whenever the worker
isn't ready.

First thing to do on the Mac, in this order:

1. `sh install.command --link`, open the panel, then `ls /tmp/sidekick` must
   show `worker.pid`, `worker.ready`, `worker.log` with a `start` line and a
   `job ... ms: ok` line from the warm-up paste (`warm.png` is deleted after).
   `ps -p $(cat /tmp/sidekick/worker.pid)` must show osascript.
2. Paste a transparent PNG copied from Chrome, then Copy a frame and paste it
   back. Both must be `ok` in `worker.log`, and the pasted PNG must keep alpha.
3. Close the panel: the osascript process must be gone within ~2 s (parent
   check via `$.getppid()` / `$.kill(pid, 0)` through the ObjC bridge; if the
   `unistd`/`signal` import fails the worker only exits when `worker.pid`
   changes: check `worker.log` says `start (parent <pid>)` with a real pid).
4. Idle CPU of the osascript process in Activity Monitor: `delay(0.02)` plus
   a directory listing. If it shows above ~1%, raise the delay to 0.05.

If anything fails there, `warmClipboard()` in `main.js` can be made
Windows-only again (one `if (isMac) return;`) and the Mac is back to the
per-click osascript, alpha intact.

### Still not done

- PNG vs TIFF for frames copied from Premiere: PNG encode is ~400 ms of the
  445 ms job on Windows; TIFF would be ~45 ms, 32 MB per file. User's call.
- `PS_COPY` puts only a bitmap on the clipboard: a Sidekick frame pasted into
  a browser or Photoshop has no "PNG" format. Frames have no alpha, so it
  only matters for fidelity, not correctness.
- Windows apps that copy without a "PNG" format hit the `GetImage` fallback,
  which flattens alpha. Photoshop was checked and is a dead end: it hands
  other processes a 24-bit DIB only (the DIBV5 Windows synthesises has a zero
  alpha mask), and refuses to render its private "Photoshop DIB Layer" /
  "Adobe Photoshop Image" formats to another process (Win32
  `GetClipboardData` returns 0, error 203). Copy Pasta pastes it flattened
  too. A CF_DIBV5 reader via P/Invoke was prototyped and works (`Format17`
  through WinForms `GetData` is unreliable: null in a fresh process), but no
  source with a real DIBV5 alpha turned up, so it is not in the panel.
- Confirm on Windows that the worker survives hours of idle without the cold
  hit coming back, and check `worker.log` after a slow paste.
