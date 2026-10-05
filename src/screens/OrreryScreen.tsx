/**
 * ADR-077 owns the single canonical timestamp world, camera and discrete intents.
 * It partially supersedes ADR-048's dual-view/morph clauses; ADR-048's static
 * contact placement and single unmountable ambient-clock lifecycle remain live.
 */
// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is semantic typography.

import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFonts } from "@shopify/react-native-skia";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import {
  cancelAnimation,
  runOnJS,
  runOnUI,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import {
  CLUSTER_OBSTACLE,
  OrreryClusterPanel,
} from "@/components/orrery/OrreryClusterPanel";
import { OrreryContactsSheet } from "@/components/orrery/OrreryContactsSheet";
import {
  ORRERY_CONTROLS_OBSTACLE,
  OrreryControls,
} from "@/components/orrery/OrreryControls";
import {
  OrreryFeedback,
  OrreryNotice,
} from "@/components/orrery/OrreryFeedback";
import { OrreryFocusContext } from "@/components/orrery/OrreryFocusContext";
import { OrreryImmersiveHeader } from "@/components/orrery/OrreryImmersiveHeader";
import { OrrerySystemSelector } from "@/components/orrery/OrrerySystemSelector";
import { OrreryViewOptions } from "@/components/orrery/OrreryViewOptions";
import { OrreryWorld } from "@/components/orrery/OrreryWorld";
import { companionAction } from "@/components/orrery/orrery-companion-logic";
import {
  systemDisplayName,
  systemEmptyCopy,
} from "@/components/orrery/orrery-controls-logic";
import {
  canvasViewport,
  framingViewport,
  sameCameraViewport,
} from "@/components/orrery/orrery-obstacle-logic";
import {
  closeBeforeAction,
  clusterRows,
} from "@/components/orrery/orrery-overlay-logic";
import { satelliteContext } from "@/components/orrery/orrery-satellite-context";
import {
  createOrrerySatellitePublisher,
  type OrrerySatellitePublisher,
} from "@/components/orrery/orrery-satellite-publisher";
import {
  computeMembershipDelta,
  switchIntensity as membershipSwitchIntensity,
  preservedFocus,
  selectSystemFraming,
  shouldPublishSwitchScene,
  startsInSessionSwitch,
} from "@/components/orrery/orrery-switch-animation";
import { orreryWarmCache } from "@/components/orrery/resources/orrery-warm-cache";
import { useOrreryCamera } from "@/components/orrery/use-orrery-camera";
import { useOrrerySwitchRuntime } from "@/components/orrery/use-orrery-switch-runtime";
import { staticOcclusionRects } from "@/components/orrery/v2/occlusion-sources";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { getExecutor, localDateTime } from "@/db/database";
import { readOrreryContactTargetValidation } from "@/db/orrery-action-read";
import { readOrrerySatellites } from "@/db/orrery-satellites-read";
import { commitRingReorder } from "@/db/ring-seq-dao";
import {
  countBuiltinAndCategorySystemMembers,
  countSystemMembers,
  readSystemsCatalog,
  type SystemCatalogEntry,
} from "@/db/systems-catalog-read";
import {
  type CameraPose,
  type CameraRect,
  clampCameraPose,
  deriveHomePose,
  frameBodies,
  HOME_CAMERA,
  type OrreryIntent,
  type OrrerySatelliteTarget,
  usableCameraRect,
  type WorldBody,
} from "@/logic/orrery-camera-logic";
import {
  clusterZoomPose,
  expectedFocusCardRect,
  FOCUS_CARD_ESTIMATED_HEIGHT,
  FOCUS_CARD_REFIT_PX,
  type FocusCardRect,
  focusCardPlacement,
  focusFramingPose,
  HIDDEN_FOCUS_CARD,
} from "@/logic/orrery-focus-card-logic";
import {
  createOrreryFocusController,
  type OrreryCancellation,
  type OrreryContactTarget,
} from "@/logic/orrery-focus-logic";
import { bodyKey, frameBodyById, frameBodyByKey } from "@/logic/orrery-frame";
import { cameraExtent, northTarget } from "@/logic/orrery-recovery-logic";
import type { ReorderIntent } from "@/logic/orrery-reorder-logic";
import {
  deriveSatelliteBodies,
  EMPTY_SATELLITE_SPEC,
  type OrrerySatelliteSpec,
} from "@/logic/orrery-satellite-logic";
import { restoreOrrerySession } from "@/logic/orrery-session-logic";
import {
  ALL_CONTACTS_SYSTEM,
  type OrrerySystemRef,
  parseSystemRef,
  systemRefId,
} from "@/logic/orrery-system-logic";
import { navigationRef } from "@/navigation/linking";
import { navigateIntoTab } from "@/navigation/tab-entry";
import type { RootStackParamList } from "@/navigation/types";
import { useWindowMeasurement } from "@/navigation/use-window-measurement";
import {
  createOrrerySatelliteController,
  loadOrreryScene,
  type OrrerySatelliteState,
} from "@/services/orrery-scene";
import { useOrreryPreferencesStore } from "@/stores/orrery-preferences-store";
import { useOrrerySessionStore } from "@/stores/orrery-session-store";
import { createOrrerySystemStore } from "@/stores/orrery-system-store";
import {
  sameWindowRect,
  useShellObstacleStore,
} from "@/stores/shell-obstacle-store";
import { useShellRefresh } from "@/stores/shell-refresh-store";
import { shellTransientStore } from "@/stores/shell-transient-store";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { useReducedMotionShared } from "@/theme/use-reduced-motion";

/** 38.7-15 (D-56/D-76): the DEBUG timing marks (`src/__dev__/orrery-perf-marks.ts`). */
interface OrreryPerfMarks {
  beginFocus(): void;
  mark(name: string): void;
  beginSwitch(): void;
  markSwitch(name: string): void;
  endSwitch(name: string): void;
}
// DEBUG only: Metro folds this to null in a release bundle.
const perf: OrreryPerfMarks | null =
  typeof __DEV__ !== "undefined" && __DEV__
    ? require("@/__dev__/orrery-perf-marks")
    : null;

/**
 * 38.7-15 (C4-M2): the warm return already drew Home; the reload's Home is
 * reassigned only when it moved beyond this (unchanged data → no camera move).
 */
const WARM_HOME_TOLERANCE = 1e-3;
function sameHomePose(a: CameraPose, b: CameraPose): boolean {
  const keys = [
    "x",
    "y",
    "zoom",
    "tilt",
    "yaw",
    "focalDistance",
    "lensShift",
  ] as const;
  return keys.every(
    (key) =>
      Math.abs((a[key] ?? 0) - (b[key] ?? 0)) <=
      WARM_HOME_TOLERANCE * Math.max(1, Math.abs(b[key] ?? 0)),
  );
}

const acknowledgeReorder = () => {
  void Haptics.selectionAsync().catch(() => {});
};

/** Identifies commits emitted by this screen's otherwise-local System store. */
const LOCAL_SELECT_ORIGIN = Symbol("orrery-local-select");
/** D-52: a stable empty cluster, so a closed cluster never churns OrreryWorld's props. */
const NO_CLUSTER_IDS: readonly number[] = Object.freeze([]);
const MAX_CUSTOM_SYSTEM_COUNTS_PER_OPEN = 12;

/** 38.7-11 (C3-M1): the identity a focus framing was made for. */
function focusFramingKey(target: OrreryContactTarget): string {
  return `${target.kind}:${target.id}:${target.uid}`;
}
/** What the docked card follows: a contact/sun by id, or a moon by key. */
type FocusCardTarget = { id: number } | { key: string } | null;

type SystemCountCache = {
  counts: Map<string, number>;
  needsAttention: Map<string, boolean>;
};

export function systemAttentionFeedback(
  validity: "valid" | "needs-attention" | undefined,
  brokenCount: number,
): { heading: string; detail: string | null } | null {
  if (validity !== "needs-attention" && brokenCount === 0) return null;
  return {
    heading: "This System needs attention",
    detail:
      brokenCount === 0
        ? null
        : brokenCount === 1
          ? "One membership rule could not be applied."
          : `${brokenCount} membership rules could not be applied.`,
  };
}

export function OrreryScreen() {
  const { colors, mode: themeMode, package: themePackage } = useTheme();
  const [contactsOpen, setContactsOpen] = useState(false);
  const [clusterOpen, setClusterOpen] = useState(false);
  const [reorderError, setReorderError] = useState(false);
  const reorderBusy = useRef(false);
  const cancelIntent = useRef<(reason: OrreryCancellation) => void>(() => {});
  const routeLive = useRef(false);
  const captureSession = useRef<
    (reason: "profile" | "background", after?: () => void) => void
  >(() => {});
  const captureGeneration = useRef(0);
  const [sessionReady, setSessionReady] = useState(false);
  // 38.7-15 (D-56, C5-M1): an ordinary tab return (session resume "home",
  // the retained snapshot is the requested System, app active) mounts the
  // canvas on the retained snapshot while the reload runs — LATCHED once per
  // focus (never a live `resume` read), cleared on blur and at sessionReady.
  const [warmReturn, setWarmReturn] = useState(false);
  // C4-M2/C5-L3: set from a UI round trip after the Home pose write.
  const [warmPosePrepared, setWarmPosePrepared] = useState(false);
  const warmTicket = useRef(0);
  const warmPrepTicket = useRef(-1);
  /** The Home the warm canvas drew (the sessionReady Home compares to it). */
  const warmHome = useRef<CameraPose | null>(null);
  const sessionResume = useOrrerySessionStore((store) => store.resume);
  const restoreContactsFocus = useRef<(() => void) | null>(null);
  const overlaysOpen = shellTransientStore((store) =>
    store.entries.some((entry) => entry.id !== "orrery-cluster"),
  );
  const closeContacts = useCallback((restore = true) => {
    setContactsOpen(false);
    shellTransientStore.getState().closeTransient("orrery-contacts");
    if (restore) requestAnimationFrame(() => restoreContactsFocus.current?.());
  }, []);
  const openContacts = useCallback((restore: () => void) => {
    restoreContactsFocus.current = restore;
    setContactsOpen(true);
  }, []);
  useEffect(() => {
    if (!contactsOpen) return;
    shellTransientStore
      .getState()
      .openTransient("orrery-contacts", closeContacts);
    return () =>
      shellTransientStore.getState().closeTransient("orrery-contacts");
  }, [contactsOpen, closeContacts]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const fontProvider = useFonts({
    Inter: [
      require("../../assets/Inter-Regular.ttf"),
      require("../../assets/Inter-SemiBold.ttf"),
    ],
    "Space Grotesk": [require("../../assets/SpaceGrotesk-SemiBold.ttf")],
  });
  const [canvasRect, setCanvasRect] = useState<CameraRect | null>(null);
  // 38.7-12 (D-39): the floating title bar's natural height; the HUD triggers
  // sit below it while the canvas runs under it.
  const [headerHeight, setHeaderHeight] = useState(0);
  const obstacles = useShellObstacleStore((store) => store.rects);
  const measureCanvas = useCallback((rect: CameraRect | null) => {
    setCanvasRect((previous) =>
      sameWindowRect(previous, rect) ? previous : rect,
    );
  }, []);
  const canvasMeasurement = useWindowMeasurement(
    measureCanvas,
    true,
    obstacles["shell-tabs"],
  );
  // 38.7-16 (D-79, owner-directed): the map's framing viewport — projection
  // centre, Home, Recenter, focus/cluster framing, the camera and the frame —
  // is built from PERSISTENT chrome only (`framingViewport`): the System and
  // View panels, the cluster panel and every feedback notice no longer move
  // the map. Its identity changes only when its content does, so an obstacle
  // that is not a framing input commits nothing to the renderer.
  const nextViewport = framingViewport(canvasRect, obstacles);
  const stableViewport = useRef(nextViewport);
  if (!sameCameraViewport(stableViewport.current, nextViewport))
    stableViewport.current = nextViewport;
  const viewport = stableViewport.current;
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  // The controls column still steps aside for open panels and notices; the
  // framing reserves its RESTING place instead (`framingViewport`).
  const controlsViewport = useMemo(
    () =>
      canvasViewport(
        canvasRect,
        Object.entries(obstacles)
          .filter(
            ([key]) =>
              key !== ORRERY_CONTROLS_OBSTACLE &&
              key !== CLUSTER_OBSTACLE &&
              key !== "orrery-focus-context",
          )
          .map(([, rect]) => rect),
      ),
    [canvasRect, obstacles],
  );
  // 38.7-11 (D-55): the static Orrery text panels' rects in canvas
  // coordinates (the focus card's rect is UI-derived, `focusCardRect`).
  const staticOcclusion = useMemo(
    () =>
      canvasViewport(canvasRect, staticOcclusionRects(obstacles)).obstacles ??
      [],
    [canvasRect, obstacles],
  );
  const panelViewport = useMemo(
    () =>
      canvasViewport(
        canvasRect,
        Object.entries(obstacles)
          .filter(
            ([key]) =>
              key !== CLUSTER_OBSTACLE && key !== "orrery-focus-context",
          )
          .map(([, rect]) => rect),
      ),
    [canvasRect, obstacles],
  );
  const preferences = useOrreryPreferencesStore((store) => store.committed);
  const committedOrigin = useOrreryPreferencesStore(
    (store) => store.committedOrigin,
  );
  const hydratePreferences = useOrreryPreferencesStore(
    (store) => store.hydrate,
  );
  const hydrated = useOrreryPreferencesStore((store) => store.hydrated);
  // 38.7-15: only the failure matters here; a boolean selector keeps every
  // focus's re-hydrate (idle → loading → ready) from re-rendering the screen
  // while a warm canvas mounts.
  const hydrationFailed = useOrreryPreferencesStore(
    (store) => store.hydration === "error",
  );
  const [focusTargets, setFocusTargets] = useState<OrreryContactTarget[]>([]);
  const [focusedSatellite, setFocusedSatellite] =
    useState<OrrerySatelliteTarget | null>(null);
  const satelliteAction = useRef(0);
  const focusedIds = useMemo(
    () => focusTargets.map((target) => target.id),
    [focusTargets],
  );
  const clusterIds = useMemo(
    () => (clusterOpen ? focusedIds : NO_CLUSTER_IDS),
    [clusterOpen, focusedIds],
  );
  const [focusError, setFocusError] = useState<
    "removed" | "missing-category" | "error" | null
  >(null);
  const pose = useSharedValue<CameraPose>({ ...HOME_CAMERA });
  const reducedMotion = useReducedMotionShared();
  const useSystemStore = useMemo(
    () =>
      createOrrerySystemStore({
        load: (system, generation) =>
          loadOrreryScene(getExecutor(), generation, system),
        persist: async (system, userInitiated = false) => {
          const store = useOrreryPreferencesStore.getState();
          const id = systemRefId(system);
          if (store.saveError && store.pendingIntent?.lastSystem === id)
            await store.retry(getExecutor());
          else
            await store.save(
              getExecutor(),
              { lastSystem: id },
              LOCAL_SELECT_ORIGIN,
              userInitiated,
            );
          const latest = useOrreryPreferencesStore.getState();
          return (
            latest.hydrated &&
            !latest.saveError &&
            latest.committed.lastSystem === systemRefId(system)
          );
        },
        // 38.7-04 (D-52): a cold restore selects a custom System with no
        // name; read it through the existing Systems catalog (no new SQL).
        resolveName: async (system) =>
          (await readSystemsCatalog(getExecutor())).find(
            (entry) => entry.id === systemRefId(system),
          )?.name,
      }),
    [],
  );
  const state = useSystemStore();
  const [systemCatalog, setSystemCatalog] = useState<SystemCatalogEntry[]>([]);
  const [systemCounts, setSystemCounts] = useState<Map<string, number>>(
    new Map(),
  );
  const [systemNeedsAttention, setSystemNeedsAttention] = useState<
    Map<string, boolean>
  >(new Map());
  const [systemSelectorRequest, setSystemSelectorRequest] = useState<
    number | null
  >(null);
  const systemCountCache = useRef(new Map<number, SystemCountCache>());
  const focusTargetsRef = useRef(focusTargets);
  focusTargetsRef.current = focusTargets;
  // 38.7-11 (C3-M1): the single-focus framing that is still the camera's last
  // word (its target and the card height it reserved). Cleared when anything
  // else takes the camera — a System switch publish, Recenter, a session
  // restore, a Home reframe, a focus change. The UI side also checks the
  // camera epoch (`framedEpoch`), which every touch, recovery and stop bumps.
  const focusFraming = useRef<{ key: string; height: number } | null>(null);
  const lastCardHeight = useRef(FOCUS_CARD_ESTIMATED_HEIGHT);
  const framedEpoch = useSharedValue(-1);
  // D-19: the docked card's measured height and what it follows (UI thread).
  const cardHeight = useSharedValue(FOCUS_CARD_ESTIMATED_HEIGHT);
  const cardTarget = useSharedValue<FocusCardTarget>(null);
  const occlusionRects = useSharedValue<readonly CameraRect[]>([]);
  useEffect(() => {
    occlusionRects.value = staticOcclusion;
  }, [occlusionRects, staticOcclusion]);
  const hasReadySystem = useRef(false);
  const switchSourceIds = useRef<number[] | null>(null);
  const switchHomeGeneration = useRef<number | null>(null);
  const [satelliteState, setSatelliteState] = useState<OrrerySatelliteState>({
    status: "ready",
    sceneGeneration: null,
    rows: [],
  });
  // 38.7-10 (C-M3): satellite rows reach OrreryWorld only through this
  // SharedValue, written by the publisher; the React copy (focus card,
  // companion sheet) is held while a System switch is in flight and flushed
  // once it settles, so a satellite load commits no render mid-switch.
  const satelliteSpec =
    useSharedValue<OrrerySatelliteSpec>(EMPTY_SATELLITE_SPEC);
  const satellitePublisherRef = useRef<OrrerySatellitePublisher | null>(null);
  if (!satellitePublisherRef.current)
    satellitePublisherRef.current = createOrrerySatellitePublisher({
      spec: satelliteSpec,
      setState: setSatelliteState,
    });
  const satellitePublisher = satellitePublisherRef.current;
  // 38.7-12 (D-19): the generation whose switch last settled. The Home effect
  // re-runs on it, so a cluster tapped while a switch was still running zooms
  // once the switch has landed (one render at settle, never per frame).
  const [settledSwitch, setSettledSwitch] = useState(-1);
  // 38.7-13 (C4-M1, D-53) held the renderer's viewport through a switch and
  // adopted the live one at settle — which snapped the projection centre when
  // a panel or notice had changed it (38.7-16). Since 38.7-16 (D-79) no panel
  // or notice is a framing input, so an obstacle measured mid-switch (a save
  // error, a missing-category or broken-System notice, a retry clearing one,
  // the System panel closing on the row tap) commits nothing to the renderer
  // and there is nothing to adopt: the hold is gone and the projection centre
  // never changes at settle. The panels still mount, measure and publish at
  // once; the D-55 occlusion rects keep following live measurements (C5-L4).
  const worldViewport = viewport;
  // Called by the runtime inside its settle callback (a driven switch: the
  // prune's JS call; a settled publication: inside `publish`), so the
  // satellite flush and the settled generation batch into that one commit.
  // 38.7-15 (DEBUG): the generation of the real switch whose settle closes
  // the `switch:` clock. A settled publication that is no switch (a warm
  // return's reload, a refresh) also calls back here and must not log.
  const switchMarkGeneration = useRef<number | null>(null);
  const onSwitchSettled = useCallback(
    (generation: number) => {
      if (switchMarkGeneration.current === generation) {
        switchMarkGeneration.current = null;
        perf?.endSwitch("settled");
      }
      satellitePublisher.switchSettled(generation);
      setSettledSwitch(generation);
    },
    [satellitePublisher],
  );
  const switchRuntime = useOrrerySwitchRuntime(
    pose,
    reducedMotion,
    onSwitchSettled,
  );
  const publishSwitch = switchRuntime.publish;
  const beginSwitchLead = switchRuntime.beginLead;
  const endSwitchLead = switchRuntime.endLead;
  const pauseSwitch = switchRuntime.pause;
  const resumeSwitch = switchRuntime.resume;
  const switchProgress = switchRuntime.progress;
  // 38.7-15 (D-76, owner-required): motion starts on the tap. The switch's
  // opening (spin, warp, streaks, Lab C breath) runs on the retained scene
  // while the destination loads; `publishSwitch` takes over from what is
  // drawn. Its UI job must be the FIRST thing the tap schedules: a UI job
  // leaves JS in a microtask, and the store's loading notification first
  // queues React's render of the whole screen (and its effects) ahead of it.
  const startSwitchLead = useCallback(() => {
    perf?.beginSwitch();
    beginSwitchLead();
    perf?.markSwitch("lead-in");
  }, [beginSwitchLead]);
  /** The System whose lead the tap path already started (the store's loading notification then does not). */
  const tapLead = useRef<string | null>(null);
  const selectSystem = useCallback(
    (system: OrrerySystemRef, name?: string) => {
      const current = useSystemStore.getState();
      const id = systemRefId(system);
      if (startsInSessionSwitch(current, id, hasReadySystem.current)) {
        tapLead.current = id;
        startSwitchLead();
      }
      return current.select(system, name, true);
    },
    [useSystemStore, startSwitchLead],
  );
  useEffect(() => {
    const unsubscribe = useSystemStore.subscribe((next, previous) => {
      if (!shouldPublishSwitchScene(next, previous)) return;
      if (
        next.status === "loading" &&
        previous.status === "ready" &&
        previous.snapshot
      ) {
        const isInSessionSwitch = startsInSessionSwitch(
          previous,
          next.requested.id,
          hasReadySystem.current,
        );
        // 38.7-15 (D-76): a tap through `selectSystem` already started the
        // lead; any other request (e.g. a refresh) starts it here.
        const leadStarted = tapLead.current === next.requested.id;
        tapLead.current = null;
        if (isInSessionSwitch && !leadStarted) startSwitchLead();
        switchSourceIds.current = isInSessionSwitch
          ? previous.snapshot.systemSnapshot.members.map((member) => member.id)
          : null;
        return;
      }
      // 38.7-15: a load that failed ends the lead-in (it coasts back).
      if (
        previous.status === "loading" &&
        (next.status === "error" || next.status === "stale")
      ) {
        endSwitchLead();
        perf?.endSwitch("load-failed");
        return;
      }
      if (next.status !== "ready" || !next.snapshot) return;
      hasReadySystem.current = true;
      const sourceIds = switchSourceIds.current;
      switchSourceIds.current = null;
      const destinationIds = next.snapshot.systemSnapshot.members.map(
        (member) => member.id,
      );
      const destinationHome =
        deriveHomePose(next.snapshot.world, viewport) ?? pose.value;
      // Before the satellite reload this same notification triggers.
      if (sourceIds) satellitePublisher.switchStarted(next.generation);
      // C4-M3: a switch lands at destination Home, even with a retained focus;
      // no later card re-measure may re-frame it.
      if (sourceIds) focusFraming.current = null;
      if (sourceIds) {
        perf?.markSwitch("load-done");
        switchMarkGeneration.current = next.generation;
      }
      publishSwitch(
        next.snapshot,
        !!sourceIds,
        sourceIds
          ? membershipSwitchIntensity(
              computeMembershipDelta(sourceIds, destinationIds),
            )
          : 0,
        sourceIds ? destinationHome : pose.value,
      );
      if (!sourceIds) return;
      const retainedFocus =
        focusTargetsRef.current.length === 1
          ? preservedFocus(
              focusTargetsRef.current[0].id,
              sourceIds,
              destinationIds,
            )
          : null;
      setFocusTargets((targets) =>
        targets.length === 1 && retainedFocus === targets[0].id ? targets : [],
      );
      switchHomeGeneration.current = next.generation;
    });
    return unsubscribe;
  }, [
    useSystemStore,
    publishSwitch,
    startSwitchLead,
    endSwitchLead,
    viewport,
    pose,
    satellitePublisher,
  ]);
  const satelliteController = useMemo(
    () =>
      createOrrerySatelliteController((scene) => {
        satellitePublisher.noteScene(
          scene.generation,
          scene.systemSnapshot.members,
        );
        return readOrrerySatellites(
          getExecutor(),
          scene.systemSnapshot.members,
          scene.system,
        );
      }, satellitePublisher.publish),
    [satellitePublisher],
  );
  const reloadSatellites = useCallback(() => {
    return satelliteController.reload(
      useSystemStore.getState().current(),
      useOrreryPreferencesStore.getState().committed.satellitesEnabled === 1,
    );
  }, [satelliteController, useSystemStore]);
  useEffect(() => {
    const unsubscribe = useSystemStore.subscribe((next, previous) => {
      if (
        next.generation !== previous.generation ||
        next.snapshot !== previous.snapshot ||
        next.status !== previous.status
      ) {
        // 38.7-15 (D-76): an in-session switch's loading keeps the outgoing
        // System's moons drawn (the lead spins them with their parents) and
        // only cancels its reads. Publishing the empty spec here removed
        // them at the tap AND rewrote every body spec of the outgoing System
        // in the same UI job as the lead's start (All Contacts, moons on:
        // ~880 bodies deserialised and re-recorded before the lead's first
        // frame). The destination's satellites load when it lands.
        if (
          next.status === "loading" &&
          startsInSessionSwitch(
            previous,
            next.requested.id,
            hasReadySystem.current,
          )
        )
          satelliteController.cancel();
        else reloadSatellites();
      }
    });
    reloadSatellites();
    return () => {
      unsubscribe();
      void satelliteController.reload(null, false);
    };
  }, [useSystemStore, satelliteController, reloadSatellites]);
  useEffect(() => {
    void satelliteController.reload(
      useSystemStore.getState().current(),
      preferences.satellitesEnabled === 1,
    );
  }, [preferences.satellitesEnabled, satelliteController, useSystemStore]);
  const focusSystem = useRef(state.requested.id);
  useEffect(() => {
    if (focusSystem.current !== state.requested.id) {
      focusSystem.current = state.requested.id;
      setClusterOpen(false);
    }
  }, [state.requested.id]);
  const initialized = useRef(false);
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(
    AppState.currentState === "active",
  );
  useEffect(() => {
    if (!isFocused || !appActive) closeContacts(false);
  }, [isFocused, appActive, closeContacts]);
  // 38.7-15 (D-58): the warm cache tracks AppState itself (background and a
  // memory warning release it; nothing is retained while not active). IN-03:
  // the listener below does not release it again (that double-counted
  // `releases.background`).
  useEffect(() => orreryWarmCache.attach(AppState), []);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (value) => {
      if (value !== "active") {
        pauseSwitch();
        if (routeLive.current) captureSession.current("background");
        cancelIntent.current("background");
      } else captureGeneration.current++;
      setAppActive(value === "active");
    });
    return () => subscription.remove();
  }, [pauseSwitch]);
  useFocusEffect(
    useCallback(() => {
      routeLive.current = true;
      setSessionReady(false);
      perf?.beginFocus();
      // C5-M1: latch the warm-return eligibility at the start of this focus.
      warmTicket.current++;
      const retained = useSystemStore.getState();
      setWarmReturn(
        appActive &&
          useOrrerySessionStore.getState().resume === "home" &&
          !!retained.snapshot &&
          systemRefId(retained.snapshot.system) === retained.requested.id,
      );
      let cancelled = false;
      if (appActive)
        void (async () => {
          await hydratePreferences(getExecutor());
          if (cancelled) return;
          perf?.mark("hydrated");
          if (initialized.current) await useSystemStore.getState().reload();
          if (!cancelled) {
            perf?.mark("reloaded");
            setSessionReady(true);
          }
        })();
      return () => {
        pauseSwitch();
        routeLive.current = false;
        setSessionReady(false);
        warmTicket.current++;
        warmHome.current = null;
        setWarmReturn(false);
        setWarmPosePrepared(false);
        cancelIntent.current("blur");
        cancelled = true;
        useSystemStore.getState().cancel();
        cancelAnimation(pose);
      };
    }, [useSystemStore, hydratePreferences, appActive, pose, pauseSwitch]),
  );
  useEffect(() => {
    if (!sessionReady) return;
    perf?.mark("session-ready");
    setWarmReturn(false);
  }, [sessionReady]);
  const reconciledCommittedOrigin = useRef<unknown>(undefined);
  useEffect(() => {
    if (!hydrated || !isFocused || !appActive) return;
    const system =
      parseSystemRef(preferences.lastSystem) ?? ALL_CONTACTS_SYSTEM;
    const id = systemRefId(system);
    const firstReconcile = !initialized.current;
    const originChanged = reconciledCommittedOrigin.current !== committedOrigin;
    reconciledCommittedOrigin.current = committedOrigin;
    if (
      !firstReconcile &&
      (!originChanged || committedOrigin === LOCAL_SELECT_ORIGIN)
    )
      return;
    initialized.current = true;
    const active = useSystemStore.getState();
    if (active.requested.id !== id || !active.snapshot)
      void active.select(system, undefined, false);
  }, [
    hydrated,
    isFocused,
    appActive,
    preferences.lastSystem,
    committedOrigin,
    useSystemStore,
  ]);
  const reload = useCallback(() => {
    if (isFocused && appActive && initialized.current)
      void useSystemStore.getState().reload();
  }, [useSystemStore, isFocused, appActive]);
  useShellRefresh(reload);
  const retryReload = useCallback(async () => {
    if (routeLive.current && AppState.currentState === "active")
      await useSystemStore.getState().retryReload();
  }, [useSystemStore]);
  const presentation = `${preferences.density}:${preferences.satellitesEnabled}`;
  const lastPresentation = useRef(presentation);
  useEffect(() => {
    if (lastPresentation.current !== presentation) {
      lastPresentation.current = presentation;
      reload();
    }
  }, [presentation, reload]);

  const scene = state.snapshot;
  const catalogRevision = scene?.dataRevision ?? null;
  useEffect(() => {
    if (!isFocused || !appActive) return;
    // Re-read after a data-revision change even when the focused System stays put.
    void catalogRevision;
    let cancelled = false;
    void readSystemsCatalog(getExecutor())
      .then((catalog) => {
        if (!cancelled) setSystemCatalog(catalog);
      })
      .catch(() => {
        if (!cancelled) setSystemCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isFocused, appActive, catalogRevision]);
  useEffect(() => {
    const cached =
      catalogRevision === null
        ? undefined
        : systemCountCache.current.get(catalogRevision);
    setSystemCounts(cached ? new Map(cached.counts) : new Map());
    setSystemNeedsAttention(
      cached ? new Map(cached.needsAttention) : new Map(),
    );
  }, [catalogRevision]);
  useEffect(() => {
    if (
      systemSelectorRequest === null ||
      catalogRevision === null ||
      systemCatalog.length === 0
    )
      return;
    const cached = systemCountCache.current.get(catalogRevision);
    if (cached) {
      setSystemCounts(new Map(cached.counts));
      setSystemNeedsAttention(new Map(cached.needsAttention));
      return;
    }
    let cancelled = false;
    const visible = systemCatalog.filter((entry) => !entry.hidden);
    const fixed = visible
      .map((entry) => entry.ref)
      .filter((ref) => ref.kind !== "custom");
    const custom = visible.filter((entry) => entry.ref.kind === "custom");
    const counts = new Map<string, number>();
    const needsAttention = new Map<string, boolean>();
    const publish = () => {
      if (!cancelled) {
        setSystemCounts(new Map(counts));
        setSystemNeedsAttention(new Map(needsAttention));
      }
    };
    void (async () => {
      const fixedCounts = await countBuiltinAndCategorySystemMembers(
        getExecutor(),
        fixed,
      );
      if (cancelled) return;
      for (const [id, count] of fixedCounts) counts.set(id, count);
      publish();
      for (const entry of custom.slice(0, MAX_CUSTOM_SYSTEM_COUNTS_PER_OPEN)) {
        const result = await countSystemMembers(getExecutor(), entry.ref);
        if (cancelled) return;
        counts.set(entry.id, result.count);
        needsAttention.set(
          entry.id,
          result.validity === "needs-attention" ||
            result.brokenRules.length > 0,
        );
        publish();
      }
      if (!cancelled)
        systemCountCache.current.set(catalogRevision, {
          counts: new Map(counts),
          needsAttention: new Map(needsAttention),
        });
    })().catch(() => {
      // A stale count must not displace a usable selector or System scene.
    });
    return () => {
      cancelled = true;
    };
  }, [systemSelectorRequest, catalogRevision, systemCatalog]);
  const onSystemSelectorOpenChange = useCallback(
    (open: boolean, requestId: number) => {
      setSystemSelectorRequest(open ? requestId : null);
    },
    [],
  );
  const satellites =
    preferences.satellitesEnabled &&
    isFocused &&
    appActive &&
    state.status === "ready" &&
    satelliteState.sceneGeneration === scene?.generation
      ? satelliteState
      : undefined;
  const satelliteRow =
    satellites?.status === "ready" && focusedSatellite
      ? satellites.rows.find(
          (row) =>
            row.uid === focusedSatellite.uid &&
            row.parentId === focusedSatellite.parentId &&
            row.parentUid === focusedSatellite.parentUid,
        )
      : undefined;
  useEffect(() => {
    if (
      !preferences.satellitesEnabled ||
      (satellites?.status === "ready" && !satelliteRow)
    )
      setFocusedSatellite(null);
  }, [preferences.satellitesEnabled, satellites, satelliteRow]);
  const measured = usableCameraRect(viewport) !== null;
  const visible = measured && isFocused && appActive;
  useEffect(() => {
    if (visible && sessionReady && scene) resumeSwitch();
  }, [visible, sessionReady, scene, resumeSwitch]);
  const camera = useOrreryCamera({
    pose,
    extent: cameraExtent(scene?.extent ?? 32),
    // 38.7-13 (C4-M1): the projection/framing viewport, held mid-switch.
    viewport: worldViewport,
    enabled: visible && !overlaysOpen,
    reduced: reducedMotion,
  });
  // 38.7-15 (C4-M2 / C5-M2 / C5-L3): the warm return's pose, BEFORE the warm
  // canvas mounts: (1) settle any paused switch through the runtime's own
  // settle; (2) Home from the retained scene under the framing viewport
  // (38.7-16, D-79: the one the renderer draws with; nothing is held) — and
  // focus, satellite, cluster and focus error cleared as the Home branch
  // does; (3) resume stays "home" (no `resumed()` here, so the sessionReady
  // Home re-derives from the reloaded scene); (4) the Home write happens in a
  // UI job queued right behind the settle's (FIFO: it lands after `finish`
  // wrote the switch's own destination), and its round trip releases the
  // mount. One JS hop, not two: neither the retained snapshot (already the
  // switch's destination) nor the live viewport changes across the settle,
  // so nothing here needs to wait for its completion. Once per focus.
  const settleSwitch = switchRuntime.settle;
  const stopCamera = camera.stop;
  const warmPrepared = useCallback((ticket: number) => {
    if (ticket !== warmTicket.current) return;
    perf?.mark("warm-pose");
    setWarmPosePrepared(true);
  }, []);
  useEffect(() => {
    if (!warmReturn || sessionReady || warmPosePrepared || !visible || !scene)
      return;
    const ticket = warmTicket.current;
    if (warmPrepTicket.current === ticket) return;
    warmPrepTicket.current = ticket;
    const retained = useSystemStore.getState().snapshot;
    const home = retained
      ? deriveHomePose(retained.world, viewportRef.current)
      : null;
    settleSwitch();
    // No Home (no usable measurement): the sessionReady mount, as today.
    if (!home) return;
    focusFraming.current = null;
    setFocusTargets((targets) => (targets.length === 0 ? targets : []));
    setFocusedSatellite(null);
    setClusterOpen(false);
    setFocusError(null);
    warmHome.current = home;
    runOnUI(() => {
      "worklet";
      stopCamera();
      pose.value = home;
      runOnJS(warmPrepared)(ticket);
    })();
  }, [
    warmReturn,
    sessionReady,
    warmPosePrepared,
    visible,
    scene,
    settleSwitch,
    stopCamera,
    pose,
    warmPrepared,
    useSystemStore,
  ]);
  // 38.7-11 (D-19/D-47): a single focus framed above the docked card, its
  // moons (full split, from the satellite publisher's index for this scene)
  // inside the frame. The card's space is its expected docked rect over the
  // card-free viewport for `height` (C-M2: never the measured card rect).
  const frameSingleFocus = useCallback(
    (
      body: WorldBody,
      scene: { generation: number; extent: number },
      height: number,
    ): CameraPose | null => {
      const spec = satellitePublisher.source.current();
      const moons =
        spec.sceneGeneration === scene.generation
          ? deriveSatelliteBodies(
              [{ ...body, opacity: 1, interactive: true }],
              spec.index,
              true,
              1,
            ).moons
          : [];
      return focusFramingPose(
        body,
        moons,
        worldViewport,
        expectedFocusCardRect(worldViewport, height),
        pose.value,
        scene.extent,
      );
    },
    [satellitePublisher, worldViewport, pose],
  );
  // D-19: the docked card's rect, on the UI thread from the shared frame. The
  // card positions itself from it, and the canvas reads the SAME value for the
  // focus-card occlusion dim and the label exclusion (H5), so all three move
  // together through pan, pinch and focus animation.
  const cameraFrame = camera.frame;
  const focusCardRect = useDerivedValue<FocusCardRect>(() => {
    const current = cameraFrame.value;
    const target = cardTarget.value;
    if (!current || !target) return HIDDEN_FOCUS_CARD;
    const body =
      "key" in target
        ? frameBodyByKey(current, target.key)
        : frameBodyById(current, target.id);
    return focusCardPlacement(current.viewport, body, cardHeight.value);
  });
  // Stop and sample on the UI thread once per departure, never once per frame.
  captureSession.current = (reason, after) => {
    const ticket = ++captureGeneration.current;
    const generation = useOrrerySessionStore.getState().generation;
    const systemId = useSystemStore.getState().requested.id;
    const sceneGeneration = useSystemStore.getState().generation;
    const target =
      !clusterOpen && focusTargets.length === 1 ? focusTargets[0] : null;
    const publish = (settled: CameraPose) => {
      if (
        ticket !== captureGeneration.current ||
        generation !== useOrrerySessionStore.getState().generation ||
        (reason === "profile" &&
          sceneGeneration !== useSystemStore.getState().generation)
      )
        return;
      useOrrerySessionStore
        .getState()
        .capture(
          reason,
          { pose: settled, focus: target, systemId },
          generation,
        );
      after?.();
    };
    const stop = camera.stop;
    runOnUI(() => {
      "worklet";
      stop();
      runOnJS(publish)({ ...pose.value });
    })();
  };
  useEffect(
    () => () => {
      captureGeneration.current++;
    },
    [],
  );
  const onReorder = useCallback(
    async (intent: ReorderIntent) => {
      const current = useSystemStore.getState().current();
      if (
        reorderBusy.current ||
        !routeLive.current ||
        AppState.currentState !== "active" ||
        current?.generation !== intent.generation
      )
        return;
      reorderBusy.current = true;
      try {
        await commitRingReorder(
          getExecutor(),
          intent.request,
          localDateTime(),
          () =>
            routeLive.current &&
            AppState.currentState === "active" &&
            useSystemStore.getState().current()?.generation ===
              intent.generation,
        );
        setReorderError(false);
        await useSystemStore.getState().reload();
      } catch {
        setReorderError(true);
      } finally {
        reorderBusy.current = false;
      }
    },
    [useSystemStore],
  );
  const reloadReorder = useCallback(async () => {
    await useSystemStore.getState().retryReload();
    if (useSystemStore.getState().status === "ready") setReorderError(false);
  }, [useSystemStore]);
  const focus = useCallback(
    (targets: OrreryContactTarget[], waitForPanel = false) => {
      const ids = targets.map((target) => target.id);
      const scene = useSystemStore.getState().current();
      if (!scene) return;
      const bodies = scene.world.filter((body) => ids.includes(body.id));
      if (bodies.length === 0) return;
      setFocusTargets(targets);
      setFocusError(null);
      focusFraming.current = null;
      if (waitForPanel) {
        // The group's measured obstacle owns its framing, including later reflows.
        runOnUI(camera.stop)();
        return;
      }
      if (targets.length === 1 && bodies.length === 1) {
        // D-19/D-47: centred and large above the docked card, zoomed past
        // the identity tier when that frames the person best. The card's
        // space comes from its expected docked rect over the card-free
        // viewport, never its measured rect (C-M2).
        const target = frameSingleFocus(
          bodies[0],
          scene,
          lastCardHeight.current,
        );
        if (!target) return;
        focusFraming.current = {
          key: focusFramingKey(targets[0]),
          height: lastCardHeight.current,
        };
        const { recover, epoch } = camera;
        runOnUI(() => {
          "worklet";
          recover(target);
          framedEpoch.value = epoch.value;
        })();
        return;
      }
      const framing = frameBodies(
        bodies,
        worldViewport,
        scene.extent,
        pose.value,
      );
      if (!framing) return;
      runOnUI(camera.recover)(framing.pose);
    },
    [
      useSystemStore,
      pose,
      camera,
      worldViewport,
      frameSingleFocus,
      framedEpoch,
    ],
  );
  // C3-M1: the card's real height arrives after the framing (first layout,
  // then moons/context loading or a font reflow). While the framing is still
  // authoritative, a height change beyond FOCUS_CARD_REFIT_PX re-frames once
  // so the person and moons stay above the real card — never mid-switch and
  // never after anything else took the camera (UI-side epoch check).
  const onCardHeight = useCallback(
    (height: number) => {
      lastCardHeight.current = height;
      const authority = focusFraming.current;
      if (
        !authority ||
        Math.abs(height - authority.height) <= FOCUS_CARD_REFIT_PX
      )
        return;
      const targets = focusTargetsRef.current;
      const scene = useSystemStore.getState().current();
      if (
        !scene ||
        targets.length !== 1 ||
        focusFramingKey(targets[0]) !== authority.key
      ) {
        focusFraming.current = null;
        return;
      }
      authority.height = height;
      const body = scene.world.find((item) => item.id === targets[0].id);
      if (!body) return;
      const target = frameSingleFocus(body, scene, height);
      if (!target) return;
      const { recover, epoch } = camera;
      const progress = switchProgress;
      runOnUI(() => {
        "worklet";
        if (framedEpoch.value !== epoch.value || progress.value < 1) return;
        recover(target);
        framedEpoch.value = epoch.value;
      })();
    },
    [useSystemStore, camera, frameSingleFocus, framedEpoch, switchProgress],
  );
  const actionEnvironment = useRef({ focus, active: isFocused && appActive });
  actionEnvironment.current = { focus, active: isFocused && appActive };
  const actions = useMemo(
    () =>
      createOrreryFocusController({
        current: () =>
          actionEnvironment.current.active &&
          routeLive.current &&
          AppState.currentState === "active"
            ? useSystemStore.getState().current()
            : null,
        validate: (system, target) =>
          readOrreryContactTargetValidation(getExecutor(), system, target),
        focus: (targets) => {
          setClusterOpen(false);
          actionEnvironment.current.focus(targets);
        },
        group: (targets) => {
          setClusterOpen(true);
          actionEnvironment.current.focus(targets, true);
        },
        clear: () => {
          setFocusTargets([]);
          setClusterOpen(false);
          setFocusError(null);
        },
        openProfile: (contactId) => {
          const stack = navigation.getState();
          useOrrerySessionStore
            .getState()
            .routeChanged(stack.routes.slice(0, stack.index + 1));
          setClusterOpen(false);
          shellTransientStore.getState().closeTransient("orrery-cluster");
          captureSession.current("profile", () => {
            if (routeLive.current && AppState.currentState === "active")
              navigation.navigate("Profile", { contactId });
          });
        },
        reject: (reason) => {
          setFocusError(reason);
          if (reason !== "error") setFocusTargets([]);
        },
      }),
    [useSystemStore, navigation],
  );
  const onIntent = useCallback(
    async (intent: OrreryIntent) => {
      captureGeneration.current++;
      const ticket = ++satelliteAction.current;
      setFocusedSatellite(null);
      if (intent.kind !== "satellite") {
        await actions.dispatch(intent);
        return;
      }
      actions.cancel("superseded");
      const target = intent.satelliteTarget;
      const current = useSystemStore.getState().current();
      if (
        !target ||
        current?.generation !== intent.generation ||
        !routeLive.current ||
        AppState.currentState !== "active" ||
        !useOrreryPreferencesStore.getState().committed.satellitesEnabled
      )
        return;
      try {
        const rows = await readOrrerySatellites(
          getExecutor(),
          current.systemSnapshot.members,
          current.system,
        );
        if (
          ticket !== satelliteAction.current ||
          useSystemStore.getState().current()?.generation !==
            intent.generation ||
          !routeLive.current ||
          AppState.currentState !== "active" ||
          !useOrreryPreferencesStore.getState().committed.satellitesEnabled
        )
          return;
        if (
          !rows.some(
            (row) =>
              row.uid === target.uid &&
              row.parentId === target.parentId &&
              row.parentUid === target.parentUid,
          )
        ) {
          reloadSatellites();
          return;
        }
        setFocusTargets([]);
        setClusterOpen(false);
        setFocusError(null);
        setFocusedSatellite(target);
      } catch {
        reloadSatellites();
      }
    },
    [actions, useSystemStore, reloadSatellites],
  );
  cancelIntent.current = (reason) => {
    satelliteAction.current++;
    actions.cancel(reason);
  };
  const clearFocus = useCallback(() => {
    focusFraming.current = null;
    satelliteAction.current++;
    setFocusedSatellite(null);
    actions.cancel("clear");
    setFocusTargets([]);
    setClusterOpen(false);
    setFocusError(null);
  }, [actions]);
  const dismissCluster = useCallback(() => {
    actions.cancel("outside");
    setClusterOpen(false);
    setFocusTargets([]);
    shellTransientStore.getState().closeTransient("orrery-cluster");
  }, [actions]);
  useEffect(() => {
    if (!clusterOpen) return;
    shellTransientStore
      .getState()
      .openTransient("orrery-cluster", dismissCluster);
    return () =>
      shellTransientStore.getState().closeTransient("orrery-cluster");
  }, [clusterOpen, dismissCluster]);
  useEffect(() => {
    if (!isFocused) {
      actions.cancel("blur");
      setClusterOpen(false);
    }
    if (!appActive) {
      actions.cancel("background");
      setClusterOpen(false);
    }
  }, [actions, isFocused, appActive]);
  useEffect(() => () => actions.cancel("dispose"), [actions]);
  useEffect(() => {
    const unsubscribe = useSystemStore.subscribe((next, previous) => {
      if (next.generation !== previous.generation) {
        satelliteAction.current++;
        actions.cancel("system");
      }
    });
    return unsubscribe;
  }, [actions, useSystemStore]);
  useEffect(() => {
    if (!scene || state.status !== "ready") return;
    setFocusTargets((targets) => {
      const valid = clusterRows(
        targets,
        scene.systemSnapshot.members,
        scene.systemSnapshot.resolvedSunIdentity,
      );
      if (valid.length === targets.length) return targets;
      setFocusError("removed");
      if (!valid.length) setClusterOpen(false);
      return valid;
    });
  }, [scene, state.status]);
  const lastHomeFrame = useRef("");
  const lastHomeDomain = useRef("");
  const clusterRect = obstacles[CLUSTER_OBSTACLE];
  const clusterMeasured = !!clusterRect;
  // 38.7-16 (D-79): the cluster panel is no framing obstacle. A cluster is
  // framed in the area the panel leaves uncovered (canvas units), under the
  // map's fixed projection; a re-measured panel (font reflow) re-frames.
  const clusterRegion = useMemo(() => {
    if (!clusterRect) return null;
    const panel = canvasViewport(canvasRect, [clusterRect]).obstacles ?? [];
    return usableCameraRect({
      ...worldViewport,
      obstacles: [...(worldViewport.obstacles ?? []), ...panel],
    });
  }, [canvasRect, clusterRect, worldViewport]);
  useEffect(() => {
    if (!scene || state.status !== "ready" || !visible || !sessionReady) return;
    // Native measurement may arrive after opening or be cleared during font reflow.
    if (clusterOpen && !clusterMeasured) {
      lastHomeFrame.current = "";
      return;
    }
    const groupKey = clusterOpen
      ? `${scene.generation}:${focusedIds.join(",")}:${JSON.stringify(clusterRegion)}`
      : "";
    const key = `${systemRefId(scene.system)}:${scene.preferences.density}:${JSON.stringify(worldViewport)}:${groupKey}`;
    const domain = `${systemRefId(scene.system)}:${scene.preferences.density}`;
    // C4-M3: a real System switch lands at destination Home. The landing is
    // handled ONCE — by the first run below for that generation — and then
    // consumed, so a later cluster tap in the same generation still zooms
    // (D-19; before 38.7-12 the flag stayed set for the whole generation).
    const switchLanding = switchHomeGeneration.current === scene.generation;
    if (switchLanding) switchHomeGeneration.current = null;
    void settledSwitch; // re-run once a switch settles (see onSwitchSettled)
    const session = useOrrerySessionStore.getState();
    // 38.7-15 (C4-M2): the Home a warm return already drew, consumed here.
    const warmPose = warmHome.current;
    warmHome.current = null;
    if (sessionResume === "restore") {
      const restored = restoreOrrerySession({
        saved: session.saved,
        systemId: systemRefId(scene.system),
        members: scene.systemSnapshot.members,
        sun: scene.systemSnapshot.resolvedSunIdentity,
        extent: cameraExtent(scene.extent),
      });
      if (restored) {
        lastHomeFrame.current = key;
        lastHomeDomain.current = domain;
        focusFraming.current = null;
        setFocusTargets(restored.focus ? [restored.focus] : []);
        setClusterOpen(false);
        if (session.saved?.focus && !restored.focus) setFocusError("removed");
        const stop = camera.stop;
        runOnUI(() => {
          "worklet";
          stop();
          pose.value = restored.pose;
        })();
        session.resumed();
        return;
      }
    }
    if (lastHomeFrame.current === key && sessionResume === "active") return;
    // C4-M3: any Home reframe below ends a focus framing's authority.
    focusFraming.current = null;
    if (
      sessionResume === "active" &&
      lastHomeDomain.current === domain &&
      !clusterOpen
    ) {
      lastHomeFrame.current = key;
      const extent = cameraExtent(scene.extent);
      runOnUI(() => {
        "worklet";
        camera.stop();
        pose.value = clampCameraPose(pose.value, extent);
      })();
      return;
    }
    const focusedBodies = scene.world.filter(
      (body) => sessionResume === "active" && focusedIds.includes(body.id),
    );
    // Dossier §V keeps a shared focus selected, but a real System switch still
    // lands at canonical Home rather than framing that retained contact.
    const forceSwitchHome = sessionResume !== "restore" && switchLanding;
    if (forceSwitchHome) {
      // The screen-owned choreography already samples from the displayed pose
      // to destination Home. Assigning Home here would snap its first frame.
      lastHomeFrame.current = key;
      lastHomeDomain.current = domain;
      return;
    }
    // D-19: a cluster opened while a switch is still running waits for it to
    // settle — the switch owns the pose until then (its settle writes
    // destination Home). Nothing is recorded, so the settle re-run zooms.
    if (clusterOpen && switchProgress.value < 1) return;
    // D-19/D-47: a single focus is framed above the docked card, uncapped;
    // an open cluster zooms in until its members separate, framed in the
    // area its panel leaves uncovered (38.7-16, D-79: the panel stays open
    // beside it and the projection centre does not move).
    const focusedPose =
      focusedBodies.length === 1 && !clusterOpen
        ? (frameSingleFocus(focusedBodies[0], scene, lastCardHeight.current) ??
          undefined)
        : focusedBodies.length > 0 && clusterOpen
          ? (clusterZoomPose(
              focusedBodies,
              worldViewport,
              pose.value,
              scene.extent,
              clusterRegion,
            ) ?? undefined)
          : focusedBodies.length > 0
            ? frameBodies(
                focusedBodies,
                worldViewport,
                scene.extent,
                pose.value,
              )?.pose
            : undefined;
    if (clusterOpen && focusedBodies.length > 0 && !focusedPose) {
      // H2: no safe cluster pose (beyond the horizon) — the panel stays open
      // and the camera stays where it is.
      lastHomeFrame.current = key;
      lastHomeDomain.current = domain;
      return;
    }
    const home = selectSystemFraming(
      false,
      focusedPose,
      deriveHomePose(scene.world, worldViewport),
    );
    if (!home) return; // Preserve the previous valid pose through zero measurement.
    lastHomeFrame.current = key;
    lastHomeDomain.current = domain;
    if (sessionResume !== "active") {
      // 38.7-15: keep the same empty list (the warm prep already cleared it),
      // so OrreryWorld's focusedIds — and its label/text inputs — are not
      // rebuilt at sessionReady for an unchanged, empty focus.
      setFocusTargets((targets) => (targets.length === 0 ? targets : []));
      setFocusedSatellite(null);
      setClusterOpen(false);
      setFocusError(null);
      session.resumed();
    }
    if (clusterOpen) runOnUI(camera.recover)(home);
    // C4-M2: unchanged data after a warm return → Home is already drawn: no
    // camera change; changed data → this one reframe.
    else if (!(warmPose && sameHomePose(warmPose, home)))
      runOnUI(() => {
        "worklet";
        camera.stop();
        pose.value = home;
      })();
  }, [
    scene,
    state.status,
    worldViewport,
    pose,
    focusedIds,
    camera.stop,
    camera.recover,
    clusterOpen,
    clusterMeasured,
    clusterRegion,
    visible,
    sessionReady,
    sessionResume,
    frameSingleFocus,
    switchProgress,
    settledSwitch,
  ]);
  const recenter = () => {
    focusFraming.current = null;
    satelliteAction.current++;
    setFocusedSatellite(null);
    actions.cancel("recenter");
    setClusterOpen(false);
    setFocusTargets([]);
    setFocusError(null);
    const home = deriveHomePose(state.snapshot?.world ?? [], worldViewport);
    if (!home) return;
    runOnUI(camera.recover)(home);
  };
  const resetNorth = () => {
    if (!measured) return;
    runOnUI(() => {
      "worklet";
      camera.recover(northTarget(pose.value));
    })();
  };
  const empty = state.status === "ready" && scene?.contacts.length === 0;
  const qualifyingSun = !!scene?.systemSnapshot.members.some(
    (row) => row.id === scene.systemSnapshot.resolvedSunIdentity?.id,
  );
  const allContacts = state.requested.id === "builtin:all-contacts";
  const focusedTarget =
    !clusterOpen && focusTargets.length === 1 ? focusTargets[0] : null;
  const focusedMember = focusedTarget
    ? scene?.systemSnapshot.members.find(
        (member) =>
          member.id === focusedTarget.id && member.uid === focusedTarget.uid,
      )
    : null;
  const cardTargetKey = focusedSatellite
    ? bodyKey({ id: -1, kind: "satellite", satelliteTarget: focusedSatellite })
    : focusedTarget
      ? `id:${focusedTarget.id}`
      : "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the card target's identity, not the target objects
  useEffect(() => {
    cardTarget.value = focusedSatellite
      ? { key: cardTargetKey }
      : focusedTarget
        ? { id: focusedTarget.id }
        : null;
  }, [cardTarget, cardTargetKey]);
  // 38.7-15: never another System's name (null while it is still unknown).
  const requestedName = systemDisplayName(state, systemCatalog);
  const emptyCopy = systemEmptyCopy(
    requestedName ?? "this System",
    allContacts,
    qualifyingSun,
  );
  const brokenRules = scene?.systemSnapshot.brokenRules ?? [];
  const attentionFeedback = systemAttentionFeedback(
    scene?.systemSnapshot.validity,
    brokenRules.length,
  );
  const showAll = () => selectSystem(ALL_CONTACTS_SYSTEM);

  return (
    <View
      testID="orrery-root"
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      {/* 38.7-12 (D-39): the canvas fills the whole root; the unchanged
          ShellAppBar floats over it in the Orrery-local header below. */}
      <View
        testID="orrery-canvas-container"
        ref={canvasMeasurement.ref}
        collapsable={false}
        // 38.7-15: the sky's base colour from the first frame — a cold open
        // (scene still loading) or a canvas not yet mounted shows the theme's
        // sky, never the app background or black.
        style={[styles.canvasArea, { backgroundColor: colors.orrerySkyBase }]}
        onLayout={canvasMeasurement.onLayout}
      >
        {visible &&
        scene &&
        (sessionReady || (warmReturn && warmPosePrepared)) ? (
          <OrreryWorld
            scene={scene}
            camera={camera}
            pose={pose}
            viewport={worldViewport}
            colors={colors}
            themeMode={themeMode}
            themePackage={themePackage}
            fontProvider={fontProvider}
            onIntent={onIntent}
            onReorder={onReorder}
            onReorderActivated={acknowledgeReorder}
            focusedIds={focusedIds}
            satelliteSource={satellitePublisher.source}
            focusedSatellite={focusedSatellite}
            switchRuntime={switchRuntime}
            clusterIds={clusterIds}
            focusCardRect={focusCardRect}
            occlusionRects={occlusionRects}
            onFocusLost={clusterOpen ? undefined : clearFocus}
            interactive={!overlaysOpen && state.status === "ready"}
          />
        ) : null}
        <OrrerySystemSelector
          state={state}
          availableHeight={viewport.height}
          enabled={hydrated}
          catalog={systemCatalog}
          counts={systemCounts}
          needsAttention={systemNeedsAttention}
          onOpenChange={onSystemSelectorOpenChange}
          onSelect={selectSystem}
          topInset={headerHeight}
        />
        <OrreryViewOptions
          availableHeight={viewport.height}
          topInset={headerHeight}
        />
        <OrreryControls
          viewport={controlsViewport}
          measured={measured}
          blocked={overlaysOpen}
          pose={pose}
          onContacts={openContacts}
          onRecenter={recenter}
          onResetNorth={resetNorth}
        />
        {satelliteRow && focusedSatellite && scene ? (
          <OrreryFocusContext
            target={focusedSatellite}
            name={satelliteRow.personName}
            placement={focusCardRect}
            cardHeight={cardHeight}
            onHeight={onCardHeight}
            blocked={overlaysOpen}
            onClear={clearFocus}
            relationshipContext={
              <AppText>
                {
                  satelliteContext(
                    satelliteRow,
                    scene.systemSnapshot.members.find(
                      (p) => p.id === satelliteRow.parentId,
                    )?.name ?? "",
                  ).relation
                }
              </AppText>
            }
          />
        ) : null}
        {focusedTarget && scene ? (
          <OrreryFocusContext
            target={focusedTarget}
            name={focusedMember?.name ?? scene.sun.sunContactName}
            placement={focusCardRect}
            cardHeight={cardHeight}
            onHeight={onCardHeight}
            blocked={overlaysOpen}
            onClear={clearFocus}
            contextState={focusedMember ? satellites?.status : undefined}
            onReloadContext={reloadSatellites}
            relationshipContext={
              focusedMember
                ? satellites?.rows
                    .filter(
                      (row) =>
                        row.parentId === focusedMember.id &&
                        row.parentUid === focusedMember.uid,
                    )
                    .map((row) => {
                      const text = satelliteContext(row, focusedMember.name);
                      return (
                        <View key={row.uid}>
                          <AppText>{text.name}</AppText>
                          <AppText role="caption">{text.relation}</AppText>
                        </View>
                      );
                    })
                : undefined
            }
            onProfile={() => {
              const current = state.current();
              if (current)
                void onIntent({
                  kind: "profile",
                  ids: [focusedTarget.id],
                  targets: [focusedTarget],
                  generation: current.generation,
                });
            }}
          />
        ) : null}
        {clusterOpen && scene ? (
          <OrreryClusterPanel
            targets={focusTargets}
            scene={scene}
            viewport={panelViewport}
            stale={state.status === "stale"}
            blocked={overlaysOpen}
            onClose={dismissCluster}
            onReload={retryReload}
            onAction={(kind, target) => {
              const current = state.current();
              if (!current) return;
              closeBeforeAction(
                () => {
                  setClusterOpen(false);
                  shellTransientStore
                    .getState()
                    .closeTransient("orrery-cluster");
                },
                () => {
                  void onIntent({
                    kind,
                    ids: [target.id],
                    targets: [target],
                    generation: current.generation,
                  });
                },
              );
            }}
          />
        ) : null}
        {focusError ? (
          <OrreryFeedback
            obstacleId="orrery-focus-feedback"
            style={[styles.feedback, { backgroundColor: colors.surface }]}
            contentContainerStyle={styles.feedbackContent}
          >
            <OrreryNotice
              kind={
                focusError === "error"
                  ? "stale"
                  : focusError === "missing-category"
                    ? "missing"
                    : "removed"
              }
              onAction={focusError === "error" ? retryReload : showAll}
            />
          </OrreryFeedback>
        ) : null}
        {reorderError ? (
          <OrreryFeedback
            obstacleId="orrery-reorder-feedback"
            style={[styles.feedback, { backgroundColor: colors.surface }]}
            contentContainerStyle={styles.feedbackContent}
          >
            <OrreryNotice
              kind="reorder"
              onAction={reloadReorder}
              busy={state.status === "loading"}
            />
          </OrreryFeedback>
        ) : null}
        {state.status === "error" || state.status === "stale" ? (
          <OrreryFeedback
            obstacleId="orrery-read-feedback"
            style={[styles.feedback, { backgroundColor: colors.surface }]}
            contentContainerStyle={styles.feedbackContent}
          >
            <OrreryNotice
              kind={scene ? "stale" : "read"}
              onAction={retryReload}
            />
          </OrreryFeedback>
        ) : null}
        {state.status === "missing-category" ? (
          <OrreryFeedback
            obstacleId="orrery-missing-feedback"
            style={[styles.feedback, { backgroundColor: colors.surface }]}
            contentContainerStyle={styles.feedbackContent}
          >
            <AppText role="heading">{requestedName ?? "\u00A0"}</AppText>
            <OrreryNotice kind="missing" onAction={showAll} />
          </OrreryFeedback>
        ) : null}
        {state.persistence === "error" && state.status === "ready" ? (
          <OrreryFeedback
            obstacleId="orrery-save-feedback"
            style={[styles.saveFeedback, { backgroundColor: colors.surface }]}
            contentContainerStyle={styles.feedbackContent}
          >
            <OrreryNotice
              kind="preferences"
              onAction={state.retryPersistence}
            />
          </OrreryFeedback>
        ) : null}
        {attentionFeedback ? (
          <OrreryFeedback
            obstacleId="orrery-broken-system-feedback"
            style={[styles.saveFeedback, { backgroundColor: colors.surface }]}
            contentContainerStyle={styles.feedbackContent}
          >
            <AppText role="label">{attentionFeedback.heading}</AppText>
            {attentionFeedback.detail ? (
              <AppText role="caption">{attentionFeedback.detail}</AppText>
            ) : null}
          </OrreryFeedback>
        ) : null}
        {hydrationFailed && !hydrated ? (
          <OrreryFeedback
            obstacleId="orrery-settings-feedback"
            style={[styles.feedback, { backgroundColor: colors.surface }]}
            contentContainerStyle={styles.feedbackContent}
          >
            <OrreryNotice
              kind="settings"
              onAction={() => hydratePreferences(getExecutor())}
            />
          </OrreryFeedback>
        ) : null}
        {empty ? (
          <OrreryFeedback
            obstacleId="orrery-empty-feedback"
            testID="orrery-empty"
            style={[styles.feedback, { backgroundColor: colors.surface }]}
            contentContainerStyle={styles.feedbackContent}
          >
            <AppText role="heading">{emptyCopy.heading}</AppText>
            <AppText>{emptyCopy.body}</AppText>
            {!allContacts ? (
              <Button
                role="secondary"
                label="Show All Contacts"
                onPress={showAll}
              />
            ) : !qualifyingSun ? (
              <Button
                role="secondary"
                label="Add Contact"
                onPress={() =>
                  navigateIntoTab(
                    navigationRef.current,
                    "DashboardTab",
                    "Create",
                  )
                }
              />
            ) : null}
          </OrreryFeedback>
        ) : null}
      </View>
      <OrreryImmersiveHeader
        barHeight={headerHeight}
        onBarHeight={setHeaderHeight}
      >
        <ShellAppBar variant="root" title="Orrery" />
      </OrreryImmersiveHeader>
      <OrreryContactsSheet
        satellites={satellites}
        onReloadSatellites={reloadSatellites}
        visible={contactsOpen}
        state={state}
        measured={measured}
        onClose={() => closeContacts()}
        onAction={(kind, id) => {
          const snapshot = state.current();
          if (!snapshot) return;
          closeContacts(kind === "focus");
          const intent = companionAction(snapshot, kind, id);
          if (intent) void onIntent(intent);
        }}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  // D-39: the canvas fills the root (under the title); the root still ends at
  // the tab bar, so the measurement stays above it exactly as before.
  canvasArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  feedback: {
    position: "absolute",
    top: "25%",
    maxHeight: "50%",
    left: SPACING.base,
    right: SPACING.base,
  },
  feedbackContent: { padding: SPACING.base, gap: SPACING.sm },
  saveFeedback: {
    position: "absolute",
    bottom: SPACING.base,
    left: SPACING.base,
    right: SPACING.base,
    maxHeight: "25%",
  },
});
