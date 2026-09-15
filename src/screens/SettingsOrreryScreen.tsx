import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { ShellAppBar } from "@/components/ShellAppBar";
import { ORRERY_DENSITIES, type OrreryDensity } from "@/db/app-settings-dao";
import { getExecutor } from "@/db/database";
import type { RootStackParamList } from "@/navigation/types";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { useOrreryPreferencesStore } from "@/stores/orrery-preferences-store";
import { useTheme } from "@/theme";

const DENSITY_LABELS: Record<OrreryDensity, string> = {
  spacious: "Spacious",
  balanced: "Balanced",
  compact: "Compact",
};

interface SettingsOrreryScreenProps {
  onBack: () => void;
}

/**
 * Orrery category screen (§H / D-09). Surfaces the stateless user-configurable
 * Orrery Display preferences — density + Relationship Satellites — bound to the
 * CANONICAL shared preference source, the `useOrreryPreferencesStore` Zustand
 * store, EXACTLY as `OrreryViewOptions` does: read from `committed`, write via
 * `save()`, hydrate on focus, surface `saving`/`saveError`/`hydration` + retry.
 * This is the store whose single serialized `save()` writes SQLite and publishes
 * `committed`; both this screen and the Orrery render the same `committed`, so a
 * change here and a change on the Orrery agree immediately (§H — no duplicate
 * preference model). Settings NEVER writes `orrery_density`/
 * `orrery_satellites_enabled` directly via `updateAppSettings` (review HIGH: a
 * second unsynchronized writer is forbidden) and NEVER writes `lastSystem`
 * (§C/§H — session state, not a Setting).
 *
 * A Systems section routes to the canonical `SystemsManagement` screen (reuse by
 * navigation; it stays reachable from the Orrery too, per §H).
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
export function SettingsOrreryScreen({ onBack }: SettingsOrreryScreenProps) {
  const { colors } = useTheme();
  const bottomClearance = useBottomClearance();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const preferences = useOrreryPreferencesStore();
  const hydrate = useOrreryPreferencesStore((s) => s.hydrate);

  // Hydrate the shared store fresh on focus so the controls are ready before
  // edits and reflect any change made on the Orrery while Settings was away
  // (mirrors OrreryScreen's hydrate-on-focus). `hydrate` is a no-op while a read
  // is already in flight (generation-guarded), so this cannot clobber a save.
  // `hydrate` has stable Zustand-action identity, so the effect runs on focus
  // only — not on every committed change.
  useFocusEffect(
    useCallback(() => {
      void hydrate(getExecutor());
    }, [hydrate]),
  );

  const busy = preferences.hydration === "loading" || preferences.saving;
  const disabled = busy || !preferences.hydrated;
  const showError = preferences.hydration === "error" || preferences.saveError;

  return (
    <View style={styles.root}>
      <ShellAppBar variant="child" title="Orrery" />
      <ScrollView
        testID="settings-orrery-screen"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomClearance },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={styles.backLink}
        >
          <Text style={[styles.backLinkText, { color: colors.accent }]}>
            Back
          </Text>
        </Pressable>

        {/* Display — density + Relationship Satellites, bound to the canonical
            useOrreryPreferencesStore (committed for read; save for write). */}
        <View testID="settings-orrery-display-section" style={styles.section}>
          <Text
            accessibilityRole="header"
            style={[styles.sectionHeading, { color: colors.textSecondary }]}
          >
            Display
          </Text>

          <View
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
              Density
            </Text>
            <Text style={[styles.helper, { color: colors.textSecondary }]}>
              How much space the orrery gives each contact.
            </Text>
            {ORRERY_DENSITIES.map((density) => {
              const selected = preferences.committed.density === density;
              return (
                <Pressable
                  key={density}
                  testID={`settings-orrery-density-${density}`}
                  accessibilityRole="radio"
                  accessibilityLabel={DENSITY_LABELS[density]}
                  accessibilityState={{ checked: selected, disabled, busy }}
                  disabled={disabled}
                  onPress={() =>
                    void preferences.save(getExecutor(), { density })
                  }
                  style={[
                    styles.densityOption,
                    {
                      borderColor: selected ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.rowLabel, { color: colors.textPrimary }]}
                  >
                    {DENSITY_LABELS[density]}
                    {selected ? " — Selected" : ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.toggleRow}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
                Relationship Satellites
              </Text>
              <Switch
                testID="settings-orrery-satellites"
                accessibilityRole="switch"
                accessibilityLabel="Relationship Satellites"
                accessibilityState={{
                  checked: preferences.committed.satellitesEnabled === 1,
                  disabled,
                  busy,
                }}
                disabled={disabled}
                value={preferences.committed.satellitesEnabled === 1}
                onValueChange={(enabled) =>
                  void preferences.save(getExecutor(), {
                    satellitesEnabled: enabled ? 1 : 0,
                  })
                }
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.surfaceElevated}
              />
            </View>
            <Text style={[styles.helper, { color: colors.textSecondary }]}>
              Show unlinked people around their contact.
            </Text>
          </View>

          {busy ? (
            <Text
              testID="settings-orrery-busy"
              accessibilityLiveRegion="polite"
              style={[styles.helper, { color: colors.textSecondary }]}
            >
              {preferences.saving
                ? "Saving orrery preferences…"
                : "Loading orrery preferences…"}
            </Text>
          ) : null}

          {showError ? (
            <View
              testID="settings-orrery-error"
              style={[
                styles.row,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text
                accessibilityRole="alert"
                style={[styles.helper, { color: colors.danger }]}
              >
                {preferences.hydration === "error"
                  ? "Couldn't load orrery preferences."
                  : "Couldn't save your change."}{" "}
                Please try again.
              </Text>
              <Pressable
                testID="settings-orrery-retry"
                accessibilityRole="button"
                accessibilityLabel="Retry orrery preferences"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={() => void preferences.retry(getExecutor())}
                style={[styles.inlineButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
                  Retry
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Systems — routes to the canonical Systems Management screen (reuse by
            navigation; also reachable from the Orrery, §H). */}
        <View testID="settings-orrery-systems-section" style={styles.section}>
          <Text
            accessibilityRole="header"
            style={[styles.sectionHeading, { color: colors.textSecondary }]}
          >
            Systems
          </Text>
          <Pressable
            testID="settings-orrery-systems"
            accessibilityRole="button"
            accessibilityLabel="Systems"
            onPress={() => navigation.navigate("SystemsManagement")}
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
              Systems
            </Text>
            <Text style={[styles.helper, { color: colors.textSecondary }]}>
              Manage the built-in and custom groups your orrery can show.
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: 16,
    gap: 12,
  },
  backLink: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
  },
  backLinkText: {
    fontSize: 13,
    fontWeight: "400",
  },
  section: {
    gap: 12,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  densityOption: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  helper: {
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
  },
  inlineButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: "flex-start",
  },
});
