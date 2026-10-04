/**
 * 38.7-14 (D-57): the System Preview on the Orrery's V2 pieces, flat.
 *
 * It draws the provisional (unsaved) System with the V2 sky (the baked Lab B
 * nebula and stars, STILL: no drift, no twinkle, untinted — a draft has no
 * System hue yet), the plane's grid and thin sun-lit rings, the lit bodies
 * with photos and initials, the star sun, and a plain focus outline around
 * the focused member. Its camera is always flat (tilt 0, yaw 0;
 * `previewPose`). No warp, no pulses, no reticle, no labels: it stays a
 * membership and scale preview with its own pan, pinch and tap.
 *
 * Lifetime (C-H2): `createPreviewResources` owns the photos, initials
 * Paragraphs and the sky image under Plan 07's ledger contract with the
 * Preview's own ledger epoch and layer ids; the sky and bodies pictures ack
 * through `useLayerAck`; unmount (blur or background) releases first and
 * hands everything back one UI round trip later. The canvas mounts only
 * while the route is focused and the app is active.
 *
 * Colours: every ink is a theme token resolved in the spec builders.
 * Worklet helpers are defined above their callers (Hermes forward-ref rule).
 */
import { useIsFocused } from "@react-navigation/native";
import {
  Canvas,
  createPicture,
  PaintStyle,
  Picture,
  type SkCanvas,
  Skia,
  useFonts,
} from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  runOnJS,
  runOnUI,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import { MIN_CONTACT_PX } from "@/logic/orrery-camera-logic";
import {
  type AnimatedFrame,
  bodyKey,
  frameBodyByKey,
  projectAnimatedFrame,
  type WorldTransition,
} from "@/logic/orrery-frame";
import { orreryInitials } from "@/logic/orrery-label-logic";
import { SKY_UNTINTED } from "@/logic/orrery-sky-logic";
import type { ProvisionalOrreryScene } from "@/services/orrery-scene";
import { useTheme } from "@/theme";
import { TYPOGRAPHY } from "@/theme/tokens/typography";
import {
  focusPreviewBody,
  PREVIEW_LAYER,
  PREVIEW_MAX_ZOOM,
  PREVIEW_MIN_ZOOM,
  previewBodyAt,
  previewCanvasMounted,
  previewHomeZoom,
  previewPose,
  previewTransition,
} from "./system-preview-logic";
import { createPreviewResources } from "./system-preview-resources";
import {
  drawBodies,
  drawSun,
  NO_BODY_EFFECTS,
  type OrreryBodyEffects,
  orderBodies,
} from "./v2/draw-bodies";
import {
  drawPlaneGrid,
  drawPlaneRings,
  gridDisc,
  ringBands,
} from "./v2/draw-plane";
import { drawSky } from "./v2/draw-sky";
import { useLayerAck } from "./v2/layer-ack";
import { SKY_NEBULA_SEED, skyBakeKey, skySizeBucket } from "./v2/nebula-bake";
import { resolveOrreryRenderHost } from "./v2/render-host";
import {
  bodyIdentity,
  bodyInitialsLayout,
  buildBodyLooks,
  buildPlaneSpec,
  buildRingSpecs,
  buildSkySpec,
  EMPTY_BODY_SPECS,
  EMPTY_PLANE_SPEC,
  EMPTY_RING_SPECS,
  EMPTY_SKY_IMAGE,
  EMPTY_SKY_SPEC,
  type OrreryBodySpecs,
  type OrreryInk,
  type OrrerySpecResource,
  type PlaneSpec,
  type RingSpecs,
  type SkyImageSpec,
  type SkySpec,
  tokenInk,
} from "./v2/scene-specs";
import { orreryShader } from "./v2/shaders";
import {
  GRID_EXTENT,
  GRID_HALF_WIDTH_DP,
  GRID_OPACITY,
  GRID_RINGS,
  GRID_SPOKES,
  RING_LOOKS,
  SKY_LOOKS,
  SKY_NEBULA_PERIOD,
  SKY_NEBULA_TEX,
  SKY_STAR_SEED,
  SKY_TWINKLE_GROUPS,
} from "./v2/visual-tunables";

export { focusPreviewBody } from "./system-preview-logic";

/** The ambient value that holds the sky still (no drift, no twinkle). */
const STILL_AMBIENT = -1;
/** The focus outline: gap outside the drawn disc and stroke width (dp). */
const PREVIEW_FOCUS_GAP_DP = 3;
const PREVIEW_FOCUS_STROKE_DP = 2;

/** No ink (nothing focused). */
const NO_FOCUS_INK: OrreryInk = [0, 0, 0, 0];
/** The focused member's outline: which body and in which ink. */
interface PreviewFocus {
  key: string | null;
  ink: OrreryInk;
}
const NO_PREVIEW_FOCUS: PreviewFocus = Object.freeze({
  key: null,
  ink: NO_FOCUS_INK,
});

/**
 * A plain ring around the focused member's drawn disc (no reticle, no
 * lock-on, no motion). Nothing for a culled or hidden body.
 */
function drawPreviewFocus(
  canvas: SkCanvas,
  frame: AnimatedFrame,
  focus: PreviewFocus,
): boolean {
  "worklet";
  if (focus.key === null) return false;
  const body = frameBodyByKey(frame, focus.key);
  if (!body || body.culled || !body.visible || !(body.radius > 0)) return false;
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeWidth(PREVIEW_FOCUS_STROKE_DP);
  paint.setColor(
    Float32Array.of(focus.ink[0], focus.ink[1], focus.ink[2], focus.ink[3]),
  );
  canvas.drawCircle(body.x, body.y, body.radius + PREVIEW_FOCUS_GAP_DP, paint);
  return true;
}

function ActiveSystemPreviewCanvas({
  scene,
  focusedId,
  onFocusBody,
}: {
  scene: ProvisionalOrreryScene;
  focusedId: number | null;
  onFocusBody: (contactId: number) => void;
}) {
  const { colors, mode, package: themePackage } = useTheme();
  const { width, height, fontScale } = useWindowDimensions();
  const fontProvider = useFonts({
    Inter: [
      require("../../../assets/Inter-Regular.ttf"),
      require("../../../assets/Inter-SemiBold.ttf"),
    ],
    "Space Grotesk": [require("../../../assets/SpaceGrotesk-SemiBold.ttf")],
  });
  const reportFocusBody = useCallback(
    (contactId: number) => focusPreviewBody(contactId, onFocusBody),
    [onFocusBody],
  );

  // ── Specs (JS → SharedValues; never React state) ─────────────────────────
  const bodySpecs = useSharedValue<OrreryBodySpecs>(EMPTY_BODY_SPECS);
  const skyImage = useSharedValue<SkyImageSpec>(EMPTY_SKY_IMAGE);
  const skySpec = useSharedValue<SkySpec>(EMPTY_SKY_SPEC);
  const ringSpecs = useSharedValue<RingSpecs>(EMPTY_RING_SPECS);
  const planeSpec = useSharedValue<PlaneSpec>(EMPTY_PLANE_SPEC);
  const focusRing = useSharedValue<PreviewFocus>(NO_PREVIEW_FOCUS);
  const controllerRef = useRef<ReturnType<
    typeof createPreviewResources
  > | null>(null);
  if (!controllerRef.current)
    controllerRef.current = createPreviewResources({
      writeBodies: (specs) => {
        bodySpecs.value = specs;
      },
      writeSky: (spec) => {
        skyImage.value = spec;
      },
    });
  const controller = controllerRef.current;
  const ackRecorded = useCallback(
    (layerId: string, generation: number, epoch: number) =>
      controller.ack(layerId, generation, epoch),
    [controller],
  );
  // H3 teardown: release now (the canvas unmounts in this commit; there is
  // no clock to stop), then hand everything back after the queued UI jobs
  // and one more UI frame, when no mapper can still record.
  useEffect(
    () => () => {
      const finish = controller.release();
      setTimeout(() => {
        runOnUI(() => {
          "worklet";
          requestAnimationFrame(() => {
            runOnJS(finish)();
          });
        })();
      }, 0);
    },
    [controller],
  );

  const resources = useMemo<OrrerySpecResource[]>(
    () =>
      scene.world
        .filter((body) => body.kind !== "satellite")
        .map((body) => ({ key: bodyKey(body), body, scene })),
    [scene],
  );
  const initialZoom = previewHomeZoom(scene.extent, width, height);
  useEffect(() => {
    controller.setLooks(buildBodyLooks(resources, colors, mode));
  }, [controller, resources, colors, mode]);
  useEffect(() => {
    const initials = resources.flatMap((resource) => {
      const { name, photo } = bodyIdentity(resource, colors);
      const text = orreryInitials(name);
      if (text.length === 0) return [];
      const layout = bodyInitialsLayout(
        resource.body.kind === "sun" ? "sun" : "contact",
        resource.body.radius,
      );
      return [{ key: resource.key, text, ...layout, hasPhoto: photo !== null }];
    });
    controller.setText(
      {
        labels: [],
        initials,
        labelWidth: width,
        fontScale,
        fontProvider,
        labelInk: colors[TYPOGRAPHY.label.colorToken],
        captionInk: colors[TYPOGRAPHY.caption.colorToken],
        initialsInk: colors.avatarSwatchText,
      },
      {
        // Every body is on screen at Home and drawn at least MIN_CONTACT_PX.
        visible: null,
        eligible: resources.map((resource) => ({
          key: resource.key,
          radius: Math.max(
            MIN_CONTACT_PX / 2,
            resource.body.radius * initialZoom,
          ),
        })),
      },
    );
  }, [
    controller,
    resources,
    colors,
    width,
    fontScale,
    fontProvider,
    initialZoom,
  ]);
  const skyBucket = skySizeBucket(width, height);
  const skyLook = SKY_LOOKS[themePackage][mode];
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the bucket's numbers, not the object
  useEffect(() => {
    skySpec.value = buildSkySpec({
      colors,
      mode,
      themePackage,
      width,
      height,
      cover: skyBucket,
      hueIndex: SKY_UNTINTED,
      look: skyLook,
      seed: SKY_STAR_SEED,
      twinkleGroups: SKY_TWINKLE_GROUPS,
    });
  }, [
    skySpec,
    colors,
    mode,
    themePackage,
    width,
    height,
    skyBucket.width,
    skyBucket.height,
    skyLook,
  ]);
  const skyKey = skyBakeKey(themePackage, mode, skyBucket);
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by skyKey (package, mode, bucket)
  useEffect(() => {
    controller.requestSky({
      key: skyKey,
      size: SKY_NEBULA_TEX,
      period: SKY_NEBULA_PERIOD,
      seed: SKY_NEBULA_SEED[themePackage],
    });
  }, [controller, skyKey]);
  const ringLook = RING_LOOKS[themePackage][mode];
  useEffect(() => {
    ringSpecs.value = buildRingSpecs(resources, colors, ringLook);
    planeSpec.value = buildPlaneSpec(colors, mode, ringLook, {
      gridOpacity: GRID_OPACITY,
      gridRings: GRID_RINGS,
      gridSpokes: GRID_SPOKES,
      gridHalfWidthDp: GRID_HALF_WIDTH_DP,
      gridExtent: GRID_EXTENT,
      // D-57: no pulses in the Preview.
      pulseIntensity: 0,
      pulseBudget: 0,
    });
  }, [ringSpecs, planeSpec, resources, colors, mode, ringLook]);
  useEffect(() => {
    focusRing.value =
      focusedId === null
        ? NO_PREVIEW_FOCUS
        : {
            key: bodyKey({ id: focusedId, kind: "contact" }),
            ink: tokenInk(colors.orreryReticle),
          };
  }, [focusRing, focusedId, colors]);

  // ── Camera: pan / pinch SharedValues → a FLAT pose → one frame ───────────
  // The world reaches the frame worklet through a SharedValue (D-52: the
  // mapper never re-materialises a large captured object per render).
  const firstWorld = useRef<WorldTransition | null>(null);
  if (!firstWorld.current)
    firstWorld.current = previewTransition(scene.world, 1);
  const transition = useSharedValue<WorldTransition>(firstWorld.current);
  const builtFrom = useRef(scene.world);
  const worldGeneration = useRef(1);
  useEffect(() => {
    if (builtFrom.current === scene.world) return;
    builtFrom.current = scene.world;
    transition.value = previewTransition(
      scene.world,
      ++worldGeneration.current,
    );
  }, [transition, scene.world]);
  const viewport = useMemo(() => ({ width, height }), [width, height]);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const zoom = useSharedValue(initialZoom);
  const zoomStart = useSharedValue(initialZoom);
  useEffect(() => {
    panX.value = 0;
    panY.value = 0;
    zoom.value = initialZoom;
  }, [initialZoom, panX, panY, zoom]);
  const frame = useDerivedValue(() =>
    projectAnimatedFrame(
      transition.value,
      1,
      previewPose(panX.value, panY.value, zoom.value),
      viewport,
    ),
  );

  // ── Pictures ─────────────────────────────────────────────────────────────
  const host = useMemo(() => resolveOrreryRenderHost(), []);
  const aaDp = 1 / host.devicePixelRatio();
  const skyEffect = useMemo(() => orreryShader("skyNebula"), []);
  const ringEffect = useMemo(() => orreryShader("ringPlane"), []);
  const gridEffect = useMemo(() => orreryShader("gridPlane"), []);
  const bodyEffects = useMemo<OrreryBodyEffects>(
    () => ({
      ...NO_BODY_EFFECTS,
      swatch: orreryShader("bodySwatch"),
      photo: orreryShader("bodyPhoto"),
      corona: orreryShader("sunCorona"),
      sunDisc: orreryShader("sunDisc"),
    }),
    [],
  );
  const bands = useMemo(() => ringBands(), []);
  const disc = useMemo(() => gridDisc(), []);
  const skyPicture = useDerivedValue(() =>
    createPicture(
      (canvas) => {
        drawSky(
          canvas,
          skySpec.value,
          skyImage.value,
          frame.value.pose,
          STILL_AMBIENT,
          skyEffect,
          null,
        );
      },
      { width, height },
    ),
  );
  useLayerAck(PREVIEW_LAYER.sky, skyPicture, skyImage, ackRecorded);
  const planePicture = useDerivedValue(() =>
    createPicture(
      (canvas) => {
        drawPlaneGrid(
          canvas,
          frame.value,
          planeSpec.value.grid,
          gridEffect,
          disc,
          aaDp,
        );
        drawPlaneRings(
          canvas,
          frame.value,
          ringSpecs.value,
          ringEffect,
          bands,
          aaDp,
        );
      },
      { width, height },
    ),
  );
  const bodiesPicture = useDerivedValue(() =>
    createPicture(
      (canvas) => {
        const f = frame.value;
        const specs = bodySpecs.value.bodies;
        const order = orderBodies(f, specs);
        drawBodies(canvas, f, specs, order, "behind", bodyEffects);
        drawSun(canvas, f, specs, order, 0, bodyEffects);
        drawBodies(canvas, f, specs, order, "front", bodyEffects);
      },
      { width, height },
    ),
  );
  useLayerAck(PREVIEW_LAYER.bodies, bodiesPicture, bodySpecs, ackRecorded);
  const focusPicture = useDerivedValue(() =>
    createPicture(
      (canvas) => {
        drawPreviewFocus(canvas, frame.value, focusRing.value);
      },
      { width, height },
    ),
  );

  // ── Gestures: pan, pinch, tap → the nearest member in the drawn frame ────
  const pan = Gesture.Pan()
    .maxPointers(1)
    .onBegin(() => {
      "worklet";
      panStartX.value = panX.value;
      panStartY.value = panY.value;
    })
    .onUpdate((event) => {
      "worklet";
      panX.value = panStartX.value + event.translationX;
      panY.value = panStartY.value + event.translationY;
    });
  const pinch = Gesture.Pinch()
    .onBegin(() => {
      "worklet";
      zoomStart.value = zoom.value;
    })
    .onUpdate((event) => {
      "worklet";
      zoom.value = Math.max(
        PREVIEW_MIN_ZOOM,
        Math.min(PREVIEW_MAX_ZOOM, zoomStart.value * event.scale),
      );
    });
  const tap = Gesture.Tap().onEnd((event, success) => {
    "worklet";
    if (!success) return;
    const id = previewBodyAt(frame.value, event.x, event.y);
    if (id !== null) runOnJS(reportFocusBody)(id);
  });
  const gesture = Gesture.Race(tap, Gesture.Simultaneous(pan, pinch));

  return (
    <GestureDetector gesture={gesture}>
      <Canvas
        testID="system-preview-canvas"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.canvas}
      >
        <Picture picture={skyPicture} />
        <Picture picture={planePicture} />
        <Picture picture={bodiesPicture} />
        <Picture picture={focusPicture} />
      </Canvas>
    </GestureDetector>
  );
}

/**
 * Mirrors OrreryV2Canvas's lifecycle guarantee: no Skia canvas remains mounted
 * while this builder route is blurred or the app is backgrounded.
 */
export function SystemPreviewCanvas({
  scene,
  focusedId,
  onFocusBody,
}: {
  scene: ProvisionalOrreryScene;
  focusedId: number | null;
  onFocusBody: (contactId: number) => void;
}) {
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(
    AppState.currentState === "active",
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setAppActive(state === "active");
    });
    return () => subscription.remove();
  }, []);

  if (!previewCanvasMounted(focused, appActive)) return null;
  return (
    <View style={styles.root} pointerEvents="box-none">
      <ActiveSystemPreviewCanvas
        scene={scene}
        focusedId={focusedId}
        onFocusBody={onFocusBody}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill },
  canvas: { flex: 1 },
});
