#!/usr/bin/env bash
set -euo pipefail
UUID="ubuntu-desktop-tools@cal"
SCHEMA="org.gnome.shell.extensions.ubuntu-desktop-tools"
DEST_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"
SCHEMA_DIR="$DEST_DIR/schemas"

schema_mode="none"
if command -v gsettings >/dev/null 2>&1 && gsettings list-schemas | grep -Fxq "$SCHEMA"; then
  schema_mode="system"
elif command -v gsettings >/dev/null 2>&1 && [ -d "$SCHEMA_DIR" ] && gsettings --schemadir "$SCHEMA_DIR" list-recursively "$SCHEMA" >/dev/null 2>&1; then
  schema_mode="local"
fi

schema_get() {
  local key="$1"
  if [ "$schema_mode" = "system" ]; then
    gsettings get "$SCHEMA" "$key" 2>/dev/null || echo unknown
  elif [ "$schema_mode" = "local" ]; then
    gsettings --schemadir "$SCHEMA_DIR" get "$SCHEMA" "$key" 2>/dev/null || echo unknown
  else
    echo unavailable
  fi
}

schema_keys() {
  if [ "$schema_mode" = "system" ]; then
    gsettings list-keys "$SCHEMA" 2>/dev/null | sort
  elif [ "$schema_mode" = "local" ]; then
    gsettings --schemadir "$SCHEMA_DIR" list-keys "$SCHEMA" 2>/dev/null | sort
  fi
}

is_active="unknown"
if command -v gnome-extensions >/dev/null 2>&1; then
  info="$(gnome-extensions info "$UUID" 2>/dev/null || true)"
  if printf '%s\n' "$info" | grep -q "State: ACTIVE"; then
    is_active="yes"
  elif printf '%s\n' "$info" | grep -q "State:"; then
    is_active="no"
  fi
fi

echo "CAL Extensions status"
echo "---------------------"
echo "Oturum türü: ${XDG_SESSION_TYPE:-unknown}"
echo "Masaüstü: ${XDG_CURRENT_DESKTOP:-unknown}"
echo

echo "Extension listesi:"
gnome-extensions list | grep -F "$UUID" || true
echo

echo "Extension info:"
gnome-extensions info "$UUID" || true
echo

echo "GNOME global extension ayarları:"
echo "disable-user-extensions: $(gsettings get org.gnome.shell disable-user-extensions 2>/dev/null || echo unknown)"
echo "enabled-extensions: $(gsettings get org.gnome.shell enabled-extensions 2>/dev/null || echo unknown)"
echo

echo "CAL ayarları:"
case "$schema_mode" in
  system)
    echo "schema: system OK ($SCHEMA)"
    ;;
  local)
    echo "schema: local extension schema OK ($SCHEMA_DIR)"
    echo "not: Yerel eklenti schema'ları sistem listesinde görünmeyebilir; bu tek başına hata değildir."
    ;;
  *)
    echo "schema: erişilemedi ($SCHEMA)"
    echo "öneri: bash scripts/install_local.sh çalıştırıp oturumu yenile."
    ;;
esac

if [ "$schema_mode" != "none" ]; then
  while IFS= read -r key; do
    [ -n "$key" ] && echo "$key: $(schema_get "$key")"
  done < <(schema_keys)
fi

echo
RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
if [ -e "$RUNTIME_DIR/gnome-shell-disable-extensions" ]; then
  if [ "$is_active" = "yes" ]; then
    echo "safe-mode disable file: mevcut ama extension aktif; şu an engelleyici görünmüyor."
  else
    echo "safe-mode disable file: mevcut -> $RUNTIME_DIR/gnome-shell-disable-extensions"
    echo "öneri: gerekirse rm -f '$RUNTIME_DIR/gnome-shell-disable-extensions' ve oturumu yenile."
  fi
else
  echo "safe-mode disable file: yok"
fi

echo
echo "Son CAL Extensions logları:"
{
  journalctl /usr/bin/gnome-shell -n 160 --no-pager 2>/dev/null || true
  journalctl --user -n 160 --no-pager 2>/dev/null || true
} | grep -Ei "CALExtensions|ubuntu-desktop-tools|CAL Extensions" | tail -80 || true
