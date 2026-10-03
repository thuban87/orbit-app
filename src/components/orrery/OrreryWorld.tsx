/** ADR-077: keyed resources; one UI-thread world/projection frame for all layers. */
import {
  Group,
  Path,
  Skia,
  type SkTypefaceFontProvider,
} from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useWindowDimensions } from "react-native";
import {
  runOnJS,
  runOnUI,
  type SharedValue,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import { swatchIndex } from "@/components/avatar-initials";
import type { OrrerySatellite } from "@/db/orrery-satellites-read";
import {
  type CameraPose,
  type CameraViewport,
  type OrreryIntent,
  type OrrerySatelliteTarget,
  traceRingPath,
} from "@/logic/orrery-camera-logic";
import {
  focusEffectivelyOffscreen,
  type OrreryContactTarget,
} from "@/logic/orrery-focus-logic";
import {
  type AnimatedFrame,
  billboardPose,
  bodyKey,
  frameBodyById,
  frameBodyByKey,
  projectAnimatedFrame,
} from "@/logic/orrery-frame";
import {
  allocateLabels,
  type LabelAllocation,
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
  type ReorderDrag,
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
import { TYPOGRAPHY } from "@/theme/tokens/typography";
import { OrbitBody, orbitBodyInitialsLayout } from "./OrbitBody";
import { OrreryLabel } from "./OrreryLabel";
import { Polaris } from "./Polaris";
import {
  createOrreryTextPublisher,
  EMPTY_INITIALS_SPEC,
  EMPTY_LABEL_SPEC,
  ORRERY_INITIALS_MIN_RADIUS_PX,
  ORRERY_TEXT_ELIGIBILITY_INTERVAL_MS,
  type OrreryInitialsSource,
  type OrreryInitialsSpec,
  type OrreryLabelSource,
  type OrreryLabelSpec,
  type OrreryTextPublisher,
  type OrreryTextScene,
  type OrreryTextVisibility,
  orreryTextService,
} from "./resources/orrery-text-service";
import { SatelliteBody } from "./SatelliteBody";
import { SunBody, sunBodyInitialsLayout } from "./SunBody";
import {
  type OrreryBodyResource,
  type OrrerySwitchRuntime,
  sampleOrrerySwitchCamera,
} from "./use-orrery-switch-runtime";
import { OrreryV2Canvas } from "./v2/OrreryV2Canvas";
import {
  buildRingSpecs,
  EMPTY_RING_SPECS,
  type RingSpecs,
} from "./v2/scene-specs";

export { createOrreryGestures } from "./use-orrery-camera";

import {
  createOrreryGestures,
  type OrreryCameraController,
} from "./use-orrery-camera";

const LABEL_MAX_WIDTH = 200;
const LABEL_BODY_GAP = 8;
/**
 * D-52: stable empty defaults. A fresh `[]`/`{}` default per render changes the
 * frame worklet's closure (restarting the mapper) and the labels memo's deps
 * (rebuilding every Paragraph) on any unrelated parent render.
 */
const EMPTY_IDS: readonly number[] = Object.freeze([]);
const EMPTY_RELATIONS: Readonly<Record<number, string>> = Object.freeze({});
const EMPTY_SATELLITES: readonly OrrerySatellite[] = Object.freeze([]);

type SceneMember = OrrerySceneSnapshot["contacts"][number];
/**
 * D-52: id → FIRST row with that id (exactly what `find` returned), built once
 * per row array instead of a scan per body on every render. Keyed weakly on the
 * array, so an older scene's map is collected with its scene.
 */
const rowsById = new WeakMap<
  readonly SceneMember[],
  ReadonlyMap<number, SceneMember>
>();
function rowById(
  rows: readonly SceneMember[],
  id: number,
): SceneMember | undefined {
  let index = rowsById.get(rows);
  if (!index) {
    const built = new Map<number, SceneMember>();
    for (const row of rows) if (!built.has(row.id)) built.set(row.id, row);
    rowsById.set(rows, built);
    index = built;
  }
  return index.get(id);
}

/**
 * 38.7-04 (D-52/H4): what the text publisher needs from a frame — the visible
 * body keys (labels above overview) and the bodies big enough to show initials.
 * The signature changes only when either key set changes, never on radius alone.
 * A module-level worklet defined above its only caller (Hermes forward-ref rule).
 */
function orreryTextEligibility(
  frame: AnimatedFrame,
  minRadius: number,
): { signature: string; visibility: OrreryTextVisibility } {
  "worklet";
  const visible: string[] = [];
  const eligible: { key: string; radius: number }[] = [];
  const bodies = frame.bodies;
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i];
    if (body.kind === "satellite" || !body.visible) continue;
    const key = bodyKey(body);
    visible.push(key);
    if (body.radius >= minRadius) eligible.push({ key, radius: body.radius });
  }
  visible.sort();
  eligible.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  let signature = `${visible.join(",")}|`;
  for (let i = 0; i < eligible.length; i++) signature += `${eligible[i].key},`;
  return { signature, visibility: { visible, eligible } };
}

let worldSerial = 0;
/** After the post-release UI round trip: the released text entries may go. */
function finishTextRelease(owner: string, epoch: number): void {
  orreryTextService.confirmReleased(owner, epoch);
  orreryTextService.clearUnheld();
}

function ReorderGhost({
  frame,
  drag,
  color,
}: {
  frame: SharedValue<AnimatedFrame>;
  drag: SharedValue<ReorderDrag | null>;
  color: string;
}) {
  const path = useDerivedValue(() => {
    const result = Skia.Path.Make();
    const held = drag.value;
    if (!held?.active) return result;
    const body = frameBodyById(frame.value, held.id);
    // H2: only the visible ring samples; open at the horizon.
    if (body) traceRingPath(result, body);
    if (body && !body.culled) result.addCircle(body.x, body.y, body.radius + 4);
    return result;
  });
  return <Path path={path} color={color} style="stroke" strokeWidth={2} />;
}
/** The display name a body's swatch and initials derive from. */
function bodyDisplayName(
  resource: OrreryBodyResource,
  colors: ThemePalette,
): { name: string; photo: string | null } {
  const { body, scene } = resource;
  if (body.kind === "sun") {
    const resolved = resolveSunOccupant({
      ...scene.sun,
      starPalette: colors.starPalette,
      colors,
    });
    return {
      name:
        resolved.kind === "self"
          ? scene.sun.selfName
          : scene.sun.sunContactName,
      photo: resolved.photo,
    };
  }
  const contact = rowById(scene.contacts, body.id);
  return { name: contact?.name ?? "", photo: contact?.photo ?? null };
}

function ProjectedBody({
  resource,
  frame,
  colors,
  initialsSpec,
  focused,
}: {
  resource: OrreryBodyResource;
  frame: SharedValue<AnimatedFrame>;
  colors: ThemePalette;
  initialsSpec: SharedValue<OrreryInitialsSpec>;
  focused: boolean;
}) {
  const { body, scene, key } = resource;
  const projection = useDerivedValue(() =>
    billboardPose(frame.value, key, body.radius),
  );
  const resolved = resolveSunOccupant({
    ...scene.sun,
    starPalette: colors.starPalette,
    colors,
  });
  const contact = rowById(scene.contacts, body.id);
  const name =
    body.kind === "sun"
      ? resolved.kind === "self"
        ? scene.sun.selfName
        : scene.sun.sunContactName
      : (contact?.name ?? "");
  const common = {
    cx: 0,
    cy: 0,
    radius: body.radius,
    projection,
    swatch:
      colors.avatarSwatches[swatchIndex(name, colors.avatarSwatches.length)],
    initialsSpec,
    textKey: key,
    focusColor: focused ? colors.accent : undefined,
  };
  // Each branch returns exactly ONE actual body root Group; no parent wrapper.
  return body.kind === "sun" ? (
    <SunBody
      {...common}
      photo={resolved.photo}
      glowColor={resolved.glowColor}
      glowRadius={body.radius * 1.8}
    />
  ) : (
    <OrbitBody
      {...common}
      photo={contact?.photo ?? null}
      bodyFill={orreryRingStyle(contact?.status ?? null, colors).bodyFill}
    />
  );
}

export function OrreryWorld({
  scene,
  pose,
  viewport,
  colors,
  fontProvider,
  onIntent,
  focusedIds,
  clusterIds = focusedIds.length > 1 ? focusedIds : EMPTY_IDS,
  focusedRelationById = EMPTY_RELATIONS,
  interactive = true,
  camera,
  onFocusLost,
  onReorder,
  onReorderActivated,
  satellites = EMPTY_SATELLITES,
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
  clusterIds?: readonly number[];
  /** Already-filtered, existing relation context only; supplied by focus/moon owner. */
  focusedRelationById?: Readonly<Record<number, string>>;
  interactive?: boolean;
  onFocusLost?: () => void;
  onReorder: (intent: ReorderIntent) => void;
  onReorderActivated: () => void;
  satellites?: readonly OrrerySatellite[];
  focusedSatellite?: OrrerySatelliteTarget | null;
  /** Screen-owned runtime survives this canvas consumer being unmounted. */
  switchRuntime: OrrerySwitchRuntime;
}) {
  const { fontScale } = useWindowDimensions();
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
  // 38.7-04 (D-46/D-52/M3): every label and initials Paragraph reaches the
  // canvas through these specs, written by the JS text publisher — never React
  // state, so a tier change commits no render here.
  const labelSpec = useSharedValue<OrreryLabelSpec>(EMPTY_LABEL_SPEC);
  const initialsSpec = useSharedValue<OrreryInitialsSpec>(EMPTY_INITIALS_SPEC);
  const publisherRef = useRef<OrreryTextPublisher | null>(null);
  if (!publisherRef.current) {
    const owner = `orrery-world:${++worldSerial}`;
    publisherRef.current = Object.assign(
      createOrreryTextPublisher({
        owner,
        write: (labels, initials) => {
          if (labels) labelSpec.value = labels;
          if (initials) initialsSpec.value = initials;
        },
      }),
      { owner },
    );
  }
  const publisher = publisherRef.current as OrreryTextPublisher & {
    owner: string;
  };
  // Capture only the producer's input; the controller also contains its published output.
  const reorder = camera.reorder;
  // D-52 freeze: the frame worklet may capture only SharedValues, primitives,
  // module functions and memoised plain values. Capturing `switchRuntime` (every
  // resource holds a full scene) or `scene` re-materialises them on the UI
  // runtime at each mapper start (orrery-frame-mapper.test.ts guards this).
  const { transition, progress, cameraFrom, cameraTo } = switchRuntime;
  const generation = scene.generation;
  // The pan bound the pose was clamped to (gestures, Home, recovery); the
  // dolly focal no longer encodes it (38.7-05).
  const frameExtent = cameraExtent(scene.extent);
  const memberIdentities = useMemo(
    () => scene.systemSnapshot.members.map(({ id, uid }) => ({ id, uid })),
    [scene],
  );
  const frame = useDerivedValue(() => {
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
      held?.generation === generation ? held : null,
    );
    // D-47: moons follow the last settled tier (projected size), never a
    // tier recomputed from raw zoom inside the projection pass.
    const moons = deriveSatelliteBodies(
      world,
      satellites,
      memberIdentities,
      true,
      level.value,
    );
    const completeWorld = [...world, ...moons];
    return projectAnimatedFrame(
      {
        generation: transition.value.generation,
        from: completeWorld,
        to: completeWorld,
      },
      1,
      sampledCamera,
      viewport,
      { extent: frameExtent },
    );
  });
  // Conventional focus positioning consumes this same interpolated frame.
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
  const starColors = useMemo(
    () => [colors.textSecondary, colors.textPrimary, ...colors.starPalette],
    [colors],
  );
  // D-43/D-44: the V2 ring look, rebuilt on resource or theme change only
  // (never per frame); the base picture reads it with the shared frame.
  const ringSpecs = useSharedValue<RingSpecs>(EMPTY_RING_SPECS);
  useEffect(() => {
    ringSpecs.value = buildRingSpecs(resources, colors);
  }, [ringSpecs, resources, colors]);
  // Plain label inputs only (no Paragraphs): one stable label node per
  // labelable body; the publisher decides which ones get text, per tier.
  const labelSources = useMemo<OrreryLabelSource[]>(
    () =>
      scene.world.flatMap((body) => {
        if (body.id === 0) return [];
        const member = rowById(scene.systemSnapshot.members, body.id);
        const name =
          member?.name ??
          (body.kind === "sun" ? scene.sun.sunContactName : undefined);
        if (name === undefined) return [];
        const focused = focusedIds.length === 1 && focusedIds[0] === body.id;
        // D-11: nonmember global sun keeps identity, but no relationship context.
        const context = labelContext(
          member
            ? member.status
            : body.kind === "sun"
              ? scene.sun.occupant?.status
              : undefined,
          scene.gravity.get(body.id),
          focused && member ? focusedRelationById[body.id] : undefined,
        );
        return [
          {
            key: bodyKey(body),
            name,
            context,
            focused,
            cluster: clusterIds.includes(body.id),
            favorite: member?.favourite_rank != null,
          },
        ];
      }),
    [scene, focusedIds, clusterIds, focusedRelationById],
  );
  const initialsSources = useMemo<OrreryInitialsSource[]>(
    () =>
      resources.flatMap((resource) => {
        if (resource.body.kind === "satellite") return [];
        const { name, photo } = bodyDisplayName(resource, colors);
        const text = orreryInitials(name);
        if (text.length === 0) return [];
        const layout = (
          resource.body.kind === "sun"
            ? sunBodyInitialsLayout
            : orbitBodyInitialsLayout
        )(resource.body.radius);
        return [
          { key: resource.key, text, ...layout, hasPhoto: photo !== null },
        ];
      }),
    [resources, colors],
  );
  const textScene = useMemo<OrreryTextScene>(
    () => ({
      labels: labelSources,
      initials: initialsSources,
      labelWidth: Math.min(LABEL_MAX_WIDTH * fontScale, viewport.width),
      fontScale,
      fontProvider,
      labelInk: colors[TYPOGRAPHY.label.colorToken],
      captionInk: colors[TYPOGRAPHY.caption.colorToken],
      initialsInk: colors.avatarSwatchText,
    }),
    [
      labelSources,
      initialsSources,
      fontScale,
      viewport.width,
      fontProvider,
      colors,
    ],
  );
  useEffect(() => {
    publisher.setScene(textScene);
  }, [publisher, textScene]);
  useEffect(
    () => () => {
      // Unmount: pins retire now; the entries are disposed only after the
      // canvas teardown queued by this commit and one UI frame (no pending
      // redraw can still read them), then everything unheld is cleared.
      const epoch = publisher.release();
      if (epoch === null) return;
      const { owner } = publisher;
      setTimeout(() => {
        runOnUI(() => {
          "worklet";
          requestAnimationFrame(() => {
            runOnJS(finishTextRelease)(owner, epoch);
          });
        })();
      }, 0);
    },
    [publisher],
  );
  const sendTier = useCallback(
    (tier: SemanticLevel) => publisher.setTier(tier),
    [publisher],
  );
  const sendVisibility = useCallback(
    (visibility: OrreryTextVisibility) => publisher.setVisibility(visibility),
    [publisher],
  );
  const confirmTextEcho = useCallback(
    (generation: number, epoch: number) =>
      publisher.confirmEchoed(generation, epoch),
    [publisher],
  );
  // C-H2: the echo is sent one frame after the readers re-ran, then a second
  // UI round trip orders it behind any first-frame draw a React commit queued
  // before the echo arrived (that draw may still record the old Paragraphs).
  const echoText = useCallback(
    (generation: number, epoch: number) => {
      runOnUI(() => {
        "worklet";
        runOnJS(confirmTextEcho)(generation, epoch);
      })();
    },
    [confirmTextEcho],
  );
  // D-47: the semantic tier follows on-screen magnification, not raw zoom.
  useAnimatedReaction(
    () => frame.value.labelMagnification,
    (magnification) => {
      level.value = semanticLevel(magnification, level.value);
    },
  );
  // M3: the tier reaches text preparation through runOnJS, only on change.
  useAnimatedReaction(
    () => level.value,
    (tier, previous) => {
      if (tier !== previous) runOnJS(sendTier)(tier);
    },
  );
  // H4: visibility/initials eligibility, computed at most every
  // ORRERY_TEXT_ELIGIBILITY_INTERVAL_MS (a trailing timer catches the final
  // pose) and sent only when a key set changed.
  const textReport = useSharedValue({ at: -1e12, signature: "", timer: false });
  useAnimatedReaction(
    () => frame.value,
    () => {
      const state = textReport.value;
      if (state.timer) return;
      const run = () => {
        const latest = orreryTextEligibility(
          frame.value,
          ORRERY_INITIALS_MIN_RADIUS_PX,
        );
        const previous = textReport.value.signature;
        textReport.value = {
          at: Date.now(),
          signature: latest.signature,
          timer: false,
        };
        if (latest.signature !== previous)
          runOnJS(sendVisibility)(latest.visibility);
      };
      const wait = state.at + ORRERY_TEXT_ELIGIBILITY_INTERVAL_MS - Date.now();
      if (wait > 0) {
        textReport.value = { ...state, timer: true };
        setTimeout(run, wait);
      } else run();
    },
  );
  // C-H2: a spec change arms a one-shot UI frame callback; one frame later the
  // declarative readers have re-run, and only then is the generation echoed.
  useAnimatedReaction(
    () => {
      const labels = labelSpec.value;
      const initials = initialsSpec.value;
      return labels.generation >= initials.generation
        ? { generation: labels.generation, epoch: labels.mountEpoch }
        : { generation: initials.generation, epoch: initials.mountEpoch };
    },
    (spec, previous) => {
      if (spec.generation === 0) return;
      if (
        previous &&
        previous.generation === spec.generation &&
        previous.epoch === spec.epoch
      )
        return;
      requestAnimationFrame(() => {
        runOnJS(echoText)(spec.generation, spec.epoch);
      });
    },
  );
  const allocations = useDerivedValue(() => {
    const current = frame.value;
    // Only admitted labels are candidates (the spec carries plain measurements).
    const candidates = labelSpec.value.measured.flatMap((label) => {
      const body = frameBodyByKey(current, label.id);
      return body?.visible && body.interactive
        ? [
            {
              ...label,
              x: body.x - label.width / 2,
              y: body.y + body.radius + LABEL_BODY_GAP,
              alternateY: body.y - body.radius - LABEL_BODY_GAP - label.height,
              opacity: body.opacity,
              // D-47 nearest-first within a priority class.
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
    return allocateLabels(
      candidates,
      semanticLevel(current.labelMagnification, level.value),
      current.viewport,
      exclusions,
    );
  });
  // D-52: label id → allocation (first per id, as `find` returned), once per
  // frame, so each label reads O(1) instead of scanning every allocation.
  const allocationIndex = useDerivedValue(() => {
    const index: Record<string, LabelAllocation> = {};
    const list = allocations.value;
    for (let i = 0; i < list.length; i++)
      if (index[list[i].id] === undefined) index[list[i].id] = list[i];
    return index;
  });
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
  // A primitive, so the north-tap worklet never captures the whole scene.
  const sceneExtent = scene.extent;
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
  const gesture = useMemo(
    () =>
      createOrreryGestures({
        pose,
        frame,
        camera,
        extent: cameraExtent(sceneExtent),
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
          // D-60: a single body tap always focuses, so visible labels no
          // longer take part in tap resolution.
          return resolveSatelliteTap(
            current,
            x,
            y,
            identities,
            memberIdentities,
          );
        },
        onNorth: (x, y) => {
          "worklet";
          if (!hitPolaris(frame.value, sceneExtent, x, y)) return false;
          camera.recover(northTarget(pose.value));
          return true;
        },
      }),
    [
      pose,
      frame,
      camera,
      sceneExtent,
      onIntent,
      interactive,
      identities,
      memberIdentities,
      reorderExpectation,
      onReorder,
      onReorderActivated,
      scene.generation,
    ],
  );
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
      // Keys are unique within a frame, so the indexed body is the one `find`
      // matched; a non-interactive body is treated as absent, as before.
      const indexed = frameBodyByKey(current, key);
      const body = indexed?.interactive ? indexed : undefined;
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
    <OrreryV2Canvas
      width={viewport.width}
      height={viewport.height}
      background={colors.background}
      starColors={starColors}
      gesture={gesture}
      frame={frame}
      ringSpecs={ringSpecs}
    >
      <Group
        clip={{ x: 0, y: 0, width: viewport.width, height: viewport.height }}
      >
        <Polaris frame={frame} extent={scene.extent} colors={colors} />
        <ReorderGhost
          frame={frame}
          drag={camera.reorder}
          color={colors.accent}
        />
        {/* RNRecorder flushes sorting at every non-Group command. Keep this run contiguous. */}
        <Group>
          {resources.map((resource) => (
            <ProjectedBody
              key={resource.key}
              resource={resource}
              frame={frame}
              colors={colors}
              initialsSpec={initialsSpec}
              focused={focusedIds.includes(resource.body.id)}
            />
          ))}
          {satellites.map((row) => {
            const target = {
              kind: "satellite" as const,
              uid: row.uid,
              parentId: row.parentId,
              parentUid: row.parentUid,
            };
            const identity = bodyKey({
              kind: "satellite",
              id: -1,
              satelliteTarget: target,
            });
            return (
              <SatelliteBody
                key={identity}
                identity={identity}
                frame={frame}
                colors={colors}
                focused={
                  focusedSatellite?.uid === row.uid &&
                  focusedSatellite.parentId === row.parentId &&
                  focusedSatellite.parentUid === row.parentUid
                }
              />
            );
          })}
        </Group>
        {/* Labels/backplates are screen-space and never interrupt the body batch. */}
        <Group>
          {labelSources.map((label) => (
            <Group key={label.key}>
              <OrreryLabel
                identity={label.key}
                spec={labelSpec}
                allocationIndex={allocationIndex}
                colors={colors}
              />
              {label.context ? (
                <OrreryLabel
                  identity={label.key}
                  spec={labelSpec}
                  allocationIndex={allocationIndex}
                  colors={colors}
                  context
                />
              ) : null}
            </Group>
          ))}
        </Group>
      </Group>
    </OrreryV2Canvas>
  );
}
