#!/bin/sh
# Sidekick - empaqueta el .zxp para usuarios finales. Doble clic o ./build.command
#
# Un .zxp es un zip firmado: lo instala cualquiera con ZXP Installer
# (aescripts.com/learn/zxp-installer) sin tocar el modo depuracion. Firmar
# exige ZXPSignCmd, que Adobe no deja redistribuir: bajalo de
# github.com/Adobe-CEP/CEP-Resources (ZXPSignCMD/) y dejalo en tools/.
# El certificado es autofirmado y se crea solo la primera vez (tools/sidekick.p12).
set -e
cd "$(dirname "$0")"
SIGN="${ZXPSIGNCMD:-tools/ZXPSignCmd}"
CERT=tools/sidekick.p12
PASS="${ZXP_PASS:-sidekick}"
VERSION=$(sed -n 's/.*ExtensionBundleVersion="\([^"]*\)".*/\1/p' CSXS/manifest.xml)
OUT="dist/Sidekick-$VERSION.zxp"

[ -x "$SIGN" ] || { echo "Falta $SIGN (o exporta ZXPSIGNCMD=/ruta/ZXPSignCmd)."; exit 1; }
mkdir -p tools dist
[ -f "$CERT" ] || "$SIGN" -selfSignedCert ES Madrid "Anderson Marques" Sidekick "$PASS" "$CERT"

# Solo lo que carga Premiere: ni tests, ni instaladores, ni .debug.
STAGE=$(mktemp -d)
cp -R CSXS css fonts i18n host.jsx index.html "$STAGE/"
mkdir "$STAGE/js"
cp js/*.js "$STAGE/js/"
rm -f "$OUT"
"$SIGN" -sign "$STAGE" "$OUT" "$CERT" "$PASS" -tsa http://timestamp.digicert.com
rm -rf "$STAGE"

echo ""
echo "Listo: $OUT"
