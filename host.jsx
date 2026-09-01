/*
 * TweakTools - host.jsx (ExtendScript, Premiere Pro)
 *
 * Proyecto independiente. Sin relacion alguna con Postline ni con ningun otro
 * plugin. Ni una linea de codigo compartida. Ver README.md.
 *
 * Todos los valores se devuelven al panel como cadenas separadas por tabulador:
 *   "ok\t<campo>\t<campo>..."  |  "err\t<mensaje>"
 * ExtendScript no trae JSON, y un split("\t") es mas barato que embarcar un
 * polyfill para tres campos.
 */

var TWEAKTOOLS_EVENT = "com.andersonmarques.tweaktools.encode";
var tt_xLib = null;
var tt_bound = false;

/* Envia un evento CSXS al panel HTML. Es la unica via para avisar de algo
 * asincrono (el render termina mucho despues de que evalScript haya vuelto). */
function tt_dispatch(payload) {
    try {
        if (tt_xLib === null) {
            tt_xLib = new ExternalObject("lib:PlugPlugExternalObject");
        }
        var e = new CSXSEvent();
        e.type = TWEAKTOOLS_EVENT;
        e.data = payload;
        e.dispatch();
    } catch (err) {
        $.writeln("TweakTools dispatch fallo: " + err);
    }
}

function tt_clean(name) {
    return String(name).replace(/[\/\\:*?"<>|\t]/g, "_");
}

function tt_activeSequence() {
    if (!app.project) { return null; }
    return app.project.activeSequence || null;
}

/* --- API que llama el panel --------------------------------------------- */

function ttGetContext() {
    try {
        var seq = tt_activeSequence();
        if (!seq) { return "err\tNo hay ninguna secuencia activa."; }
        var projName = app.project.name.replace(/\.prproj$/i, "");
        return "ok\t" + tt_clean(projName) + "\t" + tt_clean(seq.name);
    } catch (e) {
        return "err\t" + e.toString();
    }
}

function tt_bindEncoder() {
    if (tt_bound) { return; }
    app.encoder.bind("onEncoderJobComplete", function (jobID, outputFilePath) {
        tt_dispatch("complete\t" + jobID + "\t" + outputFilePath);
    });
    app.encoder.bind("onEncoderJobError", function (jobID, message) {
        tt_dispatch("error\t" + jobID + "\t" + message);
    });
    app.encoder.bind("onEncoderJobCanceled", function (jobID) {
        tt_dispatch("canceled\t" + jobID + "\t");
    });
    tt_bound = true;
}

/* Encola la secuencia activa en Adobe Media Encoder y arranca la cola.
 * Devuelve el jobID para que el panel sepa que evento le pertenece. */
function ttStartExport(outFolder, presetPath) {
    try {
        var seq = tt_activeSequence();
        if (!seq) { return "err\tNo hay ninguna secuencia activa."; }

        var preset = new File(presetPath);
        if (!preset.exists) { return "err\tNo encuentro el preset: " + presetPath; }
        var folder = new Folder(outFolder);
        if (!folder.exists && !folder.create()) {
            return "err\tNo puedo crear la carpeta de salida: " + outFolder;
        }

        tt_bindEncoder();
        app.encoder.launchEncoder();
        app.encoder.setEmbeddedXMPEnabled(0);
        app.encoder.setSidecarXMPEnabled(0);

        var outPath = folder.fsName + "/" + tt_clean(seq.name);
        var jobID = app.encoder.encodeSequence(
            seq,
            outPath,
            preset.fsName,
            app.encoder.ENCODE_ENTIRE,
            0, /* no borrar de la cola al terminar: queremos ver el resultado */
            1  /* arrancar la cola ya */
        );
        if (!jobID) { return "err\tMedia Encoder rechazo el trabajo."; }
        return "ok\t" + jobID + "\t" + outPath;
    } catch (e) {
        return "err\t" + e.toString();
    }
}

/* --- Portapapeles ------------------------------------------------------- */
/* Los marcadores de la secuencia como texto plano, y de vuelta. Es el unico
 * dato de Premiere que sobrevive a un copiar/pegar entre proyectos. */

function ttMarkersToText() {
    try {
        var seq = tt_activeSequence();
        if (!seq) { return "err\tNo hay ninguna secuencia activa."; }
        var m = seq.markers.getFirstMarker();
        var lines = [];
        while (m) {
            lines.push([
                m.start.seconds,
                m.end.seconds,
                String(m.name).replace(/[\t\r\n]/g, " "),
                String(m.comments).replace(/[\t\r\n]/g, " ")
            ].join("\t"));
            m = seq.markers.getNextMarker(m);
        }
        return "ok\t" + lines.length + "\t" + lines.join("\n");
    } catch (e) {
        return "err\t" + e.toString();
    }
}

function ttMarkersFromText(text) {
    try {
        var seq = tt_activeSequence();
        if (!seq) { return "err\tNo hay ninguna secuencia activa."; }
        var lines = String(text).split(/\r\n|\r|\n/);
        var added = 0;
        for (var i = 0; i < lines.length; i++) {
            if (!lines[i].replace(/^\s+|\s+$/g, "")) { continue; }
            var f = lines[i].split("\t");
            var start = parseFloat(f[0]);
            if (isNaN(start)) { continue; }
            var end = parseFloat(f[1]);
            var mk = seq.markers.createMarker(start);
            mk.name = f[2] || "";
            mk.comments = f[3] || "";
            if (!isNaN(end) && end > start) { mk.end = end; }
            added++;
        }
        return "ok\t" + added + "\t";
    } catch (e) {
        return "err\t" + e.toString();
    }
}
