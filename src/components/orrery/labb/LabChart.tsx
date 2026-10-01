/**
 * ORRERY LAB B — WP-2.2 Standard-package identity: a navigational chart
 * graticule on the world plane (flag `stdChart`, profile `chart`).
 *
 * Standard promises "flatter and calmer" than Galaxy. In the lab, Standard
 * Dark looked identical to Galaxy Dark (M1-CRITIQUE). Instead of a nebula it
 * gets a quiet graphite sky (`STANDARD_DARK_ENV`) plus this chart: range rings
 * at a "nice" world step, bearing spokes and a degree scale on the outer ring —
 * hairlines in a quiet token (`textSecondary`), static world geometry drawn
 * as ONE picture under the plane homography (so it tilts, yaws and zooms with
 * the plane). It encodes NOTHING about contacts (no status, no data); it is
 * pure chart texture. Re-recorded only when the frame changes (camera moves).
 *
 * Hermes rule: worklet helpers are declared ABOVE their callers.
 */
import { Picture, Skia, type SkPicture } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import type { AnimatedFrame } from "@/logic/orrery-frame";
import { type LabChartProfile, labColor } from "@/theme/orrery-lab-fx";
import type { ThemePalette } from "@/theme/theme-types";
import { planeHomography } from "./labb-rings-logic";
import { tokenToVec4 } from "./labb-uniforms";

// --- Tunables -----------------------------------------------------------------
const PICTURE_BOUNDS = 1e5;
/** Rings closer than this on screen fade (like the instrument rings). */
const CHART_FADE_DP = 28;
/** Degree-scale tick lengths (dp): every 10° and every 30°. */
const TICK_MINOR_DP = 4;
const TICK_MAJOR_DP = 9;

/** A "nice" step (1, 2, 2.5, 5 × 10^n) close to `raw`. Plain JS. */
export function niceStep(raw: number): number {
  if (!(raw > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  const k = m < 1.5 ? 1 : m < 2.25 ? 2 : m < 3.5 ? 2.5 : m < 7.5 ? 5 : 10;
  return k * p;
}

/** Range-ring radii (world units) for a scene extent. Plain JS. */
export function chartRadii(extent: number, rings: number): number[] {
  const step = niceStep(Math.max(1, extent) / Math.max(1, rings));
  const out: number[] = [];
  for (let r = step; r <= extent * 1.05 && out.length < 24; r += step)
    out.push(r);
  return out;
}

export function LabChart({
  frame,
  extent,
  colors,
  chart,
}: {
  frame: SharedValue<AnimatedFrame>;
  extent: number;
  colors: ThemePalette;
  chart: LabChartProfile;
}) {
  const radii = useMemo(
    () => chartRadii(extent, chart.rings),
    [extent, chart.rings],
  );
  const tone = useMemo(
    () => tokenToVec4(labColor(colors, chart.tone)),
    [colors, chart.tone],
  );
  const alpha = chart.alpha;
  const scaleAlpha = chart.scaleAlpha;
  const spokeStep = (chart.spokeDeg * Math.PI) / 180;
  const picture = useDerivedValue<SkPicture>(() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(
      Skia.XYWHRect(
        -PICTURE_BOUNDS,
        -PICTURE_BOUNDS,
        PICTURE_BOUNDS * 2,
        PICTURE_BOUNDS * 2,
      ),
    );
    const f = frame.value;
    const m = planeHomography(f.pose, f.viewport);
    if (!m || radii.length === 0) return recorder.finishRecordingAsPicture();
    const zoom = f.pose.zoom > 0 ? f.pose.zoom : 1;
    const gap = radii[0];
    const fade = Math.min(1, Math.max(0.3, (gap * zoom) / CHART_FADE_DP));
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(1);
    paint.setStrokeWidth(1 / zoom);
    paint.setColor(
      Float32Array.of(tone[0], tone[1], tone[2], tone[3] * alpha * fade),
    );
    canvas.save();
    canvas.concat(m);
    for (let i = 0; i < radii.length; i++)
      canvas.drawCircle(0, 0, radii[i], paint);
    const inner = radii[0] * 0.5;
    const outer = radii[radii.length - 1];
    for (let a = 0; a < Math.PI * 2 - 1e-6; a += spokeStep) {
      const s = Math.sin(a);
      const c = -Math.cos(a);
      canvas.drawLine(inner * s, inner * c, outer * s, outer * c, paint);
    }
    // Degree scale on the outer ring (every 10°, longer every 30°).
    const ticks = Skia.Paint();
    ticks.setAntiAlias(true);
    ticks.setStyle(1);
    ticks.setStrokeWidth(1 / zoom);
    ticks.setColor(
      Float32Array.of(tone[0], tone[1], tone[2], tone[3] * scaleAlpha),
    );
    for (let d = 0; d < 360; d += 10) {
      const a = (d * Math.PI) / 180;
      const len = (d % 30 === 0 ? TICK_MAJOR_DP : TICK_MINOR_DP) / zoom;
      const s = Math.sin(a);
      const c = -Math.cos(a);
      canvas.drawLine(
        outer * s,
        outer * c,
        (outer + len) * s,
        (outer + len) * c,
        ticks,
      );
    }
    canvas.restore();
    return recorder.finishRecordingAsPicture();
  });
  return <Picture picture={picture} />;
}
