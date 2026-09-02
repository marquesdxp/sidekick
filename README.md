# Sidekick

Panel CEP para Adobe Premiere Pro. Herramientas personales de postproducción,
código abierto bajo licencia MIT.

---

## ⚠️ Proyecto independiente

**Sidekick no tiene ninguna relación con Postline.**

No comparte código, ni estilos, ni scripts, ni recursos, ni historial de git, ni
identificadores con Postline ni con ningún otro plugin. Es un repositorio
distinto, con su propio `.git`, su propia licencia y su propio bundle ID
(`com.andersonmarques.sidekick`).

Regla del proyecto: **no se importa código de Postline aquí bajo ningún
concepto.** Si algo hace falta, se escribe de cero. Postline es un plugin UXP;
Sidekick es CEP. No tienen nada en común y así se queda.

---

## Qué hace

**Fotograma ↔ portapapeles del sistema.** *Copiar el fotograma actual* exporta el
fotograma bajo el cursor y lo deja en el portapapeles como imagen: se pega en
Photoshop, en Slack, en un correo o donde haga falta. Al revés, cualquier imagen
que tengas copiada se guarda en una carpeta `Sidekick` junto al `.prproj`, se
importa al bin `Sidekick` y se coloca en el cursor, en la primera pista de vídeo
que esté libre ahí (nunca machaca lo que ya haya montado).

El fichero pegado va junto al proyecto y **nunca a una carpeta temporal**:
Premiere queda enlazado a él para siempre, y en el temporal el material acabaría
offline.

El portapapeles se toca a través del sistema operativo (JXA sobre `NSPasteboard`
en macOS, `powershell` en Windows, lanzados con `cep.process`), no con
`navigator.clipboard`: el CEF que embarca Premiere no da permiso de lectura y
`ClipboardItem` no siempre existe, que es por lo que Copiar y Pegar fallaban.

**Tres idiomas.** El panel toma el idioma del sistema y usa
`i18n/strings.js`: inglés, español y português-brasil, elegible en **≡ →
Language** y guardado en `~/.sidekick.json`. Lo que no esté traducido sale en
inglés. Para añadir un idioma, copia un bloque y traduce los valores.

El idioma por defecto sale de `navigator.language`, que en el CEF de Premiere es
el idioma **de Premiere**, no el del sistema: por eso el menú manda sobre él.

## Instalación

Requiere Premiere Pro 15 o superior.

Descarga el repositorio y haz doble clic en **`install.command`** (macOS) o
**`install.bat`** (Windows). Copia el panel a la carpeta de extensiones y activa
el modo depuración de CEP, que es lo que permite a Premiere cargar una extensión
sin certificado. Reinicia Premiere y ábrelo en
**Ventana → Extensiones → Sidekick**.

Sidekick no va firmado a propósito: firmar un `.zxp` exige un certificado y no
aporta nada cuando la instalación es local. Si algún día hace falta distribuirlo
por Adobe Exchange, se firma con `ZXPSignCmd` y el modo depuración deja de ser
necesario.

Para desarrollar, `./install.command --link` enlaza en vez de copiar: editas el
repositorio y basta con el botón ↻ del panel, sin reinstalar ni reiniciar
Premiere. La consola queda en `http://localhost:8099` (`.debug`).

```sh
npm test    # comprobaciones del portapapeles y del i18n
```

## Límites conocidos

- CEP está deprecado por Adobe. Sigue funcionando y es la única vía para hacer
  llamadas de red y acceso a disco sin las restricciones de UXP.
- Pegar necesita el proyecto guardado: sin `.prproj` en disco no hay carpeta
  donde dejar la imagen.
- Copiar el fotograma va por QE (`qe.project…exportFramePNG`), el DOM interno de
  Premiere, porque las versiones nuevas ya no exponen `exportFrame*` al script.
  Si algún día QE tampoco está, quedan `renderVideoFrameAtTime` y las cuatro
  `exportFrame*` como respaldo, y el panel dice qué ofrece esa versión.

## Licencia

MIT. Ver [LICENSE](LICENSE).
