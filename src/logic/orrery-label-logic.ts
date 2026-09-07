/** Screen-space semantic labels. Only native paragraph measurement handles text. */
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

/** Initials are grapheme clusters, never UTF-16 units. Older runtimes without
 * Segmenter hand the whole identity to the native one-line avatar paragraph.
 */
export function orreryInitials(name: string): string {
  if (typeof Intl.Segmenter !== "function") return name;
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const initials: string[] = [];
  for (const word of name.trim().split(/\s+/)) {
    const first = segmenter.segment(word)[Symbol.iterator]().next().value;
    if (first) initials.push(first.segment);
    if (initials.length === 2) break;
  }
  return initials.join("").toUpperCase();
}
export function semanticLevel(
  zoom: number,
  previous: SemanticLevel,
): SemanticLevel {
  "worklet";
  if (!Number.isFinite(zoom)) return previous;
  if (zoom >= DETAIL_ENTER || (previous === "detail" && zoom >= DETAIL_EXIT))
    return "detail";
  if (
    zoom >= IDENTITY_ENTER ||
    (previous !== "overview" && zoom >= IDENTITY_EXIT)
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
  const priority = (c: LabelCandidate) => {
    "worklet";
    if (c.focused) return 0;
    if (c.cluster) return 1;
    if (c.favorite) return 2;
    const r = rect(c);
    return inside(r) &&
      !obstacles.some((o) => rectanglesTouch(r, o)) &&
      !valid.some(
        (other) => other.id !== c.id && rectanglesTouch(r, rect(other)),
      )
      ? 3
      : 4;
  };
  const ranked = valid
    .map((c) => ({ c, priority: priority(c) }))
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        (a.c.id < b.c.id ? -1 : a.c.id > b.c.id ? 1 : 0),
    );
  const result: LabelAllocation[] = [];
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
        obstacles.some((o) => rectanglesTouch(r, o)) ||
        result.some((a) => rectanglesTouch(r, a.rect))
      )
        continue;
      result.push({ id: c.id, name: c.name, rect: r, opacity: c.opacity });
      break;
    }
  }
  // Names get first refusal. Optional detail never removes a readable identity.
  if (level === "detail")
    for (const allocation of result) {
      const c = valid.find((item) => item.id === allocation.id);
      if (!c?.context || !c.contextWidth || !c.contextHeight) continue;
      const r = {
        x: allocation.rect.x + (allocation.rect.width - c.contextWidth) / 2,
        y: allocation.rect.y + allocation.rect.height + CONTEXT_GAP,
        width: c.contextWidth,
        height: c.contextHeight,
      };
      if (
        inside(r) &&
        !obstacles.some((o) => rectanglesTouch(r, o)) &&
        !result.some(
          (a) =>
            rectanglesTouch(r, a.rect) ||
            (a.contextRect && rectanglesTouch(r, a.contextRect)),
        )
      )
        allocation.contextRect = r;
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
        ? "Not contacted yet"
        : {
            stable: "Stable",
            wobble: "Wobbling",
            decay: "Decaying",
            rogue: "Rogue",
          }[status];
  const values = [
    health,
    gravity ? `${gravity.tierName} gravity` : undefined,
    focusedRelation,
  ].filter((value) => !!value);
  return values.length ? values.join(" · ") : undefined;
}
