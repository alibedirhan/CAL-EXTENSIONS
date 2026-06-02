#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
VERSION="${1:-v0.2.4-diagnostics-weather-cleanup}"
OUT="../CAL-Extensions-${VERSION}.zip"
SHA="${OUT}.sha256"

bash scripts/check_static.sh
rm -f "$OUT" "$SHA"
zip -r "$OUT" \
  ubuntu-desktop-tools@cal \
  README.md LICENSE CHANGELOG.md CONTRIBUTING.md SECURITY.md SUPPORT.md package.json .gitignore \
  docs scripts .github \
  -x '*/.git/*' '*/node_modules/*' '*/.DS_Store' '*/gschemas.compiled' '*.log' '*.bak' '*.tmp'

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$OUT" > "$SHA"
  echo "SHA256 oluşturuldu: $SHA"
fi

echo "Paket oluşturuldu: $OUT"
