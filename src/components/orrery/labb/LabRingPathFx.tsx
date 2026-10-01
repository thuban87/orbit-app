/**
 * DEAD END (WP-1.3, emulator A/B runs G/H): progress wakes as 3 stacked
 * stroked sub-arc PATHS per class and drift tethers as one stroked segment
 * path per class. Static world geometry under the homography — but Ganesh
 * re-tessellates stroked paths on the CPU every replay: wake ≈ +56 ms p50,
 * tethers ≈ +12 ms p50 on the emulator (rings-only 48 ms → all 117 ms).
 * Replaced by per-ring wake circles + `ringWake` shader and rotated tether
 * rects (back to 48 ms). Kept here only to be reverted / recoverable.
 */
import {
  Group,
  Path,
  Shader,
  Skia,
  type SkPath,
} from "@shopify/react-native-skia";
import { useMemo } from "react";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import type { LabRingProfile } from "@/theme/orrery-lab-fx";
import { getLabEffect } from "./labb-effects";
import { tetherSegment, wakeAngle } from "./labb-rings-logic";

const WAKE_STEPS = [0, 0.55, 0.85] as const;

interface Entry {
  x: number;
  y: number;
  radius: number;
  ringRadius: number;
}

function wakePath(entries: readonly Entry[], fraction: number): SkPath {
  const path = Skia.Path.Make();
  for (const e of entries) {
    const angle = wakeAngle(e.x, e.y);
    if (e.ringRadius <= 0 || angle < 1e-3) continue;
    const start = angle * fraction;
    path.addArc(
      {
        x: -e.ringRadius,
        y: -e.ringRadius,
        width: e.ringRadius * 2,
        height: e.ringRadius * 2,
      },
      (start * 180) / Math.PI - 90,
      ((angle - start) * 180) / Math.PI,
    );
  }
  return path;
}

export function PathWakeClassGroup({
  entries,
  color,
  zoom,
  profile,
  settled,
  uniforms,
}: {
  entries: readonly Entry[];
  color: string;
  zoom: SharedValue<number>;
  profile: LabRingProfile;
  settled: SharedValue<number>;
  uniforms: SharedValue<Record<string, number[]>>;
}) {
  const effect = getLabEffect("ringInstrument");
  const paths = useMemo(
    () => WAKE_STEPS.map((f) => wakePath(entries, f)),
    [entries],
  );
  const strokeWidth = useDerivedValue(() => profile.wakeWidthDp / zoom.value);
  return (
    <Group
      style="stroke"
      strokeWidth={strokeWidth}
      strokeCap="round"
      color={color}
      opacity={settled}
    >
      {effect ? <Shader source={effect} uniforms={uniforms} /> : null}
      {paths.map((path, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed WAKE_STEPS
        <Path key={`wake-${i}`} path={path} />
      ))}
    </Group>
  );
}

export function PathTetherClassGroup({
  entries,
  color,
  zoom,
  profile,
  settled,
}: {
  entries: readonly Entry[];
  color: string;
  zoom: SharedValue<number>;
  profile: LabRingProfile;
  settled: SharedValue<number>;
}) {
  const path = useMemo(() => {
    const p = Skia.Path.Make();
    for (const e of entries) {
      const s = tetherSegment(e.ringRadius, e.x, e.y, e.radius);
      if (!s) continue;
      p.moveTo(s.x0, s.y0);
      p.lineTo(s.x1, s.y1);
    }
    return p;
  }, [entries]);
  const strokeWidth = useDerivedValue(() => profile.tetherWidthDp / zoom.value);
  return (
    <Group
      style="stroke"
      strokeWidth={strokeWidth}
      color={color}
      opacity={settled}
    >
      <Path path={path} opacity={profile.tetherAlpha} />
    </Group>
  );
}
