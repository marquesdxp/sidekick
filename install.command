#!/bin/sh
# TweakTools - instalacion local en macOS. Doble clic sobre este fichero.
# Sin firma: se activa el modo depuracion de CEP, que es lo que permite a
# Premiere cargar un panel sin certificado. Es un ajuste tuyo, no del plugin.
set -e
cd "$(dirname "$0")"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/com.andersonmarques.tweaktools"

for v in 10 11 12 13; do defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1; done
rm -rf "$DEST"
mkdir -p "$DEST"
cp -R CSXS css js host.jsx index.html "$DEST/"

echo ""
echo "TweakTools instalado en:"
echo "  $DEST"
echo ""
echo "Reinicia Premiere Pro y abrelo en Ventana > Extensiones > TweakTools."
