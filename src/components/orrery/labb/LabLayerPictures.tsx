/**
 * ORRERY LAB B — layer PICTURES (switch-stall fix, flag `layerPictures`;
 * research/SWITCH-STALL-INVESTIGATION.md).
 *
 * The contact bodies + moons (L2–L4) and the labels (L6) are each drawn as ONE
 * SkPicture recorded per frame on the UI thread from ONE derived value, instead
 * of one React component per body / label (4–16 bound SharedValues each).
 *
 * Why: RN Skia's declarative recorder re-reads every SharedValue bound to a
 * prop SYNCHRONOUSLY from the UI thread on every React commit to the canvas,
 * and Reanimated runs one mapper per derived value per frame. At ≈190 bodies
 * + 120 labels that was ≈3 200 bound values and ≈3 800 mappers: each commit
 * blocked the JS thread for 1–4 s while the UI thread spent ~80 ms per frame
 * in mappers, so a big System switch played with its entering bodies not yet
 * mounted. A picture layer binds ONE value and mounts nothing per body.
 *
 * Semantics kept (component path = `LabBodies.tsx` / `LabLabels.tsx`, still
 * the `layerPictures`-off A/B baseline):
 * - geometry from the same `labBillboard` / `hudTagPlacement` / legacy label
 *   rules (`labb-layer-plan.ts`): the frame radius, hit radius, label
 *   allocation (and so tap resolution) are untouched; the model half
 *   (`OrreryWorld`) is unchanged;
 * - depth order = the component path's `zIndex = depth` (stable), split around
 *   the sun, which stays a component (`LabSunBody`) between the two pictures;
 * - the same uniform blocks (`labBodyFrameUniforms` / `labMoonFrameUniforms`),
 *   flattened in SkSL declaration order; null effect → the WP-1.0 flat path;
 * - labels keep one saveLayer per drawn label (C-09: paragraph alpha);
 * - no ambient clock is read: idle frames don't re-record; reduced motion only
 *   gates the switch dissolve/flare exactly as before.
 *
 * Photos: SkImages never enter a worklet. `LabPhotoProbes` (plain RN
 * components OUTSIDE the canvas, so a photo arrival is not a canvas commit per
 * body) own them through the unchanged `useOrreryPhoto` lifecycle; the layer
 * captures an image SHADER per body (it holds its own native reference, so the
 * hook's post-commit dispose stays safe). Stale shaders are left to GC
 * (COMPROMISES C-50).
 *
 * Hermes rule: worklet helpers are declared ABOVE their callers.
 */
import {
  FilterMode,
  MipmapMode,
  matchFont,
  Picture,
  type SkCanvas,
  type SkFont,
  type SkImage,
  Skia,
  type SkParagraph,
  type SkPicture,
  type SkRuntimeEffect,
  type SkShader,
  type SkTypefaceFontProvider,
  TileMode,
} from "@shopify/react-native-skia";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import type { ProfileStatus } from "@/db/contact-status-read";
import type { OrrerySatellite } from "@/db/orrery-satellites-read";
import type { OrrerySatelliteTarget } from "@/logic/orrery-camera-logic";
import { type AnimatedFrame, bodyKey } from "@/logic/orrery-frame";
import {
  type LabelAllocation,
  orreryInitials,
} from "@/logic/orrery-label-logic";
import { orreryRingStyle } from "@/logic/orrery-ring-logic";
import { type LabLabelProfile, labColor } from "@/theme/orrery-lab-fx";
import type { ThemePalette } from "@/theme/theme-types";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { swatchIndex } from "../../avatar-initials";
import { useOrreryPhoto } from "../use-orrery-photo";
import type { OrreryBodyResource } from "../use-orrery-switch-runtime";
import {
  FOCUS_GAP,
  GLYPH_BASELINE,
  GLYPH_MAX_FRACTION,
  type LabWorldLook,
  labContactStatic,
  labInitials,
  labMoonStatic,
  MOON_CAP_OFFSET,
  MOON_CAP_R,
  MOON_DARK_ALPHA,
  MOON_GLINT_ALPHA,
  MOON_GLINT_OFFSET,
  MOON_GLINT_R,
  OUTLINE_WIDTH,
} from "./LabBodies";
import {
  BODY_REACH,
  type LabBodyStatic,
  type LabMoonStatic,
  labBodyFrameUniforms,
  labLightDir,
  labMoonFrameUniforms,
} from "./labb-bodies-logic";
import { labCardChannel, underCard } from "./labb-card-channel";
import { useLabStillContext } from "./labb-context";
import { getLabEffect, LAB_EFFECT_SOURCES } from "./labb-effects";
import {
  focusBodyValue,
  focusDimFactor,
  LABEL_DEFOCUS,
} from "./labb-focus-logic";
import { bodyAt, type FrameIndex } from "./labb-frame-index";
import {
  flattenUniforms,
  type LabBodyDrawItem,
  type LabLabelDrawSpec,
  planBodyDraws,
  planLabelDraws,
  uniformOrder,
} from "./labb-layer-plan";
import { probeEnd, probeStart } from "./labb-perf-probe";
import { bodySwitchFx, switchFxLive } from "./labb-switch-logic";
import { tokenToVec4 } from "./labb-uniforms";

// --- Tunables -----------------------------------------------------------------
/** Picture cull bounds (screen px) — generous: bodies / halos may overhang. */
const PICTURE_BOUNDS = 1e5;
const STROKE = 1;
const ROUND_CAP = 1;
const BLUR_NORMAL = 0;
const FOCUS_STROKE = 2;
const MOON_FOCUS_R = 1.5;
const MOON_FOCUS_STROKE = 0.3;
const LABEL_PAD_X = SPACING.sm;
const LABEL_PAD_Y = SPACING.xs;

/** Stable empty focus-key list (worklet capture must not change identity). */
const NO_KEYS: string[] = [];

/** Effect slots of the bodies layer (index into the captured arrays). */
const FX_PHOTO = 0;
const FX_PROCEDURAL = 1;
const FX_MOON = 2;

// --- Spec types (React side; plain data + host objects) -----------------------

/** One contact body or moon of the bodies layer (static per React render). */
export interface LabBodySpec {
  key: string;
  /** World radius (moons: 1). */
  radius: number;
  moon: boolean;
  /** Lit effect slot (FX_*) or -1 = flat WP-1.0 path. */
  fx: number;
  st: LabBodyStatic | null;
  moonSt: LabMoonStatic | null;
  /** Index into the captured image-shader list, or -1 (initials body). */
  shader: number;
  focus: number[] | null;
  /** Flat path / moon colours (RGBA 0..1). */
  fill: number[];
  swatch: number[];
  /** Moon cap / glint tones (lit cheap moon). */
  tone: number[];
  hi: number[];
  /** Initials glyph (initials bodies only). */
  glyph: string;
  glyphX: number;
  glyphY: number;
  glyphFit: number;
  /** Index into the captured font list, or -1. */
  font: number;
  ink: number[];
}

// --- Worklet draw helpers (declared above their callers) ----------------------

function vecColor(c: readonly number[], alpha: number): Float32Array {
  "worklet";
  return Float32Array.of(c[0], c[1], c[2], c[3] * alpha);
}

/**
 * R1 legibility: the lowest alpha a DEFOCUSED label's text takes (text-only
 * dim). Model over the extreme raw backdrop (white on dark themes, black on
 * light) with the plate at full scrim: 0.66 → ≥ 4.95:1 in all four themes;
 * WP-2.2's 0.62 whole-tag dim modelled 2.2–2.9:1 there.
 */
const LABEL_TEXT_DIM_MIN = 0.66;

/** R1 focus-card occlusion: bodies under the card draw at this alpha. */
const OCCLUDED_ALPHA = 0.12;
/** Padding (dp) around the card for the occlusion test. */
const OCCLUDE_PAD = 4;

/**
 * R1 density LOD (flag `bodyPointLod`): a contact body whose projected radius
 * is below this (dp) draws as a star-like POINT in its status hue (core + soft
 * halo) instead of a lit photo / initials disc — at 400–800 bodies the discs
 * are unreadable specks and each one cost a runtime shader per frame-change.
 */
export const BODY_POINT_LOD_DP = 6;
const POINT_CORE = 0.62;
const POINT_CORE_MIN = 1.3;
const POINT_HALO = 1.6;
const POINT_HALO_ALPHA = 0.28;

/** The point-LOD body (local units: canvas already at the body, scale s). */
function drawBodyPoint(
  canvas: SkCanvas,
  spec: LabBodySpec,
  alpha: number,
  scale: number,
): void {
  "worklet";
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  const core = Math.max(POINT_CORE_MIN / scale, spec.radius * POINT_CORE);
  paint.setColor(vecColor(spec.fill, alpha * POINT_HALO_ALPHA));
  canvas.drawCircle(0, 0, core * POINT_HALO, paint);
  paint.setColor(vecColor(spec.fill, alpha));
  canvas.drawCircle(0, 0, core, paint);
}

/**
 * R2 overview size floor (flag `bodySizeFloor`): a contact body smaller than
 * the profile's `minBodyDp` is DRAWN larger, by at most this factor, so it reads
 * as a world rather than a map pin. Hit radius, labels and the model are
 * untouched (MIN_HIT_RADIUS already exceeds the drawn size).
 */
const SIZE_FLOOR_MAX_BOOST = 1.4;

/** Flat / moon fallback defocus: alpha × (1 − FLAT_DEFOCUS × defocus). */
const FLAT_DEFOCUS = 0.4;

function drawContact(
  canvas: SkCanvas,
  spec: LabBodySpec,
  item: LabBodyDrawItem,
  uniforms: Record<string, number[]> | null,
  effects: readonly (SkRuntimeEffect | null)[],
  orders: readonly (readonly string[])[],
  shaders: readonly SkShader[],
  fonts: readonly SkFont[],
  focusValue: number,
  focusRing: boolean,
): void {
  "worklet";
  const lit = spec.fx >= 0 && !!effects[spec.fx] && !!uniforms;
  const a =
    item.alpha * (!lit && focusValue < 0 ? 1 - FLAT_DEFOCUS * -focusValue : 1);
  if (spec.focus && focusRing) {
    const ring = Skia.Paint();
    ring.setAntiAlias(true);
    ring.setStyle(STROKE);
    ring.setStrokeWidth(FOCUS_STROKE);
    ring.setColor(vecColor(spec.focus, a));
    canvas.drawCircle(0, 0, spec.radius + FOCUS_GAP, ring);
  }
  const effect = spec.fx >= 0 ? effects[spec.fx] : null;
  let glyphAlpha = 1;
  if (effect && uniforms) {
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setShader(
      effect.makeShaderWithChildren(
        flattenUniforms(uniforms, orders[spec.fx]),
        spec.shader >= 0 ? [shaders[spec.shader]] : [],
      ),
    );
    paint.setAlphaf(a);
    canvas.drawCircle(0, 0, spec.radius * BODY_REACH, paint);
    const d = uniforms.uK ? uniforms.uK[0] : 0;
    glyphAlpha = d > 0 ? Math.max(0, 1 - Math.sqrt(d) * 1.3) : 1;
  } else {
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setColor(vecColor(spec.fill, a));
    canvas.drawCircle(0, 0, spec.radius, paint);
    const innerR = Math.max(1, spec.radius - OUTLINE_WIDTH / 2);
    if (spec.shader >= 0) {
      // The image shader covers the r-disc in local units; scaling the canvas
      // by innerR / r covers the inner disc exactly like the clipped Image.
      const k = innerR / spec.radius;
      canvas.save();
      canvas.scale(k, k);
      const img = Skia.Paint();
      img.setAntiAlias(true);
      img.setShader(shaders[spec.shader]);
      img.setAlphaf(a);
      canvas.drawCircle(0, 0, spec.radius, img);
      canvas.restore();
    } else {
      paint.setColor(vecColor(spec.swatch, a));
      canvas.drawCircle(0, 0, innerR, paint);
    }
  }
  if (spec.shader < 0 && spec.font >= 0 && spec.glyph.length > 0) {
    const ink = Skia.Paint();
    ink.setAntiAlias(true);
    ink.setColor(vecColor(spec.ink, a * glyphAlpha));
    canvas.save();
    canvas.scale(spec.glyphFit, spec.glyphFit);
    canvas.drawText(
      spec.glyph,
      spec.glyphX,
      spec.glyphY,
      ink,
      fonts[spec.font],
    );
    canvas.restore();
  }
}

function drawMoon(
  canvas: SkCanvas,
  spec: LabBodySpec,
  item: LabBodyDrawItem,
  uniforms: Record<string, number[]> | null,
  light: [number, number],
  effects: readonly (SkRuntimeEffect | null)[],
  orders: readonly (readonly string[])[],
  focusValue: number,
  focusRing: boolean,
): void {
  "worklet";
  const a = item.alpha * (focusValue < 0 ? 1 - FLAT_DEFOCUS * -focusValue : 1);
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  const effect = spec.fx === FX_MOON ? effects[FX_MOON] : null;
  if (effect && uniforms) {
    // R3 fix: the moon effect has no child shaders, so it is `makeShader`.
    // `makeShaderWithChildren` without a children array threw on device
    // ("Value is undefined, expected an Object") and crashed the app as soon
    // as `moonShader` (default off) was on with layer pictures (R3 "Everything").
    paint.setShader(
      effect.makeShader(flattenUniforms(uniforms, orders[FX_MOON])),
    );
    paint.setAlphaf(a);
    canvas.drawCircle(0, 0, 1, paint);
  } else if (spec.moonSt) {
    paint.setColor(vecColor(spec.tone, a * MOON_DARK_ALPHA));
    canvas.drawCircle(0, 0, 1, paint);
    paint.setColor(vecColor(spec.tone, a));
    canvas.drawCircle(
      light[0] * MOON_CAP_OFFSET,
      light[1] * MOON_CAP_OFFSET,
      MOON_CAP_R,
      paint,
    );
    paint.setColor(vecColor(spec.hi, a * MOON_GLINT_ALPHA));
    canvas.drawCircle(
      light[0] * MOON_GLINT_OFFSET,
      light[1] * MOON_GLINT_OFFSET,
      MOON_GLINT_R,
      paint,
    );
  } else {
    paint.setColor(vecColor(spec.fill, a));
    canvas.drawCircle(0, 0, 1, paint);
  }
  if (spec.focus && focusRing) {
    const ring = Skia.Paint();
    ring.setAntiAlias(true);
    ring.setStyle(STROKE);
    ring.setStrokeWidth(MOON_FOCUS_STROKE);
    ring.setColor(vecColor(spec.focus, a));
    canvas.drawCircle(0, 0, MOON_FOCUS_R, ring);
  }
}

// --- Photos -------------------------------------------------------------------

function PhotoProbe({
  path,
  onImage,
}: {
  path: string;
  onImage: (path: string, image: SkImage | null) => void;
}) {
  const image = useOrreryPhoto(path);
  useEffect(() => {
    onImage(path, image);
  }, [path, image, onImage]);
  useEffect(() => () => onImage(path, null), [path, onImage]);
  return null;
}

/**
 * One `useOrreryPhoto` per distinct contact photo path, rendered OUTSIDE the
 * Skia canvas (plain RN, renders nothing). Each keeps the hook's unchanged
 * load / cancel / post-commit-dispose lifecycle and reports its image.
 */
export function LabPhotoProbes({
  paths,
  onImage,
}: {
  paths: readonly string[];
  onImage: (path: string, image: SkImage | null) => void;
}) {
  return (
    <>
      {paths.map((path) => (
        <PhotoProbe key={path} path={path} onImage={onImage} />
      ))}
    </>
  );
}

/** Cover-fit image shader for a disc of radius r in local units (= the
 * component path's `<ImageShader fit="cover" rect={discRect(r)}>`). */
function coverShader(image: SkImage, r: number): SkShader | null {
  try {
    const w = image.width();
    const h = image.height();
    if (!(w > 0 && h > 0)) return null;
    const s = Math.max((2 * r) / w, (2 * r) / h);
    const m = Skia.Matrix();
    m.translate(-(w * s) / 2, -(h * s) / 2);
    m.scale(s, s);
    return image.makeShaderOptions(
      TileMode.Decal,
      TileMode.Decal,
      FilterMode.Linear,
      MipmapMode.None,
      m,
    );
  } catch {
    return null;
  }
}

// --- Bodies layer -------------------------------------------------------------

const EFFECT_NAMES = ["bodyPhoto", "bodyProcedural", "moon"] as const;
const EFFECT_ORDERS: readonly (readonly string[])[] = EFFECT_NAMES.map((n) =>
  uniformOrder(LAB_EFFECT_SOURCES[n]),
);

export function LabBodiesPictures({
  resources,
  satellites,
  frame,
  frameIndex,
  colors,
  fontProvider,
  focusedIds,
  focusedSatellite,
  look,
  photos,
  photoVersion,
  sun,
}: {
  resources: readonly OrreryBodyResource[];
  satellites: readonly OrrerySatellite[];
  frame: SharedValue<AnimatedFrame>;
  frameIndex: SharedValue<FrameIndex>;
  colors: ThemePalette;
  fontProvider: SkTypefaceFontProvider | null;
  focusedIds: readonly number[];
  focusedSatellite?: OrrerySatelliteTarget | null;
  look: LabWorldLook;
  /** path → image (owned by `LabPhotoProbes`). */
  photos: ReadonlyMap<string, SkImage>;
  /** Bumped when `photos` changes (the map itself is mutable). */
  photoVersion: number;
  /** The sun component(s), drawn between the two depth halves. */
  sun: ReactNode;
}) {
  const ctx = useLabStillContext();
  const fxFlags = ctx?.fxFlags;
  const reducedMotion = ctx?.reducedMotion;
  const signal = ctx?.sw?.signal;
  const roles = ctx?.sw?.roles;
  const focus = ctx?.focus ?? null;
  const shaderCache = useRef(
    new Map<string, { image: SkImage; r: number; shader: SkShader }>(),
  );
  const cardRect = labCardChannel();
  const fontCache = useRef<{
    provider: SkTypefaceFontProvider | null;
    fonts: Map<number, SkFont | null>;
  }>({ provider: null, fonts: new Map() });
  // biome-ignore lint/correctness/useExhaustiveDependencies: photoVersion is the change signal of the mutable photo map
  const layer = useMemo(() => {
    const effects = EFFECT_NAMES.map((n) =>
      look.lit ? getLabEffect(n) : null,
    );
    if (fontCache.current.provider !== fontProvider)
      fontCache.current = { provider: fontProvider, fonts: new Map() };
    const fontList: SkFont[] = [];
    const fontIndex = new Map<number, number>();
    const fontFor = (size: number): number => {
      const known = fontIndex.get(size);
      if (known !== undefined) return known;
      let font = fontCache.current.fonts.get(size);
      if (font === undefined) {
        font = null;
        if (fontProvider)
          try {
            font = matchFont(
              { fontFamily: "Inter", fontSize: size, fontWeight: "600" },
              fontProvider,
            );
          } catch {
            font = null;
          }
        fontCache.current.fonts.set(size, font);
      }
      if (!font) return -1;
      fontIndex.set(size, fontList.length);
      fontList.push(font);
      return fontList.length - 1;
    };
    const shaderList: SkShader[] = [];
    const usedKeys = new Set<string>();
    const specs: LabBodySpec[] = [];
    const sunKeys: string[] = [];
    for (const r of resources) {
      const { body, scene, key } = r;
      if (body.kind === "sun") {
        sunKeys.push(key);
        continue;
      }
      if (body.kind !== "contact") continue;
      const contact = scene.contacts.find((c) => c.id === body.id);
      const name = contact?.name ?? "";
      const status: ProfileStatus | null = contact?.status ?? null;
      const swatchToken =
        colors.avatarSwatches[swatchIndex(name, colors.avatarSwatches.length)];
      const bodyFill = orreryRingStyle(status, colors).bodyFill;
      const image = contact?.photo ? photos.get(contact.photo) : undefined;
      let shader = -1;
      if (image) {
        usedKeys.add(key);
        const cached = shaderCache.current.get(key);
        let made: SkShader | null =
          cached && cached.image === image && cached.r === body.radius
            ? cached.shader
            : null;
        if (!made) {
          made = coverShader(image, body.radius);
          if (made)
            shaderCache.current.set(key, {
              image,
              r: body.radius,
              shader: made,
            });
        }
        if (made) {
          shader = shaderList.length;
          shaderList.push(made);
        }
      }
      const st = labContactStatic(
        look,
        body.radius,
        key,
        swatchToken,
        bodyFill,
        status,
      );
      const fx =
        look.lit && st
          ? effects[shader >= 0 ? FX_PHOTO : FX_PROCEDURAL]
            ? shader >= 0
              ? FX_PHOTO
              : FX_PROCEDURAL
            : -1
          : -1;
      const glyph = labInitials(orreryInitials(name));
      const font = shader < 0 && glyph ? fontFor(body.radius) : -1;
      let width = body.radius;
      if (font >= 0)
        try {
          width = fontList[font].measureText(glyph).width;
        } catch {
          width = body.radius;
        }
      const max = body.radius * 2 * GLYPH_MAX_FRACTION;
      specs.push({
        key,
        radius: body.radius,
        moon: false,
        fx,
        st,
        moonSt: null,
        shader,
        focus: focusedIds.includes(body.id) ? tokenToVec4(colors.accent) : null,
        fill: tokenToVec4(bodyFill),
        swatch: tokenToVec4(swatchToken),
        tone: [0, 0, 0, 0],
        hi: [0, 0, 0, 0],
        glyph,
        glyphX: -width / 2,
        glyphY: body.radius * GLYPH_BASELINE,
        glyphFit: width > max ? max / width : 1,
        font,
        ink: tokenToVec4(colors.avatarSwatchText),
      });
    }
    for (const k of [...shaderCache.current.keys()])
      if (!usedKeys.has(k)) shaderCache.current.delete(k);
    const moonSt = labMoonStatic(look);
    const moonFx =
      look.lit && look.moonShader && moonSt && effects[FX_MOON] ? FX_MOON : -1;
    for (const row of satellites) {
      const target = {
        kind: "satellite" as const,
        uid: row.uid,
        parentId: row.parentId,
        parentUid: row.parentUid,
      };
      const key = bodyKey({
        kind: "satellite",
        id: -1,
        satelliteTarget: target,
      });
      const focused =
        focusedSatellite?.uid === row.uid &&
        focusedSatellite.parentId === row.parentId &&
        focusedSatellite.parentUid === row.parentUid;
      specs.push({
        key,
        radius: 1,
        moon: true,
        fx: moonFx,
        st: null,
        moonSt: look.lit ? moonSt : null,
        shader: -1,
        focus: focused ? tokenToVec4(colors.accent) : null,
        fill: tokenToVec4(colors.textSecondary),
        swatch: [0, 0, 0, 0],
        tone: tokenToVec4(labColor(colors, look.profile.bodies.moonTone)),
        hi: tokenToVec4(labColor(colors, look.profile.bodies.highlight)),
        glyph: "",
        glyphX: 0,
        glyphY: 0,
        glyphFit: 1,
        font: -1,
        ink: [0, 0, 0, 0],
      });
    }
    return { specs, sunKeys, effects, shaders: shaderList, fonts: fontList };
  }, [
    resources,
    satellites,
    colors,
    look,
    focusedIds,
    focusedSatellite,
    photoVersion,
    fontProvider,
  ]);
  const { specs, sunKeys, effects, shaders, fonts } = layer;
  const minBody = look.profile.stage.minBodyDp;
  const orders = EFFECT_ORDERS;
  const pictures = useDerivedValue(() => {
    const probe = probeStart();
    const f = frame.value;
    const index = frameIndex.value;
    const fx = fxFlags ? fxFlags.value : null;
    const reduced = reducedMotion ? reducedMotion.value : false;
    const sig = signal ? signal.value : null;
    const live = !!fx?.flags.fx && !!roles && switchFxLive(sig, reduced);
    const roleMap = live && roles ? roles.value : null;
    // WP-2.2: world response to focus (defocus / focused atmosphere) and the
    // legacy accent focus ring, replaced by the reticle while `fxFocus` is on.
    const fon = !!focus && !!fx?.flags.fx && !!fx.flags.fxFocusDim;
    const fmix = fon && focus ? focus.mix.value : 0;
    const fkeys = fon && focus ? focus.keys.value : NO_KEYS;
    const focusRing = !(fx?.flags.fx && fx.flags.fxFocus);
    // R1: the focus card occludes the world detail under it.
    const card =
      cardRect && fx?.flags.focusCardOcclusion ? cardRect.value : null;
    const pointLod = !!fx?.flags.bodyPointLod;
    const sizeFloor = !!fx?.flags.bodySizeFloor;
    let sunDepth: number | null = null;
    for (let s = 0; s < sunKeys.length && sunDepth === null; s++) {
      const b = bodyAt(f, index, sunKeys[s]);
      if (b?.visible) sunDepth = b.depth;
    }
    const plan = planBodyDraws(f, index, specs, sunDepth);
    const record = (items: LabBodyDrawItem[]): SkPicture => {
      "worklet";
      const recorder = Skia.PictureRecorder();
      const canvas = recorder.beginRecording(
        Skia.XYWHRect(
          -PICTURE_BOUNDS,
          -PICTURE_BOUNDS,
          PICTURE_BOUNDS * 2,
          PICTURE_BOUNDS * 2,
        ),
      );
      for (let n = 0; n < items.length; n++) {
        const raw = items[n];
        const spec = specs[raw.i];
        // R2 overview size floor (visual only; hit radii / labels unchanged).
        const planned =
          sizeFloor && !spec.moon && raw.s * spec.radius < minBody
            ? {
                ...raw,
                s:
                  Math.min(
                    minBody,
                    raw.s * spec.radius * SIZE_FLOOR_MAX_BOOST,
                  ) / spec.radius,
              }
            : raw;
        const reach = planned.s * spec.radius * BODY_REACH;
        const item = underCard(
          card,
          planned.x - reach,
          planned.y - reach,
          planned.x + reach,
          planned.y + reach,
          OCCLUDE_PAD,
        )
          ? { ...planned, alpha: planned.alpha * OCCLUDED_ALPHA }
          : planned;
        const pose = {
          x: item.x,
          y: item.y,
          radius: item.s * spec.radius,
          depth: item.depth,
        };
        canvas.save();
        canvas.translate(item.x, item.y);
        canvas.scale(item.s, item.s);
        if (spec.moon) {
          drawMoon(
            canvas,
            spec,
            item,
            spec.fx === FX_MOON && spec.moonSt
              ? labMoonFrameUniforms(
                  pose,
                  f.center.x,
                  f.center.y,
                  spec.moonSt,
                  fx,
                )
              : null,
            labLightDir(item.x, item.y, f.center.x, f.center.y),
            effects,
            orders,
            focusBodyValue(fkeys, spec.key, fmix),
            focusRing,
          );
        } else if (
          pointLod &&
          !spec.focus &&
          item.s * spec.radius < BODY_POINT_LOD_DP &&
          focusBodyValue(fkeys, spec.key, fmix) <= 0
        ) {
          drawBodyPoint(canvas, spec, item.alpha, item.s);
        } else {
          let sfx: number[] | undefined;
          if (roleMap && fx) {
            const v = bodySwitchFx(roleMap, spec.key, sig, true);
            sfx = [
              fx.flags.fxDissolve ? v[0] : 0,
              fx.flags.fxFlares ? v[1] : 0,
            ];
          }
          const fv = focusBodyValue(fkeys, spec.key, fmix);
          drawContact(
            canvas,
            spec,
            item,
            spec.fx >= 0 && spec.st
              ? labBodyFrameUniforms(
                  pose,
                  f.center.x,
                  f.center.y,
                  spec.st,
                  fx,
                  sfx,
                  fv,
                )
              : null,
            effects,
            orders,
            shaders,
            fonts,
            fv,
            focusRing,
          );
        }
        canvas.restore();
      }
      return recorder.finishRecordingAsPicture();
    };
    const out = { behind: record(plan.behind), front: record(plan.front) };
    probeEnd("bodies", probe);
    return out;
  });
  const behind = useDerivedValue(() => pictures.value.behind);
  const front = useDerivedValue(() => pictures.value.front);
  return (
    <>
      <Picture picture={behind} />
      {sun}
      <Picture picture={front} />
    </>
  );
}

// --- Labels layer -------------------------------------------------------------

export interface LabLabelLayerInput {
  id: string;
  paragraph: SkParagraph;
  w: number;
  h: number;
  caption: { paragraph: SkParagraph; w: number; h: number } | null;
}

export function LabLabelsPicture({
  labels,
  allocations,
  frame,
  frameIndex,
  colors,
  profile,
  statusColors,
  hud,
}: {
  labels: readonly LabLabelLayerInput[];
  allocations: SharedValue<LabelAllocation[]>;
  frame: SharedValue<AnimatedFrame>;
  frameIndex: SharedValue<FrameIndex>;
  colors: ThemePalette;
  profile: LabLabelProfile;
  /** label id → status hue (HUD hairline / leader). */
  statusColors: Readonly<Record<string, string>>;
  hud: boolean;
}) {
  const layer = useMemo(() => {
    const specs: LabLabelDrawSpec[] = labels.map((l) => ({
      id: l.id,
      w: l.w,
      h: l.h,
    }));
    return {
      specs,
      paragraphs: labels.map((l) => l.paragraph),
      captions: labels.map((l) => l.caption),
      status: labels.map((l) =>
        tokenToVec4(statusColors[l.id] ?? colors.border),
      ),
      surface: tokenToVec4(colors.surface),
      plate: tokenToVec4(labColor(colors, profile.plate)),
      outline: tokenToVec4(labColor(colors, profile.outline)),
      halo: tokenToVec4(labColor(colors, profile.halo)),
    };
  }, [labels, statusColors, colors, profile]);
  const { specs, paragraphs, captions, status, surface, plate, outline, halo } =
    layer;
  const p = {
    plateOpacity: profile.plateOpacity,
    outlineAlpha: profile.outlineAlpha,
    haloAlpha: profile.haloAlpha,
    haloSpread: profile.haloSpread,
    haloBlur: profile.haloBlur,
    hairlineDp: profile.hairlineDp,
    leaderDp: profile.leaderDp,
  };
  const r = RADII.sm;
  const ctx = useLabStillContext();
  const focus = ctx?.focus ?? null;
  const fxFlags = ctx?.fxFlags;
  const cardRect = labCardChannel();
  const picture = useDerivedValue(() => {
    const probe = probeStart();
    const f = frame.value;
    const index = frameIndex.value;
    // WP-2.2: other bodies' tags recede while something is focused.
    const fx = fxFlags ? fxFlags.value : null;
    const fon = !!focus && !!fx?.flags.fx && !!fx.flags.fxFocusDim;
    const fmix = fon && focus ? focus.mix.value : 0;
    const fkeys = fon && focus ? focus.keys.value : NO_KEYS;
    // R1: labels under the focus card are dropped (they ghosted through it).
    const card =
      cardRect && fx?.flags.focusCardOcclusion ? cardRect.value : null;
    const plan = planLabelDraws(
      allocations.value,
      (id: string) => {
        const b = bodyAt(f, index, id);
        return b ? b.y : undefined;
      },
      specs,
      hud,
    );
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(
      Skia.XYWHRect(
        -PICTURE_BOUNDS,
        -PICTURE_BOUNDS,
        PICTURE_BOUNDS * 2,
        PICTURE_BOUNDS * 2,
      ),
    );
    const fill = Skia.Paint();
    fill.setAntiAlias(true);
    const layerPaint = Skia.Paint();
    const textPaint = Skia.Paint();
    // Flag off = the WP-2.2 behaviour (whole tag dims) for the A/B.
    const labelPlateDim = !fx?.flags.labelTextDim;
    for (let n = 0; n < plan.length; n++) {
      const item = plan[n];
      const spec = specs[item.i];
      const tag = item.tag;
      const dim = focusDimFactor(fkeys, spec.id, fmix, 1 - LABEL_DEFOCUS);
      if (
        tag &&
        !underCard(card, tag.x, tag.y, tag.x + spec.w, tag.y + spec.h, 0)
      ) {
        // R1 legibility: the focus defocus dims the TEXT only. Dimming the
        // whole tag let the plate go to 0.56 alpha, and a bright backdrop (the
        // sun, a glow) then pushed defocused names to ~2.2:1 (model, dark).
        layerPaint.setAlphaf(tag.opacity * (labelPlateDim ? dim : 1));
        canvas.saveLayer(layerPaint);
        const x = tag.x;
        const y = tag.y;
        const w = spec.w;
        const h = spec.h;
        if (hud) {
          const s = p.haloSpread;
          const blur = Skia.Paint();
          blur.setAntiAlias(true);
          blur.setColor(vecColor(halo, p.haloAlpha));
          blur.setMaskFilter(
            Skia.MaskFilter.MakeBlur(BLUR_NORMAL, p.haloBlur, true),
          );
          canvas.drawRRect(
            Skia.RRectXY(
              Skia.XYWHRect(x - s, y - s, w + s * 2, h + s * 2),
              r + s,
              r + s,
            ),
            blur,
          );
          fill.setColor(vecColor(plate, p.plateOpacity));
          canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, h), r, r), fill);
          const line = Skia.Paint();
          line.setAntiAlias(true);
          line.setStyle(STROKE);
          line.setStrokeWidth(1);
          line.setColor(vecColor(outline, p.outlineAlpha));
          canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, h), r, r), line);
          line.setColor(vecColor(status[item.i], 1));
          line.setStrokeWidth(p.hairlineDp);
          canvas.drawLine(x + r, tag.edgeY, x + w - r, tag.edgeY, line);
          line.setStrokeWidth(1);
          line.setStrokeCap(ROUND_CAP);
          canvas.drawLine(
            x + w / 2,
            tag.edgeY,
            x + w / 2,
            tag.edgeY + tag.toward * p.leaderDp,
            line,
          );
        } else {
          fill.setColor(vecColor(surface, 1));
          canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, h), r, r), fill);
        }
        if (dim < 1 && !labelPlateDim) {
          textPaint.setAlphaf(Math.max(LABEL_TEXT_DIM_MIN, dim));
          canvas.saveLayer(textPaint);
          paragraphs[item.i].paint(canvas, x + LABEL_PAD_X, y + LABEL_PAD_Y);
          canvas.restore();
        } else
          paragraphs[item.i].paint(canvas, x + LABEL_PAD_X, y + LABEL_PAD_Y);
        canvas.restore();
      }
      const cap = item.caption;
      const c = captions[item.i];
      if (
        cap &&
        c &&
        !underCard(card, cap.x, cap.y, cap.x + c.w, cap.y + c.h, 0)
      ) {
        layerPaint.setAlphaf(cap.opacity * (labelPlateDim ? dim : 1));
        canvas.saveLayer(layerPaint);
        fill.setColor(vecColor(surface, 1));
        canvas.drawRRect(
          Skia.RRectXY(Skia.XYWHRect(cap.x, cap.y, c.w, c.h), r, r),
          fill,
        );
        c.paragraph.paint(canvas, cap.x + LABEL_PAD_X, cap.y + LABEL_PAD_Y);
        canvas.restore();
      }
    }
    const labelsPicture = recorder.finishRecordingAsPicture();
    probeEnd("labels", probe);
    return labelsPicture;
  });
  return <Picture picture={picture} />;
}
