import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { PhotoSourcePicker } from "@/components/PhotoSourcePicker";
import {
  type AppSettings,
  type AppSettingsPatch,
  getAppSettings,
  updateAppSettings,
} from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { getProfile } from "@/db/profile-dao";
import type { RootStackParamList } from "@/navigation/types";
import { reconcileSchedule } from "@/services/notifications/notification-schedule";
import {
  getNotificationPermission,
  requestNotificationPermission,
} from "@/services/notifications/permission";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";

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
 * SettingsScreen — the low-traffic host for the two CRUD-05 "separate homes":
 * Custom Fields (relocated off the Phase-3 `HomeScreen` dependency-free route)
 * and Archived contacts (the distinct archive home, no count badge — the
 * Archived screen states its count when opened, CONTEXT Area 1).
 *
 * PLUS the Phase-11 Notifications section (NOTIF-05): the master toggle IS the
 * value-moment `POST_NOTIFICATIONS` affordance, the decay/birthday/lock-screen
 * toggles gate scheduling, and the owner's user-tunable delivery hour + quiet
 * window (the reversal) get their tappable time controls. Every control reads/
 * writes `app_settings` via the DAO and fires `reconcileSchedule` after a change
 * so the OS's scheduled set updates immediately (no wait for next launch).
 *
 * TWO base rows, not three: UI-SPEC:192's "Custom Fields" and "Reachability
 * route" name the SAME `CustomFieldsScreen` (there is no distinct Reachability
 * screen on disk), so a phantom third row would navigate nowhere. See the Plan
 * 04-01 Settings-rows reconciliation.
 *
 * Mirrors the `CustomFieldsScreen` chrome (ScrollView root `background`, header
 * with a `goBack` Back control, title 24/700). Every colour resolves through
 * `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
export function SettingsScreen() {
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Self-record photo seed. `name` is nullable (the id=1 seed row carries no name
  // until a self-name editor ships), so a stable "You" fallback below keeps the
  // initials avatar deterministic ("Y") rather than a permanently blank swatch.
  const [selfPhoto, setSelfPhoto] = useState<string | null>(null);
  const [selfName, setSelfName] = useState<string | null>(null);
  const [selfModifiedAt, setSelfModifiedAt] = useState<string | undefined>(
    undefined,
  );

  // Notification settings mirror app_settings; permission is READ FRESH on focus
  // (OS-owned, revocable between opens). `degraded` renders the non-nagging note
  // when the master is on but the OS permission is denied — text only, never a
  // re-prompt (orchestrator pick 6 / T-11-PERM).
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);

  // Reload the self record so a set/remove made on the crop screen refreshes when
  // it goBack()s here (mirrors ContactProfileScreen's reload-on-focus). The
  // sub-second same-path replace is closed elsewhere: the crop screen's profile
  // branch calls bumpPhotoCacheBust(profilePhotoRelPath()), which Avatar folds
  // into its cache key — so this only needs the coarse `modified_at` cache-bust.
  const reloadProfile = useCallback(async () => {
    try {
      const profile = await getProfile(getExecutor());
      setSelfPhoto(profile?.photo ?? null);
      setSelfName(profile?.name ?? null);
      setSelfModifiedAt(profile?.modified_at);
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load self profile", err);
    }
  }, []);

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
      void reloadProfile();
      void reloadNotifications();
    }, [reloadProfile, reloadNotifications]),
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

  return (
    <ScrollView
      testID="settings-screen"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Pressable
          testID="settings-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textSecondary }}>Back</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.textPrimary }]}
        >
          Settings
        </Text>
      </View>

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

      <View
        testID="settings-your-photo-row"
        style={[
          styles.row,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
          Your photo
        </Text>
        <PhotoSourcePicker
          target={{ kind: "profile" }}
          photo={selfPhoto}
          name={selfName ?? "You"}
          cacheBust={selfModifiedAt}
          onChanged={() => void reloadProfile()}
        />
      </View>

      <Pressable
        testID="settings-manage-favourites-row"
        accessibilityRole="button"
        accessibilityLabel="Manage favourites"
        onPress={() => navigation.navigate("ManageFavourites")}
        style={[
          styles.row,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
          Manage favourites
        </Text>
      </Pressable>

      <Pressable
        testID="settings-custom-fields-row"
        accessibilityRole="button"
        accessibilityLabel="Custom Fields"
        onPress={() => navigation.navigate("CustomFields")}
        style={[
          styles.row,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
          Custom Fields
        </Text>
      </Pressable>

      <Pressable
        testID="settings-archived-row"
        accessibilityRole="button"
        accessibilityLabel="Archived contacts"
        onPress={() => navigation.navigate("Archived")}
        style={[
          styles.row,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
          Archived contacts
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
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
