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

**Exportar y avisar por WhatsApp.** Pulsas un botón: el cliente recibe
`Exportando el [proyecto] — [secuencia]...`, el panel encola la secuencia en
Adobe Media Encoder y, cuando el render termina, espera los segundos que hayas
configurado (60 por defecto) y manda `Exportado.`.

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

## Instalación (desarrollo)

Requiere Premiere Pro 15 o superior.

1. Activa el modo depuración de CEP (una vez):
   ```sh
   for v in 11 12 13; do defaults write com.adobe.CSXS.$v PlayerDebugMode 1; done
   ```
2. Enlaza el panel:
   ```sh
   ln -s "$PWD" ~/Library/Application\ Support/Adobe/CEP/extensions/com.andersonmarques.tweaktools
   ```
3. Reinicia Premiere. El panel aparece en **Ventana → Extensiones → TweakTools**.

Para depurar, abre `http://localhost:8099` en Chrome con el panel abierto.

## Configura el Worker

```sh
cd worker
npm test                       # comprobaciones de auth y validacion
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

### Aviso sobre la WhatsApp Cloud API

Meta solo permite mensajes de texto libre dentro de la **ventana de 24 horas**
posterior al último mensaje que te haya escrito el cliente. Fuera de esa ventana
la API devuelve el error `131047` y hay que usar una **plantilla aprobada**.
Para avisos a clientes que no te han escrito hoy, necesitarás registrar una
plantilla en Meta Business. TweakTools todavía no las envía.

## Límites conocidos

- CEP está deprecado por Adobe. Sigue funcionando y es la única vía para hacer
  llamadas de red y acceso a disco sin las restricciones de UXP, pero para
  distribuirlo fuera del modo depuración hay que firmar un `.zxp` con
  `ZXPSignCmd`.
- El aviso de fin de render solo funciona con exportaciones lanzadas desde el
  propio panel. Un export lanzado a mano desde Premiere no emite el evento.

## Licencia

MIT. Ver [LICENSE](LICENSE).
