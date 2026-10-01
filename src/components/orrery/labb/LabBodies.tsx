/**
 * ORRERY LAB B — L2–L4 body slot: sun, contact bodies, moons.
 *
 * WP-1.0 parity port (kept as the FALLBACK path: flag `bodyLighting` off or a
 * null runtime effect): NO per-body `layer` (saveLayer), no per-frame
 * `Skia.Paint()`, alpha = the root Group's `opacity`, culled / faded-out bodies
 * collapse to scale 0 (`labBillboard`), O(1) lookups through `frameIndex`.
 *
 * WP-1.2 "worlds" (research 03 §1.3 L2–L4): ONE shader draw per body, a circle
 * of radius r·reach whose runtime shader paints
 * - inside r (exactly the frame radius — hit radius, label anchors and focus
 *   cards are unchanged): the photo, or a procedural banded surface in the
 *   contact's swatch, LIT from the sun (screen-space body → sun direction) with
 *   a readability floor, a status Fresnel limb + 2-dp crisp status rim,
 *   per-status desaturation and far-side depth haze;
 * - outside r: the status atmosphere (dark) or an anti-sun contact shadow
 *   (light). Materials per status live in `labb-bodies-logic.ts`.
 * The sun is an emissive stellar surface (or the emissive photo) with a
 * ray-structured corona to 2r; moons are tiny lit spheres.
 *
 * Root-Group contract kept: transform length 3, zIndex = depth, no `layer`.
 * Photos keep `useOrreryPhoto` (unconditional, keyed per resource; 512 px cap;
 * owned disposal) — the SkImage is only referenced by an ImageShader child.
 */
import {
  Circle,
  Group,
  ImageShader,
  matchFont,
  rect,
  rrect,
  Shader,
  type SkFont,
  type SkImage,
  Image as SkiaImage,
  type SkTypefaceFontProvider,
  Text,
} from "@shopify/react-native-skia";
import { useMemo } from "react";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import type { ProfileStatus } from "@/db/contact-status-read";
import type { AnimatedFrame } from "@/logic/orrery-frame";
import { type LabFxProfile, labColor } from "@/theme/orrery-lab-fx";
import type { ThemePalette } from "@/theme/theme-types";
import { useOrreryPhoto } from "../use-orrery-photo";
import {
  BODY_REACH,
  type LabBodyStatic,
  type LabMoonStatic,
  type LabSunStatic,
  labBodyFrameUniforms,
  labBodyMaterial,
  labLightDir,
  labMoonFrameUniforms,
  labSeed,
  labSunFrameUniforms,
  SUN_REACH,
} from "./labb-bodies-logic";
import { useLabRenderContext } from "./labb-context";
import { getLabEffect } from "./labb-effects";
import { bodyAt, type FrameIndex, labBillboard } from "./labb-frame-index";
import {
  bodySwitchFx,
  CORONA_FLARE,
  switchFxLive,
  warpAmount,
} from "./labb-switch-logic";
import { mixVec, tokenToVec3, type Vec3 } from "./labb-uniforms";

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
  opacity,
}: {
  font: SkFont | null;
  initials: string;
  radius: number;
  color: string;
  /** WP-2.1: glyphs fade with the departing-body dissolve. */
  opacity?: SharedValue<number>;
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
    <Group transform={[{ scale: fit }]} opacity={opacity}>
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

/** Shared look inputs for the lit (WP-1.2) path. */
export interface LabWorldLook {
  /** `bodyLighting` flag (React side; heavy: swaps the whole draw path). */
  lit: boolean;
  colors: ThemePalette;
  profile: LabFxProfile;
  /** Sky token value (haze target). */
  sky: string;
  /** Scene extent (world units) — normalises the depth haze. */
  extent: number;
  /** `moonShader` flag: per-moon runtime shader instead of the cheap moon. */
  moonShader?: boolean;
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
  look?: LabWorldLook;
}

/** Local-coordinate rect of a disc of radius r (photo ImageShader placement). */
function discRect(r: number) {
  return rect(-r, -r, r * 2, r * 2);
}

/** The flat WP-1.0 contact disc (fallback path). */
function FlatContactDisc({
  radius,
  image,
  swatch,
  bodyFill,
}: {
  radius: number;
  image: SkImage | null;
  swatch: string;
  bodyFill: string;
}) {
  const innerR = Math.max(1, radius - OUTLINE_WIDTH / 2);
  const clip = rrect(discRect(innerR), innerR, innerR);
  return (
    <>
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
        <Circle cx={0} cy={0} r={innerR} color={swatch} />
      )}
    </>
  );
}

function useBodyStatic(
  look: LabWorldLook | undefined,
  radius: number,
  identity: string,
  swatch: string,
  bodyFill: string,
  status: ProfileStatus | null,
): LabBodyStatic | null {
  return useMemo(() => {
    if (!look) return null;
    const b = look.profile.bodies;
    const m = labBodyMaterial(status);
    const base = tokenToVec3(swatch);
    // Band tone: the swatch pushed toward black / the highlight token (numeric
    // token mixes, C-03), alternating by seed so worlds differ.
    const seed = labSeed(identity);
    // Band tone: the swatch pushed toward black (numeric token mix, C-03);
    // the shader adds highlight-token streaks on top.
    const band = mixVec(base, [0, 0, 0] as Vec3, b.bandContrast * 0.55);
    return {
      uR: radius,
      uStatus: tokenToVec3(bodyFill),
      uSky: tokenToVec3(look.sky),
      uShadow: tokenToVec3(labColor(look.colors, b.shadowInk)),
      uHi: tokenToVec3(labColor(look.colors, b.highlight)),
      uBase: base,
      uBand: band,
      uSeed: seed,
      uFloor: b.lightFloor,
      uWrap: b.wrap,
      uRimPx: b.rimPx,
      uRimStr: b.rimStrength,
      atmo: b.atmosphere * m.atmosphere,
      atmoAdd: b.atmosphereAdditive,
      shadow: b.shadow,
      fresnel: b.fresnel * m.fresnel,
      desat: m.desaturate,
      spec: b.spec * m.spec,
      haze: b.haze,
      intensity: look.profile.intensity,
      extent: look.extent,
    };
  }, [look, radius, identity, swatch, bodyFill, status]);
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
  status = null,
  look,
}: LabBodyCommon & { bodyFill: string; status?: ProfileStatus | null }) {
  const { transform, depth, opacity } = useBillboard(
    frame,
    frameIndex,
    identity,
    radius,
  );
  const image = useOrreryPhoto(photo);
  const font = useInitialsFont(fontProvider, radius);
  const ctx = useLabRenderContext();
  const st = useBodyStatic(look, radius, identity, swatch, bodyFill, status);
  const effect =
    look?.lit && st
      ? getLabEffect(image ? "bodyPhoto" : "bodyProcedural")
      : null;
  const uniforms = useDerivedValue(() => {
    if (!st) return {};
    const f = frame.value;
    const fx = ctx ? ctx.fxFlags.value : null;
    // WP-2.1: dissolve (leaving) / capture flare (entering), pure in progress.
    let sfx: number[] | undefined;
    if (ctx?.sw && fx?.flags.fx) {
      const signal = ctx.sw.signal.value;
      if (switchFxLive(signal, ctx.reducedMotion.value)) {
        const v = bodySwitchFx(ctx.sw.roles.value, identity, signal, true);
        sfx = [fx.flags.fxDissolve ? v[0] : 0, fx.flags.fxFlares ? v[1] : 0];
      }
    }
    return labBodyFrameUniforms(
      bodyAt(f, frameIndex.value, identity),
      f.center.x,
      f.center.y,
      st,
      fx,
      sfx,
    );
  });
  // Glyph initials are drawn over the shader disc; fade them as it dissolves.
  const glyphOpacity = useDerivedValue(() => {
    const k = (uniforms.value as { uK?: number[] }).uK;
    const d = k ? k[0] : 0;
    return d > 0 ? Math.max(0, 1 - Math.sqrt(d) * 1.3) : 1;
  });
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
      {effect ? (
        <Circle cx={0} cy={0} r={radius * BODY_REACH}>
          <Shader source={effect} uniforms={uniforms}>
            {image ? (
              <ImageShader image={image} fit="cover" rect={discRect(radius)} />
            ) : null}
          </Shader>
        </Circle>
      ) : (
        <FlatContactDisc
          radius={radius}
          image={image}
          swatch={swatch}
          bodyFill={bodyFill}
        />
      )}
      {image ? null : (
        <Initials
          font={font}
          initials={initials}
          radius={radius}
          color={swatchText}
          opacity={glyphOpacity}
        />
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
  self = true,
  look,
}: LabBodyCommon & {
  glowColor: string;
  glowRadius: number;
  /** Self sun (a stellar surface when photo-less) vs a contact sun. */
  self?: boolean;
}) {
  const { transform, depth, opacity } = useBillboard(
    frame,
    frameIndex,
    identity,
    radius,
  );
  const image = useOrreryPhoto(photo);
  const ctx = useLabRenderContext();
  const font = useInitialsFont(fontProvider, radius);
  const st = useMemo<LabSunStatic | null>(() => {
    if (!look) return null;
    const b = look.profile.bodies;
    const glow = tokenToVec3(glowColor);
    return {
      uR: radius,
      uGlow: glow,
      uHi: tokenToVec3(labColor(look.colors, b.highlight)),
      uDeep: mixVec(glow, tokenToVec3(look.sky), 0.45),
      uBase: tokenToVec3(swatch),
      plasma: self ? 1 : 0,
      corona: b.corona,
      coronaAdd: b.coronaAdditive,
      intensity: look.profile.intensity,
    };
  }, [look, radius, glowColor, swatch, self]);
  const effect =
    look?.lit && st ? getLabEffect(image ? "sunPhoto" : "sunStar") : null;
  const uniforms = useDerivedValue(() => {
    if (!st) return {};
    // Under reduced motion the ambient clock is NOT read, so the sun's
    // uniforms stop depending on it (static corona).
    const reduced = ctx ? ctx.reducedMotion.value : true;
    const fx = ctx ? ctx.fxFlags.value : null;
    // WP-2.1 corona flare with the switch spin (zero at rest / reduced).
    const signal = ctx?.sw ? ctx.sw.signal.value : null;
    const flare =
      fx?.flags.fx && fx.flags.fxSpool && switchFxLive(signal, reduced)
        ? CORONA_FLARE * warpAmount(signal)
        : 0;
    return labSunFrameUniforms(
      bodyAt(frame.value, frameIndex.value, identity),
      reduced || !ctx ? 0 : ctx.ambient.value,
      reduced,
      st,
      fx,
      flare,
    );
  });
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
  // Initials over a stellar surface use the profile's dark-on-bright ink; over
  // the swatch (contact sun / plasma off) the swatch text token.
  const ink =
    effect && self && look
      ? labColor(look.colors, look.profile.bodies.sunInk)
      : swatchText;
  const clip = rrect(discRect(radius), radius, radius);
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
      {effect ? (
        <Circle cx={0} cy={0} r={radius * SUN_REACH}>
          <Shader source={effect} uniforms={uniforms}>
            {image ? (
              <ImageShader image={image} fit="cover" rect={discRect(radius)} />
            ) : null}
          </Shader>
        </Circle>
      ) : (
        <>
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
            <Circle cx={0} cy={0} r={radius} color={swatch} />
          )}
        </>
      )}
      {image ? null : (
        <Initials font={font} initials={initials} radius={radius} color={ink} />
      )}
    </Group>
  );
}

/** Cheap lit moon (default): dark disc + lit cap offset toward the sun + glint.
 * Three plain circles, no runtime shader — moons are tiny and numerous, and a
 * shader per moon cost ~14 ms gfx p50 on the emulator (PERF-LOG WP-1.2). */
const MOON_DARK_ALPHA = 0.5;
const MOON_CAP_R = 0.8;
const MOON_CAP_OFFSET = 0.2;
const MOON_GLINT_R = 0.22;
const MOON_GLINT_OFFSET = 0.48;
const MOON_GLINT_ALPHA = 0.8;

export function LabMoon({
  identity,
  frame,
  frameIndex,
  color,
  focusColor,
  look,
}: {
  identity: string;
  frame: SharedValue<AnimatedFrame>;
  frameIndex: SharedValue<FrameIndex>;
  color: string;
  focusColor?: string;
  look?: LabWorldLook;
}) {
  const { transform, depth, opacity } = useBillboard(
    frame,
    frameIndex,
    identity,
    1,
  );
  const ctx = useLabRenderContext();
  const st = useMemo<LabMoonStatic | null>(() => {
    if (!look) return null;
    const b = look.profile.bodies;
    return {
      uTone: tokenToVec3(labColor(look.colors, b.moonTone)),
      uHi: tokenToVec3(labColor(look.colors, b.highlight)),
      uSky: tokenToVec3(look.sky),
      floor: b.moonFloor,
      haze: b.haze,
      extent: look.extent,
    };
  }, [look]);
  const shaderOn = look?.lit && look.moonShader;
  const effect = shaderOn && st ? getLabEffect("moon") : null;
  // Worklets capture plain booleans only (not the effect / theme objects).
  const useShader = effect !== null;
  const cheap = !!look?.lit && !useShader;
  const uniforms = useDerivedValue(() => {
    if (!st || !useShader) return {};
    const f = frame.value;
    return labMoonFrameUniforms(
      bodyAt(f, frameIndex.value, identity),
      f.center.x,
      f.center.y,
      st,
      ctx ? ctx.fxFlags.value : null,
    );
  });
  // Cheap path: the cap/glint offset toward the sun (local units, r = 1).
  const capT = useDerivedValue(() => {
    if (!cheap) return [];
    const f = frame.value;
    const b = bodyAt(f, frameIndex.value, identity);
    const l = labLightDir(b ? b.x : 0, b ? b.y : 0, f.center.x, f.center.y);
    return [
      { translateX: l[0] * MOON_CAP_OFFSET },
      { translateY: l[1] * MOON_CAP_OFFSET },
    ];
  });
  const glintT = useDerivedValue(() => {
    if (!cheap) return [];
    const f = frame.value;
    const b = bodyAt(f, frameIndex.value, identity);
    const l = labLightDir(b ? b.x : 0, b ? b.y : 0, f.center.x, f.center.y);
    return [
      { translateX: l[0] * MOON_GLINT_OFFSET },
      { translateY: l[1] * MOON_GLINT_OFFSET },
    ];
  });
  const tone = look
    ? labColor(look.colors, look.profile.bodies.moonTone)
    : color;
  const hi = look
    ? labColor(look.colors, look.profile.bodies.highlight)
    : color;
  return (
    <Group transform={transform} zIndex={depth} opacity={opacity}>
      {effect ? (
        <Circle cx={0} cy={0} r={1}>
          <Shader source={effect} uniforms={uniforms} />
        </Circle>
      ) : look?.lit ? (
        <>
          <Circle cx={0} cy={0} r={1} color={tone} opacity={MOON_DARK_ALPHA} />
          <Group transform={capT}>
            <Circle cx={0} cy={0} r={MOON_CAP_R} color={tone} />
          </Group>
          <Group transform={glintT}>
            <Circle
              cx={0}
              cy={0}
              r={MOON_GLINT_R}
              color={hi}
              opacity={MOON_GLINT_ALPHA}
            />
          </Group>
        </>
      ) : (
        <Circle cx={0} cy={0} r={1} color={color} />
      )}
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
