import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ShellAppBar } from "@/components/ShellAppBar";
import {
  AppText,
  OrbitSwitch,
  SettingsRow,
  SettingsSectionCard,
} from "@/components/ui";
import {
  type AppSettings,
  type AppSettingsPatch,
  getAppSettings,
  setInteractionAssistEnabled,
  updateAppSettings,
} from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { reconcileDigestSchedule } from "@/services/notifications/digest-schedule";
import { reconcileSchedule } from "@/services/notifications/notification-schedule";
import { useAssistBanner } from "@/stores/assist-store";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";
import {
  DEFAULT_CHANNEL_OPTIONS,
  type InteractionOption,
  MESSAGE_MODE_OPTIONS,
  persistInteractionAssistEnabled,
  RIGHT_SWIPE_OPTIONS,
  YOUR_WEEK_PERIOD_OPTIONS,
} from "./settings-interactions-logic";

const LOG_SCOPE = "settings-interactions-screen";

/**
 * Interactions category screen (D-09). Surfaces the Compose default message mode
 * (D-04a), the dashboard right-swipe action (D-04c), and the default interaction
 * channel (§F) — each writing its existing `app_settings` column through the
 * generic `updateAppSettings` / `persist()` path (they have no specialized
 * writer) — plus the migrated Interaction Assist toggle, which writes through
 * its CANONICAL specialized writer `setInteractionAssistEnabled` + banner refresh
 * (D-10 / ADR-070), NEVER the generic path.
 *
 * Layout (38.12 D-119): each setting is a `SettingsSectionCard`; the chip
 * groups stay chip groups inside their card (they are not rows), and the
 * Interaction Assist toggle is a `SettingsRow` with the switch as its trailing
 * control.
 *
 * Back is the `ShellAppBar` header Back only (RG-037 ui-accessibility/
 * AUD-UIA-016, D-15): no duplicate in-body Back.
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
export function SettingsInteractionsScreen() {
  const { colors } = useTheme();
  const bottomClearance = useBottomClearance();
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const reload = useCallback(async () => {
    try {
      setSettings(await getAppSettings(getExecutor()));
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load interaction settings", err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  // Generic settings write: persist a patch then fire-and-forget a reconcile so
  // the OS schedule re-arms immediately. Copied verbatim from SettingsScreen's
  // persist() (both reconcilers are idempotent + defer-one guarded). Used for
  // message mode / right-swipe / default channel — NOT the assist toggle. Never
  // inline SQL — every write routes through the DAO.
  const persist = useCallback(async (patch: AppSettingsPatch) => {
    const exec = getExecutor();
    try {
      await updateAppSettings(exec, patch, localDateTime());
      const next = await getAppSettings(exec);
      setSettings(next);
      void reconcileSchedule(exec);
      void reconcileDigestSchedule(exec);
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to persist interaction setting", err);
    }
  }, []);

  // Interaction Assist (D-10 / ADR-070): route through the CANONICAL specialized
  // writer (atomic pending-queue expiry on opt-out) + banner refresh, NEVER the
  // generic persist above. Mirrors SettingsScreen.tsx:596-606.
  const onToggleInteractionAssist = useCallback(async (on: boolean) => {
    const exec = getExecutor();
    try {
      const next = await persistInteractionAssistEnabled(exec, on ? 1 : 0, {
        setInteractionAssistEnabled,
        getAppSettings,
        refreshBanner: () => useAssistBanner.getState().refresh(),
        now: localDateTime,
      });
      setSettings(next);
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to update Interaction Assist", error);
      showSnackbar({
        kind: "error",
        label: "Couldn't update Interaction Assist. Please try again.",
      });
    }
  }, []);

  const renderChipSection = <T,>(
    testID: string,
    title: string,
    caption: string,
    options: ReadonlyArray<InteractionOption<T>>,
    selectedValue: T | undefined,
  ) => (
    <SettingsSectionCard testID={testID} title={title}>
      <View style={styles.chipGroup}>
        <AppText role="caption" style={{ color: colors.textSecondary }}>
          {caption}
        </AppText>
        <View style={styles.chipRow}>
          {options.map((option) => {
            const selected = selectedValue === option.value;
            return (
              <Pressable
                key={String(option.value)}
                testID={`${testID}-${String(option.value)}`}
                accessibilityRole="button"
                accessibilityLabel={`${title} ${option.label}`}
                accessibilityState={{ selected, disabled: settings === null }}
                disabled={settings === null}
                onPress={() => void persist(option.patch)}
                style={[
                  styles.chip,
                  {
                    borderColor: selected ? colors.accent : colors.border,
                    backgroundColor: selected ? colors.accent : colors.surface,
                  },
                ]}
              >
                {/* biome-ignore lint/a11y/useValidAriaRole: AppText role is a typography role. */}
                <AppText
                  role="body"
                  style={{
                    color: selected ? colors.onAccent : colors.textPrimary,
                  }}
                >
                  {option.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SettingsSectionCard>
  );

  return (
    <View style={styles.root}>
      <ShellAppBar variant="child" title="Interactions" />
      <ScrollView
        testID="settings-interactions-screen"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomClearance },
        ]}
      >
        {renderChipSection(
          "settings-message-mode-section",
          "Default message mode",
          "Which channel Compose opens with when you start a message.",
          MESSAGE_MODE_OPTIONS,
          settings?.defaultMessageMode,
        )}

        {renderChipSection(
          "settings-right-swipe-section",
          "Contacts right swipe",
          "What a right swipe on a contact card does.",
          RIGHT_SWIPE_OPTIONS,
          settings?.dashboardRightSwipeAction,
        )}

        {renderChipSection(
          "settings-default-channel-section",
          "Default interaction channel",
          "The channel a new interaction defaults to.",
          DEFAULT_CHANNEL_OPTIONS,
          settings?.defaultInteractionChannel,
        )}

        {renderChipSection(
          "settings-your-week-period-section",
          "Your Week period",
          "The period used by the Digest retrospective.",
          YOUR_WEEK_PERIOD_OPTIONS,
          settings?.yourWeekPeriod,
        )}

        <SettingsSectionCard testID="settings-interaction-assist-section">
          <SettingsRow
            title="Interaction Assist"
            subtitle="Ask me to log calls, texts and emails started from Orbit."
            trailing={
              <OrbitSwitch
                testID="settings-interaction-assist"
                accessibilityLabel="Interaction Assist"
                disabled={settings === null}
                value={settings?.interactionAssistEnabled === 1}
                onValueChange={(value) => void onToggleInteractionAssist(value)}
              />
            }
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
  chipGroup: {
    gap: SPACING.md,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: RADII.md,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
  },
});
