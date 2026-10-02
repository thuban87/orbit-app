#!/usr/bin/env bash
# Tilt fix phone matrix: {before = ringPlaneDraw:0, after = ring field} ×
# {home tilt (preset best), max manual tilt (pose tilt=1.0472), tilt 0} ×
# Systems × {idle, pan}. SurfaceFlinger presents (SF=1), release, opaque canvas.
# Usage: tf-matrix.sh <out-dir> [variants] [systems]
set -u
OUT=$1; VARS=${2:-"after before"}; SYS=${3:-"120 400"}
T=$(dirname "$0")/r1-perf.sh
export SF=1 OPAQUE=1
for n in $SYS; do
  case $n in
    120) S="Lab B Dense"; F="Ada Abbott"; O="Lab B Inner Circle" ;;
    400) S="Lab B Stress 400"; F="Ada Vance"; O="Lab B Inner Circle" ;;
  esac
  for v in $VARS; do
    case $v in after) VF="idleClock:0" ;; before) VF="idleClock:0,ringPlaneDraw:0" ;; esac
    for t in home max flat; do
      case $t in home) TF=""; P="" ;; max) TF=""; P="tilt=1.0472" ;; flat) TF=",homeTilt:0"; P="" ;; esac
      echo "== $v $t $n $(date +%T) $($ADB shell dumpsys thermalservice 2>/dev/null | grep -m1 'Thermal Status' | tr -d '\r') $($ADB shell dumpsys battery | grep -m1 level | tr -d '\r ')"
      POSE="$P" PRESET=best $T "$OUT" "$v-$t-$n" lab "$VF$TF" "$S" "$F" "$O" "idle pan" | cut -f1,2,12-
    done
  done
done
