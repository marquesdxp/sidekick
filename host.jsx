/*
 * Sidekick - host.jsx (ExtendScript, Premiere Pro)
 *
 * Proyecto independiente. Sin relacion alguna con Postline ni con ningun otro
 * plugin. Ni una linea de codigo compartida. Ver README.md.
 *
 * Todos los valores se devuelven al panel como cadenas separadas por tabulador:
 *   "ok\t<campo>\t<campo>..."  |  "err\t<mensaje>\t<arg>..."
 *
 * Los mensajes van en ingles y en ASCII puro: ExtendScript lee este fichero
 * con la codificacion del sistema (Mac Roman en Mac) y cualquier acento sale
 * roto. Es el panel quien los traduce (la clave ES el texto en ingles) y quien
 * mete los <arg> en los {0}.
 * ExtendScript no trae JSON, y un split("\t") es mas barato que embarcar un
 * polyfill para tres campos.
 */

function sk_clean(name) {
    return String(name).replace(/[\/\\:*?"<>|\t]/g, "_");
}

function sk_activeSequence() {
    if (!app.project) { return null; }
    return app.project.activeSequence || null;
}

/* --- API que llama el panel --------------------------------------------- */

/* El nombre del proyecto es la clave con la que el panel busca a que cliente
 * hay que avisar, asi que se devuelve siempre, haya secuencia activa o no. */
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

/* --- Portapapeles de imagen --------------------------------------------- */
/* Copiar: Premiere solo sabe escribir un fotograma a disco, asi que se exporta
 * a una carpeta temporal y el panel se encarga de meterlo en el portapapeles.
 * Pegar: el panel deja el fichero en disco y aqui se importa y se coloca. */

function sk_folder(path) {
    var f = new Folder(path);
    if (!f.exists) { f.create(); }
    return f;
}

/* Premiere 25 se llevo por delante exportFramePNG y compania: en su sitio esta
 * renderVideoFrameAtTime, que no escribe a disco sino que devuelve la imagen.
 * Se prueba lo nuevo primero y lo viejo despues, porque el panel tiene que
 * funcionar en las dos generaciones. */
var SK_EXPORTERS = [
    ["exportFramePNG", "png"],
    ["exportFrameTIFF", "tif"],
    ["exportFrameJPEG", "jpg"],
    ["exportFrameTarga", "tga"]
];

function sk_methods(obj) {
    try { return obj.reflect.methods.join(", "); } catch (e) { return "?"; }
}

/* Firma real de un metodo segun ExtendScript: nombre y tipo de cada argumento.
 * Es la unica documentacion que hay de renderVideoFrameAtTime. */
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

/* QE es el DOM interno de Premiere: exportFramePNG vive ahi desde siempre,
 * tambien en las versiones que lo quitaron del DOM publico. */
function sk_qeFrame(path) {
    app.enableQE();
    var q = qe.project.getActiveSequence();
    if (!q) { return "QE: no hay secuencia activa"; }
    if (typeof q.exportFramePNG !== "function") { return "QE sin exportFramePNG. Metodos QE: " + sk_methods(q); }
    // QE le pega ".png" a lo que le des: se le pasa la ruta sin extension.
    q.exportFramePNG(q.CTI.timecode, path.replace(/\.png$/, ""));
    return (new File(path)).exists ? "" : "QE exportFramePNG no escribio " + path;
}

/* renderVideoFrameAtTime no documenta que devuelve, y no es igual en todas las
 * builds: puede ser una ruta, un data URI o base64 pelado. Se acepta cualquiera
 * de las tres en vez de apostar por una. */
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
    // Base64 pelado: largo y sin caracteres de ruta. Un path nunca lo parece.
    if (s.length > 256 && s.indexOf("/") === -1 && s.indexOf("\\") === -1) {
        return "ok\tb64\t" + path + "\t" + s;
    }
    if ((new File(s)).exists) { return "ok\tpath\t" + (new File(s)).fsName + "\t"; }
    return null;
}

/* Exporta el fotograma bajo el cursor de reproduccion.
 * Devuelve "ok\tpath\t<ruta>\t" o "ok\tb64\t<ruta destino>\t<base64>". */
function skExportFrame() {
    try {
        var seq = sk_activeSequence();
        if (!seq) { return "err\tNo active sequence."; }

        var dir = sk_folder(Folder.temp.fsName + "/sidekick");
        var stamp = (new Date()).getTime();
        var pos = seq.getPlayerPosition();
        var last = "";

        // Primero QE, que es lo que funciona en todas las versiones conocidas.
        var qePath = dir.fsName + "/frame_" + stamp + ".png";
        try {
            last = sk_qeFrame(qePath);
            if (!last) { return "ok\tpath\t" + qePath + "\t"; }
        } catch (qe_err) {
            last = "QE: " + qe_err.toString();
        }

        if (typeof seq.renderVideoFrameAtTime === "function") {
            var dest = dir.fsName + "/frame_" + stamp + ".png";
            // Ni el tipo del tiempo ni el numero de argumentos estan
            // documentados y cambian entre builds: ticks (cadena), objeto Time
            // o segundos, con y sin ruta de destino. Se prueban todas las
            // combinaciones y gana la primera que devuelva algo.
            var times = [pos.ticks, pos, pos.seconds, Number(pos.ticks)];
            for (var a = 0; a < times.length; a++) {
                for (var b = 0; b < 2; b++) {
                    try {
                        var out = b ? seq.renderVideoFrameAtTime(times[a], dest)
                                    : seq.renderVideoFrameAtTime(times[a]);
                        var got = sk_frameResult(out, dest);
                        if (got) { return got; }
                        if ((new File(dest)).exists) { return "ok\tpath\t" + dest + "\t"; }
                        last = "renderVideoFrameAtTime devolvio nada util";
                    } catch (rv) {
                        last = "renderVideoFrameAtTime: " + rv.toString();
                    }
                }
            }
        }

        for (var i = 0; i < SK_EXPORTERS.length; i++) {
            var fn = SK_EXPORTERS[i][0];
            if (typeof seq[fn] !== "function") { continue; }
            var path = dir.fsName + "/frame_" + stamp + "." + SK_EXPORTERS[i][1];
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

/* Carpeta donde el panel debe dejar la imagen pegada.
 * Junto al .prproj y NUNCA en el temporal del sistema: Premiere queda enlazado
 * a este fichero, y si se borra el proyecto se queda con material offline. */
function skPasteDir() {
    try {
        if (!app.project || !app.project.path) {
            return "err\tSave the project before pasting: the image needs a folder to live in.";
        }
        var projFile = new File(app.project.path);
        return "ok\t" + sk_folder(projFile.parent.fsName + "/Sidekick").fsName + "\t";
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

/* Todo lo que sea colocar o medir va en ticks, nunca en segundos: los segundos
 * son float y por eso quedaban fotogramas sueltos al final del hueco. Un tick
 * cabe de sobra en un double (9e14 para una hora, contra los 9e15 que aguanta),
 * asi que Number() sobre la cadena es exacto. */
function sk_ticks(time) { return Number(time.ticks); }

function sk_timeFromTicks(ticks) {
    var t = new Time();
    t.ticks = String(Math.round(ticks));
    return t;
}

/* La primera pista de video libre bajo el cursor, para no machacar el montaje
 * que ya haya ahi. overwriteClip sobre V1 a ciegas destruiria trabajo. */
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

/* Lo que dura la imagen tal cual la importo Premiere (la preferencia de
 * duracion de imagen fija del usuario). Si no se puede leer, 5 s, que es lo
 * que trae Premiere de fabrica. */
function sk_itemTicks(item) {
    var types = [4, 1, 2];
    for (var i = 0; i < types.length; i++) {
        var t = sk_outTicks(item, types[i]);
        if (t > 0) { return t; }
    }
    return 5 * 254016000000;
}

/* La pista mas baja en la que la imagen ENTERA cabe sin tocar nada, mirando
 * de abajo arriba: queda justo por encima de lo que ya hay en ese tramo, no en
 * la cima de la timeline. Si en ninguna cabe, se anade una nueva arriba del
 * todo (solo QE sabe crear pistas). */
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

/* Tick en el que empieza el siguiente clip de la pista, 0 si no hay ninguno
 * (hueco abierto hasta el final de la secuencia). */
function sk_nextClipStart(track, atTicks) {
    var next = 0;
    for (var i = 0; i < track.clips.numItems; i++) {
        var s = sk_ticks(track.clips[i].start);
        if (s > atTicks && (next === 0 || s < next)) { next = s; }
    }
    return next;
}

/* El clip que ocupa ese tick: el que acabamos de insertar. */
function sk_clipAt(track, atTicks) {
    for (var i = 0; i < track.clips.numItems; i++) {
        var c = track.clips[i];
        if (sk_ticks(c.start) <= atTicks && sk_ticks(c.end) > atTicks) { return c; }
    }
    return null;
}

function sk_outTicks(item, type) {
    try { return sk_ticks(item.getOutPoint(type)); } catch (e) { /* getter sin argumento */ }
    try { return sk_ticks(item.getOutPoint()); } catch (e) { /* no hay manera */ }
    return -1;
}

/* La duracion de una imagen fija la pone la preferencia del usuario, no
 * nosotros. Para que no se pase del hueco hay que recortar el ProjectItem ANTES
 * de insertarlo: despues seria tarde, overwriteClip ya se habria comido la
 * cabeza del clip siguiente.
 * El mediaType de setOutPoint no vale lo mismo en todas las builds, asi que se
 * prueban los conocidos y se comprueba leyendo lo que quedo. */
function sk_trimItem(item, ticks, tolerance) {
    var types = [4, 1, 2];
    for (var i = 0; i < types.length; i++) {
        try {
            item.setInPoint(sk_timeFromTicks(0), types[i]);
            item.setOutPoint(sk_timeFromTicks(ticks), types[i]);
        } catch (e) {
            continue;
        }
        if (Math.abs(sk_outTicks(item, types[i]) - ticks) <= tolerance) { return true; }
    }
    return false;
}

/* Importa la imagen y la coloca en el cursor de reproduccion. */
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
            // Apilar: la imagen entera, sin recortar, en la primera pista donde
            // cabe sin pisar nada. Los huecos no cuentan.
            track = sk_stackVideoTrack(seq, at, sk_itemTicks(item));
            if (!track) { return "err\tNo free video track at the playhead. The image is in the Sidekick bin."; }
            track.overwriteClip(item, pos.seconds);
        } else {
            track = sk_freeVideoTrack(seq, at);
            if (!track) {
                return "err\tNo free video track at the playhead. The image is in the Sidekick bin.";
            }

            // La imagen dura lo que dure el hueco: desde el cursor hasta el
            // siguiente clip de la pista. Si no hay siguiente, el hueco no tiene
            // final y se deja la duracion por defecto de Premiere.
            next = sk_nextClipStart(track, at);
            gap = next ? next - at : 0;
            if (gap && !sk_trimItem(item, gap, frame)) {
                return "err\tThe {0} s gap is too short for the image and pasting would eat the next clip. The image is in the Sidekick bin.\t"
                     + (gap / 254016000000).toFixed(2);
            }
            track.overwriteClip(item, pos.seconds);
        }

        // El recorte del ProjectItem se queda corto por un fotograma en algunas
        // builds (in/out inclusivo) y dejaba una astilla al final del hueco. El
        // hueco esta vacio, asi que estirar el clip hasta el borde no pisa nada.
        var clip = gap ? sk_clipAt(track, at) : null;
        if (clip && sk_ticks(clip.end) !== next) {
            try { clip.end = sk_timeFromTicks(next); } catch (e) { /* build sin setter */ }
        }
        return "ok\t" + item.name + "\t" + (track.id + 1);
    } catch (e) {
        return "err\tPremiere threw an error: {0}\t" + e.toString();
    }
}
