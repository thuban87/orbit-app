// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.

import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ShellAppBar } from "@/components/ShellAppBar";
import {
  AppText,
  OrbitSwitch,
  SettingsRow,
  SettingsSectionCard,
} from "@/components/ui";
import { CHECK_IN_REMINDERS } from "@/constants/glossary";
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
  type NotificationPermissionResult,
  requestNotificationPermission,
} from "@/services/notifications/permission";
import { notice } from "@/stores/confirm-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";
import {
  effectiveReminderArrival,
  formatHour,
  NOTIFICATIONS_PAUSED_LINE,
  type PersistNotificationDeps,
  persistNotificationSettings,
  QUIET_HOURS_HELPER,
  reminderArrivalLine,
} from "./settings-notifications-logic";

const LOG_SCOPE = "settings-notifications-screen";

/** Which time control's native picker is open (null = none). */
type ActivePicker = "delivery" | "quiet-start" | "quiet-end" | null;

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

/**
 * Notifications category screen (§G / D-09). Migrates all 10 notification
 * controls out of the monolith — master, degraded note, Check-in reminders,
 * Birthday, Birthday-Unbound, Weekly digest, Lock-screen, Reminder time, Quiet
 * start, Quiet end — organized by user-facing notification type (relationship
 * reminders, birthdays incl. Unbound behaviour, weekly digest, delivery timing,
 * and notification display).
 *
 * 38.12: every section is a `SettingsSectionCard` of `SettingsRow`s with the
 * switch as the trailing control, testIDs kept (D-119). With Allow
 * notifications off, one paused line replaces any per-row explanation and the
 * child rows draw disabled — dimmed, switches drawn Off (D-77, D-06). The
 * Unbound birthday row is disabled unless Birthday alerts is on, matching the
 * scheduler, which only reads birthday candidates when Birthday alerts is on
 * (D-77, D-83). A reminder time inside quiet hours shows when reminders really
 * arrive, from the scheduler's own `nextAllowedFireInstant` (D-78), and,
 * when that roll crosses midnight, that birthday alerts and the digest keep
 * their own day at the quiet-hours end (`sameDayAllowedHour`, D-142).
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
 * Back is the `ShellAppBar` header Back only (RG-037 ui-accessibility/
 * AUD-UIA-016, D-15): no duplicate in-body Back.
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
export function SettingsNotificationsScreen() {
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
  // The RAW OS notification-permission status, read fresh on focus INDEPENDENT of
  // the master toggle (Task 2 / §G). This is tracked separately from `degraded`
  // (master-on-but-blocked): the monolith only read permission when the master was
  // on (SettingsScreen.tsx:349), which cannot power a general permission row that
  // must reflect true OS status even with the master off.
  const [permission, setPermission] =
    useState<NotificationPermissionResult | null>(null);

  // Load app_settings + the current OS permission status. Permission is OS-owned
  // and revocable between opens, so it is READ FRESH on every focus regardless of
  // the master. `degraded` stays the master-on-but-blocked note (a separate
  // concern from the raw permission row) — still text only, never a re-prompt.
  const reloadNotifications = useCallback(async () => {
    try {
      const next = await getAppSettings(getExecutor());
      setSettings(next);
      const perm = await getNotificationPermission();
      setPermission(perm);
      setDegraded(next.notificationsEnabled === 1 && !perm.granted);
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

  // Denied permission is OS-owned — Orbit cannot flip it itself, so it hands off
  // to system settings (mirrors `openContactsSettings`, incl. the calm OEM
  // fallback). Never a silent in-app re-prompt (§G).
  const onOpenSystemSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      void notice({
        title: "Open Settings manually",
        message: "Open Orbit's app settings and allow notifications.",
      });
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

  const birthdayOn = settings?.birthdayEnabled === 1;
  const digestOn = settings?.digestEnabled === 1;
  const deliveryHour = settings?.deliveryHour ?? 9;
  const quietStartHour = settings?.quietStartHour ?? 21;
  const quietEndHour = settings?.quietEndHour ?? 8;
  // D-78 / D-142: the schedulers' own roll and same-day hour, so the page
  // never promises a time the reminders, birthday alerts or digest don't keep.
  const arrivalLine = reminderArrivalLine(
    effectiveReminderArrival({
      reminderTime: deliveryHour,
      quietStart: quietStartHour,
      quietEnd: quietEndHour,
    }),
    birthdayOn,
    digestOn,
  );
  // D-77: one paused line while the master is off. The degraded note already
  // explains a denial, so the two never show together.
  const showPaused = settings !== null && !masterOn && !degraded;

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
        {/* Notifications — master toggle, OS permission, degraded note. */}
        <SettingsSectionCard
          testID="settings-notifications-section"
          title="Notifications"
        >
          {/* Master toggle — the value-moment permission affordance. Its
              description reads the same whether it is on or off (D-77). */}
          <SettingsRow
            title="Allow notifications"
            subtitle="Calm reminders when someone's overdue, and a heads-up on birthdays."
            trailing={
              <OrbitSwitch
                testID="settings-notifications-master"
                accessibilityLabel="Allow notifications"
                value={masterOn}
                onValueChange={(v) => void onToggleMaster(v)}
              />
            }
          />

          {/* RAW OS notification-permission row (§G) — reflects true OS status
              regardless of the master toggle (separate from the master-on-but-
              blocked `degraded` note). When blocked, hands off to system
              settings; the controls below stay visible with this
              explanation. */}
          {permission ? (
            <SettingsRow
              testID="settings-notifications-permission"
              title="Notification permission"
              subtitle={
                permission.granted
                  ? "Your phone allows Orbit's notifications. Reminders can be delivered."
                  : "Your phone is blocking Orbit's notifications. Reminders won't appear until you allow them in system settings — the controls below stay available."
              }
              subtitleTestID="settings-notifications-permission-status"
            >
              {!permission.granted ? (
                <Pressable
                  testID="settings-notifications-permission-open-settings"
                  accessibilityRole="button"
                  accessibilityLabel="Open system settings for notifications"
                  onPress={() => void onOpenSystemSettings()}
                  style={[styles.inlineButton, { borderColor: colors.border }]}
                >
                  <AppText role="label" style={{ color: colors.textPrimary }}>
                    Open system settings
                  </AppText>
                </Pressable>
              ) : null}
            </SettingsRow>
          ) : null}

          {degraded ? (
            <SettingsRow
              testID="settings-notifications-degraded"
              title="Notifications are off"
              subtitle="Contacts still shows who's due. To get reminders, turn notifications on in your phone's settings."
            />
          ) : null}
        </SettingsSectionCard>

        {showPaused ? (
          <AppText
            role="caption"
            testID="settings-notifications-paused"
            accessibilityLiveRegion="polite"
            style={[styles.note, { color: colors.textSecondary }]}
          >
            {NOTIFICATIONS_PAUSED_LINE}
          </AppText>
        ) : null}

        {saveError ? (
          <AppText
            role="caption"
            testID="settings-notifications-save-error"
            accessibilityRole="alert"
            style={[styles.note, { color: colors.danger }]}
          >
            {saveError}
          </AppText>
        ) : null}

        {/* Relationship reminders. */}
        <SettingsSectionCard title="Relationship reminders">
          {/* Check-in reminders — gated by master (D-130 label). */}
          <SettingsRow
            title={CHECK_IN_REMINDERS}
            subtitle="Reminders to reach out to people you're overdue with."
            disabled={!masterOn}
            trailing={
              <OrbitSwitch
                testID="settings-notifications-decay"
                accessibilityLabel={CHECK_IN_REMINDERS}
                disabled={!masterOn}
                value={settings?.decayEnabled === 1}
                onValueChange={(v) => void persist({ decayEnabled: v ? 1 : 0 })}
              />
            }
          />
        </SettingsSectionCard>

        {/* Birthdays. */}
        <SettingsSectionCard title="Birthdays">
          {/* Birthday alerts — gated by master. */}
          <SettingsRow
            title="Birthday alerts"
            subtitle="A morning nudge on a contact's birthday."
            disabled={!masterOn}
            trailing={
              <OrbitSwitch
                testID="settings-notifications-birthday"
                accessibilityLabel="Birthday alerts"
                disabled={!masterOn}
                value={birthdayOn}
                onValueChange={(v) =>
                  void persist({ birthdayEnabled: v ? 1 : 0 })
                }
              />
            }
          />

          {/* Birthday alerts for Unbound contacts (§G — Unbound birthday
              NOTIFICATION behaviour lives here; birthday presentation stays
              deferred to Your Week per ADR-076). Gated by the master AND by
              Birthday alerts: the scheduler reads no birthday candidates while
              Birthday alerts is off (D-77). */}
          <SettingsRow
            title="Birthday alerts for Unbound contacts"
            subtitle={
              masterOn && !birthdayOn
                ? "Turn on Birthday alerts to use this."
                : "Keep birthday reminders on for contacts outside your active orbit."
            }
            disabled={!masterOn || !birthdayOn}
            trailing={
              <OrbitSwitch
                testID="settings-notifications-birthday-unbound"
                accessibilityLabel="Birthday alerts for Unbound contacts"
                disabled={!masterOn || !birthdayOn}
                value={settings?.birthdayUnboundEnabled === 1}
                onValueChange={(value) =>
                  void persist({ birthdayUnboundEnabled: value ? 1 : 0 })
                }
              />
            }
          />
        </SettingsSectionCard>

        {/* Weekly digest. */}
        <SettingsSectionCard title="Weekly digest">
          {/* Weekly digest — gated by master. Persists + reconciles the WEEKLY
              trigger through the shared persist path. */}
          <SettingsRow
            title="Weekly digest"
            subtitle="A Sunday-morning look back at your week — who you reached, and who's slipping quietly."
            disabled={!masterOn}
            trailing={
              <OrbitSwitch
                testID="settings-notifications-digest"
                accessibilityLabel="Weekly digest"
                disabled={!masterOn}
                value={settings?.digestEnabled === 1}
                onValueChange={(v) =>
                  void persist({ digestEnabled: v ? 1 : 0 })
                }
              />
            }
          />
        </SettingsSectionCard>

        {/* Delivery timing — reminder time + quiet window (the user-tunable
            hours). */}
        <SettingsSectionCard title="Delivery time">
          {/* Reminder time — the user-tunable delivery hour. Inside quiet
              hours, its subtitle says when reminders really arrive (D-78). */}
          <SettingsRow
            testID="settings-notifications-time"
            title="Reminder time"
            value={formatHour(deliveryHour)}
            subtitle={arrivalLine}
            subtitleTestID="settings-notifications-arrival"
            accessibilityLabel={`Reminder time, ${formatHour(deliveryHour)}${
              arrivalLine ? `. ${arrivalLine}` : ""
            }`}
            disabled={!masterOn}
            onPress={() => setActivePicker("delivery")}
          />

          {/* Quiet-hours start — the user-tunable quiet-window start. */}
          <SettingsRow
            testID="settings-notifications-quiet-start"
            title="Quiet hours start"
            value={formatHour(quietStartHour)}
            accessibilityLabel={`Quiet hours start, ${formatHour(quietStartHour)}`}
            disabled={!masterOn}
            onPress={() => setActivePicker("quiet-start")}
          />

          {/* Quiet-hours end — the user-tunable quiet-window end. */}
          <SettingsRow
            testID="settings-notifications-quiet-end"
            title="Quiet hours end"
            value={formatHour(quietEndHour)}
            accessibilityLabel={`Quiet hours end, ${formatHour(quietEndHour)}`}
            disabled={!masterOn}
            onPress={() => setActivePicker("quiet-end")}
          />
        </SettingsSectionCard>
        <AppText
          role="caption"
          testID="settings-notifications-quiet-helper"
          style={[styles.note, { color: colors.textSecondary }]}
        >
          {QUIET_HOURS_HELPER}
        </AppText>

        {activePicker !== null ? (
          <DateTimePicker
            testID="settings-notifications-time-picker"
            value={seedForHour(pickerSeedHour)}
            mode="time"
            onChange={onPickTime}
          />
        ) : null}

        {/* Notification display. */}
        <SettingsSectionCard title="Notification display">
          {/* Lock-screen visibility — default off (private). */}
          <SettingsRow
            title="Show names on lock screen"
            subtitle="When off, lock-screen reminders won't show who they're about."
            disabled={!masterOn}
            trailing={
              <OrbitSwitch
                testID="settings-notifications-lockscreen"
                accessibilityLabel="Show names on lock screen"
                disabled={!masterOn}
                value={settings?.lockscreenPublic === 1}
                onValueChange={(v) =>
                  void persist({ lockscreenPublic: v ? 1 : 0 })
                }
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
  note: { paddingHorizontal: SPACING.xs },
  inlineButton: {
    borderWidth: 1,
    borderRadius: RADII.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
});
