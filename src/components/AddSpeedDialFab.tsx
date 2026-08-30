import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { speedDialScrimPointerEvents } from "@/components/add-speed-dial-fab-logic";
import { getAppSettings } from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import type { RootStackParamList } from "@/navigation/types";
import { contactImportMode } from "@/screens/use-contact-import-mode";
import { getDeviceRegion } from "@/services/device-region";
import { startContactImport } from "@/services/import/start-contact-import";
import { useTheme } from "@/theme";
import { pickContacts } from "../../modules/orbit-contact-picker";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AddSpeedDialFab() {
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [busy, setBusy] = useState(false);
  // `open` mirrors the `expanded` shared value into React state so the scrim /
  // option `pointerEvents` can be gated on collapsed state (a shared value alone
  // never re-renders). The two are kept in lockstep in `setExpanded` below.
  const [open, setOpen] = useState(false);
  const expanded = useSharedValue(0);
  const setExpanded = (next: boolean) => {
    expanded.value = withTiming(next ? 1 : 0, { duration: 180 });
    setOpen(next);
  };
  const scrimPointerEvents = speedDialScrimPointerEvents(open);
  const importStyle = useAnimatedStyle(() => ({
    opacity: expanded.value,
    transform: [{ translateY: -68 * expanded.value }],
  }));
  const createStyle = useAnimatedStyle(() => ({
    opacity: expanded.value,
    transform: [{ translateY: -124 * expanded.value }],
  }));
  const glyphStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${expanded.value * 45}deg` }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: expanded.value }));

  async function importContacts() {
    if (busy) return;
    setBusy(true);
    try {
      const settings = await getAppSettings(getExecutor());
      await startContactImport({
        mode: contactImportMode(),
        exec: getExecutor(),
        effectivePhoneRegion: settings.phoneRegionOverride ?? getDeviceRegion(),
        now: localDateTime(),
        pick: () => pickContacts({ multiple: true }),
        navigate: navigation.navigate,
      });
      setExpanded(false);
    } catch {
      Alert.alert("Couldn't import contacts", "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <AnimatedPressable
        onPress={() => setExpanded(false)}
        pointerEvents={scrimPointerEvents}
        style={[styles.scrim, scrimStyle]}
      />
      <AnimatedPressable
        onPress={() => void importContacts()}
        disabled={busy}
        pointerEvents={scrimPointerEvents}
        style={[
          styles.option,
          importStyle,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>
          Import from Contacts
        </Text>
      </AnimatedPressable>
      <AnimatedPressable
        onPress={() => {
          setExpanded(false);
          navigation.navigate("Create");
        }}
        pointerEvents={scrimPointerEvents}
        style={[
          styles.option,
          createStyle,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>
          Create manually
        </Text>
      </AnimatedPressable>
      <Pressable
        testID="dashboard-create-fab"
        accessibilityRole="button"
        accessibilityLabel="Add contact"
        onPress={() => setExpanded(!open)}
        style={[styles.base, { backgroundColor: colors.accent }]}
      >
        <Animated.Text
          style={[styles.glyph, glyphStyle, { color: colors.background }]}
        >
          +
        </Animated.Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill },
  scrim: { ...StyleSheet.absoluteFill },
  base: {
    position: "absolute",
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
  },
  glyph: { fontSize: 32, lineHeight: 34, fontWeight: "600" },
  option: {
    position: "absolute",
    right: 20,
    bottom: 28,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    elevation: 5,
  },
});
