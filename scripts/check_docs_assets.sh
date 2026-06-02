#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

README="README.md"
if [ ! -f "$README" ]; then
  echo "HATA: README.md bulunamadı."
  exit 1
fi

missing=0
while IFS= read -r path; do
  [ -z "$path" ] && continue
  if [ ! -f "$path" ]; then
    echo "HATA: README görsel yolu bulunamadı: $path"
    missing=1
  fi
done < <(grep -oE 'docs/assets/screenshots/[^\" )>`]+' "$README" | sort -u)

if [ "$missing" -ne 0 ]; then
  exit 1
fi

echo "README görsel/link asset kontrolü OK"
