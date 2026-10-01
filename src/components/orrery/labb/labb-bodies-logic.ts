/**
 * ORRERY LAB B — L2–L4 body materials and per-frame lighting (WP-1.2), pure.
 *
 * - `labBodyMaterial(status)`: the static per-status material table (research
 *   03 §1.3 L3). STATIC per status — no per-status animation (HANDOFF §7
 *   [REJECTED] differentiated per-band animation).
 * - `labLightDir`: the screen-space unit vector body → sun centre. Bodies are
 *   drawn under a translate + uniform-scale transform only, so the screen
 *   direction IS the local shader direction.
 * - `labHaze`: far-side depth haze from the projected `depth` (negative = far).
 * - `labBodyFrameUniforms` / `labMoonFrameUniforms` / `labSunFrameUniforms`:
 *   the per-frame uniform blocks (worklets) merged over a static block built
 *   React-side from theme tokens.
 *
 * Hermes rule: every helper is declared ABOVE its worklet callers (guarded by
 * `orrery-worklet-order.test.ts`). No Skia import here (node-testable).
 */
import type { ProfileStatus } from "@/db/contact-status-read";
import type { LabFxSnapshot } from "@/stores/orrery-labb-fx-store";

// --- Tunables -----------------------------------------------------------------
/** Drawn reach of a contact body (atmosphere / shadow) as a multiple of r. Must
 * stay ≤ the 1.3 culling reach used by `projectAnimatedFrame`. */
export const BODY_REACH = 1.3;
/** Drawn reach of the sun (corona) as a multiple of r; ≤ the ×2 culling reach. */
export const SUN_REACH = 2;
/** Light-vector elevation out of the screen plane (the sun sits in the plane;
 * a little z keeps the terminator from cutting faces in half). */
export const LIGHT_Z = 0.4;
/** Fallback light direction when a body sits on the sun (up-left). */
const DEFAULT_LIGHT: [number, number] = [-0.6, -0.8];
/** Sun ambient: corona ray rotation and granulation speed live in the shader;
 * this is the frozen composition time under reduced motion (s). */
export const SUN_STILL_T = 37;
/** Corona breathing (± fraction of corona intensity), ~3.1 s like legacy. */
export const SUN_BREATH = 0.06;
const SUN_PULSE_SPEED = 0.002;

export interface LabBodyMaterial {
  /** Atmosphere strength multiplier (0 = none). */
  atmosphere: number;
  /** Surface desaturation (0..1). */
  desaturate: number;
  /** Fresnel limb-rim multiplier. */
  fresnel: number;
  /** Specular glint multiplier (0 = matte). */
  spec: number;
}

/**
 * Status → material. stable/wobble: full clear atmosphere; decay: thin & dim,
 * 25% desaturated; rogue: no atmosphere, 45% desaturated, cold rim (the rim
 * hue is the rogue `bodyFill` = `rogueExtinguished`); never-contacted: matte,
 * neutral rim, no atmosphere.
 */
export function labBodyMaterial(status: ProfileStatus | null): LabBodyMaterial {
  switch (status) {
    case "stable":
    case "wobble":
      return { atmosphere: 1, desaturate: 0, fresnel: 1, spec: 1 };
    case "decay":
      return { atmosphere: 0.4, desaturate: 0.25, fresnel: 0.55, spec: 0.6 };
    case "rogue":
      return { atmosphere: 0, desaturate: 0.45, fresnel: 0.3, spec: 0.3 };
    default:
      return { atmosphere: 0, desaturate: 0.1, fresnel: 0, spec: 0 };
  }
}

/** Unit screen-space direction from (x, y) toward the sun centre. */
export function labLightDir(
  x: number,
  y: number,
  sunX: number,
  sunY: number,
): [number, number] {
  "worklet";
  const dx = sunX - x;
  const dy = sunY - y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (!(len > 1e-3)) return DEFAULT_LIGHT;
  return [dx / len, dy / len];
}

/** Far-side haze 0..max: `depth` < 0 is the far side of a tilted plane. */
export function labHaze(depth: number, extent: number, max: number): number {
  "worklet";
  if (!(extent > 0) || !(max > 0)) return 0;
  const far = Math.min(1, Math.max(0, -depth / extent));
  return far * max;
}

/** Effect-strength scalar: profile intensity × the panel's global intensity. */
export function labFxScale(
  profileIntensity: number,
  fx: LabFxSnapshot | null,
): number {
  "worklet";
  return profileIntensity * (fx ? fx.intensity : 1);
}

export interface LabBodyStatic {
  uR: number;
  uStatus: number[];
  uSky: number[];
  uShadow: number[];
  uHi: number[];
  uBase: number[];
  uBand: number[];
  uSeed: number;
  uFloor: number;
  uWrap: number;
  uRimPx: number;
  uRimStr: number;
  atmo: number;
  atmoAdd: number;
  shadow: number;
  fresnel: number;
  desat: number;
  spec: number;
  haze: number;
  intensity: number;
  extent: number;
}

/** A body's frame position subset (from `bodyAt`). */
export interface LabBodyPose {
  x: number;
  y: number;
  radius: number;
  depth: number;
}

/**
 * Per-frame uniforms for the lit contact-body shaders. `switchFx` (WP-2.1) =
 * [dissolve 0..1, capture flare 0..1] from `bodySwitchFx` (zeros at rest).
 * `focus` (WP-2.2, `uK.w`) = `focusBodyValue`: +mix on the focused world
 * (atmosphere intensifies), −mix on every other world (defocus), 0 at rest.
 */
export function labBodyFrameUniforms(
  body: LabBodyPose | undefined,
  sunX: number,
  sunY: number,
  st: LabBodyStatic,
  fx: LabFxSnapshot | null,
  switchFx?: readonly number[],
  focus?: number,
) {
  "worklet";
  const flags = fx ? fx.flags : null;
  const k = labFxScale(st.intensity, fx);
  const x = body ? body.x : 0;
  const y = body ? body.y : 0;
  const scale = body && st.uR > 0 ? body.radius / st.uR : 1;
  const atmosphereOn = flags ? flags.bodyAtmosphere : true;
  const light = labLightDir(x, y, sunX, sunY);
  const haze =
    flags && !flags.depthHaze
      ? 0
      : labHaze(body ? body.depth : 0, st.extent, st.haze);
  const atmo = atmosphereOn ? Math.min(1.2, st.atmo * k) : 0;
  const shadow = atmosphereOn ? Math.min(1, st.shadow * k) : 0;
  const pattern = flags && !flags.bodyProcedural ? 0 : 1;
  // Packed float4s (see BODY_LIT in labb-effects.ts).
  return {
    uA: [st.uR, scale > 1e-4 ? 1 / scale : 1, light[0], light[1]],
    uB: [LIGHT_Z, 1, st.uFloor, st.uWrap],
    uC: [st.uStatus[0], st.uStatus[1], st.uStatus[2], atmo],
    uD: [st.uSky[0], st.uSky[1], st.uSky[2], haze],
    uE: [st.uShadow[0], st.uShadow[1], st.uShadow[2], shadow],
    uF: [st.uHi[0], st.uHi[1], st.uHi[2], st.spec],
    uG: [st.atmoAdd, BODY_REACH, st.uRimPx, st.uRimStr],
    uH: [st.fresnel * Math.min(1.5, k), st.desat, pattern, st.uSeed],
    uI: [st.uBase[0], st.uBase[1], st.uBase[2], 0],
    uJ: [st.uBand[0], st.uBand[1], st.uBand[2], 0],
    uK: [
      switchFx ? switchFx[0] : 0,
      switchFx ? switchFx[1] : 0,
      st.uSeed,
      focus ?? 0,
    ],
  };
}

export interface LabMoonStatic {
  uTone: number[];
  uHi: number[];
  uSky: number[];
  floor: number;
  haze: number;
  extent: number;
}

/** Per-frame uniforms for a lit moon (world radius 1). */
export function labMoonFrameUniforms(
  body: LabBodyPose | undefined,
  sunX: number,
  sunY: number,
  st: LabMoonStatic,
  fx: LabFxSnapshot | null,
) {
  "worklet";
  const flags = fx ? fx.flags : null;
  const scale = body ? body.radius : 1;
  const light = labLightDir(body ? body.x : 0, body ? body.y : 0, sunX, sunY);
  const haze =
    flags && !flags.depthHaze
      ? 0
      : labHaze(body ? body.depth : 0, st.extent, st.haze);
  return {
    uM0: [1, scale > 1e-4 ? 1 / scale : 1, light[0], light[1]],
    uM1: [st.uTone[0], st.uTone[1], st.uTone[2], st.floor],
    uM2: [st.uHi[0], st.uHi[1], st.uHi[2], haze],
    uM3: [st.uSky[0], st.uSky[1], st.uSky[2], 0],
  };
}

export interface LabSunStatic {
  uR: number;
  uGlow: number[];
  uHi: number[];
  uDeep: number[];
  uBase: number[];
  plasma: number;
  corona: number;
  coronaAdd: number;
  intensity: number;
  /** R1 glow cap: max channel value of the sun's output (0 = uncapped). */
  cap?: number;
}

/**
 * R1 legibility: on DARK themes the sun's surface and corona never exceed this
 * channel value. Pure-white sun pixels (L = 1.0) under a glass overlay broke
 * the ADR-149 AA bound for Standard Dark `textSecondary` (4.42:1 at L 1.0;
 * AA needs raw L ≤ 0.913 ≈ 0.96 encoded). 0.94 keeps the bound with margin
 * and sits at the palette's brightest star (#E9ECF1 ≈ 0.945), the very pixel
 * ADR-149 proved against.
 */
export const SUN_GLOW_CAP_DARK = 0.94;

/** Per-frame sun uniforms: ambient time (frozen under reduced motion), pulse. */
export function labSunFrameUniforms(
  body: LabBodyPose | undefined,
  timeMs: number,
  reduced: boolean,
  st: LabSunStatic,
  fx: LabFxSnapshot | null,
  /** WP-2.1 corona flare multiplier boost (0 at rest; +0.4 at full warp). */
  flare = 0,
) {
  "worklet";
  const flags = fx ? fx.flags : null;
  const k = labFxScale(st.intensity, fx);
  const scale = body && st.uR > 0 ? body.radius / st.uR : 1;
  const animate = !reduced;
  const t = animate ? (timeMs / 1000) % 1000 : SUN_STILL_T;
  const pulse =
    animate && (flags ? flags.sunPulse : true)
      ? Math.sin(timeMs * SUN_PULSE_SPEED)
      : 0;
  const plasma = flags && !flags.sunPlasma ? 0 : st.plasma;
  const corona =
    flags && !flags.sunCorona
      ? 0
      : st.corona * Math.min(1.6, k) * (1 + SUN_BREATH * pulse) * (1 + flare);
  // Packed float4s (see SUN_CORONA in labb-effects.ts).
  return {
    uS0: [st.uR, scale > 1e-4 ? 1 / scale : 1, t, SUN_REACH],
    uS1: [st.uGlow[0], st.uGlow[1], st.uGlow[2], plasma],
    uS2: [st.uHi[0], st.uHi[1], st.uHi[2], corona],
    uS3: [st.uDeep[0], st.uDeep[1], st.uDeep[2], st.coronaAdd],
    uS4: [st.uBase[0], st.uBase[1], st.uBase[2], st.cap ?? 0],
  };
}

/** Deterministic 0..1 seed from a body key (Hermes: no crypto). */
export function labSeed(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10007) / 10007;
}
