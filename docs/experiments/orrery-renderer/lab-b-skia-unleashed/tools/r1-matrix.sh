#!/usr/bin/env bash
# Density matrix: config × System size × {idle, pan, focus, switch}.
# Usage: r1-matrix.sh <out-dir> [config-filter]
# R3: configs are the panel PRESETS plus two stage/bloom deltas:
#   best        "Lab B best" (the R3 defaults)
#   shipsafe    "Ship-safe"  (only effects judged worth shipping)
#   everything  "Everything" (incl. bloom, lens flare, tilt-shift, shock filter, live nebula)
#   legacy      the production renderer
#   bloom       best + bloom (the R2 costly experiment, alone)
#   nostage     best − R2 stage plane (planeLight, planeGrid)
#   labmin      lab renderer with every effect off (floor; R1's "lab minimal", now incl. R2/R3)
# Env: CONFIGS (default "best shipsafe everything legacy bloom nostage"), SYSTEMS,
#      EXTRA_FLAGS (appended to every config, default idleClock:0 for gfx A/B), and r1-perf.sh's.
set -u
OUT=$1; FILTER=${2:-}
T=$(dirname "$0")/r1-perf.sh
EXTRA=${EXTRA_FLAGS:-idleClock:0}
MIN="environment:0,fx:0,ringShader:0,ringFlow:0,ringWake:0,ringTethers:0,ringTicks:0,bodyLighting:0,polarisLab:0,stdChart:0,labelHud:0,planeLight:0,planeGrid:0,ringSunLight:0,bodySizeFloor:0,homeTilt:0,nearSizeClamp:0,immersiveChrome:0"
declare -A CFG_P=( [best]=best [shipsafe]=shipSafe [everything]=everything [legacy]=legacy [bloom]=best [nostage]=best [labmin]=best )
declare -A CFG_R=( [best]=lab [shipsafe]=lab [everything]=lab [legacy]=legacy [bloom]=lab [nostage]=lab [labmin]=lab )
declare -A CFG_F=( [best]="$EXTRA" [shipsafe]="$EXTRA" [everything]="$EXTRA" [legacy]="$EXTRA"
  [bloom]="$EXTRA,bloom:1" [nostage]="$EXTRA,planeLight:0,planeGrid:0" [labmin]="$EXTRA,$MIN" )
SYSTEMS=${SYSTEMS:-"12 120 400 800"}
for cfg in ${CONFIGS:-best shipsafe everything legacy bloom nostage}; do
  [ -n "$FILTER" ] && [[ "$cfg" != $FILTER ]] && continue
  for n in $SYSTEMS; do
    case $n in
      12) S="Lab B Inner Circle"; F="Ada Abbott"; O="Lab B Dense" ;;
      120) S="Lab B Dense"; F="Ada Abbott"; O="Lab B Inner Circle" ;;
      400) S="Lab B Stress 400"; F="Ada Vance"; O="Lab B Inner Circle" ;;
      800) S="Lab B Stress 800"; F="Ada Vance"; O="Lab B Inner Circle" ;;
    esac
    echo "== $cfg $n $(date +%T)"
    PRESET="${CFG_P[$cfg]}" $T "$OUT" "${cfg}-${n}" "${CFG_R[$cfg]}" "${CFG_F[$cfg]}" "$S" "$F" "$O"
  done
done
echo "== done $(date +%T)"
