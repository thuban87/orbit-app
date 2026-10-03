/**
 * Native-measured, screen-facing text. Paragraph paint must use a real layer.
 * 38.7-04 (D-46/D-52): every Paragraph comes from the OrreryTextService; this
 * legacy reader only draws what the published label spec holds (Plan 07
 * replaces it with the V2 text layer).
 */
import {
  Group,
  Paint,
  Paragraph,
  RoundedRect,
  type SkTypefaceFontProvider,
} from "@shopify/react-native-skia";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import type { LabelAllocation } from "@/logic/orrery-label-logic";
import type { ThemePalette } from "@/theme/theme-types";
import { RADII } from "@/theme/tokens/radii";
import { TYPOGRAPHY } from "@/theme/tokens/typography";
import {
  ORRERY_TEXT_HORIZONTAL_PADDING as HORIZONTAL_PADDING,
  type OrreryLabelSpec,
  orreryTextService,
  type PreparedOrreryText,
  ORRERY_TEXT_VERTICAL_PADDING as VERTICAL_PADDING,
} from "./resources/orrery-text-service";

export type { PreparedOrreryText } from "./resources/orrery-text-service";

/** Called on the React/JS resource path only, never inside a frame worklet.
 * Native shaping/one-line ellipsis owns Unicode boundaries; no JS name slicing.
 * Delegates to the shared, cached OrreryTextService (null when admission is
 * refused at the cap, as when the font has not loaded).
 */
export function prepareOrreryText(
  text: string,
  role: "label" | "caption",
  fontScale: number,
  maxWidth: number,
  fontProvider: SkTypefaceFontProvider | null,
  colors: ThemePalette,
): PreparedOrreryText | null {
  const typography = TYPOGRAPHY[role];
  return orreryTextService.prepare({
    text,
    role,
    fontScale,
    maxWidth,
    ink: colors[typography.colorToken],
    family: typography.family,
    weight: typography.weight,
    fontProvider,
  });
}

export function OrreryLabel({
  identity,
  spec,
  allocationIndex,
  colors,
  context = false,
}: {
  identity: string;
  /** D-52: the published label spec; this label draws nothing without an entry. */
  spec: SharedValue<OrreryLabelSpec>;
  /** D-52: label id → allocation (first per id), built once per frame. */
  allocationIndex: SharedValue<Readonly<Record<string, LabelAllocation>>>;
  colors: ThemePalette;
  context?: boolean;
}) {
  const placement = useDerivedValue(() => {
    const item = allocationIndex.value[identity];
    const rect = context ? item?.contextRect : item?.rect;
    return {
      x: rect?.x ?? 0,
      y: rect?.y ?? 0,
      opacity: rect ? (item?.opacity ?? 0) : 0,
    };
  });
  const x = useDerivedValue(() => placement.value.x);
  const y = useDerivedValue(() => placement.value.y);
  const textX = useDerivedValue(() => placement.value.x + HORIZONTAL_PADDING);
  const textY = useDerivedValue(() => placement.value.y + VERTICAL_PADDING);
  const opacity = useDerivedValue(() => placement.value.opacity);
  // RN-Skia skips drawParagraph for a null paragraph, so an unadmitted label
  // draws nothing (and is never an allocation candidate either).
  const paragraph = useDerivedValue(() => {
    const entry = spec.value.labels[identity];
    return (context ? entry?.context : entry?.text)?.paragraph ?? null;
  });
  const boxWidth = useDerivedValue(() => {
    const entry = spec.value.labels[identity];
    return (context ? entry?.context : entry?.text)?.width ?? 0;
  });
  const boxHeight = useDerivedValue(() => {
    const entry = spec.value.labels[identity];
    return (context ? entry?.context : entry?.text)?.height ?? 0;
  });
  const textWidth = useDerivedValue(() =>
    Math.max(0, boxWidth.value - HORIZONTAL_PADDING * 2),
  );
  return (
    <Group layer={<Paint opacity={opacity} />}>
      <RoundedRect
        x={x}
        y={y}
        width={boxWidth}
        height={boxHeight}
        r={RADII.sm}
        color={colors.surface}
      />
      <Paragraph paragraph={paragraph} x={textX} y={textY} width={textWidth} />
    </Group>
  );
}
