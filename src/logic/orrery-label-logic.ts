/** Screen-space semantic labels. Only native paragraph measurement handles text. */
import {
  DECAYING,
  NEVER_CONTACTED,
  ROGUE,
  STABLE,
  WOBBLY,
} from "@/constants/glossary";
import type { ProfileStatus } from "@/db/contact-status-read";
import type { GravityResult } from "@/services/gravity-logic";
import {
  type CameraRect,
  type CameraViewport,
  IDENTITY_ZOOM,
} from "./orrery-camera-logic";

export type SemanticLevel = "overview" | "identity" | "detail";
export const IDENTITY_ENTER = IDENTITY_ZOOM;
export const IDENTITY_EXIT = 1.85;
export const DETAIL_ENTER = 3;
export const DETAIL_EXIT = 2.8;
const LABEL_NUDGE = 8;
const CONTEXT_GAP = 4;
/**
 * D-52: uniform-grid cell size (canvas px) for the label allocator's spatial
 * hash. Tunable: it changes only speed, never the allocation.
 */
export const LABEL_GRID_CELL = 64;
/** Rects spanning more cells than this are scanned linearly instead. */
const LABEL_GRID_MAX_CELLS = 1024;

const ZWJ = 0x200d;
const COMBINING_MARK = /^\p{M}$/u;
/** Variation selectors U+FE00–U+FE0F and the keycap U+20E3. */
const isVariation = (cp: number) =>
  (cp >= 0xfe00 && cp <= 0xfe0f) || cp === 0x20e3;
/** Fitzpatrick skin-tone modifiers. */
const isSkinTone = (cp: number) => cp >= 0x1f3fb && cp <= 0x1f3ff;
/** Tag characters (subdivision flags such as Scotland). */
const isTag = (cp: number) => cp >= 0xe0020 && cp <= 0xe007f;
const isRegionalIndicator = (cp: number) => cp >= 0x1f1e6 && cp <= 0x1f1ff;

/**
 * D-33: the first user-perceived character of a word without Intl.Segmenter
 * (absent on Hermes). Iterates code points (never UTF-16 units), keeps a
 * regional-indicator pair together, then absorbs combining marks, variation
 * selectors/keycap, skin tones, tag characters and every ZWJ + its next code
 * point — enough for names, emoji, flags and keycaps. Not a full UAX #29.
 */
export function firstGrapheme(word: string): string {
  const points = Array.from(word);
  if (points.length === 0) return "";
  const first = points[0].codePointAt(0) as number;
  if (
    isRegionalIndicator(first) &&
    points.length > 1 &&
    isRegionalIndicator(points[1].codePointAt(0) as number)
  )
    return points[0] + points[1];
  let out = points[0];
  let i = 1;
  while (i < points.length) {
    const point = points[i];
    const cp = point.codePointAt(0) as number;
    if (
      COMBINING_MARK.test(point) ||
      isVariation(cp) ||
      isSkinTone(cp) ||
      isTag(cp)
    ) {
      out += point;
      i++;
      continue;
    }
    if (cp === ZWJ && i + 1 < points.length) {
      out += point + points[i + 1];
      i += 2;
      continue;
    }
    break;
  }
  return out;
}

/**
 * Initials are grapheme clusters, never UTF-16 units: the first grapheme of up
 * to two whitespace-separated words, uppercased. Uses Intl.Segmenter when the
 * runtime has it; otherwise (Hermes) `firstGrapheme`. D-33 (EDGE-14) amends
 * Phase 29's fallback, which handed the whole name to the one-line avatar
 * paragraph and so drew "El…" — the full name is never returned now.
 */
export function orreryInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials: string[] = [];
  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, {
      granularity: "grapheme",
    });
    for (const word of words) {
      const first = segmenter.segment(word)[Symbol.iterator]().next().value;
      if (first) initials.push(first.segment);
      if (initials.length === 2) break;
    }
  } else {
    for (const word of words) {
      const first = firstGrapheme(word);
      if (first) initials.push(first);
      if (initials.length === 2) break;
    }
  }
  return initials.join("").toUpperCase();
}
/**
 * D-47: the tier follows on-screen magnification (the frame's
 * `labelMagnification`), not raw zoom: under the dolly camera zoom no longer
 * means magnification. Thresholds are unchanged, and at a flat, centred Home
 * magnification equals zoom, so the tiers there are exactly as before.
 */
export function semanticLevel(
  magnification: number,
  previous: SemanticLevel,
): SemanticLevel {
  "worklet";
  if (!Number.isFinite(magnification)) return previous;
  if (
    magnification >= DETAIL_ENTER ||
    (previous === "detail" && magnification >= DETAIL_EXIT)
  )
    return "detail";
  if (
    magnification >= IDENTITY_ENTER ||
    (previous !== "overview" && magnification >= IDENTITY_EXIT)
  )
    return "identity";
  return "overview";
}
export interface LabelCandidate {
  id: string;
  /** Full original identity. Never sliced, normalized or used as a key. */
  name: string;
  x: number;
  y: number;
  /** Fixed alternate above the same body; no global relocation/repacking. */
  alternateY?: number;
  width: number;
  height: number;
  opacity: number;
  focused?: boolean;
  cluster?: boolean;
  favorite?: boolean;
  context?: string;
  contextWidth?: number;
  contextHeight?: number;
  /**
   * D-47 nearest-first: nearness to the camera (larger = nearer), e.g. the
   * projected body's camera-plane depth. Missing depths rank as equal, so
   * candidates without it allocate exactly as before.
   */
  depth?: number;
}
export interface LabelAllocation {
  id: string;
  name: string;
  rect: CameraRect;
  opacity: number;
  contextRect?: CameraRect;
}
/** Inclusive collision: touching edges or corners count as overlap. */
export function rectanglesTouch(a: CameraRect, b: CameraRect): boolean {
  "worklet";
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  );
}
/**
 * D-52 spatial hash for "does any stored rect touch this one" queries. Every
 * answer is decided by the exact `rectanglesTouch` (inclusive edges), so the
 * grid only skips rects that cannot touch: two touching well-formed rects
 * always share a cell (floor is monotone and the bounds are the same float
 * expressions `rectanglesTouch` compares). Rects that are non-finite, negative
 * or very large live in `wide` and are always tested. Answers are booleans, so
 * the scan order can never change an allocation.
 */
interface RectGrid {
  rects: CameraRect[];
  /** Owner id per rect, for the "any OTHER candidate" query. */
  owners: string[];
  cells: Map<number, number[]>;
  wide: number[];
}
function createRectGrid(): RectGrid {
  "worklet";
  return { rects: [], owners: [], cells: new Map(), wide: [] };
}
/** Inclusive cell span of a well-formed rect, or null (non-finite, negative, too large). */
function gridSpan(
  r: CameraRect,
): { x0: number; x1: number; y0: number; y1: number } | null {
  "worklet";
  if (
    !Number.isFinite(r.x) ||
    !Number.isFinite(r.y) ||
    !Number.isFinite(r.width) ||
    !Number.isFinite(r.height) ||
    r.width < 0 ||
    r.height < 0
  )
    return null;
  const x0 = Math.floor(r.x / LABEL_GRID_CELL),
    x1 = Math.floor((r.x + r.width) / LABEL_GRID_CELL),
    y0 = Math.floor(r.y / LABEL_GRID_CELL),
    y1 = Math.floor((r.y + r.height) / LABEL_GRID_CELL);
  if (!Number.isFinite(x1) || !Number.isFinite(y1)) return null;
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > LABEL_GRID_MAX_CELLS) return null;
  return { x0, x1, y0, y1 };
}
function gridCellKey(cx: number, cy: number): number {
  "worklet";
  // Distinct cells may share a key; that only adds candidates to the exact test.
  return cx * 1048576 + cy;
}
function gridInsert(grid: RectGrid, r: CameraRect, owner: string): void {
  "worklet";
  const index = grid.rects.length;
  grid.rects.push(r);
  grid.owners.push(owner);
  const span = gridSpan(r);
  if (!span) {
    grid.wide.push(index);
    return;
  }
  for (let cx = span.x0; cx <= span.x1; cx++)
    for (let cy = span.y0; cy <= span.y1; cy++) {
      const key = gridCellKey(cx, cy);
      const cell = grid.cells.get(key);
      if (cell) cell.push(index);
      else grid.cells.set(key, [index]);
    }
}
/** Whether any stored rect (optionally excluding an owner id) touches `r`. */
function gridTouches(
  grid: RectGrid,
  r: CameraRect,
  skipOwner?: string,
): boolean {
  "worklet";
  for (let i = 0; i < grid.wide.length; i++) {
    const index = grid.wide[i];
    if (skipOwner !== undefined && grid.owners[index] === skipOwner) continue;
    if (rectanglesTouch(r, grid.rects[index])) return true;
  }
  const span = gridSpan(r);
  if (!span) {
    // An ill-formed query falls back to the exact full scan.
    for (let index = 0; index < grid.rects.length; index++) {
      if (skipOwner !== undefined && grid.owners[index] === skipOwner) continue;
      if (rectanglesTouch(r, grid.rects[index])) return true;
    }
    return false;
  }
  for (let cx = span.x0; cx <= span.x1; cx++)
    for (let cy = span.y0; cy <= span.y1; cy++) {
      const cell = grid.cells.get(gridCellKey(cx, cy));
      if (!cell) continue;
      for (let i = 0; i < cell.length; i++) {
        const index = cell[i];
        if (skipOwner !== undefined && grid.owners[index] === skipOwner)
          continue;
        if (rectanglesTouch(r, grid.rects[index])) return true;
      }
    }
  return false;
}
interface RankedLabel {
  c: LabelCandidate;
  priority: number;
}
/**
 * The single ranking comparator: priority class, then nearest-to-camera first
 * (D-47, 38.7-05), then id (deterministic tie-break). The indexed placement
 * below is unchanged. At tilt 0 every depth is equal, so the order is the
 * pre-38.7 priority-then-id order.
 */
function compareRankedLabels(a: RankedLabel, b: RankedLabel): number {
  "worklet";
  const nearer = (b.c.depth ?? 0) - (a.c.depth ?? 0);
  return (
    a.priority - b.priority ||
    (Number.isFinite(nearer) ? nearer : 0) ||
    (a.c.id < b.c.id ? -1 : a.c.id > b.c.id ? 1 : 0)
  );
}
export function allocateLabels(
  candidates: readonly LabelCandidate[],
  level: SemanticLevel,
  viewport: CameraViewport,
  bodyExclusions: readonly CameraRect[] = [],
): LabelAllocation[] {
  "worklet";
  const usable = viewport.usable ?? {
    x: 0,
    y: 0,
    width: viewport.width,
    height: viewport.height,
  };
  const obstacles = [...(viewport.obstacles ?? []), ...bodyExclusions];
  const rect = (c: LabelCandidate): CameraRect => {
    "worklet";
    return { x: c.x, y: c.y, width: c.width, height: c.height };
  };
  const inside = (r: CameraRect) => {
    "worklet";
    return (
      r.x >= Math.max(0, usable.x) &&
      r.y >= Math.max(0, usable.y) &&
      r.x + r.width <= Math.min(viewport.width, usable.x + usable.width) &&
      r.y + r.height <= Math.min(viewport.height, usable.y + usable.height)
    );
  };
  const valid = candidates.filter(
    (c) =>
      c.opacity > 0 &&
      [c.x, c.y, c.width, c.height].every(Number.isFinite) &&
      c.width > 0 &&
      c.height > 0 &&
      (level !== "overview" || c.focused || c.cluster),
  );
  // D-52: one grid each for obstacles, candidates and placed labels, instead
  // of scanning every obstacle/candidate/placement per candidate.
  const obstacleGrid = createRectGrid();
  for (let i = 0; i < obstacles.length; i++)
    gridInsert(obstacleGrid, obstacles[i], "");
  const candidateGrid = createRectGrid();
  for (let i = 0; i < valid.length; i++)
    gridInsert(candidateGrid, rect(valid[i]), valid[i].id);
  const priority = (c: LabelCandidate) => {
    "worklet";
    if (c.focused) return 0;
    if (c.cluster) return 1;
    if (c.favorite) return 2;
    const r = rect(c);
    return inside(r) &&
      !gridTouches(obstacleGrid, r) &&
      // Any OTHER candidate: every candidate with this id is excluded, as before.
      !gridTouches(candidateGrid, r, c.id)
      ? 3
      : 4;
  };
  const ranked = valid
    .map((c) => ({ c, priority: priority(c) }))
    .sort(compareRankedLabels);
  const result: LabelAllocation[] = [];
  // Placed name rects, then (detail) context rects as they are assigned.
  const placedGrid = createRectGrid();
  for (const { c } of ranked) {
    const placements = [
      c.y,
      ...(c.alternateY === undefined ? [] : [c.alternateY]),
    ].flatMap((y) =>
      [0, -LABEL_NUDGE, LABEL_NUDGE].map((dx) => ({
        ...rect(c),
        x: c.x + dx,
        y,
      })),
    );
    for (const r of placements) {
      if (
        !inside(r) ||
        gridTouches(obstacleGrid, r) ||
        gridTouches(placedGrid, r)
      )
        continue;
      result.push({ id: c.id, name: c.name, rect: r, opacity: c.opacity });
      gridInsert(placedGrid, r, c.id);
      break;
    }
  }
  // Names get first refusal. Optional detail never removes a readable identity.
  if (level === "detail") {
    // First valid candidate per id, exactly what `valid.find` returned.
    const firstById = new Map<string, LabelCandidate>();
    for (let i = 0; i < valid.length; i++)
      if (!firstById.has(valid[i].id)) firstById.set(valid[i].id, valid[i]);
    for (const allocation of result) {
      const c = firstById.get(allocation.id);
      if (!c?.context || !c.contextWidth || !c.contextHeight) continue;
      const r = {
        x: allocation.rect.x + (allocation.rect.width - c.contextWidth) / 2,
        y: allocation.rect.y + allocation.rect.height + CONTEXT_GAP,
        width: c.contextWidth,
        height: c.contextHeight,
      };
      if (
        inside(r) &&
        !gridTouches(obstacleGrid, r) &&
        !gridTouches(placedGrid, r)
      ) {
        allocation.contextRect = r;
        gridInsert(placedGrid, r, allocation.id);
      }
    }
  }
  return result;
}

/** Existing lightweight health/Gravity only; missing fields create no row. */
export function labelContext(
  status: ProfileStatus | null | undefined,
  gravity: GravityResult | undefined,
  focusedRelation?: string,
): string | undefined {
  const health =
    status === undefined
      ? undefined
      : status === null
        ? NEVER_CONTACTED
        : {
            stable: STABLE,
            wobble: WOBBLY,
            decay: DECAYING,
            rogue: ROGUE,
          }[status];
  const values = [
    health,
    gravity ? `${gravity.tierName} gravity` : undefined,
    focusedRelation,
  ].filter((value) => !!value);
  return values.length ? values.join(" · ") : undefined;
}
