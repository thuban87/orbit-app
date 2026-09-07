/**
 * ADR-077: canonical status body drawn in its projected parent coordinate space.
 * Keyed, unconditional local image/font resources preserve hook identity.
 * No animation clock or independent world/camera position calculation lives here.
 */
import {
  Circle,
  Group,
  Paragraph,
  rect,
  rrect,
  Skia,
  Image as SkiaImage,
  type SkTypefaceFontProvider,
  TextAlign,
  useImage,
} from "@shopify/react-native-skia";
import { useMemo } from "react";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import type { BillboardPose } from "@/logic/orrery-frame";
import { resolvePhotoUri } from "@/services/photos/photo-storage";

export interface OrbitBodyProps {
  projection?: SharedValue<BillboardPose>;
  focusColor?: string;
  /** Body center x in the projected wrapper local space. */
  cx: number;
  /** Body center y in the projected wrapper local space. */
  cy: number;
  /** Planet photo-circle radius (`C.PLANET_RADIUS`). */
  radius: number;
  /** Raw relative photo path or null (C2-1 — null-guarded before resolvePhotoUri). */
  photo: string | null;
  /** The canonical status body treatment / outline colour (`orreryRingStyle.bodyFill`). */
  bodyFill: string;
  /** The deterministic fallback swatch (`avatarSwatches[swatchIndex(name)]`). */
  swatch: string;
  /** The on-swatch initials glyph colour (`avatarSwatchText`). */
  swatchText: string;
  /** The contact's initials (empty string → swatch with no glyph). */
  initials: string;
  /** The bundled-font provider from `useFonts`; null until the font loads. */
  fontProvider: SkTypefaceFontProvider | null;
}

/** Status-outline stroke width around the planet disc. */
const OUTLINE_WIDTH = 3;

export function OrbitBody({
  cx,
  cy,
  radius,
  photo,
  bodyFill,
  swatch,
  swatchText,
  initials,
  fontProvider,
  projection,
  focusColor,
}: OrbitBodyProps) {
  const transform = useDerivedValue(() =>
    projection
      ? [
          { translateX: projection.value.x },
          { translateY: projection.value.y },
          { scale: projection.value.scale },
        ]
      : [],
  );
  const depth = useDerivedValue(() => projection?.value.depth ?? 0);
  const layer = useDerivedValue(() => {
    const paint = Skia.Paint();
    paint.setAlphaf(projection?.value.opacity ?? 1);
    return paint;
  });
  // C2-1: unconditional hook, null-guarded source (photo may be null).
  const image = useImage(photo ? resolvePhotoUri(photo) : null);

  // Inner disc sits inside the status outline ring.
  const innerR = Math.max(1, radius - OUTLINE_WIDTH / 2);
  const fontSize = radius; // ~cap height fits the disc (device-UAT tunable, 13-08).

  // Initials Paragraph (new-to-repo Skia idiom). Null when the font has not loaded
  // or the name is empty → the plain swatch shows with no glyph.
  const paragraph = useMemo(() => {
    if (!fontProvider || initials.length === 0) {
      return null;
    }
    const p = Skia.ParagraphBuilder.Make(
      { textAlign: TextAlign.Center, maxLines: 1, ellipsis: "…" },
      fontProvider,
    )
      .pushStyle({
        color: Skia.Color(swatchText),
        fontFamilies: ["Inter"],
        fontSize,
      })
      .addText(initials)
      .pop()
      .build();
    p.layout(innerR * 2);
    return p;
  }, [fontProvider, initials, swatchText, fontSize, innerR]);

  const circleClip = rrect(
    rect(cx - innerR, cy - innerR, innerR * 2, innerR * 2),
    innerR,
    innerR,
  );

  return (
    <Group transform={transform} zIndex={depth} layer={layer}>
      {focusColor ? (
        <Circle
          cx={cx}
          cy={cy}
          r={radius + 4}
          color={focusColor}
          style="stroke"
          strokeWidth={2}
        />
      ) : null}
      {/* Canonical status outline; rogue retains its cold body treatment. */}
      <Circle cx={cx} cy={cy} r={radius} color={bodyFill} />
      {image ? (
        // Photo disc, clipped to a circle, cover-fit.
        <Group clip={circleClip}>
          <SkiaImage
            image={image}
            x={cx - innerR}
            y={cy - innerR}
            width={innerR * 2}
            height={innerR * 2}
            fit="cover"
          />
        </Group>
      ) : (
        // Fallback: deterministic swatch + initials.
        <>
          <Circle cx={cx} cy={cy} r={innerR} color={swatch} />
          {paragraph ? (
            <Paragraph
              paragraph={paragraph}
              x={cx - innerR}
              y={cy - fontSize * 0.72}
              width={innerR * 2}
            />
          ) : null}
        </>
      )}
    </Group>
  );
}
