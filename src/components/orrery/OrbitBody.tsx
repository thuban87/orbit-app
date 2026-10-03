/**
 * ADR-077: canonical status body drawn in its projected parent coordinate space.
 * ADR-048 remains live for static/status/keyed rendering only; ADR-077 partially
 * supersedes its dual-view/morph behavior, which no longer governs this body.
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
} from "@shopify/react-native-skia";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import type { BillboardPose } from "@/logic/orrery-frame";
import type { OrreryInitialsSpec } from "./resources/orrery-text-service";
import { useOrreryPhoto } from "./use-orrery-photo";

export interface OrbitBodyProps {
  projection?: SharedValue<BillboardPose>;
  /** Body center x in the projected wrapper local space. */
  cx: number;
  /** Body center y in the projected wrapper local space. */
  cy: number;
  /** Planet photo-circle radius (`C.PLANET_RADIUS`). */
  radius: number;
  /** Raw relative photo path or null (C2-1 — `useOrreryPhoto` null-guards it). */
  photo: string | null;
  /** The canonical status body treatment / outline colour (`orreryRingStyle.bodyFill`). */
  bodyFill: string;
  /** The deterministic fallback swatch (`avatarSwatches[swatchIndex(name)]`). */
  swatch: string;
  /**
   * 38.7-04 (D-46/D-52): the published initials spec. The glyph Paragraph is
   * built by the OrreryTextService (ink `avatarSwatchText`); a body without an
   * admitted entry draws the plain swatch disc.
   */
  initialsSpec?: SharedValue<OrreryInitialsSpec>;
  /** This body's key in the initials spec (`bodyKey`). */
  textKey?: string;
}

/** Status-outline stroke width around the planet disc. */
const OUTLINE_WIDTH = 3;

/**
 * 38.7-04: the initials glyph metrics the text publisher keys on. The font
 * size (~cap height fits the disc; device-UAT tunable, 13-08) is quantised to
 * 0.5 px so near-equal radii share one cached Paragraph.
 */
export function orbitBodyInitialsLayout(radius: number): {
  fontSize: number;
  maxWidth: number;
} {
  return {
    fontSize: Math.round(radius * 2) / 2,
    maxWidth: Math.max(1, radius - OUTLINE_WIDTH / 2) * 2,
  };
}

export function OrbitBody({
  cx,
  cy,
  radius,
  photo,
  bodyFill,
  swatch,
  initialsSpec,
  textKey,
  projection,
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
  // C2-1: unconditional hook, null-guarded source (photo may be null). D-11:
  // useOrreryPhoto caps the texture at 512 px and owns SkImage disposal.
  const image = useOrreryPhoto(photo);

  // Inner disc sits inside the status outline ring.
  const innerR = Math.max(1, radius - OUTLINE_WIDTH / 2);
  const { fontSize } = orbitBodyInitialsLayout(radius);
  // Null until the service admits this body's initials (font loaded, body
  // visible and large enough) → the plain swatch shows with no glyph.
  const paragraph = useDerivedValue(() =>
    textKey === undefined
      ? null
      : (initialsSpec?.value.initials[textKey]?.paragraph ?? null),
  );

  const circleClip = rrect(
    rect(cx - innerR, cy - innerR, innerR * 2, innerR * 2),
    innerR,
    innerR,
  );

  return (
    <Group transform={transform} zIndex={depth} layer={layer}>
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
          <Paragraph
            paragraph={paragraph}
            x={cx - innerR}
            y={cy - fontSize * 0.72}
            width={innerR * 2}
          />
        </>
      )}
    </Group>
  );
}
