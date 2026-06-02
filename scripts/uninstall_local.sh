#!/usr/bin/env bash
set -euo pipefail
UUID="ubuntu-desktop-tools@cal"
gnome-extensions disable "$UUID" >/dev/null 2>&1 || true
rm -rf "$HOME/.local/share/gnome-shell/extensions/$UUID"
echo "Kaldırıldı: $UUID"
