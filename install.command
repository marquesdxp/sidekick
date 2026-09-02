#!/bin/sh
# Sidekick - instalacion local en macOS. Doble clic sobre este fichero.
# Sin firma: se activa el modo depuracion de CEP, que es lo que permite a
# Premiere cargar un panel sin certificado. Es un ajuste tuyo, no del plugin.
set -e
cd "$(dirname "$0")"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/com.andersonmarques.sidekick"

for v in 10 11 12 13; do defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1; done
rm -rf "$DEST"
mkdir -p "$DEST"
# --link: enlaces simbolicos en vez de copias, para desarrollar sin reinstalar
# a cada cambio. Sin la opcion se copia, que es lo que quiere quien solo instala.
if [ "$1" = "--link" ]; then
  ln -s "$PWD"/CSXS "$PWD"/css "$PWD"/js "$PWD"/i18n "$PWD"/fonts "$PWD"/host.jsx "$PWD"/index.html "$PWD"/.debug "$DEST/"
else
  cp -R CSXS css js i18n fonts host.jsx index.html .debug "$DEST/"
fi

echo ""
echo "Sidekick instalado en:"
echo "  $DEST"
echo ""
echo "Reinicia Premiere Pro y abrelo en Ventana > Extensiones > Sidekick."
