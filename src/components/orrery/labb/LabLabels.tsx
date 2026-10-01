/**
 * ORRERY LAB B — L6 HUD-tag labels (WP-1.3, instrument register).
 *
 * CONTRACT KEPT: labels are positioned ONLY from `allocations` (OrreryWorld's
 * semantic-zoom allocator, which also feeds `resolveTap`), and the plate is
 * EXACTLY the prepared text's `width × height` (`prepareOrreryText`), so the
 * allocation rectangles, collision decisions and the label-visibility → tap
 * behaviour are unchanged. Only the paint changes:
 *   - a soft scrim halo (sky token, blurred) under the plate, so the tag reads
 *     over the brightest nebula / corona pixels;
 *   - the plate (`surface`, slightly translucent) with a faint instrument
 *     outline;
 *   - a status-hue hairline on the body-facing edge and a short leader tick
 *     toward the body (the allocator places the plate below the body, or above
 *     it as the alternate; the leader follows whichever was chosen).
 * Context captions (`detail`) keep the legacy caption plate (`OrreryLabel`).
 *
 * Paragraph alpha still needs a real layer (C-09): one `saveLayer` per
 * allocated label, as legacy.
 */
import {
  BlurMask,
  Group,
  Line,
  Paint,
  Paragraph,
  RoundedRect,
} from "@shopify/react-native-skia";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import type { AnimatedFrame } from "@/logic/orrery-frame";
import type { LabelAllocation } from "@/logic/orrery-label-logic";
import { type LabLabelProfile, labColor } from "@/theme/orrery-lab-fx";
import type { ThemePalette } from "@/theme/theme-types";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import type { PreparedOrreryText } from "../OrreryLabel";
import { bodyAt, type FrameIndex } from "./labb-frame-index";

/** Same paddings as `OrreryLabel` (the prepared width already includes them). */
const HORIZONTAL_PADDING = SPACING.sm;
const VERTICAL_PADDING = SPACING.xs;

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

export function LabHudLabel({
  identity,
  text,
  allocations,
  frame,
  frameIndex,
  colors,
  profile,
  statusColor,
}: {
  identity: string;
  text: PreparedOrreryText;
  allocations: SharedValue<LabelAllocation[]>;
  frame: SharedValue<AnimatedFrame>;
  frameIndex: SharedValue<FrameIndex>;
  colors: ThemePalette;
  profile: LabLabelProfile;
  statusColor: string;
}) {
  const w = text.width;
  const h = text.height;
  const r = RADII.sm;
  const s = profile.haloSpread;
  const placement = useDerivedValue(() =>
    hudTagPlacement(
      allocations.value,
      identity,
      h,
      bodyAt(frame.value, frameIndex.value, identity)?.y,
    ),
  );
  const x = useDerivedValue(() => placement.value.x);
  const y = useDerivedValue(() => placement.value.y);
  const haloX = useDerivedValue(() => placement.value.x - s);
  const haloY = useDerivedValue(() => placement.value.y - s);
  const textX = useDerivedValue(() => placement.value.x + HORIZONTAL_PADDING);
  const textY = useDerivedValue(() => placement.value.y + VERTICAL_PADDING);
  const opacity = useDerivedValue(() => placement.value.opacity);
  const hair1 = useDerivedValue(() => ({
    x: placement.value.x + r,
    y: placement.value.edgeY,
  }));
  const hair2 = useDerivedValue(() => ({
    x: placement.value.x + w - r,
    y: placement.value.edgeY,
  }));
  const lead1 = useDerivedValue(() => ({
    x: placement.value.x + w / 2,
    y: placement.value.edgeY,
  }));
  const lead2 = useDerivedValue(() => ({
    x: placement.value.x + w / 2,
    y: placement.value.edgeY + placement.value.toward * profile.leaderDp,
  }));
  return (
    <Group layer={<Paint opacity={opacity} />}>
      <RoundedRect
        x={haloX}
        y={haloY}
        width={w + s * 2}
        height={h + s * 2}
        r={r + s}
        color={labColor(colors, profile.halo)}
        opacity={profile.haloAlpha}
      >
        <BlurMask blur={profile.haloBlur} style="normal" />
      </RoundedRect>
      <RoundedRect
        x={x}
        y={y}
        width={w}
        height={h}
        r={r}
        color={labColor(colors, profile.plate)}
        opacity={profile.plateOpacity}
      />
      <RoundedRect
        x={x}
        y={y}
        width={w}
        height={h}
        r={r}
        style="stroke"
        strokeWidth={1}
        color={labColor(colors, profile.outline)}
        opacity={profile.outlineAlpha}
      />
      <Line
        p1={hair1}
        p2={hair2}
        color={statusColor}
        strokeWidth={profile.hairlineDp}
      />
      <Line
        p1={lead1}
        p2={lead2}
        color={statusColor}
        strokeWidth={1}
        strokeCap="round"
      />
      <Paragraph
        paragraph={text.paragraph}
        x={textX}
        y={textY}
        width={w - HORIZONTAL_PADDING * 2}
      />
    </Group>
  );
}
