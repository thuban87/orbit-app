/**
 * SunBody (ORR-05) — the orrery's centre sun, rendered ONCE (never in a map) as a
 * child of the `OrreryV2Canvas` `<Canvas>` subtree.
 *
 * Owns the sun's OWN photo hook, `useOrreryPhoto` (the occupant photo) — kept in
 * its own component for the same Rules-of-Hooks reason as `OrbitBody` (13-07 adds
 * a glow-pulse `useDerivedValue` here). C2-1 — the photo hook is UNCONDITIONAL
 * and takes the nullable occupant photo directly (self with no profile photo, or
 * a contact with no photo); a null path or a failed load → a null image → the
 * swatch + initials fallback. D-11: `useOrreryPhoto` caps the Skia texture at
 * 512 px (a 1024 WebP master is downsampled, a legacy 512 master passes through)
 * and disposes every SkImage it creates.
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
} from "@shopify/react-native-skia";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import type { BillboardPose } from "@/logic/orrery-frame";
import { useReducedMotionShared } from "@/theme/use-reduced-motion";
import { useOrreryClock } from "./orrery-clock-context";
import type { OrreryInitialsSpec } from "./resources/orrery-text-service";
import { useOrreryPhoto } from "./use-orrery-photo";

export interface SunBodyProps {
  projection?: SharedValue<BillboardPose>;
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
  /**
   * 38.7-04 (D-46/D-52): the published initials spec. The glyph Paragraph is
   * built by the OrreryTextService (ink `avatarSwatchText`); a body without an
   * admitted entry draws the plain swatch disc.
   */
  initialsSpec?: SharedValue<OrreryInitialsSpec>;
  /** This body's key in the initials spec (`bodyKey`). */
  textKey?: string;
}

/** Soft-glow halo opacity mid-point (device-UAT tunable, 13-08). */
const GLOW_OPACITY = 0.35;
/** Glow-radius pulse fraction (±10% of glowRadius). */
const PULSE_RADIUS_FRAC = 0.1;
/** Glow-opacity pulse fraction (±this of GLOW_OPACITY). */
const PULSE_OPACITY_FRAC = 0.4;
/** Pulse angular speed (rad/ms) → ~3.1s period (UI-SPEC ~2–4s). */
const PULSE_SPEED = 0.002;

/**
 * 38.7-04: the sun's initials glyph metrics the text publisher keys on (font
 * size ~cap height, device-UAT tunable 13-08, quantised to 0.5 px).
 */
export function sunBodyInitialsLayout(radius: number): {
  fontSize: number;
  maxWidth: number;
} {
  return { fontSize: Math.round(radius * 2) / 2, maxWidth: radius * 2 };
}

export function SunBody({
  cx,
  cy,
  radius,
  glowRadius,
  photo,
  glowColor,
  swatch,
  initialsSpec,
  textKey,
  projection,
}: SunBodyProps) {
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
  // C2-1: unconditional hook, null-guarded source.
  const image = useOrreryPhoto(photo);

  // ORR-03 — slow sun-glow pulse off the ambient clock provided by OrreryV2Canvas
  // (M5 — SunBody never calls useClock itself). When no clock is in scope (unit
  // harness), fall back to the static mid-point (no pulse). Bodies do NOT animate;
  // only the sun's glow halo breathes (~3s) — radius ±10%, opacity ±40%.
  const clock = useOrreryClock();

  // THEME-06 / REVIEWS 23-06 HIGH: SunBody is the SECOND ambient clock consumer, so
  // it MUST gate too — gating only the canvas would leave the sun pulsing under
  // reduced motion. Read the live signal DIRECTLY as a SharedValue (NOT via prop or
  // OrreryClockContext — SunBody is built before it is handed to the canvas, and
  // the context carries only the clock; the direct hook keeps the fix inside this
  // file, its files_modified scope). The worklet reads `.value` — never a React
  // boolean, no per-frame setState (D-07). Reduced motion ON -> the glow holds at
  // its static mid-point (radius + opacity), matching the no-clock fallback.
  const reducedMotion = useReducedMotionShared();
  const pulseGlowRadius = useDerivedValue(() => {
    if (!clock || reducedMotion.value) {
      return glowRadius;
    }
    const t = Math.sin(clock.value * PULSE_SPEED); // −1..1
    return glowRadius * (1 + PULSE_RADIUS_FRAC * t);
  });
  const pulseGlowOpacity = useDerivedValue(() => {
    if (!clock || reducedMotion.value) {
      return GLOW_OPACITY;
    }
    const t = Math.sin(clock.value * PULSE_SPEED); // −1..1
    return GLOW_OPACITY * (1 + PULSE_OPACITY_FRAC * t);
  });

  const { fontSize } = sunBodyInitialsLayout(radius);
  // Null until the service admits this body's initials (font loaded, body
  // visible and large enough) → the plain swatch shows with no glyph.
  const paragraph = useDerivedValue(() =>
    textKey === undefined
      ? null
      : (initialsSpec?.value.initials[textKey]?.paragraph ?? null),
  );

  const circleClip = rrect(
    rect(cx - radius, cy - radius, radius * 2, radius * 2),
    radius,
    radius,
  );

  return (
    <Group transform={transform} zIndex={depth} layer={layer}>
      {/* Glow halo — pulses (radius + opacity) off the ambient clock. */}
      <Circle
        cx={cx}
        cy={cy}
        r={pulseGlowRadius}
        color={glowColor}
        opacity={pulseGlowOpacity}
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
          <Paragraph
            paragraph={paragraph}
            x={cx - radius}
            y={cy - fontSize * 0.72}
            width={radius * 2}
          />
        </>
      )}
    </Group>
  );
}
