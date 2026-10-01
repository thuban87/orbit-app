#!/usr/bin/env bash
# r2-snap.sh <out.jpg> — emulator screencap straight to JPEG q85 (no PNG on disk).
ADB=${ADB:-"$HOME/Android/Sdk/platform-tools/adb -P 5039 -s emulator-5554"}
$ADB exec-out screencap -p | python3 -c "import sys,io; from PIL import Image; Image.open(io.BytesIO(sys.stdin.buffer.read())).convert('RGB').save(sys.argv[1], quality=85)" "$1"
echo "shot $1"
