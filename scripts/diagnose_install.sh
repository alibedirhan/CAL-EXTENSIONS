#!/usr/bin/env bash
set -euo pipefail
UUID="ubuntu-desktop-tools@cal"
DEST_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"
SCHEMA="org.gnome.shell.extensions.ubuntu-desktop-tools"
SCHEMA_DIR="$DEST_DIR/schemas"

ok() { echo "[OK]   $*"; }
info() { echo "[INFO] $*"; }
warn() { echo "[WARN] $*"; }
fail() { echo "[FAIL] $*"; }

schema_mode="none"
if command -v gsettings >/dev/null 2>&1 && gsettings list-schemas | grep -Fxq "$SCHEMA"; then
  schema_mode="system"
elif command -v gsettings >/dev/null 2>&1 && [ -d "$SCHEMA_DIR" ] && gsettings --schemadir "$SCHEMA_DIR" list-recursively "$SCHEMA" >/dev/null 2>&1; then
  schema_mode="local"
fi

printf '\n== CAL Extensions Diagnose ==\n'

if command -v gnome-shell >/dev/null 2>&1; then
  ok "GNOME Shell: $(gnome-shell --version)"
else
  fail "gnome-shell komutu bulunamadı. GNOME dışı masaüstü desteklenmez."
fi

ok "Oturum: ${XDG_SESSION_TYPE:-unknown}"
ok "Masaüstü: ${XDG_CURRENT_DESKTOP:-unknown}"

printf '\n== Extension durumu ==\n'
state="unknown"
if command -v gnome-extensions >/dev/null 2>&1; then
  if gnome-extensions list | grep -Fxq "$UUID"; then
    ok "Extension listede görünüyor: $UUID"
  else
    warn "Extension listede görünmüyor. Wayland kullanıyorsan çıkış/giriş gerekebilir."
  fi
  info_text="$(gnome-extensions info "$UUID" 2>/dev/null || true)"
  printf '%s\n' "$info_text"
  state="$(printf '%s\n' "$info_text" | awk -F': ' '/State:/ {print $2; exit}')"
else
  fail "gnome-extensions komutu bulunamadı."
fi

printf '\n== Kurulum klasörü ==\n'
echo "$DEST_DIR"
if [ -d "$DEST_DIR" ]; then
  ok "Kurulum klasörü var."
else
  fail "Kurulum klasörü yok. scripts/install_local.sh çalıştır."
fi

printf '\n== Kritik dosyalar ==\n'
for f in metadata.json extension.js prefs.js stylesheet.css schemas/org.gnome.shell.extensions.ubuntu-desktop-tools.gschema.xml schemas/gschemas.compiled; do
  if [ -f "$DEST_DIR/$f" ]; then
    ok "$f"
  else
    fail "$f eksik"
  fi
done

printf '\n== Schema erişimi ==\n'
case "$schema_mode" in
  system)
    ok "GSettings schema sistem listesinde erişilebilir: $SCHEMA"
    ;;
  local)
    ok "Yerel extension schema erişilebilir: $SCHEMA_DIR"
    info "GNOME yerel extension schema'larını sistem listesinde göstermeyebilir; bu tek başına hata değildir."
    ;;
  *)
    warn "GSettings schema erişilemedi. Kurulumdan sonra çıkış/giriş veya scripts/install_local.sh gerekebilir."
    ;;
esac

printf '\n== Terminal adayları ==\n'
found=0
for bin in gnome-terminal ptyxis kgx konsole xfce4-terminal tilix alacritty kitty x-terminal-emulator; do
  if command -v "$bin" >/dev/null 2>&1; then
    ok "$bin"
    found=1
  fi
done
[ "$found" -eq 1 ] || warn "Desteklenen terminal emülatörü bulunamadı. Terminal modülü komut açamayabilir."

printf '\n== Safe mode marker ==\n'
RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
if [ -e "$RUNTIME_DIR/gnome-shell-disable-extensions" ]; then
  if [ "$state" = "ACTIVE" ]; then
    info "Safe-mode marker mevcut ama extension ACTIVE; şu an engelleyici görünmüyor."
  else
    warn "Safe-mode marker mevcut: $RUNTIME_DIR/gnome-shell-disable-extensions"
    info "Gerekirse: rm -f '$RUNTIME_DIR/gnome-shell-disable-extensions'"
  fi
else
  ok "Safe-mode marker yok."
fi

printf '\n== Son CAL Extensions logları ==\n'
{
  journalctl /usr/bin/gnome-shell -n 160 --no-pager 2>/dev/null || true
  journalctl --user -n 160 --no-pager 2>/dev/null || true
} | grep -Ei "CALExtensions|ubuntu-desktop-tools|CAL Extensions" | tail -100 || true
