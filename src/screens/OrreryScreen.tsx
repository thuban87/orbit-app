/** ADR-077 canonical timestamp world; screen owns lifecycle and discrete intents. */
// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is semantic typography.
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFonts } from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { OrreryWorld } from "@/components/orrery/OrreryWorld";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import {
  getAppSettings,
  ORRERY_DENSITIES,
  type OrreryDensity,
  updateAppSettings,
} from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import {
  type CameraPose,
  constrainCamera,
  FOCUS_MS,
  HOME_CAMERA,
  IDENTITY_ZOOM,
} from "@/logic/orrery-camera-logic";
import type { RootStackParamList } from "@/navigation/types";
import {
  createOrreryIntentDispatcher,
  createOrrerySceneController,
  loadOrreryScene,
  type OrreryLoadState,
} from "@/services/orrery-scene";
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
  const [state, setState] = useState<OrreryLoadState>({
    status: "loading",
    snapshot: null,
  });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [density, setDensity] = useState<OrreryDensity | null>(null);
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [preferenceError, setPreferenceError] = useState(false);
  useEffect(() => {
    void getAppSettings(getExecutor())
      .then((settings) => setDensity(settings.orreryDensity))
      .catch(() => setPreferenceError(true));
  }, []);
  const saveDensity = async (next: OrreryDensity) => {
    if (preferenceBusy || density === null || density === next) return;
    setPreferenceBusy(true);
    try {
      await updateAppSettings(
        getExecutor(),
        { orreryDensity: next },
        localDateTime(),
      );
      setDensity((await getAppSettings(getExecutor())).orreryDensity);
      setPreferenceError(false);
    } catch {
      setPreferenceError(true);
    } finally {
      setPreferenceBusy(false);
    }
  };
  const [focusedIds, setFocusedIds] = useState<number[]>([]);
  const pose = useSharedValue<CameraPose>({ ...HOME_CAMERA });
  const reducedMotion = useReducedMotionShared();
  const controller = useMemo(
    () =>
      createOrrerySceneController(
        (generation) => loadOrreryScene(getExecutor(), generation),
        setState,
      ),
    [],
  );
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
      if (appActive) void controller.reload();
      return () => {
        controller.cancel();
        cancelAnimation(pose);
      };
    }, [controller, appActive, pose]),
  );
  const reload = useCallback(() => {
    if (isFocused && appActive) void controller.reload();
  }, [controller, isFocused, appActive]);
  useShellRefresh(reload);

  const focus = useCallback(
    (ids: number[]) => {
      const scene = controller.current();
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
    [controller, pose, reducedMotion],
  );
  const onIntent = useMemo(
    () =>
      createOrreryIntentDispatcher({
        current: controller.current,
        validate: () => loadOrreryScene(getExecutor()),
        focus,
        group: focus,
        clear: () => setFocusedIds([]),
        openProfile: (contactId) =>
          navigation.navigate("Profile", { contactId }),
      }),
    [controller, focus, navigation],
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
        accessibilityLabel="Density"
        accessibilityState={{ busy: preferenceBusy || density === null }}
      >
        {ORRERY_DENSITIES.map((option) => (
          <Button
            key={option}
            role="secondary"
            label={`${option[0].toUpperCase()}${option.slice(1)}${density === option ? " — Selected" : ""}`}
            disabled={preferenceBusy || density === null}
            onPress={() => void saveDensity(option)}
          />
        ))}
        {preferenceError ? (
          <AppText>
            Couldn't save your view options. Try that change again.
          </AppText>
        ) : null}
      </View>
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
        {state.status === "loading" && !scene ? (
          <View style={styles.feedback}>
            <AppText>Loading your Orrery…</AppText>
          </View>
        ) : null}
        {state.status === "error" ? (
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
