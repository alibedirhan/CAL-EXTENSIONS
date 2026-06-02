#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_ROOT="$ROOT_DIR/logs"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$LOG_ROOT/cal_drag_test_$STAMP"
UUID="ubuntu-desktop-tools@cal"
SCHEMA_ID="org.gnome.shell.extensions.ubuntu-desktop-tools"
SCHEMA_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID/schemas"

mkdir -p "$OUT"

SINCE="$(date --iso-8601=seconds)"
echo "$SINCE" > "$OUT/since.txt"

cat <<MSG

CAL Extensions drag log toplama başladı.

Süre: 60 saniye
Log klasörü:
$OUT

Şimdi 60 saniye boyunca şunları dene:
- Rail tutacağına kısa tıkla
- Yavaş sürükle
- Hızlı sürükle
- Yukarı/aşağı bırak
- Ekran üst/alt sınırına yaklaştır
- Ayarlar düğmesine bas
- Terminal / Notlar / Sistem Bilgisi / Hava Durumu ikonlarına bas

Sayaç başladı...

MSG

for i in $(seq 60 -1 1); do
  printf "\rKalan süre: %02d saniye " "$i"
  sleep 1
done

echo
echo "Loglar toplanıyor..."

{
  echo "CAL Extensions Drag Test"
  echo "Started: $SINCE"
  echo "Ended:   $(date --iso-8601=seconds)"
  echo "Root:    $ROOT_DIR"
  echo "UUID:    $UUID"
  echo
  echo "uname:"
  uname -a
  echo
  echo "session:"
  echo "XDG_SESSION_TYPE=${XDG_SESSION_TYPE:-unknown}"
  echo "XDG_CURRENT_DESKTOP=${XDG_CURRENT_DESKTOP:-unknown}"
} > "$OUT/environment.txt" 2>&1

if [[ -x "$ROOT_DIR/scripts/check_static.sh" ]]; then
  bash "$ROOT_DIR/scripts/check_static.sh" > "$OUT/check_static.txt" 2>&1
else
  echo "scripts/check_static.sh bulunamadı veya çalıştırılabilir değil." > "$OUT/check_static.txt"
fi

if [[ -x "$ROOT_DIR/scripts/status_extension.sh" ]]; then
  bash "$ROOT_DIR/scripts/status_extension.sh" > "$OUT/status_extension.txt" 2>&1
else
  echo "scripts/status_extension.sh bulunamadı veya çalıştırılabilir değil." > "$OUT/status_extension.txt"
fi

if [[ -x "$ROOT_DIR/scripts/diagnose_install.sh" ]]; then
  bash "$ROOT_DIR/scripts/diagnose_install.sh" > "$OUT/diagnose_install.txt" 2>&1
else
  echo "scripts/diagnose_install.sh bulunamadı veya çalıştırılabilir değil." > "$OUT/diagnose_install.txt"
fi

gnome-shell --version > "$OUT/gnome_shell_version.txt" 2>&1
gnome-extensions info "$UUID" > "$OUT/extension_info.txt" 2>&1
gnome-extensions list > "$OUT/extension_list.txt" 2>&1

if [[ -d "$SCHEMA_DIR" ]]; then
  gsettings --schemadir "$SCHEMA_DIR" list-recursively "$SCHEMA_ID" > "$OUT/gsettings_cal.txt" 2>&1
else
  echo "Schema directory bulunamadı: $SCHEMA_DIR" > "$OUT/gsettings_cal.txt"
fi

journalctl --user --since "$SINCE" -o short-iso > "$OUT/journal_user_since.txt" 2>&1

journalctl --user --since "$SINCE" -o short-iso \
  | grep -iE "CALExtensions|ubuntu-desktop-tools|gnome-shell|Gjs|JS ERROR|TypeError|ReferenceError|Error|warning|drag|rail|offset|gesture|button|actor|clutter|st widget" \
  > "$OUT/cal_filtered_log.txt" 2>&1 || true

journalctl --user --since "$SINCE" -o short-iso \
  | grep -iE "CALExtensions|ubuntu-desktop-tools" \
  > "$OUT/cal_only_log.txt" 2>&1 || true

cd "$LOG_ROOT" || exit 1
zip -r "cal_drag_test_$STAMP.zip" "cal_drag_test_$STAMP" > "$OUT/zip_output.txt" 2>&1

echo
echo "Tamamlandı."
echo "Log klasörü:"
echo "$OUT"
echo
echo "Zip dosyası:"
echo "$LOG_ROOT/cal_drag_test_$STAMP.zip"
