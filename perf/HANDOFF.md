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
6. `manifest.xml`: `--disable-frame-rate-limit` and `--disable-gpu-vsync`.
   **Unverified**: the manifest is read at Premiere start, so it needs a full
   Premiere restart, then `node perf/perf.mjs idle` to see whether rAF goes
   above 31 fps. If it doesn't on Mac, remove both flags.

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
3. **Frame-rate flags**: if the CEF honours them, the ring light and blobs
   animate unbounded and burn CPU. Check Task Manager on the CEPHtmlEngine
   process while the panel is idle. If high, remove the two flags.
4. Windows won't reach 242 ms: PowerShell startup + `Add-Type` is 0.6-1.5 s and
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
