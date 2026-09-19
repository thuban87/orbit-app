import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText } from "@/components/ui";
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
import { useTheme } from "@/theme";
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

interface SettingsInteractionsScreenProps {
  onBack: () => void;
}

/**
 * Interactions category screen (D-09). Surfaces the Compose default message mode
 * (D-04a), the dashboard right-swipe action (D-04c), and the default interaction
 * channel (§F) — each writing its existing `app_settings` column through the
 * generic `updateAppSettings` / `persist()` path (they have no specialized
 * writer) — plus the migrated Interaction Assist toggle, which writes through
 * its CANONICAL specialized writer `setInteractionAssistEnabled` + banner refresh
 * (D-10 / ADR-070), NEVER the generic path.
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
export function SettingsInteractionsScreen({
  onBack,
}: SettingsInteractionsScreenProps) {
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
      Alert.alert("Couldn't update Interaction Assist", "Please try again.");
    }
  }, []);

  const renderChipSection = <T,>(
    testID: string,
    title: string,
    caption: string,
    options: ReadonlyArray<InteractionOption<T>>,
    selectedValue: T | undefined,
  ) => (
    <View testID={testID} style={styles.section}>
      <AppText
        accessibilityRole="header"
        role="heading"
        style={{ color: colors.textPrimary }}
      >
        {title}
      </AppText>
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={styles.backLink}
        >
          <AppText role="caption" style={{ color: colors.accent }}>
            Back
          </AppText>
        </Pressable>

        {renderChipSection(
          "settings-message-mode-section",
          "Default message mode",
          "Which channel Compose opens with when you start a message.",
          MESSAGE_MODE_OPTIONS,
          settings?.defaultMessageMode,
        )}

        {renderChipSection(
          "settings-right-swipe-section",
          "Dashboard right swipe",
          "What a right swipe on a dashboard card does.",
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

        <View
          testID="settings-interaction-assist-section"
          style={styles.section}
        >
          <View style={styles.toggleRow}>
            <AppText
              accessibilityRole="header"
              role="heading"
              style={{ color: colors.textPrimary }}
            >
              Interaction Assist
            </AppText>
            <Switch
              testID="settings-interaction-assist"
              accessibilityRole="switch"
              accessibilityLabel="Interaction Assist"
              accessibilityState={{
                checked: settings?.interactionAssistEnabled === 1,
                disabled: settings === null,
              }}
              disabled={settings === null}
              value={settings?.interactionAssistEnabled === 1}
              onValueChange={(value) => void onToggleInteractionAssist(value)}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surfaceElevated}
            />
          </View>
          <AppText role="caption" style={{ color: colors.textSecondary }}>
            Ask me to log calls, texts and emails started from Orbit.
          </AppText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: SPACING.base,
    gap: SPACING.md,
  },
  backLink: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
  },
  section: {
    gap: SPACING.md,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
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
    borderRadius: 10,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
  },
});
