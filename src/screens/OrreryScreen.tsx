/** ADR-077 canonical timestamp world; screen owns lifecycle and discrete intents. */
// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is semantic typography.
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFonts } from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  type LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  cancelAnimation,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { OrrerySystemSelector } from "@/components/orrery/OrrerySystemSelector";
import { OrreryViewOptions } from "@/components/orrery/OrreryViewOptions";
import { OrreryWorld } from "@/components/orrery/OrreryWorld";
import { systemEmptyCopy } from "@/components/orrery/orrery-controls-logic";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { getExecutor } from "@/db/database";
import {
  type CameraPose,
  constrainCamera,
  deriveHomePose,
  FOCUS_MS,
  HOME_CAMERA,
  IDENTITY_ZOOM,
} from "@/logic/orrery-camera-logic";
import {
  ALL_CONTACTS_SYSTEM,
  parseSystemRef,
  systemRefId,
} from "@/logic/orrery-system-logic";
import { navigationRef } from "@/navigation/linking";
import type { RootStackParamList } from "@/navigation/types";
import {
  createOrreryIntentDispatcher,
  loadOrreryScene,
} from "@/services/orrery-scene";
import { useOrreryPreferencesStore } from "@/stores/orrery-preferences-store";
import { createOrrerySystemStore } from "@/stores/orrery-system-store";
import { useShellRefresh } from "@/stores/shell-refresh-store";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { useReducedMotionShared } from "@/theme/use-reduced-motion";

export function OrreryScreen() {
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const fontProvider = useFonts({
    Inter: [
      require("../../assets/Inter-Regular.ttf"),
      require("../../assets/Inter-SemiBold.ttf"),
    ],
    "Space Grotesk": [require("../../assets/SpaceGrotesk-SemiBold.ttf")],
  });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const preferences = useOrreryPreferencesStore((store) => store.committed);
  const hydratePreferences = useOrreryPreferencesStore(
    (store) => store.hydrate,
  );
  const hydrated = useOrreryPreferencesStore((store) => store.hydrated);
  const hydration = useOrreryPreferencesStore((store) => store.hydration);
  const [focusedIds, setFocusedIds] = useState<number[]>([]);
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
  const focusSystem = useRef(state.requested.id);
  useEffect(() => {
    if (focusSystem.current !== state.requested.id) {
      focusSystem.current = state.requested.id;
      setFocusedIds([]);
    }
  }, [state.requested.id]);
  const initialized = useRef(false);
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(
    AppState.currentState === "active",
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (value) =>
      setAppActive(value === "active"),
    );
    return () => subscription.remove();
  }, []);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (appActive)
        void (async () => {
          await hydratePreferences(getExecutor());
          if (cancelled) return;
          if (initialized.current) await useSystemStore.getState().reload();
        })();
      return () => {
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
  const presentation = `${preferences.density}:${preferences.satellitesEnabled}`;
  const lastPresentation = useRef(presentation);
  useEffect(() => {
    if (lastPresentation.current !== presentation) {
      lastPresentation.current = presentation;
      reload();
    }
  }, [presentation, reload]);

  const focus = useCallback(
    (ids: number[]) => {
      const scene = useSystemStore.getState().current();
      if (!scene) return;
      const bodies = scene.world.filter((body) => ids.includes(body.id));
      if (bodies.length === 0) return;
      setFocusedIds(ids);
      const x = bodies.reduce((sum, body) => sum + body.x, 0) / bodies.length;
      const y = bodies.reduce((sum, body) => sum + body.y, 0) / bodies.length;
      cancelAnimation(pose);
      pose.value = withTiming(
        constrainCamera({ x, y, zoom: IDENTITY_ZOOM }, scene.extent),
        { duration: reducedMotion.value ? 100 : FOCUS_MS },
      );
    },
    [useSystemStore, pose, reducedMotion],
  );
  const onIntent = useMemo(
    () =>
      createOrreryIntentDispatcher({
        current: () => useSystemStore.getState().current(),
        validate: () =>
          loadOrreryScene(
            getExecutor(),
            0,
            useSystemStore.getState().requested.ref,
          ),
        focus,
        group: focus,
        clear: () => setFocusedIds([]),
        openProfile: (contactId) =>
          navigation.navigate("Profile", { contactId }),
      }),
    [useSystemStore, focus, navigation],
  );
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewport((previous) =>
      previous.width === width && previous.height === height
        ? previous
        : { width, height },
    );
  }, []);
  const scene = state.snapshot;
  const lastHomeFrame = useRef("");
  useEffect(() => {
    if (!scene || state.status !== "ready") return;
    const key = `${systemRefId(scene.system)}:${scene.preferences.density}:${viewport.width}:${viewport.height}`;
    if (lastHomeFrame.current === key) return;
    const home = deriveHomePose(scene.world, viewport);
    if (!home) return; // Preserve the previous valid pose through zero measurement.
    lastHomeFrame.current = key;
    cancelAnimation(pose);
    pose.value = home;
    setFocusedIds([]);
  }, [scene, state.status, viewport, pose]);
  const measured =
    Number.isFinite(viewport.width) &&
    Number.isFinite(viewport.height) &&
    viewport.width > 0 &&
    viewport.height > 0;
  const visible = measured && isFocused && appActive;
  const empty = state.status === "ready" && scene?.contacts.length === 0;
  const qualifyingSun = !!scene?.systemSnapshot.members.some(
    (row) => row.id === scene.systemSnapshot.resolvedSunIdentity?.id,
  );
  const allContacts = state.requested.id === "builtin:all-contacts";
  const emptyCopy = systemEmptyCopy(
    state.requested.name,
    allContacts,
    qualifyingSun,
  );
  const showAll = () => void state.select(ALL_CONTACTS_SYSTEM);

  return (
    <View
      testID="orrery-root"
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <ShellAppBar variant="root" title="Orrery" />
      <View
        testID="orrery-canvas-container"
        style={styles.canvasArea}
        onLayout={onLayout}
      >
        {visible && scene ? (
          <OrreryWorld
            scene={scene}
            pose={pose}
            viewport={viewport}
            colors={colors}
            fontProvider={fontProvider}
            onIntent={onIntent}
            focusedIds={focusedIds}
          />
        ) : null}
        <OrrerySystemSelector
          state={state}
          availableHeight={viewport.height}
          enabled={hydrated}
        />
        <OrreryViewOptions availableHeight={viewport.height} />
        {(state.status === "loading" || state.status === "initial") &&
        !scene &&
        hydration !== "error" ? (
          <ScrollView
            style={[styles.feedback, { backgroundColor: colors.surface }]}
            contentContainerStyle={styles.feedbackContent}
          >
            <AppText>Loading your Orrery…</AppText>
          </ScrollView>
        ) : null}
        {state.status === "error" || state.status === "stale" ? (
          <ScrollView
            style={[styles.feedback, { backgroundColor: colors.surface }]}
            contentContainerStyle={styles.feedbackContent}
          >
            <AppText>
              {scene
                ? "Couldn't refresh this System. Showing the last loaded contacts."
                : "Couldn't load this System. Try loading it again."}
            </AppText>
            <Button role="secondary" label="Reload System" onPress={reload} />
          </ScrollView>
        ) : null}
        {state.status === "missing-category" ? (
          <ScrollView
            style={[styles.feedback, { backgroundColor: colors.surface }]}
            contentContainerStyle={styles.feedbackContent}
          >
            <AppText role="heading">{state.requested.name}</AppText>
            <AppText>This System is no longer available.</AppText>
            <Button
              role="secondary"
              label="Show All Contacts"
              onPress={showAll}
            />
          </ScrollView>
        ) : null}
        {state.persistence === "error" && state.status === "ready" ? (
          <ScrollView
            style={[styles.saveFeedback, { backgroundColor: colors.surface }]}
            contentContainerStyle={styles.feedbackContent}
          >
            <AppText>
              Couldn't save your view options. Try that change again.
            </AppText>
            <Button
              role="secondary"
              label="Retry view change"
              onPress={() => void state.retryPersistence()}
            />
          </ScrollView>
        ) : null}
        {hydration === "error" && !hydrated ? (
          <ScrollView
            style={[styles.feedback, { backgroundColor: colors.surface }]}
            contentContainerStyle={styles.feedbackContent}
          >
            <AppText>
              Couldn't load your view options. Try loading them again.
            </AppText>
            <Button
              role="secondary"
              label="Reload view options"
              onPress={() => void hydratePreferences(getExecutor())}
            />
          </ScrollView>
        ) : null}
        {empty ? (
          <ScrollView
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
          </ScrollView>
        ) : null}
      </View>
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
