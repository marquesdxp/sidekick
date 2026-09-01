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

function tt_clean(name) {
    return String(name).replace(/[\/\\:*?"<>|\t]/g, "_");
}

function tt_activeSequence() {
    if (!app.project) { return null; }
    return app.project.activeSequence || null;
}

/* --- API que llama el panel --------------------------------------------- */

/* El nombre del proyecto es la clave con la que el panel busca a que cliente
 * hay que avisar, asi que se devuelve siempre, haya secuencia activa o no. */
function ttGetContext() {
    try {
        if (!app.project) { return "err\tNo hay ningun proyecto abierto."; }
        var projName = app.project.name.replace(/\.prproj$/i, "");
        var seq = tt_activeSequence();
        return "ok\t" + tt_clean(projName) + "\t" + (seq ? tt_clean(seq.name) : "");
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
