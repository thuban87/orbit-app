/** Native-measured, screen-facing text. Paragraph paint must use a real layer. */
import {
  Group,
  Paint,
  Paragraph,
  Path,
  Rect,
  RoundedRect,
  Skia,
  type SkParagraph,
  type SkTypefaceFontProvider,
  TextAlign,
} from "@shopify/react-native-skia";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import { type AnimatedFrame, frameBody } from "@/logic/orrery-frame";
import type { LabelAllocation } from "@/logic/orrery-label-logic";
import type { ThemePalette } from "@/theme/theme-types";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { TYPOGRAPHY } from "@/theme/tokens/typography";
import {
  LEADER_ALPHA,
  PLATE_ALPHA,
  PLATE_BORDER_ALPHA,
  PLATE_TICK_WIDTH,
} from "./lab/deep-field-config";
import { type DeepFieldInk, withAlpha } from "./lab/deep-field-ink";

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

/**
 * ORRERY LAB A — "instrument plate" treatment (hypothesis item 6). The plate is
 * drawn EXACTLY in the allocated rect with the same native-measured size, so
 * allocation (and therefore Profile-vs-Focus) is unchanged. Additions are all
 * inside that rect (hairline border, status tick in the left padding) or in
 * the existing body↔plate gap (the leader hairline). Text stays
 * `textPrimary`/`textSecondary` on a `surface` plate.
 */
export function OrreryLabel({
  identity,
  text,
  allocations,
  colors,
  context = false,
  deepInk,
  tickColor,
  frame,
}: {
  identity: string;
  text: PreparedOrreryText;
  allocations: SharedValue<LabelAllocation[]>;
  colors: ThemePalette;
  context?: boolean;
  /** ORRERY LAB A: deep-field ink → instrument plate styling. */
  deepInk?: DeepFieldInk;
  /** ORRERY LAB A: status hue for the plate's tick (name plates only). */
  tickColor?: string;
  /** ORRERY LAB A: frame for the leader hairline (name plates only). */
  frame?: SharedValue<AnimatedFrame>;
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
  const tickX = useDerivedValue(() => placement.value.x + 3);
  const tickY = useDerivedValue(() => placement.value.y + VERTICAL_PADDING);
  // Plain numbers only: the native paragraph must never be captured by a worklet.
  const plateW = text.width;
  const plateH = text.height;
  const leader = useDerivedValue(() => {
    const path = Skia.Path.Make();
    if (!frame || context || placement.value.opacity <= 0) return path;
    const body = frameBody(frame.value, identity);
    if (!body) return path;
    const px = placement.value.x + plateW / 2;
    const below = placement.value.y >= body.y;
    const plateY = below ? placement.value.y : placement.value.y + plateH;
    const edgeY = below ? body.y + body.radius : body.y - body.radius;
    const dx = px - body.x;
    const dy = plateY - edgeY;
    if (Math.hypot(dx, dy) < 2) return path;
    path.moveTo(
      body.x + Math.max(-body.radius, Math.min(body.radius, dx * 0.5)),
      edgeY,
    );
    path.lineTo(px, plateY);
    return path;
  });
  const ink = deepInk;
  const border = ink ? withAlpha(ink.grid, PLATE_BORDER_ALPHA) : undefined;
  const leaderInk = ink
    ? withAlpha(ink.textSecondary, LEADER_ALPHA)
    : undefined;
  return (
    <Group layer={<Paint opacity={opacity} />}>
      <RoundedRect
        x={x}
        y={y}
        width={text.width}
        height={text.height}
        r={RADII.sm}
        color={colors.surface}
        opacity={ink ? PLATE_ALPHA : 1}
      />
      {border ? (
        <RoundedRect
          x={x}
          y={y}
          width={text.width}
          height={text.height}
          r={RADII.sm}
          color={border}
          style="stroke"
          strokeWidth={0.75}
        />
      ) : null}
      {ink && tickColor && !context ? (
        <Rect
          x={tickX}
          y={tickY}
          width={PLATE_TICK_WIDTH}
          height={Math.max(2, text.height - VERTICAL_PADDING * 2)}
          color={tickColor}
        />
      ) : null}
      {leaderInk && frame && !context ? (
        <Path path={leader} color={leaderInk} style="stroke" strokeWidth={1} />
      ) : null}
      <Paragraph
        paragraph={text.paragraph}
        x={textX}
        y={textY}
        width={text.width - HORIZONTAL_PADDING * 2}
      />
    </Group>
  );
}
