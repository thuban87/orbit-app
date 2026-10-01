#!/usr/bin/env bash
# R2 relative A/B (emulator, release): R2 art + hero experiments on Lab B Dense (120).
# Usage: r2-perf.sh <out-dir>   (gfxinfo path: opaqueCanvas:0, idleClock:0 as in R1)
set -u
OUT=$1; T=$(dirname "$0")/r1-perf.sh
B="idleClock:0,opaqueCanvas:0"
OFF="homeTilt:0,planeLight:0,planeGrid:0,ringSunLight:0,bodySizeFloor:0"
run() { echo "== $1 $(date +%T)"; $T "$OUT" "$1" lab "$B,$2" "Lab B Dense" "Ada Abbott" "Lab B Inner Circle" "$3"; }
run r1base "$OFF" "idle pan focus switch"
run r2art "" "idle pan focus switch"
run r2bloom "bloom:1" "idle pan focus switch"
run r2flare "lensFlare:1" "idle pan focus"
run r2tiltshift "tiltShift:1" "idle pan focus"
run r2shockfilter "fxShockFilter:1" "switch"
echo "== done $(date +%T)"
