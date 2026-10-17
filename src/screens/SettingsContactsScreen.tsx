// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.

import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { getCountries } from "libphonenumber-js";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { usePhotoBudgetPrompt } from "@/components/PhotoBudgetSheet";
import { ResumeReconcilePrompt } from "@/components/ResumeReconcilePrompt";
import { ShellAppBar } from "@/components/ShellAppBar";
import {
  AppText,
  EmptyState,
  SettingsRow,
  SettingsSectionCard,
  Sheet,
} from "@/components/ui";
import { countryName } from "@/constants/country-names";
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
  ensureReadContactsPermission,
  getContactsPermissionState,
  openContactsSettings,
  requestContactsPermission,
} from "@/services/contacts/use-read-contacts-permission";
import { getDeviceRegion } from "@/services/device-region";
import type { ResumableReconcile } from "@/services/import/reconcile-resume-sweep";
import { startContactImport } from "@/services/import/start-contact-import";
import { discardDerivative } from "@/services/photos/derivative-cache";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";
import {
  pickContacts,
  readAllContacts,
} from "../../modules/orbit-contact-picker";
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

// English names come from the bundled table (D-79): Hermes has no platform
// region display-names API, so a runtime lookup showed bare codes on device.
const PHONE_REGIONS = getCountries()
  .map((code) => ({ code, name: countryName(code) }))
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
 * Back is the `ShellAppBar` header Back only (RG-037 ui-accessibility/
 * AUD-UIA-016, D-15): no duplicate in-body Back.
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
export function SettingsContactsScreen() {
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
  // D-133: asked before photos that may not fit in the encrypted backup.
  const { sheet: photoBudgetSheet, ask: askPhotoBudget } =
    usePhotoBudgetPrompt();

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
        ensureNotesAccess: async () =>
          (await ensureReadContactsPermission()).granted,
        // D-137: withNotes asks for full-size photos (an import path).
        readByLookupKeys: async (keys, options) =>
          (await readAllContacts(keys, options)).contacts,
        discardPhotoCopy: discardDerivative,
        navigate: navigation.navigate,
        decidePhotoBudget: askPhotoBudget,
      });
    } catch {
      showSnackbar({
        kind: "error",
        label: "Couldn't import contacts. Please try again.",
      });
    }
  }, [navigation, askPhotoBudget]);

  const onCheckLinkedContacts = useCallback(async () => {
    try {
      const pendingId = await getNewestPendingReconcileSessionId(getExecutor());
      if (pendingId !== null) {
        setResumableReconcile({ sessionId: pendingId, discardOnly: false });
        return;
      }
      navigation.navigate("ReconcileGrid");
    } catch {
      showSnackbar({
        kind: "error",
        label: "Couldn't check linked contacts. Please try again.",
      });
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

  // Every way out of the region picker clears its search (D-79): a pick, the
  // scrim, system Back.
  const closePhoneRegionPicker = useCallback(() => {
    setPhoneRegionPickerOpen(false);
    setPhoneRegionSearch("");
  }, []);

  const onSelectPhoneRegion = useCallback(
    async (region: string) => {
      if (await savePhoneRegionOverride(region)) {
        closePhoneRegionPicker();
      }
    },
    [savePhoneRegionOverride, closePhoneRegionPicker],
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
      ? countryName(settings.phoneRegionOverride)
      : null,
  );

  const renderRouteRow = (
    row: Extract<SettingsContactsRow, { kind: "route" }>,
  ) => (
    <SettingsRow
      key={row.key}
      testID={`settings-contacts-${row.key}`}
      accessibilityLabel={row.title}
      title={row.title}
      subtitle={row.subtitle}
      onPress={() => navigation.navigate(row.route)}
    />
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
    // An info row (no chevron); its permission buttons sit under the status
    // as the row's secondary content (D-119).
    return (
      <SettingsRow
        key={row.key}
        testID="settings-contacts-permission"
        title={row.title}
        subtitle={status}
        subtitleTestID="settings-contacts-permission-status"
      >
        {needsSystemSettings ? (
          <Pressable
            testID="settings-contacts-permission-open-settings"
            accessibilityRole="button"
            accessibilityLabel="Open system settings for Contacts access"
            onPress={onOpenSystemSettings}
            style={[styles.inlineButton, { borderColor: colors.border }]}
          >
            <AppText role="label" style={{ color: colors.textPrimary }}>
              Open system settings
            </AppText>
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
            <AppText role="label" style={{ color: colors.textPrimary }}>
              Allow Contacts access
            </AppText>
          </Pressable>
        ) : null}
      </SettingsRow>
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
      <SettingsRow
        key={row.key}
        testID={`settings-contacts-${row.key}`}
        accessibilityLabel={
          isPhoneRegion ? `Phone number region, ${phoneRegionLabel}` : row.title
        }
        title={row.title}
        subtitle={row.subtitle}
        value={isPhoneRegion ? phoneRegionLabel : undefined}
        disabled={isPhoneRegion && settings === null}
        onPress={onPressForAction[row.action]}
      />
    );
  };

  const renderRow = (row: SettingsContactsRow) => {
    if (!isActiveContactsRow(row)) {
      // Reserved IA slot (D-03 / §K) — renders nothing. Never a dead placeholder.
      return null;
    }
    return row.kind === "route" ? renderRouteRow(row) : renderActionRow(row);
  };

  const phoneRegionTerm = phoneRegionSearch.trim();

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
        {SETTINGS_CONTACTS_SECTIONS.map((section) => (
          <SettingsSectionCard
            key={section.key}
            testID={`settings-contacts-section-${section.key}`}
            title={section.title}
          >
            {section.rows.map((row) => renderRow(row))}
          </SettingsSectionCard>
        ))}
      </ScrollView>

      <ResumeReconcilePrompt
        resumable={resumableReconcile}
        onDismiss={() => setResumableReconcile(null)}
        onDiscarded={() => navigation.navigate("ReconcileGrid")}
      />

      {photoBudgetSheet}

      {/* The region picker is the shared Sheet (D-79): it lifts above the
          soft keyboard (Sheet keyboard layout, 38.4 D-72), and closing it any
          way — a pick, the scrim, Back — clears the search. */}
      <Sheet
        visible={phoneRegionPickerOpen}
        onRequestClose={closePhoneRegionPicker}
        variant="expanded"
      >
        <View testID="settings-phone-region-modal" style={styles.regionRoot}>
          <AppText role="heading" accessibilityRole="header">
            Phone number region
          </AppText>
          <TextInput
            testID="settings-phone-region-search"
            accessibilityLabel="Search phone number regions"
            value={phoneRegionSearch}
            onChangeText={setPhoneRegionSearch}
            placeholder="Search regions"
            placeholderTextColor={colors.textPlaceholder}
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
            <AppText role="label" style={{ color: colors.textPrimary }}>
              Use device region
            </AppText>
            <AppText role="caption" style={{ color: colors.textSecondary }}>
              {getDeviceRegion() ?? "Unavailable"}
            </AppText>
          </Pressable>
          <FlatList
            data={filteredPhoneRegions}
            keyExtractor={(region) => region.code}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <EmptyState
                testID="settings-phone-region-empty"
                icon="search"
                heading="No countries match"
                term={phoneRegionTerm}
                body="Try a different country name or code."
                action={{
                  label: "Clear search",
                  onPress: () => setPhoneRegionSearch(""),
                }}
              />
            }
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
                <AppText
                  role="label"
                  style={{ color: colors.textPrimary }}
                >{`${item.name} (${item.code})`}</AppText>
              </Pressable>
            )}
          />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: SPACING.base,
    gap: SPACING.lg,
  },
  inlineButton: {
    borderWidth: 1,
    borderRadius: RADII.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  regionRoot: { flex: 1, gap: SPACING.md },
  regionInput: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: RADII.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  regionOption: {
    minHeight: 44,
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: SPACING.sm,
  },
});
