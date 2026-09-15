import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { getCountries } from "libphonenumber-js";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ResumeReconcilePrompt } from "@/components/ResumeReconcilePrompt";
import { ShellAppBar } from "@/components/ShellAppBar";
import {
  type AppSettings,
  getAppSettings,
  updateAppSettings,
} from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { getNewestPendingReconcileSessionId } from "@/db/reconcile-session-read";
import type { RootStackParamList } from "@/navigation/types";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import {
  type ContactsPermissionState,
  getContactsPermissionState,
  openContactsSettings,
  requestContactsPermission,
} from "@/services/contacts/use-read-contacts-permission";
import { getDeviceRegion } from "@/services/device-region";
import type { ResumableReconcile } from "@/services/import/reconcile-resume-sweep";
import { startContactImport } from "@/services/import/start-contact-import";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import { pickContacts } from "../../modules/orbit-contact-picker";
import {
  isActiveContactsRow,
  SETTINGS_CONTACTS_SECTIONS,
  type SettingsContactsAction,
  type SettingsContactsRow,
} from "./settings-contacts-model";
import { phoneRegionValueLabel } from "./settings-lifecycle-logic";
import { phoneRegionOverridePatch } from "./settings-region-logic";
import { contactImportMode } from "./use-contact-import-mode";

const LOG_SCOPE = "settings-contacts-screen";

interface SettingsContactsScreenProps {
  onBack: () => void;
}

const regionNames =
  typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

const PHONE_REGIONS = getCountries()
  .map((code) => ({ code, name: regionNames?.of(code) ?? code }))
  .sort((a, b) => a.name.localeCompare(b.name));

/**
 * Contacts & Relationships category screen (§E / D-09). Migrates the monolith's
 * Contact methods (phone region, resumable reconcile, review-flagged), Contacts
 * Integration (import), Custom Fields, and Archived rows into three sections —
 * Contact Sources, Relationship Structure, Contact Management — each reusing the
 * canonical manager by navigation (never reimplemented) and preserving its exact
 * write/navigation behaviour.
 *
 * The Contact Sources permission surface (§E/§G) is built on the EXISTING
 * `use-read-contacts-permission` service: it reads OS status fresh on focus,
 * renders it, and for a denied/permanent verdict shows an actionable
 * Open-system-settings handoff (Orbit cannot flip the OS grant itself). Priming
 * offers a single in-context grant tap (no re-nag loop); permission-dependent
 * capabilities (Import, Check linked) stay visible with explanation rather than
 * hidden (§G).
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
export function SettingsContactsScreen({
  onBack,
}: SettingsContactsScreenProps) {
  const { colors } = useTheme();
  const bottomClearance = useBottomClearance();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [permission, setPermission] = useState<ContactsPermissionState | null>(
    null,
  );
  const [phoneRegionPickerOpen, setPhoneRegionPickerOpen] = useState(false);
  const [phoneRegionSearch, setPhoneRegionSearch] = useState("");
  const [resumableReconcile, setResumableReconcile] =
    useState<ResumableReconcile | null>(null);

  // Contacts permission is OS-owned and revocable between opens — read it FRESH
  // on focus, never cached (mirrors the monolith's notification-permission
  // posture). app_settings is reloaded alongside for the phone-region value.
  const reload = useCallback(async () => {
    try {
      setSettings(await getAppSettings(getExecutor()));
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load contact settings", err);
    }
    try {
      setPermission(await getContactsPermissionState());
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to read contacts permission", err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const onImportContacts = useCallback(async () => {
    try {
      const currentSettings = await getAppSettings(getExecutor());
      await startContactImport({
        mode: contactImportMode(),
        exec: getExecutor(),
        effectivePhoneRegion:
          currentSettings.phoneRegionOverride ?? getDeviceRegion(),
        now: localDateTime(),
        pick: () => pickContacts({ multiple: true }),
        navigate: navigation.navigate,
      });
    } catch {
      Alert.alert("Couldn't import contacts", "Please try again.");
    }
  }, [navigation]);

  const onCheckLinkedContacts = useCallback(async () => {
    try {
      const pendingId = await getNewestPendingReconcileSessionId(getExecutor());
      if (pendingId !== null) {
        setResumableReconcile({ sessionId: pendingId, discardOnly: false });
        return;
      }
      navigation.navigate("ReconcileGrid");
    } catch {
      Alert.alert("Couldn't check linked contacts", "Please try again.");
    }
  }, [navigation]);

  const savePhoneRegionOverride = useCallback(
    async (input: string): Promise<boolean> => {
      try {
        await updateAppSettings(
          getExecutor(),
          phoneRegionOverridePatch(input),
          localDateTime(),
        );
        await reload();
        return true;
      } catch (err) {
        Logger.error(LOG_SCOPE, "failed to persist phone region override", err);
        return false;
      }
    },
    [reload],
  );

  const onSelectPhoneRegion = useCallback(
    async (region: string) => {
      if (await savePhoneRegionOverride(region)) {
        setPhoneRegionPickerOpen(false);
        setPhoneRegionSearch("");
      }
    },
    [savePhoneRegionOverride],
  );

  const filteredPhoneRegions = useMemo(() => {
    const term = phoneRegionSearch.trim().toLocaleLowerCase();
    if (term === "") return PHONE_REGIONS;
    return PHONE_REGIONS.filter(
      (region) =>
        region.code.toLocaleLowerCase().includes(term) ||
        region.name.toLocaleLowerCase().includes(term),
    );
  }, [phoneRegionSearch]);

  // Priming is the only verdict where an in-context grant is appropriate. The
  // request is triggered ONLY by an intentional tap (never auto-fired), so there
  // is no re-nag loop; the fresh verdict is re-read afterwards.
  const onRequestContactsPermission = useCallback(async () => {
    try {
      await requestContactsPermission();
    } catch (err) {
      Logger.error(LOG_SCOPE, "contacts permission request failed", err);
    } finally {
      await reload();
    }
  }, [reload]);

  const onOpenSystemSettings = useCallback(() => {
    void openContactsSettings();
  }, []);

  const phoneRegionLabel = phoneRegionValueLabel(
    settings?.phoneRegionOverride ?? null,
    settings?.phoneRegionOverride
      ? (regionNames?.of(settings.phoneRegionOverride) ??
          settings.phoneRegionOverride)
      : null,
  );

  const renderRouteRow = (
    row: Extract<SettingsContactsRow, { kind: "route" }>,
  ) => (
    <Pressable
      key={row.key}
      testID={`settings-contacts-${row.key}`}
      accessibilityRole="button"
      accessibilityLabel={row.title}
      onPress={() => navigation.navigate(row.route)}
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
        {row.title}
      </Text>
      <Text style={[styles.helper, { color: colors.textSecondary }]}>
        {row.subtitle}
      </Text>
    </Pressable>
  );

  const renderPermissionSurface = (
    row: Extract<SettingsContactsRow, { kind: "action" }>,
  ) => {
    const verdict = permission?.verdict ?? null;
    const granted = verdict === "granted";
    const needsSystemSettings = verdict === "denied" || verdict === "permanent";
    const priming = verdict === "priming";
    const status =
      verdict === null
        ? "Checking Contacts access…"
        : granted
          ? "Contacts access is on. Import and linked-contact updates can read your phone contacts."
          : "Contacts access is off. Import and linked-contact updates stay available, but can't read your phone contacts until access is granted.";
    return (
      <View
        key={row.key}
        testID="settings-contacts-permission"
        style={[
          styles.row,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
          {row.title}
        </Text>
        <Text
          testID="settings-contacts-permission-status"
          style={[styles.helper, { color: colors.textSecondary }]}
        >
          {status}
        </Text>
        {needsSystemSettings ? (
          <Pressable
            testID="settings-contacts-permission-open-settings"
            accessibilityRole="button"
            accessibilityLabel="Open system settings for Contacts access"
            onPress={onOpenSystemSettings}
            style={[styles.inlineButton, { borderColor: colors.border }]}
          >
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
              Open system settings
            </Text>
          </Pressable>
        ) : null}
        {priming ? (
          <Pressable
            testID="settings-contacts-permission-grant"
            accessibilityRole="button"
            accessibilityLabel="Allow Contacts access"
            onPress={() => void onRequestContactsPermission()}
            style={[styles.inlineButton, { borderColor: colors.border }]}
          >
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
              Allow Contacts access
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  const renderActionRow = (
    row: Extract<SettingsContactsRow, { kind: "action" }>,
  ) => {
    if (row.action === "contacts-permission") {
      return renderPermissionSurface(row);
    }
    const onPressForAction: Record<
      Exclude<SettingsContactsAction, "contacts-permission">,
      () => void
    > = {
      import: () => void onImportContacts(),
      reconcile: () => void onCheckLinkedContacts(),
      "phone-region": () => setPhoneRegionPickerOpen(true),
    };
    const isPhoneRegion = row.action === "phone-region";
    return (
      <Pressable
        key={row.key}
        testID={`settings-contacts-${row.key}`}
        accessibilityRole="button"
        accessibilityLabel={
          isPhoneRegion ? `Phone number region, ${phoneRegionLabel}` : row.title
        }
        accessibilityState={
          isPhoneRegion ? { disabled: settings === null } : undefined
        }
        disabled={isPhoneRegion && settings === null}
        onPress={onPressForAction[row.action]}
        style={[
          styles.row,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {isPhoneRegion ? (
          <View style={styles.toggleRow}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
              {row.title}
            </Text>
            <Text style={[styles.rowValue, { color: colors.accent }]}>
              {phoneRegionLabel}
            </Text>
          </View>
        ) : (
          <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
            {row.title}
          </Text>
        )}
        <Text style={[styles.helper, { color: colors.textSecondary }]}>
          {row.subtitle}
        </Text>
      </Pressable>
    );
  };

  const renderRow = (row: SettingsContactsRow) => {
    if (!isActiveContactsRow(row)) {
      // Reserved IA slot (D-03 / §K) — renders nothing. Never a dead placeholder.
      return null;
    }
    return row.kind === "route" ? renderRouteRow(row) : renderActionRow(row);
  };

  return (
    <View style={styles.root}>
      <ShellAppBar variant="child" title="Contacts & Relationships" />
      <ScrollView
        testID="settings-contacts-screen"
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

        {SETTINGS_CONTACTS_SECTIONS.map((section) => (
          <View
            key={section.key}
            testID={`settings-contacts-section-${section.key}`}
            style={styles.section}
          >
            <Text
              accessibilityRole="header"
              style={[styles.sectionHeading, { color: colors.textSecondary }]}
            >
              {section.title}
            </Text>
            {section.rows.map((row) => renderRow(row))}
          </View>
        ))}
      </ScrollView>

      <ResumeReconcilePrompt
        resumable={resumableReconcile}
        onDismiss={() => setResumableReconcile(null)}
        onDiscarded={() => navigation.navigate("ReconcileGrid")}
      />

      <Modal
        visible={phoneRegionPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPhoneRegionPickerOpen(false)}
      >
        <View style={styles.regionModalScrim}>
          <View
            testID="settings-phone-region-modal"
            style={[
              styles.regionModal,
              { backgroundColor: colors.surfaceElevated },
            ]}
          >
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: colors.textPrimary }]}
            >
              Phone number region
            </Text>
            <TextInput
              testID="settings-phone-region-search"
              accessibilityLabel="Search phone number regions"
              value={phoneRegionSearch}
              onChangeText={setPhoneRegionSearch}
              placeholder="Search regions"
              placeholderTextColor={colors.textSecondary}
              autoCorrect={false}
              style={[
                styles.regionInput,
                {
                  color: colors.textPrimary,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            />
            <Pressable
              testID="settings-phone-region-device"
              accessibilityRole="button"
              accessibilityLabel="Use device region"
              onPress={() => void onSelectPhoneRegion("")}
              style={[styles.regionOption, { borderColor: colors.border }]}
            >
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
                Use device region
              </Text>
              <Text style={[styles.helper, { color: colors.textSecondary }]}>
                {getDeviceRegion() ?? "Unavailable"}
              </Text>
            </Pressable>
            <FlatList
              data={filteredPhoneRegions}
              keyExtractor={(region) => region.code}
              renderItem={({ item }) => (
                <Pressable
                  testID={`settings-phone-region-${item.code}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name} (${item.code})`}
                  accessibilityState={{
                    selected: settings?.phoneRegionOverride === item.code,
                  }}
                  onPress={() => void onSelectPhoneRegion(item.code)}
                  style={[styles.regionOption, { borderColor: colors.border }]}
                >
                  <Text
                    style={[styles.rowLabel, { color: colors.textPrimary }]}
                  >{`${item.name} (${item.code})`}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
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
  inlineButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: "flex-start",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  regionInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  regionModalScrim: {
    flex: 1,
    justifyContent: "flex-end",
  },
  regionModal: {
    maxHeight: "80%",
    gap: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 16,
  },
  regionOption: {
    minHeight: 44,
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
});
