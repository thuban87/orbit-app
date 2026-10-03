/**
 * 38.7-06 (D-43): JS-thread spec builders for the V2 picture tree.
 *
 * Builders run only when their inputs change (scene resources, theme), never
 * per frame; their output crosses to the UI thread through SharedValues and
 * the picture worklets read nothing else. Every colour is a `ThemePalette`
 * token resolved here to RGBA floats (0..1), so the draw modules and SkSL
 * uniforms never see a colour literal (check:colors).
 */
import { Skia } from "@shopify/react-native-skia";
import { orreryRingStyle } from "@/logic/orrery-ring-logic";
import type { ThemePalette } from "@/theme/theme-types";
import type { OrreryBodyResource } from "../use-orrery-switch-runtime";

/** Premultiplication-free RGBA floats, 0..1. */
export type OrreryInk = readonly [number, number, number, number];

const NO_INK: OrreryInk = [0, 0, 0, 0];

/** A theme token → RGBA floats (transparent if the runtime cannot parse it). */
export function tokenInk(token: string): OrreryInk {
  let value: ArrayLike<number> | undefined;
  try {
    value = Skia?.Color?.(token) as ArrayLike<number> | undefined;
  } catch {
    value = undefined;
  }
  if (!value || typeof value !== "object" || value.length !== 4) return NO_INK;
  return [value[0], value[1], value[2], value[3]];
}

/** Today's dashed orbit (a 6-on-6-off dash): one 12 dp period. */
export const RING_DASH_PERIOD_DP = 12;
/** Today's ring opacities by line treatment (faded / faint trace). */
const FADED_ALPHA = 0.7;
const FAINT_TRACE_ALPHA = 0.3;

/** One orbit ring's look, per body key: today's status style, as numbers. */
export interface RingSpec {
  ink: OrreryInk;
  /** Line width in screen dp (today's stroke width). */
  widthDp: number;
  /** Status alpha (multiplied by the body's transition opacity when drawn). */
  alpha: number;
  /** Dash period in screen dp; 0 = solid. */
  dashPeriodDp: number;
}
export type RingSpecs = Readonly<Record<string, RingSpec>>;
export const EMPTY_RING_SPECS: RingSpecs = Object.freeze({});

/**
 * Ring specs for every contact resource: `orreryRingStyle` (colour, width,
 * line treatment) with today's alphas — faded 0.7, faint trace 0.3, otherwise
 * the style's own opacity — and today's 6-on-6-off dash for dashed and
 * faint-trace rings.
 */
export function buildRingSpecs(
  resources: readonly OrreryBodyResource[],
  colors: ThemePalette,
): RingSpecs {
  const statusById = new Map<
    OrreryBodyResource["scene"],
    Map<number, OrreryBodyResource["scene"]["contacts"][number]["status"]>
  >();
  const statusOf = (resource: OrreryBodyResource) => {
    let index = statusById.get(resource.scene);
    if (!index) {
      index = new Map();
      // First row per id, as the legacy `find` returned.
      for (const row of resource.scene.contacts)
        if (!index.has(row.id)) index.set(row.id, row.status);
      statusById.set(resource.scene, index);
    }
    return index.get(resource.body.id) ?? null;
  };
  const specs: Record<string, RingSpec> = {};
  for (const resource of resources) {
    if (resource.body.kind !== "contact") continue;
    const style = orreryRingStyle(statusOf(resource), colors);
    specs[resource.key] = {
      ink: tokenInk(style.color),
      widthDp: style.width,
      alpha:
        style.strokeStyle === "faded"
          ? FADED_ALPHA
          : style.strokeStyle === "faintTrace"
            ? FAINT_TRACE_ALPHA
            : style.opacity,
      dashPeriodDp:
        style.strokeStyle === "dashed" || style.strokeStyle === "faintTrace"
          ? RING_DASH_PERIOD_DP
          : 0,
    };
  }
  return specs;
}

/** The canvas background (today's `<Fill color={colors.background}>`). */
export interface SkySpec {
  background: OrreryInk;
}
export function buildSkySpec(colors: ThemePalette): SkySpec {
  return { background: tokenInk(colors.background) };
}

/** The overlay's inks (accent for reorder/focus, Polaris star and halo). */
export interface OverlayInk {
  accent: OrreryInk;
  textPrimary: OrreryInk;
  /** Polaris halo: the first star-palette colour (textPrimary when empty). */
  polarisHalo: OrreryInk;
}
/**
 * One focused body's accent outline: today's OrbitBody/SunBody focus ring,
 * `gap` world units outside the body's world radius (both scale with it).
 */
export interface OverlayFocus {
  key: string;
  worldRadius: number;
  gap: number;
}
export interface OverlaySpec {
  ink: OverlayInk;
  /** The world extent Polaris sits beyond (`scene.extent`). */
  extent: number;
  focus: readonly OverlayFocus[];
}
/** Today's focus-ring gaps outside the disc (contact / sun). */
export const FOCUS_RING_GAP = { contact: 4, sun: 6 } as const;

export function buildOverlayInk(colors: ThemePalette): OverlayInk {
  return {
    accent: tokenInk(colors.accent),
    textPrimary: tokenInk(colors.textPrimary),
    polarisHalo: tokenInk(colors.starPalette[0] ?? colors.textPrimary),
  };
}

/** The focus outlines for the focused ids (contacts and the sun; not moons). */
export function buildFocusOutlines(
  resources: readonly OrreryBodyResource[],
  focusedIds: readonly number[],
): OverlayFocus[] {
  if (focusedIds.length === 0) return [];
  const focused = new Set(focusedIds);
  const out: OverlayFocus[] = [];
  for (const resource of resources) {
    const { body } = resource;
    if (body.kind === "satellite" || !focused.has(body.id)) continue;
    out.push({
      key: resource.key,
      worldRadius: body.radius,
      gap: body.kind === "sun" ? FOCUS_RING_GAP.sun : FOCUS_RING_GAP.contact,
    });
  }
  return out;
}

export const EMPTY_OVERLAY_SPEC: OverlaySpec = Object.freeze({
  ink: { accent: NO_INK, textPrimary: NO_INK, polarisHalo: NO_INK },
  extent: 1,
  focus: [],
});

// ── Ambient starfield (today's OrreryCanvas twinkle field, as a spec) ───────
/** How many ambient star dots to scatter (subtle — device-UAT tunable, 13-08). */
export const STAR_COUNT = 44;
/** Star dot radius range (dp). */
export const STAR_R_MIN = 0.6;
export const STAR_R_MAX = 1.8;

/** One placed star: screen position, radius, ink and its static opacity. */
export interface StarSpec {
  x: number;
  y: number;
  r: number;
  ink: OrreryInk;
  /** Static per-star opacity for a non-uniform field (× the twinkle). */
  base: number;
}
export interface StarFieldSpec {
  stars: readonly StarSpec[];
}
export const EMPTY_STAR_FIELD: StarFieldSpec = Object.freeze({ stars: [] });

/**
 * Deterministic 0..1 hash from an integer seed — a tiny LCG-ish mix so the
 * star field is stable across renders without a PRNG dependency (and without
 * `crypto`, which Hermes lacks).
 */
export function seeded(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Today's 44 seeded stars for the measured canvas: the same placement, radii,
 * per-star base opacity and colour cycle (`textSecondary`, `textPrimary`,
 * then the star palette) as the pre-38.7-06 OrreryCanvas.
 */
export function buildStarField(
  width: number,
  height: number,
  colors: ThemePalette,
): StarFieldSpec {
  const tones = [
    colors.textSecondary,
    colors.textPrimary,
    ...colors.starPalette,
  ];
  if (width <= 0 || height <= 0) return EMPTY_STAR_FIELD;
  const inks = tones.map(tokenInk);
  const stars: StarSpec[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: seeded(i + 1) * width,
      y: seeded(i + 101) * height,
      r: STAR_R_MIN + seeded(i + 201) * (STAR_R_MAX - STAR_R_MIN),
      ink: inks[i % inks.length],
      base: 0.4 + seeded(i + 301) * 0.6,
    });
  }
  return { stars };
}
