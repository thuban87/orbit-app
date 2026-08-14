#!/usr/bin/env bash
#
# Shared no-hardcoded-colour gate (CLAUDE.md: all colours resolve through theme
# tokens — the sole sanctioned location for a colour literal is src/**/theme/**).
#
# Scans TS/TSX targets for forbidden colour literals:
#   - hex:   #RGB / #RGBA / #RRGGBB / #RRGGBBAA   (3-8 hex digits)
#   - funcs: rgb()/rgba() and hsl()/hsla()
#   - quoted named colours (white, black, red, …)
#
# Each argument may be a FILE or a DIRECTORY (grep -r handles both), so later
# phases can point the gate at a single changed file. Defaults to `src App.tsx`.
#
# Exit 0 when the scanned targets are clean; exit 1 when any literal is found.
#
# Usage: bash scripts/check-colors.sh [target ...]
set -uo pipefail

targets=("$@")
if [ ${#targets[@]} -eq 0 ]; then
  targets=(src App.tsx)
fi

# Only scan targets that actually exist (a default like App.tsx may be absent).
existing=()
for t in "${targets[@]}"; do
  [ -e "$t" ] && existing+=("$t")
done
if [ ${#existing[@]} -eq 0 ]; then
  exit 0
fi

named='(white|black|transparent|silver|gray|grey|red|green|blue|yellow|orange|purple|pink|cyan|magenta|brown)'
quote="[\"']"
pattern="#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|${quote}${named}${quote}"

# --include applies only to files discovered via directory recursion, so a
# directly-named file target is always scanned. Matches under /theme/ are the
# one sanctioned exception and are filtered out.
matches=$(grep -rEniI \
  --include='*.ts' --include='*.tsx' \
  "$pattern" \
  "${existing[@]}" 2>/dev/null \
  | grep -vE '/theme/' || true)

if [ -n "$matches" ]; then
  {
    echo "check-colors: forbidden colour literal(s) found outside src/**/theme/**."
    echo "All colours must resolve through theme tokens (CLAUDE.md)."
    echo "$matches"
  } >&2
  exit 1
fi

exit 0
