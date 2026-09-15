import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { ShellAppBar } from "@/components/ShellAppBar";
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
import {
  getNotificationPermission,
  requestNotificationPermission,
} from "@/services/notifications/permission";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import {
  type PersistNotificationDeps,
  persistNotificationSettings,
} from "./settings-notifications-logic";

const LOG_SCOPE = "settings-notifications-screen";

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
 * The production wiring of the shared reconcile-on-write helper. Every
 * notification/digest write on this screen routes through
 * `persistNotificationSettings` (NOT a bare `updateAppSettings`) so BOTH
 * reconcilers fire immediately and the OS schedule re-arms on change rather than
 * at next launch (RESEARCH Pitfall 5).
 */
const NOTIFICATION_PERSIST_DEPS: PersistNotificationDeps = {
  updateAppSettings,
  getAppSettings,
  reconcileSchedule,
  reconcileDigestSchedule,
  now: localDateTime,
};

interface SettingsNotificationsScreenProps {
  onBack: () => void;
}

/**
 * Notifications category screen (§G / D-09). Migrates all 10 notification
 * controls out of the monolith — master, degraded note, Decay, Birthday,
 * Birthday-unbound, Weekly digest, Lock-screen, Reminder time, Quiet start,
 * Quiet end — organized by user-facing notification type (relationship
 * reminders, birthdays incl. Unbound behaviour, weekly digest, delivery timing,
 * and notification display).
 *
 * Every write routes through the shared `persistNotificationSettings` helper so
 * both `reconcileSchedule` and `reconcileDigestSchedule` fire immediately
 * (Pitfall 5). The helper RETURNS the fresh re-read `AppSettings`, which this
 * screen PUBLISHES into local state so every control reflects the durable write
 * (review MEDIUM #2); a helper REJECTION (cycle-3) is caught and surfaced as an
 * inline save-error notice rather than publishing a stale value.
 *
 * Permission is OS-owned and revocable — the raw status is read FRESH on focus
 * (Task 2). The master-on-but-blocked `degraded` note stays a separate concern.
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
export function SettingsNotificationsScreen({
  onBack,
}: SettingsNotificationsScreenProps) {
  const { colors } = useTheme();
  const bottomClearance = useBottomClearance();

  // Notification settings mirror app_settings; permission is READ FRESH on focus
  // (OS-owned, revocable between opens). `degraded` renders the non-nagging note
  // when the master is on but the OS permission is denied — text only, never a
  // re-prompt.
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  useFocusEffect(
    useCallback(() => {
      void reloadNotifications();
    }, [reloadNotifications]),
  );

  // Persist a patch through the SHARED reconcile-on-write helper: it writes,
  // re-reads, fires BOTH reconcilers (fire-and-forget), and RETURNS the fresh
  // settings. On success we PUBLISH the returned value so controls reflect the
  // durable write (not a stale value); on a rejection (failed write) we surface
  // an inline save-error notice and do NOT publish a stale value (cycle-3).
  const persist = useCallback(async (patch: AppSettingsPatch) => {
    try {
      const next = await persistNotificationSettings(
        getExecutor(),
        patch,
        NOTIFICATION_PERSIST_DEPS,
      );
      setSettings(next);
      setSaveError(null);
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to persist notification setting", err);
      setSaveError("Couldn't save that change. Please try again.");
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
  // field the open row owns — the DAO re-validates the 0-23 bound — then reconcile.
  // Android dismiss/cancel (event.type !== "set") keeps the prior value.
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

  return (
    <View style={styles.root}>
      <ShellAppBar variant="child" title="Notifications" />
      <ScrollView
        testID="settings-notifications-screen"
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

        {/* Notifications — master toggle + degraded note. */}
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
                Get a calm morning reminder when someone's overdue, and a
                heads-up on birthdays.
              </Text>
            ) : null}
          </View>

          {degraded ? (
            <View
              style={[
                styles.row,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
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

          {saveError ? (
            <Text
              testID="settings-notifications-save-error"
              accessibilityRole="alert"
              style={[styles.helper, { color: colors.danger }]}
            >
              {saveError}
            </Text>
          ) : null}
        </View>

        {/* Relationship reminders. */}
        <View style={styles.section}>
          <Text
            accessibilityRole="header"
            style={[styles.sectionHeading, { color: colors.textSecondary }]}
          >
            Relationship reminders
          </Text>

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
                  {
                    color: masterOn ? colors.textPrimary : colors.textSecondary,
                  },
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
        </View>

        {/* Birthdays. */}
        <View style={styles.section}>
          <Text
            accessibilityRole="header"
            style={[styles.sectionHeading, { color: colors.textSecondary }]}
          >
            Birthdays
          </Text>

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
                  {
                    color: masterOn ? colors.textPrimary : colors.textSecondary,
                  },
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

          {/* Birthday alerts for unbound contacts (§G — unbound birthday
              NOTIFICATION behaviour lives here; birthday presentation stays
              deferred to Your Week per ADR-076). Gated by master. */}
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
                  {
                    color: masterOn ? colors.textPrimary : colors.textSecondary,
                  },
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
        </View>

        {/* Weekly digest. */}
        <View style={styles.section}>
          <Text
            accessibilityRole="header"
            style={[styles.sectionHeading, { color: colors.textSecondary }]}
          >
            Weekly digest
          </Text>

          {/* Weekly digest — gated by master. Persists + reconciles the WEEKLY
              trigger through the shared persist path. */}
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
                  {
                    color: masterOn ? colors.textPrimary : colors.textSecondary,
                  },
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
                onValueChange={(v) =>
                  void persist({ digestEnabled: v ? 1 : 0 })
                }
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.surfaceElevated}
              />
            </View>
            <Text style={[styles.helper, { color: colors.textSecondary }]}>
              A Sunday-morning look back at your week — who you reached, and
              who's slipping quietly.
            </Text>
          </View>
        </View>

        {/* Delivery timing — reminder time + quiet window (the user-tunable
            hours). */}
        <View style={styles.section}>
          <Text
            accessibilityRole="header"
            style={[styles.sectionHeading, { color: colors.textSecondary }]}
          >
            Delivery time
          </Text>

          {/* Reminder time — the user-tunable delivery hour. */}
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
                  {
                    color: masterOn ? colors.textPrimary : colors.textSecondary,
                  },
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

          {/* Quiet-hours start — the user-tunable quiet-window start. */}
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
                  {
                    color: masterOn ? colors.textPrimary : colors.textSecondary,
                  },
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

          {/* Quiet-hours end — the user-tunable quiet-window end. */}
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
                  {
                    color: masterOn ? colors.textPrimary : colors.textSecondary,
                  },
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

        {/* Notification display. */}
        <View style={styles.section}>
          <Text
            accessibilityRole="header"
            style={[styles.sectionHeading, { color: colors.textSecondary }]}
          >
            Notification display
          </Text>

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
                  {
                    color: masterOn ? colors.textPrimary : colors.textSecondary,
                  },
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
});
