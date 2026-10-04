/**
 * 38.7-11 (D-19/D-47/D-60, harvested from Lab C's focus-card layout and focus
 * loop): where the focus card docks, how a single focus is framed above it,
 * and how a cluster tap zooms into the cluster.
 *
 * - `focusCardPlacement`: the card DOCKS at the canvas bottom, left of the
 *   side-controls column, horizontally near the focused body and clamped to
 *   the usable rect. It is never a camera obstacle (C-M2): the card's space
 *   reaches the camera only through `focusFramingPose`'s explicit card-rect
 *   argument, so a card that moves can never move its own framing.
 * - `focusFramingPose`: the focused person centred, large, in the space above
 *   the card, with their moons inside that space. Zoom grows until the body
 *   reaches FOCUS_TARGET_PX on screen or the frame would no longer fit, up to
 *   MAX_ZOOM — no IDENTITY_ZOOM cap (D-47).
 * - `clusterZoomPose`: a tapped cluster is centred and zoomed until its
 *   closest pair separates on screen (or it would no longer fit), never below
 *   today's `frameBodies` zoom (D-19).
 *
 * Horizon safety (H2): every projection goes through the non-throwing
 * primitives (`tryProjectWithBasis`, `basisPerspectiveScale`,
 * `tryUnprojectToWorldPlane`, `frameBodies`). A trial pose that puts the body,
 * a moon or a member beyond the horizon does not fit; when no safe pose exists
 * the result is null and the caller keeps its current pose.
 *
 * Every function is a worklet (the card placement runs in a UI-thread derived
 * value). Helpers are defined above their callers (Hermes forward-ref rule).
 */
import {
  basisPerspectiveScale,
  type CameraPose,
  type CameraRect,
  type CameraViewport,
  clampCameraPose,
  frameBodies,
  MAX_ZOOM,
  MIN_HIT_RADIUS,
  MIN_ZOOM,
  projectedBodyRadius,
  projectionBasis,
  tryProjectWithBasis,
  tryUnprojectToWorldPlane,
  usableCameraRect,
  type WorldBody,
  type WorldPoint,
  worldExtent,
} from "./orrery-camera-logic";

// ── Tunables (Lab C `orrery-focus-card-layout.ts` values as the start) ─────

/** Right-hand controls + FAB column the docked card clears (dp, Lab C). */
export const FOCUS_CARD_SIDE_RESERVE = 92;
/** Gap between the docked card and the canvas bottom (dp, Lab C). */
export const FOCUS_CARD_BOTTOM_GAP = 8;
/** The card's widest width (dp, Lab C and today). */
export const FOCUS_CARD_MAX_WIDTH = 280;
/** Below this, the side reserve is dropped (a very narrow canvas). */
export const FOCUS_CARD_MIN_WIDTH = 160;
/** The card's height before its first layout (today's estimate). */
export const FOCUS_CARD_ESTIMATED_HEIGHT = 180;
/** Projected body diameter a single focus zooms toward (dp). */
export const FOCUS_TARGET_PX = 120;
/** Clear space kept between the framed person (and moons) and the card / top. */
export const FOCUS_FRAME_GAP = 12;
/** C3-M1: a measured card height this far from the framed one re-frames once. */
export const FOCUS_CARD_REFIT_PX = 8;
/** D-19: a cluster zooms until its closest pair is this far apart (dp). */
export const CLUSTER_SEPARATION_PX = 2.2 * MIN_HIT_RADIUS;

/** Pivot-centring iterations (perspective makes the move non-linear). */
const CENTRE_ITERATIONS = 24;
/** Zoom bisection steps. */
const BISECT_STEPS = 32;
/** Sub-pixel tolerance for "fits" and "centred". */
const EPSILON = 1e-6;

/** Where the card sits (canvas coordinates); `visible: false` = not drawn. */
export interface FocusCardRect extends CameraRect {
  visible: boolean;
  /** The card's maximum height (half the usable rect, as today). */
  maxHeight: number;
}
export const HIDDEN_FOCUS_CARD: FocusCardRect = Object.freeze({
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  maxHeight: 0,
  visible: false,
});

/** The frame body a card follows (any projected body shape). */
export interface FocusCardBody {
  x: number;
  y: number;
  radius: number;
  culled?: boolean;
  visible?: boolean;
}

/**
 * The docked card for a card of measured `height` whose body is at screen x
 * `bodyX`. Pure geometry; hidden when the canvas has no usable rect.
 */
export function focusCardDock(
  viewport: CameraViewport,
  bodyX: number,
  height: number,
): FocusCardRect {
  "worklet";
  const region = usableCameraRect(viewport);
  if (!region || !Number.isFinite(bodyX)) return HIDDEN_FOCUS_CARD;
  const reserved = viewport.width - FOCUS_CARD_SIDE_RESERVE - region.x;
  const width = Math.min(
    FOCUS_CARD_MAX_WIDTH,
    region.width,
    reserved >= FOCUS_CARD_MIN_WIDTH ? reserved : region.width,
  );
  const maxHeight = region.height / 2;
  const measured =
    Number.isFinite(height) && height > 0
      ? height
      : FOCUS_CARD_ESTIMATED_HEIGHT;
  const limit = Math.min(measured, maxHeight);
  const rightmost = Math.min(
    region.x + region.width - width,
    reserved >= FOCUS_CARD_MIN_WIDTH
      ? viewport.width - FOCUS_CARD_SIDE_RESERVE - width
      : region.x + region.width - width,
  );
  const left = Math.max(region.x, Math.min(rightmost, bodyX - width / 2));
  const top = Math.max(
    region.y,
    viewport.height - FOCUS_CARD_BOTTOM_GAP - limit,
  );
  return {
    x: left,
    y: top,
    width,
    height: limit,
    maxHeight,
    visible: true,
  };
}

/**
 * D-19: the card docked below the focused body. Hidden when the body is
 * missing, culled (beyond the horizon), not visible or has no radius.
 */
export function focusCardPlacement(
  viewport: CameraViewport,
  body: FocusCardBody | null | undefined,
  height: number,
): FocusCardRect {
  "worklet";
  if (
    !body ||
    body.culled === true ||
    body.visible === false ||
    !(body.radius > 0) ||
    !Number.isFinite(body.x) ||
    !Number.isFinite(body.y)
  )
    return HIDDEN_FOCUS_CARD;
  return focusCardDock(viewport, body.x, height);
}

/**
 * The card rect a focus framing reserves before the camera has moved: the
 * docked card for the last measured height, as if the body were already at
 * the usable centre (only its top matters to the framing).
 */
export function expectedFocusCardRect(
  viewport: CameraViewport,
  height: number,
): FocusCardRect {
  "worklet";
  const region = usableCameraRect(viewport);
  if (!region) return HIDDEN_FOCUS_CARD;
  return focusCardDock(viewport, region.x + region.width / 2, height);
}

/** A projected disc: screen centre and drawn radius. */
interface Disc {
  x: number;
  y: number;
  r: number;
}

/**
 * Every body's projected disc under `pose` (one basis), or null when any of
 * them is beyond the horizon.
 */
function projectDiscs(
  world: readonly WorldBody[],
  pose: CameraPose,
  viewport: CameraViewport,
): Disc[] | null {
  "worklet";
  const basis = projectionBasis(pose, viewport);
  const shortSide = Math.min(viewport.width, viewport.height);
  const discs: Disc[] = [];
  for (let i = 0; i < world.length; i++) {
    const body = world[i];
    const point = tryProjectWithBasis(basis, body.x, body.y);
    const scale = basisPerspectiveScale(basis, body.x, body.y);
    if (!point || scale === null) return null;
    discs.push({
      x: point.x,
      y: point.y,
      r: projectedBodyRadius(
        body.kind,
        body.radius,
        pose.zoom,
        scale,
        shortSide,
      ),
    });
  }
  return discs;
}

/**
 * Moves the pivot of `pose` so that `anchor(pose)` lands on screen point
 * `want`. Null when the anchor or a needed unprojection is beyond the horizon.
 */
function centreOn(
  pose: CameraPose,
  want: WorldPoint,
  viewport: CameraViewport,
  bound: number,
  anchor: (pose: CameraPose) => WorldPoint | null,
): CameraPose | null {
  "worklet";
  let current = pose;
  for (let i = 0; i < CENTRE_ITERATIONS; i++) {
    const at = anchor(current);
    if (!at) return null;
    if (Math.hypot(at.x - want.x, at.y - want.y) < 1e-4) return current;
    const target = tryUnprojectToWorldPlane(at, current, viewport);
    const here = tryUnprojectToWorldPlane(want, current, viewport);
    if (!target || !here) return null;
    current = clampCameraPose(
      {
        ...current,
        x: current.x + target.x - here.x,
        y: current.y + target.y - here.y,
      },
      bound,
    );
  }
  return anchor(current) ? current : null;
}

/** True when every disc lies inside `rect` (sub-pixel tolerance). */
function discsInside(discs: readonly Disc[], rect: CameraRect): boolean {
  "worklet";
  for (let i = 0; i < discs.length; i++) {
    const d = discs[i];
    if (
      d.x - d.r < rect.x - EPSILON ||
      d.x + d.r > rect.x + rect.width + EPSILON ||
      d.y - d.r < rect.y - EPSILON ||
      d.y + d.r > rect.y + rect.height + EPSILON
    )
      return false;
  }
  return true;
}

/** The highest zoom in [low, high] for which `ok` holds (ok(low) assumed). */
function bisect(
  low: number,
  high: number,
  ok: (zoom: number) => boolean,
): number {
  "worklet";
  let lo = low,
    hi = high;
  for (let i = 0; i < BISECT_STEPS; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * The region a single focus is framed in: the usable rect above the card
 * (FOCUS_FRAME_GAP clear of the card and the edges). Falls back to the whole
 * usable rect when the card leaves too little room.
 */
export function focusFramingRegion(
  viewport: CameraViewport,
  cardRect: CameraRect | null,
): CameraRect | null {
  "worklet";
  const usable = usableCameraRect(viewport);
  if (!usable) return null;
  const top = usable.y + FOCUS_FRAME_GAP;
  const cardTop =
    cardRect && cardRect.height > 0 && Number.isFinite(cardRect.y)
      ? Math.min(usable.y + usable.height, cardRect.y)
      : usable.y + usable.height;
  const bottom = cardTop - FOCUS_FRAME_GAP;
  const left = usable.x + FOCUS_FRAME_GAP;
  const right = usable.x + usable.width - FOCUS_FRAME_GAP;
  if (bottom - top < 2 * MIN_HIT_RADIUS || right - left < 2 * MIN_HIT_RADIUS)
    return usable;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * D-19/D-47: a pose (current yaw, tilt and lens shift kept) that centres
 * `body` in the region above `cardRect` and zooms until its projected
 * diameter reaches FOCUS_TARGET_PX or it and its `moons` would no longer fit
 * that region, bounded by MAX_ZOOM. Null when the canvas is unmeasured, the
 * body is invalid, or no trial pose keeps everything in front of the horizon.
 * At a tiny viewport where nothing fits, the minimum-zoom centred pose.
 */
export function focusFramingPose(
  body: WorldBody,
  moons: readonly WorldBody[],
  viewport: CameraViewport,
  cardRect: CameraRect | null,
  pose: CameraPose,
  extent: number,
): CameraPose | null {
  "worklet";
  const region = focusFramingRegion(viewport, cardRect);
  if (
    !region ||
    ![body.x, body.y, body.radius].every(Number.isFinite) ||
    !(body.radius > 0)
  )
    return null;
  const alone: WorldBody[] = [body];
  const world: WorldBody[] = [body];
  for (let i = 0; i < moons.length; i++) world.push(moons[i]);
  const bound = Math.max(
    Number.isFinite(extent) ? extent : 1,
    worldExtent(world),
  );
  const want = {
    x: region.x + region.width / 2,
    y: region.y + region.height / 2,
  };
  const candidate = (zoom: number) => {
    "worklet";
    const start = clampCameraPose(
      { ...pose, zoom, x: body.x, y: body.y },
      bound,
    );
    const centred = centreOn(start, want, viewport, bound, (p) => {
      "worklet";
      const discs = projectDiscs(alone, p, viewport);
      return discs ? { x: discs[0].x, y: discs[0].y } : null;
    });
    if (!centred) return null;
    const discs = projectDiscs(world, centred, viewport);
    if (!discs)
      return { pose: centred, fits: false, diameter: Number.POSITIVE_INFINITY };
    return {
      pose: centred,
      fits: discsInside(discs, region),
      diameter: discs[0].r * 2,
    };
  };
  const ok = (zoom: number) => {
    "worklet";
    const c = candidate(zoom);
    return !!c && c.fits && c.diameter <= FOCUS_TARGET_PX;
  };
  const lowest = candidate(MIN_ZOOM);
  if (!lowest) return null;
  if (!ok(MIN_ZOOM)) return lowest.pose;
  if (ok(MAX_ZOOM)) return candidate(MAX_ZOOM)?.pose ?? lowest.pose;
  const zoom = bisect(MIN_ZOOM, MAX_ZOOM, ok);
  return candidate(zoom)?.pose ?? lowest.pose;
}

/** The smallest distance between any two of `points` (Infinity for < 2). */
function closestPair(points: readonly WorldPoint[]): number {
  "worklet";
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) {
      const d = Math.hypot(
        points[i].x - points[j].x,
        points[i].y - points[j].y,
      );
      if (d < best) best = d;
    }
  return best;
}

/**
 * D-19: a cluster tap frames the group in the usable rect (the cluster panel
 * is an obstacle there, as today) and zooms until the closest pair's projected
 * centres are CLUSTER_SEPARATION_PX apart or the group (its drawn discs) would
 * no longer fit, bounded by MAX_ZOOM — never below `frameBodies`' zoom for
 * the same set. Null when `frameBodies` is null (the caller keeps the camera).
 */
export function clusterZoomPose(
  bodies: readonly WorldBody[],
  viewport: CameraViewport,
  pose: CameraPose,
  extent: number,
): CameraPose | null {
  "worklet";
  const base = frameBodies(bodies, viewport, extent, pose);
  if (!base) return null;
  if (!base.fits || bodies.length < 2) return base.pose;
  const usable = base.usable;
  const bound = Math.max(
    Number.isFinite(extent) ? extent : 1,
    worldExtent(bodies),
  );
  const want = {
    x: usable.x + usable.width / 2,
    y: usable.y + usable.height / 2,
  };
  const candidate = (zoom: number) => {
    "worklet";
    const start = clampCameraPose({ ...base.pose, zoom }, bound);
    const centred = centreOn(start, want, viewport, bound, (p) => {
      "worklet";
      const discs = projectDiscs(bodies, p, viewport);
      if (!discs) return null;
      let left = Infinity,
        right = -Infinity,
        top = Infinity,
        bottom = -Infinity;
      for (let i = 0; i < discs.length; i++) {
        left = Math.min(left, discs[i].x - discs[i].r);
        right = Math.max(right, discs[i].x + discs[i].r);
        top = Math.min(top, discs[i].y - discs[i].r);
        bottom = Math.max(bottom, discs[i].y + discs[i].r);
      }
      return { x: (left + right) / 2, y: (top + bottom) / 2 };
    });
    if (!centred) return null;
    const discs = projectDiscs(bodies, centred, viewport);
    if (!discs) return null;
    return {
      pose: centred,
      fits: discsInside(discs, usable),
      separation: closestPair(discs),
    };
  };
  const fits = (zoom: number) => {
    "worklet";
    const c = candidate(zoom);
    return !!c && c.fits;
  };
  const separated = (zoom: number) => {
    "worklet";
    const c = candidate(zoom);
    return !!c && c.separation >= CLUSTER_SEPARATION_PX;
  };
  const start = base.pose.zoom;
  if (separated(start) || !fits(start)) return base.pose;
  // The largest zoom the group still fits at, then the smallest zoom (at or
  // below that) at which the closest pair has separated.
  const fitLimit = fits(MAX_ZOOM) ? MAX_ZOOM : bisect(start, MAX_ZOOM, fits);
  let zoom = fitLimit;
  if (separated(fitLimit)) {
    let lo = start,
      hi = fitLimit;
    for (let i = 0; i < BISECT_STEPS; i++) {
      const mid = (lo + hi) / 2;
      if (separated(mid)) hi = mid;
      else lo = mid;
    }
    zoom = hi;
  }
  return candidate(Math.max(start, zoom))?.pose ?? base.pose;
}
