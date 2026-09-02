#!/bin/sh
# Sidekick - local install on macOS. Double-click this file.
# Unsigned: CEP debug mode is turned on, which is what lets Premiere load a
# panel without a certificate. It's a setting of yours, not the plugin's.
set -e
cd "$(dirname "$0")"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/com.andersonmarques.sidekick"

for v in 10 11 12 13; do defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1; done
rm -rf "$DEST"
mkdir -p "$DEST"
# --link: symlinks instead of copies, to develop without reinstalling on every
# change. Without the flag it copies, which is what someone just installing wants.
if [ "$1" = "--link" ]; then
  ln -s "$PWD"/CSXS "$PWD"/css "$PWD"/js "$PWD"/i18n "$PWD"/fonts "$PWD"/host.jsx "$PWD"/index.html "$PWD"/.debug "$DEST/"
else
  cp -R CSXS css js i18n fonts host.jsx index.html .debug "$DEST/"
fi

echo ""
echo "Sidekick installed at:"
echo "  $DEST"
echo ""
echo "Restart Premiere Pro and open it from Window > Extensions > Sidekick."
