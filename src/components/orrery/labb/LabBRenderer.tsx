/**
 * ORRERY LAB B — the lab renderer (experiment/orrery-skia-unleashed).
 *
 * `OrreryWorld` keeps the whole MODEL half (the `frame` worklet and its
 * captures, `camera.frame` publication, semantic `level`, label measurement and
 * `allocations`, tap semantics, gestures, focus-lost reactions) and hands this
 * component one render contract (`LabRenderContract`). Only one renderer — and
 * so one canvas and one `useClock` — is mounted at a time.
 *
 * LAYER SLOTS (fixed back-to-front order; research 03 §1.3). Each slot is one
 * component; later work packages replace the slot's body, not this order:
 *
 *   L0  environment   <LabEnvironment>     WP-1.1 nebula + Atlas starfield
 *   L1  rings         <LabRings>           WP-1.3 depth fade / flow / wake / tethers
 *   L5  polaris       <Polaris> (legacy)   WP-1.2 sprite + compass tick
 *   --  reorder ghost  (slot from OrreryWorld; accent contract row stays there)
 *   L2–L4 bodies      ONE contiguous Group: sun + contacts (+ moons)
 *                     WP-1.2 lit surfaces, atmospheres, corona, lit moons
 *   L6  labels        <OrreryLabel> (legacy, per-label layer: C-09)  WP-1.3 HUD tags
 *   L7  fx            empty Group          WP-2.1/2.2 switch / focus / feedback FX
 *   dbg fps HUD       <LabFpsOverlay>      (flag `fpsHud`)
 *
 * The bodies Group must stay a CONTIGUOUS run of body root Groups: RNRecorder
 * flushes zIndex sorting at every non-Group command (legacy note).
 *
 * Per-renderer derived values owned here: `frameIndex` (O(1) key lookups) and
 * `fxFlags` (the store snapshot mirrored for worklets). WP-2.x adds
 * `switchSignal`, `switchRoles` and `focusMix` next to them.
 *
 * Heavy layers are UNMOUNTED when their flag is off, so a measured marginal
 * cost is real (research 03 §4).
 */
import { Group, type SkTypefaceFontProvider } from "@shopify/react-native-skia";
import { type ReactNode, useEffect, useMemo } from "react";
import type {
  ComposedGesture,
  GestureType,
} from "react-native-gesture-handler";
import {
  type SharedValue,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import { swatchIndex } from "@/components/avatar-initials";
import type { OrrerySatellite } from "@/db/orrery-satellites-read";
import type {
  CameraPose,
  CameraViewport,
  OrrerySatelliteTarget,
} from "@/logic/orrery-camera-logic";
import { type AnimatedFrame, bodyKey } from "@/logic/orrery-frame";
import {
  type LabelAllocation,
  orreryInitials,
  type SemanticLevel,
} from "@/logic/orrery-label-logic";
import type { ReorderDrag } from "@/logic/orrery-reorder-logic";
import { orreryRingStyle } from "@/logic/orrery-ring-logic";
import { resolveSunOccupant } from "@/logic/sun-occupant-logic";
import type { OrrerySceneSnapshot } from "@/services/orrery-scene";
import {
  type LabFxSnapshot,
  labFxSnapshot,
  useLabFxStore,
} from "@/stores/orrery-labb-fx-store";
import { labColor, resolveLabFxProfile } from "@/theme/orrery-lab-fx";
import type { ThemePalette } from "@/theme/theme-types";
import { OrreryLabel, type PreparedOrreryText } from "../OrreryLabel";
import { Polaris } from "../Polaris";
import type {
  OrreryBodyResource,
  OrrerySwitchRuntime,
} from "../use-orrery-switch-runtime";
import { LabFpsOverlay } from "./debug/LabFpsOverlay";
import { LabContactBody, LabMoon, LabSunBody } from "./LabBodies";
import { LabCanvas } from "./LabCanvas";
import { LabEnvironment } from "./LabEnvironment";
import { LabRings } from "./LabRings";
import { setLabEffectForceFallback } from "./labb-effects";
import { indexFrame } from "./labb-frame-index";
import { tokenToVec4 } from "./labb-uniforms";

/** HUD placement inside the canvas (below the System selector chip). */
const HUD_X = 8;
const HUD_Y = 68;

export interface LabPreparedLabel {
  id: string;
  text: PreparedOrreryText;
  context: PreparedOrreryText | null;
}

/** A tap stamp written by OrreryWorld's `resolveTap` (C-20); WP-2.2 ripples. */
export interface LabTapStamp {
  x: number;
  y: number;
  seq: number;
  kind: string;
}

/** Everything the lab renderer may read. Model-half values are never written. */
export interface LabRenderContract {
  // Shared values (UI thread)
  frame: SharedValue<AnimatedFrame>;
  allocations: SharedValue<LabelAllocation[]>;
  level: SharedValue<SemanticLevel>;
  reorder: SharedValue<ReorderDrag | null>;
  pose: SharedValue<CameraPose>;
  switchRuntime: OrrerySwitchRuntime;
  fxTap: SharedValue<LabTapStamp | null>;
  // React data
  scene: OrrerySceneSnapshot;
  resources: readonly OrreryBodyResource[];
  colors: ThemePalette;
  themePackage?: string;
  themeMode?: string;
  fontProvider: SkTypefaceFontProvider | null;
  labels: readonly LabPreparedLabel[];
  focusedIds: readonly number[];
  focusedSatellite?: OrrerySatelliteTarget | null;
  satellites: readonly OrrerySatellite[];
  viewport: CameraViewport;
  gesture: ComposedGesture | GestureType;
  /** The reorder ghost element, built by OrreryWorld (accent contract row). */
  ghost: ReactNode;
}

function LabBody({
  resource,
  frame,
  frameIndex,
  colors,
  fontProvider,
  focused,
}: {
  resource: OrreryBodyResource;
  frame: SharedValue<AnimatedFrame>;
  frameIndex: SharedValue<Record<string, number>>;
  colors: ThemePalette;
  fontProvider: SkTypefaceFontProvider | null;
  focused: boolean;
}) {
  const { body, scene, key } = resource;
  const resolved = resolveSunOccupant({
    ...scene.sun,
    starPalette: colors.starPalette,
    colors,
  });
  const contact = scene.contacts.find((item) => item.id === body.id);
  const name =
    body.kind === "sun"
      ? resolved.kind === "self"
        ? scene.sun.selfName
        : scene.sun.sunContactName
      : (contact?.name ?? "");
  const common = {
    identity: key,
    frame,
    frameIndex,
    radius: body.radius,
    swatch:
      colors.avatarSwatches[swatchIndex(name, colors.avatarSwatches.length)],
    swatchText: colors.avatarSwatchText,
    initials: orreryInitials(name),
    fontProvider,
    focusColor: focused ? colors.accent : undefined,
  };
  return body.kind === "sun" ? (
    <LabSunBody
      {...common}
      photo={resolved.photo}
      glowColor={resolved.glowColor}
      glowRadius={body.radius * 1.8}
    />
  ) : (
    <LabContactBody
      {...common}
      photo={contact?.photo ?? null}
      bodyFill={orreryRingStyle(contact?.status ?? null, colors).bodyFill}
    />
  );
}

export function LabBRenderer(contract: LabRenderContract) {
  const {
    frame,
    allocations,
    scene,
    resources,
    colors,
    fontProvider,
    labels,
    focusedIds,
    focusedSatellite,
    satellites,
    viewport,
    gesture,
    ghost,
  } = contract;
  // React-side flags (mount / unmount of heavy layers).
  const flags = useLabFxStore((s) => s.flags);
  const intensity = useLabFxStore((s) => s.intensity);
  const renderer = useLabFxStore((s) => s.renderer);
  // Worklet-side mirror: ONE SharedValue, updated only when the store changes.
  const fxFlags = useSharedValue<LabFxSnapshot>(
    labFxSnapshot({ renderer, flags, intensity }),
  );
  useEffect(() => {
    fxFlags.value = labFxSnapshot({ renderer, flags, intensity });
    setLabEffectForceFallback(flags.forceFallback);
  }, [fxFlags, renderer, flags, intensity]);
  const frameIndex = useDerivedValue(() => indexFrame(frame.value));
  const profile = useMemo(
    () => resolveLabFxProfile(contract.themePackage, contract.themeMode),
    [contract.themePackage, contract.themeMode],
  );
  const warmupColor = useMemo(
    () => tokenToVec4(colors.background),
    [colors.background],
  );
  return (
    <LabCanvas
      width={viewport.width}
      height={viewport.height}
      gesture={gesture}
      fxFlags={fxFlags}
      warmup={flags.warmup}
      warmupColor={warmupColor}
    >
      {/* L0 */}
      {flags.environment ? (
        <LabEnvironment
          width={viewport.width}
          height={viewport.height}
          colors={colors}
          background={labColor(colors, profile.roles.sky)}
          frame={frame}
        />
      ) : null}
      <Group
        clip={{ x: 0, y: 0, width: viewport.width, height: viewport.height }}
      >
        {/* L1 */}
        <Group>
          {flags.rings ? (
            <LabRings
              resources={resources}
              frame={frame}
              frameIndex={frameIndex}
              colors={colors}
            />
          ) : null}
        </Group>
        {/* L5 */}
        <Group>
          {flags.polaris ? (
            <Polaris frame={frame} extent={scene.extent} colors={colors} />
          ) : null}
        </Group>
        {/* reorder ghost (model-owned element) */}
        {ghost}
        {/* L2–L4: keep this run of body root Groups contiguous. */}
        <Group>
          {flags.bodies
            ? resources.map((resource) => (
                <LabBody
                  key={resource.key}
                  resource={resource}
                  frame={frame}
                  frameIndex={frameIndex}
                  colors={colors}
                  fontProvider={fontProvider}
                  focused={focusedIds.includes(resource.body.id)}
                />
              ))
            : null}
          {flags.bodies
            ? satellites.map((row) => {
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
                const focused =
                  focusedSatellite?.uid === row.uid &&
                  focusedSatellite.parentId === row.parentId &&
                  focusedSatellite.parentUid === row.parentUid;
                return (
                  <LabMoon
                    key={identity}
                    identity={identity}
                    frame={frame}
                    frameIndex={frameIndex}
                    color={colors.textSecondary}
                    focusColor={focused ? colors.accent : undefined}
                  />
                );
              })
            : null}
        </Group>
        {/* L6 — labels stay outside any future effect/filter layer. */}
        <Group>
          {flags.labels
            ? labels.map((label) => (
                <Group key={label.id}>
                  <OrreryLabel
                    identity={label.id}
                    text={label.text}
                    allocations={allocations}
                    colors={colors}
                  />
                  {label.context ? (
                    <OrreryLabel
                      identity={label.id}
                      text={label.context}
                      allocations={allocations}
                      colors={colors}
                      context
                    />
                  ) : null}
                </Group>
              ))
            : null}
        </Group>
        {/* L7 — focus / feedback / switch FX slot (WP-2.x). */}
        <Group />
      </Group>
      {flags.fpsHud ? (
        <LabFpsOverlay
          x={HUD_X}
          y={HUD_Y}
          colors={colors}
          profile={profile}
          fontProvider={fontProvider}
        />
      ) : null}
    </LabCanvas>
  );
}
