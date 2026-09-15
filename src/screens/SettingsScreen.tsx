import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { File, Paths } from "expo-file-system";
import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { requestPinWidget } from "react-native-android-widget";
import { loadCachedOpenRouterCatalog } from "@/ai/openrouter-catalog";
import { AIFirstUseDisclosure } from "@/components/AIFirstUseDisclosure";
import { ShellAppBar } from "@/components/ShellAppBar";
import { resolveActiveAiConnection } from "@/db/ai-connections-dao";
import {
  type AppSettings,
  type AppSettingsPatch,
  getAppSettings,
  updateAppSettings,
} from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { readCredentialPresence } from "@/logic/ai-availability";
import type { RootStackParamList } from "@/navigation/types";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { aiKeyStore } from "@/services/ai-key-store";
import { reconcileDigestSchedule } from "@/services/notifications/digest-schedule";
import { reconcileSchedule } from "@/services/notifications/notification-schedule";
import {
  getNotificationPermission,
  requestNotificationPermission,
} from "@/services/notifications/permission";
import { useAiConfigStore } from "@/stores/ai-config-store";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import { pinResultCopy } from "./settings-add-widget";
import {
  computeAiHubAvailability,
  deriveAiHubState,
} from "./settings-ai-hub-logic";

const LOG_SCOPE = "settings-screen";

/** Which time control's native picker is open (null = none). */
type ActivePicker = "delivery" | "quiet-start" | "quiet-end" | null;

/** Format a 0-23 hour as a "h:MM AM/PM" wall-clock label (e.g. 9 → "9:00 AM"). */
function formatHour(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:00 ${period}`;
}

/** A Date seeded to today at the given 0-23 hour — the time picker's initial value. */
function seedForHour(hour: number): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d;
}

/**
 * SettingsScreen — the transitional `SettingsMore` monolith (Phase 37, D-09).
 * Category groups migrate out into dedicated hub sub-routes plan by plan; Plan 08
 * removes this screen once every group has a home. Currently hosts the Phase-11
 * Notifications section, the AI hub, the "Add Orbit widget" utility, and the
 * Systems row.
 *
 * The Notifications section (NOTIF-05): the master toggle IS the value-moment
 * `POST_NOTIFICATIONS` affordance, the decay/birthday/lock-screen toggles gate
 * scheduling, and the owner's user-tunable delivery hour + quiet window get their
 * tappable time controls. Every control reads/writes `app_settings` via the DAO
 * and fires `reconcileSchedule` after a change so the OS's scheduled set updates
 * immediately (no wait for next launch).
 *
 * Migrated OUT of this monolith:
 * - Appearance / Theme + owner-profile + Orbit Appearance → SettingsAppearance (Plans 02–03).
 * - Interaction Assist + interaction defaults → SettingsInteractions (Plan 01).
 * - Contact methods (phone region, reconcile, review-flagged), Contacts Integration
 *   (import), Custom Fields, and Archived → SettingsContacts (Plan 04, §E).
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
export function SettingsScreen() {
  const { colors } = useTheme();
  const bottomClearance = useBottomClearance();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Notification settings mirror app_settings; permission is READ FRESH on focus
  // (OS-owned, revocable between opens). `degraded` renders the non-nagging note
  // when the master is on but the OS permission is denied — text only, never a
  // re-prompt (orchestrator pick 6 / T-11-PERM).
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);

  // The "Add Orbit widget" fallback copy — null while there is nothing to show,
  // set to the UI-SPEC fallback string when requestPinWidget can't pin (unsupported
  // launcher / API < 26 / a rejected request). Surfaced inline under the row.
  const [addWidgetCopy, setAddWidgetCopy] = useState<string | null>(null);

  const aiEnabled = useAiConfigStore((state) => state.aiEnabled);
  const activeAiConnection = useAiConfigStore(
    (state) => state.activeConnection,
  );
  const aiHydrated = useAiConfigStore((state) => state.hydrated);
  const hydrateAiConfig = useAiConfigStore((state) => state.hydrate);
  const setAiEnabled = useAiConfigStore((state) => state.setAiEnabled);
  const [aiHubError, setAiHubError] = useState<string | null>(null);
  const [aiAvailability, setAiAvailability] = useState<
    "off" | "ready" | "needs-attention"
  >("off");
  const aiHubState = deriveAiHubState(aiEnabled, aiAvailability);

  // Load app_settings + the current OS permission status. If the master is on but
  // the OS later revoked permission (out-of-app), surface the degraded note so the
  // user understands why nothing fires — still no re-prompt.
  const reloadNotifications = useCallback(async () => {
    try {
      const next = await getAppSettings(getExecutor());
      setSettings(next);
      if (next.notificationsEnabled === 1) {
        const perm = await getNotificationPermission();
        setDegraded(!perm.granted);
      } else {
        setDegraded(false);
      }
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load notification settings", err);
    }
  }, []);

  const reloadAiAvailability = useCallback(async () => {
    const exec = getExecutor();
    await hydrateAiConfig(exec);
    const config = useAiConfigStore.getState();
    const connection = await resolveActiveAiConnection(exec);
    const hasCredential = await readCredentialPresence(
      connection?.lane ?? "none",
      (lane) =>
        aiKeyStore.getKey(
          lane,
          lane === "custom" ? connection?.customEndpoint : undefined,
        ),
    );
    const openRouterCatalog =
      connection?.lane === "openrouter"
        ? await loadCachedOpenRouterCatalog({
            async read() {
              const file = new File(
                Paths.document,
                "ai",
                "openrouter-model-catalog.json",
              );
              return file.exists ? file.text() : null;
            },
            async write() {
              // Settings hub reads the model cache; picker owns refresh writes.
            },
          })
        : null;
    setAiAvailability(
      computeAiHubAvailability({
        aiEnabled: config.aiEnabled,
        activeConnection: connection,
        hasCredential,
        openRouterModels: openRouterCatalog?.models ?? [],
      }),
    );
  }, [hydrateAiConfig]);

  useFocusEffect(
    useCallback(() => {
      void reloadNotifications();
      void reloadAiAvailability().catch((error) => {
        Logger.error(LOG_SCOPE, "failed to load AI configuration", error);
        setAiHubError("Couldn't load AI settings. Please try again.");
      });
    }, [reloadAiAvailability, reloadNotifications]),
  );

  // Persist a patch to app_settings then fire-and-forget a reconcile so the OS
  // schedule re-arms immediately (the self-coordinating reconcile coalesces
  // concurrent calls). Local state is refreshed from the write's return read.
  const persist = useCallback(async (patch: AppSettingsPatch) => {
    const exec = getExecutor();
    try {
      await updateAppSettings(exec, patch, localDateTime());
      const next = await getAppSettings(exec);
      setSettings(next);
      void reconcileSchedule(exec);
      // Fold the digest reconcile into the SHARED post-write path (review H1 /
      // Pitfall 7): master ON/OFF, the delivery-hour picker, AND the digest
      // toggle all route through `persist`, so every write that can affect the
      // WEEKLY trigger arms/cancels/re-times it synchronously — not only the
      // digest Switch, and not only at next launch. reconcileDigestSchedule
      // re-reads settings fresh, is idempotent, and is defer-one guarded, so
      // running it on every settings write is harmless (a quiet-window-only
      // change reconciles to "matching -> leave").
      void reconcileDigestSchedule(exec);
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to persist notification setting", err);
    }
  }, []);

  const masterOn = settings?.notificationsEnabled === 1;

  // Master toggle = the value-moment permission affordance. Flipping ON requests
  // POST_NOTIFICATIONS at that moment: granted → persist enabled + reconcile;
  // denied → keep master off and show the degraded note once (no re-prompt).
  const onToggleMaster = useCallback(
    async (on: boolean) => {
      if (on) {
        const result = await requestNotificationPermission();
        if (result.granted) {
          setDegraded(false);
          await persist({ notificationsEnabled: 1 });
        } else {
          // Denial reverts master to off (never persisted on) + degraded note.
          setDegraded(true);
        }
      } else {
        setDegraded(false);
        await persist({ notificationsEnabled: 0 });
      }
    },
    [persist],
  );

  // Time-picker pick handler. Extract the chosen hour (0-23) and persist it to the
  // field the open row owns — the DAO re-validates the 0-23 bound (T-11-05) — then
  // reconcile. Android dismiss/cancel (event.type !== "set") keeps the prior value.
  const onPickTime = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      const which = activePicker;
      setActivePicker(null);
      if (event.type !== "set" || !date || which === null) {
        return;
      }
      const hour = date.getHours();
      const field: AppSettingsPatch =
        which === "delivery"
          ? { deliveryHour: hour }
          : which === "quiet-start"
            ? { quietStartHour: hour }
            : { quietEndHour: hour };
      void persist(field);
    },
    [activePicker, persist],
  );

  const pickerSeedHour =
    activePicker === "delivery"
      ? (settings?.deliveryHour ?? 9)
      : activePicker === "quiet-start"
        ? (settings?.quietStartHour ?? 21)
        : (settings?.quietEndHour ?? 8);

  // "Add Orbit widget": open the launcher's native pin prompt. requestPinWidget
  // resolves false on an unsupported launcher / API < 26; a REJECTED promise is
  // caught and mapped to false so it is treated identically (no crash, no dead
  // button, no unhandled rejection — Codex MED). The pure pinResultCopy decides
  // the copy: null (accepted → nothing to show) or the verbatim fallback string.
  // The live pin prompt is a device-UAT (12-08); the provider must be prebuilt for
  // the name to resolve (Assumption A5).
  const onAddWidget = useCallback(async () => {
    let accepted = false;
    try {
      accepted = await requestPinWidget({ widgetName: "OrbitFavourites" });
    } catch (err) {
      Logger.error(LOG_SCOPE, "requestPinWidget rejected", err);
      accepted = false;
    }
    setAddWidgetCopy(pinResultCopy(accepted));
  }, []);

  const onToggleAi = useCallback(
    async (enabled: boolean) => {
      setAiHubError(null);
      try {
        await setAiEnabled(getExecutor(), enabled);
        await reloadAiAvailability();
      } catch (error) {
        Logger.error(LOG_SCOPE, "failed to update AI master state", error);
        setAiHubError("Couldn't update AI settings. Please try again.");
      }
    },
    [reloadAiAvailability, setAiEnabled],
  );

  return (
    <ScrollView
      testID="settings-screen"
      contentContainerStyle={[
        styles.content,
        { paddingBottom: bottomClearance },
      ]}
    >
      <ShellAppBar variant="root" title="Settings" />

      {/* The "Include unbound in Not yet contacted" toggle is retired with the
          standalone Never Contacted screen (DASHQ-03). Only the UI row is removed
          here: the `include_unbound_never_contacted` app_settings column and its
          `PORTABLE_SETTINGS_KEYS` entry are intentionally KEPT — their removal is
          coordinated with the Phase 36 backup format bump (D-05), never dropped
          unilaterally. */}

      <View testID="settings-notifications-section" style={styles.section}>
        <Text
          accessibilityRole="header"
          style={[styles.sectionHeading, { color: colors.textSecondary }]}
        >
          Notifications
        </Text>

        {/* Master toggle — the value-moment permission affordance. */}
        <View
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.toggleRow}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
              Allow notifications
            </Text>
            <Switch
              testID="settings-notifications-master"
              accessibilityRole="switch"
              accessibilityLabel="Allow notifications"
              accessibilityState={{ checked: masterOn }}
              value={masterOn}
              onValueChange={(v) => void onToggleMaster(v)}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surfaceElevated}
            />
          </View>
          {!masterOn ? (
            <Text style={[styles.helper, { color: colors.textSecondary }]}>
              Get a calm morning reminder when someone's overdue, and a heads-up
              on birthdays.
            </Text>
          ) : null}
        </View>

        {degraded ? (
          <View
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              testID="settings-notifications-degraded"
              style={[styles.degradedHeading, { color: colors.textPrimary }]}
            >
              Notifications are off
            </Text>
            <Text style={[styles.helper, { color: colors.textSecondary }]}>
              Orbit's dashboard still shows who's due. To get reminders, turn
              notifications on in your phone's settings.
            </Text>
          </View>
        ) : null}

        {/* Decay reminders — gated by master. */}
        <View
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.toggleRow}>
            <Text
              style={[
                styles.rowLabel,
                { color: masterOn ? colors.textPrimary : colors.textSecondary },
              ]}
            >
              Decay reminders
            </Text>
            <Switch
              testID="settings-notifications-decay"
              accessibilityRole="switch"
              accessibilityLabel="Decay reminders"
              accessibilityState={{
                disabled: !masterOn,
                checked: settings?.decayEnabled === 1,
              }}
              disabled={!masterOn}
              value={settings?.decayEnabled === 1}
              onValueChange={(v) => void persist({ decayEnabled: v ? 1 : 0 })}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surfaceElevated}
            />
          </View>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>
            Reminders to reach out to people you're overdue with.
          </Text>
        </View>

        {/* Birthday alerts — gated by master. */}
        <View
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.toggleRow}>
            <Text
              style={[
                styles.rowLabel,
                { color: masterOn ? colors.textPrimary : colors.textSecondary },
              ]}
            >
              Birthday alerts
            </Text>
            <Switch
              testID="settings-notifications-birthday"
              accessibilityRole="switch"
              accessibilityLabel="Birthday alerts"
              accessibilityState={{
                disabled: !masterOn,
                checked: settings?.birthdayEnabled === 1,
              }}
              disabled={!masterOn}
              value={settings?.birthdayEnabled === 1}
              onValueChange={(v) =>
                void persist({ birthdayEnabled: v ? 1 : 0 })
              }
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surfaceElevated}
            />
          </View>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>
            A morning nudge on a contact's birthday.
          </Text>
        </View>

        <View
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.toggleRow}>
            <Text
              style={[
                styles.rowLabel,
                { color: masterOn ? colors.textPrimary : colors.textSecondary },
              ]}
            >
              Birthday alerts for unbound contacts
            </Text>
            <Switch
              testID="settings-notifications-birthday-unbound"
              accessibilityRole="switch"
              accessibilityLabel="Birthday alerts for unbound contacts"
              accessibilityState={{
                disabled: !masterOn,
                checked: settings?.birthdayUnboundEnabled === 1,
              }}
              disabled={!masterOn}
              value={settings?.birthdayUnboundEnabled === 1}
              onValueChange={(value) =>
                void persist({ birthdayUnboundEnabled: value ? 1 : 0 })
              }
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surfaceElevated}
            />
          </View>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>
            Keep birthday reminders on for contacts outside your active orbit.
          </Text>
        </View>

        {/* Weekly digest — gated by master. Persists + reconciles the WEEKLY
            trigger through the shared persist path (review H1). */}
        <View
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.toggleRow}>
            <Text
              style={[
                styles.rowLabel,
                { color: masterOn ? colors.textPrimary : colors.textSecondary },
              ]}
            >
              Weekly digest
            </Text>
            <Switch
              testID="settings-notifications-digest"
              accessibilityRole="switch"
              accessibilityLabel="Weekly digest"
              accessibilityState={{
                disabled: !masterOn,
                checked: settings?.digestEnabled === 1,
              }}
              disabled={!masterOn}
              value={settings?.digestEnabled === 1}
              onValueChange={(v) => void persist({ digestEnabled: v ? 1 : 0 })}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surfaceElevated}
            />
          </View>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>
            A Sunday-morning look back at your week — who you reached, and who's
            slipping quietly.
          </Text>
        </View>

        {/* Lock-screen visibility — default off (private). */}
        <View
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.toggleRow}>
            <Text
              style={[
                styles.rowLabel,
                { color: masterOn ? colors.textPrimary : colors.textSecondary },
              ]}
            >
              Show names on lock screen
            </Text>
            <Switch
              testID="settings-notifications-lockscreen"
              accessibilityRole="switch"
              accessibilityLabel="Show names on lock screen"
              accessibilityState={{
                disabled: !masterOn,
                checked: settings?.lockscreenPublic === 1,
              }}
              disabled={!masterOn}
              value={settings?.lockscreenPublic === 1}
              onValueChange={(v) =>
                void persist({ lockscreenPublic: v ? 1 : 0 })
              }
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surfaceElevated}
            />
          </View>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>
            When off, lock-screen reminders won't show who they're about.
          </Text>
        </View>

        {/* Reminder time — the user-tunable delivery hour (the reversal). */}
        <Pressable
          testID="settings-notifications-time"
          accessibilityRole="button"
          accessibilityLabel={`Reminder time, ${formatHour(settings?.deliveryHour ?? 9)}`}
          accessibilityState={{ disabled: !masterOn }}
          disabled={!masterOn}
          onPress={() => setActivePicker("delivery")}
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.toggleRow}>
            <Text
              style={[
                styles.rowLabel,
                { color: masterOn ? colors.textPrimary : colors.textSecondary },
              ]}
            >
              Reminder time
            </Text>
            <Text
              style={[
                styles.rowValue,
                { color: masterOn ? colors.accent : colors.textSecondary },
              ]}
            >
              {formatHour(settings?.deliveryHour ?? 9)}
            </Text>
          </View>
        </Pressable>

        {/* Quiet-hours start — the user-tunable quiet-window start (the reversal). */}
        <Pressable
          testID="settings-notifications-quiet-start"
          accessibilityRole="button"
          accessibilityLabel={`Quiet hours start, ${formatHour(settings?.quietStartHour ?? 21)}`}
          accessibilityState={{ disabled: !masterOn }}
          disabled={!masterOn}
          onPress={() => setActivePicker("quiet-start")}
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.toggleRow}>
            <Text
              style={[
                styles.rowLabel,
                { color: masterOn ? colors.textPrimary : colors.textSecondary },
              ]}
            >
              Quiet hours start
            </Text>
            <Text
              style={[
                styles.rowValue,
                { color: masterOn ? colors.accent : colors.textSecondary },
              ]}
            >
              {formatHour(settings?.quietStartHour ?? 21)}
            </Text>
          </View>
        </Pressable>

        {/* Quiet-hours end — the user-tunable quiet-window end (the reversal). */}
        <Pressable
          testID="settings-notifications-quiet-end"
          accessibilityRole="button"
          accessibilityLabel={`Quiet hours end, ${formatHour(settings?.quietEndHour ?? 8)}`}
          accessibilityState={{ disabled: !masterOn }}
          disabled={!masterOn}
          onPress={() => setActivePicker("quiet-end")}
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.toggleRow}>
            <Text
              style={[
                styles.rowLabel,
                { color: masterOn ? colors.textPrimary : colors.textSecondary },
              ]}
            >
              Quiet hours end
            </Text>
            <Text
              style={[
                styles.rowValue,
                { color: masterOn ? colors.accent : colors.textSecondary },
              ]}
            >
              {formatHour(settings?.quietEndHour ?? 8)}
            </Text>
          </View>
        </Pressable>
        <Text style={[styles.helper, { color: colors.textSecondary }]}>
          Reminders that would land inside quiet hours wait until the next
          morning.
        </Text>

        {activePicker !== null ? (
          <DateTimePicker
            testID="settings-notifications-time-picker"
            value={seedForHour(pickerSeedHour)}
            mode="time"
            onChange={onPickTime}
          />
        ) : null}
      </View>

      {/* AI is an optional capability. The master switch mutates only
          app_settings.ai_enabled; every connection, model, personalization
          section, and permission survives the off state. */}
      <View testID="settings-ai-section" style={styles.section}>
        <Text
          accessibilityRole="header"
          style={[styles.sectionHeading, { color: colors.textSecondary }]}
        >
          AI message suggestions
        </Text>
        <View
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.toggleRow}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
              AI Enabled
            </Text>
            <Switch
              testID="settings-ai-enabled"
              accessibilityRole="switch"
              accessibilityLabel="AI Enabled"
              accessibilityState={{ checked: aiEnabled, disabled: !aiHydrated }}
              disabled={!aiHydrated}
              value={aiEnabled}
              onValueChange={(enabled) => void onToggleAi(enabled)}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surfaceElevated}
            />
          </View>
        </View>

        {!aiHydrated ? (
          <Text
            testID="settings-ai-loading"
            style={[styles.helper, { color: colors.textSecondary }]}
          >
            Loading AI settings…
          </Text>
        ) : aiHubState.showSimplified ? (
          <View
            testID="settings-ai-off-state"
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.helper, { color: colors.textSecondary }]}>
              AI is off. Your connections, models, personalization, and
              permissions are saved and will return when you turn AI back on.
            </Text>
            <Pressable
              testID="settings-ai-manage-saved"
              accessibilityRole="button"
              accessibilityLabel="Manage saved connections"
              onPress={() => navigation.navigate("AIConnection")}
              style={[styles.aiButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
                Manage saved connections
              </Text>
            </Pressable>
          </View>
        ) : (
          <View testID="settings-ai-expanded" style={styles.section}>
            {aiHubState.sections.map((section) => (
              <Pressable
                key={section.label}
                testID={`settings-ai-entry-${section.label
                  .toLowerCase()
                  .replaceAll(" ", "-")}`}
                accessibilityRole="button"
                accessibilityLabel={section.label}
                onPress={() => {
                  switch (section.route) {
                    case "AIConnection":
                      navigation.navigate("AIConnection");
                      break;
                    case "AIModelPicker":
                      if (activeAiConnection === null) {
                        navigation.navigate("AIConnection");
                      } else {
                        navigation.navigate("AIModelPicker", {
                          lane: activeAiConnection,
                        });
                      }
                      break;
                    case "AIPersonalization":
                      navigation.navigate("AIPersonalization", section.params);
                      break;
                    case "AIPermissions":
                      navigation.navigate("AIPermissions");
                      break;
                    case "AIPreview":
                      navigation.navigate("AIPreview");
                      break;
                  }
                }}
                style={[
                  styles.row,
                  styles.aiHubRow,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  numberOfLines={2}
                  style={[
                    styles.rowLabel,
                    styles.aiHubLabel,
                    { color: colors.textPrimary },
                  ]}
                >
                  {section.label}
                </Text>
                <Text
                  accessibilityElementsHidden
                  style={[
                    styles.addWidgetChevron,
                    { color: colors.textSecondary },
                  ]}
                >
                  ›
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {aiHubError ? (
          <Text
            testID="settings-ai-error"
            accessibilityRole="alert"
            style={[styles.helper, { color: colors.danger }]}
          >
            {aiHubError}
          </Text>
        ) : null}

        <AIFirstUseDisclosure />
      </View>

      <View testID="settings-home-screen-section" style={styles.section}>
        <Text
          accessibilityRole="header"
          style={[styles.sectionHeading, { color: colors.textSecondary }]}
        >
          Home screen
        </Text>

        {/* "Add Orbit widget" — opens the launcher's native pin prompt via
            requestPinWidget, degrading to the fallback copy on an unsupported
            launcher / API < 26 / a rejected request (WDG-03). Leading widget
            glyph + trailing chevron, consistent with the other rows. */}
        <Pressable
          testID="settings-add-widget"
          accessibilityRole="button"
          accessibilityLabel="Add Orbit widget"
          onPress={() => void onAddWidget()}
          style={[
            styles.row,
            styles.addWidgetRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text
            style={[styles.addWidgetGlyph, { color: colors.textSecondary }]}
          >
            ▦
          </Text>
          <Text
            style={[
              styles.rowLabel,
              styles.addWidgetLabel,
              { color: colors.textPrimary },
            ]}
          >
            Add Orbit widget
          </Text>
          <Text
            style={[styles.addWidgetChevron, { color: colors.textSecondary }]}
          >
            ›
          </Text>
        </Pressable>

        {addWidgetCopy !== null ? (
          <Text
            testID="settings-add-widget-fallback"
            style={[styles.helper, { color: colors.textSecondary }]}
          >
            {addWidgetCopy}
          </Text>
        ) : null}
      </View>

      <Pressable
        testID="settings-systems-row"
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
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 12,
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
  addWidgetRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  addWidgetGlyph: {
    fontSize: 18,
  },
  addWidgetLabel: {
    flex: 1,
  },
  addWidgetChevron: {
    fontSize: 20,
    fontWeight: "600",
  },
  rowValue: {
    fontSize: 16,
    fontWeight: "600",
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
  degradedHeading: {
    fontSize: 16,
    fontWeight: "600",
  },
  aiButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: "flex-start",
  },
  aiHubRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  aiHubLabel: {
    flex: 1,
  },
});
