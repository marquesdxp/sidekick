/*
 * Sidekick - host.jsx (ExtendScript, Premiere Pro)
 *
 * Proyecto independiente. Sin relacion alguna con Postline ni con ningun otro
 * plugin. Ni una linea de codigo compartida. Ver README.md.
 *
 * Todos los valores se devuelven al panel como cadenas separadas por tabulador:
 *   "ok\t<campo>\t<campo>..."  |  "err\t<mensaje>"
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
        if (!app.project) { return "err\tNo hay ningun proyecto abierto."; }
        var projName = app.project.name.replace(/\.prproj$/i, "");
        var seq = sk_activeSequence();
        return "ok\t" + sk_clean(projName) + "\t" + (seq ? sk_clean(seq.name) : "");
    } catch (e) {
        return "err\t" + e.toString();
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

/* Exporta el fotograma bajo el cursor de reproduccion. */
function skExportFrame() {
    try {
        var seq = sk_activeSequence();
        if (!seq) { return "err\tNo hay ninguna secuencia activa."; }

        var dir = sk_folder(Folder.temp.fsName + "/sidekick");
        var path = dir.fsName + "/frame_" + (new Date()).getTime() + ".png";
        seq.exportFramePNG(seq.getPlayerPosition().ticks, path);

        if (!(new File(path)).exists) {
            return "err\tPremiere no generó el fotograma. ¿Hay algo bajo el cursor?";
        }
        return "ok\t" + path + "\t";
    } catch (e) {
        return "err\t" + e.toString();
    }
}

/* Carpeta donde el panel debe dejar la imagen pegada.
 * Junto al .prproj y NUNCA en el temporal del sistema: Premiere queda enlazado
 * a este fichero, y si se borra el proyecto se queda con material offline. */
function skPasteDir() {
    try {
        if (!app.project || !app.project.path) {
            return "err\tGuarda el proyecto antes de pegar: hace falta una carpeta donde dejar la imagen.";
        }
        var projFile = new File(app.project.path);
        return "ok\t" + sk_folder(projFile.parent.fsName + "/Sidekick").fsName + "\t";
    } catch (e) {
        return "err\t" + e.toString();
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

/* La primera pista de video libre bajo el cursor, para no machacar el montaje
 * que ya haya ahi. overwriteClip sobre V1 a ciegas destruiria trabajo. */
function sk_freeVideoTrack(seq, atSeconds) {
    for (var i = 0; i < seq.videoTracks.numTracks; i++) {
        var track = seq.videoTracks[i];
        if (!track.isTargeted && track.isLocked()) { continue; }
        var busy = false;
        for (var j = 0; j < track.clips.numItems; j++) {
            var c = track.clips[j];
            if (c.start.seconds <= atSeconds && c.end.seconds > atSeconds) { busy = true; break; }
        }
        if (!busy) { return track; }
    }
    return null;
}

/* Importa la imagen y la coloca en el cursor de reproduccion. */
function skImportImage(path) {
    try {
        var seq = sk_activeSequence();
        if (!seq) { return "err\tNo hay ninguna secuencia activa."; }
        if (!(new File(path)).exists) { return "err\tNo encuentro la imagen: " + path; }

        var bin = sk_bin("Sidekick");
        if (!app.project.importFiles([path], true, bin, false)) {
            return "err\tPremiere rechazó la importación.";
        }
        var item = bin.children[bin.children.numItems - 1];
        if (!item) { return "err\tLa imagen se importó pero no la encuentro en el bin."; }

        var at = seq.getPlayerPosition().seconds;
        var track = sk_freeVideoTrack(seq, at);
        if (!track) {
            return "err\tNo hay ninguna pista de vídeo libre en el cursor. La imagen está en el bin «Sidekick».";
        }
        track.overwriteClip(item, at);
        return "ok\t" + item.name + "\t" + (track.id + 1);
    } catch (e) {
        return "err\t" + e.toString();
    }
}
