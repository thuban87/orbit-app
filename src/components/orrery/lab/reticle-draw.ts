/**
 * ORRERY LAB A (pass 3) — the focus reticle drawing (moved out of the former
 * FocusReticleLayer component in the arch perf pass; the scene renderer
 * records it into its own per-frame picture, see LabScene.tsx).
 *
 * Geometry is SCREEN dp around each target's DRAWN disc; four axis-aligned
 * corner brackets, a thin lock ring + ticks + a "scan" arc off the single
 * (ambient) clock, and a lock-on (converge + flash + ping) on each focus
 * change. Reduced motion: already locked, no flash/ping, scan parked.
 * Presentation only: no hit, frame, radius or label change.
 */
import { type SkCanvas, Skia } from "@shopify/react-native-skia";
import {
  RETICLE_FLASH_ALPHA,
  RETICLE_LOCK_OVERSHOOT,
  RETICLE_LOCK_ROTATE,
  RETICLE_LOCK_SPREAD,
  RETICLE_PING_REACH,
  RETICLE_RING_ALPHA,
  RETICLE_RING_DP,
  RETICLE_SCAN_ARC,
  RETICLE_STROKE_DP,
  RETICLE_TICK_DP,
} from "./deep-field-config";
import { type Rgba, withAlpha } from "./deep-field-ink";
import { easeOutBack, reticleGeometry } from "./deep-field-math";

/** Lock-on timeline: 0 → 1 brackets converge, 1 → LOCK_END flash + ping. */
export const RETICLE_LOCK_END = 2;
/** Flash half-width on the lock timeline (around t = 1). */
const FLASH_SPAN = 0.35;
const STYLE_STROKE = 1;
const CAP_BUTT = 0;
const CAP_ROUND = 1;
const DEG = 180 / Math.PI;

function strokePaint(color: Rgba, alpha: number, width: number, cap: number) {
  "worklet";
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(STYLE_STROKE);
  paint.setStrokeWidth(width);
  paint.setStrokeCap(cap);
  paint.setColor(withAlpha(color, Math.max(0, Math.min(1, alpha))));
  return paint;
}

/** Records one reticle at (x, y) around a drawn disc of radius `drawn`. */
export function drawReticle(
  canvas: SkCanvas,
  x: number,
  y: number,
  drawn: number,
  t: number,
  scan: number,
  ink: Rgba,
  opacity: number,
  still: boolean,
): void {
  "worklet";
  const ringR = drawn + RETICLE_RING_DP;
  // 1 · ping (after the converge), leaving the lock ring.
  const v = t - 1;
  if (!still && v > 0 && v < 1) {
    const a = (1 - v) * (1 - v) * 0.8 * opacity;
    canvas.drawCircle(
      x,
      y,
      ringR + v * drawn * RETICLE_PING_REACH,
      strokePaint(ink, a, 1.4, CAP_BUTT),
    );
  }
  // 2 · lock ring + cardinal ticks + scan arc (fade in during converge).
  const ringA =
    RETICLE_RING_ALPHA *
    opacity *
    (still ? 1 : Math.max(0, Math.min(1, (t - 0.4) / 0.6)));
  if (ringA > 0.004) {
    canvas.drawCircle(x, y, ringR, strokePaint(ink, ringA, 1, CAP_BUTT));
    const r0 = ringR + 1.5;
    const r1 = r0 + RETICLE_TICK_DP;
    const tick = strokePaint(ink, ringA * 1.4, 1.2, CAP_BUTT);
    canvas.drawLine(x, y - r0, x, y - r1, tick);
    canvas.drawLine(x + r0, y, x + r1, y, tick);
    canvas.drawLine(x, y + r0, x, y + r1, tick);
    canvas.drawLine(x - r0, y, x - r1, y, tick);
    const arc = Skia.Path.Make();
    arc.addArc(
      Skia.XYWHRect(x - ringR, y - ringR, ringR * 2, ringR * 2),
      -90 + scan * DEG,
      RETICLE_SCAN_ARC * DEG,
    );
    canvas.drawPath(arc, strokePaint(ink, ringA * 1.6, 1.8, CAP_ROUND));
  }
  // 3 · brackets: converge (outBack snap) from wide + rotated, then a flash.
  const u = still ? 1 : easeOutBack(Math.min(1, t), RETICLE_LOCK_OVERSHOOT);
  const s = 1 + (1 - u) * RETICLE_LOCK_SPREAD;
  const { half, arm } = reticleGeometry(drawn);
  const h = half * s;
  const path = Skia.Path.Make();
  for (let i = 0; i < 4; i++) {
    const sx = i === 0 || i === 3 ? -1 : 1;
    const sy = i < 2 ? -1 : 1;
    path.moveTo(sx * h, sy * (h - arm));
    path.lineTo(sx * h, sy * h);
    path.lineTo(sx * (h - arm), sy * h);
  }
  const bracketA = (still ? 1 : Math.min(1, t * 2.5)) * opacity;
  const d = Math.abs(t - 1);
  const flash =
    still || d >= FLASH_SPAN
      ? 0
      : (1 - d / FLASH_SPAN) * RETICLE_FLASH_ALPHA * opacity;
  canvas.save();
  canvas.translate(x, y);
  canvas.rotate((1 - u) * RETICLE_LOCK_ROTATE * DEG, 0, 0);
  if (flash > 0.004)
    canvas.drawPath(
      path,
      strokePaint(ink, flash, RETICLE_STROKE_DP * 2.6, CAP_ROUND),
    );
  canvas.drawPath(
    path,
    strokePaint(ink, bracketA, RETICLE_STROKE_DP, CAP_ROUND),
  );
  canvas.restore();
}
