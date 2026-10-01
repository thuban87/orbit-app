/**
 * ORRERY LAB B — L1 instrument orbits (WP-1.3).
 *
 * Everything in this layer is STATIC WORLD-SPACE geometry drawn inside ONE
 * Group whose `matrix` is the per-frame plane homography (`planeHomography`):
 *   - ring  = `<Circle cx=0 cy=0 r=R>` (R = world ring radius, from the frame so
 *     switch/reorder interpolation still applies), one per contact, grouped by
 *     instrument class (status) under ONE `ringInstrument` stroke shader per
 *     class: hairline in the status hue, far-side depth fade, shader dashes
 *     (no CPU DashPathEffect), optional uniform energy flow;
 *   - progress wake = 3 nested sub-arcs per ring, merged per class into 3 paths
 *     (stacked alpha brightens toward the body); built in React from the world
 *     bodies, hidden while a switch or reorder moves the bodies;
 *   - drift tethers (decay / rogue) = rail point → body limb, radial dashes;
 *   - ticks: north ticks on every ring at `detail`, a 30° tick scale on the
 *     focused ring, and the compass chevron on the world rim.
 * Per frame nothing is rebuilt: the matrix, a few float4 uniform sets and one
 * radius/opacity pair per ring (only when the frame changes).
 *
 * Status meaning kept (see `ringInstrumentClass`): hue, weight order, solid /
 * dashed / faded / faint-trace style, never-contacted neutral. Satellites have
 * no rings (ADR-105); the sun has none.
 *
 * `LabRingsPathRebuild` keeps the WP-1.0 parity rings (128-point Path rebuilt
 * per ring) as the A/B baseline behind the `ringsPathRebuild` flag.
 */
import {
  Circle,
  DashPathEffect,
  Group,
  Path,
  Picture,
  Rect,
  Shader,
  Skia,
  type SkPath,
  type SkPicture,
  type SkRuntimeEffect,
} from "@shopify/react-native-skia";
import { useMemo } from "react";
import {
  type SharedValue,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { ProfileStatus } from "@/db/contact-status-read";
import type { AnimatedFrame } from "@/logic/orrery-frame";
import type { SemanticLevel } from "@/logic/orrery-label-logic";
import type { MotionRequest } from "@/logic/orrery-recovery-logic";
import type { ReorderDrag } from "@/logic/orrery-reorder-logic";
import {
  type OrreryRingStyle,
  orreryRingStyle,
} from "@/logic/orrery-ring-logic";
import { sampleSwitchEntry } from "@/logic/orrery-switch-choreography";
import type { LabFlags } from "@/stores/orrery-labb-fx-store";
import { type LabRingProfile, labColor } from "@/theme/orrery-lab-fx";
import type { ThemePalette } from "@/theme/theme-types";
import type { OrreryBodyResource } from "../use-orrery-switch-runtime";
import { useLabRenderContext, useLabStillContext } from "./labb-context";
import { getLabEffect, LAB_EFFECT_SOURCES } from "./labb-effects";
import { focusDimFactor } from "./labb-focus-logic";
import { bodyAt, type FrameIndex } from "./labb-frame-index";
import { flattenUniforms, uniformOrder } from "./labb-layer-plan";
import { probeEnd, probeStart } from "./labb-perf-probe";
import {
  compassChevron,
  northTick,
  planeHomography,
  type RingInstrumentClass,
  type RingUniforms,
  ringDensityFade,
  ringInstrumentClass,
  ringUniforms,
  type Segment,
  scaleTicks,
  tetherRect,
  tiltDepth,
  typicalRingGap,
  type WakeUniforms,
  wakeAngle,
  wakeUniforms,
} from "./labb-rings-logic";
import {
  classRingSwitchFade,
  FLOW_SPOOL,
  switchFxLive,
  trimRingState,
  warpAmount,
} from "./labb-switch-logic";
import { tokenToVec4 } from "./labb-uniforms";

const IDENTITY_3X3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
/** R1 LOD: above this many rings the ambient energy flow is off (C-59). */
export const FLOW_LOD_MAX_RINGS = 160;
/** R1 LOD: above this many rings the progress wakes are off (C-60). */
export const WAKE_LOD_MAX_RINGS = 160;
/** R1: wakes fade back in over this long after a camera recovery settles. */
const WAKE_RETURN_MS = 260;
const EMPTY_KEYS: ReadonlySet<string> = new Set();
/** Stable empty focus-key list (worklet capture must not change identity). */
const NO_FOCUS_KEYS: string[] = [];
/** Shader modes (see `ringInstrument`). */
const MODE_RING = 0;
const MODE_RADIAL = 2;
/** Fallback dash intervals (world units) when the shader is unavailable. */
const FALLBACK_DASH = [5, 5];
/** Wake stroke = visible width × this (the shader fades the cross profile). */
const WAKE_STROKE_SCALE = 1.6;
/** Ring picture cull bounds (world units). */
const RING_PICTURE_BOUNDS = 1e5;
const RING_ORDER = uniformOrder(LAB_EFFECT_SOURCES.ringInstrument);

// ---------------------------------------------------------------------------
// A/B baseline: WP-1.0 parity rings (per-frame 128-point Path per ring).

function legacyAlpha(style: OrreryRingStyle): number {
  return style.strokeStyle === "faded"
    ? 0.7
    : style.strokeStyle === "faintTrace"
      ? 0.3
      : style.opacity;
}

function LabRingPath({
  identity,
  frame,
  frameIndex,
  style,
}: {
  identity: string;
  frame: SharedValue<AnimatedFrame>;
  frameIndex: SharedValue<FrameIndex>;
  style: OrreryRingStyle;
}) {
  const alpha = legacyAlpha(style);
  const path = useDerivedValue(() => {
    const result = Skia.Path.Make();
    const points =
      bodyAt(frame.value, frameIndex.value, identity)?.ringPath ?? [];
    if (points.length) {
      result.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++)
        result.lineTo(points[i].x, points[i].y);
      result.close();
    }
    return result;
  });
  const opacity = useDerivedValue(
    () =>
      (bodyAt(frame.value, frameIndex.value, identity)?.opacity ?? 0) * alpha,
  );
  return (
    <Path
      path={path}
      style="stroke"
      strokeWidth={style.width}
      color={style.color}
      opacity={opacity}
    >
      {style.strokeStyle === "dashed" || style.strokeStyle === "faintTrace" ? (
        <DashPathEffect intervals={[6, 6]} phase={0} />
      ) : null}
    </Path>
  );
}

export function LabRingsPathRebuild({
  resources,
  frame,
  frameIndex,
  colors,
}: {
  resources: readonly OrreryBodyResource[];
  frame: SharedValue<AnimatedFrame>;
  frameIndex: SharedValue<FrameIndex>;
  colors: ThemePalette;
}) {
  return (
    <Group>
      {resources
        .filter((r) => r.body.kind === "contact")
        .map((resource) => (
          <LabRingPath
            key={resource.key}
            identity={resource.key}
            frame={frame}
            frameIndex={frameIndex}
            style={orreryRingStyle(
              resource.scene.contacts.find((c) => c.id === resource.body.id)
                ?.status ?? null,
              colors,
            )}
          />
        ))}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// WP-1.3 instrument orbits.

export interface LabRingEntry {
  key: string;
  status: ProfileStatus | null;
  cls: RingInstrumentClass;
  x: number;
  y: number;
  radius: number;
  ringRadius: number;
  focused: boolean;
}

/** Group the contact resources into instrument classes (React side, memo). */
export function labRingEntries(
  resources: readonly OrreryBodyResource[],
  colors: ThemePalette,
  focusedIds: readonly number[],
): LabRingEntry[] {
  return resources
    .filter((r) => r.body.kind === "contact" && r.body.ringRadius > 0)
    .map((r) => {
      const status =
        r.scene.contacts.find((c) => c.id === r.body.id)?.status ?? null;
      return {
        key: r.key,
        status,
        cls: ringInstrumentClass(status, orreryRingStyle(status, colors)),
        x: r.body.x,
        y: r.body.y,
        radius: r.body.radius,
        ringRadius: r.body.ringRadius,
        focused: focusedIds.includes(r.body.id),
      };
    });
}

function segmentsPath(segments: readonly (Segment | null)[]): SkPath {
  const path = Skia.Path.Make();
  for (const s of segments) {
    if (!s) continue;
    path.moveTo(s.x0, s.y0);
    path.lineTo(s.x1, s.y1);
  }
  return path;
}

type Uniforms = RingUniforms;

/** One ring: a static world circle; radius/opacity follow the frame. */
function RingCircle({
  identity,
  frame,
  frameIndex,
  dim,
  strokeWidth,
  trimmed = false,
}: {
  identity: string;
  frame: SharedValue<AnimatedFrame>;
  frameIndex: SharedValue<FrameIndex>;
  dim: number;
  strokeWidth?: SharedValue<number>;
  /** WP-2.1: a trim ring owns this key during a switch (unwind / draw-on). */
  trimmed?: boolean;
}) {
  const ctx = useLabStillContext();
  const r = useDerivedValue(() => {
    const b = bodyAt(frame.value, frameIndex.value, identity);
    return b ? b.ringRadius / frame.value.pose.zoom : 0;
  });
  const opacity = useDerivedValue(() => {
    const base =
      (bodyAt(frame.value, frameIndex.value, identity)?.opacity ?? 0) * dim;
    if (!trimmed || !ctx?.sw) return base;
    const fx = ctx.fxFlags.value;
    const signal = ctx.sw.signal.value;
    const live =
      fx.flags.fx &&
      fx.flags.fxRingTrim &&
      switchFxLive(signal, ctx.reducedMotion.value);
    return (
      base * classRingSwitchFade(ctx.sw.roles.value, identity, signal, live)
    );
  });
  return (
    <Circle cx={0} cy={0} r={r} opacity={opacity} strokeWidth={strokeWidth} />
  );
}

interface ClassCommon {
  cls: RingInstrumentClass;
  frame: SharedValue<AnimatedFrame>;
  cam: SharedValue<number[]>;
  flow: SharedValue<number[]>;
  profile: LabRingProfile;
  highlight: number[];
  shader: boolean;
  /** Typical world gap between rings (density fade). */
  ringGap: number;
}

/** Per-class uniforms for one shader mode. */
function useClassUniforms(
  { cls, cam, flow, profile, highlight, ringGap }: ClassCommon,
  mode: number,
  alpha: number,
  dashPeriod: number,
  dashDuty: number,
  flowOn: boolean,
  densityFade = false,
): SharedValue<Uniforms> {
  const color = tokenToVec4(cls.color);
  return useDerivedValue<Uniforms>(() => {
    // Crowded rings (far zoom, dense System) fade — base AND flow comets.
    const fade = densityFade ? ringDensityFade(ringGap, cam.value[3]) : 1;
    return ringUniforms(color, highlight, cam.value, flow.value, {
      mode,
      alpha: alpha * fade,
      dashPeriod,
      dashDuty,
      farAlpha: profile.farAlpha,
      flowStrength: profile.flow * fade * fade,
      flowOn,
    });
  });
}

function RingClassGroup({
  common,
  entries,
  frameIndex,
  dims,
  trimKeys,
}: {
  common: ClassCommon;
  entries: readonly LabRingEntry[];
  frameIndex: SharedValue<FrameIndex>;
  dims: readonly number[];
  trimKeys: ReadonlySet<string>;
}) {
  const { cls, frame, profile, shader } = common;
  const effect = shader ? getLabEffect("ringInstrument") : null;
  const strokeWidth = useDerivedValue(
    () => cls.widthDp / frame.value.pose.zoom,
  );
  const uniforms = useClassUniforms(
    common,
    MODE_RING,
    profile.alpha * cls.alpha,
    cls.dashPeriod,
    cls.dashDuty,
    true,
    true,
  );
  return (
    <Group
      style="stroke"
      strokeWidth={strokeWidth}
      color={cls.color}
      opacity={effect ? 1 : profile.alpha * cls.alpha}
    >
      {effect ? (
        <Shader source={effect} uniforms={uniforms} />
      ) : cls.dashPeriod > 0 ? (
        <DashPathEffect intervals={FALLBACK_DASH} />
      ) : null}
      {entries.map((e, i) => (
        <RingCircle
          key={e.key}
          identity={e.key}
          frame={frame}
          frameIndex={frameIndex}
          dim={dims[i]}
          trimmed={trimKeys.has(e.key)}
        />
      ))}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// WP-2.1 switch: ring UNWIND (leaving) / DRAW-ON (entering).

const RAD_TO_DEG = 180 / Math.PI;
/** Trim rings are slightly heavier than the class hairline (they carry motion). */
const TRIM_WIDTH_SCALE = 1.35;
/** Tail alpha of a trim ring relative to its head (at the body). */
const TRIM_TAIL = 0.3;
/** Picture bounds (world units) — larger than any ring. */
const TRIM_BOUNDS = 1e5;
const PAINT_STROKE = 1;
const TILE_CLAMP = 0;

/**
 * Every leaving / entering ring of a switch, recorded into ONE picture per
 * frame on the UI thread (under the plane homography, world coordinates):
 * per ring, a stroked circle whose shader is a SWEEP GRADIENT mask — the
 * visible arc trails the body (clear → tail → head at the body), its length
 * from `trimRingState`; the body's WORLD angle and ring radius come from the
 * choreography (`sampleSwitchEntry`), so the trim stays exact through pause /
 * remount / retarget. Analytic circles + native gradients: no path
 * tessellation (WP-1.3 PERF finding).
 *
 * First cut was one React component per ring (7 derived values + a
 * SweepGradient element each): mounting ~130 of them at a switch start froze
 * the debug UI thread for seconds (DEAD-ENDS WP-2.1). The picture costs
 * nothing to mount and nothing at rest (an empty recording).
 */
function TrimRingPicture({
  entries,
  frame,
  profile,
}: {
  entries: readonly LabRingEntry[];
  frame: SharedValue<AnimatedFrame>;
  profile: LabRingProfile;
}) {
  const ctx = useLabStillContext();
  // key → [r, g, b, alpha, width dp] (React side, per publish).
  const spec = useMemo(() => {
    const out: Record<string, number[]> = {};
    for (const e of entries) {
      const c = tokenToVec4(e.cls.color);
      out[e.key] = [
        c[0],
        c[1],
        c[2],
        Math.min(1, profile.alpha * e.cls.alpha * 1.6),
        e.cls.widthDp * TRIM_WIDTH_SCALE,
      ];
    }
    return out;
  }, [entries, profile.alpha]);
  const picture = useDerivedValue(() => {
    const probe = probeStart();
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(
      Skia.XYWHRect(
        -TRIM_BOUNDS,
        -TRIM_BOUNDS,
        TRIM_BOUNDS * 2,
        TRIM_BOUNDS * 2,
      ),
    );
    const zoom = Math.max(frame.value.pose.zoom, 1e-4);
    const sw = ctx?.sw;
    const draw = (
      c: number[],
      alpha: number,
      len: number,
      angle: number,
      r: number,
    ) => {
      "worklet";
      const deg = angle * RAD_TO_DEG - 90;
      const start = ((deg % 360) + 360) % 360;
      const cut = Math.max(0, Math.min(0.998, 1 - len));
      const paint = Skia.Paint();
      paint.setStyle(PAINT_STROKE);
      paint.setStrokeWidth(c[4] / zoom);
      paint.setAntiAlias(true);
      paint.setShader(
        Skia.Shader.MakeSweepGradient(
          0,
          0,
          [
            Float32Array.of(c[0], c[1], c[2], 0),
            Float32Array.of(c[0], c[1], c[2], 0),
            Float32Array.of(c[0], c[1], c[2], TRIM_TAIL),
            Float32Array.of(c[0], c[1], c[2], 1),
          ],
          [0, cut, cut + 0.002, 1],
          TILE_CLAMP,
          undefined,
          0,
          start,
          start + 360,
        ),
      );
      paint.setAlphaf(Math.min(1, alpha));
      canvas.drawCircle(0, 0, r, paint);
    };
    if (ctx?.warm.value) {
      draw([1, 1, 1, 1, 1], 0.01, 0.5, 0, 40);
    } else if (ctx && sw) {
      const fx = ctx.fxFlags.value;
      const signal = sw.signal.value;
      const live =
        fx.flags.fx &&
        fx.flags.fxRingTrim &&
        switchFxLive(signal, ctx.reducedMotion.value);
      const roles = sw.roles.value;
      if (live && roles.generation === signal.generation) {
        const transition = sw.transition.value;
        const lists = [roles.leaving, roles.entering];
        for (let l = 0; l < 2; l++) {
          const list = lists[l];
          for (let n = 0; n < list.length; n++) {
            const e = transition.entries[list[n]];
            if (!e) continue;
            const c = spec[e.key];
            if (!c) continue;
            const [len, a] = trimRingState(roles, e.key, signal, true);
            if (len <= 0.001 || a <= 0) continue;
            const world = sampleSwitchEntry(transition, e, signal.progress);
            draw(
              c,
              c[3] * a * (0.55 + 0.45 * len),
              len,
              Math.atan2(world.x, -world.y),
              world.ringRadius,
            );
          }
        }
      }
    }
    const trimPicture = recorder.finishRecordingAsPicture();
    probeEnd("trim", probe);
    return trimPicture;
  });
  return <Picture picture={picture} />;
}

/** One ring's progress wake: a stroked world circle + the wake shader. */
function WakeRing({
  entry,
  effect,
  common,
  strokeWidth,
}: {
  entry: LabRingEntry;
  effect: SkRuntimeEffect;
  common: ClassCommon;
  strokeWidth: SharedValue<number>;
}) {
  const { cls, cam, profile } = common;
  const color = tokenToVec4(cls.color);
  const angle = wakeAngle(entry.x, entry.y);
  const uniforms = useDerivedValue<WakeUniforms>(() =>
    wakeUniforms(
      color,
      profile.wakeAlpha * cls.alpha,
      angle,
      entry.ringRadius,
      profile.wakeWidthDp,
      profile.farAlpha,
      cam.value,
    ),
  );
  return (
    <Circle cx={0} cy={0} r={entry.ringRadius} strokeWidth={strokeWidth}>
      <Shader source={effect} uniforms={uniforms} />
    </Circle>
  );
}

/**
 * Progress wakes of one class. Static world geometry (settled bodies), hidden
 * while a switch or reorder moves the bodies. Each wake is a CIRCLE (cheap
 * analytic op) shaded per ring — stroked static paths re-tessellated on the
 * CPU every replay and cost ~56 ms p50 on the emulator (PERF-LOG WP-1.3 G).
 * No shader → no wake (it is decoration over data the angle already shows).
 */
function WakeClassGroup({
  common,
  entries,
  settled,
}: {
  common: ClassCommon;
  entries: readonly LabRingEntry[];
  settled: SharedValue<number>;
}) {
  const { frame, profile, shader } = common;
  const effect = shader ? getLabEffect("ringWake") : null;
  const strokeWidth = useDerivedValue(
    () => (profile.wakeWidthDp * WAKE_STROKE_SCALE) / frame.value.pose.zoom,
  );
  if (!effect) return null;
  return (
    <Group style="stroke" opacity={settled}>
      {entries
        .filter((e) => wakeAngle(e.x, e.y) > 1e-3)
        .map((e) => (
          <WakeRing
            key={e.key}
            entry={e}
            effect={effect}
            common={common}
            strokeWidth={strokeWidth}
          />
        ))}
    </Group>
  );
}

/**
 * Drift tethers of one class (decay / rogue): each is a RECT in a north-
 * pointing local frame rotated onto the body (fast rect op; a stroked path
 * cost ~12 ms p50, PERF-LOG WP-1.3 H), radially dashed by the class shader.
 */
function TetherClassGroup({
  common,
  entries,
  settled,
}: {
  common: ClassCommon;
  entries: readonly LabRingEntry[];
  settled: SharedValue<number>;
}) {
  const { cls, frame, profile, shader } = common;
  const effect = shader ? getLabEffect("ringInstrument") : null;
  const rects = useMemo(
    () =>
      entries.flatMap((e) => {
        const t = tetherRect(e.ringRadius, e.x, e.y, e.radius);
        return t ? [{ key: e.key, ...t }] : [];
      }),
    [entries],
  );
  const width = useDerivedValue(
    () => profile.tetherWidthDp / frame.value.pose.zoom,
  );
  const left = useDerivedValue(() => -width.value / 2);
  const uniforms = useClassUniforms(
    common,
    MODE_RADIAL,
    profile.tetherAlpha,
    profile.tetherDash,
    0.55,
    false,
  );
  return (
    <Group color={cls.color} opacity={settled}>
      {effect ? <Shader source={effect} uniforms={uniforms} /> : null}
      {rects.map((t) => (
        <Group key={t.key} transform={[{ rotate: t.angle }]}>
          <Rect
            x={left}
            y={-t.outer}
            width={width}
            height={t.outer - t.inner}
            opacity={effect ? 1 : profile.tetherAlpha}
          />
        </Group>
      ))}
    </Group>
  );
}

/**
 * The focused ring's lock line: full alpha, slightly heavier, but through the
 * class shader so it KEEPS its status stroke style (a focused rogue ring is
 * still a faint dotted trace, a wobble ring still dashed).
 */
function FocusLock({
  common,
  entry,
  frameIndex,
  strokeWidth,
}: {
  common: ClassCommon;
  entry: LabRingEntry;
  frameIndex: SharedValue<FrameIndex>;
  strokeWidth: SharedValue<number>;
}) {
  const { cls, frame, shader } = common;
  const effect = shader ? getLabEffect("ringInstrument") : null;
  const uniforms = useClassUniforms(
    common,
    MODE_RING,
    1,
    cls.dashPeriod,
    cls.dashDuty,
    true,
  );
  return (
    <Group style="stroke" color={cls.color}>
      {effect ? <Shader source={effect} uniforms={uniforms} /> : null}
      <RingCircle
        identity={entry.key}
        frame={frame}
        frameIndex={frameIndex}
        dim={1}
        strokeWidth={strokeWidth}
      />
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Switch-stall fix (flag `layerPictures`): the class rings and the progress
// wakes as ONE UI-thread picture each (one derived value) instead of one
// component + 1–2 derived values per ring. Same uniforms, same per-ring
// radius / opacity rule as `RingCircle` / `WakeRing`, same class order.

interface RingClassSpec {
  color: number[];
  widthDp: number;
  dashPeriod: number;
  dashDuty: number;
  /** profile.alpha × class alpha (the uniform alpha, or the flat alpha). */
  alpha: number;
  keys: string[];
  dims: number[];
  trimmed: boolean[];
}

function RingClassesPicture({
  classes,
  frame,
  frameIndex,
  cam,
  flow,
  profile,
  highlight,
  shader,
  ringGap,
  anyFocus,
  trimKeys,
}: {
  classes: readonly (readonly LabRingEntry[])[];
  frame: SharedValue<AnimatedFrame>;
  frameIndex: SharedValue<FrameIndex>;
  cam: SharedValue<number[]>;
  flow: SharedValue<number[]>;
  profile: LabRingProfile;
  highlight: number[];
  shader: boolean;
  ringGap: number;
  anyFocus: boolean;
  trimKeys: ReadonlySet<string>;
}) {
  const ctx = useLabStillContext();
  const fxFlags = ctx?.fxFlags;
  const reducedMotion = ctx?.reducedMotion;
  const signal = ctx?.sw?.signal;
  const roles = ctx?.sw?.roles;
  const focus = ctx?.focus ?? null;
  const focusDim = profile.focusDim;
  const effect = shader ? getLabEffect("ringInstrument") : null;
  const specs = useMemo<RingClassSpec[]>(
    () =>
      classes.map((group) => {
        const cls = group[0].cls;
        return {
          color: tokenToVec4(cls.color),
          widthDp: cls.widthDp,
          dashPeriod: cls.dashPeriod,
          dashDuty: cls.dashDuty,
          alpha: profile.alpha * cls.alpha,
          keys: group.map((e) => e.key),
          dims: group.map((e) =>
            anyFocus && !e.focused ? profile.focusDim : 1,
          ),
          trimmed: group.map((e) => trimKeys.has(e.key)),
        };
      }),
    [classes, profile, anyFocus, trimKeys],
  );
  const farAlpha = profile.farAlpha;
  const flowK = profile.flow;
  const picture = useDerivedValue(() => {
    const probe = probeStart();
    const f = frame.value;
    const index = frameIndex.value;
    const zoom = f.pose.zoom;
    const c = cam.value;
    const fl = flow.value;
    const fx = fxFlags ? fxFlags.value : null;
    const sig = signal ? signal.value : null;
    const live =
      !!fx &&
      fx.flags.fx &&
      fx.flags.fxRingTrim &&
      switchFxLive(sig, reducedMotion ? reducedMotion.value : false);
    const roleMap = roles ? roles.value : null;
    // WP-2.2: with the world response on, focus dimming follows the animated
    // `mix` and the retained focus keys (fades out on release) instead of the
    // static React dims.
    const fon = !!focus && !!fx && fx.flags.fx && fx.flags.fxFocusDim;
    const fmix = fon && focus ? focus.mix.value : 0;
    const fkeys = fon && focus ? focus.keys.value : NO_FOCUS_KEYS;
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(
      Skia.XYWHRect(
        -RING_PICTURE_BOUNDS,
        -RING_PICTURE_BOUNDS,
        RING_PICTURE_BOUNDS * 2,
        RING_PICTURE_BOUNDS * 2,
      ),
    );
    for (let k = 0; k < specs.length; k++) {
      const spec = specs[k];
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      paint.setStyle(1);
      paint.setStrokeWidth(spec.widthDp / zoom);
      paint.setColor(
        Float32Array.of(spec.color[0], spec.color[1], spec.color[2], 1),
      );
      let base = spec.color[3];
      if (effect) {
        const fade = ringDensityFade(ringGap, c[3]);
        const u = ringUniforms(spec.color, highlight, c, fl, {
          mode: MODE_RING,
          alpha: spec.alpha * fade,
          dashPeriod: spec.dashPeriod,
          dashDuty: spec.dashDuty,
          farAlpha,
          flowStrength: flowK * fade * fade,
          flowOn: true,
        });
        paint.setShader(effect.makeShader(flattenUniforms(u, RING_ORDER)));
      } else {
        base *= spec.alpha;
        if (spec.dashPeriod > 0)
          paint.setPathEffect(Skia.PathEffect.MakeDash(FALLBACK_DASH, 0));
      }
      for (let i = 0; i < spec.keys.length; i++) {
        const b = bodyAt(f, index, spec.keys[i]);
        if (!b) continue;
        const r = b.ringRadius / zoom;
        let op =
          b.opacity *
          (fon
            ? focusDimFactor(fkeys, spec.keys[i], fmix, focusDim)
            : spec.dims[i]);
        if (spec.trimmed[i] && signal)
          op *= classRingSwitchFade(roleMap, spec.keys[i], sig, live);
        if (!(r > 0) || !(op > 0)) continue;
        paint.setAlphaf(Math.min(1, base * op));
        canvas.drawCircle(0, 0, r, paint);
      }
    }
    const ringsPicture = recorder.finishRecordingAsPicture();
    probeEnd("rings", probe);
    return ringsPicture;
  });
  return <Picture picture={picture} />;
}

/** One empty picture per UI runtime: returning the SAME object from a picture
 * derived value is a no-op write (Reanimated skips identical values), so an
 * idle layer does not notify the canvas (R1). */
function emptyPicture(): SkPicture {
  "worklet";
  const g = globalThis as unknown as { __labbEmptyPicture?: SkPicture };
  if (!g.__labbEmptyPicture) {
    const recorder = Skia.PictureRecorder();
    recorder.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
    g.__labbEmptyPicture = recorder.finishRecordingAsPicture();
  }
  return g.__labbEmptyPicture;
}

/** Floats per wake in the flat uniform block (uColor, uWake, uCam). */
const WAKE_FLOATS = 12;

/**
 * Progress wakes: ONE picture, one `ringWake` shader per ring. R1 cost work
 * (the wake picture was the top per-frame recorder at 400 rings: ~34 ms per
 * pan frame, ~40 ms per fly-in frame on the emulator):
 * - `cam` no longer changes on a pure pan (primitive derived values), so a pan
 *   does not re-record;
 * - while the camera RECOVERS (focus fly-in, recentre, north) the wakes are
 *   hidden and the layer returns one shared empty picture; they fade back in
 *   (Group opacity, no re-record) once it settles (C-60);
 * - density LOD: no wakes above `WAKE_LOD_MAX_RINGS` (C-60);
 * - static uniforms are pre-flattened per wake (React side); the worklet patches
 *   the 4 camera floats into one scratch array instead of building an object
 *   + 4 arrays per ring per frame.
 */
function WakesPicture({
  classes,
  frame,
  cam,
  profile,
  settled,
  moving,
}: {
  classes: readonly (readonly LabRingEntry[])[];
  frame: SharedValue<AnimatedFrame>;
  cam: SharedValue<number[]>;
  profile: LabRingProfile;
  settled: SharedValue<number>;
  /** 1 while the camera recovers (wakes hidden), else 0. */
  moving: SharedValue<number>;
}) {
  const effect = getLabEffect("ringWake");
  const block = useMemo(() => {
    const out: number[] = [];
    let n = 0;
    for (const group of classes) {
      if (!group[0].cls.wake) continue;
      for (const e of group) {
        const angle = wakeAngle(e.x, e.y);
        if (!(angle > 1e-3)) continue;
        // Same layout as flattenUniforms(wakeUniforms(…), WAKE_ORDER).
        const c = tokenToVec4(e.cls.color);
        out.push(
          c[0],
          c[1],
          c[2],
          profile.wakeAlpha * e.cls.alpha,
          angle,
          e.ringRadius,
          0, // half width (world) — per frame
          profile.farAlpha,
          0, // cam cos yaw — per frame
          0, // cam sin yaw
          0, // cam tilt depth
          0,
        );
        n += 1;
      }
    }
    return { floats: out, count: n };
  }, [classes, profile.wakeAlpha, profile.farAlpha]);
  const floats = block.floats;
  const count = block.count;
  const widthDp = profile.wakeWidthDp;
  const picture = useDerivedValue(() => {
    const probe = probeStart();
    const op = settled.value;
    if (!effect || count === 0 || !(op > 0) || moving.value > 0) {
      probeEnd("wakes", probe);
      return emptyPicture();
    }
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(
      Skia.XYWHRect(
        -RING_PICTURE_BOUNDS,
        -RING_PICTURE_BOUNDS,
        RING_PICTURE_BOUNDS * 2,
        RING_PICTURE_BOUNDS * 2,
      ),
    );
    const c = cam.value;
    const zoom = Math.max(c[3], 1e-4);
    const half = widthDp / 2 / zoom;
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(1);
    paint.setStrokeWidth((widthDp * WAKE_STROKE_SCALE) / frame.value.pose.zoom);
    paint.setAlphaf(Math.min(1, op));
    const u: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < count; i++) {
      const o = i * WAKE_FLOATS;
      for (let k = 0; k < WAKE_FLOATS; k++) u[k] = floats[o + k];
      u[6] = half;
      u[8] = c[0];
      u[9] = c[1];
      u[10] = c[2];
      paint.setShader(effect.makeShader(u));
      canvas.drawCircle(0, 0, floats[o + 5], paint);
    }
    const wakesPicture = recorder.finishRecordingAsPicture();
    probeEnd("wakes", probe);
    return wakesPicture;
  });
  if (!effect) return null;
  return <Picture picture={picture} />;
}

const CLASS_ORDER: RingInstrumentClass["id"][] = [
  "neutral",
  "stable",
  "wobble",
  "decay",
  "rogue",
];

export function LabRings({
  resources,
  frame,
  frameIndex,
  colors,
  profile,
  flags,
  focusedIds,
  level,
  progress,
  reorder,
  trimKeys = EMPTY_KEYS,
  picture = false,
  cameraActive,
}: {
  resources: readonly OrreryBodyResource[];
  frame: SharedValue<AnimatedFrame>;
  frameIndex: SharedValue<FrameIndex>;
  colors: ThemePalette;
  profile: LabRingProfile;
  flags: LabFlags;
  focusedIds: readonly number[];
  level: SharedValue<SemanticLevel>;
  /** Switch progress (1 = settled). */
  progress: SharedValue<number>;
  reorder: SharedValue<ReorderDrag | null>;
  /** WP-2.1: keys that may leave / enter in the running switch (React-side
   * candidates; the UI-thread role map decides what actually draws). */
  trimKeys?: ReadonlySet<string>;
  /** Switch-stall fix: class rings + wakes as one picture each. */
  picture?: boolean;
  /** R1: the camera's running recovery (wakes hide while it flies). */
  cameraActive?: SharedValue<MotionRequest | null>;
}) {
  const ctx = useLabStillContext();
  const entries = useMemo(
    () => labRingEntries(resources, colors, focusedIds),
    [resources, colors, focusedIds],
  );
  const classes = useMemo(
    () =>
      CLASS_ORDER.map((id) => entries.filter((e) => e.cls.id === id)).filter(
        (group) => group.length > 0,
      ),
    [entries],
  );
  const anyFocus = entries.some((e) => e.focused);
  const ringGap = useMemo(
    () => typicalRingGap(entries.map((e) => e.ringRadius)),
    [entries],
  );
  const matrix = useDerivedValue(
    () =>
      planeHomography(frame.value.pose, frame.value.viewport) ?? IDENTITY_3X3,
  );
  // R1: `cam` only changes when yaw / tilt / zoom do. Primitive derived values
  // stop the chain on a pure pan (Reanimated skips a write of an identical
  // primitive), so the wake picture (one shader per ring) is not re-recorded
  // on every pan frame.
  const camYaw = useDerivedValue(() => frame.value.pose.yaw ?? 0);
  const camTilt = useDerivedValue(() => tiltDepth(frame.value.pose));
  const camZoom = useDerivedValue(() => frame.value.pose.zoom);
  const cam = useDerivedValue(() => [
    Math.cos(camYaw.value),
    Math.sin(camYaw.value),
    camTilt.value,
    camZoom.value,
  ]);
  // The ONLY ambient-clock reader of this layer (R1: the other worklets
  // capture the clock-free context so they do not re-run per tick).
  const ambient = useLabRenderContext()?.ambient;
  // R1 LOD: no energy flow on dense Systems (C-59) — the comets are clutter
  // there and the flow alone forced a full ring-picture re-record per tick.
  // Off, the derived value returns ONE stable array, so nothing downstream
  // re-runs on the clock.
  const flowLod = entries.length <= FLOW_LOD_MAX_RINGS;
  const flowOff = useMemo(
    () => [0, 0, profile.cometLength, profile.cometSpeed, 1, 0, 0],
    [profile.cometLength, profile.cometSpeed],
  );
  // [time s, flow on, comet length, comet speed, intensity]
  const flow = useDerivedValue(() => {
    const fx = ctx?.fxFlags.value;
    const on =
      flowLod && ctx && !ctx.reducedMotion.value && fx?.flags.ringFlow ? 1 : 0;
    if (!on) return flowOff;
    const t = on && ambient ? (ambient.value / 1000) % 1000 : 0;
    // WP-2.1 spool-up: comets ride the system spin during a switch (stateless:
    // a phase offset from the choreography's accumulated rotation).
    const signal = ctx?.sw ? ctx.sw.signal.value : null;
    const spool =
      on && fx?.flags.fx && fx.flags.fxSpool && signal?.running
        ? signal.accumulatedRotation * FLOW_SPOOL
        : 0;
    const boost =
      on && fx?.flags.fx && fx.flags.fxSpool ? warpAmount(signal) * 1.4 : 0;
    return [
      t,
      on,
      profile.cometLength,
      profile.cometSpeed,
      fx ? fx.intensity : 1,
      spool,
      boost,
    ];
  });
  // Wakes / tethers are built from the settled world; while a switch runs they
  // fade back in over its last moments instead of popping at progress 1.
  const settled = useDerivedValue<number>(() => {
    if (reorder.value?.active) return 0;
    const p = progress.value;
    if (p >= 1) return 1;
    const reduced = ctx ? ctx.reducedMotion.value : false;
    if (reduced) return 0;
    const t = Math.max(0, Math.min(1, (p - 0.86) / 0.14));
    return t * t * (3 - 2 * t);
  });
  // R1: wakes hide while the camera recovers (fly-in / recentre / north) and
  // fade back in after (Group opacity: no re-record during the fade).
  const moving = useDerivedValue<number>(() =>
    cameraActive && cameraActive.value ? 1 : 0,
  );
  const wakeGate = useSharedValue(1);
  useAnimatedReaction(
    () => moving.value,
    (now, before) => {
      if (now === before) return;
      wakeGate.value =
        now > 0 ? 0 : withTiming(1, { duration: WAKE_RETURN_MS });
    },
  );
  const wakeLod = entries.length <= WAKE_LOD_MAX_RINGS;
  const trimEntries = useMemo(
    () => entries.filter((e) => trimKeys.has(e.key)),
    [entries, trimKeys],
  );
  const highlight = tokenToVec4(labColor(colors, profile.flowHighlight));
  const shader = flags.ringShader;
  const tickPath = useMemo(
    () => segmentsPath(entries.map((e) => northTick(e.ringRadius))),
    [entries],
  );
  const focusTickPath = useMemo(
    () =>
      segmentsPath(
        entries
          .filter((e) => e.focused)
          .flatMap((e) => scaleTicks(e.ringRadius)),
      ),
    [entries],
  );
  const compassPath = useMemo(
    () =>
      segmentsPath(
        compassChevron(entries.reduce((m, e) => Math.max(m, e.ringRadius), 0)),
      ),
    [entries],
  );
  const detailOpacity = useDerivedValue(() =>
    level.value === "detail" ? profile.tickAlpha : 0,
  );
  const hairline = useDerivedValue(() => 1 / frame.value.pose.zoom);
  const glowWide = useDerivedValue(
    () => profile.glowWideDp / frame.value.pose.zoom,
  );
  const glowNarrow = useDerivedValue(
    () => profile.glowNarrowDp / frame.value.pose.zoom,
  );
  const focused = entries.filter((e) => e.focused);
  const focusWidth = focused[0]?.cls.widthDp ?? 1;
  const focusLine = useDerivedValue(
    () => (focusWidth * 1.2) / frame.value.pose.zoom,
  );
  // WP-2.2: the focused ring's glow + lock line fade in with the world
  // response (`mix`); 1 when the response flag is off.
  const focusOpacity = useDerivedValue(() => {
    const fx = ctx?.fxFlags.value;
    const focus = ctx?.focus;
    return focus && fx?.flags.fx && fx.flags.fxFocusDim ? focus.mix.value : 1;
  });
  const commonFor = (cls: RingInstrumentClass): ClassCommon => ({
    cls,
    frame,
    cam,
    flow,
    profile,
    highlight,
    shader,
    ringGap,
  });
  return (
    <Group matrix={matrix}>
      {flags.ringWake && picture && wakeLod ? (
        <Group opacity={wakeGate}>
          <WakesPicture
            classes={classes}
            frame={frame}
            cam={cam}
            profile={profile}
            settled={settled}
            moving={moving}
          />
        </Group>
      ) : null}
      {flags.ringWake && !picture
        ? classes
            .filter((group) => group[0].cls.wake)
            .map((group) => (
              <WakeClassGroup
                key={`wake-${group[0].cls.id}`}
                common={commonFor(group[0].cls)}
                entries={group}
                settled={settled}
              />
            ))
        : null}
      {/* Focused ring: soft glow strokes beneath its hairline (WP-2.2: they
          fade in with the world response). */}
      {focused.map((e) => (
        <Group
          key={`glow-${e.key}`}
          style="stroke"
          color={e.cls.color}
          opacity={focusOpacity}
        >
          <Group opacity={profile.glowWide}>
            <RingCircle
              identity={e.key}
              frame={frame}
              frameIndex={frameIndex}
              dim={1}
              strokeWidth={glowWide}
            />
          </Group>
          <Group opacity={profile.glowNarrow}>
            <RingCircle
              identity={e.key}
              frame={frame}
              frameIndex={frameIndex}
              dim={1}
              strokeWidth={glowNarrow}
            />
          </Group>
        </Group>
      ))}
      {picture ? (
        <RingClassesPicture
          classes={classes}
          frame={frame}
          frameIndex={frameIndex}
          cam={cam}
          flow={flow}
          profile={profile}
          highlight={highlight}
          shader={shader}
          ringGap={ringGap}
          anyFocus={anyFocus}
          trimKeys={trimKeys}
        />
      ) : null}
      {(picture ? [] : classes).map((group) => (
        <RingClassGroup
          key={group[0].cls.id}
          common={commonFor(group[0].cls)}
          entries={group}
          frameIndex={frameIndex}
          dims={group.map((e) =>
            anyFocus && !e.focused ? profile.focusDim : 1,
          )}
          trimKeys={trimKeys}
        />
      ))}
      {flags.fx && flags.fxRingTrim ? (
        <TrimRingPicture
          entries={trimEntries}
          frame={frame}
          profile={profile}
        />
      ) : null}
      {/* Focused ring at full opacity (instrument lock), above its class. */}
      {focused.map((e) => (
        <Group key={`lock-${e.key}`} opacity={focusOpacity}>
          <FocusLock
            common={commonFor(e.cls)}
            entry={e}
            frameIndex={frameIndex}
            strokeWidth={focusLine}
          />
        </Group>
      ))}
      {flags.ringTethers
        ? classes
            .filter((group) => group[0].cls.tether)
            .map((group) => (
              <TetherClassGroup
                key={`tether-${group[0].cls.id}`}
                common={commonFor(group[0].cls)}
                entries={group}
                settled={settled}
              />
            ))
        : null}
      {flags.ringTicks ? (
        <Group style="stroke" strokeWidth={hairline}>
          <Path
            path={tickPath}
            color={labColor(colors, profile.tick)}
            opacity={detailOpacity}
          />
          {focused.length ? (
            <Path
              path={focusTickPath}
              color={labColor(colors, profile.tick)}
              opacity={profile.tickAlpha}
            />
          ) : null}
          <Path
            path={compassPath}
            color={labColor(colors, profile.compass)}
            opacity={profile.compassAlpha}
            strokeCap="round"
          />
        </Group>
      ) : null}
    </Group>
  );
}
