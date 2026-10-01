/**
 * ORRERY LAB B — L2–L4 body slot: sun, contact bodies, moons.
 *
 * WP-1.0: parity port of `SunBody` / `OrbitBody` / `SatelliteBody` with two
 * structural changes (research 03 §2.4):
 * - NO per-body `layer` (saveLayer) and no per-frame `Skia.Paint()`; alpha is
 *   the root Group's `opacity`, and a culled / faded-out body collapses to
 *   scale 0 (`labBillboard`) so nothing of it draws.
 * - O(1) lookups through `frameIndex` instead of `frame.bodies.find`.
 * Initials use a glyph `Text` (respects paint alpha) instead of a Paragraph.
 *
 * Hard rule kept: every body is drawn at exactly the frame radius (world radius
 * × billboard scale), so hit radius, label anchors and focus cards are
 * unchanged. Photos keep `useOrreryPhoto` (unconditional, keyed per resource;
 * 512 px cap; owned disposal). WP-1.2 replaces the drawing with the lit-surface
 * shader, atmospheres, corona and lit moons — keep the keyed components and the
 * root-Group contract (transform length 3, zIndex = depth, no `layer`).
 */
import {
  Circle,
  Group,
  matchFont,
  rect,
  rrect,
  type SkFont,
  Image as SkiaImage,
  type SkTypefaceFontProvider,
  Text,
} from "@shopify/react-native-skia";
import { useMemo } from "react";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import type { AnimatedFrame } from "@/logic/orrery-frame";
import { useOrreryPhoto } from "../use-orrery-photo";
import { useLabRenderContext } from "./labb-context";
import { type FrameIndex, labBillboard } from "./labb-frame-index";

// --- Tunables -----------------------------------------------------------------
const OUTLINE_WIDTH = 3;
const FOCUS_GAP = 4;
const SUN_FOCUS_GAP = 6;
const GLOW_OPACITY = 0.35;
const PULSE_RADIUS_FRAC = 0.1;
const PULSE_OPACITY_FRAC = 0.4;
const PULSE_SPEED = 0.002;
/** Glyph baseline offset as a fraction of font size (visual centring). */
const GLYPH_BASELINE = 0.36;

/** Glyph width cap as a fraction of the inner disc diameter. */
const GLYPH_MAX_FRACTION = 0.8;

/**
 * Hermes has no `Intl.Segmenter`, so `orreryInitials` returns the WHOLE name on
 * device (legacy hid that behind a one-line Paragraph ellipsis: "El…"). The lab
 * glyph path derives real initials: first code point of the first two words.
 * (Code point, not grapheme — a lab compromise for combining marks / ZWJ.)
 */
export function labInitials(initials: string): string {
  const words = initials.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1 && Array.from(words[0]).length <= 2)
    return words[0].toUpperCase();
  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toUpperCase();
}

/** Lazily match a glyph font from the bundled provider; null when unavailable. */
function useInitialsFont(
  fontProvider: SkTypefaceFontProvider | null,
  size: number,
): SkFont | null {
  return useMemo(() => {
    if (!fontProvider) return null;
    try {
      return matchFont(
        { fontFamily: "Inter", fontSize: size, fontWeight: "600" },
        fontProvider,
      );
    } catch {
      return null;
    }
  }, [fontProvider, size]);
}

function useBillboard(
  frame: SharedValue<AnimatedFrame>,
  frameIndex: SharedValue<FrameIndex>,
  identity: string,
  worldRadius: number,
) {
  const pose = useDerivedValue(() =>
    labBillboard(frame.value, frameIndex.value, identity, worldRadius),
  );
  const transform = useDerivedValue(() => [
    { translateX: pose.value.x },
    { translateY: pose.value.y },
    { scale: pose.value.scale },
  ]);
  const depth = useDerivedValue(() => pose.value.depth);
  const opacity = useDerivedValue(() => pose.value.opacity);
  return { transform, depth, opacity };
}

function Initials({
  font,
  initials,
  radius,
  color,
}: {
  font: SkFont | null;
  initials: string;
  radius: number;
  color: string;
}) {
  const glyphs = labInitials(initials);
  if (!font || glyphs.length === 0) return null;
  let width = 0;
  try {
    width = font.measureText(glyphs).width;
  } catch {
    width = radius;
  }
  const max = radius * 2 * GLYPH_MAX_FRACTION;
  const fit = width > max ? max / width : 1;
  return (
    <Group transform={[{ scale: fit }]}>
      <Text
        font={font}
        text={glyphs}
        x={-width / 2}
        y={radius * GLYPH_BASELINE}
        color={color}
      />
    </Group>
  );
}

export interface LabBodyCommon {
  identity: string;
  frame: SharedValue<AnimatedFrame>;
  frameIndex: SharedValue<FrameIndex>;
  radius: number;
  photo: string | null;
  swatch: string;
  swatchText: string;
  initials: string;
  fontProvider: SkTypefaceFontProvider | null;
  focusColor?: string;
}

export function LabContactBody({
  identity,
  frame,
  frameIndex,
  radius,
  photo,
  swatch,
  swatchText,
  initials,
  fontProvider,
  focusColor,
  bodyFill,
}: LabBodyCommon & { bodyFill: string }) {
  const { transform, depth, opacity } = useBillboard(
    frame,
    frameIndex,
    identity,
    radius,
  );
  const image = useOrreryPhoto(photo);
  const innerR = Math.max(1, radius - OUTLINE_WIDTH / 2);
  const font = useInitialsFont(fontProvider, radius);
  const clip = rrect(
    rect(-innerR, -innerR, innerR * 2, innerR * 2),
    innerR,
    innerR,
  );
  return (
    <Group transform={transform} zIndex={depth} opacity={opacity}>
      {focusColor ? (
        <Circle
          cx={0}
          cy={0}
          r={radius + FOCUS_GAP}
          color={focusColor}
          style="stroke"
          strokeWidth={2}
        />
      ) : null}
      <Circle cx={0} cy={0} r={radius} color={bodyFill} />
      {image ? (
        <Group clip={clip}>
          <SkiaImage
            image={image}
            x={-innerR}
            y={-innerR}
            width={innerR * 2}
            height={innerR * 2}
            fit="cover"
          />
        </Group>
      ) : (
        <>
          <Circle cx={0} cy={0} r={innerR} color={swatch} />
          <Initials
            font={font}
            initials={initials}
            radius={radius}
            color={swatchText}
          />
        </>
      )}
    </Group>
  );
}

export function LabSunBody({
  identity,
  frame,
  frameIndex,
  radius,
  photo,
  swatch,
  swatchText,
  initials,
  fontProvider,
  focusColor,
  glowColor,
  glowRadius,
}: LabBodyCommon & { glowColor: string; glowRadius: number }) {
  const { transform, depth, opacity } = useBillboard(
    frame,
    frameIndex,
    identity,
    radius,
  );
  const image = useOrreryPhoto(photo);
  const ctx = useLabRenderContext();
  const pulse = useDerivedValue(() => {
    if (!ctx || ctx.reducedMotion.value || !ctx.fxFlags.value.flags.sunPulse)
      return 0;
    return Math.sin(ctx.ambient.value * PULSE_SPEED);
  });
  const glowR = useDerivedValue(
    () => glowRadius * (1 + PULSE_RADIUS_FRAC * pulse.value),
  );
  const glowA = useDerivedValue(
    () => GLOW_OPACITY * (1 + PULSE_OPACITY_FRAC * pulse.value),
  );
  const font = useInitialsFont(fontProvider, radius);
  const clip = rrect(
    rect(-radius, -radius, radius * 2, radius * 2),
    radius,
    radius,
  );
  return (
    <Group transform={transform} zIndex={depth} opacity={opacity}>
      {focusColor ? (
        <Circle
          cx={0}
          cy={0}
          r={radius + SUN_FOCUS_GAP}
          color={focusColor}
          style="stroke"
          strokeWidth={2}
        />
      ) : null}
      <Circle cx={0} cy={0} r={glowR} color={glowColor} opacity={glowA} />
      <Circle cx={0} cy={0} r={radius + 2} color={glowColor} />
      {image ? (
        <Group clip={clip}>
          <SkiaImage
            image={image}
            x={-radius}
            y={-radius}
            width={radius * 2}
            height={radius * 2}
            fit="cover"
          />
        </Group>
      ) : (
        <>
          <Circle cx={0} cy={0} r={radius} color={swatch} />
          <Initials
            font={font}
            initials={initials}
            radius={radius}
            color={swatchText}
          />
        </>
      )}
    </Group>
  );
}

export function LabMoon({
  identity,
  frame,
  frameIndex,
  color,
  focusColor,
}: {
  identity: string;
  frame: SharedValue<AnimatedFrame>;
  frameIndex: SharedValue<FrameIndex>;
  color: string;
  focusColor?: string;
}) {
  const { transform, depth, opacity } = useBillboard(
    frame,
    frameIndex,
    identity,
    1,
  );
  return (
    <Group transform={transform} zIndex={depth} opacity={opacity}>
      <Circle cx={0} cy={0} r={1} color={color} />
      {focusColor ? (
        <Circle
          cx={0}
          cy={0}
          r={1.5}
          style="stroke"
          strokeWidth={0.3}
          color={focusColor}
        />
      ) : null}
    </Group>
  );
}
