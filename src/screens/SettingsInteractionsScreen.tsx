import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText } from "@/components/ui";
import {
  type AppSettings,
  type AppSettingsPatch,
  getAppSettings,
  updateAppSettings,
} from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { reconcileDigestSchedule } from "@/services/notifications/digest-schedule";
import { reconcileSchedule } from "@/services/notifications/notification-schedule";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import { MESSAGE_MODE_OPTIONS } from "./settings-interactions-logic";

const LOG_SCOPE = "settings-interactions-screen";

interface SettingsInteractionsScreenProps {
  onBack: () => void;
}

/**
 * Interactions category screen — the far end of the Phase 37 tracer's vertical
 * slice (D-09). Ships the Compose default message mode selector (D-04a) writing
 * a real `app_settings` value that round-trips through the DAO. Task 2 expands
 * this with the dashboard right-swipe action (D-04c), the default interaction
 * channel (§F), and the migrated Interaction Assist toggle (D-10 / ADR-070).
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

  // Persist a patch to app_settings then fire-and-forget a reconcile so the OS
  // schedule re-arms immediately. Copied verbatim from SettingsScreen.tsx's
  // persist() (the notification/digest reconcilers are idempotent + defer-one
  // guarded, so running them on every settings write is harmless). Never inline
  // SQL — every write routes through the DAO.
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
          style={[styles.backLink]}
        >
          <AppText role="caption" style={{ color: colors.accent }}>
            Back
          </AppText>
        </Pressable>

        <View testID="settings-message-mode-section" style={styles.section}>
          <AppText
            accessibilityRole="header"
            role="heading"
            style={{ color: colors.textPrimary }}
          >
            Default message mode
          </AppText>
          <AppText role="caption" style={{ color: colors.textSecondary }}>
            Which channel Compose opens with when you start a message.
          </AppText>
          <View style={styles.chipRow}>
            {MESSAGE_MODE_OPTIONS.map((option) => {
              const selected = settings?.defaultMessageMode === option.value;
              return (
                <Pressable
                  key={option.value}
                  testID={`settings-message-mode-${option.value}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Default message mode ${option.label}`}
                  accessibilityState={{
                    selected,
                    disabled: settings === null,
                  }}
                  disabled={settings === null}
                  onPress={() => void persist(option.patch)}
                  style={[
                    styles.chip,
                    {
                      borderColor: selected ? colors.accent : colors.border,
                      backgroundColor: selected
                        ? colors.accent
                        : colors.surface,
                    },
                  ]}
                >
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
  section: {
    gap: 12,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});
