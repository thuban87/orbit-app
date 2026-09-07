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
import { OrrerySystemSelector } from "@/components/orrery/OrrerySystemSelector";
import { OrreryViewOptions } from "@/components/orrery/OrreryViewOptions";
import { OrreryWorld } from "@/components/orrery/OrreryWorld";
import { companionAction } from "@/components/orrery/orrery-companion-logic";
import { systemEmptyCopy } from "@/components/orrery/orrery-controls-logic";
import { canvasViewport } from "@/components/orrery/orrery-obstacle-logic";
import {
  closeBeforeAction,
  clusterRows,
} from "@/components/orrery/orrery-overlay-logic";
import { satelliteContext } from "@/components/orrery/orrery-satellite-context";
import { useOrreryCamera } from "@/components/orrery/use-orrery-camera";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { getExecutor, localDateTime } from "@/db/database";
import { readOrreryContactTargetValidation } from "@/db/orrery-action-read";
import { readOrrerySatellites } from "@/db/orrery-satellites-read";
import { commitRingReorder } from "@/db/ring-seq-dao";
import {
  type CameraPose,
  type CameraRect,
  clampCameraPose,
  deriveHomePose,
  frameBodies,
  HOME_CAMERA,
  IDENTITY_ZOOM,
  type OrreryIntent,
  type OrrerySatelliteTarget,
  usableCameraRect,
} from "@/logic/orrery-camera-logic";
import {
  createOrreryFocusController,
  type OrreryCancellation,
  type OrreryContactTarget,
} from "@/logic/orrery-focus-logic";
import { cameraExtent, northTarget } from "@/logic/orrery-recovery-logic";
import type { ReorderIntent } from "@/logic/orrery-reorder-logic";
import { restoreOrrerySession } from "@/logic/orrery-session-logic";
import {
  ALL_CONTACTS_SYSTEM,
  parseSystemRef,
  systemRefId,
} from "@/logic/orrery-system-logic";
import { navigationRef } from "@/navigation/linking";
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

const acknowledgeReorder = () => {
  void Haptics.selectionAsync().catch(() => {});
};

export function OrreryScreen() {
  const { colors } = useTheme();
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
  const viewport = useMemo(
    () => canvasViewport(canvasRect, Object.values(obstacles)),
    [canvasRect, obstacles],
  );
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
  const hydratePreferences = useOrreryPreferencesStore(
    (store) => store.hydrate,
  );
  const hydrated = useOrreryPreferencesStore((store) => store.hydrated);
  const hydration = useOrreryPreferencesStore((store) => store.hydration);
  const [focusTargets, setFocusTargets] = useState<OrreryContactTarget[]>([]);
  const [focusedSatellite, setFocusedSatellite] =
    useState<OrrerySatelliteTarget | null>(null);
  const satelliteAction = useRef(0);
  const focusedIds = useMemo(
    () => focusTargets.map((target) => target.id),
    [focusTargets],
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
        persist: async (system) => {
          const store = useOrreryPreferencesStore.getState();
          const id = systemRefId(system);
          if (store.saveError && store.pendingIntent?.lastSystem === id)
            await store.retry(getExecutor());
          else await store.save(getExecutor(), { lastSystem: id });
          const latest = useOrreryPreferencesStore.getState();
          return (
            latest.hydrated &&
            !latest.saveError &&
            latest.committed.lastSystem === systemRefId(system)
          );
        },
      }),
    [],
  );
  const state = useSystemStore();
  const [satelliteState, setSatelliteState] = useState<OrrerySatelliteState>({
    status: "ready",
    sceneGeneration: null,
    rows: [],
  });
  const satelliteController = useMemo(
    () =>
      createOrrerySatelliteController(
        (scene) =>
          readOrrerySatellites(
            getExecutor(),
            scene.systemSnapshot.members,
            scene.system,
          ),
        setSatelliteState,
      ),
    [],
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
      )
        reloadSatellites();
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
      setFocusTargets([]);
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
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (value) => {
      if (value !== "active") {
        if (routeLive.current) captureSession.current("background");
        cancelIntent.current("background");
      } else captureGeneration.current++;
      setAppActive(value === "active");
    });
    return () => subscription.remove();
  }, []);
  useFocusEffect(
    useCallback(() => {
      routeLive.current = true;
      setSessionReady(false);
      let cancelled = false;
      if (appActive)
        void (async () => {
          await hydratePreferences(getExecutor());
          if (cancelled) return;
          if (initialized.current) await useSystemStore.getState().reload();
          if (!cancelled) setSessionReady(true);
        })();
      return () => {
        routeLive.current = false;
        setSessionReady(false);
        cancelIntent.current("blur");
        cancelled = true;
        useSystemStore.getState().cancel();
        cancelAnimation(pose);
      };
    }, [useSystemStore, hydratePreferences, appActive, pose]),
  );
  useEffect(() => {
    if (hydrated && isFocused && appActive && !initialized.current) {
      initialized.current = true;
      const pref = useOrreryPreferencesStore.getState();
      void useSystemStore
        .getState()
        .select(
          parseSystemRef(pref.committed.lastSystem) ?? ALL_CONTACTS_SYSTEM,
        );
    }
  }, [hydrated, isFocused, appActive, useSystemStore]);
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
  const camera = useOrreryCamera({
    pose,
    extent: cameraExtent(scene?.extent ?? 32),
    viewport,
    enabled: visible && !overlaysOpen,
    reduced: reducedMotion,
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
      if (waitForPanel) {
        // The group's measured obstacle owns its framing, including later reflows.
        runOnUI(camera.stop)();
        return;
      }
      const framing = frameBodies(bodies, viewport, scene.extent, pose.value);
      if (!framing) return;
      runOnUI(camera.recover)({
        ...framing.pose,
        zoom:
          ids.length === 1
            ? Math.min(IDENTITY_ZOOM, framing.pose.zoom)
            : framing.pose.zoom,
      });
    },
    [useSystemStore, pose, camera.recover, camera.stop, viewport],
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
  const clusterMeasured = !!obstacles[CLUSTER_OBSTACLE];
  useEffect(() => {
    if (!scene || state.status !== "ready" || !visible || !sessionReady) return;
    // Native measurement may arrive after opening or be cleared during font reflow.
    if (clusterOpen && !clusterMeasured) {
      lastHomeFrame.current = "";
      return;
    }
    const groupKey = clusterOpen
      ? `${scene.generation}:${focusedIds.join(",")}`
      : "";
    const key = `${systemRefId(scene.system)}:${scene.preferences.density}:${JSON.stringify(viewport)}:${groupKey}`;
    const domain = `${systemRefId(scene.system)}:${scene.preferences.density}`;
    const session = useOrrerySessionStore.getState();
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
    const home =
      focusedBodies.length > 0
        ? frameBodies(focusedBodies, viewport, scene.extent, pose.value)?.pose
        : deriveHomePose(scene.world, viewport);
    if (!home) return; // Preserve the previous valid pose through zero measurement.
    if (focusedBodies.length === 1)
      home.zoom = Math.min(IDENTITY_ZOOM, home.zoom);
    lastHomeFrame.current = key;
    lastHomeDomain.current = domain;
    if (sessionResume !== "active") {
      setFocusTargets([]);
      setFocusedSatellite(null);
      setClusterOpen(false);
      setFocusError(null);
      session.resumed();
    }
    if (clusterOpen) runOnUI(camera.recover)(home);
    else
      runOnUI(() => {
        "worklet";
        camera.stop();
        pose.value = home;
      })();
  }, [
    scene,
    state.status,
    viewport,
    pose,
    focusedIds,
    camera.stop,
    camera.recover,
    clusterOpen,
    clusterMeasured,
    visible,
    sessionReady,
    sessionResume,
  ]);
  const recenter = () => {
    satelliteAction.current++;
    setFocusedSatellite(null);
    actions.cancel("recenter");
    setClusterOpen(false);
    setFocusTargets([]);
    setFocusError(null);
    const home = deriveHomePose(state.snapshot?.world ?? [], viewport);
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
  const emptyCopy = systemEmptyCopy(
    state.requested.name,
    allContacts,
    qualifyingSun,
  );
  const showAll = () => state.select(ALL_CONTACTS_SYSTEM);

  return (
    <View
      testID="orrery-root"
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <ShellAppBar variant="root" title="Orrery" />
      <View
        testID="orrery-canvas-container"
        ref={canvasMeasurement.ref}
        collapsable={false}
        style={styles.canvasArea}
        onLayout={canvasMeasurement.onLayout}
      >
        {visible && sessionReady && scene ? (
          <OrreryWorld
            scene={scene}
            camera={camera}
            pose={pose}
            viewport={viewport}
            colors={colors}
            fontProvider={fontProvider}
            onIntent={onIntent}
            onReorder={onReorder}
            onReorderActivated={acknowledgeReorder}
            focusedIds={focusedIds}
            satellites={satellites?.rows}
            focusedSatellite={focusedSatellite}
            clusterIds={clusterOpen ? focusedIds : []}
            onFocusLost={clusterOpen ? undefined : clearFocus}
            interactive={!overlaysOpen && state.status === "ready"}
          />
        ) : null}
        <OrrerySystemSelector
          state={state}
          availableHeight={viewport.height}
          enabled={hydrated}
        />
        <OrreryViewOptions availableHeight={viewport.height} />
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
            frame={camera.frame}
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
            frame={camera.frame}
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
        {(state.status === "loading" || state.status === "initial") &&
        !scene &&
        hydration !== "error" ? (
          <OrreryFeedback
            obstacleId="orrery-loading-feedback"
            style={[styles.feedback, { backgroundColor: colors.surface }]}
            contentContainerStyle={styles.feedbackContent}
          >
            <OrreryNotice kind="world-loading" />
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
            <AppText role="heading">{state.requested.name}</AppText>
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
        {hydration === "error" && !hydrated ? (
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
                  navigationRef.current?.navigate("DashboardTab", {
                    screen: "Create",
                  })
                }
              />
            ) : null}
          </OrreryFeedback>
        ) : null}
      </View>
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
  canvasArea: { flex: 1, alignItems: "center", justifyContent: "center" },
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
