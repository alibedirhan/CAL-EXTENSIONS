#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXT_DIR="$ROOT_DIR/ubuntu-desktop-tools@cal"
cd "$ROOT_DIR"

printf '\n[1/7] Dosya yapısı kontrolü\n'
test -f "$EXT_DIR/metadata.json"
test -f "$EXT_DIR/extension.js"
test -f "$EXT_DIR/prefs.js"
test -f "$EXT_DIR/stylesheet.css"
test -f "$EXT_DIR/schemas/org.gnome.shell.extensions.ubuntu-desktop-tools.gschema.xml"
test -f "scripts/check_docs_assets.sh"
test -f "scripts/collect_drag_logs.sh"

printf '\n[2/7] Legacy import kontrolü\n'
# GNOME 45+ ESM kodunda legacy imports.* genel olarak yasaktır.
# Ancak src/compat/ içindeki çok dar kapsamlı fallback kullanımı bilinçli olarak tutulur.
LEGACY_IMPORTS=$(find "$EXT_DIR" -name '*.js' -not -path '*/src/compat/*' -print0 | xargs -0 grep -n "imports\." || true)
if [ -n "$LEGACY_IMPORTS" ]; then
  echo "$LEGACY_IMPORTS"
  echo "HATA: src/compat dışındaki JS dosyalarında legacy imports.* bulundu."
  exit 1
fi
echo "legacy import kontrolü OK"

printf '\n[3/7] GSettings schema compile kontrolü\n'
if command -v glib-compile-schemas >/dev/null 2>&1; then
  TMP_DIR="$(mktemp -d)"
  cp -a "$EXT_DIR/schemas" "$TMP_DIR/schemas"
  glib-compile-schemas "$TMP_DIR/schemas"
  rm -rf "$TMP_DIR"
  echo "schema compile OK"
else
  echo "UYARI: glib-compile-schemas bulunamadı; bu kontrol Ubuntu üzerinde çalıştırınca yapılmalı."
fi

printf '\n[4/7] metadata kontrolü\n'
python3 - <<'PYMETA'
import json, pathlib
p = pathlib.Path('ubuntu-desktop-tools@cal/metadata.json')
data = json.loads(p.read_text())
assert data['uuid'] == 'ubuntu-desktop-tools@cal'
assert data['name'] == 'CAL Extensions'
assert '46' in data['shell-version']
assert data['url'] == 'https://github.com/alibedirhan/CAL-EXTENSIONS'
assert data['settings-schema'] == 'org.gnome.shell.extensions.ubuntu-desktop-tools'
print('metadata OK')
PYMETA

printf '\n[5/7] JavaScript parse kontrolü\n'
if command -v node >/dev/null 2>&1; then
  while IFS= read -r -d '' f; do
    node --check "$f" >/dev/null
  done < <(find "$EXT_DIR" -name '*.js' -print0)
  echo "node --check OK"
else
  echo "node yok; JS parse kontrolü atlandı."
fi

printf '\n[6/7] README görsel asset kontrolü\n'
bash scripts/check_docs_assets.sh

printf '\n[7/7] Release paketi dışlama kontrolü\n'
if find . -path './.git' -prune -o -path './logs' -prune -o \( -name node_modules -o -name gschemas.compiled -o -name '*.log' -o -name '*.bak' \) -print | grep -q .; then
  echo "UYARI: Repoda release dışı bırakılması gereken dosyalar bulunabilir. package_release.sh bunları dışlar."
else
  echo "release dışlama kontrolü OK"
fi

echo "Statik kontrol tamamlandı."
