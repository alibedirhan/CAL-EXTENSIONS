#!/usr/bin/env bash
set -euo pipefail

UUID="ubuntu-desktop-tools@cal"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC_DIR="$PROJECT_DIR/$UUID"
DEST_PARENT="$HOME/.local/share/gnome-shell/extensions"
DEST_DIR="$DEST_PARENT/$UUID"

fail() { echo "HATA: $*" >&2; exit 1; }

command -v gnome-extensions >/dev/null 2>&1 || fail "gnome-extensions komutu bulunamadı."
command -v glib-compile-schemas >/dev/null 2>&1 || fail "glib-compile-schemas bulunamadı."

echo "[1/6] Kaynak klasör kontrolü: $SRC_DIR"
[ -d "$SRC_DIR" ] || fail "Kaynak extension klasörü yok: $SRC_DIR"
for required in metadata.json extension.js prefs.js stylesheet.css schemas/org.gnome.shell.extensions.ubuntu-desktop-tools.gschema.xml; do
  [ -f "$SRC_DIR/$required" ] || fail "Kaynakta eksik dosya: $required"
done

echo "[2/6] Eski kurulum kapatılıyor/temizleniyor"
gnome-extensions disable "$UUID" >/dev/null 2>&1 || true
rm -rf "$DEST_DIR"
mkdir -p "$DEST_DIR"

echo "[3/6] Dosyalar kuruluyor"
# Bilerek SRC_DIR/.' kullanıyoruz. Bu, hedefte yanlışlıkla iç içe klasör oluşmasını engeller.
cp -a "$SRC_DIR/." "$DEST_DIR/"

echo "[4/6] Kurulum doğrulaması"
for required in metadata.json extension.js prefs.js stylesheet.css schemas/org.gnome.shell.extensions.ubuntu-desktop-tools.gschema.xml; do
  [ -f "$DEST_DIR/$required" ] || fail "Kurulumdan sonra eksik dosya: $DEST_DIR/$required"
done

echo "[5/6] GSettings schema derleniyor"
glib-compile-schemas "$DEST_DIR/schemas"
[ -f "$DEST_DIR/schemas/gschemas.compiled" ] || fail "Schema derlenemedi."

echo "[6/7] Görünürlük ayarları güvenli varsayılanlara alınıyor"
if command -v gsettings >/dev/null 2>&1; then
  GSETTINGS_SCHEMA_DIR="$DEST_DIR/schemas" gsettings set org.gnome.shell.extensions.ubuntu-desktop-tools show-system-monitor true || true
  GSETTINGS_SCHEMA_DIR="$DEST_DIR/schemas" gsettings set org.gnome.shell.extensions.ubuntu-desktop-tools show-terminal-shortcuts true || true
  GSETTINGS_SCHEMA_DIR="$DEST_DIR/schemas" gsettings set org.gnome.shell.extensions.ubuntu-desktop-tools show-quick-notes true || true
  GSETTINGS_SCHEMA_DIR="$DEST_DIR/schemas" gsettings set org.gnome.shell.extensions.ubuntu-desktop-tools show-weather true || true
  GSETTINGS_SCHEMA_DIR="$DEST_DIR/schemas" gsettings set org.gnome.shell.extensions.ubuntu-desktop-tools monitor-refresh-interval 1 || true
fi

echo "[7/7] Kurulu dosya özeti"
find "$DEST_DIR" -type f | sort | sed "s#^$HOME#~#"

echo
echo "Kurulum tamamlandı: $DEST_DIR"
echo "UUID: $UUID"
echo
echo "Wayland oturumunda yeni extension klasörünün görünmesi için çıkış yapıp tekrar giriş yapman gerekebilir."
echo "Sonra çalıştır:"
echo "  gnome-extensions list | grep ubuntu-desktop-tools"
echo "  gnome-extensions enable $UUID"
echo "  gnome-extensions prefs $UUID"
