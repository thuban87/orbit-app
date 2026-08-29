import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { getAppSettings } from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import type { RootStackParamList } from "@/navigation/types";
import {
  IMPORT_UNSUPPORTED_COPY,
  IMPORT_UNSUPPORTED_TITLE,
  useImportUnsupported,
} from "@/screens/use-import-unsupported";
import { getDeviceRegion } from "@/services/device-region";
import { routePickedImport } from "@/services/import/import-acquire";
import { useTheme } from "@/theme";
import { pickContacts } from "../../modules/orbit-contact-picker";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AddSpeedDialFab() {
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const unsupported = useImportUnsupported();
  const [busy, setBusy] = useState(false);
  const expanded = useSharedValue(0);
  const setExpanded = (next: boolean) => {
    expanded.value = withTiming(next ? 1 : 0, { duration: 180 });
  };
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
    if (unsupported) {
      Alert.alert(IMPORT_UNSUPPORTED_TITLE, IMPORT_UNSUPPORTED_COPY);
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const [picked, settings] = await Promise.all([
        pickContacts({ multiple: true }),
        getAppSettings(getExecutor()),
      ]);
      await routePickedImport(
        getExecutor(),
        picked,
        {
          effectivePhoneRegion:
            settings.phoneRegionOverride ?? getDeviceRegion(),
          now: localDateTime(),
        },
        { navigate: (route, params) => navigation.navigate(route, params) },
      );
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
        pointerEvents="auto"
        style={[styles.scrim, scrimStyle]}
      />
      <AnimatedPressable
        onPress={() => void importContacts()}
        disabled={busy}
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
        onPress={() => setExpanded(expanded.value === 0)}
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
