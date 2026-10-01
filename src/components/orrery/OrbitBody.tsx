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
  type SkTypefaceFontProvider,
  TextAlign,
} from "@shopify/react-native-skia";
import { useEffect, useMemo } from "react";
import {
  type SharedValue,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { BillboardPose } from "@/logic/orrery-frame";
import { useReducedMotionShared } from "@/theme/use-reduced-motion";
import {
  BodyLightOverlay,
  type DeepFieldBodyContext,
} from "./lab/BodyOverlays";
import { BODY_ENTER_FADE_MS, FOCUS_BODY_DIM } from "./lab/deep-field-config";
import { bodyDepthScale, bodyVisualScale } from "./lab/deep-field-math";
import { useOrreryPhoto } from "./use-orrery-photo";

export interface OrbitBodyProps {
  projection?: SharedValue<BillboardPose>;
  focusColor?: string;
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
  /** The on-swatch initials glyph colour (`avatarSwatchText`). */
  swatchText: string;
  /** The contact's initials (empty string → swatch with no glyph). */
  initials: string;
  /** The bundled-font provider from `useFonts`; null until the font loads. */
  fontProvider: SkTypefaceFontProvider | null;
  /** ORRERY LAB A: this body's `bodyKey` (light lookup). */
  lightKey?: string;
  /** ORRERY LAB A: deep-field lighting context (absent → legacy flat body). */
  deepField?: DeepFieldBodyContext;
}

/** Status-outline stroke width around the planet disc. */
const OUTLINE_WIDTH = 3;
/** ORRERY LAB A: photo fade-in on resolve (ms). */
const PHOTO_FADE_MS = 260;

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
  lightKey,
  deepField,
}: OrbitBodyProps) {
  // ORRERY LAB A (pass 1): presentation-only visual scale — small overview
  // bodies grow toward the 22 dp tap radius (never beyond it), so what you
  // see is what you can tap. The frame's radius/hitRadius/labels are untouched.
  const lab = !!deepField;
  // Pass 2: far bodies a touch smaller (depth cue; presentation only).
  const light = deepField?.light;
  const transform = useDerivedValue(() =>
    projection
      ? [
          { translateX: projection.value.x },
          { translateY: projection.value.y },
          {
            scale:
              projection.value.scale *
              (lab ? bodyVisualScale(radius * projection.value.scale) : 1) *
              (light && lightKey
                ? bodyDepthScale(light.value[lightKey]?.[2] ?? 0)
                : 1),
          },
        ]
      : [],
  );
  const depth = useDerivedValue(() => projection?.value.depth ?? 0);
  // ORRERY LAB A (pass 3): presentation-only alpha — a body fades in when it
  // mounts (entering bodies whose components land after the switch has
  // started no longer pop), and unfocused bodies dim slightly while another
  // body is focused. Instant / off under reduced motion. Hit/labels untouched.
  const reducedMotion = useReducedMotionShared();
  const enter = useSharedValue(lab ? 0 : 1);
  useEffect(() => {
    if (!lab) return;
    enter.value = reducedMotion.value
      ? 1
      : withTiming(1, { duration: BODY_ENTER_FADE_MS });
  }, [enter, lab, reducedMotion]);
  // Focus state is a UI-thread shared value (pass 3): the dim lands with the
  // focus, not after the seconds-long Skia re-record of the focus commit.
  const focusMix = deepField?.focusMix;
  const focusState = deepField?.focus;
  const layer = useDerivedValue(() => {
    const paint = Skia.Paint();
    const dim =
      focusMix && focusState && lightKey && !focusState.value.keys[lightKey]
        ? 1 - FOCUS_BODY_DIM * focusMix.value
        : 1;
    paint.setAlphaf((projection?.value.opacity ?? 1) * enter.value * dim);
    return paint;
  });
  // C2-1: unconditional hook, null-guarded source (photo may be null). D-11:
  // useOrreryPhoto caps the texture at 512 px and owns SkImage disposal.
  const image = useOrreryPhoto(photo);
  // ORRERY LAB A (pass 2): the photo cross-fades over the initials when it
  // resolves (remounts re-load photos asynchronously — D-41 keeps no SkImage
  // cache, see _notes/PASS-2.md). Instant under reduced motion. The hook's
  // ownership/disposal contract is untouched: this only animates opacity.
  const photoOpacity = useSharedValue(1);
  useEffect(() => {
    if (!lab || !image) return;
    photoOpacity.value = 0;
    photoOpacity.value = reducedMotion.value
      ? 1
      : withTiming(1, { duration: PHOTO_FADE_MS });
  }, [image, lab, photoOpacity, reducedMotion]);

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
        // ORRERY LAB A: semibold initials hold up at overview size.
        ...(lab ? { fontStyle: { weight: 600 } } : {}),
      })
      .addText(initials)
      .pop()
      .build();
    p.layout(innerR * 2);
    return p;
  }, [fontProvider, initials, swatchText, fontSize, innerR, lab]);

  const circleClip = rrect(
    rect(cx - innerR, cy - innerR, innerR * 2, innerR * 2),
    innerR,
    innerR,
  );

  return (
    <Group transform={transform} zIndex={depth} layer={layer}>
      {/* ORRERY LAB A: the focus reticle is FocusReticleLayer (pass 3). */}
      {focusColor && deepField ? null : focusColor ? (
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
      {image && lab ? (
        // Lab: initials stay underneath while the photo fades in over them.
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
          <Group clip={circleClip} opacity={photoOpacity}>
            <SkiaImage
              image={image}
              x={cx - innerR}
              y={cy - innerR}
              width={innerR * 2}
              height={innerR * 2}
              fit="cover"
            />
          </Group>
        </>
      ) : image ? (
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
      {/* ORRERY LAB A: sun-lit shading + status atmosphere (overlay only). */}
      {deepField && lightKey ? (
        <BodyLightOverlay
          radius={radius}
          lightKey={lightKey}
          rimColor={bodyFill}
          projection={projection}
          context={deepField}
        />
      ) : null}
    </Group>
  );
}
