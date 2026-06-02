#!/usr/bin/env bash
set -euo pipefail
UUID="ubuntu-desktop-tools@cal"

echo "Extension refresh başlıyor: $UUID"
gnome-extensions disable "$UUID" 2>/dev/null || true
sleep 1
gnome-extensions enable "$UUID"
echo "Tamamlandı. Görünüm eski kaldıysa Wayland'de tam Shell refresh için log out/log in gerekebilir."
