/**
 * ORRERY LAB A — DEV-only experiment marker (canvas corner HUD text).
 * PASS 1: pinned to the canvas's bottom-left corner (left of the controls
 * column / FAB). Direction 1 anchored it to the usable rect, which JUMPS when
 * obstacles (System sheet, panels) appear or vanish — mid-switch that read as
 * a doubled, offset marker. A fixed corner never moves. Not interactive (the
 * canvas has a single GestureDetector; Skia draws do not intercept touches).
 */
import {
  Group,
  Paragraph,
  Rect,
  Skia,
  type SkTypefaceFontProvider,
  TextAlign,
} from "@shopify/react-native-skia";
import { useMemo } from "react";
import type { CameraViewport } from "@/logic/orrery-camera-logic";
import {
  LAB_MARKER_ENABLED,
  LAB_MARKER_FONT,
  LAB_MARKER_INSET,
  LAB_MARKER_TEXT,
} from "./deep-field-config";
import { type DeepFieldInk, withAlpha } from "./deep-field-ink";

const MARKER_WIDTH = 240;

export function labMarkerVisible(): boolean {
  return LAB_MARKER_ENABLED && typeof __DEV__ !== "undefined" && __DEV__;
}

export function LabHud({
  viewport,
  fontProvider,
  ink,
  textColor,
}: {
  viewport: CameraViewport;
  fontProvider: SkTypefaceFontProvider | null;
  ink: DeepFieldInk;
  /** `textSecondary` token. */
  textColor: string;
}) {
  const paragraph = useMemo(() => {
    if (!fontProvider) return null;
    const p = Skia.ParagraphBuilder.Make(
      { textAlign: TextAlign.Left, maxLines: 1 },
      fontProvider,
    )
      .pushStyle({
        color: Skia.Color(textColor),
        fontFamilies: ["Inter"],
        fontSize: LAB_MARKER_FONT,
        fontStyle: { weight: 600 },
        letterSpacing: 1.2,
      })
      .addText(LAB_MARKER_TEXT)
      .pop()
      .build();
    p.layout(MARKER_WIDTH);
    return p;
  }, [fontProvider, textColor]);
  if (!paragraph) return null;
  const x = LAB_MARKER_INSET + 4;
  const y = viewport.height - LAB_MARKER_INSET - LAB_MARKER_FONT - 4;
  return (
    <Group opacity={0.8}>
      <Rect
        x={x - 4}
        y={y + 1}
        width={2}
        height={LAB_MARKER_FONT + 2}
        color={withAlpha(ink.grid, 0.9)}
      />
      <Paragraph paragraph={paragraph} x={x} y={y} width={MARKER_WIDTH} />
    </Group>
  );
}
