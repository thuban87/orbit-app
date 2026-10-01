/**
 * ORRERY LAB C — true-3D Orrery world (three.js WebGPURenderer on
 * react-native-webgpu / Dawn → Vulkan). Drop-in replacement for the Skia
 * `OrreryWorld` at the single OrreryScreen seam, with the SAME props.
 *
 * What stays exactly as in `OrreryWorld` (ADR-077 single UI-thread pose owner):
 *   - one UI-thread world sample per frame (switch choreography → reorder
 *     preview → satellites) and one `projectAnimatedFrame` published to
 *     `camera.frame.value` (hits, labels, focus card, reorder, focus-lost);
 *   - `allocateLabels` on the UI thread (Profile-vs-focus stays label-gated);
 *   - `createOrreryGestures` with the same callbacks.
 * What changes: drawing. The UI thread packs a small `OrreryPacket` (camera
 * pose + world positions + allocated label rects) whenever the frame changes
 * and hands it to JS; `OrreryScene3D` draws it with a three camera built by
 * `orreryCameraRig`, which reproduces the pinhole projection exactly (vitest
 * parity: orrery-camera-rig.test.ts), so drawn == published.
 *
 * Lifecycle: the GPU loop is a requestAnimationFrame owned by this component
 * and stops on unmount (OrreryScreen unmounts the world on blur/background).
 * All three/GPU resources are disposed on unmount. No React state per frame.
 *
 * Experimental compromises (Lab C, documented in _notes/M1-BUILD.md): render
 * loop on the JS thread (≤1 frame behind the UI-thread pose), reorder ghost not
 * drawn yet, ring stroke width fixed in world units.
 */
import type { SkTypefaceFontProvider } from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PixelRatio,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import {
  runOnJS,
  runOnUI,
  type SharedValue,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import { Canvas, type CanvasRef } from "react-native-webgpu";
import * as THREE from "three/webgpu";
import { swatchIndex } from "@/components/avatar-initials";
import type { OrrerySatellite } from "@/db/orrery-satellites-read";
import type {
  CameraPose,
  CameraViewport,
  OrreryIntent,
  OrrerySatelliteTarget,
} from "@/logic/orrery-camera-logic";
import {
  focusEffectivelyOffscreen,
  type OrreryContactTarget,
} from "@/logic/orrery-focus-logic";
import { bodyKey } from "@/logic/orrery-frame";
import {
  allocateLabels,
  labelContext,
  orreryInitials,
  type SemanticLevel,
  semanticLevel,
} from "@/logic/orrery-label-logic";
import {
  cameraExtent,
  hitPolaris,
  northTarget,
} from "@/logic/orrery-recovery-logic";
import {
  previewReorder,
  type ReorderIntent,
} from "@/logic/orrery-reorder-logic";
import { orreryRingStyle } from "@/logic/orrery-ring-logic";
import {
  deriveSatelliteBodies,
  resolveSatelliteTap,
} from "@/logic/orrery-satellite-logic";
import { sampleSwitchChoreography } from "@/logic/orrery-switch-choreography";
import { resolveSunOccupant } from "@/logic/sun-occupant-logic";
import type { OrrerySceneSnapshot } from "@/services/orrery-scene";
import type { ThemePalette } from "@/theme/theme-types";
import { useReducedMotion } from "@/theme/use-reduced-motion";
import { prepareOrreryText } from "./OrreryLabel";
import { projectAnimatedFrameLite } from "./orrery-frame-lite";
import {
  acquireOrreryDevice,
  prewarmOrreryDevice,
  releaseOrreryDevice,
  runBitmapProbe,
} from "./three/orrery-gpu";
import {
  type BodyInfo,
  KIND_CONTACT,
  KIND_SATELLITE,
  KIND_SUN,
  type LabelText,
  type OrreryPacket,
  OrreryScene3D,
} from "./three/orrery-scene3d";
import {
  createOrreryGestures,
  type OrreryCameraController,
} from "./use-orrery-camera";
import { loadOrreryImage } from "./use-orrery-photo";
import {
  type OrrerySwitchRuntime,
  sampleOrrerySwitchCamera,
} from "./use-orrery-switch-runtime";

const LABEL_MAX_WIDTH = 200;
const LABEL_BODY_GAP = 8;
/** GPU fill tunables (Pixel 6 Pro native dpr is 3.5 → 1439×2538 buffer). */
const RENDER_MAX_PIXEL_RATIO = 2.5;
const RENDER_ANTIALIAS = true;
/** Leak bisect: "full" | "init" (renderer only, no scene). */
const LAB_STAGE: string = "context";
/** Lab-only badge tap: [tilt, yaw] presets (tilt is clamped to 60° anyway). */
const LAB_TILT_PRESETS: readonly [number, number][] = [
  [0, 0],
  [0.65, 0],
  [1.0, 0.5],
  [1.04, 2.2],
];
/** Frame-time log cadence (ms). */
const STATS_INTERVAL = 5000;

let mountSerial = 0;
let renderCount = 0;
let gestureCount = 0;
let packetCount = 0;
let presentMs = 0;

// Spike: create the GPUDevice at module load (app start), long before any
// WebGPU surface exists. On the Pixel 6 Pro, requestDevice issued while the
// Orrery's SurfaceView was being created blocked JS + main for ~32 s.
prewarmOrreryDevice();

function disposeRenderer(renderer: THREE.WebGPURenderer) {
  // The mount's device is destroyed right after; three's device.lost reaction
  // would otherwise console.error a "device lost" for an intentional destroy.
  (renderer as unknown as { onDeviceLost: () => void }).onDeviceLost = () => {};
  renderer.setAnimationLoop(null);
  renderer.dispose();
  // three r184+ QuadMesh listener leak across remounts (react-native-webgpu issue 445).
  // biome-ignore lint/suspicious/noExplicitAny: QuadMesh is not in the public typings
  const quad = new (THREE as any).QuadMesh();
  for (const target of [
    quad.geometry,
    quad.geometry.index,
    ...Object.values(quad.geometry.attributes),
  ]) {
    if (target && (target as { _listeners?: unknown })._listeners)
      (target as { _listeners: unknown })._listeners = {};
  }
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

export function OrreryWorld3D({
  scene,
  pose,
  viewport,
  colors,
  fontProvider,
  onIntent,
  focusedIds,
  clusterIds = focusedIds.length > 1 ? focusedIds : [],
  focusedRelationById = {},
  interactive = true,
  camera,
  onFocusLost,
  onReorder,
  onReorderActivated,
  satellites = [],
  focusedSatellite,
  switchRuntime,
}: {
  scene: OrrerySceneSnapshot;
  camera: OrreryCameraController;
  pose: SharedValue<CameraPose>;
  viewport: CameraViewport;
  colors: ThemePalette;
  fontProvider: SkTypefaceFontProvider | null;
  onIntent: (intent: OrreryIntent) => void;
  focusedIds: number[];
  clusterIds?: number[];
  focusedRelationById?: Readonly<Record<number, string>>;
  interactive?: boolean;
  onFocusLost?: () => void;
  onReorder: (intent: ReorderIntent) => void;
  onReorderActivated: () => void;
  satellites?: readonly OrrerySatellite[];
  focusedSatellite?: OrrerySatelliteTarget | null;
  switchRuntime: OrrerySwitchRuntime;
}) {
  const { fontScale } = useWindowDimensions();
  renderCount++;
  if (renderCount % 10 === 1) console.log(`[lab-c] render #${renderCount}`);
  const resources = switchRuntime.resources;
  const mounted = useRef(true);
  const focusKey = JSON.stringify([
    scene.generation,
    focusedIds,
    focusedSatellite,
  ]);
  const latestFocus = useRef(focusKey);
  latestFocus.current = focusKey;
  const reportFocusLost = useCallback(() => {
    if (mounted.current && latestFocus.current === focusKey) onFocusLost?.();
  }, [focusKey, onFocusLost]);
  const level = useSharedValue<SemanticLevel>("overview");
  const reorder = camera.reorder;

  // --- UI thread: one world sample + one projected frame (as OrreryWorld) -----
  // Capture only shared values / plain arrays in worklets: a member access like
  // `switchRuntime.progress` or `scene.generation` makes the worklets plugin
  // capture the WHOLE root object (resources → 200 full scene snapshots, Maps),
  // which the UI runtime then deserialises (measured: ~30 s main-thread stall
  // at 200 contacts on the Pixel 6 Pro).
  const { transition, progress, cameraFrom, cameraTo } = switchRuntime;
  const sceneGeneration = scene.generation;
  const sceneMembers = scene.systemSnapshot.members;
  const sceneExtent = scene.extent;
  const sample = useDerivedValue(() => {
    const sampled = sampleSwitchChoreography(
      transition.value,
      progress.value,
    ).world;
    const sampledCamera =
      progress.value >= 1
        ? pose.value
        : sampleOrrerySwitchCamera(
            cameraFrom.value,
            cameraTo.value,
            progress.value,
          );
    const held = reorder.value;
    const world = previewReorder(
      sampled,
      held?.generation === sceneGeneration ? held : null,
    );
    const moons = deriveSatelliteBodies(
      world,
      satellites,
      sceneMembers,
      true,
      semanticLevel(sampledCamera.zoom, level.value),
    );
    return {
      world: [...world, ...moons],
      camera: sampledCamera,
      generation: transition.value.generation,
    };
  });
  const frame = useDerivedValue(() => {
    const current = sample.value;
    return projectAnimatedFrameLite(
      current.world,
      current.camera,
      viewport,
      current.generation,
    );
  });
  useAnimatedReaction(
    () => frame.value,
    (value) => {
      camera.frame.value = value;
    },
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // --- Labels (JS: native-measured text; UI: allocation) ----------------------
  const labels = useMemo(
    () =>
      scene.world.flatMap((body) => {
        if (body.id === 0) return [];
        const member = scene.systemSnapshot.members.find(
          (c) => c.id === body.id,
        );
        const name =
          member?.name ??
          (body.kind === "sun" ? scene.sun.sunContactName : undefined);
        if (name === undefined) return [];
        const focused = focusedIds.length === 1 && focusedIds[0] === body.id;
        const context = labelContext(
          member
            ? member.status
            : body.kind === "sun"
              ? scene.sun.occupant?.status
              : undefined,
          scene.gravity.get(body.id),
          focused && member ? focusedRelationById[body.id] : undefined,
        );
        const width = Math.min(LABEL_MAX_WIDTH * fontScale, viewport.width);
        const text = prepareOrreryText(
          name,
          "label",
          fontScale,
          width,
          fontProvider,
          colors,
        );
        if (!text) return [];
        return [
          {
            id: bodyKey(body),
            name,
            text,
            context: context
              ? prepareOrreryText(
                  context,
                  "caption",
                  fontScale,
                  width,
                  fontProvider,
                  colors,
                )
              : null,
            focused,
            cluster: clusterIds.includes(body.id),
            favorite: member?.favourite_rank != null,
          },
        ];
      }),
    [
      scene,
      colors,
      fontProvider,
      fontScale,
      viewport.width,
      focusedIds,
      clusterIds,
      focusedRelationById,
    ],
  );
  const measured = useMemo(
    () =>
      labels.map((label) => ({
        id: label.id,
        name: label.name,
        width: label.text.width,
        height: label.text.height,
        context: label.context?.text,
        contextWidth: label.context?.width,
        contextHeight: label.context?.height,
        focused: label.focused,
        cluster: label.cluster,
        favorite: label.favorite,
      })),
    [labels],
  );
  useAnimatedReaction(
    () => frame.value.pose.zoom,
    (zoom) => {
      level.value = semanticLevel(zoom, level.value);
    },
  );
  const allocations = useDerivedValue(() => {
    const current = frame.value;
    // O(N) key index instead of a find() per label (O(N²) at 200 bodies).
    const byKey = new Map<string, number>();
    for (let i = 0; i < current.bodies.length; i++)
      byKey.set(bodyKey(current.bodies[i]), i);
    const candidates = measured.flatMap((label) => {
      const at = byKey.get(label.id);
      const body = at === undefined ? undefined : current.bodies[at];
      return body?.visible && body.interactive
        ? [
            {
              ...label,
              x: body.x - label.width / 2,
              y: body.y + body.radius + LABEL_BODY_GAP,
              alternateY: body.y - body.radius - LABEL_BODY_GAP - label.height,
              opacity: body.opacity,
            },
          ]
        : [];
    });
    const exclusions = current.bodies
      .filter((b) => b.visible)
      .map((b) => ({
        x: b.x - b.radius,
        y: b.y - b.radius,
        width: b.radius * 2,
        height: b.radius * 2,
      }));
    return allocateLabels(
      candidates,
      semanticLevel(current.pose.zoom, level.value),
      current.viewport,
      exclusions,
    );
  });

  // --- UI → JS packet (only when the frame or allocation changes) -------------
  const sceneRef = useRef<OrreryScene3D | null>(null);
  const pendingPacket = useRef<OrreryPacket | null>(null);
  const receivePacket = useCallback((packet: OrreryPacket) => {
    pendingPacket.current = packet;
    packetCount++;
    sceneRef.current?.setPacket(packet);
  }, []);
  const worldExtent = scene.extent;
  useAnimatedReaction(
    () => {
      const f = frame.value;
      const w = sample.value.world;
      const keys: string[] = [];
      const bodies: number[] = [];
      for (let i = 0; i < w.length; i++) {
        const b = w[i];
        keys.push(bodyKey(b));
        bodies.push(
          b.x,
          b.y,
          b.radius,
          b.ringRadius,
          f.bodies[i]?.opacity ?? 0,
          b.kind === "sun" ? 1 : b.kind === "satellite" ? 2 : 0,
        );
      }
      return {
        pose: f.pose,
        viewport: f.viewport,
        keys,
        bodies,
        labels: allocations.value.map((a) => ({
          id: a.id,
          x: a.rect.x,
          y: a.rect.y,
          o: a.opacity,
          cx: a.contextRect?.x,
          cy: a.contextRect?.y,
        })),
        extent: worldExtent,
      };
    },
    (packet) => {
      runOnJS(receivePacket)(packet);
    },
  );

  // --- Body infos (tiles, ring styles) -----------------------------------------
  const bodyInfos = useMemo<BodyInfo[]>(() => {
    const out: BodyInfo[] = [];
    for (const resource of resources) {
      const { body, scene: s, key } = resource;
      if (body.kind === "sun") {
        const resolved = resolveSunOccupant({
          ...s.sun,
          starPalette: colors.starPalette,
          colors,
        });
        const name =
          resolved.kind === "self" ? s.sun.selfName : s.sun.sunContactName;
        out.push({
          key,
          kind: "sun",
          id: body.id,
          fill: resolved.glowColor,
          ring: null,
          photo: resolved.photo,
          initials: orreryInitials(name),
          swatch:
            colors.avatarSwatches[
              swatchIndex(name, colors.avatarSwatches.length)
            ],
          glow: resolved.glowColor,
        });
        continue;
      }
      const contact = s.contacts.find((c) => c.id === body.id);
      const name = contact?.name ?? "";
      const style = orreryRingStyle(contact?.status ?? null, colors);
      out.push({
        key,
        kind: "contact",
        id: body.id,
        fill: style.bodyFill,
        ring: style,
        photo: contact?.photo ?? null,
        initials: orreryInitials(name),
        swatch:
          colors.avatarSwatches[
            swatchIndex(name, colors.avatarSwatches.length)
          ],
      });
    }
    return out;
  }, [resources, colors]);
  const labelTexts = useMemo(
    () =>
      new Map<string, LabelText>(
        labels.map((l) => [l.id, { text: l.text, context: l.context }]),
      ),
    [labels],
  );
  const photoTokens = useRef(new Map<string, { cancelled: boolean }>());
  const loadPhoto = useCallback((key: string, photo: string) => {
    const previous = photoTokens.current.get(key);
    if (previous) previous.cancelled = true;
    const token = { cancelled: false };
    photoTokens.current.set(key, token);
    const t0 = performance.now();
    void loadOrreryImage(photo, undefined, token).then((image) => {
      if (!image) return;
      try {
        if (!token.cancelled) {
          const drew = sceneRef.current?.drawPhoto(key, photo, image);
          if (drew) photoTimings.push(performance.now() - t0);
        }
      } finally {
        image.dispose();
      }
    });
  }, []);
  const latestInputs = useRef({
    bodyInfos,
    labelTexts,
    focusedIds,
    colors,
    fontProvider,
  });
  latestInputs.current = {
    bodyInfos,
    labelTexts,
    focusedIds,
    colors,
    fontProvider,
  };
  useEffect(() => {
    sceneRef.current?.setBodies(bodyInfos, loadPhoto);
  }, [bodyInfos, loadPhoto]);
  useEffect(() => {
    sceneRef.current?.setLabelTexts(labelTexts);
  }, [labelTexts]);
  useEffect(() => {
    sceneRef.current?.setFocused(focusedIds);
  }, [focusedIds]);
  useEffect(() => {
    sceneRef.current?.applyColors(colors);
  }, [colors]);
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.setFontProvider(fontProvider);
    s.setBodies(latestInputs.current.bodyInfos, loadPhoto);
  }, [fontProvider, loadPhoto]);
  const reducedMotion = useReducedMotion();
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;

  // --- GPU lifecycle + render loop (owned here; stops on unmount) ---------------
  // 1. Acquire this mount's device BEFORE the <Canvas> exists (see orrery-gpu).
  //    One setState per mount (not per frame).
  const [device, setDevice] = useState<GPUDevice | null>(null);
  useEffect(() => {
    let cancelled = false;
    let owned: GPUDevice | null = null;
    acquireOrreryDevice().then(
      (d) => {
        if (cancelled) releaseOrreryDevice(d);
        else {
          owned = d;
          setDevice(d);
        }
      },
      (error) => console.warn("[lab-c] device acquire failed", error),
    );
    return () => {
      cancelled = true;
      // React runs this cleanup BEFORE the renderer effect's cleanup (same
      // declaration order), so defer one tick: destroy only after disposal.
      if (owned) {
        const d = owned;
        setTimeout(() => releaseOrreryDevice(d), 0);
      }
    };
  }, []);
  const canvasRef = useRef<CanvasRef>(null);
  // 2. Renderer + loop, once the device and the Canvas exist.
  useEffect(() => {
    if (!device) return;
    const serial = ++mountSerial;
    let cancelled = false;
    let raf = 0;
    let renderer: THREE.WebGPURenderer | null = null;
    let s: OrreryScene3D | null = null;
    const tMount = performance.now();
    const hs = (
      globalThis as {
        HermesInternal?: {
          getInstrumentedStats?: () => Record<string, number>;
        };
      }
    ).HermesInternal?.getInstrumentedStats?.();
    console.log(
      `[lab-c] mount #${serial} hermes heap=${Math.round((hs?.js_heapSize ?? 0) / 1e6)}MB allocated=${Math.round((hs?.js_allocatedBytes ?? 0) / 1e6)}MB external=${Math.round((hs?.js_externalBytes ?? 0) / 1e6)}MB gcs=${hs?.js_numGCs ?? "?"}`,
    );
    const start = async () => {
      let context = canvasRef.current?.getContext("webgpu") ?? null;
      for (let tries = 0; !context && tries < 30 && !cancelled; tries++) {
        await new Promise((r) => requestAnimationFrame(r));
        context = canvasRef.current?.getContext("webgpu") ?? null;
      }
      console.log(
        `[lab-c] stage context=${context ? "ok" : "null"} cancelled=${cancelled}`,
      );
      if (!context || cancelled) return;
      const dpr = Math.min(PixelRatio.get(), RENDER_MAX_PIXEL_RATIO);
      const nativeCanvas = context.canvas as unknown as {
        width: number;
        height: number;
        clientWidth: number;
        clientHeight: number;
      };
      nativeCanvas.width = Math.round(nativeCanvas.clientWidth * dpr);
      nativeCanvas.height = Math.round(nativeCanvas.clientHeight * dpr);
      console.log(
        `[lab-c] stage canvas ${nativeCanvas.clientWidth}x${nativeCanvas.clientHeight} -> ${nativeCanvas.width}x${nativeCanvas.height}`,
      );
      if (cancelled || LAB_STAGE === "context") return;
      renderer = new THREE.WebGPURenderer({
        antialias: RENDER_ANTIALIAS,
        canvas: context.canvas as unknown as HTMLCanvasElement,
        context,
        device,
      });
      console.log("[lab-c] stage renderer constructed");
      await renderer.init();
      if (cancelled) {
        disposeRenderer(renderer);
        return;
      }
      if (LAB_STAGE === "init") return;
      const inputs = latestInputs.current;
      s = new OrreryScene3D(renderer, inputs.colors, inputs.fontProvider, dpr);
      sceneRef.current = s;
      s.setBodies(inputs.bodyInfos, loadPhoto);
      s.setLabelTexts(inputs.labelTexts);
      s.setFocused(inputs.focusedIds);
      if (pendingPacket.current) s.setPacket(pendingPacket.current);
      console.log(
        `[lab-c] renderer ready #${serial} in ${Math.round(performance.now() - tMount)}ms buffer=${nativeCanvas.width}x${nativeCanvas.height} dpr=${dpr} TextDecoder=${typeof TextDecoder}`,
      );
      void runBitmapProbe(renderer, latestInputs.current.bodyInfos);
      let last = 0;
      let statsAt = performance.now();
      const tick = (t: number) => {
        if (cancelled || !s) return;
        const ms = s.frame(t, reducedRef.current);
        const tp = performance.now();
        context.present();
        presentMs += performance.now() - tp;
        if (last) s.stats.dts.push(t - last);
        s.stats.renderMs.push(ms);
        s.stats.frames++;
        last = t;
        if (t - statsAt >= STATS_INTERVAL) {
          const d = s.stats.dts;
          const avg = d.reduce((a, b) => a + b, 0) / Math.max(1, d.length);
          const r = s.stats.renderMs;
          console.log(
            `[lab-c] frames=${d.length} avgDt=${avg.toFixed(1)}ms fps=${(1000 / Math.max(1, avg)).toFixed(1)} p95Dt=${percentile(d, 0.95).toFixed(1)} maxDt=${percentile(d, 1).toFixed(1)} jsRenderAvg=${(r.reduce((a, b) => a + b, 0) / Math.max(1, r.length)).toFixed(2)}ms p95=${percentile(r, 0.95).toFixed(2)} calls=${s.stats.calls} tris=${s.stats.triangles} photos=${photoTimings.length} photoAvg=${(photoTimings.reduce((a, b) => a + b, 0) / Math.max(1, photoTimings.length)).toFixed(1)}ms packets=${packetCount} presentAvg=${(presentMs / Math.max(1, d.length)).toFixed(2)}ms drawAvg=${(s.stats.drawMs / Math.max(1, d.length)).toFixed(2)}ms`,
          );
          packetCount = 0;
          presentMs = 0;
          s.stats.drawMs = 0;
          s.stats.dts = [];
          s.stats.renderMs = [];
          statsAt = t;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    start().catch((error) => console.warn("[lab-c] renderer failed", error));
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      for (const token of photoTokens.current.values()) token.cancelled = true;
      photoTokens.current.clear();
      sceneRef.current = null;
      s?.dispose();
      if (renderer) disposeRenderer(renderer);
      console.log(
        `[lab-c] unmount #${serial}: loop stopped, GPU resources disposed`,
      );
    };
  }, [loadPhoto, device]);

  // --- Gestures / hits (identical wiring to OrreryWorld) ------------------------
  const identities = useMemo<OrreryContactTarget[]>(
    () => [
      ...scene.systemSnapshot.members.map((member) => ({
        kind: "member" as const,
        id: member.id,
        uid: member.uid,
      })),
      ...(scene.systemSnapshot.resolvedSunIdentity
        ? [
            {
              ...scene.systemSnapshot.resolvedSunIdentity,
              kind: "contact-sun" as const,
            },
          ]
        : []),
    ],
    [scene],
  );
  const members = scene.systemSnapshot.members;
  const reorderExpectation = useMemo(
    () => ({
      system: scene.system,
      expectedFullOrderedIds: scene.systemSnapshot.completeContactedOrder,
      expectedSavedSunContactId: scene.systemSnapshot.savedSunContactId,
      expectedEligibleVisibleIds:
        scene.systemSnapshot.eligibleContactedVisibleIds,
      expectedContactIdentities: scene.systemSnapshot.contactIdentities,
    }),
    [scene],
  );
  const gesture = useMemo(() => {
    gestureCount++;
    console.log(`[lab-c] gesture rebuilt #${gestureCount}`);
    return createOrreryGestures({
      pose,
      frame,
      camera,
      extent: cameraExtent(scene.extent),
      send: onIntent,
      enabled: interactive,
      stop: camera.stop,
      coast: camera.coast,
      reorder: {
        drag: camera.reorder,
        expectation: reorderExpectation,
        generation: scene.generation,
        acknowledge: onReorderActivated,
        commit: onReorder,
      },
      resolveTap: (current, x, y) => {
        "worklet";
        return resolveSatelliteTap(
          current,
          x,
          y,
          identities,
          allocations.value.map((label) => label.id),
          members,
        );
      },
      onNorth: (x, y) => {
        "worklet";
        if (!hitPolaris(frame.value, sceneExtent, x, y)) return false;
        camera.recover(northTarget(pose.value));
        return true;
      },
    });
  }, [
    pose,
    frame,
    camera,
    scene.extent,
    sceneExtent,
    onIntent,
    interactive,
    identities,
    allocations,
    members,
    reorderExpectation,
    onReorder,
    onReorderActivated,
    scene.generation,
  ]);
  const tiltStep = useRef(0);
  const cycleTilt = useCallback(() => {
    tiltStep.current = (tiltStep.current + 1) % LAB_TILT_PRESETS.length;
    const [tilt, yaw] = LAB_TILT_PRESETS[tiltStep.current];
    runOnUI(() => {
      "worklet";
      camera.recover({ ...pose.value, tilt, yaw });
    })();
    console.log(
      `[lab-c] tilt preset ${tiltStep.current}: tilt=${tilt} yaw=${yaw}`,
    );
  }, [camera, pose]);
  const singleFocus = focusedIds.length === 1 ? focusedIds[0] : null;
  useAnimatedReaction(
    () =>
      singleFocus !== null &&
      camera.active.value === null &&
      focusEffectivelyOffscreen(frame.value, singleFocus),
    (lost, previous) => {
      if (lost && previous === false && onFocusLost) runOnJS(reportFocusLost)();
    },
  );
  useAnimatedReaction(
    () => {
      if (!focusedSatellite) return false;
      const key = bodyKey({
        id: -1,
        kind: "satellite",
        satelliteTarget: focusedSatellite,
      });
      const current = frame.value;
      const body = current.bodies.find(
        (b) => bodyKey(b) === key && b.interactive,
      );
      if (!body) return true;
      const reach = body.hitRadius + 44;
      const rect = current.viewport.usable ?? {
        x: 0,
        y: 0,
        width: current.viewport.width,
        height: current.viewport.height,
      };
      return (
        body.x + reach < rect.x ||
        body.x - reach > rect.x + rect.width ||
        body.y + reach < rect.y ||
        body.y - reach > rect.y + rect.height
      );
    },
    (lost, previous) => {
      if (lost && previous !== true && onFocusLost) runOnJS(reportFocusLost)();
    },
  );

  return (
    <View style={{ width: viewport.width, height: viewport.height }}>
      <GestureDetector gesture={gesture}>
        <View
          testID="orrery-canvas"
          collapsable={false}
          style={StyleSheet.absoluteFill}
        >
          {device ? (
            <Canvas ref={canvasRef} style={StyleSheet.absoluteFill} />
          ) : null}
        </View>
      </GestureDetector>
      {/* Lab-only: tap the badge to cycle camera tilt presets through the real
          camera.recover path (adb cannot inject the two-finger tilt drag). */}
      <Pressable
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        onPress={cycleTilt}
        hitSlop={12}
        style={styles.badgeHit}
      >
        <Text style={[styles.badge, { color: colors.textSecondary }]}>
          ORRERY LAB C — TRUE 3D
        </Text>
      </Pressable>
    </View>
  );
}

const photoTimings: number[] = [];

/** Kind codes are shared with the packer above; re-exported for tests. */
export const ORRERY_3D_KINDS = { KIND_CONTACT, KIND_SUN, KIND_SATELLITE };

const styles = StyleSheet.create({
  badgeHit: {
    position: "absolute",
    left: 12,
    bottom: 8,
  },
  badge: {
    fontSize: 9,
    letterSpacing: 1.2,
    opacity: 0.7,
  },
});
