#!/usr/bin/env bash
set -euo pipefail
UUID="ubuntu-desktop-tools@cal"
DEST_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"
STAMP="$(date +%Y%m%d_%H%M%S)"

echo "Extension kapatılıyor: $UUID"
gnome-extensions disable "$UUID" 2>/dev/null || true

if [ -d "$DEST_DIR" ]; then
  SAFE_DIR="${DEST_DIR}.disabled-${STAMP}"
  mv "$DEST_DIR" "$SAFE_DIR"
  echo "Extension klasörü güvenli şekilde taşındı: $SAFE_DIR"
else
  echo "Extension klasörü zaten yok: $DEST_DIR"
fi

echo "Wayland kullanıyorsan oturumu kapatıp tekrar aç. X11 kullanıyorsan Alt+F2 > r > Enter deneyebilirsin."
