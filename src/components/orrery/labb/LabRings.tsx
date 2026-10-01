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
  Rect,
  Shader,
  Skia,
  type SkPath,
  type SkRuntimeEffect,
} from "@shopify/react-native-skia";
import { useMemo } from "react";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import type { ProfileStatus } from "@/db/contact-status-read";
import type { AnimatedFrame } from "@/logic/orrery-frame";
import type { SemanticLevel } from "@/logic/orrery-label-logic";
import type { ReorderDrag } from "@/logic/orrery-reorder-logic";
import {
  type OrreryRingStyle,
  orreryRingStyle,
} from "@/logic/orrery-ring-logic";
import type { LabFlags } from "@/stores/orrery-labb-fx-store";
import { type LabRingProfile, labColor } from "@/theme/orrery-lab-fx";
import type { ThemePalette } from "@/theme/theme-types";
import type { OrreryBodyResource } from "../use-orrery-switch-runtime";
import { useLabRenderContext } from "./labb-context";
import { getLabEffect } from "./labb-effects";
import { bodyAt, type FrameIndex } from "./labb-frame-index";
import {
  compassChevron,
  northTick,
  planeHomography,
  type RingInstrumentClass,
  type RingUniforms,
  ringInstrumentClass,
  ringUniforms,
  type Segment,
  scaleTicks,
  tetherRect,
  tiltDepth,
  type WakeUniforms,
  wakeAngle,
  wakeUniforms,
} from "./labb-rings-logic";
import { tokenToVec4 } from "./labb-uniforms";

const IDENTITY_3X3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
/** Shader modes (see `ringInstrument`). */
const MODE_RING = 0;
const MODE_RADIAL = 2;
/** Fallback dash intervals (world units) when the shader is unavailable. */
const FALLBACK_DASH = [5, 5];
/** Wake stroke = visible width × this (the shader fades the cross profile). */
const WAKE_STROKE_SCALE = 1.6;

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
}: {
  identity: string;
  frame: SharedValue<AnimatedFrame>;
  frameIndex: SharedValue<FrameIndex>;
  dim: number;
  strokeWidth?: SharedValue<number>;
}) {
  const r = useDerivedValue(() => {
    const b = bodyAt(frame.value, frameIndex.value, identity);
    return b ? b.ringRadius / frame.value.pose.zoom : 0;
  });
  const opacity = useDerivedValue(
    () => (bodyAt(frame.value, frameIndex.value, identity)?.opacity ?? 0) * dim,
  );
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
}

/** Per-class uniforms for one shader mode. */
function useClassUniforms(
  { cls, cam, flow, profile, highlight }: ClassCommon,
  mode: number,
  alpha: number,
  dashPeriod: number,
  dashDuty: number,
  flowOn: boolean,
): SharedValue<Uniforms> {
  const color = tokenToVec4(cls.color);
  return useDerivedValue<Uniforms>(() =>
    ringUniforms(color, highlight, cam.value, flow.value, {
      mode,
      alpha,
      dashPeriod,
      dashDuty,
      farAlpha: profile.farAlpha,
      flowStrength: profile.flow,
      flowOn,
    }),
  );
}

function RingClassGroup({
  common,
  entries,
  frameIndex,
  dims,
}: {
  common: ClassCommon;
  entries: readonly LabRingEntry[];
  frameIndex: SharedValue<FrameIndex>;
  dims: readonly number[];
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
        />
      ))}
    </Group>
  );
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
}) {
  const ctx = useLabRenderContext();
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
  const matrix = useDerivedValue(
    () =>
      planeHomography(frame.value.pose, frame.value.viewport) ?? IDENTITY_3X3,
  );
  const cam = useDerivedValue(() => {
    const pose = frame.value.pose;
    const yaw = pose.yaw ?? 0;
    return [Math.cos(yaw), Math.sin(yaw), tiltDepth(pose), pose.zoom];
  });
  // [time s, flow on, comet length, comet speed, intensity]
  const flow = useDerivedValue(() => {
    const fx = ctx?.fxFlags.value;
    const on = ctx && !ctx.reducedMotion.value && fx?.flags.ringFlow ? 1 : 0;
    const t = on && ctx ? (ctx.ambient.value / 1000) % 1000 : 0;
    return [
      t,
      on,
      profile.cometLength,
      profile.cometSpeed,
      fx ? fx.intensity : 1,
    ];
  });
  const settled = useDerivedValue<number>(() =>
    progress.value >= 1 && !reorder.value?.active ? 1 : 0,
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
  const commonFor = (cls: RingInstrumentClass): ClassCommon => ({
    cls,
    frame,
    cam,
    flow,
    profile,
    highlight,
    shader,
  });
  return (
    <Group matrix={matrix}>
      {flags.ringWake
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
      {/* Focused ring: soft glow strokes beneath its hairline. */}
      {focused.map((e) => (
        <Group key={`glow-${e.key}`} style="stroke" color={e.cls.color}>
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
      {classes.map((group) => (
        <RingClassGroup
          key={group[0].cls.id}
          common={commonFor(group[0].cls)}
          entries={group}
          frameIndex={frameIndex}
          dims={group.map((e) =>
            anyFocus && !e.focused ? profile.focusDim : 1,
          )}
        />
      ))}
      {/* Focused ring at full opacity (instrument lock), above its class. */}
      {focused.map((e) => (
        <Group key={`lock-${e.key}`} style="stroke" color={e.cls.color}>
          <RingCircle
            identity={e.key}
            frame={frame}
            frameIndex={frameIndex}
            dim={1}
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
