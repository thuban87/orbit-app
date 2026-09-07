/** Native-measured, screen-facing text. Paragraph paint must use a real layer. */
import {
  Group,
  Paint,
  Paragraph,
  RoundedRect,
  Skia,
  type SkParagraph,
  type SkTypefaceFontProvider,
  TextAlign,
} from "@shopify/react-native-skia";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import type { LabelAllocation } from "@/logic/orrery-label-logic";
import type { ThemePalette } from "@/theme/theme-types";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { TYPOGRAPHY } from "@/theme/tokens/typography";

const HORIZONTAL_PADDING = SPACING.sm;
const VERTICAL_PADDING = SPACING.xs;
export interface PreparedOrreryText {
  /** The original identity remains available to companion/accessibility callers. */
  text: string;
  paragraph: SkParagraph;
  width: number;
  height: number;
}
/** Called on the React resource path only, never inside a frame worklet.
 * Native shaping/one-line ellipsis owns Unicode boundaries; no JS name slicing.
 */
export function prepareOrreryText(
  text: string,
  role: "label" | "caption",
  fontScale: number,
  maxWidth: number,
  fontProvider: SkTypefaceFontProvider | null,
  colors: ThemePalette,
): PreparedOrreryText | null {
  if (!fontProvider || maxWidth <= HORIZONTAL_PADDING * 2) return null;
  const typography = TYPOGRAPHY[role];
  const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const paragraph = Skia.ParagraphBuilder.Make(
    { textAlign: TextAlign.Center, maxLines: 1, ellipsis: "…" },
    fontProvider,
  )
    .pushStyle({
      color: Skia.Color(colors[typography.colorToken]),
      fontFamilies: [typography.family],
      fontStyle: { weight: typography.weight },
      fontSize: typography.size * scale,
    })
    .addText(text)
    .pop()
    .build();
  paragraph.layout(maxWidth - HORIZONTAL_PADDING * 2);
  const width = Math.min(
    maxWidth,
    Math.max(1, Math.ceil(paragraph.getLongestLine())) + HORIZONTAL_PADDING * 2,
  );
  paragraph.layout(width - HORIZONTAL_PADDING * 2);
  return {
    text,
    paragraph,
    width,
    height:
      Math.max(paragraph.getHeight(), typography.lineHeight * scale) +
      VERTICAL_PADDING * 2,
  };
}

export function OrreryLabel({
  identity,
  text,
  allocations,
  colors,
  context = false,
}: {
  identity: string;
  text: PreparedOrreryText;
  allocations: SharedValue<LabelAllocation[]>;
  colors: ThemePalette;
  context?: boolean;
}) {
  const placement = useDerivedValue(() => {
    const item = allocations.value.find((label) => label.id === identity);
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
  return (
    <Group layer={<Paint opacity={opacity} />}>
      <RoundedRect
        x={x}
        y={y}
        width={text.width}
        height={text.height}
        r={RADII.sm}
        color={colors.surface}
      />
      <Paragraph
        paragraph={text.paragraph}
        x={textX}
        y={textY}
        width={text.width - HORIZONTAL_PADDING * 2}
      />
    </Group>
  );
}
