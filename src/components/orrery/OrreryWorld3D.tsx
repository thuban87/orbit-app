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
 * and hands it to JS; `OrreryScene3D` draws it with a REAL perspective three camera built by
 * `orreryCameraRig` (fixed ~50° FOV, dolly F/zoom, default tilt ~62°). The UI
 * thread projects with the identical pinhole (orrery-camera-rig.test.ts), so
 * drawn == tappable.
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
  useFrameCallback,
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
  labFocalDistance,
  perspectiveScale,
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
import {
  CAPTURE_END,
  CAPTURE_START,
  SHED_END,
  SHED_START,
  type SwitchChoreography,
  sampleSwitchChoreography,
} from "@/logic/orrery-switch-choreography";
import { resolveSunOccupant } from "@/logic/sun-occupant-logic";
import type { OrrerySceneSnapshot } from "@/services/orrery-scene";
import type { ThemePalette } from "@/theme/theme-types";
import { useReducedMotion } from "@/theme/use-reduced-motion";
import { projectAnimatedFrameLite } from "./orrery-frame-lite";
import { OrreryTextCache } from "./orrery-text-cache";
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
const LABEL_BODY_GAP = 4;
/**
 * Lab C hero scale: contacts are drawn (and hit-tested — same world radius
 * feeds frame + GPU packet) this much larger than the 2.5D world radius so
 * people, not rings, are the heroes of the map. Sun/satellites unchanged.
 */
const CONTACT_HERO_SCALE = 1.9;
/** The star scales less than contacts so it anchors without swallowing ring 0. */
const SUN_HERO_SCALE = 1.45;
/**
 * Checkpoint D.1 — minimum ON-SCREEN body size (diameter, logical px). Far /
 * dolly-out contacts never shrink below this, so a dense System stays a field
 * of identifiable dots-with-faces instead of specks. Applied to the world
 * radius in the UI-thread sample, so drawn == tappable == label anchor.
 */
const MIN_CONTACT_PX = 18;
const MIN_SATELLITE_PX = 10;
/** The star stays a landmark at Dense Home (~0.09 zoom it would be ~4 px). */
const MIN_SUN_PX = 34;
/**
 * Canvas top inset: contacts/moons whose centre projects above the camera rect
 * top (the System selector / View options row) fade out over this many px and
 * stop being tappable, so far bodies never pile up under the header controls.
 */
const TOP_INSET_FADE_PX = 28;
/**
 * Checkpoint D.2 — moons ride a TILTED local orbit around their parent
 * (inclination vs the orbital plane), so they read as 3D satellites; the
 * focused parent's moons revolve slowly (frozen under Reduced Motion). The
 * height feeds the UI-thread projection too (frame-lite `lift`): drawn ==
 * tappable while they move.
 */
const MOON_INCLINATION = 0.5;
/** Revolution speed of the focused parent's moons (rad/ms ≈ one turn / 21 s). */
const MOON_SPEED = 0.0003;
/** Moon world radius as a fraction of its (hero-scaled) parent's; hits follow. */
const MOON_PARENT_FRACTION = 0.4;
/** Approximate OrreryFocusContext footprint (width 280; ~2 buttons + title). */
const FOCUS_CARD_WIDTH = 290;
const FOCUS_CARD_HEIGHT = 230;

/**
 * Lab C label tiers re-derived for the perspective camera. The product rule
 * (semanticLevel thresholds IDENTITY 2 / DETAIL 3) was defined on the old
 * near-orthographic camera, where "zoom" == on-screen magnification of a body.
 * With a real dolly camera that equivalence breaks (bodies off the pivot
 * shrink with depth), so the tier input is now the MEDIAN on-screen
 * magnification of the visible contacts, measured against the un-heroed
 * world radius: names appear when bodies are as large on screen as they were
 * when the old camera crossed the same tier.
 */
function effectiveLabelZoom(
  bodies: readonly {
    kind: string;
    radius: number;
    visible?: boolean;
    interactive?: boolean;
  }[],
  worldRadii: readonly number[],
  fallback: number,
): number {
  "worklet";
  const ratios: number[] = [];
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    const r = worldRadii[i];
    if (b.kind !== "contact" || !b.visible || !b.interactive || !(r > 0))
      continue;
    ratios.push((b.radius / r) * CONTACT_HERO_SCALE);
  }
  if (!ratios.length) return fallback;
  ratios.sort((a, b) => a - b);
  return ratios[Math.floor(ratios.length / 2)];
}
/** GPU fill tunables (Pixel 6 Pro native dpr is 3.5 → 1439×2538 buffer). */
const RENDER_MAX_PIXEL_RATIO = 2.0;
const RENDER_ANTIALIAS = true;
/** Lab-only badge tap: [tilt, yaw, zoom multiplier] presets (adb cannot pinch);
 * the zoom steps reach the identity/detail label tiers for evidence. */
const LAB_TILT_PRESETS: readonly [number, number, number][] = [
  [1.08, 0, 1],
  [1.0, 0.7, 2.2],
  [0.9, 2.2, 3.4],
  [1.2, 3.8, 1],
];
/** Frame-time log cadence (ms). */
const STATS_INTERVAL = 5000;

// --- 3D switch choreography (Lab C, Checkpoint C) -------------------------------
// The planar choreography (orrery-switch-choreography: roles, phases, timings,
// stagger) is unchanged and still owns x/y, radius, opacity and interactivity.
// The 3D world only ADDS a vertical axis + a camera breath on top of it:
/** Leaving bodies fall this far below the plane (in scene extents) into the fog. */
const SWITCH_FALL_EXTENTS = 0.42;
/** Entering bodies streak in from this far above the plane (scene extents). */
const SWITCH_RISE_EXTENTS = 0.55;
/** Camera breath during a switch: dolly-out fraction, yaw (rad), tilt (rad). */
const SWITCH_PULLBACK = 0.24;
const SWITCH_YAW = 0.38;
const SWITCH_TILT = -0.1;
/** Capture flare window (progress) after each entering body's capture end. */
const SWITCH_FLARE_WINDOW = 0.16;

function clamp01w(v: number): number {
  "worklet";
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function smooth01(v: number): number {
  "worklet";
  const t = clamp01w(v);
  return t * t * (3 - 2 * t);
}
/** Breath envelope: 0 at both ends, 1 mid-switch (eased, continuous at 0 and 1). */
function switchBreath(progress: number): number {
  "worklet";
  const p = clamp01w(progress);
  const s = Math.sin(Math.PI * p);
  return s * s;
}
/**
 * Per-entry vertical lift (world units, + = above the plane) and capture flare
 * (0..1). Index-aligned with `sampleSwitchChoreography(...).world`.
 */
function switchDepth(
  transition: SwitchChoreography,
  progress: number,
  extent: number,
): number[] {
  "worklet";
  const out: number[] = [];
  const p = clamp01w(progress);
  const still = transition.reducedMotion || p <= 0 || p >= 1;
  const ext = Math.max(1, extent);
  for (let i = 0; i < transition.entries.length; i++) {
    const e = transition.entries[i];
    let lift = 0;
    let flare = 0;
    if (!still && e.role === "leaving") {
      const shed = smooth01(
        (p - (SHED_START + e.stagger)) / (SHED_END - SHED_START),
      );
      lift = -SWITCH_FALL_EXTENTS * ext * shed * shed;
    } else if (!still && e.role === "entering") {
      const end = CAPTURE_END + e.stagger;
      const capture = smooth01(
        (p - (CAPTURE_START + e.stagger)) / (CAPTURE_END - CAPTURE_START),
      );
      const rest = 1 - capture;
      lift = SWITCH_RISE_EXTENTS * ext * rest * rest;
      const f = (p - (end - SWITCH_FLARE_WINDOW * 0.35)) / SWITCH_FLARE_WINDOW;
      flare = f > 0 && f < 1 ? Math.sin(Math.PI * f) : 0;
    }
    out.push(lift, flare);
  }
  return out;
}

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

/** Leak diagnosis (06-leak): Hermes external MB, optionally after a forced GC. */
function externalMb(forceGc: boolean): string {
  const g = globalThis as {
    gc?: () => void;
    HermesInternal?: { getInstrumentedStats?: () => Record<string, number> };
  };
  const read = () =>
    Math.round(
      (g.HermesInternal?.getInstrumentedStats?.().js_externalBytes ?? 0) / 1e6,
    );
  const before = read();
  if (!forceGc) return `${before}MB`;
  if (typeof g.gc !== "function") return `${before}MB (gc n/a)`;
  g.gc();
  return `${before}MB -> ${read()}MB after gc()`;
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
  // Moon clock: runs only while a single focused parent has moons on screen.
  const moonClock = useSharedValue(0);
  const orbitParent = useSharedValue<number | null>(null);
  const moonFrame = useFrameCallback((info) => {
    moonClock.value += info.timeSincePreviousFrame ?? 0;
  }, false);
  const sample = useDerivedValue(() => {
    const sampled = sampleSwitchChoreography(
      transition.value,
      progress.value,
    ).world;
    let sampledCamera =
      progress.value >= 1
        ? pose.value
        : sampleOrrerySwitchCamera(
            cameraFrom.value,
            cameraTo.value,
            progress.value,
          );
    // 3D camera breath: ease out (dolly back), swing the yaw and lift toward
    // top-down mid-switch, returning exactly to the destination Home at p=1.
    // Lives in the sampled camera, so the UI-thread frame (hits/labels) and
    // the GPU camera stay one pinhole.
    if (
      progress.value < 1 &&
      !transition.value.reducedMotion &&
      transition.value.intensity > 0
    ) {
      const b =
        switchBreath(progress.value) * (0.5 + 0.5 * transition.value.intensity);
      const zoom = sampledCamera.zoom * (1 - SWITCH_PULLBACK * b);
      sampledCamera = {
        ...sampledCamera,
        zoom,
        focalDistance: labFocalDistance(zoom),
        yaw: (sampledCamera.yaw ?? 0) + SWITCH_YAW * b,
        tilt: Math.max(0, (sampledCamera.tilt ?? 0) + SWITCH_TILT * b),
      };
    }
    const held = reorder.value;
    const world = previewReorder(
      sampled,
      held?.generation === sceneGeneration ? held : null,
    ).map((b) =>
      b.kind === "contact"
        ? { ...b, radius: b.radius * CONTACT_HERO_SCALE }
        : b,
    );
    const moons = deriveSatelliteBodies(
      world,
      satellites,
      sceneMembers,
      true,
      level.value,
    );
    const all: ((typeof world)[number] & { lift?: number })[] = [...world];
    for (let i = 0; i < moons.length; i++) {
      const m = moons[i];
      const parentId = m.satelliteTarget?.parentId;
      let parent: (typeof world)[number] | undefined;
      for (let j = 0; j < world.length; j++)
        if (world[j].kind !== "satellite" && world[j].id === parentId) {
          parent = world[j];
          break;
        }
      if (!parent) {
        all.push(m);
        continue;
      }
      const dx = m.x - parent.x;
      const dy = m.y - parent.y;
      const off = Math.hypot(dx, dy);
      const a =
        Math.atan2(dy, dx) +
        (parentId === orbitParent.value ? moonClock.value * MOON_SPEED : 0);
      all.push({
        ...m,
        radius: parent.radius * MOON_PARENT_FRACTION,
        x: parent.x + Math.cos(a) * off,
        y: parent.y + Math.sin(a) * off * Math.cos(MOON_INCLINATION),
        lift: Math.sin(a) * off * Math.sin(MOON_INCLINATION),
      });
    }
    // Minimum on-screen size: inflate the WORLD radius of bodies that would
    // project smaller than MIN_*_PX at their depth (sun excluded).
    for (let i = 0; i < all.length; i++) {
      const b = all[i];
      const px = sampledCamera.zoom * perspectiveScale(b, sampledCamera);
      if (!(px > 0)) continue;
      const minR =
        (b.kind === "satellite"
          ? MIN_SATELLITE_PX
          : b.kind === "sun"
            ? MIN_SUN_PX
            : MIN_CONTACT_PX) /
        2 /
        px;
      if (b.radius < minR) all[i] = { ...b, radius: minR };
    }
    return {
      world: all,
      camera: sampledCamera,
      generation: transition.value.generation,
    };
  });
  const logSwitch = useCallback((msg: string) => {
    console.log(`[lab-c] switch ${msg}`);
  }, []);
  useAnimatedReaction(
    () => transition.value.generation,
    (gen, prev) => {
      if (prev === null || gen === prev) return;
      const t = transition.value;
      let retained = 0;
      let leaving = 0;
      let entering = 0;
      for (const e of t.entries) {
        if (e.role === "retained") retained++;
        else if (e.role === "leaving") leaving++;
        else if (e.role === "entering") entering++;
      }
      runOnJS(logSwitch)(
        `gen=${gen} retained=${retained} leaving=${leaving} entering=${entering} intensity=${t.intensity.toFixed(2)} reduced=${t.reducedMotion}`,
      );
    },
  );
  const frame = useDerivedValue(() => {
    const current = sample.value;
    const f = projectAnimatedFrameLite(
      current.world,
      current.camera,
      viewport,
      current.generation,
    );
    // Canvas top inset (D.1): fade + disarm bodies under the header row.
    const top = viewport.camera?.y ?? viewport.usable?.y ?? 0;
    if (top > 0)
      for (let i = 0; i < f.bodies.length; i++) {
        const b = f.bodies[i];
        if (b.kind === "sun" || b.y >= top + TOP_INSET_FADE_PX) continue;
        const k = clamp01w((b.y - top) / TOP_INSET_FADE_PX);
        const opacity = b.opacity * k;
        f.bodies[i] = {
          ...b,
          opacity,
          interactive: b.interactive && k > 0.5,
          visible: b.visible && opacity > 0.01,
        };
      }
    return f;
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
  // Paragraphs are cached + reused across memo runs and disposed once the
  // committed label set drops them (D.6: 1 MB Hermes pressure per Paragraph).
  const textCache = useRef<OrreryTextCache | null>(null);
  if (!textCache.current) textCache.current = new OrreryTextCache();
  const texts = textCache.current;
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
        const text = texts.get(
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
              ? texts.get(
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
      texts,
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
    () => {
      const f = frame.value;
      const w = sample.value.world;
      const radii: number[] = [];
      for (let i = 0; i < w.length; i++) radii.push(w[i].radius);
      return effectiveLabelZoom(f.bodies, radii, f.pose.zoom);
    },
    (zoom) => {
      level.value = semanticLevel(zoom, level.value);
    },
  );
  const focusCardId =
    focusedIds.length === 1 && !focusedSatellite ? focusedIds[0] : null;
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
              depth: body.depth,
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
    // Lab C: the focus card (OrreryFocusContext) is NOT a shell obstacle — it
    // follows the focused body, sitting just below it. Reserve that rect so no
    // label (incl. the focused name) renders underneath the translucent card.
    if (focusCardId !== null) {
      const at =
        byKey.get(bodyKey({ id: focusCardId, kind: "contact" })) ??
        byKey.get(bodyKey({ id: focusCardId, kind: "sun" }));
      const fb = at === undefined ? undefined : current.bodies[at];
      if (fb?.visible)
        exclusions.push({
          x: fb.x - FOCUS_CARD_WIDTH / 2,
          y: fb.y + fb.radius,
          width: FOCUS_CARD_WIDTH,
          height: FOCUS_CARD_HEIGHT,
        });
    }
    return allocateLabels(
      candidates,
      level.value,
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
      const depth = switchDepth(transition.value, progress.value, worldExtent);
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
          (depth[i * 2] ?? 0) + ((b as { lift?: number }).lift ?? 0),
          depth[i * 2 + 1] ?? 0,
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
        visibleContacts: f.bodies.reduce(
          (n, b) =>
            n +
            (b.kind === "contact" &&
            b.visible &&
            b.interactive &&
            b.x >= 0 &&
            b.x <= f.viewport.width &&
            b.y >= 0 &&
            b.y <= f.viewport.height
              ? 1
              : 0),
          0,
        ),
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
          // Medallion plate: the theme surface, shaded, with the star's glow
          // token as ink — initials, or a person glyph when the self has none.
          swatch: colors.surface,
          plateInk: resolved.glowColor,
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
    // The scene now references only the committed set: release the rest.
    const live: (LabelText["text"] | null)[] = [];
    for (const t of labelTexts.values()) live.push(t.text, t.context);
    texts.sweep(live);
  }, [labelTexts, texts]);
  useEffect(() => () => texts.clear(), [texts]);
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
  const orbitingId =
    focusedIds.length === 1 &&
    satellites.some((row) => row.parentId === focusedIds[0])
      ? focusedIds[0]
      : null;
  useEffect(() => {
    orbitParent.value = orbitingId;
    moonFrame.setActive(orbitingId !== null && !reducedMotion);
    return () => moonFrame.setActive(false);
  }, [orbitingId, reducedMotion, orbitParent, moonFrame]);

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
      if (cancelled) return;
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
      let lastGcs = hs?.js_numGCs ?? 0;
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
            `[lab-c] frames=${d.length} avgDt=${avg.toFixed(1)}ms fps=${(1000 / Math.max(1, avg)).toFixed(1)} p95Dt=${percentile(d, 0.95).toFixed(1)} maxDt=${percentile(d, 1).toFixed(1)} jsRenderAvg=${(r.reduce((a, b) => a + b, 0) / Math.max(1, r.length)).toFixed(2)}ms p95=${percentile(r, 0.95).toFixed(2)} calls=${s.stats.calls} tris=${s.stats.triangles} photos=${photoTimings.length} photoAvg=${(photoTimings.reduce((a, b) => a + b, 0) / Math.max(1, photoTimings.length)).toFixed(1)}ms packets=${packetCount} bodies=${pendingPacket.current?.keys.length ?? 0} visibleContacts=${pendingPacket.current?.visibleContacts ?? 0} drawnSpheres=${s.stats.spheres} presentAvg=${(presentMs / Math.max(1, d.length)).toFixed(2)}ms drawAvg=${(s.stats.drawMs / Math.max(1, d.length)).toFixed(2)}ms`,
          );
          const hm = (
            globalThis as {
              HermesInternal?: {
                getInstrumentedStats?: () => Record<string, number>;
              };
            }
          ).HermesInternal?.getInstrumentedStats?.();
          const mem = renderer?.info.memory as
            | { textures?: number; geometries?: number }
            | undefined;
          console.log(
            `[lab-c] mem #${serial} external=${Math.round((hm?.js_externalBytes ?? 0) / 1e6)}MB heap=${Math.round((hm?.js_heapSize ?? 0) / 1e6)}MB gcs=${hm?.js_numGCs ?? "?"} texs=${mem?.textures ?? "?"} geos=${mem?.geometries ?? "?"} labelsLive=${s.stats.labelsLive} labelRasters=${s.stats.labelRasters} atlasFlushes=${s.stats.atlasFlushes} gcPerS=${(((hm?.js_numGCs ?? 0) - lastGcs) / ((t - statsAt) / 1000)).toFixed(1)} paragraphs=${texts.size} created=${texts.created} disposed=${texts.disposed}`,
          );
          lastGcs = hm?.js_numGCs ?? 0;
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
        `[lab-c] unmount #${serial}: loop stopped, GPU resources disposed external=${externalMb(false)}`,
      );
      setTimeout(
        () =>
          console.log(
            `[lab-c] post-unmount #${serial} external=${externalMb(true)}`,
          ),
        1000,
      );
    };
  }, [loadPhoto, device, texts]);

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
      strategyCamera: true,
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
  const homeZoom = useSharedValue<number | null>(null);
  const cycleTilt = useCallback(() => {
    tiltStep.current = (tiltStep.current + 1) % LAB_TILT_PRESETS.length;
    const [tilt, yaw, zoomBy] = LAB_TILT_PRESETS[tiltStep.current];
    runOnUI(() => {
      "worklet";
      const home = homeZoom.value ?? pose.value.zoom;
      if (homeZoom.value === null) homeZoom.value = pose.value.zoom;
      camera.recover({ ...pose.value, tilt, yaw, zoom: home * zoomBy });
    })();
    console.log(
      `[lab-c] tilt preset ${tiltStep.current}: tilt=${tilt} yaw=${yaw}`,
    );
  }, [camera, pose, homeZoom]);
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
