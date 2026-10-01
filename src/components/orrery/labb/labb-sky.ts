/**
 * ORRERY LAB B — L0 sky math (worklets + pure star-field generation).
 *
 * PARALLAX SOURCE (research 03 §0.3): during a System switch `pose.value` is
 * NOT the displayed camera — the frame worklet samples
 * `sampleOrrerySwitchCamera(cameraFrom, cameraTo, progress)`. Every sky helper
 * therefore takes the ANIMATED FRAME only (`frame.pose`, `frame.center`,
 * `frame.viewport`) and never a pose SharedValue, so the sky follows the
 * sampled camera through every switch.
 *
 * Model (one rule for the nebula and every star layer):
 * - pan / zoom: the world's on-screen motion is `frame.center` (the sun's
 *   projection) relative to the viewport centre; a layer at depth factor `f`
 *   moves `f ×` that (far layers barely move, near layers more);
 * - zoom: a layer scales by `zoom^(f · ZOOM_DEPTH)` about the viewport centre
 *   (pinching in pushes you INTO the cloud; near stars fly apart);
 * - yaw: the whole sky rotates with the world about the viewport centre (a
 *   camera roll has no parallax);
 * - tilt: layers shift vertically by depth (an artistic pitch cue).
 *
 * Hermes rule: helpers are declared ABOVE their worklet callers.
 */
import type { AnimatedFrame } from "@/logic/orrery-frame";

// --- Tunables -----------------------------------------------------------------
/** Zoom-scale exponent multiplier per unit depth factor (nebula f=0.06 → ~1+0.08·ln z). */
export const SKY_ZOOM_DEPTH = 1.3;
/** Vertical sky shift at full tilt (dp), scaled by (TILT_BASE + factor). */
export const SKY_TILT_SHIFT = 140;
export const SKY_TILT_BASE = 0.25;
/** Nebula depth factor (moves 6% of the world's screen motion). */
export const NEBULA_FACTOR = 0.06;

export interface LabSkyPose {
  /** Sun (world origin) on screen. */
  cx: number;
  cy: number;
  /** Viewport centre: the sky's rotation / zoom pivot. */
  vx: number;
  vy: number;
  zoom: number;
  yaw: number;
  tilt: number;
}

/** The DISPLAYED camera, read from the animated frame (never `pose.value`). */
export function labSkyPose(frame: AnimatedFrame): LabSkyPose {
  "worklet";
  const vp = frame.viewport;
  const p = frame.pose;
  return {
    cx: frame.center.x,
    cy: frame.center.y,
    vx: vp.width / 2,
    vy: vp.height / 2,
    zoom: p.zoom > 0 ? p.zoom : 1,
    yaw: p.yaw ?? 0,
    tilt: p.tilt ?? 0,
  };
}

export interface LabSkyPlacement {
  /** Screen-space offset of the layer (dp). */
  ox: number;
  oy: number;
  /** Zoom scale about the viewport centre. */
  zs: number;
  /** cos / sin of the sky rotation (yaw). */
  c: number;
  s: number;
}

const STILL: LabSkyPlacement = { ox: 0, oy: 0, zs: 1, c: 1, s: 0 };

/** Placement of one depth layer for the displayed camera (identity when parallax is off). */
export function skyLayerPlacement(
  sky: LabSkyPose,
  factor: number,
  parallax: boolean,
): LabSkyPlacement {
  "worklet";
  if (!parallax) return STILL;
  return {
    ox: (sky.cx - sky.vx) * factor,
    oy:
      (sky.cy - sky.vy) * factor +
      Math.sin(sky.tilt) * SKY_TILT_SHIFT * (SKY_TILT_BASE + factor),
    zs: Math.exp(Math.log(sky.zoom) * factor * SKY_ZOOM_DEPTH),
    c: Math.cos(sky.yaw),
    s: Math.sin(sky.yaw),
  };
}

/**
 * Screen position of a star whose sky-space base position is (bx, by) in a
 * square wrap tile of side `tile`.
 */
export function placeSkyPoint(
  bx: number,
  by: number,
  tile: number,
  place: LabSkyPlacement,
  vx: number,
  vy: number,
): { x: number; y: number } {
  "worklet";
  // The offset is screen-space: un-rotate it into sky space before wrapping.
  const ux = place.c * place.ox + place.s * place.oy;
  const uy = -place.s * place.ox + place.c * place.oy;
  let lx = (bx + ux) % tile;
  if (lx < 0) lx += tile;
  let ly = (by + uy) % tile;
  if (ly < 0) ly += tile;
  lx = (lx - tile / 2) * place.zs;
  ly = (ly - tile / 2) * place.zs;
  return {
    x: vx + place.c * lx - place.s * ly,
    y: vy + place.s * lx + place.c * ly,
  };
}

// --- Star-field generation (plain JS, deterministic; Hermes has no crypto) ----

/** Sprite cells in the star atlas texture. */
export const STAR_CELL_SOFT = 0;
export const STAR_CELL_DOT = 1;
export const STAR_CELL_SPIKE = 2;

export interface LabStarLayerSpec {
  /** Stars per layer at density 1. */
  count: number;
  /** Parallax depth factor. */
  factor: number;
  /** Displayed diameter range (dp). */
  sizeMin: number;
  sizeMax: number;
  alphaMin: number;
  alphaMax: number;
  /** Twinkle weight (0 = none). */
  twinkle: number;
  /** Fraction of stars drawn with the diffraction-spike sprite. */
  spikes: number;
}

/** Per-star record stride in the flat field array. */
export const STAR_STRIDE = 10;
/** Field offsets. */
export const S_X = 0;
export const S_Y = 1;
export const S_SIZE = 2;
export const S_ALPHA = 3;
export const S_TONE = 4;
export const S_CELL = 5;
export const S_PHASE = 6;
export const S_SPEED = 7;
export const S_RANK = 8;
export const S_LAYER = 9;

export function seeded(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Square wrap tile for a layer: big enough that, after the most extreme zoom
 * scale-down (MIN_ZOOM) and any rotation, the tile still covers the viewport
 * diagonal (no empty corners).
 */
export function starTileSize(
  width: number,
  height: number,
  factor: number,
  minZoom: number,
): number {
  const diag = Math.hypot(width, height);
  const minScale = Math.exp(Math.log(minZoom) * factor * SKY_ZOOM_DEPTH);
  return Math.ceil((diag * 1.05) / minScale);
}

/**
 * Build a flat star field (STAR_STRIDE numbers per star) for the given
 * layers. `tones` = number of colour tones; tone 0..neutralTones-1 are the
 * neutral text tones, the rest are starPalette tints (`tint` fraction).
 */
export function buildStarField(
  layers: readonly LabStarLayerSpec[],
  tiles: readonly number[],
  neutralTones: number,
  tintTones: number,
  tint: number,
  seed: number,
): number[] {
  const out: number[] = [];
  let n = 0;
  layers.forEach((layer, li) => {
    const tile = tiles[li] ?? 1;
    for (let i = 0; i < layer.count; i++) {
      const k = seed + li * 10007 + i * 7;
      const sizeT = seeded(k + 3) ** 2.2; // many small, few large
      const tinted = tintTones > 0 && seeded(k + 4) < tint;
      const tone = tinted
        ? neutralTones + Math.floor(seeded(k + 5) * tintTones)
        : Math.floor(seeded(k + 5) * neutralTones);
      const spike = seeded(k + 6) < layer.spikes;
      out.push(
        seeded(k + 1) * tile,
        seeded(k + 2) * tile,
        layer.sizeMin + sizeT * (layer.sizeMax - layer.sizeMin),
        layer.alphaMin + seeded(k + 8) * (layer.alphaMax - layer.alphaMin),
        tone,
        spike ? STAR_CELL_SPIKE : STAR_CELL_SOFT,
        seeded(k + 9) * Math.PI * 2,
        (0.6 + seeded(k + 10) * 1.4) * layer.twinkle,
        seeded(k + 11),
        li,
      );
      n++;
    }
  });
  return n > 0 ? out : [];
}
