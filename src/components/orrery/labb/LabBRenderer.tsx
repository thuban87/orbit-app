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
 *   L0  environment   <LabEnvironment>     baked nebula + 3-depth Atlas starfield (WP-1.1)
 *   L1  rings         <LabRings>           WP-1.3 instrument orbits under one plane homography
 *   L5  polaris       <LabPolaris>         glow + spikes (flag polarisLab; legacy fallback)
 *   --  reorder ghost  (slot from OrreryWorld; accent contract row stays there)
 *   L2–L4 bodies      ONE contiguous Group: sun + contacts (+ moons)
 *                     WP-1.2 lit surfaces, atmospheres, corona, lit moons
 *                     (one shader draw per body; flag bodyLighting)
 *   L6  labels        <LabHudLabel> HUD tags (per-label layer: C-09; flag labelHud)
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
import {
  Group,
  Paint,
  RuntimeShader,
  type SkTypefaceFontProvider,
} from "@shopify/react-native-skia";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { PixelRatio } from "react-native";
import type {
  ComposedGesture,
  GestureType,
} from "react-native-gesture-handler";
import {
  type SharedValue,
  useAnimatedReaction,
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
import { sampleSwitchSignal } from "@/logic/orrery-switch-choreography";
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
import { HUD_H, LabFpsOverlay } from "./debug/LabFpsOverlay";
import {
  LabContactBody,
  LabMoon,
  LabSunBody,
  type LabWorldLook,
} from "./LabBodies";
import { LabCanvas } from "./LabCanvas";
import { LabEnvironment } from "./LabEnvironment";
import { LabHudLabel } from "./LabLabels";
import { LabPolaris } from "./LabPolaris";
import { LabRings, LabRingsPathRebuild } from "./LabRings";
import {
  LabSwitchOver,
  LabSwitchUnder,
  useShockFilterUniforms,
} from "./LabSwitchFx";
import type { LabSwitchContext } from "./labb-context";
import { getLabEffect, setLabEffectForceFallback } from "./labb-effects";
import { indexFrame } from "./labb-frame-index";
import {
  displayedSkyHue,
  type LabSkyHueState,
  switchRoles,
  systemSkyIndex,
} from "./labb-switch-logic";
import { tokenToVec3, tokenToVec4 } from "./labb-uniforms";

/** HUD placement: bottom-left corner of the canvas, above the lab marker. */
const HUD_X = 8;
const HUD_BOTTOM_GAP = 34;

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
  look,
}: {
  resource: OrreryBodyResource;
  frame: SharedValue<AnimatedFrame>;
  frameIndex: SharedValue<Record<string, number>>;
  colors: ThemePalette;
  fontProvider: SkTypefaceFontProvider | null;
  focused: boolean;
  look: LabWorldLook;
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
    look,
  };
  return body.kind === "sun" ? (
    <LabSunBody
      {...common}
      photo={resolved.photo}
      glowColor={resolved.glowColor}
      glowRadius={body.radius * 1.8}
      self={resolved.kind === "self"}
    />
  ) : (
    <LabContactBody
      {...common}
      photo={contact?.photo ?? null}
      bodyFill={orreryRingStyle(contact?.status ?? null, colors).bodyFill}
      status={contact?.status ?? null}
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
  // Applied DURING render (an idempotent module flag), not in the effect:
  // children call `getLabEffect` while rendering, so setting it after commit
  // left the first post-toggle render on the stale value (found in WP-1.1).
  setLabEffectForceFallback(flags.forceFallback);
  useEffect(() => {
    fxFlags.value = labFxSnapshot({ renderer, flags, intensity });
  }, [fxFlags, renderer, flags, intensity]);
  const frameIndex = useDerivedValue(() => indexFrame(frame.value));
  const profile = useMemo(
    () => resolveLabFxProfile(contract.themePackage, contract.themeMode),
    [contract.themePackage, contract.themeMode],
  );
  const sky = labColor(colors, profile.roles.sky);
  const look = useMemo<LabWorldLook>(
    () => ({
      lit: flags.bodyLighting,
      colors,
      profile,
      sky,
      extent: scene.extent,
      moonShader: flags.moonShader,
    }),
    [flags.bodyLighting, flags.moonShader, colors, profile, sky, scene.extent],
  );
  // Label id (bodyKey) → status hue for the HUD tag hairline / leader.
  const labelStatus = useMemo(() => {
    const out: Record<string, string> = {};
    for (const r of resources) {
      const status =
        r.body.kind === "sun"
          ? (scene.sun.occupant?.status ?? null)
          : (scene.contacts.find((c) => c.id === r.body.id)?.status ?? null);
      out[r.key] = orreryRingStyle(status, colors).color;
    }
    return out;
  }, [resources, scene, colors]);
  const warmupColor = useMemo(
    () => tokenToVec4(colors.background),
    [colors.background],
  );

  // --- WP-2.1 System-switch showcase inputs ---------------------------------
  const { transition, progress } = contract.switchRuntime;
  // Pure in (transition, progress): the choreography's phase / spin signal.
  const switchSignal = useDerivedValue(() =>
    sampleSwitchSignal(transition.value, progress.value),
  );
  // key → role / stagger: recomputed only when a switch is (re)published.
  const roles = useDerivedValue(() => switchRoles(transition.value));
  // Per-System sky hue (owner glance C-05): React resolves the destination's
  // hue; the UI thread crossfades from whatever is displayed (see
  // `displayedSkyHue` — robust to transition vs scene arrival order).
  const hueIndex = systemSkyIndex(
    scene.system,
    colors.starPalette.length,
    profile.env.lobeBStar,
  );
  const hueToken = colors.starPalette[hueIndex] ?? colors.accent;
  const hue = useMemo(() => tokenToVec3(hueToken), [hueToken]);
  const skyTarget = useSharedValue({ gen: scene.generation, hue });
  const skyState = useSharedValue<LabSkyHueState>({
    from: hue,
    to: hue,
    gen: scene.generation,
  });
  useEffect(() => {
    skyTarget.value = { gen: scene.generation, hue };
  }, [skyTarget, scene.generation, hue]);
  useAnimatedReaction(
    () => skyTarget.value,
    (target) => {
      const state = skyState.value;
      if (
        target.gen === state.gen &&
        target.hue[0] === state.to[0] &&
        target.hue[1] === state.to[1] &&
        target.hue[2] === state.to[2]
      )
        return;
      skyState.value = {
        from: displayedSkyHue(state, switchSignal.value),
        to: target.hue,
        gen: target.gen,
      };
    },
  );
  const skyHue = useDerivedValue(() =>
    displayedSkyHue(skyState.value, switchSignal.value),
  );
  const sw = useMemo<LabSwitchContext>(
    () => ({ signal: switchSignal, roles, skyHue, transition }),
    [switchSignal, roles, skyHue, transition],
  );
  // Trim-ring candidates (React side): keys not in the destination (leaving)
  // or new since the previous scene (entering). The UI-thread role map still
  // decides what draws, so a stale candidate only costs a hidden circle.
  const sceneKeys = useRef<{
    gen: number;
    keys: Set<string>;
    prev: Set<string>;
  }>({ gen: -1, keys: new Set(), prev: new Set() });
  if (sceneKeys.current.gen !== scene.generation) {
    const keys = new Set(
      scene.world.map((b) =>
        bodyKey({ kind: b.kind, id: b.id, satelliteTarget: b.satelliteTarget }),
      ),
    );
    sceneKeys.current = {
      gen: scene.generation,
      keys,
      prev: sceneKeys.current.gen < 0 ? keys : sceneKeys.current.keys,
    };
  }
  const trimKeys = useMemo(() => {
    const { keys, prev } = sceneKeys.current;
    const out = new Set<string>();
    for (const r of resources) {
      if (r.body.kind !== "contact") continue;
      if (!keys.has(r.key) || !prev.has(r.key)) out.add(r.key);
    }
    return out;
    // sceneKeys is a ref updated above for this generation.
  }, [resources]);
  const keyColors = useMemo(() => {
    const out: Record<string, number[]> = {};
    for (const r of resources) {
      if (r.body.kind !== "contact") continue;
      const status =
        r.scene.contacts.find((c) => c.id === r.body.id)?.status ?? null;
      out[r.key] = tokenToVec3(orreryRingStyle(status, colors).color);
    }
    return out;
  }, [resources, colors]);
  const highlight = useMemo(
    () => tokenToVec3(labColor(colors, profile.bodies.highlight)),
    [colors, profile.bodies.highlight],
  );
  const switchFxProps = {
    frame,
    frameIndex,
    keyColors,
    highlight,
    additive: profile.blend === "additive",
    extent: scene.extent,
    flags: {
      particles: flags.fxParticles,
      comets: flags.fxComets,
      flares: flags.fxFlares,
      shockwave: flags.fxShockwave,
    },
  };
  const shockFilter =
    flags.fx && flags.fxShockFilter ? getLabEffect("shockFilter") : null;
  const shockUniforms = useShockFilterUniforms(
    frame,
    scene.extent,
    PixelRatio.get(),
  );
  // L1–L5 (rings, Polaris, reorder ghost, bodies): built once, optionally
  // wrapped by the WP-2.1 displacement-filter experiment below.
  const worldLayers = (
    <>
      {/* L1 */}
      <Group>
        {flags.rings ? (
          flags.ringsPathRebuild ? (
            <LabRingsPathRebuild
              resources={resources}
              frame={frame}
              frameIndex={frameIndex}
              colors={colors}
            />
          ) : (
            <LabRings
              resources={resources}
              frame={frame}
              frameIndex={frameIndex}
              colors={colors}
              profile={profile.rings}
              flags={flags}
              focusedIds={focusedIds}
              level={contract.level}
              progress={contract.switchRuntime.progress}
              reorder={contract.reorder}
              trimKeys={trimKeys}
            />
          )
        ) : null}
        {/* WP-2.1 on the world plane, under the bodies: shockwave, comets,
              retained motion smears. */}
        {flags.fx ? <LabSwitchUnder {...switchFxProps} /> : null}
      </Group>
      {/* L5 */}
      <Group>
        {flags.polaris ? (
          flags.polarisLab ? (
            <LabPolaris
              frame={frame}
              extent={scene.extent}
              colors={colors}
              profile={profile}
            />
          ) : (
            <Polaris frame={frame} extent={scene.extent} colors={colors} />
          )
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
                look={look}
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
                  look={look}
                />
              );
            })
          : null}
      </Group>
    </>
  );
  return (
    <LabCanvas
      width={viewport.width}
      height={viewport.height}
      gesture={gesture}
      fxFlags={fxFlags}
      warmup={flags.warmup}
      warmupColor={warmupColor}
      sw={sw}
    >
      {/* L0 */}
      {flags.environment ? (
        <LabEnvironment
          width={viewport.width}
          height={viewport.height}
          colors={colors}
          background={labColor(colors, profile.roles.sky)}
          frame={frame}
          profile={profile}
          flags={flags}
        />
      ) : null}
      <Group
        clip={{ x: 0, y: 0, width: viewport.width, height: viewport.height }}
      >
        {/* WP-2.1 EXPERIMENT (fxShockFilter): the world layer (L1–L5, not the
            labels) inside ONE saveLayer with a displacement runtime filter. */}
        {shockFilter ? (
          <Group
            layer={
              <Paint>
                <RuntimeShader source={shockFilter} uniforms={shockUniforms} />
              </Paint>
            }
          >
            {worldLayers}
          </Group>
        ) : (
          worldLayers
        )}
        {/* L6 — labels stay outside any future effect/filter layer. */}
        <Group>
          {flags.labels
            ? labels.map((label) => (
                <Group key={label.id}>
                  {flags.labelHud ? (
                    <LabHudLabel
                      identity={label.id}
                      text={label.text}
                      allocations={allocations}
                      frame={frame}
                      frameIndex={frameIndex}
                      colors={colors}
                      profile={profile.labels}
                      statusColor={labelStatus[label.id] ?? colors.border}
                    />
                  ) : (
                    <OrreryLabel
                      identity={label.id}
                      text={label.text}
                      allocations={allocations}
                      colors={colors}
                    />
                  )}
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
        {/* L7 — switch FX over the bodies (WP-2.1); focus / feedback WP-2.2. */}
        <Group>{flags.fx ? <LabSwitchOver {...switchFxProps} /> : null}</Group>
      </Group>
      {flags.fpsHud ? (
        <LabFpsOverlay
          x={HUD_X}
          y={viewport.height - HUD_H - HUD_BOTTOM_GAP}
          colors={colors}
          profile={profile}
          fontProvider={fontProvider}
        />
      ) : null}
    </LabCanvas>
  );
}
