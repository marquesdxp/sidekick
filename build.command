#!/bin/sh
# Sidekick - packages the .zxp for end users. Double-click or ./build.command
#
# A .zxp is a signed zip: anyone installs it with ZXP Installer
# (aescripts.com/learn/zxp-installer) without touching debug mode. Signing
# needs ZXPSignCmd, which Adobe doesn't allow redistributing: get it from
# github.com/Adobe-CEP/CEP-Resources (ZXPSignCMD/) and drop it in tools/.
# The certificate is self-signed and created on the first run (tools/sidekick.p12).
set -e
cd "$(dirname "$0")"
SIGN="${ZXPSIGNCMD:-tools/ZXPSignCmd}"
CERT=tools/sidekick.p12
PASS="${ZXP_PASS:-sidekick}"
VERSION=$(sed -n 's/.*ExtensionBundleVersion="\([^"]*\)".*/\1/p' CSXS/manifest.xml)
OUT="dist/Sidekick-$VERSION.zxp"

[ -x "$SIGN" ] || { echo "Missing $SIGN (or export ZXPSIGNCMD=/path/to/ZXPSignCmd)."; exit 1; }
mkdir -p tools dist
[ -f "$CERT" ] || "$SIGN" -selfSignedCert ES Madrid "Anderson Marques" Sidekick "$PASS" "$CERT"

# Only what Premiere loads: no tests, no installers, no .debug.
STAGE=$(mktemp -d)
cp -R CSXS css fonts i18n host.jsx index.html "$STAGE/"
mkdir "$STAGE/js"
cp js/*.js "$STAGE/js/"
rm -f "$OUT"
"$SIGN" -sign "$STAGE" "$OUT" "$CERT" "$PASS" -tsa http://timestamp.digicert.com
rm -rf "$STAGE"

echo ""
echo "Done: $OUT"
