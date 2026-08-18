/**
 * SunBody (ORR-05) — the orrery's centre sun, rendered ONCE (never in a map) as a
 * child of the `OrreryCanvas` `<Canvas>` subtree.
 *
 * Owns the sun's OWN Skia `useImage` (the occupant photo) — kept in its own
 * component for the same Rules-of-Hooks reason as `OrbitBody` (13-07 adds a
 * glow-pulse `useDerivedValue` here). C2-1 — the photo hook is UNCONDITIONAL but
 * its source is null-guarded (`useImage(occupantPhoto ? resolvePhotoUri(...) :
 * null)`), because the occupant photo is nullable (self with no profile photo, or
 * a contact with no photo) and `resolvePhotoUri` requires a `string`; a null image
 * → the swatch + initials fallback.
 *
 * The glow colour is resolved upstream by `resolveSunOccupant`: self → the picked
 * `starPalette` token; a contact → that contact's status colour; a never-contacted
 * contact-sun → the neutral fallback (C2-2). Every colour is a passed token — no
 * hex (check:colors).
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
import { resolvePhotoUri } from "@/services/photos/photo-storage";

export interface SunBodyProps {
  /** Canvas centre x (`C.cx`). */
  cx: number;
  /** Canvas centre y (`C.cy`). */
  cy: number;
  /** Sun disc radius (`C.SUN_RADIUS`). */
  radius: number;
  /** Glow halo radius (`C.SUN_GLOW_RADIUS`). */
  glowRadius: number;
  /** The occupant photo (raw relative path) or null — null-guarded (C2-1). */
  photo: string | null;
  /** The resolved glow colour (`resolveSunOccupant().glowColor`). */
  glowColor: string;
  /** The occupant's fallback swatch (`avatarSwatches[swatchIndex(name)]`). */
  swatch: string;
  /** The on-swatch initials glyph colour (`avatarSwatchText`). */
  swatchText: string;
  /** The occupant's initials (empty → swatch with no glyph). */
  initials: string;
  /** The bundled-font provider from `useFonts`; null until the font loads. */
  fontProvider: SkTypefaceFontProvider | null;
}

/** Soft-glow halo opacity (device-UAT tunable, 13-08; 13-07 pulses it). */
const GLOW_OPACITY = 0.35;

export function SunBody({
  cx,
  cy,
  radius,
  glowRadius,
  photo,
  glowColor,
  swatch,
  swatchText,
  initials,
  fontProvider,
}: SunBodyProps) {
  // C2-1: unconditional hook, null-guarded source.
  const image = useImage(photo ? resolvePhotoUri(photo) : null);

  const fontSize = radius; // ~cap height fits the disc (device-UAT tunable, 13-08).

  const paragraph = useMemo(() => {
    if (!fontProvider || initials.length === 0) {
      return null;
    }
    const p = Skia.ParagraphBuilder.Make(
      { textAlign: TextAlign.Center },
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
    p.layout(radius * 2);
    return p;
  }, [fontProvider, initials, swatchText, fontSize, radius]);

  const circleClip = rrect(
    rect(cx - radius, cy - radius, radius * 2, radius * 2),
    radius,
    radius,
  );

  return (
    <Group>
      {/* Glow halo. */}
      <Circle
        cx={cx}
        cy={cy}
        r={glowRadius}
        color={glowColor}
        opacity={GLOW_OPACITY}
      />
      {/* Glow rim just outside the disc. */}
      <Circle cx={cx} cy={cy} r={radius + 2} color={glowColor} />
      {image ? (
        <Group clip={circleClip}>
          <SkiaImage
            image={image}
            x={cx - radius}
            y={cy - radius}
            width={radius * 2}
            height={radius * 2}
            fit="cover"
          />
        </Group>
      ) : (
        <>
          <Circle cx={cx} cy={cy} r={radius} color={swatch} />
          {paragraph ? (
            <Paragraph
              paragraph={paragraph}
              x={cx - radius}
              y={cy - fontSize * 0.72}
              width={radius * 2}
            />
          ) : null}
        </>
      )}
    </Group>
  );
}
