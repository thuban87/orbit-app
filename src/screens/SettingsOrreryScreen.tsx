// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.

import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ShellAppBar } from "@/components/ShellAppBar";
import {
  AppText,
  OrbitSwitch,
  SettingsRow,
  SettingsSectionCard,
} from "@/components/ui";
import { ORRERY_DENSITIES, type OrreryDensity } from "@/db/app-settings-dao";
import { getExecutor } from "@/db/database";
import type { RootStackParamList } from "@/navigation/types";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { useOrreryPreferencesStore } from "@/stores/orrery-preferences-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";

const DENSITY_LABELS: Record<OrreryDensity, string> = {
  spacious: "Spacious",
  balanced: "Balanced",
  compact: "Compact",
};

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
 * Layout (38.12 D-119): `SettingsSectionCard`s holding `SettingsRow`s — the
 * density radios sit under their row, the satellites switch is its row's
 * trailing control, and Systems is a chevron row.
 *
 * Back is the `ShellAppBar` header Back only (RG-037 ui-accessibility/
 * AUD-UIA-016, D-15): no duplicate in-body Back.
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
export function SettingsOrreryScreen() {
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
  // The switch is disabled (and so drawn Off, D-26) only while the store has
  // never hydrated. While a read or a save is in flight it keeps showing the
  // stored value and is announced busy (D-47 `busy`); presses are ignored
  // (38.9 review WR-02).
  const switchDisabled = !preferences.hydrated;
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
        {/* Display — density + Relationship Satellites, bound to the canonical
            useOrreryPreferencesStore (committed for read; save for write). */}
        <SettingsSectionCard
          testID="settings-orrery-display-section"
          title="Display"
        >
          <SettingsRow
            title="Density"
            subtitle="How much space the orrery gives each contact."
          >
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
                  <AppText role="label" style={{ color: colors.textPrimary }}>
                    {DENSITY_LABELS[density]}
                    {selected ? " — Selected" : ""}
                  </AppText>
                </Pressable>
              );
            })}
          </SettingsRow>

          <SettingsRow
            title="Relationship Satellites"
            subtitle="Show unlinked people around their contact."
            trailing={
              <OrbitSwitch
                testID="settings-orrery-satellites"
                accessibilityLabel="Relationship Satellites"
                disabled={switchDisabled}
                busy={busy}
                value={preferences.committed.satellitesEnabled === 1}
                onValueChange={(enabled) => {
                  if (busy) return;
                  void preferences.save(getExecutor(), {
                    satellitesEnabled: enabled ? 1 : 0,
                  });
                }}
              />
            }
          />
        </SettingsSectionCard>

        {busy ? (
          <AppText
            role="caption"
            testID="settings-orrery-busy"
            accessibilityLiveRegion="polite"
            style={{ color: colors.textSecondary }}
          >
            {preferences.saving
              ? "Saving orrery preferences…"
              : "Loading orrery preferences…"}
          </AppText>
        ) : null}

        {showError ? (
          <View
            testID="settings-orrery-error"
            style={[
              styles.errorBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <AppText
              role="caption"
              accessibilityRole="alert"
              style={{ color: colors.danger }}
            >
              {preferences.hydration === "error"
                ? "Couldn't load orrery preferences."
                : "Couldn't save your change."}{" "}
              Please try again.
            </AppText>
            <Pressable
              testID="settings-orrery-retry"
              accessibilityRole="button"
              accessibilityLabel="Retry orrery preferences"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => void preferences.retry(getExecutor())}
              style={[styles.inlineButton, { borderColor: colors.border }]}
            >
              <AppText role="label" style={{ color: colors.textPrimary }}>
                Retry
              </AppText>
            </Pressable>
          </View>
        ) : null}

        {/* Systems — routes to the canonical Systems Management screen (reuse by
            navigation; also reachable from the Orrery, §H). */}
        <SettingsSectionCard
          testID="settings-orrery-systems-section"
          title="Systems"
        >
          <SettingsRow
            testID="settings-orrery-systems"
            accessibilityLabel="Systems"
            title="Systems"
            subtitle="Manage the built-in and custom groups your orrery can show."
            onPress={() => navigation.navigate("SystemsManagement")}
          />
        </SettingsSectionCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: SPACING.base,
    gap: SPACING.lg,
  },
  densityOption: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: RADII.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  errorBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADII.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  inlineButton: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: RADII.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    alignSelf: "flex-start",
  },
});
