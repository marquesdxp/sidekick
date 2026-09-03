/*
 * Sidekick - host.jsx (ExtendScript, Premiere Pro)
 *
 * Every value goes back to the panel as tab-separated strings:
 *   "ok\t<field>\t<field>..."  |  "err\t<message>\t<arg>..."
 *
 * Messages are English and pure ASCII: ExtendScript reads this file with the
 * system encoding (Mac Roman on Mac) and any accent comes out broken. The
 * panel translates them (the key IS the English text) and fills the <arg>s
 * into the {0}s.
 * ExtendScript has no JSON, and a split("\t") is cheaper than shipping a
 * polyfill for three fields.
 */

function sk_clean(name) {
    return String(name).replace(/[\/\\:*?"<>|\t]/g, "_");
}

function sk_activeSequence() {
    if (!app.project) { return null; }
    return app.project.activeSequence || null;
}

/* --- API called by the panel ---------------------------------------------- */

/* The project name is always returned, whether there's an active sequence or
 * not. */
function skGetContext() {
    try {
        if (!app.project) { return "err\tNo project is open."; }
        var projName = app.project.name.replace(/\.prproj$/i, "");
        var seq = sk_activeSequence();
        return "ok\t" + sk_clean(projName) + "\t" + (seq ? sk_clean(seq.name) : "");
    } catch (e) {
        return "err\tPremiere threw an error: {0}\t" + e.toString();
    }
}

/* --- Image clipboard ------------------------------------------------------ */
/* Copy: Premiere can only write a frame to disk, so it's exported to a temp
 * folder and the panel puts it on the clipboard.
 * Paste: the panel leaves the file on disk and here it's imported and placed. */

/* Premiere 25 removed exportFramePNG and friends: in their place there's
 * renderVideoFrameAtTime, which doesn't write to disk but returns the image.
 * The new one is tried first and the old ones after, because the panel has to
 * work on both generations. */
var SK_EXPORTERS = [
    ["exportFramePNG", "png"],
    ["exportFrameTIFF", "tif"],
    ["exportFrameJPEG", "jpg"],
    ["exportFrameTarga", "tga"]
];

function sk_methods(obj) {
    try { return obj.reflect.methods.join(", "); } catch (e) { return "?"; }
}

/* A method's real signature according to ExtendScript: name and type of each
 * argument. It's the only documentation renderVideoFrameAtTime has. */
function sk_sig(obj, name) {
    try {
        var m = obj.reflect.find(name);
        var args = m.arguments || [];
        var out = [];
        for (var i = 0; i < args.length; i++) { out.push(args[i].name + ":" + args[i].dataType); }
        return name + "(" + out.join(", ") + ")" + (m.dataType ? " -> " + m.dataType : "");
    } catch (e) {
        return name + ": " + e.toString();
    }
}

/* The native form of a path ("C:\a\b.png" on Windows). The exporters are not
 * ExtendScript: a mixed "C:\a/b.png" made Premiere on Windows raise "An error
 * occurred while exporting the frame". */
function sk_native(p) { return (new File(p)).fsName; }

/* QE is Premiere's internal DOM: exportFramePNG has always lived there, also
 * in the versions that removed it from the public DOM. */
/* TIFF, not PNG: the render is the same, but compressing a 4K frame to PNG
 * measured 740 ms and writing the TIFF 40 ms. The clipboard reads both. */
function sk_qeFrame(path) {
    app.enableQE();
    var q = qe.project.getActiveSequence();
    if (!q) { return "QE: no active sequence"; }
    if (typeof q.exportFrameTIFF !== "function") { return "QE has no exportFrameTIFF. QE methods: " + sk_methods(q); }
    // QE appends ".tif" to whatever you give it: pass the path without extension.
    q.exportFrameTIFF(q.CTI.timecode, path.replace(/\.tif$/, ""));
    return (new File(path)).exists ? "" : "QE exportFrameTIFF did not write " + path;
}

/* renderVideoFrameAtTime doesn't document what it returns, and it differs
 * between builds: a path, a data URI or bare base64. All three are accepted
 * instead of betting on one. */
function sk_frameResult(out, path) {
    if (out === null || out === undefined || out === false) { return null; }
    if (typeof out === "object") {
        out = out.data || out.base64 || out.path || out.filePath || String(out);
    }
    var s = String(out);
    if (s === "" || s === "true" || s === "undefined") { return null; }

    if (s.substring(0, 11) === "data:image/") {
        return "ok\tb64\t" + path + "\t" + s.substring(s.indexOf(",") + 1);
    }
    // Bare base64: long and without path characters. A path never looks like it.
    if (s.length > 256 && s.indexOf("/") === -1 && s.indexOf("\\") === -1) {
        return "ok\tb64\t" + path + "\t" + s;
    }
    if ((new File(s)).exists) { return "ok\tpath\t" + (new File(s)).fsName + "\t"; }
    return null;
}

/* Exports the frame under the playhead.
 * Returns "ok\tpath\t<path>\t" or "ok\tb64\t<target path>\t<base64>". */
function skExportFrame() {
    try {
        var seq = sk_activeSequence();
        if (!seq) { return "err\tNo active sequence."; }

        var dir = sk_mkdirp(sk_resolve(Folder.temp.fsName, "sidekick"));
        var stamp = (new Date()).getTime();
        var pos = seq.getPlayerPosition();
        var last = "";

        // QE first: it works on every known version.
        var qePath = sk_native(dir.fsName + "/frame_" + stamp + ".tif");
        try {
            last = sk_qeFrame(qePath);
            if (!last) { return "ok\tpath\t" + qePath + "\t"; }
        } catch (qe_err) {
            last = "QE: " + qe_err.toString();
        }

        if (typeof seq.renderVideoFrameAtTime === "function") {
            var dest = sk_native(dir.fsName + "/frame_" + stamp + ".png");
            // Neither the time type nor the argument count is documented and
            // both change between builds: ticks (string), Time object or
            // seconds, with and without a target path. Every combination is
            // tried and the first one returning something wins.
            var times = [pos.ticks, pos, pos.seconds, Number(pos.ticks)];
            for (var a = 0; a < times.length; a++) {
                for (var b = 0; b < 2; b++) {
                    try {
                        var out = b ? seq.renderVideoFrameAtTime(times[a], dest)
                                    : seq.renderVideoFrameAtTime(times[a]);
                        var got = sk_frameResult(out, dest);
                        if (got) { return got; }
                        if ((new File(dest)).exists) { return "ok\tpath\t" + dest + "\t"; }
                        last = "renderVideoFrameAtTime returned nothing useful";
                    } catch (rv) {
                        last = "renderVideoFrameAtTime: " + rv.toString();
                    }
                }
            }
        }

        for (var i = 0; i < SK_EXPORTERS.length; i++) {
            var fn = SK_EXPORTERS[i][0];
            if (typeof seq[fn] !== "function") { continue; }
            var path = sk_native(dir.fsName + "/frame_" + stamp + "." + SK_EXPORTERS[i][1]);
            try {
                seq[fn](pos.ticks, path);
            } catch (inner) {
                last = fn + ": " + inner.toString();
                continue;
            }
            if ((new File(path)).exists) { return "ok\tpath\t" + path + "\t"; }
        }
        return "err\tCould not grab the frame. {0}\t" + last
             + " | " + sk_sig(seq, "renderVideoFrameAtTime")
             + " | " + sk_sig(seq, "renderVideoFrameAtTimeWithColorSpace");
    } catch (e) {
        return "err\tPremiere threw an error: {0}\t" + e.toString();
    }
}

/* --- Paths ---------------------------------------------------------------- */
/* Everything is joined with "/" and normalised here, on both platforms:
 * ExtendScript accepts forward slashes on Windows, and fsName gives back the
 * native form when the panel needs it. */

var SK_WIN = $.os.indexOf("Windows") === 0;

function sk_isAbsolute(p) { return /^([a-zA-Z]:|\\\\|\/)/.test(p); }

function sk_segments(p) {
    var parts = String(p).split(/[\/\\]+/), out = [];
    for (var i = 0; i < parts.length; i++) { if (parts[i] !== "") { out.push(parts[i]); } }
    return out;
}

/* base + relative, resolving "." and "..". Returns "a/b/c" or "C:/a/b". */
function sk_resolve(base, rel) {
    var segs = sk_segments(base).concat(sk_segments(rel)), out = [];
    for (var i = 0; i < segs.length; i++) {
        if (segs[i] === ".") { continue; }
        if (segs[i] === "..") { if (out.length > 1 || (out.length === 1 && !/^[a-zA-Z]:$/.test(out[0]))) { out.pop(); } continue; }
        out.push(segs[i]);
    }
    return (SK_WIN ? "" : "/") + out.join("/");
}

/* Path from `base` to `target` as "../IMAGES"; absolute if they don't share a
 * root (another drive, on Windows). */
function sk_relative(base, target) {
    var a = sk_segments(base), b = sk_segments(target), i = 0;
    var same = function (x, y) { return SK_WIN ? x.toLowerCase() === y.toLowerCase() : x === y; };
    while (i < a.length && i < b.length && same(a[i], b[i])) { i++; }
    if (i === 0) { return target; }
    var up = [];
    for (var j = i; j < a.length; j++) { up.push(".."); }
    var rel = up.concat(b.slice(i)).join("/");
    return rel || ".";
}

/* Folder.create() only makes the last segment: walk up first. */
function sk_mkdirp(path) {
    var f = new Folder(path);
    if (f.exists) { return f; }
    if (f.parent && !f.parent.exists) { sk_mkdirp(f.parent.fsName); }
    f.create();
    return f;
}

function sk_projectDir() {
    if (!app.project || !app.project.path) { return null; }
    return (new File(app.project.path)).parent;
}

/* Folder where the panel must leave the pasted image.
 * By default "Sidekick" next to the .prproj; `custom` can be a path relative
 * to the project ("../IMAGES") or absolute. NEVER the system temp: Premiere
 * stays linked to this file, and a wiped temp folder leaves offline media. */
function skPasteDir(custom) {
    try {
        var proj = sk_projectDir();
        var path;
        if (custom && sk_isAbsolute(custom)) {
            path = sk_resolve(custom, "");
        } else {
            if (!proj) { return "err\tSave the project before pasting: the image needs a folder to live in."; }
            path = sk_resolve(proj.fsName, custom || "Sidekick");
        }
        var f = sk_mkdirp(path);
        if (!f.exists) { return "err\tCould not create the paste folder: {0}\t" + f.fsName; }
        return "ok\t" + f.fsName + "\t";
    } catch (e) {
        return "err\tPremiere threw an error: {0}\t" + e.toString();
    }
}

/* Native folder picker. Returns the choice relative to the project when the
 * project is saved ("../IMAGES"), absolute otherwise; empty if cancelled. */
function skPickDir() {
    try {
        var proj = sk_projectDir();
        var start = proj || Folder.desktop;
        var f = start.selectDlg ? start.selectDlg("Paste folder") : Folder.selectDialog("Paste folder");
        if (!f) { return "ok\t\t"; }
        return "ok\t" + (proj ? sk_relative(proj.fsName, f.fsName) : f.fsName) + "\t";
    } catch (e) {
        return "err\tPremiere threw an error: {0}\t" + e.toString();
    }
}

function sk_bin(name) {
    var root = app.project.rootItem;
    for (var i = 0; i < root.children.numItems; i++) {
        var it = root.children[i];
        if (it.type === ProjectItemType.BIN && it.name === name) { return it; }
    }
    return root.createBin(name);
}

/* Everything that places or measures works in ticks, never seconds: seconds
 * are floats and that's why stray frames were left at the end of the gap. A
 * tick fits comfortably in a double (9e14 for an hour, against the 9e15 it
 * holds), so Number() on the string is exact. */
function sk_ticks(time) { return Number(time.ticks); }

function sk_timeFromTicks(ticks) {
    var t = new Time();
    t.ticks = String(Math.round(ticks));
    return t;
}

/* The first free video track under the playhead, so the edit already there
 * isn't crushed. A blind overwriteClip on V1 would destroy work. */
function sk_freeVideoTrack(seq, atTicks) {
    for (var i = 0; i < seq.videoTracks.numTracks; i++) {
        var track = seq.videoTracks[i];
        if (!track.isTargeted && track.isLocked()) { continue; }
        var busy = false;
        for (var j = 0; j < track.clips.numItems; j++) {
            var c = track.clips[j];
            if (sk_ticks(c.start) <= atTicks && sk_ticks(c.end) > atTicks) { busy = true; break; }
        }
        if (!busy) { return track; }
    }
    return null;
}

/* How long the image lasts as Premiere imported it (the user's still image
 * duration preference). If it can't be read, 5 s, Premiere's factory default. */
function sk_itemTicks(item) {
    var types = [4, 1, 2];
    for (var i = 0; i < types.length; i++) {
        var t = sk_outTicks(item, types[i]);
        if (t > 0) { return t; }
    }
    return 5 * 254016000000;
}

/* The lowest track where the WHOLE image fits without touching anything,
 * scanning bottom-up: it lands right above whatever is in that span, not at
 * the top of the timeline. If it fits nowhere, a new track is added above
 * everything (only QE can create tracks). */
function sk_stackVideoTrack(seq, atTicks, durTicks) {
    var n = seq.videoTracks.numTracks;
    var end = atTicks + durTicks;
    for (var i = 0; i < n; i++) {
        var track = seq.videoTracks[i];
        if (track.isLocked()) { continue; }
        var busy = false;
        for (var j = 0; j < track.clips.numItems; j++) {
            var c = track.clips[j];
            if (sk_ticks(c.start) < end && sk_ticks(c.end) > atTicks) { busy = true; break; }
        }
        if (!busy) { return track; }
    }
    app.enableQE();
    var q = qe.project.getActiveSequence();
    if (!q) { return null; }
    q.addTracks(1, n, 0, 1, 0, 0, 0, 0);
    return seq.videoTracks.numTracks > n ? seq.videoTracks[n] : null;
}

/* Tick where the track's next clip starts, 0 if there is none (gap open until
 * the end of the sequence). */
function sk_nextClipStart(track, atTicks) {
    var next = 0;
    for (var i = 0; i < track.clips.numItems; i++) {
        var s = sk_ticks(track.clips[i].start);
        if (s > atTicks && (next === 0 || s < next)) { next = s; }
    }
    return next;
}

/* The clip occupying that tick: the one just inserted. */
function sk_clipAt(track, atTicks) {
    for (var i = 0; i < track.clips.numItems; i++) {
        var c = track.clips[i];
        if (sk_ticks(c.start) <= atTicks && sk_ticks(c.end) > atTicks) { return c; }
    }
    return null;
}

function sk_outTicks(item, type) {
    try { return sk_ticks(item.getOutPoint(type)); } catch (e) { /* getter without argument */ }
    try { return sk_ticks(item.getOutPoint()); } catch (e) { /* no way */ }
    return -1;
}

/* A still image's duration is set by the user's preference, not by us. To keep
 * it inside the gap the ProjectItem must be trimmed BEFORE inserting: after
 * would be too late, overwriteClip would already have eaten the head of the
 * next clip.
 * setOutPoint's mediaType doesn't mean the same on every build, so the known
 * ones are tried and the result is verified by reading back what stuck. */
/* A Time built both ways: through ticks (the documented setter) and through
 * seconds, which is the one some builds actually honour. */
function sk_timeForm(ticks, form) {
    if (form === 0) { return sk_timeFromTicks(ticks); }
    var t = new Time();
    t.seconds = ticks / 254016000000;
    return t;
}

/* Returns "" when the item's out point sits inside the gap (never past it,
 * at most `tolerance` short: the clip is stretched to the edge after insert).
 * A still snaps its out point to ITS frame rate (the "indeterminate media
 * timebase" preference), not the sequence's: when the snap lands past the
 * gap, less is asked for and read back again. On failure returns what every
 * attempt read back, for the console. */
function sk_trimItem(item, ticks, tolerance) {
    var types = [4, 1, 2], seen = [];
    for (var form = 0; form < 2; form++) {
        for (var i = 0; i < types.length; i++) {
            var target = ticks;
            for (var attempt = 0; attempt < 4; attempt++) {
                try {
                    item.setInPoint(sk_timeForm(0, form), types[i]);
                    item.setOutPoint(sk_timeForm(target, form), types[i]);
                } catch (e) {
                    seen.push("type " + types[i] + "/" + form + " threw " + e.toString());
                    break;
                }
                var got = sk_outTicks(item, types[i]);
                seen.push("type " + types[i] + "/" + form + " asked " + target + " got " + got);
                if (got <= ticks && ticks - got <= tolerance) { return ""; }
                // Past the gap: the snap rounded up. Ask for that much less.
                if (got > ticks) { target -= (got - ticks) || tolerance; continue; }
                break;   // far too short: the setter didn't take, try the next
            }
        }
    }
    return seen.join("; ");
}

/* Imports the image and places it at the playhead. */
function skImportImage(path, top) {
    try {
        var seq = sk_activeSequence();
        if (!seq) { return "err\tNo active sequence."; }
        if (!(new File(path)).exists) { return "err\tImage not found: {0}\t" + path; }

        var bin = sk_bin("Sidekick");
        if (!app.project.importFiles([path], true, bin, false)) {
            return "err\tPremiere refused to import the image.";
        }
        var item = bin.children[bin.children.numItems - 1];
        if (!item) { return "err\tThe image was imported but is missing from the bin."; }

        var pos = seq.getPlayerPosition();
        var at = sk_ticks(pos);
        var track, frame = Number(seq.timebase) || 0, gap = 0, next = 0;
        if (top === "1") {
            // Stack: the whole image, untrimmed, on the first track where it
            // fits without overlapping anything. Gaps don't matter.
            track = sk_stackVideoTrack(seq, at, sk_itemTicks(item));
            if (!track) { return "err\tNo free video track at the playhead. The image is in the Sidekick bin."; }
            track.overwriteClip(item, pos.seconds);
        } else {
            track = sk_freeVideoTrack(seq, at);
            if (!track) {
                return "err\tNo free video track at the playhead. The image is in the Sidekick bin.";
            }

            // The image lasts as long as the gap: from the playhead to the
            // track's next clip. With no next clip the gap has no end and
            // Premiere's default duration is kept.
            next = sk_nextClipStart(track, at);
            gap = next ? next - at : 0;
            // The slack is one frame OF THE STILL, not of the sequence: a still
            // snaps down to its own timebase (the "indeterminate media"
            // preference, 25 fps here) whatever the sequence runs at. On a
            // 60 fps sequence that came to 2.2 sequence frames and two frames
            // of slack rejected a 52 s gap. 1/20 s covers any timebase down to
            // 20 fps and is still far from a setter that didn't take (which
            // reads back 0 or the default still duration). The sliver is
            // filled below.
            var why = gap ? sk_trimItem(item, gap, Math.max(frame * 2, 254016000000 / 20)) : "";
            if (why) {
                return "err\tThe {0} s gap is too short for the image and pasting would eat the next clip. The image is in the Sidekick bin.\t"
                     + (gap / 254016000000).toFixed(2) + "\t" + "gap " + gap + " ticks, frame " + frame + ": " + why;
            }
            track.overwriteClip(item, pos.seconds);
        }

        // The ProjectItem trim falls one frame short on some builds (inclusive
        // in/out) and left a sliver at the end of the gap. The gap is empty, so
        // stretching the clip to the edge treads on nothing.
        var clip = gap ? sk_clipAt(track, at) : null;
        if (clip && sk_ticks(clip.end) !== next) {
            try { clip.end = sk_timeFromTicks(next); } catch (e) { /* build without setter */ }
        }
        return "ok\t" + item.name + "\t" + (track.id + 1);
    } catch (e) {
        return "err\tPremiere threw an error: {0}\t" + e.toString();
    }
}
