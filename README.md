<h1 align="center">Sidekick · Copy &amp; Paste to Premiere Pro</h1>

<p align="center">
  A tiny panel for Adobe Premiere Pro: copy the current frame to your clipboard,<br>
  paste any image from your clipboard straight onto the timeline.
</p>

<p align="center">
  <a href="https://github.com/marquesdxp/sidekick/releases"><img alt="Release" src="https://img.shields.io/github/v/release/marquesdxp/sidekick?style=flat-square&color=FFCC00&labelColor=1c1c1c"></a>
  <img alt="Premiere Pro 15+" src="https://img.shields.io/badge/Premiere%20Pro-15%2B-1c1c1c?style=flat-square&logo=adobepremierepro&logoColor=FFCC00">
  <img alt="macOS & Windows" src="https://img.shields.io/badge/macOS%20%7C%20Windows-1c1c1c?style=flat-square">
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-1c1c1c?style=flat-square"></a>
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

Requires Premiere Pro 15 or later, on macOS or Windows.

**Users:** download `Sidekick-x.y.z.zxp` from the
[releases page](https://github.com/marquesdxp/sidekick/releases) and install it
with [ZXP Installer](https://aescripts.com/learn/zxp-installer/) (free, macOS and
Windows): drag the file in and you're done. Restart Premiere and open it from
**Window → Extensions → Sidekick**.

**Without a ZXP:** clone the repository and double-click **`install.command`**
(macOS) or **`install.bat`** (Windows). It copies the panel into the extensions
folder and turns on CEP debug mode, which lets Premiere load an unsigned
extension.

## Development

```sh
./install.command --link   # symlinks instead of copies: edit, then ≡ → Refresh
npm test                   # clipboard, i18n, quotes and path checks
./build.command            # signs dist/Sidekick-x.y.z.zxp
```

Building the `.zxp` needs `ZXPSignCmd` (from Adobe's
[CEP-Resources](https://github.com/Adobe-CEP/CEP-Resources), `ZXPSignCMD/`
folder) in `tools/`. A self-signed certificate is created on the first run and
never committed. The panel's console is at `http://localhost:8099`.

## How it works

The clipboard is driven through the operating system, not `navigator.clipboard`:
JXA over `NSPasteboard` on macOS, PowerShell on Windows, both launched with
`cep.process`. The CEF embedded in Premiere denies clipboard reads and
`ClipboardItem` isn't always there.

Pasted files live next to the project and **never in a temp folder**: Premiere
links to the file forever, and a temp file would eventually go offline.

Frame export goes through QE (`qe.project…exportFramePNG`), Premiere's internal
DOM, because newer versions no longer expose `exportFrame*` to scripts. If QE is
ever gone too, `renderVideoFrameAtTime` and the four `exportFrame*` calls are
tried as fallbacks, and the panel reports what that version offers.

The default language comes from `navigator.language`, which inside Premiere's
CEF is **Premiere's** language, not the system's. That's why the menu overrides
it.

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
