/**
 * ORRERY LAB A — ARCH PERF PASS: the whole Lab A scene as FIVE pictures.
 *
 * The Canvas tree is tiny and STABLE: one Group of five `<Picture>` nodes
 * whose inputs are shared values only. React commits (focus, publication,
 * photo resolve, label rebuild) write shared values and never change this
 * tree, so RN-Skia never re-records it, and its per-redraw prop conversion
 * is five pictures instead of ~550 animated props.
 *
 *   below  · sky, world plane, Polaris, reorder ghost, bodies drawn BEFORE
 *            the sun in depth order          — re-recorded on frame/data change
 *   sun    · the sun(s): corona, granulation — + on each ambient tick
 *   above  · bodies drawn AFTER the sun      — re-recorded on frame/data change
 *   reticle· focus reticle (lock-on, scan)   — on focus/ambient; a stable
 *            empty picture when nothing is focused (no redraw)
 *   top    · labels, context lines, stack pips — on frame/allocation change
 *
 * Redraws are therefore conditional: an idle overview redraws only for the
 * ambient sun at AMBIENT_HZ, and under live reduced motion the ambient time
 * is a constant, so an idle canvas redraws NOTHING (as legacy).
 *
 * Single clock: the ambient time derives from OrreryCanvas's clock through
 * OrreryClockContext (no other clock). Every helper is a worklet in
 * scene-draw.ts / reticle-draw.ts / world-plane.ts.
 */
import {
  createPicture,
  Group,
  Picture,
  type SkCanvas,
  Skia,
  type SkPicture,
  type SkSurface,
  type SkTypefaceFontProvider,
} from "@shopify/react-native-skia";
import { useEffect, useMemo } from "react";
import { useWindowDimensions } from "react-native";
import {
  Easing,
  runOnUI,
  type SharedValue,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { type AnimatedFrame, bodyKey, frameBody } from "@/logic/orrery-frame";
import type { LabelAllocation } from "@/logic/orrery-label-logic";
import {
  POLARIS_RADIUS,
  polarisProjection,
} from "@/logic/orrery-recovery-logic";
import type { ReorderDrag } from "@/logic/orrery-reorder-logic";
import { useReducedMotionShared } from "@/theme/use-reduced-motion";
import { useOrreryClock } from "../orrery-clock-context";
import {
  AMBIENT_HZ,
  NEBULA_FADE_MS,
  RETICLE_LOCK_MS,
  RETICLE_SCAN_SPEED,
  STARS_FAR_COUNT,
  STARS_FAR_COUNT_INK,
  STARS_FAR_R,
  STARS_HERO_COUNT,
  STARS_NEAR_COUNT,
  STARS_NEAR_COUNT_INK,
  STARS_NEAR_R,
  VIGNETTE_ALPHA_DARK,
  VIGNETTE_ALPHA_LIGHT,
  VIGNETTE_INNER,
} from "./deep-field-config";
import {
  type DeepFieldInk,
  type Rgba,
  tokenInk,
  withAlpha,
} from "./deep-field-ink";
import {
  type BodyLightMap,
  type FocusState,
  reticleDrawnRadius,
  type SwitchFx,
} from "./deep-field-math";
import { labEffect } from "./deep-field-shaders";
import { LabHud, labMarkerVisible } from "./LabHud";
import { nebulaCached, nebulaImage } from "./nebula-bake";
import { drawReticle, RETICLE_LOCK_END } from "./reticle-draw";
import {
  drawContactBody,
  drawLabels,
  drawMoonBody,
  drawPolaris,
  drawReorderGhost,
  drawSky,
  drawStackPips,
  drawSunBody,
  focusDim,
  type LabBodySpec,
  type LabEffects,
  type LabLabelSpec,
  type LabSceneInks,
  type LabSky,
  orderBodies,
} from "./scene-draw";
import { recordStars, SKY_MARGIN, scatter } from "./sky-resources";
import { drawWorldPlane, type PlaneRing, type TrailState } from "./world-plane";

/** Polaris' four-point star (Polaris.tsx), local coordinates. */
const POLARIS_STAR =
  "M 0 -10 L 2 -2 L 10 0 L 2 2 L 0 10 L -2 2 L -10 0 L -2 -2 Z";
const AMBIENT_STEP_MS = 1000 / AMBIENT_HZ;
const TILE_CLAMP = 0;
const FILTER_LINEAR = 1;
const MIPMAP_NONE = 0;
/** Fully transparent clear for the base texture (not a colour token: no hue). */
const CLEAR_INK = Float32Array.of(0, 0, 0, 0);
/** Rasterise the base layer into a cached texture (see baseCache). */
const BASE_TEXTURE = true;

export interface LabSceneProps {
  width: number;
  height: number;
  ink: DeepFieldInk;
  inks: LabSceneInks;
  /** Star tones (tokens). */
  starColors: readonly string[];
  fontProvider: SkTypefaceFontProvider | null;
  /** textSecondary token (DEV marker). */
  hudText: string;
  frame: SharedValue<AnimatedFrame>;
  switchFx: SharedValue<SwitchFx>;
  light: SharedValue<BodyLightMap>;
  focus: SharedValue<FocusState>;
  focusMix: SharedValue<number>;
  allocations: SharedValue<LabelAllocation[]>;
  drag: SharedValue<ReorderDrag | null>;
  bodies: SharedValue<LabBodySpec[]>;
  labels: SharedValue<LabLabelSpec[]>;
  rings: SharedValue<PlaneRing[]>;
  extent: SharedValue<number>;
  /** Animated across each spec change so fades get their re-records. */
  fadeTick: SharedValue<number>;
}

export function LabScene({
  width,
  height,
  ink,
  inks,
  starColors,
  fontProvider,
  hudText,
  frame,
  switchFx,
  light,
  focus,
  focusMix,
  allocations,
  drag,
  bodies,
  labels,
  rings,
  extent,
  fadeTick,
}: LabSceneProps) {
  const clock = useOrreryClock();
  const reducedMotion = useReducedMotionShared();
  // Ambient time (ms, quantised to AMBIENT_HZ) or −1 = still (live reduced
  // motion / no clock). A primitive: an unchanged value never propagates.
  const ambient = useDerivedValue(() => {
    if (!clock || reducedMotion.value) return -1;
    return Math.floor(clock.value / AMBIENT_STEP_MS) * AMBIENT_STEP_MS;
  });

  const effects = useMemo<LabEffects>(
    () => ({
      body: labEffect("body"),
      corona: labEffect("corona"),
      sunDisc: labEffect("sunDisc"),
      ring: labEffect("ring"),
    }),
    [],
  );
  const polarisStar = useMemo(
    () => Skia.Path.MakeFromSVGString(POLARIS_STAR) ?? Skia.Path.Make(),
    [],
  );
  const empty = useMemo<SkPicture>(() => createPicture(() => {}), []);

  // ── Sky resources: recorded ONCE per size/palette (as DeepFieldBackdrop). ──
  const firstBake = useMemo(() => !nebulaCached(ink), [ink]);
  const nebulaOpacity = useSharedValue(firstBake ? 0 : 1);
  useEffect(() => {
    if (nebulaOpacity.value >= 1) return;
    nebulaOpacity.value = reducedMotion.value
      ? 1
      : withTiming(1, { duration: NEBULA_FADE_MS });
  }, [nebulaOpacity, reducedMotion]);
  const sky = useMemo<LabSky>(() => {
    const palette = starColors.map(tokenInk);
    const radius = Math.ceil(Math.hypot(width, height) / 2 + SKY_MARGIN);
    const far = recordStars(
      scatter(
        ink.chart ? STARS_FAR_COUNT_INK : STARS_FAR_COUNT,
        radius,
        STARS_FAR_R,
        palette,
        11,
      ),
      0,
      ink,
      radius,
    );
    const all = scatter(
      ink.chart ? STARS_NEAR_COUNT_INK : STARS_NEAR_COUNT,
      radius,
      STARS_NEAR_R,
      palette,
      4001,
    ).sort((a, b) => b.r - a.r);
    const heroesA = Math.ceil(STARS_HERO_COUNT / 2);
    const nearA = recordStars(
      all.filter((_, i) => i % 2 === 0),
      heroesA,
      ink,
      radius,
    );
    const nearB = recordStars(
      all.filter((_, i) => i % 2 === 1),
      STARS_HERO_COUNT - heroesA,
      ink,
      radius,
    );
    const edge = ink.chart ? VIGNETTE_ALPHA_LIGHT : VIGNETTE_ALPHA_DARK;
    const vignette =
      Skia.Shader?.MakeRadialGradient?.(
        { x: width / 2, y: height / 2 },
        Math.hypot(width, height) / 2,
        [
          withAlpha(ink.voidTone, 0),
          withAlpha(ink.voidTone, 0),
          withAlpha(ink.voidTone, edge * 0.55),
          withAlpha(ink.voidTone, edge),
        ],
        [0, VIGNETTE_INNER, 0.8, 1],
        TILE_CLAMP,
      ) ?? null;
    return {
      nebula: nebulaImage(ink),
      radius,
      far,
      nearA,
      nearB,
      vignette,
      width,
      height,
    };
  }, [ink, starColors, width, height]);

  // ── World plane trail history (UI scratch, mutated in place). ────────────
  const trails = useSharedValue<TrailState>({ pts: {} });

  // ── Base-layer texture cache. The "below" picture (sky, world plane,
  // rear bodies) is the expensive one to rasterise — the plane's many
  // stroked polygons are re-tessellated by Ganesh on every flush (measured:
  // ~70 % of the remaining idle main-thread time). It is rasterised ONCE per
  // change into a device-pixel offscreen texture on the UI thread (same GL
  // context as the view), so ambient-only redraws (the sun, the reticle
  // scan) just blit it. Mutable UI scratch: never reassigned → never an input
  // change. Released on unmount.
  const density = useWindowDimensions().scale || 1;
  const baseCache = useSharedValue<{
    surface: SkSurface | null;
    width: number;
    height: number;
  }>({ surface: null, width: 0, height: 0 });
  useEffect(
    () => () => {
      runOnUI(() => {
        "worklet";
        const held = baseCache.value.surface;
        baseCache.value.surface = null;
        held?.dispose();
      })();
    },
    [baseCache],
  );

  // ── Bodies: one ordering, split around the sun. ──────────────────────────
  const scene = useDerivedValue(() => {
    const current = frame.value;
    const fx = switchFx.value;
    const lights = light.value;
    const specs = bodies.value;
    const ringSpecs = rings.value;
    const state = focus.value;
    const mix = focusMix.value;
    const held = drag.value;
    const nebulaAlpha = nebulaOpacity.value;
    const sceneExtent = extent.value;
    const history = trails.value;
    const still = reducedMotion.value;
    // An input so spec fades (mount / photo) get their re-records.
    void fadeTick.value;
    const now = Date.now();
    const order = orderBodies(current, specs);
    let sunAt = order.length;
    for (let i = 0; i < order.length; i++)
      if (order[i].spec.kind === "sun") {
        sunAt = i;
        break;
      }
    const viewportRect = {
      width: current.viewport.width,
      height: current.viewport.height,
    };
    const drawRange = (canvas: SkCanvas, from: number, to: number) => {
      for (let i = from; i < to; i++) {
        const { spec, body } = order[i];
        if (spec.kind === "contact")
          drawContactBody(
            canvas,
            spec,
            body,
            lights,
            ink,
            effects.body,
            now,
            still,
            focusDim(spec.key, state.keys, mix),
          );
        else if (spec.kind === "satellite")
          drawMoonBody(canvas, spec, body, lights, ink, effects.body);
      }
    };
    const below = createPicture((canvas) => {
      drawSky(canvas, sky, current, fx, nebulaAlpha);
      drawWorldPlane(canvas, {
        frame: current,
        rings: ringSpecs,
        fx,
        ink,
        extent: sceneExtent,
        trails: history,
        now,
        ringEffect: effects.ring,
        focus: mix > 0 ? { keys: state.keys, mix } : undefined,
      });
      const polaris = polarisProjection(current, sceneExtent);
      drawPolaris(
        canvas,
        polaris.x,
        polaris.y,
        polarisStar,
        POLARIS_RADIUS * 1.5,
        inks,
      );
      drawReorderGhost(canvas, current, held, inks);
      drawRange(canvas, 0, sunAt);
    }, viewportRect);
    const above = createPicture((canvas) => {
      drawRange(canvas, sunAt, order.length);
    }, viewportRect);
    // Rasterise the base once (see baseCache); fall back to the picture.
    if (BASE_TEXTURE) {
      const pw = Math.ceil(viewportRect.width * density);
      const ph = Math.ceil(viewportRect.height * density);
      const cache = baseCache.value;
      if (!cache.surface || cache.width !== pw || cache.height !== ph) {
        cache.surface?.dispose();
        cache.surface =
          pw > 0 && ph > 0 ? Skia.Surface.MakeOffscreen(pw, ph) : null;
        cache.width = pw;
        cache.height = ph;
      }
      const surface = cache.surface;
      if (surface) {
        const target = surface.getCanvas();
        target.clear(CLEAR_INK);
        target.save();
        target.scale(density, density);
        target.drawPicture(below);
        target.restore();
        surface.flush();
        const image = surface.makeImageSnapshot();
        const blit = createPicture((canvas) => {
          canvas.drawImageRectOptions(
            image,
            Skia.XYWHRect(0, 0, pw, ph),
            Skia.XYWHRect(0, 0, pw / density, ph / density),
            FILTER_LINEAR,
            MIPMAP_NONE,
            null,
          );
        }, viewportRect);
        return { below: blit, above };
      }
    }
    return { below, above };
  });
  const below = useDerivedValue(() => scene.value.below);
  const above = useDerivedValue(() => scene.value.above);

  // ── The sun: the only ambient-driven body. ───────────────────────────────
  const sun = useDerivedValue(() => {
    const current = frame.value;
    const specs = bodies.value;
    const t = ambient.value;
    const flare = switchFx.value.flare;
    return createPicture(
      (canvas) => {
        for (let i = 0; i < specs.length; i++) {
          if (specs[i].kind !== "sun") continue;
          const body = frameBody(current, specs[i].key);
          if (body) drawSunBody(canvas, specs[i], body, ink, effects, t, flare);
        }
      },
      { width: current.viewport.width, height: current.viewport.height },
    );
  });

  // ── Focus reticle (pass 3 semantics; ambient instead of the raw clock). ──
  const lock = useSharedValue(RETICLE_LOCK_END);
  useAnimatedReaction(
    () => focus.value.generation,
    (generation, previous) => {
      if (previous === null || generation === previous) return;
      if (reducedMotion.value) {
        lock.value = RETICLE_LOCK_END;
        return;
      }
      lock.value = 0;
      lock.value = withTiming(RETICLE_LOCK_END, {
        duration: RETICLE_LOCK_MS,
        easing: Easing.linear,
      });
    },
  );
  const reticle = useDerivedValue(() => {
    const state = focus.value;
    const t0 = ambient.value;
    const lockT = lock.value;
    if (state.targets.length === 0) return empty;
    const current = frame.value;
    const still = t0 < 0;
    const t = still ? RETICLE_LOCK_END : lockT;
    const scan = still ? 0 : t0 * RETICLE_SCAN_SPEED;
    const lights = light.value;
    return createPicture(
      (canvas) => {
        for (let i = 0; i < state.targets.length; i++) {
          const key = state.targets[i];
          const body = frameBody(current, key);
          if (!body?.visible || !(body.opacity > 0)) continue;
          const drawn = reticleDrawnRadius(
            body.kind,
            body.radius,
            lights[key]?.[2] ?? 0,
          );
          if (!(drawn > 0)) continue;
          drawReticle(
            canvas,
            body.x,
            body.y,
            drawn,
            t,
            scan,
            inks.accent,
            body.opacity,
            still,
          );
        }
      },
      { width: current.viewport.width, height: current.viewport.height },
    );
  });

  // ── Labels + stack pips (screen space, above everything). ────────────────
  const top = useDerivedValue(() => {
    const current = frame.value;
    const placed = allocations.value;
    const labelSpecs = labels.value;
    const lights = light.value;
    const fx = switchFx.value;
    const ringSpecs = rings.value;
    const ringInks: Record<string, Rgba> = {};
    for (let i = 0; i < ringSpecs.length; i++)
      ringInks[ringSpecs[i].key] = ringSpecs[i].color;
    return createPicture(
      (canvas) => {
        drawLabels(canvas, current, labelSpecs, placed, ink, inks);
        drawStackPips(canvas, current, lights, fx, ringInks, ink, bodyKey);
      },
      { width: current.viewport.width, height: current.viewport.height },
    );
  });

  return (
    <Group>
      <Picture picture={below} />
      <Picture picture={sun} />
      <Picture picture={above} />
      <Picture picture={reticle} />
      <Picture picture={top} />
      {labMarkerVisible() ? (
        <LabHud
          viewport={{ width, height }}
          fontProvider={fontProvider}
          ink={ink}
          textColor={hudText}
        />
      ) : null}
    </Group>
  );
}
