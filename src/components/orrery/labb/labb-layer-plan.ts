/**
 * ORRERY LAB B — per-frame draw PLANS for the layer pictures (switch-stall fix,
 * research/SWITCH-STALL-INVESTIGATION.md).
 *
 * The bodies (L2–L4) and the labels (L6) used to be one React component per
 * body / label, each binding 4–16 derived SharedValues to Skia props (≈3 200
 * bound values on Lab B Dense). RN Skia's declarative recorder re-reads EVERY
 * bound value synchronously from the UI thread on each React commit, and
 * Reanimated runs one mapper per derived value per frame — O(bodies) work per
 * commit and per frame that froze the JS thread for seconds at a big switch.
 *
 * The picture layers keep ONE derived value per layer: these pure worklets say
 * what to draw this frame (which bodies / labels, where, in which order, at
 * which alpha); `LabLayerPictures.tsx` executes the plan into one SkPicture on
 * the UI thread. The plans are node-testable and reuse the exact geometry
 * rules of the component path (`labBillboard`, `hudTagPlacement`, the legacy
 * label rule), so hit-testing, label allocation and focus are unchanged.
 *
 * Hermes rule: every helper is declared ABOVE its worklet callers (guarded by
 * `orrery-worklet-order.test.ts`). No Skia import (node-testable).
 */
import type { AnimatedFrame } from "@/logic/orrery-frame";
import type { LabelAllocation } from "@/logic/orrery-label-logic";
import { type FrameIndex, labBillboard } from "./labb-frame-index";

// --- Uniform flattening --------------------------------------------------------

/**
 * Declared (non-child) uniform names of an SkSL source, in declaration order —
 * the order `makeShaderWithChildren` expects. JS side (call once per effect).
 */
export function uniformOrder(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(
    /uniform\s+(float4|float3|float2|float|half4|half3|half2|half)\s+(\w+)\s*;/g,
  ))
    out.push(m[2]);
  return out;
}

/** Named uniform block → flat float array in `order` (missing → zeros). */
export function flattenUniforms(
  uniforms: Record<string, number | readonly number[]>,
  order: readonly string[],
): number[] {
  "worklet";
  const out: number[] = [];
  for (let i = 0; i < order.length; i++) {
    const v = uniforms[order[i]];
    if (v === undefined) continue;
    if (typeof v === "number") out.push(v);
    else for (let j = 0; j < v.length; j++) out.push(v[j]);
  }
  return out;
}

// --- Bodies --------------------------------------------------------------------

/** The per-frame part of one body draw. `i` indexes the layer's spec list. */
export interface LabBodyDrawItem {
  i: number;
  x: number;
  y: number;
  /** projected radius / world radius (the local→screen uniform scale). */
  s: number;
  depth: number;
  alpha: number;
}

export interface LabBodyPlan {
  /** Drawn BEFORE the sun component (depth < the sun's depth). */
  behind: LabBodyDrawItem[];
  /** Drawn AFTER the sun component. */
  front: LabBodyDrawItem[];
}

/**
 * Which bodies draw this frame, depth-sorted exactly like the component path's
 * `zIndex = depth` (stable: ties keep spec order), split around the sun so the
 * separately-drawn sun keeps its place in that order. Culled / absent / faded
 * bodies are skipped (the component path collapsed them to scale 0).
 * `sunDepth` null (no sun in the frame) puts everything in `front`.
 */
export function planBodyDraws(
  frame: AnimatedFrame,
  index: FrameIndex,
  specs: readonly { key: string; radius: number }[],
  sunDepth: number | null,
): LabBodyPlan {
  "worklet";
  const items: LabBodyDrawItem[] = [];
  for (let i = 0; i < specs.length; i++) {
    const p = labBillboard(frame, index, specs[i].key, specs[i].radius);
    if (!(p.scale > 0)) continue;
    items.push({
      i,
      x: p.x,
      y: p.y,
      s: p.scale,
      depth: p.depth,
      alpha: p.opacity,
    });
  }
  items.sort((a, b) => a.depth - b.depth || a.i - b.i);
  const behind: LabBodyDrawItem[] = [];
  const front: LabBodyDrawItem[] = [];
  for (let n = 0; n < items.length; n++) {
    if (sunDepth !== null && items[n].depth < sunDepth) behind.push(items[n]);
    else front.push(items[n]);
  }
  return { behind, front };
}

// --- Labels --------------------------------------------------------------------

export interface HudTagPlacement {
  x: number;
  y: number;
  opacity: number;
  /** y of the body-facing plate edge. */
  edgeY: number;
  /** +1 when the body is below the plate, −1 when above. */
  toward: number;
}

/**
 * Where the tag goes, from the allocation alone (plus the body's y for the
 * leader direction). Hidden (opacity 0) when the label is not allocated —
 * exactly the legacy visibility rule.
 */
export function hudTagFromAllocation(
  item: LabelAllocation | undefined,
  height: number,
  bodyY: number | undefined,
): HudTagPlacement {
  "worklet";
  const rect = item?.rect;
  if (!rect) return { x: 0, y: 0, opacity: 0, edgeY: 0, toward: -1 };
  const above = bodyY !== undefined && bodyY > rect.y + height / 2;
  return {
    x: rect.x,
    y: rect.y,
    opacity: item?.opacity ?? 0,
    edgeY: above ? rect.y + height : rect.y,
    toward: above ? 1 : -1,
  };
}

/** `hudTagFromAllocation` for `identity` (linear lookup; component path). */
export function hudTagPlacement(
  allocations: readonly LabelAllocation[],
  identity: string,
  height: number,
  bodyY: number | undefined,
): HudTagPlacement {
  "worklet";
  let item: LabelAllocation | undefined;
  for (let i = 0; i < allocations.length; i++)
    if (allocations[i].id === identity) {
      item = allocations[i];
      break;
    }
  return hudTagFromAllocation(item, height, bodyY);
}

export interface LabLabelDrawSpec {
  id: string;
  /** Prepared plate size (`prepareOrreryText`). */
  w: number;
  h: number;
}

export interface LabLabelDrawItem {
  i: number;
  /** The name tag (null = not allocated / transparent). */
  tag: HudTagPlacement | null;
  /** The context caption plate (detail level), or null. */
  caption: { x: number; y: number; opacity: number } | null;
}

/**
 * Which labels draw this frame, in label order. The name tag follows
 * `hudTagPlacement` (HUD) or the legacy plate rule (same rect, same opacity);
 * the caption follows the legacy rule on `contextRect`. Fully transparent
 * entries are dropped (the component path drew them inside a zero-alpha
 * saveLayer, i.e. invisibly).
 */
export function planLabelDraws(
  allocations: readonly LabelAllocation[],
  bodyY: (id: string) => number | undefined,
  specs: readonly LabLabelDrawSpec[],
  hud: boolean,
): LabLabelDrawItem[] {
  "worklet";
  const byId: Record<string, LabelAllocation> = {};
  for (let i = 0; i < allocations.length; i++)
    byId[allocations[i].id] = allocations[i];
  const out: LabLabelDrawItem[] = [];
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const item = byId[spec.id];
    if (!item) continue;
    let tag: HudTagPlacement | null = null;
    if (item.rect) {
      // R1: the item is already in hand (was an O(labels × allocations)
      // re-scan per label per frame-change).
      tag = hud
        ? hudTagFromAllocation(item, spec.h, bodyY(spec.id))
        : {
            x: item.rect.x,
            y: item.rect.y,
            opacity: item.opacity ?? 0,
            edgeY: item.rect.y,
            toward: -1,
          };
      if (!(tag.opacity > 0)) tag = null;
    }
    const c = item.contextRect;
    const caption =
      c && (item.opacity ?? 0) > 0
        ? { x: c.x, y: c.y, opacity: item.opacity ?? 0 }
        : null;
    if (tag || caption) out.push({ i, tag, caption });
  }
  return out;
}
