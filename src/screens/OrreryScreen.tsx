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
  StyleSheet,
  View,
} from "react-native";
import {
  cancelAnimation,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { OrreryViewOptions } from "@/components/orrery/OrreryViewOptions";
import { OrreryWorld } from "@/components/orrery/OrreryWorld";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { getExecutor } from "@/db/database";
import {
  type CameraPose,
  constrainCamera,
  FOCUS_MS,
  HOME_CAMERA,
  IDENTITY_ZOOM,
} from "@/logic/orrery-camera-logic";
import {
  ALL_CONTACTS_SYSTEM,
  parseSystemRef,
  systemRefId,
} from "@/logic/orrery-system-logic";
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
    Inter: [require("../../assets/Inter-SemiBold.ttf")],
  });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const preferences = useOrreryPreferencesStore((store) => store.committed);
  const hydratePreferences = useOrreryPreferencesStore(
    (store) => store.hydrate,
  );
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
          const pref = useOrreryPreferencesStore.getState();
          if (!pref.hydrated) return;
          if (!initialized.current) {
            initialized.current = true;
            await useSystemStore
              .getState()
              .select(
                parseSystemRef(pref.committed.lastSystem) ??
                  ALL_CONTACTS_SYSTEM,
              );
          } else await useSystemStore.getState().reload();
        })();
      return () => {
        cancelled = true;
        useSystemStore.getState().cancel();
        cancelAnimation(pose);
      };
    }, [useSystemStore, hydratePreferences, appActive, pose]),
  );
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
  const measured =
    Number.isFinite(viewport.width) &&
    Number.isFinite(viewport.height) &&
    viewport.width > 0 &&
    viewport.height > 0;
  const visible = measured && isFocused && appActive;
  const empty = state.status === "ready" && scene?.contacts.length === 0;
  const contactSun = scene?.world.some(
    (body) => body.kind === "sun" && body.id > 0,
  );

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
            key={scene.generation}
            scene={scene}
            pose={pose}
            viewport={viewport}
            colors={colors}
            fontProvider={fontProvider}
            onIntent={onIntent}
            focusedIds={focusedIds}
          />
        ) : null}
        <OrreryViewOptions availableHeight={viewport.height} />
        {state.status === "loading" && !scene ? (
          <View style={styles.feedback}>
            <AppText>Loading your Orrery…</AppText>
          </View>
        ) : null}
        {state.status === "error" || state.status === "stale" ? (
          <View style={styles.feedback}>
            <AppText>
              {scene
                ? "Couldn't refresh this System. Showing the last loaded contacts."
                : "Couldn't load this System. Try loading it again."}
            </AppText>
            <Button role="secondary" label="Reload System" onPress={reload} />
          </View>
        ) : null}
        {empty ? (
          <View
            testID="orrery-empty"
            style={styles.feedback}
            pointerEvents="none"
          >
            <AppText role="heading">
              {contactSun
                ? "Your contacts are centered here"
                : "No contacts in your Orrery yet"}
            </AppText>
            <AppText>
              {contactSun
                ? "Open the contact at the center or choose another System."
                : "Add a contact and choose a contact frequency to include them here."}
            </AppText>
          </View>
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
    top: SPACING.base,
    left: SPACING.base,
    right: SPACING.base,
    gap: SPACING.sm,
  },
});
