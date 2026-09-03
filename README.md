<h1 align="center">Sidekick</h1>

<p align="center">
  <b>Copy any frame. Paste any image. Straight onto your Premiere Pro timeline.</b><br>
  Premiere still won't let you copy and paste images. Sidekick does, in one click.
</p>

<p align="center">
  <a href="https://github.com/marquesdxp/sidekick/releases"><img alt="Release" src="https://img.shields.io/github/v/release/marquesdxp/sidekick?style=flat-square&color=FFCC00&labelColor=1c1c1c"></a>
  <img alt="Premiere Pro 15+" src="https://img.shields.io/badge/Premiere%20Pro-15%2B-1c1c1c?style=flat-square&logo=adobepremierepro&logoColor=FFCC00">
  <img alt="macOS & Windows" src="https://img.shields.io/badge/macOS%20%7C%20Windows-1c1c1c?style=flat-square">
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-1c1c1c?style=flat-square"></a>
</p>

<p align="center">
  <a href="https://github.com/marquesdxp/sidekick/releases/latest"><img alt="Download Sidekick" src="https://img.shields.io/badge/%E2%AC%87%20Download%20Sidekick-.zxp%20for%20macOS%20%26%20Windows-FFCC00?style=for-the-badge&labelColor=1c1c1c" height="36"></a>
  &nbsp;
  <a href="#install"><img alt="Install guide" src="https://img.shields.io/badge/Install%20guide-macOS%20%7C%20Windows-1c1c1c?style=for-the-badge" height="36"></a>
</p>

<p align="center">
  <img src="sidekick-screenshot.png" alt="Sidekick panel in Premiere Pro: Copied confirmation, Paste button and Paste on top toggle" width="820">
</p>

<p align="center">
  <a href="https://www.buymeacoffee.com/marquesdxp"><img src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=marquesdxp&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" alt="Buy me a coffee" height="40"></a>
</p>

---

## What it does

Two buttons. That's the whole panel.

**Copy** grabs the frame under the playhead and puts it on the system clipboard
as an image. Paste it into Photoshop, Slack, an email, wherever.

**Paste** takes whatever image is on your clipboard, saves it in a `Sidekick`
folder next to your `.prproj`, imports it into a `Sidekick` bin and drops it at
the playhead. It never overwrites anything already on the timeline.

**Paste on top** (the arrow toggle, or **≡ → Paste on top**) changes where the
image lands:

| Mode | Behaviour |
|------|-----------|
| **Off** (default) | Fills the gap under the playhead on the first free video track. The image is trimmed to fit the gap, so it never eats the next clip. |
| **On** | Keeps the image at its full default duration and stacks it on the lowest track where it fits without touching anything. Creates a new track if none does. |

The toggle works like Caps Lock: it stays the way you leave it, across sessions.

**Paste folder** (**≡ → Paste folder**) is where pasted images are saved. By
default a `Sidekick` folder next to the `.prproj`. Pick any other folder and
it's remembered relative to the project when possible, so `../IMAGES` works
the same on every project that shares your folder structure, and on every
machine. A folder on another drive is kept absolute.

**Three languages.** English, Spanish and Brazilian Portuguese, picked from
**≡ → Language** and remembered in `sidekick.json` in your user data folder
(`~/Library/Application Support` on macOS, `%APPDATA%` on Windows). Anything not translated
falls back to English. Every confirmation is a movie quote; click it to reveal
the film.

## Install

Requires Premiere Pro 15 or later. Same `.zxp` for macOS and Windows.

1. Download **`Sidekick-x.y.z.zxp`** from the [latest release](https://github.com/marquesdxp/sidekick/releases/latest).
2. Install [ZXP Installer](https://aescripts.com/learn/zxp-installer/) (free, macOS and Windows) if you don't have it.
3. Quit Premiere Pro, open ZXP Installer and drag the `.zxp` into it.
4. Start Premiere Pro and open **Window → Extensions → Sidekick**.

Where it ends up, in case you ever want to remove it by hand:

| | Extension folder |
|---|---|
| **macOS** | `~/Library/Application Support/Adobe/CEP/extensions/com.andersonmarques.sidekick` |
| **Windows** | `%APPDATA%\Adobe\CEP\extensions\com.andersonmarques.sidekick` |

**Without a ZXP:** clone the repository and double-click **`install.command`**
(macOS) or **`install.bat`** (Windows). It copies the panel into the folder
above and lets Premiere load it. On macOS, if Gatekeeper refuses to open the script, right-click it
and choose **Open**.

## Development

```sh
./install.command --link   # symlinks instead of copies: edit, then ≡ → Refresh
npm test                   # clipboard, i18n, quotes and path checks
./build.command            # signs dist/Sidekick-x.y.z.zxp
node perf/perf.mjs paste   # click-to-pixels timeline inside Premiere (also copy, idle)
```

Building the `.zxp` needs `ZXPSignCmd` (from Adobe's
[CEP-Resources](https://github.com/Adobe-CEP/CEP-Resources), `ZXPSignCMD/`
folder) in `tools/`. A self-signed certificate is created on the first run and
never committed. The panel's console is at `http://localhost:8099`.

## How it works

The clipboard is driven through the operating system, not `navigator.clipboard`:
JXA over `NSPasteboard` on macOS, PowerShell on Windows, both launched with
`cep.process`. The CEF embedded in Premiere denies clipboard reads and
`ClipboardItem` isn't always there. One such process stays resident while
the panel is open and runs each job in-process (see Performance); its log is
`sidekick/worker.log` in your user data folder.

Pasted files live next to the project and **never in a temp folder**: Premiere
links to the file forever, and a temp file would eventually go offline.

Frame export goes through QE (`qe.project…exportFramePNG`), Premiere's internal
DOM, because newer versions no longer expose `exportFrame*` to scripts. If QE is
ever gone too, `renderVideoFrameAtTime` and the four `exportFrame*` calls are
tried as fallbacks, and the panel reports what that version offers.

The default language comes from `navigator.language`, which inside Premiere's
CEF is **Premiere's** language, not the system's. That's why the menu overrides
it.

## Performance

Copy and Paste used to feel slow: no visible reaction for a second or more,
and animations that moved in steps. Everything was measured inside Premiere
through the panel's remote-debugging port (the scripts are in `perf/`), and
the delay was never where it looked like it was.

**What was found**

- The animations were not the problem. Premiere's CEF paints at 30 fps
  whatever the CSS does, so they look stepped; they cost ~5 % of the main
  thread and drop no frames. The delay was elsewhere.
- **Copy** spent 740 ms compressing a 4K frame to PNG (the render itself is
  fast) and then blocked the panel while waiting for the clipboard helper.
- **Paste on Windows** launched a fresh `powershell.exe` on every click:
  ~300 ms warm, up to 5 s after a long pause. On top of that, PowerShell
  compiles (and Defender scans) every *distinct* script text, ~300 ms, and
  the script text changed on every click because it embedded the file name.
- A transparent PNG copied from a browser lost its alpha on Windows: the
  clipboard was read as a flattened bitmap although the original PNG bytes
  were right there under the `PNG` format.

**What changed**

- The button reacts in the same tick as the click, before any work starts.
- Frames are exported as TIFF (40 ms) instead of PNG (740 ms) for Copy.
- The clipboard helper is never awaited synchronously; the panel stays live.
- One clipboard helper stays resident per panel (PowerShell on Windows,
  osascript on macOS): started when the panel opens, runtime loaded once,
  each job runs in-process. It exits with the panel. If it isn't ready, the
  click falls back to a fresh process, as before.
- The helper scripts are constant text and receive the file path separately,
  so they are compiled once.
- A PNG on the clipboard is written byte for byte: alpha intact, nothing to
  encode. Other formats go through the OS image APIs as before.
- **≡ → High performance**: no glass, no lights, no transitions, for
  machines or sessions where every frame counts.

**Measured** (4K vertical sequence, Premiere 26.3.2; times from the click)

| | Mac, M3 Max, before | Mac, after | Windows, RTX 3080, before | Windows, after |
|---|---|---|---|---|
| First visible change, Copy | 1061 ms | 1 ms | ~1000 ms | 0 ms |
| First visible change, Paste | 110-140 ms | 19-29 ms | 110-140 ms | 3-60 ms |
| Copy, clipboard ready | 1061 ms | 242 ms | ~1100 ms | 763 ms |
| Paste, browser PNG, clipboard job | 330 ms | *pending Mac test* | 890 ms | 17-32 ms |
| Paste, browser PNG, on the timeline | 580 ms | *pending Mac test* | 1260 ms | 180-400 ms |
| Paste after a long idle | 580 ms | *pending Mac test* | up to 5 s | same as warm |
| Dropped frames during Paste | 0 | 0 | 0 | 0 |

What is left of Paste is Premiere importing the file and refreshing the
project, about 350 ms, which the panel can't touch. Copy on Windows is bound
by GDI+ reading a 33 MB TIFF and serialising it for the clipboard.

**Known limits**

- Photoshop on Windows hands other applications a 24-bit bitmap only and
  refuses to render its own layer formats to another process, so a layer with
  transparency pastes flattened. Every other tool has the same limit. Export
  a PNG, or copy the image from a browser.
- Frames copied by Sidekick have no `PNG` clipboard format, only a bitmap.
  Frames have no alpha, so nothing is lost.

`perf/HANDOFF.md` has the full numbers, how to measure again and what was
tried and rejected (frame-rate flags, TIFF via WIC, DIBV5).

## Known limits

- CEP is deprecated by Adobe. It still works, and it's the only way to reach
  the disk and the clipboard without UXP's restrictions.
- Paste needs a saved project: without a `.prproj` on disk there's no folder to
  put the image in (unless you set an absolute paste folder).

## Found a bug? Have an idea?

[Open an issue](https://github.com/marquesdxp/sidekick/issues). Say which
Premiere version and OS you're on, and paste anything the panel's console
shows (`http://localhost:8099` while Premiere is running). Feature requests are
welcome too.

## License

MIT. See [LICENSE](LICENSE).
