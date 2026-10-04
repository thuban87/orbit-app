/**
 * 38.7-06 (D-43): JS-thread spec builders for the V2 picture tree.
 *
 * Builders run only when their inputs change (scene resources, theme), never
 * per frame; their output crosses to the UI thread through SharedValues and
 * the picture worklets read nothing else. Every colour is a `ThemePalette`
 * token resolved here to RGBA floats (0..1), so the draw modules and SkSL
 * uniforms never see a colour literal (check:colors).
 */
import { type SkImage, Skia } from "@shopify/react-native-skia";
import { swatchIndex } from "@/components/avatar-initials";
import type { ProfileStatus } from "@/db/contact-status-read";
import type { OrrerySatellite } from "@/db/orrery-satellites-read";
import { bodyKey } from "@/logic/orrery-frame";
import { orreryRingStyle } from "@/logic/orrery-ring-logic";
import { SKY_UNTINTED, skyStarField } from "@/logic/orrery-sky-logic";
import { resolveSunOccupant } from "@/logic/sun-occupant-logic";
import type {
  ResolvedMode,
  ThemePackage,
  ThemePalette,
} from "@/theme/theme-types";
import type { OrreryGenerationLedger } from "../resources/orrery-generation-ledger";
import type {
  OrreryDrawnPhoto,
  OrreryPhotoRequest,
} from "../resources/orrery-photo-cache";
import type {
  OrreryInitialsSpec,
  OrreryLabelSpec,
  OrreryMeasuredLabel,
  OrreryTextVisibility,
  PreparedOrreryText,
} from "../resources/orrery-text-service";
import type { OrreryBodyResource } from "../use-orrery-switch-runtime";
import {
  BODY_ATMOSPHERE_REACH,
  BODY_GLOW_TOKEN_MIX,
  BODY_LOOKS,
  BODY_RIM_TOKEN_MIX,
  DECAY_DESATURATION,
  FACE_LIGHT,
  type FaceLight,
  RING_DASHED_DUTY,
  RING_DASHED_PERIOD_DP,
  RING_FADED_ALPHA,
  RING_TRACE_ALPHA,
  RING_TRACE_DUTY,
  RING_TRACE_PERIOD_DP,
  RING_WIDTH_BASE,
  RING_WIDTH_SCALE,
  ROGUE_DESATURATION,
  STATUS_MATERIALS,
  SUN_CORONA_ALPHA,
} from "./visual-tunables";

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

/**
 * 38.7-09 (D-11): Lab B's thin rings. The status ladder is kept as the
 * non-colour cue: weight orders status (width × scale + base), wobble is
 * dashed, rogue a short faint trace, decay faded; colour is the status token.
 */
export const RING_DASH_PERIOD_DP = RING_DASHED_PERIOD_DP;

/** One orbit ring's look, per body key: its status style, as numbers. */
export interface RingSpec {
  ink: OrreryInk;
  /** Line width in screen dp (Lab B's thin status widths). */
  widthDp: number;
  /** Status alpha (multiplied by the body's transition opacity when drawn). */
  alpha: number;
  /** Dash period in screen dp; 0 = solid. */
  dashPeriodDp: number;
  /** The on-fraction of each dash period. */
  dashDuty: number;
  /** D-11 sun light: alpha gain at the sun (0 = off). */
  lightGain: number;
  /** How far lit rings lean toward `light`. */
  lightMix: number;
  /** Far-side alpha at full perspective (1 = no depth fade). */
  farAlpha: number;
  /** The sun-lit ink (`orreryRingLight`). */
  light: OrreryInk;
}
export type RingSpecs = Readonly<Record<string, RingSpec>>;
export const EMPTY_RING_SPECS: RingSpecs = Object.freeze({});

/** The ring lighting `buildRingSpecs` applies (visual-tunables `RING_LOOKS`). */
export interface RingSpecLook {
  lightGain: number;
  lightMix: number;
  farAlpha: number;
}
/** No sun light, no depth fade (tests, previews). */
export const PLAIN_RING_LOOK: RingSpecLook = Object.freeze({
  lightGain: 0,
  lightMix: 0,
  farAlpha: 1,
});

/**
 * Ring specs for every contact resource: `orreryRingStyle` (colour, width,
 * line treatment) mapped to Lab B's thin, sun-lit instrument lines (D-11):
 * width × RING_WIDTH_SCALE + RING_WIDTH_BASE, faded 0.7 / faint trace 0.42
 * (otherwise the style's own opacity, neutral 0.5), dashed 11 dp at 0.58 on,
 * faint trace 6 dp at 0.3 on.
 */
export function buildRingSpecs(
  resources: readonly OrreryBodyResource[],
  colors: ThemePalette,
  look: RingSpecLook = PLAIN_RING_LOOK,
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
  const light = tokenInk(colors.orreryRingLight);
  const specs: Record<string, RingSpec> = {};
  for (const resource of resources) {
    if (resource.body.kind !== "contact") continue;
    const style = orreryRingStyle(statusOf(resource), colors);
    const dashed = style.strokeStyle === "dashed";
    const trace = style.strokeStyle === "faintTrace";
    specs[resource.key] = {
      ink: tokenInk(style.color),
      widthDp: style.width * RING_WIDTH_SCALE + RING_WIDTH_BASE,
      alpha:
        style.strokeStyle === "faded"
          ? RING_FADED_ALPHA
          : trace
            ? RING_TRACE_ALPHA
            : style.opacity,
      dashPeriodDp: dashed
        ? RING_DASHED_PERIOD_DP
        : trace
          ? RING_TRACE_PERIOD_DP
          : 0,
      dashDuty: dashed ? RING_DASHED_DUTY : trace ? RING_TRACE_DUTY : 1,
      lightGain: look.lightGain,
      lightMix: look.lightMix,
      farAlpha: look.farAlpha,
      light,
    };
  }
  return specs;
}

// ── The orbital plane's grid and pulses (38.7-09: D-09, D-10) ─────────────

/** The optional orbital-plane grid (D-09). opacity 0 = not drawn at all. */
export interface GridSpec {
  ink: OrreryInk;
  opacity: number;
  rings: number;
  spokes: number;
  halfWidthDp: number;
  /** Reach × the outermost orbit radius. */
  extent: number;
  farAlpha: number;
}
/** The subtle orbit pulses (D-10): identical for every status. */
export interface PulseSpec {
  ink: OrreryInk;
  /** Peak alpha; 0 = none. */
  intensity: number;
  /** Most pulses at once; 0 = none. */
  budget: number;
  /** D-51 blend family from the resolved mode: dark additive, light src-over. */
  additive: boolean;
  farAlpha: number;
}
export interface PlaneSpec {
  grid: GridSpec;
  pulse: PulseSpec;
}
export const EMPTY_PLANE_SPEC: PlaneSpec = Object.freeze({
  grid: {
    ink: NO_INK,
    opacity: 0,
    rings: 0,
    spokes: 0,
    halfWidthDp: 0,
    extent: 1,
    farAlpha: 1,
  },
  pulse: { ink: NO_INK, intensity: 0, budget: 0, additive: true, farAlpha: 1 },
});

/** The plane spec for a theme: `orreryGrid` / `orreryPulse` and the tunables. */
export function buildPlaneSpec(
  colors: ThemePalette,
  mode: ResolvedMode,
  look: RingSpecLook,
  tunables: {
    gridOpacity: number;
    gridRings: number;
    gridSpokes: number;
    gridHalfWidthDp: number;
    gridExtent: number;
    pulseIntensity: number;
    pulseBudget: number;
  },
): PlaneSpec {
  return {
    grid: {
      ink: tokenInk(colors.orreryGrid),
      opacity: Math.max(0, tunables.gridOpacity),
      rings: tunables.gridRings,
      spokes: tunables.gridSpokes,
      halfWidthDp: tunables.gridHalfWidthDp,
      extent: tunables.gridExtent,
      farAlpha: look.farAlpha,
    },
    pulse: {
      ink: tokenInk(colors.orreryPulse),
      intensity: Math.max(0, tunables.pulseIntensity),
      budget: Math.max(0, Math.floor(tunables.pulseBudget)),
      additive: mode === "dark",
      farAlpha: look.farAlpha,
    },
  };
}

// ── The painted sky (38.7-09: D-07, D-08, D-36, D-50, D-51, H9) ───────────

/** One batch of sky stars drawn with one paint (`drawPoints`). */
export interface SkyStarGroup {
  /** Star centres in canvas dp (the field spans the canvas + margins). */
  points: readonly { x: number; y: number }[];
  ink: OrreryInk;
  /** Dot diameter (dp). */
  diameter: number;
  /** Alpha before the twinkle. */
  alpha: number;
  /** Twinkle phase (radians). */
  phase: number;
  /**
   * 38.7-13 (D-24): the star layer — small stars are Lab B's MID layer,
   * bright stars its NEAR layer (the warp's streak length and push depth).
   */
  layer: "mid" | "near";
}

/**
 * Everything the sky picture reads besides the baked image and the frame:
 * the neutral gradient, the per-System tint (applied at DRAW time, H9), the
 * stars and the motion bounds. Rebuilt on theme, size or System change only.
 */
export interface SkySpec {
  /** Canvas size (dp). */
  width: number;
  height: number;
  /** The covered area (dp): the canvas plus margins, bucketed (nebula-bake). */
  coverWidth: number;
  coverHeight: number;
  /** The neutral gradient: horizon (top) → base (from `horizonStop` down). */
  base: OrreryInk;
  horizon: OrreryInk;
  horizonStop: number;
  /**
   * D-51 blend rule, keyed from the RESOLVED THEME MODE (never luminance):
   * dark → additive / screen; light → src-over with ink tokens.
   */
  additive: boolean;
  /**
   * The System tint: `tintFrom` → `tintTo` by `tintMix` (1 when settled).
   * 38.7-13 (D-08/H9): the sky picture overrides the mix at DRAW time from
   * the switch signal (`skyHueMix`): the switch to `tintGeneration`
   * crossfades from → to over [0.55, 1] (Lab B); an older drawn switch shows
   * `tintFrom`, a newer one `tintTo`. Each ink's alpha is its tint strength
   * (0 = untinted, the All Contacts rule). No bake involved (H9).
   */
  tintFrom: OrreryInk;
  tintTo: OrreryInk;
  tintMix: number;
  /** The scene generation whose switch crossfades `tintFrom` → `tintTo`. */
  tintGeneration: number;
  /** How far the tint pushes the nebula toward its hue (0..1). */
  tintStrength: number;
  /** The faint whole-sky wash of the tint (0..1). */
  tintWash: number;
  /** Star batches (empty under a zero size). */
  stars: readonly SkyStarGroup[];
  /** The share of a star's alpha the twinkle swings (0 = still). */
  twinkleDepth: number;
  /**
   * 38.7-09 rework: Lab B's nebula colouring (sky shader). Lobe inks are the
   * NEUTRAL `orreryNebula` tokens; the System hue leans lobe B at draw time
   * (H9). Strengths are already × `nebulaStrength`.
   */
  nebula: SkyNebulaSpec;
}

/** The sky shader's colouring of the baked densities (all token inks). */
export interface SkyNebulaSpec {
  lobeA: OrreryInk;
  lobeB: OrreryInk;
  ember: OrreryInk;
  lobeAStrength: number;
  lobeBStrength: number;
  glow: number;
  emberStrength: number;
  dust: number;
  vignette: number;
  vignetteShade: number;
  /** Light themes: the ink the corners wash toward (null = shade the sky). */
  vignetteInk: OrreryInk | null;
  /** The far star layer's three inks (72 % / 14 % / 14 %, as Lab B). */
  farStars: readonly [OrreryInk, OrreryInk, OrreryInk];
  farStarAlpha: number;
  farStarDensity: number;
}

const NO_SKY_NEBULA: SkyNebulaSpec = Object.freeze({
  lobeA: NO_INK,
  lobeB: NO_INK,
  ember: NO_INK,
  lobeAStrength: 0,
  lobeBStrength: 0,
  glow: 0,
  emberStrength: 0,
  dust: 0,
  vignette: 0,
  vignetteShade: 0,
  vignetteInk: null,
  farStars: Object.freeze([NO_INK, NO_INK, NO_INK]) as unknown as readonly [
    OrreryInk,
    OrreryInk,
    OrreryInk,
  ],
  farStarAlpha: 0,
  farStarDensity: 0,
});

export const EMPTY_SKY_SPEC: SkySpec = Object.freeze({
  width: 0,
  height: 0,
  coverWidth: 0,
  coverHeight: 0,
  base: NO_INK,
  horizon: NO_INK,
  horizonStop: 1,
  additive: true,
  tintFrom: NO_INK,
  tintTo: NO_INK,
  tintMix: 1,
  tintGeneration: 0,
  tintStrength: 0,
  tintWash: 0,
  stars: Object.freeze([]) as readonly SkyStarGroup[],
  twinkleDepth: 0,
  nebula: NO_SKY_NEBULA,
});

/** The sky layer's baked neutral image (null → the plain gradient). */
export interface SkyImageSpec {
  /** Strictly increasing per mount (0 = nothing published yet). */
  generation: number;
  mountEpoch: number;
  image: SkImage | null;
  /** The bake key the image was made for. */
  key: string;
}
export const EMPTY_SKY_IMAGE: SkyImageSpec = Object.freeze({
  generation: 0,
  mountEpoch: 0,
  image: null,
  key: "",
});

/** The look numbers `buildSkySpec` needs (visual-tunables `SKY_LOOKS`). */
export interface SkySpecLook {
  starCount: number;
  brightStarCount: number;
  starRadius: readonly [number, number];
  brightRadius: readonly [number, number];
  starAlpha: readonly [number, number];
  twinkleDepth: number;
  tintStrength: number;
  tintWash: number;
  horizonStop: number;
  /** 38.7-09 rework: Lab B's nebula (visual-tunables SkyLook). */
  nebulaStrength: number;
  nebula: {
    lobeA: number;
    lobeB: number;
    glow: number;
    ember: number;
    dust: number;
  };
  vignette: number;
  vignetteShade: number;
  farStarAlpha: number;
  farStarDensity: number;
}

/** The sky shader's nebula colouring for a theme + look (JS thread). */
export function buildSkyNebula(
  colors: ThemePalette,
  mode: ResolvedMode,
  look: SkySpecLook,
): SkyNebulaSpec {
  const inks = colors.orreryNebula.map(tokenInk);
  const stars = colors.orrerySkyStars.map(tokenInk);
  if (inks.length === 0) return NO_SKY_NEBULA;
  const k = Math.max(0, look.nebulaStrength);
  const n = look.nebula;
  const starA = stars[0] ?? NO_INK;
  return {
    lobeA: inks[0],
    lobeB: inks[1] ?? inks[0],
    ember: inks[2] ?? inks[1] ?? inks[0],
    lobeAStrength: Math.min(1, n.lobeA * k),
    lobeBStrength: Math.min(1, n.lobeB * k),
    glow: mode === "dark" ? n.glow * k : 0,
    emberStrength: n.ember * k,
    dust: Math.min(1, n.dust * k),
    vignette: Math.min(1, look.vignette),
    vignetteShade: look.vignetteShade,
    vignetteInk: mode === "dark" ? null : starA,
    farStars: [starA, stars[1] ?? starA, stars[2] ?? stars[1] ?? starA],
    farStarAlpha: stars.length > 0 ? look.farStarAlpha : 0,
    farStarDensity: look.farStarDensity,
  };
}

export interface SkySpecInput {
  colors: ThemePalette;
  mode: ResolvedMode;
  themePackage: ThemePackage;
  /** Canvas size (dp). */
  width: number;
  height: number;
  /** The bake bucket (dp) — the area the sky and its stars cover. */
  cover: { width: number; height: number };
  /** `systemSkyHueIndex(...)` of the System (−1 = untinted). */
  hueIndex: number;
  /** The previous System's index (Plan 13 crossfades from it); default = hueIndex. */
  fromHueIndex?: number;
  /** 38.7-13: the scene generation the from → to crossfade belongs to (default 0). */
  tintGeneration?: number;
  look: SkySpecLook;
  /** The star-field seed. */
  seed: number;
  /** Twinkle phase groups. */
  twinkleGroups: number;
}

/** The tint ink for a hue bucket: the token's RGB, alpha = strength (0 untinted). */
export function skyTintInk(
  colors: ThemePalette,
  hueIndex: number,
  strength: number,
): OrreryInk {
  const hues = colors.orrerySystemHues;
  if (hueIndex === SKY_UNTINTED || hueIndex < 0 || hues.length === 0)
    return NO_INK;
  const ink = tokenInk(hues[hueIndex % hues.length]);
  return [ink[0], ink[1], ink[2], Math.max(0, Math.min(1, strength))];
}

/**
 * The painted sky spec (JS thread). Every colour is an `orrery*` token. The
 * stars are seeded (stable across visits), batched by tone × size × twinkle
 * phase so the picture draws a handful of `drawPoints`, and spread over the
 * covered area (canvas + margins) so parallax and drift never reveal an edge.
 */
export function buildSkySpec(input: SkySpecInput): SkySpec {
  const { colors, mode, width, height, cover, look } = input;
  const additive = mode === "dark";
  const tintTo = skyTintInk(colors, input.hueIndex, 1);
  const tintFrom = skyTintInk(colors, input.fromHueIndex ?? input.hueIndex, 1);
  const base = {
    width,
    height,
    coverWidth: cover.width,
    coverHeight: cover.height,
    base: tokenInk(colors.orrerySkyBase),
    horizon: tokenInk(colors.orrerySkyHorizon),
    horizonStop: look.horizonStop,
    additive,
    tintFrom,
    tintTo,
    tintMix: 1,
    tintGeneration: input.tintGeneration ?? 0,
    tintStrength: look.tintStrength,
    tintWash: look.tintWash,
    twinkleDepth: look.twinkleDepth,
    nebula: buildSkyNebula(colors, mode, look),
  };
  if (!(width > 0) || !(height > 0)) return { ...base, stars: [] };
  const tones = colors.orrerySkyStars.map(tokenInk);
  if (tones.length === 0) return { ...base, stars: [] };
  const groups = Math.max(1, Math.floor(input.twinkleGroups));
  // The field spans the covered area, centred on the canvas.
  const ox = (width - cover.width) / 2;
  const oy = (height - cover.height) / 2;
  const batches = new Map<
    string,
    SkyStarGroup & { points: { x: number; y: number }[] }
  >();
  const add = (
    star: {
      x: number;
      y: number;
      size: number;
      bright: number;
      tone: number;
      phase: number;
    },
    bright: boolean,
  ) => {
    const range = bright ? look.brightRadius : look.starRadius;
    // Small stars come in two classes (small + dim, larger + brighter); bright
    // stars in one. With tone × phase that keeps the batch count ≤ 9 × tones,
    // so the sky records a few dozen draws per tick at most.
    const sizeClass = bright ? 1 : star.size < 0.6 ? 0 : 1;
    const radius =
      range[0] +
      (range[1] - range[0]) * (bright ? 0.6 : sizeClass === 0 ? 0.25 : 0.8);
    const alpha = bright
      ? look.starAlpha[1]
      : look.starAlpha[0] +
        (look.starAlpha[1] - look.starAlpha[0]) * (sizeClass === 0 ? 0.3 : 0.8);
    const toneIndex = Math.min(
      tones.length - 1,
      Math.floor(star.tone * tones.length),
    );
    const phaseIndex = Math.min(groups - 1, Math.floor(star.phase * groups));
    const key = `${bright ? 1 : 0}|${sizeClass}|${toneIndex}|${phaseIndex}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = {
        points: [],
        ink: tones[toneIndex],
        diameter: radius * 2,
        alpha,
        phase: (phaseIndex / groups) * Math.PI * 2,
        layer: bright ? "near" : "mid",
      };
      batches.set(key, batch);
    }
    batch.points.push({ x: ox + star.x, y: oy + star.y });
  };
  for (const star of skyStarField(
    input.seed,
    cover.width,
    cover.height,
    look.starCount,
  ))
    add(star, false);
  for (const star of skyStarField(
    input.seed + 1,
    cover.width,
    cover.height,
    look.brightStarCount,
  ))
    add(star, true);
  return { ...base, stars: [...batches.values()] };
}

/**
 * The overlay's inks: accent for the reorder outline, Polaris star and halo,
 * (38.7-11) the reticle (`orreryReticle`, which follows the user's accent,
 * D-18) and the occlusion dim (`orreryOcclusion`, D-55).
 */
export interface OverlayInk {
  accent: OrreryInk;
  textPrimary: OrreryInk;
  /** Polaris halo: the first star-palette colour (textPrimary when empty). */
  polarisHalo: OrreryInk;
  reticle: OrreryInk;
  occlusion: OrreryInk;
  /** 38.7-12 (D-23): the reorder hold's charge arc and armed outline (accent-following). */
  instrument: OrreryInk;
}
export interface OverlaySpec {
  ink: OverlayInk;
  /** The world extent Polaris sits beyond (`scene.extent`). */
  extent: number;
  /** D-51 blend family from the resolved mode: dark additive, light src-over. */
  additive: boolean;
}

export function buildOverlayInk(colors: ThemePalette): OverlayInk {
  return {
    accent: tokenInk(colors.accent),
    textPrimary: tokenInk(colors.textPrimary),
    polarisHalo: tokenInk(colors.starPalette[0] ?? colors.textPrimary),
    reticle: tokenInk(colors.orreryReticle),
    occlusion: tokenInk(colors.orreryOcclusion),
    instrument: tokenInk(colors.orreryInstrument),
  };
}

export const EMPTY_OVERLAY_SPEC: OverlaySpec = Object.freeze({
  ink: {
    accent: NO_INK,
    textPrimary: NO_INK,
    polarisHalo: NO_INK,
    reticle: NO_INK,
    occlusion: NO_INK,
    instrument: NO_INK,
  },
  extent: 1,
  additive: false,
});

// ── Bodies (38.7-07, D-43/D-53) ─────────────────────────────────────────────

/** Today's status-outline width around a contact disc (inner disc = r − this / 2). */
export const BODY_OUTLINE_WIDTH = 3;

/**
 * The picture layers that draw native objects: the body layers, the labels
 * layer, (38.7-08) the base layer when it draws a baked snapshot and
 * (38.7-09) the sky layer's baked neutral nebula. Each acks
 * `(layerId, generation, mountEpoch)` separately (H3 ledger contract).
 */
export const ORRERY_LAYER = {
  sky: "sky",
  base: "base",
  bodiesBehind: "bodiesBehind",
  sun: "sun",
  bodiesFront: "bodiesFront",
  labels: "labels",
} as const;
export type OrreryLayerId = (typeof ORRERY_LAYER)[keyof typeof ORRERY_LAYER];
export const ORRERY_BODY_LAYERS: readonly OrreryLayerId[] = [
  ORRERY_LAYER.bodiesBehind,
  ORRERY_LAYER.sun,
  ORRERY_LAYER.bodiesFront,
];

/**
 * The initials glyph metrics the text publisher keys on (the legacy contact
 * and sun body layout): font size ≈ the radius (cap height fits the disc; device-UAT
 * tunable, 13-08), quantised to 0.5 px so near-equal radii share one cached
 * Paragraph; the glyph is centred in the inner disc (contact) or the disc (sun).
 */
export function bodyInitialsLayout(
  kind: "contact" | "sun",
  radius: number,
): { fontSize: number; maxWidth: number } {
  return {
    fontSize: Math.round(radius * 2) / 2,
    maxWidth:
      kind === "sun"
        ? radius * 2
        : Math.max(1, radius - BODY_OUTLINE_WIDTH / 2) * 2,
  };
}

/**
 * 38.7-10 (D-13/D-14): a contact's lit-body material — Lab B's rim +
 * atmosphere status, lighter sun-lit faces. Numbers and inks only.
 */
export interface BodyLit {
  /** The crisp inner rim and Fresnel limb (status colour). */
  rimInk: OrreryInk;
  /** The atmosphere outside the disc (status colour). */
  glowInk: OrreryInk;
  /** The specular glint (`orreryRim`). */
  highlightInk: OrreryInk;
  floor: number;
  lightZ: number;
  wrap: number;
  /** Photo / swatch desaturation: > 0 only for decay and rogue. */
  desaturate: number;
  rimDp: number;
  rimStrength: number;
  fresnel: number;
  /** 0 = no atmosphere (rogue, never-contacted). */
  atmosphere: number;
  atmosphereAdditive: number;
  atmosphereReach: number;
  spec: number;
}

/** 38.7-10 (D-15): the star sun's inks (Lab A's corona and disc). */
export interface SunLook {
  /** The white-hot core (Lab A "starlight"): `orreryRingLight` on dark, `orreryGlow` on light. */
  starlightInk: OrreryInk;
  /** The light themes' chart "paper" core of the disc (`background`). */
  paperInk: OrreryInk;
  /** Light themes: Lab A's engraved chart corona. */
  chart: boolean;
  coronaAlpha: number;
  /** D-51: dark themes screen-blend the corona; light src-over. */
  additive: boolean;
}

/** Linear blend of two inks (`amount` 0 = a, 1 = b). */
function mixInk(a: OrreryInk, b: OrreryInk, amount: number): OrreryInk {
  if (!(amount > 0)) return a;
  const t = Math.min(1, amount);
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
  ];
}

/**
 * A contact's lit material for `status` in `mode`: Lab B's per-status
 * material (rogue: no atmosphere, cold `rogueExtinguished` rim), the mode's
 * rim + atmosphere look, the mode's face shading, and the decay/rogue
 * desaturation (no other status is ever desaturated).
 */
export function bodyLit(
  status: ProfileStatus | null,
  colors: ThemePalette,
  mode: ResolvedMode,
  face: FaceLight = FACE_LIGHT[mode],
): BodyLit {
  const look = BODY_LOOKS[mode];
  const material =
    status === null ? STATUS_MATERIALS.none : STATUS_MATERIALS[status];
  const statusInk = tokenInk(orreryRingStyle(status, colors).bodyFill);
  return {
    rimInk: mixInk(statusInk, tokenInk(colors.orreryRim), BODY_RIM_TOKEN_MIX),
    glowInk: mixInk(
      statusInk,
      tokenInk(colors.orreryGlow),
      BODY_GLOW_TOKEN_MIX,
    ),
    highlightInk: tokenInk(colors.orreryRim),
    floor: face.floor,
    lightZ: face.lightZ,
    wrap: face.wrap,
    desaturate:
      status === "decay"
        ? DECAY_DESATURATION
        : status === "rogue"
          ? ROGUE_DESATURATION
          : 0,
    rimDp: look.rimDp,
    rimStrength: look.rimStrength,
    fresnel: look.fresnel * material.fresnel,
    atmosphere: look.atmosphere * material.atmosphere,
    atmosphereAdditive: mode === "dark" ? look.atmosphereAdditive : 0,
    atmosphereReach: BODY_ATMOSPHERE_REACH,
    spec: look.spec * material.spec,
  };
}

/** The star sun's look in `mode` (D-15, D-51 blend family by mode). */
export function sunLook(colors: ThemePalette, mode: ResolvedMode): SunLook {
  return {
    starlightInk: tokenInk(
      mode === "dark" ? colors.orreryRingLight : colors.orreryGlow,
    ),
    paperInk: tokenInk(colors.background),
    chart: mode === "light",
    coronaAlpha: SUN_CORONA_ALPHA[mode],
    additive: mode === "dark",
  };
}

/**
 * One body's static look (no native objects): rebuilt on resource, theme or
 * focus change only, never per frame.
 */
export interface OrreryBodyLook {
  /** Body key (`bodyKey`): the frame body it draws at. */
  key: string;
  kind: "contact" | "sun" | "satellite";
  /** World radius: the frame's projected radius / this = the billboard scale. */
  worldRadius: number;
  /** Contact: status body fill (outline). Sun: occupant glow. Moon: its disc. */
  outlineInk: OrreryInk;
  /** The fallback swatch behind the initials (contact, sun). */
  swatchInk: OrreryInk;
  /**
   * The photo key (relative path) the body shows, or null (initials only).
   * Always null for the star sun (D-15, owner G-SUN 2026-10-03).
   */
  photoKey: string | null;
  /** Initials glyph font size (body-local px; `bodyInitialsLayout`). */
  initialsFontSize: number;
  /** 38.7-10 (D-31): the moon ink (`textSecondary`) a parent's bump is drawn in. */
  moonInk: OrreryInk;
  /** 38.7-10 (D-13/D-14): a contact's lit material; absent → today's flat body. */
  lit?: BodyLit;
  /** 38.7-10 (D-15): the sun's star look; absent → today's glow sun. */
  sun?: SunLook;
  /** 38.7-10 (D-54): a contact's ring status ink — its pip colour when hidden. */
  ringInk?: OrreryInk;
  /** 38.7-10 (D-54): the dark plate behind a pip (`orrerySkyBase`). */
  pipPlateInk?: OrreryInk;
}

/** A body's spec: its look plus the native objects its picture draws. */
export interface OrreryBodySpec extends OrreryBodyLook {
  /** From OrreryTextService only (D-52); null → the plain swatch disc. */
  initials: PreparedOrreryText | null;
  /** From the shared photo cache only (D-53); null → swatch + initials. */
  photo: SkImage | null;
}

/** What the body layers (`bodiesBehind`, `sun`, `bodiesFront`) read. */
export interface OrreryBodySpecs {
  /** The shared spec generation (0 = nothing published yet). */
  generation: number;
  /** The ledger epoch this generation belongs to. */
  mountEpoch: number;
  /** Source order: resources (contacts and the sun), then moons. */
  bodies: readonly OrreryBodySpec[];
}
export const EMPTY_BODY_SPECS: OrreryBodySpecs = Object.freeze({
  generation: 0,
  mountEpoch: 0,
  bodies: Object.freeze([]) as readonly OrreryBodySpec[],
});

type SceneContact = OrreryBodyResource["scene"]["contacts"][number];
const contactsById = new WeakMap<
  OrreryBodyResource["scene"],
  ReadonlyMap<number, SceneContact>
>();
/** First row per id (what the legacy `find` returned), indexed once per scene. */
function contactOf(resource: OrreryBodyResource): SceneContact | undefined {
  let index = contactsById.get(resource.scene);
  if (!index) {
    const built = new Map<number, SceneContact>();
    for (const row of resource.scene.contacts)
      if (!built.has(row.id)) built.set(row.id, row);
    contactsById.set(resource.scene, built);
    index = built;
  }
  return index.get(resource.body.id);
}

/** The name a body's swatch and initials derive from, and its photo path. */
export function bodyIdentity(
  resource: OrreryBodyResource,
  colors: ThemePalette,
): { name: string; photo: string | null; glowColor: string | null } {
  const { body, scene } = resource;
  if (body.kind === "sun") {
    const resolved = resolveSunOccupant({
      ...scene.sun,
      starPalette: colors.starPalette,
      colors,
    });
    return {
      name:
        (resolved.kind === "self"
          ? scene.sun.selfName
          : scene.sun.sunContactName) ?? "",
      photo: resolved.photo,
      glowColor: resolved.glowColor,
    };
  }
  const contact = contactOf(resource);
  return {
    name: contact?.name ?? "",
    photo: contact?.photo ?? null,
    glowColor: null,
  };
}

/**
 * Today's body look per resource (the legacy contact and sun bodies): the status body fill
 * as the outline, `avatarSwatches[swatchIndex(name)]` behind the initials, the
 * sun's resolved glow. Every colour is a theme token resolved to RGBA here.
 */
export function buildBodyLooks(
  resources: readonly OrreryBodyResource[],
  colors: ThemePalette,
  /** 38.7-10: the resolved mode → the V2 lit bodies and star sun; absent → today's look. */
  mode?: ResolvedMode,
): OrreryBodyLook[] {
  const out: OrreryBodyLook[] = [];
  const sun = mode ? sunLook(colors, mode) : undefined;
  const pipPlateInk = tokenInk(colors.orrerySkyBase);
  const swatchOf = (name: string) =>
    tokenInk(
      colors.avatarSwatches[swatchIndex(name, colors.avatarSwatches.length)],
    );
  const moonInk = tokenInk(colors.textSecondary);
  for (const resource of resources) {
    const { body } = resource;
    if (body.kind === "satellite") continue;
    const identity = bodyIdentity(resource, colors);
    const kind = body.kind === "sun" ? "sun" : "contact";
    const status =
      kind === "contact" ? (contactOf(resource)?.status ?? null) : null;
    const style = kind === "contact" ? orreryRingStyle(status, colors) : null;
    out.push({
      key: resource.key,
      kind,
      worldRadius: body.radius,
      outlineInk: style
        ? tokenInk(style.bodyFill)
        : tokenInk(identity.glowColor ?? colors.border),
      swatchInk: swatchOf(identity.name),
      // Owner G-SUN (2026-10-03, 38.7-10, D-15): the sun body is always
      // Lab A's star — the occupant's photo is never painted on it (nor
      // loaded for it). The photo still shows on the focus card, Profile
      // and lists, which do not read these looks.
      photoKey: kind === "sun" && sun ? null : identity.photo,
      initialsFontSize: bodyInitialsLayout(kind, body.radius).fontSize,
      moonInk,
      ...(style
        ? {
            ringInk: tokenInk(style.color),
            pipPlateInk,
            ...(mode ? { lit: bodyLit(status, colors, mode) } : {}),
          }
        : sun
          ? { sun }
          : {}),
    });
  }
  return out;
}

/**
 * D-53: the photo cache request for a set of body looks — one entry per photo
 * key, ranked focused first, then visible bodies largest first, then the rest
 * in source order. `visibility` null (not reported yet) treats every body as
 * visible. Bodies that share a photo share one entry (their best rank).
 */
export function buildPhotoRequests(
  looks: readonly OrreryBodyLook[],
  focusedKeys: ReadonlySet<string>,
  visibility: OrreryTextVisibility | null,
): OrreryPhotoRequest[] {
  const visible = visibility?.visible ? new Set(visibility.visible) : null;
  const radius = new Map<string, number>();
  for (const item of visibility?.eligible ?? [])
    radius.set(item.key, item.radius);
  const ranked = looks
    .map((look, order) => ({
      look,
      order,
      focused: focusedKeys.has(look.key),
      visible: !visible || visible.has(look.key),
      radius: radius.get(look.key) ?? 0,
    }))
    .filter((item) => item.look.photoKey !== null)
    .sort(
      (a, b) =>
        Number(b.focused) - Number(a.focused) ||
        Number(b.visible) - Number(a.visible) ||
        (a.visible && b.visible ? b.radius - a.radius : 0) ||
        a.order - b.order,
    );
  const out = new Map<string, OrreryPhotoRequest>();
  ranked.forEach((item, priority) => {
    const key = item.look.photoKey as string;
    if (out.has(key)) return;
    out.set(key, {
      key,
      relativePath: key,
      priority,
      focused: item.focused,
      visible: item.visible,
    });
  });
  return [...out.values()];
}

/**
 * Today's moons (the legacy satellite body): a unit disc in `textSecondary`.
 * One look per drawn satellite row, keyed like the frame's moon bodies. A
 * focused moon carries the overlay reticle (38.7-11, D-18), not a ring.
 */
export function buildSatelliteLooks(
  satellites: readonly OrrerySatellite[],
  colors: ThemePalette,
): OrreryBodyLook[] {
  const ink = tokenInk(colors.textSecondary);
  return satellites.map((row) => {
    const target = {
      kind: "satellite" as const,
      uid: row.uid,
      parentId: row.parentId,
      parentUid: row.parentUid,
    };
    return {
      key: bodyKey({ kind: "satellite", id: -1, satelliteTarget: target }),
      kind: "satellite" as const,
      worldRadius: 1,
      outlineInk: ink,
      swatchInk: ink,
      photoKey: null,
      initialsFontSize: 0,
      moonInk: ink,
    };
  });
}

// ── Labels (38.7-07 Task 2) ──────────────────────────────────────────────────

/** What the `labels` picture reads: Paragraphs from OrreryTextService only. */
export interface OrreryLabelLayerSpecs {
  /** The shared spec generation (0 = nothing published yet). */
  generation: number;
  mountEpoch: number;
  /** Body key → the prepared label and its context caption (detail tier). */
  labels: OrreryLabelSpec["labels"];
  /** The allocation input, in draw order (only admitted labels). */
  measured: readonly OrreryMeasuredLabel[];
  /** The backplate (today's `colors.surface`). */
  plateInk: OrreryInk;
}
export const EMPTY_LABEL_LAYER_SPECS: OrreryLabelLayerSpecs = Object.freeze({
  generation: 0,
  mountEpoch: 0,
  labels: Object.freeze({}),
  measured: Object.freeze([]) as readonly OrreryMeasuredLabel[],
  plateInk: NO_INK,
});

/** Ledger handles: a separator that never occurs in a key or number. */
const HANDLE_SEPARATOR = "\u0001";
/** The ledger handle of a photo image (its cache epoch travels with it). */
export function photoHandle(photoEpoch: number, id: number): string {
  return `p${HANDLE_SEPARATOR}${photoEpoch}${HANDLE_SEPARATOR}${id}`;
}
/** The ledger handle of a text-service entry (its owner epoch travels with it). */
export function textHandle(textEpoch: number, key: string): string {
  return `t${HANDLE_SEPARATOR}${textEpoch}${HANDLE_SEPARATOR}${key}`;
}
/** 38.7-08: the ledger handle of a baked base snapshot (its mount epoch travels with it). */
export function baseHandle(mountEpoch: number, id: number): string {
  return `b${HANDLE_SEPARATOR}${mountEpoch}${HANDLE_SEPARATOR}${id}`;
}
/** 38.7-09: the ledger handle of a baked sky image (its mount epoch travels with it). */
export function skyHandle(mountEpoch: number, id: number): string {
  return `s${HANDLE_SEPARATOR}${mountEpoch}${HANDLE_SEPARATOR}${id}`;
}
export type OrreryLedgerHandle =
  | { kind: "photo"; epoch: number; id: number }
  | { kind: "text"; epoch: number; key: string }
  | { kind: "base"; epoch: number; id: number }
  | { kind: "sky"; epoch: number; id: number };
export function parseLedgerHandle(handle: string): OrreryLedgerHandle | null {
  const first = handle.indexOf(HANDLE_SEPARATOR);
  const second = handle.indexOf(HANDLE_SEPARATOR, first + 1);
  if (first !== 1 || second < 0) return null;
  const epoch = Number(handle.slice(first + 1, second));
  const rest = handle.slice(second + 1);
  if (handle[0] === "p") return { kind: "photo", epoch, id: Number(rest) };
  if (handle[0] === "t") return { kind: "text", epoch, key: rest };
  if (handle[0] === "b") return { kind: "base", epoch, id: Number(rest) };
  if (handle[0] === "s") return { kind: "sky", epoch, id: Number(rest) };
  return null;
}

export interface OrrerySpecPublisherOptions {
  /** The H3 ledger every native object the specs reference is tracked by. */
  ledger: OrreryGenerationLedger<string>;
  /** Writes the body specs SharedValue (never React state). */
  writeBodies: (specs: OrreryBodySpecs) => void;
  /** Writes the label specs SharedValue (never React state). */
  writeLabels?: (specs: OrreryLabelLayerSpecs) => void;
}

export interface OrrerySpecPublisher {
  /** Resource / theme / focus change: the static looks. */
  setLooks(looks: readonly OrreryBodyLook[]): void;
  /** The text publisher's initials spec (body key → Paragraph, its cache keys). */
  setInitials(spec: OrreryInitialsSpec): void;
  /** The text publisher's label spec (labels, captions and their measurements). */
  setLabels(spec: OrreryLabelSpec): void;
  /** Theme change: the label backplate ink. */
  setLabelPlate(ink: OrreryInk): void;
  /** The photo cache's drawn photos for this owner, tagged with its epoch. */
  setPhotos(
    photos: ReadonlyMap<string, OrreryDrawnPhoto>,
    photoEpoch: number,
  ): void;
  /**
   * 38.7-09: the current publishing epoch, begun now if none is (the sky bake
   * owner tags its images with it before any body spec was published).
   */
  ensureEpoch(): number;
  /** Ends the publishing epoch now (unmount); returns it for the later teardown. */
  detach(): number | null;
  generation(): number;
  epoch(): number | null;
}

/**
 * 38.7-07 (D-43/H3): the JS-thread spec publisher. It composes the body looks
 * with the native objects (initials Paragraphs, photo SkImages) into one
 * immutable spec array, writes it with a monotonically increasing shared
 * generation, and tells the ledger which native objects that generation
 * references for which layers. A photo arriving republishes the specs without
 * any React state change; an unchanged input writes nothing.
 */
export function createOrrerySpecPublisher(
  options: OrrerySpecPublisherOptions,
): OrrerySpecPublisher {
  const { ledger, writeBodies, writeLabels } = options;
  let looks: readonly OrreryBodyLook[] = [];
  let initials: Readonly<Record<string, PreparedOrreryText | null>> = {};
  let initialsHandles: readonly string[] = [];
  let labelSpec: OrreryLabelSpec | null = null;
  let plateInk: OrreryInk = NO_INK;
  let photos: ReadonlyMap<string, OrreryDrawnPhoto> = new Map();
  let photoEpoch = 0;
  let generation = 0;
  let epoch: number | null = null;
  let published: readonly OrreryBodySpec[] | null = null;
  let publishedLooks: readonly OrreryBodyLook[] | null = null;

  function publishBodies(): void {
    const bodies: OrreryBodySpec[] = [];
    const handles = new Set<string>();
    let same =
      published !== null &&
      publishedLooks === looks &&
      published.length === looks.length;
    for (const handle of initialsHandles) handles.add(handle);
    for (let i = 0; i < looks.length; i++) {
      const look = looks[i];
      const drawn =
        look.photoKey === null ? undefined : photos.get(look.photoKey);
      const spec: OrreryBodySpec = {
        ...look,
        initials: initials[look.key] ?? null,
        photo: drawn?.image ?? null,
      };
      if (drawn) handles.add(photoHandle(photoEpoch, drawn.id));
      if (
        same &&
        (published?.[i]?.photo !== spec.photo ||
          published?.[i]?.initials !== spec.initials)
      )
        same = false;
      bodies.push(spec);
    }
    if (same) return;
    if (epoch === null) epoch = ledger.beginEpoch();
    generation++;
    published = bodies;
    publishedLooks = looks;
    ledger.publish(generation, ORRERY_BODY_LAYERS, handles);
    writeBodies({ generation, mountEpoch: epoch, bodies });
  }

  function publishLabels(): void {
    if (!writeLabels || !labelSpec) return;
    if (epoch === null) epoch = ledger.beginEpoch();
    generation++;
    const textEpoch = labelSpec.mountEpoch;
    ledger.publish(
      generation,
      [ORRERY_LAYER.labels],
      labelSpec.keys.map((key) => textHandle(textEpoch, key)),
    );
    writeLabels({
      generation,
      mountEpoch: epoch,
      labels: labelSpec.labels,
      measured: labelSpec.measured,
      plateInk,
    });
  }

  return {
    setLooks(next) {
      looks = next;
      publishBodies();
    },
    setInitials(next) {
      initials = next.initials;
      initialsHandles = next.keys.map((key) =>
        textHandle(next.mountEpoch, key),
      );
      // Always a new generation: the text epoch in the handles may change
      // even when every Paragraph is reused from the cache (a remount).
      publishedLooks = null;
      publishBodies();
    },
    setLabels(next) {
      labelSpec = next;
      publishLabels();
    },
    setLabelPlate(ink) {
      if (
        ink[0] === plateInk[0] &&
        ink[1] === plateInk[1] &&
        ink[2] === plateInk[2] &&
        ink[3] === plateInk[3]
      )
        return;
      plateInk = ink;
      publishLabels();
    },
    setPhotos(next, nextEpoch) {
      photos = next;
      photoEpoch = nextEpoch;
      publishBodies();
    },
    ensureEpoch() {
      if (epoch === null) epoch = ledger.beginEpoch();
      return epoch;
    },
    detach() {
      const ended = epoch;
      epoch = null;
      published = null;
      publishedLooks = null;
      labelSpec = null;
      initials = {};
      initialsHandles = [];
      return ended;
    },
    generation: () => generation,
    epoch: () => epoch,
  };
}
