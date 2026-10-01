#!/usr/bin/env bash
# R1 density matrix: renderer/config × System size × {idle, pan, focus, switch}.
# Usage: r1-matrix.sh <out-dir> [config-filter]   (configs: laball labmin legacy, + extra via CONFIGS env)
set -u
OUT=$1; FILTER=${2:-}
T=$(dirname "$0")/r1-perf.sh
MIN="environment:0,fx:0,ringShader:0,ringFlow:0,ringWake:0,ringTethers:0,ringTicks:0,bodyLighting:0,polarisLab:0,stdChart:0,labelHud:0"
declare -A CFG_R=( [laball]=lab [labmin]=lab [legacy]=legacy )
declare -A CFG_F=( [laball]="${LABALL_FLAGS:-idleClock:0}" [labmin]="${LABMIN_FLAGS:-idleClock:0,$MIN}" [legacy]="idleClock:0" )
SYSTEMS=${SYSTEMS:-"12 120 400 800"}
for cfg in ${CONFIGS:-laball labmin legacy}; do
  [ -n "$FILTER" ] && [[ "$cfg" != $FILTER ]] && continue
  for n in $SYSTEMS; do
    case $n in
      12) S="Lab B Inner Circle"; F="Ada Abbott"; O="Lab B Dense" ;;
      120) S="Lab B Dense"; F="Ada Abbott"; O="Lab B Inner Circle" ;;
      400) S="Lab B Stress 400"; F="Ada Vance"; O="Lab B Inner Circle" ;;
      800) S="Lab B Stress 800"; F="Ada Vance"; O="Lab B Inner Circle" ;;
    esac
    echo "== $cfg $n $(date +%T)"
    $T "$OUT" "${cfg}-${n}" "${CFG_R[$cfg]}" "${CFG_F[$cfg]}" "$S" "$F" "$O"
  done
done
echo "== done $(date +%T)"
