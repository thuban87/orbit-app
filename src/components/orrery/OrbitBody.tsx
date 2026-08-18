/**
 * OrbitBody (ORR-01) — ONE orrery planet, a keyed `<OrbitBody key={contact.id}/>`
 * child of the `OrreryCanvas` `<Canvas>` subtree.
 *
 * H1 (Rules of Hooks) — the WHOLE reason this is its own component: the orrery
 * renders a DYNAMIC list of bodies, and each body needs its own Skia `useImage`
 * (photo) plus, in 13-07, its own morph `useDerivedValue`. A hook called inside a
 * `.map()` over that list would change the caller's hook COUNT with the contact
 * count and crash. Isolating every per-body hook in this keyed child keeps
 * `OrreryScreen`/`OrreryCanvas` at a fixed hook count. OrreryScreen's `.map()`
 * returns `<OrbitBody/>` ELEMENTS only — it calls no hook.
 *
 * C2-1 — the photo hook is UNCONDITIONAL but its SOURCE is null-guarded:
 * `useImage(photo ? resolvePhotoUri(photo) : null)`. The orrery read returns
 * `photo: string | null` and `resolvePhotoUri` requires a `string`, so a bare
 * `resolvePhotoUri(photo)` would not type-check; `useImage(null)` yields a null
 * image → the themed swatch + initials fallback path.
 *
 * The status shows as a coloured outline ring in `bodyFill` (the rogue body's
 * cold `rogueExtinguished`); the disc inside is the photo (clipped `fit="cover"`)
 * or the deterministic `avatarSwatches` swatch + initials (Paragraph API, bundled
 * `Inter` font — a NEW-to-repo Skia idiom, first proven on device in 13-08 UAT).
 * Every colour is a passed theme token — no hex (check:colors).
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
import {
  interpolateColor,
  type SharedValue,
  useDerivedValue,
} from "react-native-reanimated";
import { resolvePhotoUri } from "@/services/photos/photo-storage";

export interface OrbitBodyProps {
  /** Body centre x at the STATUS (morph=0) position — the DRAWN position (radius + drift, statusAngle). */
  cx: number;
  /** Body centre y at the STATUS (morph=0) position. */
  cy: number;
  /** Planet photo-circle radius (`C.PLANET_RADIUS`). */
  radius: number;
  /** Raw relative photo path or null (C2-1 — null-guarded before resolvePhotoUri). */
  photo: string | null;
  /** The FULL (status view) body treatment / outline colour (`orreryRingStyle.bodyFill`). */
  bodyFill: string;
  /** The MUTED (relationship view) body outline colour the morph fades toward (`muted*`/`rogueExtinguished`). */
  mutedFill: string;
  /** The deterministic fallback swatch (`avatarSwatches[swatchIndex(name)]`). */
  swatch: string;
  /** The on-swatch initials glyph colour (`avatarSwatchText`). */
  swatchText: string;
  /** The contact's initials (empty string → swatch with no glyph). */
  initials: string;
  /** The bundled-font provider from `useFonts`; null until the font loads. */
  fontProvider: SkTypefaceFontProvider | null;
  /**
   * The single view-morph shared value (0 = Status, 1 = Relationship). H1 — this
   * body's morph `useDerivedValue`s live HERE (keyed child), never in a `.map()`.
   */
  morph: SharedValue<number>;
  /** The FIXED drawn orbit radius (distance from centre) — the shared axis, never interpolated. */
  orbitRadius: number;
  /** The Status-view angle (`progressToAngle(progress)`) — the morph endpoint at morph=0. */
  statusAngle: number;
  /**
   * The shortest signed delta from `statusAngle` to the Relationship even-spread
   * angle (`shortestAngleDelta`, precomputed on JS) — the morph takes the short way
   * across the 2π wrap (Pitfall 2). Angle at morph t = statusAngle + t·angleDelta.
   */
  angleDelta: number;
}

/** Status-outline stroke width around the planet disc. */
const OUTLINE_WIDTH = 3;

export function OrbitBody({
  cx,
  cy,
  radius,
  photo,
  bodyFill,
  mutedFill,
  swatch,
  swatchText,
  initials,
  fontProvider,
  morph,
  orbitRadius,
  statusAngle,
  angleDelta,
}: OrbitBodyProps) {
  // C2-1: unconditional hook, null-guarded source (photo may be null).
  const image = useImage(photo ? resolvePhotoUri(photo) : null);

  // H1/ORR-02 — the per-body morph, off the JS thread (UI-thread worklets):
  //  • ANGLE: statusAngle → restAngle via the precomputed shortestAngleDelta, so
  //    the morph takes the short way across the 2π wrap (Pitfall 2). The whole body
  //    is drawn at its FIXED status position (cx, cy) and TRANSLATED by the polar
  //    delta between the status angle and the live morph angle — radius is FIXED
  //    (the shared axis), never interpolated.
  //  • COLOUR: the status-outline fades full → muted (`interpolateColor`).
  const bodyTransform = useDerivedValue(() => {
    const angle = statusAngle + morph.value * angleDelta;
    const dx = orbitRadius * (Math.sin(angle) - Math.sin(statusAngle));
    const dy = -orbitRadius * (Math.cos(angle) - Math.cos(statusAngle));
    return [{ translateX: dx }, { translateY: dy }];
  });
  const outlineColor = useDerivedValue(() =>
    interpolateColor(morph.value, [0, 1], [bodyFill, mutedFill]),
  );

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
    p.layout(innerR * 2);
    return p;
  }, [fontProvider, initials, swatchText, fontSize, innerR]);

  const circleClip = rrect(
    rect(cx - innerR, cy - innerR, innerR * 2, innerR * 2),
    innerR,
    innerR,
  );

  return (
    // The whole body is placed at its status position and translated by the morph
    // (radius fixed — only the angle moves). Colour morphs on the outline circle.
    <Group transform={bodyTransform}>
      {/* Status body treatment — the coloured outline ring (morphs full → muted). */}
      <Circle cx={cx} cy={cy} r={radius} color={outlineColor} />
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
