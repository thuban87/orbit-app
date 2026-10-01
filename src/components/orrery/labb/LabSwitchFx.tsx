/**
 * ORRERY LAB B — System-switch showcase layers (WP-2.1).
 *
 * Two slots, both pure functions of the switch signal + the animated frame
 * (see `labb-switch-logic.ts`), mounted per flag (heavy = unmounted when off):
 *
 *   UNDER the bodies (inside L1, on the world plane):
 *     - system-lock SHOCKWAVE: a world-space ring under the plane homography
 *       (so it is a projected ellipse in tilt), soft trailing glow + crisp
 *       instrument front, in the destination System's sky hue (`fxShockwave`);
 *     - TRAILS Atlas: arrival COMETS (entering bodies; tail = the body's own
 *       inbound spiral sampled earlier) and retained MOTION SMEARS (spin)
 *       (`fxComets`).
 *   OVER the bodies (L7):
 *     - departing PARTICLE bursts: stateless Atlas, fixed capacity, status hue
 *       (`fxParticles`);
 *     - CAPTURE FLARES: a glow + 4-point glint where an arriving world locks
 *       onto its rail (`fxFlares`).
 *
 * Per frame: ONE derived value computes every sprite of a layer into a flat
 * array (only while the switch runs or the mount warm-up probes); the RSXform /
 * rect / colour buffer mappers just copy it. Idle (no switch) the derived value
 * returns a shared empty array and every sprite collapses to scale 0.
 *
 * Reduced motion: none of this draws (the existing crossfade stays).
 * Warm-up: while the canvas's `warm` gate is on, each layer draws one
 * near-invisible probe so its Ganesh pipeline compiles at Orrery entry.
 * Colours: status hues / sky hue / highlight from tokens (uniforms or colour
 * buffers fed by `tokenToVec3`); the sprite atlases are LAB-ONLY alpha masks.
 */
import {
  Atlas,
  BlurMask,
  Circle,
  Group,
  LinearGradient,
  RadialGradient,
  Rect,
  RoundedRect,
  rect,
  Shader,
  type SkRSXform,
  useColorBuffer,
  useRectBuffer,
  useRSXformBuffer,
  useTexture,
  vec,
} from "@shopify/react-native-skia";
import { useMemo } from "react";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import type { AnimatedFrame } from "@/logic/orrery-frame";
import {
  CAPTURE_END,
  CAPTURE_START,
  sampleSwitchEntry,
} from "@/logic/orrery-switch-choreography";
import {
  LAB_SPRITE_MASK,
  LAB_SPRITE_MASK_CLEAR,
  LAB_SPRITE_MASK_HALO,
} from "@/theme/orrery-lab-fx";
import { useLabRenderContext } from "./labb-context";
import { getLabEffect } from "./labb-effects";
import { bodyAt, type FrameIndex } from "./labb-frame-index";
import { applyHomography, planeHomography } from "./labb-rings-logic";
import {
  COMET_LOOKBACK,
  FLARE_CAPACITY,
  flareEnvelope,
  PARTICLE_CAPACITY,
  particleAt,
  particlesPerBody,
  SMEAR_LOOKBACK,
  STREAK_BAND_H,
  STREAK_BANDS,
  STREAK_CORE,
  shockwaveState,
  streakBandLength,
  streakXform,
  switchFxLive,
  TRAIL_CAPACITY,
  warpAmount,
} from "./labb-switch-logic";

// --- Tunables -----------------------------------------------------------------
/** Sprite atlas cells (alpha masks): soft glow, 4-point glint. */
const FX_CELL = 32;
const FX_ATLAS = { width: FX_CELL * 2, height: FX_CELL };
/** Core diameter (texels) of the soft cell (sizes sprites to a dp diameter). */
const FX_SOFT_CORE = 11;
/** Streak atlas: STREAK_BANDS rows. */
const STREAK_TEX = {
  width: 256,
  height: STREAK_BANDS * STREAK_BAND_H,
};
/** Light themes draw the same sprites srcOver at this alpha. */
const LIGHT_FX_ALPHA = 0.7;
/** Shockwave: front travels from the sun to this × scene extent. */
const SHOCK_REACH = 1.3;
const SHOCK_BAND = 0.07;
const SHOCK_LINE_DP = 1.4;
/** Comet / smear look. */
const COMET_ALPHA = 0.8;
const COMET_STRETCH = 2.1;
const COMET_MAX_DP = 280;
const SMEAR_ALPHA = 0.34;
const SMEAR_STRETCH = 1.15;
/** Capture flare look: sprite SPAN in body radii (glow disc, glint cross). */
const FLARE_GLOW_SPAN = 4.2;
const FLARE_GLINT_SPAN = 4.5;
/** Many simultaneous arrivals share the flare budget (alpha ∝ 1/√(n/N)). */
const FLARE_CROWD = 8;

/** Floats per sprite in the flat per-frame state arrays. */
const TRAIL_STRIDE = 10; // scos, ssin, tx, ty, band, w, r, g, b, a
const PART_STRIDE = 8; // x, y, size, alpha, r, g, b, hot
const FLARE_STRIDE = 8; // scos, ssin, tx, ty, r, g, b, a
const EMPTY: number[] = [];

// --- Sprite textures (drawn once per mount; LAB-ONLY alpha masks) -------------

function FxSprites() {
  const h = FX_CELL / 2;
  return (
    <Group>
      <Circle cx={h} cy={h} r={h}>
        <RadialGradient
          c={vec(h, h)}
          r={h}
          colors={[
            LAB_SPRITE_MASK,
            LAB_SPRITE_MASK_HALO,
            LAB_SPRITE_MASK_CLEAR,
          ]}
          positions={[0, 0.35, 1]}
        />
      </Circle>
      <Rect x={FX_CELL} y={h - 0.9} width={FX_CELL} height={1.8}>
        <LinearGradient
          start={vec(FX_CELL, h)}
          end={vec(FX_CELL * 2, h)}
          colors={[
            LAB_SPRITE_MASK_CLEAR,
            LAB_SPRITE_MASK,
            LAB_SPRITE_MASK_CLEAR,
          ]}
        />
      </Rect>
      <Rect x={FX_CELL + h - 0.9} y={0} width={1.8} height={FX_CELL}>
        <LinearGradient
          start={vec(FX_CELL + h, 0)}
          end={vec(FX_CELL + h, FX_CELL)}
          colors={[
            LAB_SPRITE_MASK_CLEAR,
            LAB_SPRITE_MASK,
            LAB_SPRITE_MASK_CLEAR,
          ]}
        />
      </Rect>
      <Circle cx={FX_CELL + h} cy={h} r={6}>
        <RadialGradient
          c={vec(FX_CELL + h, h)}
          r={6}
          colors={[LAB_SPRITE_MASK, LAB_SPRITE_MASK_CLEAR]}
        />
      </Circle>
    </Group>
  );
}

/** Streak bands: tail (transparent) → bright head at the right end. */
function StreakSprites() {
  const bands = Array.from({ length: STREAK_BANDS }, (_, j) => j);
  const y0 = (STREAK_BAND_H - STREAK_CORE) / 2;
  return (
    <Group>
      {bands.map((j) => {
        const w = streakBandLength(j);
        const y = j * STREAK_BAND_H + y0;
        return (
          <RoundedRect
            key={`band-${j}`}
            x={0.5}
            y={y}
            width={Math.max(1, w - 1)}
            height={STREAK_CORE}
            r={STREAK_CORE / 2}
          >
            <LinearGradient
              start={vec(0, y)}
              end={vec(w, y)}
              colors={[
                LAB_SPRITE_MASK_CLEAR,
                LAB_SPRITE_MASK_HALO,
                LAB_SPRITE_MASK,
              ]}
              positions={[0, 0.72, 1]}
            />
            <BlurMask blur={0.7} style="normal" />
          </RoundedRect>
        );
      })}
    </Group>
  );
}

/** The streak texture (shared by the trails Atlas and the sky streaks). */
export function useStreakTexture() {
  return useTexture(<StreakSprites />, STREAK_TEX, []);
}

// --- Shared props -------------------------------------------------------------

export interface LabSwitchFxProps {
  frame: SharedValue<AnimatedFrame>;
  frameIndex: SharedValue<FrameIndex>;
  /** key → status rgb (token), React-built from the merged resources. */
  keyColors: Record<string, number[]>;
  /** Highlight token rgb (hot sparks, comet cores). */
  highlight: number[];
  /** Additive (dark) vs srcOver (light) sprite blending. */
  additive: boolean;
  /** Scene extent (world units): shockwave reach. */
  extent: number;
  flags: {
    particles: boolean;
    comets: boolean;
    flares: boolean;
    shockwave: boolean;
  };
}

// --- Worklet helpers (declared ABOVE their callers) ----------------------------

function hiddenXform(xf: SkRSXform) {
  "worklet";
  xf.set(0, 0, -64, -64);
}

/** Project a world point with the current homography (or null). */
function projectWorld(
  m: number[] | null,
  x: number,
  y: number,
): { x: number; y: number } | null {
  "worklet";
  return m ? applyHomography(m, x, y) : null;
}

// --- UNDER the bodies: shockwave + trails -----------------------------------------

function Shockwave({
  frame,
  extent,
  additive,
  highlight,
}: {
  frame: SharedValue<AnimatedFrame>;
  extent: number;
  additive: boolean;
  highlight: number[];
}) {
  const ctx = useLabRenderContext();
  const effect = getLabEffect("switchShock");
  const matrix = useDerivedValue(
    () =>
      planeHomography(frame.value.pose, frame.value.viewport) ?? [
        1, 0, 0, 0, 1, 0, 0, 0, 1,
      ],
  );
  const state = useDerivedValue(() => {
    const sw = ctx?.sw;
    const warm = ctx ? ctx.warm.value : false;
    const fx = ctx ? ctx.fxFlags.value : null;
    const signal = sw ? sw.signal.value : null;
    const live =
      !!fx &&
      fx.flags.fx &&
      fx.flags.fxShockwave &&
      switchFxLive(signal, ctx ? ctx.reducedMotion.value : false);
    const [u, s] = live ? shockwaveState(signal) : [0, 0];
    const strength = warm ? 0.01 : s * (fx ? fx.intensity : 1);
    const reach = extent > 0 ? extent : 200;
    const front = reach * (0.06 + SHOCK_REACH * (1 - (1 - u) ** 2.2));
    const band = reach * SHOCK_BAND * (0.6 + u);
    const zoom = frame.value.pose.zoom > 0 ? frame.value.pose.zoom : 1;
    const hue = sw ? sw.skyHue.value : highlight;
    return { front, band, strength, zoom, hue };
  });
  const r = useDerivedValue(() =>
    state.value.strength > 0 ? state.value.front + state.value.band * 0.2 : 0,
  );
  const uniforms = useDerivedValue(() => {
    const s = state.value;
    return {
      uShk: [s.front, s.band, s.strength, SHOCK_LINE_DP / s.zoom],
      uShkC: [s.hue[0], s.hue[1], s.hue[2], additive ? 1 : 0],
      uShkH: [highlight[0], highlight[1], highlight[2], 0],
    };
  });
  if (!effect) return null;
  return (
    <Group matrix={matrix}>
      <Circle cx={0} cy={0} r={r} blendMode={additive ? "plus" : "srcOver"}>
        <Shader source={effect} uniforms={uniforms} />
      </Circle>
    </Group>
  );
}

function Trails({
  frame,
  frameIndex,
  keyColors,
  highlight,
  additive,
}: Omit<LabSwitchFxProps, "extent" | "flags">) {
  const ctx = useLabRenderContext();
  const image = useStreakTexture();
  const state = useDerivedValue(() => {
    const sw = ctx?.sw;
    const warm = ctx ? ctx.warm.value : false;
    const fx = ctx ? ctx.fxFlags.value : null;
    const f = frame.value;
    if (warm) {
      const vx = f.viewport.width / 2;
      const vy = f.viewport.height / 2;
      const x = streakXform(vx, vy, 1, 0, 2, 40);
      return [...x, highlight[0], highlight[1], highlight[2], 0.01];
    }
    if (!sw || !fx?.flags.fx || !fx.flags.fxComets) return EMPTY;
    const signal = sw.signal.value;
    if (!switchFxLive(signal, ctx ? ctx.reducedMotion.value : false))
      return EMPTY;
    const roles = sw.roles.value;
    if (roles.generation !== signal.generation) return EMPTY;
    const transition = sw.transition.value;
    const m = planeHomography(f.pose, f.viewport);
    const index = frameIndex.value;
    const p = signal.progress;
    const warp = warpAmount(signal);
    const k = fx.intensity;
    const out: number[] = [];
    // Arrival comets: tail = the body's inbound spiral, sampled earlier.
    for (let n = 0; n < roles.entering.length; n++) {
      if (out.length >= TRAIL_CAPACITY * TRAIL_STRIDE) break;
      const entry = transition.entries[roles.entering[n]];
      if (!entry) continue;
      const u = Math.max(
        0,
        Math.min(
          1,
          (p - (CAPTURE_START + entry.stagger)) / (CAPTURE_END - CAPTURE_START),
        ),
      );
      if (u <= 0 || u >= 1) continue;
      const head = bodyAt(f, index, entry.key);
      if (!head?.visible) continue;
      const prev = sampleSwitchEntry(transition, entry, p - COMET_LOOKBACK);
      const tail = projectWorld(m, prev.x, prev.y);
      if (!tail) continue;
      let dx = head.x - tail.x;
      let dy = head.y - tail.y;
      const chord = Math.sqrt(dx * dx + dy * dy);
      if (chord < 0.5) continue;
      dx /= chord;
      dy /= chord;
      const len = Math.min(
        COMET_MAX_DP,
        chord * COMET_STRETCH * (1 - u) ** 0.4,
      );
      const thick = Math.max(1.6, head.radius * 0.38);
      const x = streakXform(head.x, head.y, dx, dy, thick, len + thick);
      const c = keyColors[entry.key] ?? highlight;
      const hot = 0.35;
      out.push(
        ...x,
        c[0] + (highlight[0] - c[0]) * hot,
        c[1] + (highlight[1] - c[1]) * hot,
        c[2] + (highlight[2] - c[2]) * hot,
        Math.min(1, COMET_ALPHA * Math.sin(Math.PI * u) ** 0.5 * k),
      );
    }
    // Retained motion smears: proportional to the spin.
    if (warp > 0.02) {
      for (let n = 0; n < roles.retained.length; n++) {
        if (out.length >= TRAIL_CAPACITY * TRAIL_STRIDE) break;
        const entry = transition.entries[roles.retained[n]];
        if (!entry) continue;
        const head = bodyAt(f, index, entry.key);
        if (!head?.visible) continue;
        const prev = sampleSwitchEntry(transition, entry, p - SMEAR_LOOKBACK);
        const tail = projectWorld(m, prev.x, prev.y);
        if (!tail) continue;
        let dx = head.x - tail.x;
        let dy = head.y - tail.y;
        const chord = Math.sqrt(dx * dx + dy * dy);
        if (chord < 2) continue;
        dx /= chord;
        dy /= chord;
        const thick = Math.max(2, head.radius * 1.5);
        const len = chord * SMEAR_STRETCH + head.radius;
        const x = streakXform(head.x, head.y, dx, dy, thick, len);
        const c = keyColors[entry.key] ?? highlight;
        out.push(...x, c[0], c[1], c[2], Math.min(1, SMEAR_ALPHA * warp * k));
      }
    }
    return out;
  });
  const sprites = useRectBuffer(TRAIL_CAPACITY, (r, i) => {
    "worklet";
    const s = state.value;
    const o = i * TRAIL_STRIDE;
    if (o >= s.length) {
      r.setXYWH(0, 0, 1, 1);
      return;
    }
    r.setXYWH(0, s[o + 4] * STREAK_BAND_H, s[o + 5], STREAK_BAND_H);
  });
  const transforms = useRSXformBuffer(TRAIL_CAPACITY, (xf, i) => {
    "worklet";
    const s = state.value;
    const o = i * TRAIL_STRIDE;
    if (o >= s.length) {
      hiddenXform(xf);
      return;
    }
    xf.set(s[o], s[o + 1], s[o + 2], s[o + 3]);
  });
  const colors = useColorBuffer(TRAIL_CAPACITY, (c, i) => {
    "worklet";
    const s = state.value;
    const o = i * TRAIL_STRIDE;
    if (o >= s.length) {
      c[3] = 0;
      return;
    }
    c[0] = s[o + 6];
    c[1] = s[o + 7];
    c[2] = s[o + 8];
    c[3] = additive ? s[o + 9] : s[o + 9] * LIGHT_FX_ALPHA;
  });
  return (
    <Atlas
      image={image}
      sprites={sprites}
      transforms={transforms}
      colors={colors}
      colorBlendMode="modulate"
      blendMode={additive ? "plus" : "srcOver"}
    />
  );
}

/** Slot UNDER the bodies (world plane): shockwave + comets / smears. */
export function LabSwitchUnder(props: LabSwitchFxProps) {
  const { flags } = props;
  return (
    <Group>
      {flags.shockwave ? (
        <Shockwave
          frame={props.frame}
          extent={props.extent}
          additive={props.additive}
          highlight={props.highlight}
        />
      ) : null}
      {flags.comets ? (
        <Trails
          frame={props.frame}
          frameIndex={props.frameIndex}
          keyColors={props.keyColors}
          highlight={props.highlight}
          additive={props.additive}
        />
      ) : null}
    </Group>
  );
}

// --- OVER the bodies: particles + capture flares ----------------------------------

function Particles({
  frame,
  frameIndex,
  keyColors,
  highlight,
  additive,
}: Omit<LabSwitchFxProps, "extent" | "flags">) {
  const ctx = useLabRenderContext();
  const image = useTexture(<FxSprites />, FX_ATLAS, []);
  const sprites = useMemo(
    () =>
      Array.from({ length: PARTICLE_CAPACITY }, () =>
        rect(0, 0, FX_CELL, FX_CELL),
      ),
    [],
  );
  const state = useDerivedValue(() => {
    const sw = ctx?.sw;
    const warm = ctx ? ctx.warm.value : false;
    const fx = ctx ? ctx.fxFlags.value : null;
    const f = frame.value;
    if (warm)
      return [
        f.viewport.width / 2,
        f.viewport.height / 2,
        2,
        0.01,
        highlight[0],
        highlight[1],
        highlight[2],
        0,
      ];
    if (!sw || !fx?.flags.fx || !fx.flags.fxParticles) return EMPTY;
    const signal = sw.signal.value;
    if (!switchFxLive(signal, ctx ? ctx.reducedMotion.value : false))
      return EMPTY;
    const roles = sw.roles.value;
    if (roles.generation !== signal.generation || roles.leaving.length === 0)
      return EMPTY;
    const transition = sw.transition.value;
    const index = frameIndex.value;
    // Budget the fixed capacity over the leaving bodies that are ON SCREEN
    // (a dense → small switch can shed 130 bodies, most of them off-screen).
    const shown: number[] = [];
    for (let j = 0; j < roles.leaving.length; j++) {
      const entry = transition.entries[roles.leaving[j]];
      const b = entry ? bodyAt(f, index, entry.key) : undefined;
      if (b?.visible) shown.push(j);
    }
    const per = particlesPerBody(shown.length, signal.intensity);
    const k = fx.intensity;
    const out: number[] = [];
    for (let n = 0; n < shown.length; n++) {
      const j = shown[n];
      if ((n + 1) * per > PARTICLE_CAPACITY) break;
      const entry = transition.entries[roles.leaving[j]];
      if (!entry) continue;
      const b = bodyAt(f, index, entry.key);
      if (!b) continue;
      const c = keyColors[entry.key] ?? highlight;
      const seed = (signal.generation % 97) * 3.17 + roles.leaving[j] * 1.91;
      for (let s = 0; s < per; s++) {
        const q = particleAt(
          seed,
          s,
          signal.progress,
          entry.stagger,
          b.x,
          b.y,
          b.radius,
          f.center.x,
          f.center.y,
        );
        if (!q) continue;
        const hot = q.hot * 0.65;
        out.push(
          q.x,
          q.y,
          q.size,
          Math.min(1, q.alpha * k),
          c[0] + (highlight[0] - c[0]) * hot,
          c[1] + (highlight[1] - c[1]) * hot,
          c[2] + (highlight[2] - c[2]) * hot,
          q.hot,
        );
      }
    }
    return out;
  });
  const transforms = useRSXformBuffer(PARTICLE_CAPACITY, (xf, i) => {
    "worklet";
    const s = state.value;
    const o = i * PART_STRIDE;
    if (o >= s.length) {
      hiddenXform(xf);
      return;
    }
    const sc = s[o + 2] / FX_SOFT_CORE;
    xf.set(sc, 0, s[o] - (sc * FX_CELL) / 2, s[o + 1] - (sc * FX_CELL) / 2);
  });
  const colors = useColorBuffer(PARTICLE_CAPACITY, (c, i) => {
    "worklet";
    const s = state.value;
    const o = i * PART_STRIDE;
    if (o >= s.length) {
      c[3] = 0;
      return;
    }
    c[0] = s[o + 4];
    c[1] = s[o + 5];
    c[2] = s[o + 6];
    c[3] = additive ? s[o + 3] : s[o + 3] * LIGHT_FX_ALPHA;
  });
  return (
    <Atlas
      image={image}
      sprites={sprites}
      transforms={transforms}
      colors={colors}
      colorBlendMode="modulate"
      blendMode={additive ? "plus" : "srcOver"}
    />
  );
}

function Flares({
  frame,
  frameIndex,
  keyColors,
  highlight,
  additive,
}: Omit<LabSwitchFxProps, "extent" | "flags">) {
  const ctx = useLabRenderContext();
  const image = useTexture(<FxSprites />, FX_ATLAS, []);
  // Even slots: soft glow; odd slots: 4-point glint.
  const sprites = useMemo(
    () =>
      Array.from({ length: FLARE_CAPACITY }, (_, i) =>
        rect(i % 2 === 0 ? 0 : FX_CELL, 0, FX_CELL, FX_CELL),
      ),
    [],
  );
  const state = useDerivedValue(() => {
    const sw = ctx?.sw;
    const warm = ctx ? ctx.warm.value : false;
    const fx = ctx ? ctx.fxFlags.value : null;
    const f = frame.value;
    if (warm) {
      const vx = f.viewport.width / 2;
      const vy = f.viewport.height / 2;
      const sc = 0.1;
      return [
        sc,
        0,
        vx,
        vy,
        highlight[0],
        highlight[1],
        highlight[2],
        0.01,
        sc,
        0,
        vx,
        vy,
        highlight[0],
        highlight[1],
        highlight[2],
        0.01,
      ];
    }
    if (!sw || !fx?.flags.fx || !fx.flags.fxFlares) return EMPTY;
    const signal = sw.signal.value;
    if (!switchFxLive(signal, ctx ? ctx.reducedMotion.value : false))
      return EMPTY;
    const roles = sw.roles.value;
    if (roles.generation !== signal.generation) return EMPTY;
    const transition = sw.transition.value;
    const index = frameIndex.value;
    const crowd = Math.min(
      1,
      Math.sqrt(FLARE_CROWD / Math.max(1, roles.entering.length)),
    );
    const k = fx.intensity * crowd;
    const out: number[] = [];
    for (let n = 0; n < roles.entering.length; n++) {
      if (out.length >= FLARE_CAPACITY * FLARE_STRIDE) break;
      const entry = transition.entries[roles.entering[n]];
      if (!entry) continue;
      const e = flareEnvelope(signal.progress, entry.stagger);
      if (e <= 0) continue;
      const b = bodyAt(f, index, entry.key);
      if (!b?.visible) continue;
      const c = keyColors[entry.key] ?? highlight;
      const glow = (b.radius * FLARE_GLOW_SPAN * (0.7 + 0.4 * e)) / FX_CELL;
      const glint = (b.radius * FLARE_GLINT_SPAN * (0.4 + 0.6 * e)) / FX_CELL;
      const rot = signal.accumulatedRotation * 0.15 + entry.stagger * 40;
      const gc = Math.cos(rot) * glint;
      const gs = Math.sin(rot) * glint;
      const h = FX_CELL / 2;
      out.push(
        glow,
        0,
        b.x - glow * h,
        b.y - glow * h,
        c[0] + (highlight[0] - c[0]) * 0.3,
        c[1] + (highlight[1] - c[1]) * 0.3,
        c[2] + (highlight[2] - c[2]) * 0.3,
        Math.min(1, 0.3 * e * k),
        gc,
        gs,
        b.x - (gc * h - gs * h),
        b.y - (gs * h + gc * h),
        highlight[0],
        highlight[1],
        highlight[2],
        Math.min(1, 0.5 * e * k),
      );
    }
    return out;
  });
  const transforms = useRSXformBuffer(FLARE_CAPACITY, (xf, i) => {
    "worklet";
    const s = state.value;
    const o = i * FLARE_STRIDE;
    if (o >= s.length) {
      hiddenXform(xf);
      return;
    }
    xf.set(s[o], s[o + 1], s[o + 2], s[o + 3]);
  });
  const colors = useColorBuffer(FLARE_CAPACITY, (c, i) => {
    "worklet";
    const s = state.value;
    const o = i * FLARE_STRIDE;
    if (o >= s.length) {
      c[3] = 0;
      return;
    }
    c[0] = s[o + 4];
    c[1] = s[o + 5];
    c[2] = s[o + 6];
    c[3] = additive ? s[o + 7] : s[o + 7] * LIGHT_FX_ALPHA;
  });
  return (
    <Atlas
      image={image}
      sprites={sprites}
      transforms={transforms}
      colors={colors}
      colorBlendMode="modulate"
      blendMode={additive ? "plus" : "srcOver"}
    />
  );
}

/** Slot OVER the bodies (L7): particle bursts + capture flares. */
export function LabSwitchOver(props: LabSwitchFxProps) {
  const { flags } = props;
  return (
    <Group>
      {flags.particles ? (
        <Particles
          frame={props.frame}
          frameIndex={props.frameIndex}
          keyColors={props.keyColors}
          highlight={props.highlight}
          additive={props.additive}
        />
      ) : null}
      {flags.flares ? (
        <Flares
          frame={props.frame}
          frameIndex={props.frameIndex}
          keyColors={props.keyColors}
          highlight={props.highlight}
          additive={props.additive}
        />
      ) : null}
    </Group>
  );
}

// --- EXPERIMENT: displacement shockwave image filter (flag fxShockFilter) ------

/** Filter look (dp; scaled to layer pixels by the device pixel ratio). */
const FILTER_AMP_DP = 28;
const FILTER_BAND_DP = 34;
const FILTER_CHROMA = 0.18;
const FILTER_BRIGHT = 0.22;

/**
 * Uniforms for `shockFilter`, following the same front as the projected
 * shockwave (`shockwaveState`). The filter works in LAYER PIXELS, so dp values
 * are multiplied by `pixelRatio`. Amplitude 0 (identity) at rest — but the
 * saveLayer itself is paid every frame while the flag is on (that is what the
 * experiment measures).
 */
export function useShockFilterUniforms(
  frame: SharedValue<AnimatedFrame>,
  extent: number,
  pixelRatio: number,
) {
  const ctx = useLabRenderContext();
  return useDerivedValue(() => {
    const f = frame.value;
    const sw = ctx?.sw;
    const fx = ctx ? ctx.fxFlags.value : null;
    const signal = sw ? sw.signal.value : null;
    const live =
      !!fx &&
      fx.flags.fx &&
      switchFxLive(signal, ctx ? ctx.reducedMotion.value : false);
    const [u, s] = live ? shockwaveState(signal) : [0, 0];
    const reach = extent > 0 ? extent : 200;
    const front = reach * (0.06 + SHOCK_REACH * (1 - (1 - u) ** 2.2));
    const m = planeHomography(f.pose, f.viewport);
    const c = m ? applyHomography(m, 0, 0) : { x: f.center.x, y: f.center.y };
    const e = m ? applyHomography(m, front, 0) : { x: c.x + front, y: c.y };
    const radius = Math.sqrt((e.x - c.x) ** 2 + (e.y - c.y) ** 2);
    const k = pixelRatio > 0 ? pixelRatio : 1;
    return {
      uShock: [c.x * k, c.y * k, radius * k, FILTER_AMP_DP * s * k],
      uShock2: [FILTER_BAND_DP * k, FILTER_CHROMA * s, FILTER_BRIGHT * s, 0],
    };
  });
}
