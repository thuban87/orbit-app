/**
 * 38.7-07 (D-43/D-52): body labels as picture drawing — today's look.
 *
 * For each admitted label (the published spec's `measured` list, in its draw
 * order) and its allocation (Plan 03's per-frame allocation index): the
 * backplate rounded rect in the surface token (radius `RADII.sm`, the box is
 * the text plus today's padding) and the prepared Paragraph, then the context
 * caption (detail tier) in its own allocated rect — both at the allocation's
 * opacity. A partly transparent plate gets a transparency layer BOUNDED to
 * its own box (the legacy reader used one layer per label at all times).
 *
 * Every Paragraph comes from OrreryTextService through the label spec; this
 * module only paints. Worklet helpers are defined above their callers.
 */
import { type SkCanvas, Skia } from "@shopify/react-native-skia";
import type { LabelAllocation } from "@/logic/orrery-label-logic";
import { RADII } from "@/theme/tokens/radii";
import {
  ORRERY_TEXT_HORIZONTAL_PADDING,
  ORRERY_TEXT_VERTICAL_PADDING,
  type PreparedOrreryText,
} from "../resources/orrery-text-service";
import type { OrreryInk, OrreryLabelLayerSpecs } from "./scene-specs";

/** Below this alpha nothing draws; above 1 − this no layer is needed. */
const ALPHA_EPSILON = 0.001;

/** One plate + its Paragraph at `rect`'s corner, at `alpha`. */
function drawPlate(
  canvas: SkCanvas,
  x: number,
  y: number,
  text: PreparedOrreryText,
  plateInk: OrreryInk,
  alpha: number,
): void {
  "worklet";
  const box = Skia.XYWHRect(x, y, text.width, text.height);
  const layered = alpha < 1 - ALPHA_EPSILON;
  if (layered) {
    const layer = Skia.Paint();
    layer.setAlphaf(Math.max(0, Math.min(1, alpha)));
    canvas.saveLayer(layer, box);
  }
  const plate = Skia.Paint();
  plate.setAntiAlias(true);
  plate.setColor(
    Float32Array.of(plateInk[0], plateInk[1], plateInk[2], plateInk[3]),
  );
  canvas.drawRRect(Skia.RRectXY(box, RADII.sm, RADII.sm), plate);
  try {
    text.paragraph.paint(
      canvas,
      x + ORRERY_TEXT_HORIZONTAL_PADDING,
      y + ORRERY_TEXT_VERTICAL_PADDING,
    );
  } catch {
    // Last guard only: the ledger never disposes a drawn Paragraph.
  }
  if (layered) canvas.restore();
}

/**
 * Every allocated label and caption, in the spec's label order. Returns how
 * many plates were drawn.
 */
export function drawLabels(
  canvas: SkCanvas,
  specs: OrreryLabelLayerSpecs,
  allocationIndex: Readonly<Record<string, LabelAllocation>>,
): number {
  "worklet";
  let drawn = 0;
  const measured = specs.measured;
  for (let i = 0; i < measured.length; i++) {
    const id = measured[i].id;
    const entry = specs.labels[id];
    const item = allocationIndex[id];
    if (!entry || !item) continue;
    const alpha = Number.isFinite(item.opacity) ? item.opacity : 0;
    if (!(alpha > ALPHA_EPSILON)) continue;
    if (entry.text) {
      drawPlate(
        canvas,
        item.rect.x,
        item.rect.y,
        entry.text,
        specs.plateInk,
        alpha,
      );
      drawn++;
    }
    if (entry.context && item.contextRect) {
      drawPlate(
        canvas,
        item.contextRect.x,
        item.contextRect.y,
        entry.context,
        specs.plateInk,
        alpha,
      );
      drawn++;
    }
  }
  return drawn;
}
