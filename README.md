# TweakTools

Panel CEP para Adobe Premiere Pro. Herramientas personales de postproducción,
código abierto bajo licencia MIT.

---

## ⚠️ Proyecto independiente

**TweakTools no tiene ninguna relación con Postline.**

No comparte código, ni estilos, ni scripts, ni recursos, ni historial de git, ni
identificadores con Postline ni con ningún otro plugin. Es un repositorio
distinto, con su propio `.git`, su propia licencia y su propio bundle ID
(`com.andersonmarques.tweaktools`).

Regla del proyecto: **no se importa código de Postline aquí bajo ningún
concepto.** Si algo hace falta, se escribe de cero. Postline es un plugin UXP;
TweakTools es CEP. No tienen nada en común y así se queda.

---

## Qué hace

**Avisar al cliente por WhatsApp, sin tocar tu forma de exportar.** Pulsas un
botón y el cliente del proyecto abierto recibe `Exportando el [proyecto]...`.
A partir de ahí el panel vigila la carpeta de salida que le hayas indicado.
Exporta como quieras —Premiere directo, Media Encoder, cola, da igual—: cuando
un fichero deja de crecer durante 15 segundos, se da por terminado, se esperan
los segundos que hayas configurado (60 por defecto) y sale el `Exportado.`.

El teléfono y la carpeta se guardan **por proyecto**, porque cada proyecto es un
cliente distinto. Al cambiar de proyecto, el panel cambia de cliente solo.

**Portapapeles de marcadores.** Copia los marcadores de la secuencia activa al
portapapeles como texto tabulado (`inicio ⇥ fin ⇥ nombre ⇥ comentario`) y los
vuelve a pegar en otra secuencia o en otro proyecto.

## Tus credenciales son tuyas

Este repositorio **no contiene ninguna credencial ni ninguna URL de despliegue**.
El plugin no lleva ningún token de Meta incrustado, ni puede llevarlo: cualquiera
podría extraerlo de un `.zxp`.

Cada usuario despliega **su propio** Cloudflare Worker con **sus propios**
secretos. El panel solo guarda, en el `localStorage` de tu equipo, la URL de tu
Worker y un token compartido. Nada de eso se versiona ni se distribuye.

`worker/wrangler.toml` y `worker/.dev.vars` están en `.gitignore` precisamente
para eso. Lo que se publica es `worker/wrangler.toml.example`.

## Instalación

Requiere Premiere Pro 15 o superior.

Descarga el repositorio y haz doble clic en **`install.command`** (macOS) o
**`install.bat`** (Windows). Copia el panel a la carpeta de extensiones y activa
el modo depuración de CEP, que es lo que permite a Premiere cargar una extensión
sin certificado. Reinicia Premiere y ábrelo en
**Ventana → Extensiones → TweakTools**.

TweakTools no va firmado a propósito: firmar un `.zxp` exige un certificado y no
aporta nada cuando la instalación es local. Si algún día hace falta distribuirlo
por Adobe Exchange, se firma con `ZXPSignCmd` y el modo depuración deja de ser
necesario.

Para desarrollar, enlaza en vez de copiar y depura en `http://localhost:8099`:

```sh
ln -s "$PWD" ~/Library/Application\ Support/Adobe/CEP/extensions/com.andersonmarques.tweaktools
```

## Configura el Worker

```sh
npm test                       # comprobaciones del vigilante y del Worker

cd worker
cp wrangler.toml.example wrangler.toml
npx wrangler secret put TWEAKTOOLS_TOKEN   # invéntate uno largo
npx wrangler secret put META_TOKEN         # token permanente de tu app de Meta
npx wrangler secret put WABA_PHONE_ID      # ID del número emisor de WhatsApp
npx wrangler deploy
```

Pega la URL resultante y el `TWEAKTOOLS_TOKEN` en la pestaña **Ajustes** del
panel, junto al teléfono del cliente.

Recomendado: descomenta `ALLOWED_NUMBERS` en `wrangler.toml`. Así, aunque
alguien te robase el token, solo podría escribir a los números de esa lista.

### Ventana de 24 horas: por diseño

Meta solo permite mensajes de texto libre dentro de las **24 horas** siguientes
al último mensaje que te haya escrito el cliente. TweakTools **solo envía texto
libre, a propósito**: no manda plantillas y por tanto no puede escribir a nadie
que no haya iniciado la conversación contigo. Si trabajas en contacto constante
con el cliente, la ventana está siempre abierta y no hay nada que configurar.

Si alguna vez se cierra, el panel te lo dice con todas las letras en vez de
enseñarte el JSON de Meta: *«El cliente no te ha escrito en las últimas 24 h…»*.
No se añaden plantillas: exigen aprobación de Meta Business y abrirían la puerta
a escribir en frío, que no es lo que hace esta herramienta.

## Límites conocidos

- CEP está deprecado por Adobe. Sigue funcionando y es la única vía para hacer
  llamadas de red y acceso a disco sin las restricciones de UXP.
- El fin del render se deduce de que el fichero deje de crecer, porque Premiere
  no avisa a un panel de un export que no ha lanzado él. Si exportas a una
  carpeta con otras cosas escribiéndose a la vez, puede confundirse de fichero.
- Solo se vigila un export cada vez, y solo la carpeta indicada (sin subcarpetas).

## Licencia

MIT. Ver [LICENSE](LICENSE).
