/**
 * ORRERY LAB A (pass 3) — the focus reticle as ONE always-mounted HUD layer.
 *
 * Why a layer: the pass 1/2 reticle was a React child of the focused body, so
 * it only appeared after the focus commit's full RN-Skia re-record (seconds
 * of blocking sync reads in debug native — PERF-PASS residual 2). On device
 * the camera had long settled before the "lock-on" played. Here the reticle
 * is a per-frame picture driven entirely by UI-thread values: the focus state
 * (written by OrreryWorld in the render that receives the focus), the frame,
 * the light map, a lock-on timeline and the single clock. It lands with the
 * focus itself, and focus changes never re-record anything.
 *
 * Geometry is SCREEN dp around each target's DRAWN disc (projected radius ×
 * visual × depth scale, exactly as its root Group draws it), so it is tight,
 * centred and the same weight at every zoom; it is a billboard (the bodies
 * are billboards; nothing here goes through the plane homography).
 *
 *  - four axis-aligned corner brackets (static once locked);
 *  - a thin lock ring just outside the disc + four cardinal ticks + a short
 *    "scan" arc riding the ring off the single clock;
 *  - lock-on on every focus change: the brackets converge from wide and
 *    rotated with an outBack snap, flash once, then one ping ring leaves.
 *
 * Reduced motion (live): already locked, no flash/ping, scan arc parked.
 * Presentation only: no hit, frame, radius or label change.
 */
import {
  createPicture,
  Picture,
  type SkCanvas,
  Skia,
} from "@shopify/react-native-skia";
import {
  Easing,
  type SharedValue,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { type AnimatedFrame, frameBody } from "@/logic/orrery-frame";
import { useReducedMotionShared } from "@/theme/use-reduced-motion";
import { useOrreryClock } from "../orrery-clock-context";
import {
  RETICLE_FLASH_ALPHA,
  RETICLE_LOCK_MS,
  RETICLE_LOCK_OVERSHOOT,
  RETICLE_LOCK_ROTATE,
  RETICLE_LOCK_SPREAD,
  RETICLE_PING_REACH,
  RETICLE_RING_ALPHA,
  RETICLE_RING_DP,
  RETICLE_SCAN_ARC,
  RETICLE_SCAN_SPEED,
  RETICLE_STROKE_DP,
  RETICLE_TICK_DP,
} from "./deep-field-config";
import { type Rgba, withAlpha } from "./deep-field-ink";
import {
  type BodyLightMap,
  bodyDepthScale,
  bodyVisualScale,
  easeOutBack,
  type FocusState,
  moonVisualScale,
  reticleGeometry,
} from "./deep-field-math";

/** Lock-on timeline: 0 → 1 brackets converge, 1 → LOCK_END flash + ping. */
export const RETICLE_LOCK_END = 2;
/** Flash half-width on the lock timeline (around t = 1). */
const FLASH_SPAN = 0.35;
const STYLE_STROKE = 1;
const CAP_BUTT = 0;
const CAP_ROUND = 1;
const DEG = 180 / Math.PI;

/** Drawn (screen) radius of a frame body, as its root Group draws it. */
export function reticleDrawnRadius(
  kind: string,
  projectedRadius: number,
  far: number,
): number {
  "worklet";
  if (!(projectedRadius > 0)) return 0;
  if (kind === "satellite")
    return projectedRadius * moonVisualScale(projectedRadius);
  if (kind === "sun") return projectedRadius;
  return (
    projectedRadius * bodyVisualScale(projectedRadius) * bodyDepthScale(far)
  );
}

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

export function FocusReticleLayer({
  frame,
  light,
  focus,
  accent,
}: {
  frame: SharedValue<AnimatedFrame>;
  light: SharedValue<BodyLightMap>;
  focus: SharedValue<FocusState>;
  /** The focus accent token as RGBA (never a status hue). */
  accent: Rgba;
}) {
  const clock = useOrreryClock();
  const reducedMotion = useReducedMotionShared();
  const lock = useSharedValue(RETICLE_LOCK_END);
  // Every focus change restarts the lock-on on the UI thread. A remount while
  // already focused shows the locked state (no replay).
  useAnimatedReaction(
    () => focus.value.generation,
    (generation, previous) => {
      if (previous === null || generation === previous) return;
      if (reducedMotion.value) {
        lock.value = RETICLE_LOCK_END;
        return;
      }
      lock.value = 0;
      lock.value = withTiming(RETICLE_LOCK_END, {
        duration: RETICLE_LOCK_MS,
        easing: Easing.linear,
      });
    },
  );
  const picture = useDerivedValue(() => {
    const state = focus.value;
    const current = frame.value;
    const still = !clock || reducedMotion.value;
    const t = still ? RETICLE_LOCK_END : lock.value;
    const scan = still ? 0 : (clock?.value ?? 0) * RETICLE_SCAN_SPEED;
    const lights = light.value;
    const targets = state.targets;
    return createPicture(
      (canvas) => {
        for (let i = 0; i < targets.length; i++) {
          const key = targets[i];
          const body = frameBody(current, key);
          if (!body?.visible || !(body.opacity > 0)) continue;
          const drawn = reticleDrawnRadius(
            body.kind,
            body.radius,
            lights[key]?.[2] ?? 0,
          );
          if (!(drawn > 0)) continue;
          drawReticle(
            canvas,
            body.x,
            body.y,
            drawn,
            t,
            scan,
            accent,
            body.opacity,
            still,
          );
        }
      },
      { width: current.viewport.width, height: current.viewport.height },
    );
  });
  return <Picture picture={picture} />;
}
