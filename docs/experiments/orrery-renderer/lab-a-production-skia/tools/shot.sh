#!/usr/bin/env bash
# ORRERY LAB A (experiment-only) — screenshot helper.
#   tools/shot.sh <out.png> [preview.jpg]
# Captures a full-res PNG from the single attached device; optionally writes a
# 540px-wide JPEG preview (for agent review without burning context).
set -euo pipefail
ADB=~/.local/bin/adb
n=$($ADB devices | awk '$2=="device"' | wc -l)
[ "$n" = 1 ] || { echo "need exactly one device, got $n" >&2; exit 1; }
S=$($ADB devices | awk '$2=="device"{print $1}')
$ADB -s "$S" exec-out screencap -p > "$1"
if [ "${2:-}" != "" ]; then
  python3 - "$1" "$2" <<'PY'
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("RGB")
w = 540
im.resize((w, int(im.height * w / im.width))).save(sys.argv[2], quality=82)
PY
fi
