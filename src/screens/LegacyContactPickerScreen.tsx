// biome-ignore-all lint/a11y/useValidAriaRole: AppText and Button `role` are Orbit typography/button-role props, not ARIA.
import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/components/Avatar";
import { usePhotoBudgetPrompt } from "@/components/PhotoBudgetSheet";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText, Button, EmptyState } from "@/components/ui";
import { getAppSettings } from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import {
  filterRows,
  selectionCount,
  toggleSelection,
} from "@/logic/contact-picker-selection";
import type { ContactPickerRow } from "@/logic/contact-picker-source";
import { toPickerRows } from "@/logic/contact-picker-source";
import { DEFAULT_FLOW_HOST, exitFlow } from "@/navigation/flow-host";
import type { RootStackScreenProps } from "@/navigation/types";
import {
  getContactsPermissionState,
  openContactsSettings,
  requestContactsPermission,
} from "@/services/contacts/use-read-contacts-permission";
import { getDeviceRegion } from "@/services/device-region";
import { routePickedImport } from "@/services/import/import-acquire";
import { withImportFlowActive } from "@/services/import/import-flow-guard";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import { plural } from "@/utils/plural";
import {
  listContactsSummary,
  readAllContacts,
} from "../../modules/orbit-contact-picker";

type LoadState =
  | "loading"
  | "priming"
  | "denied"
  | "permanent"
  | "ready"
  | "error";

const SETTINGS_ESCAPE_DENIAL_COUNT = 2;

const LOG_SCOPE = "legacy-contact-picker";

/** The error snackbar when Import fails; the list and selection stay (D-57). */
export const LEGACY_IMPORT_FAILED_MESSAGE =
  "Couldn't import those contacts. Your selection is kept, so you can try again.";

/** API <= 36's standalone, provider-backed multi-select contact picker. */
export function LegacyContactPickerScreen({
  navigation,
  route,
}: RootStackScreenProps<"LegacyContactPicker">) {
  const { colors } = useTheme();
  // 38.12 D-57: the Import bar clears the system navigation area.
  const bottomInset = useSafeAreaInsets().bottom;
  // 38.12 D-57/D-110: the flow host this picker was opened from. "Not now"
  // leaves through it (Phase 39 retargets a first-run import via the host,
  // 39 D-61) and the import carries it on to review.
  const host = route.params?.host;
  const leave = () => exitFlow(navigation, host ?? DEFAULT_FLOW_HOST);
  const mounted = useRef(false);
  const [rows, setRows] = useState<ContactPickerRow[]>([]);
  const [selectedLookupKeys, setSelectedLookupKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [query, setQuery] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [importing, setImporting] = useState(false);
  const [omittedCount, setOmittedCount] = useState(0);
  const [denialCount, setDenialCount] = useState(0);
  // D-133: asked before photos that may not fit in the encrypted backup.
  const { sheet: photoBudgetSheet, ask: askPhotoBudget } =
    usePhotoBudgetPrompt();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadRows = useCallback(async () => {
    try {
      // Summary-only browse data: no full photos are staged until Import.
      const summaries = await listContactsSummary();
      if (!mounted.current) return;
      setRows(toPickerRows(summaries));
      setLoadState("ready");
    } catch {
      if (mounted.current) setLoadState("error");
    }
  }, []);

  const refreshPermission = useCallback(async () => {
    setLoadState("loading");
    const permission = await getContactsPermissionState();
    if (!mounted.current) return;
    setDenialCount(permission.denialCount);
    if (permission.verdict === "granted") {
      await loadRows();
      return;
    }
    setLoadState(
      permission.verdict === "permanent"
        ? "permanent"
        : permission.verdict === "denied"
          ? "denied"
          : "priming",
    );
  }, [loadRows]);

  // Freshly CHECK on focus. This deliberately never requests permission:
  // requests only happen after an explicit button tap.
  useFocusEffect(
    useCallback(() => {
      void refreshPermission();
    }, [refreshPermission]),
  );

  // A grant made in the OS Settings app returns via an AppState resume, NOT a
  // navigation focus change (this screen never lost focus while Settings was on
  // top), so useFocusEffect alone leaves a "denied"/"permanent" screen stale and
  // strands the user after they follow our own "Open Settings" button. Re-check on
  // resume, but only while parked on a permission-blocked screen so an active
  // browse/import is never interrupted.
  const loadStateRef = useRef(loadState);
  useEffect(() => {
    loadStateRef.current = loadState;
  }, [loadState]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      const current = loadStateRef.current;
      if (current === "denied" || current === "permanent") {
        void refreshPermission();
      }
    });
    return () => sub.remove();
  }, [refreshPermission]);

  async function requestAccess() {
    setLoadState("loading");
    const permission = await requestContactsPermission();
    if (!mounted.current) return;
    setDenialCount(permission.denialCount);
    if (permission.granted) {
      await loadRows();
      return;
    }
    setLoadState(permission.verdict === "permanent" ? "permanent" : "denied");
  }

  const searchRef = useRef<TextInput | null>(null);
  const filteredRows = useMemo(() => filterRows(rows, query), [rows, query]);
  const selectedCount = selectionCount(selectedLookupKeys);

  function onToggleSelection(lookupKey: string) {
    setSelectedLookupKeys((current) => toggleSelection(current, lookupKey));
  }

  async function importSelected() {
    if (importing || selectedCount === 0) return;
    // OBS-9: let go of the search field first. Otherwise Android hands focus
    // back to it when the photo-budget sheet closes ("Go back") and the
    // keyboard reopens over the Import button.
    searchRef.current?.blur();
    Keyboard.dismiss();
    const selectedKeys = [...selectedLookupKeys];
    setImporting(true);
    setOmittedCount(0);
    try {
      // 38.12 D-57: the import runs inside the import-flow guard, like the
      // system path (`start-contact-import.ts`), so the launch sweep never
      // offers to "resume" the session this import is creating.
      await withImportFlowActive(async () => {
        // An import path: full-size photos (D-137, D-118).
        const result = await readAllContacts(selectedKeys, {
          preferFullSize: true,
        });
        if (!mounted.current) return;
        if (result.omittedCount > 0) setOmittedCount(result.omittedCount);

        const exec = getExecutor();
        const settings = await getAppSettings(exec);
        if (!mounted.current) return;
        // "Go back" on the photo-budget sheet returns { status: "cancelled" }:
        // nothing was imported and the list keeps its selection (D-133).
        await routePickedImport(
          exec,
          result.contacts,
          {
            effectivePhoneRegion:
              settings.phoneRegionOverride ?? getDeviceRegion(),
            // Read settings and clock at Import, not when the picker opened.
            now: localDateTime(),
            decidePhotoBudget: askPhotoBudget,
            // D-110 (convergence c1 A-1): the flow host travels on.
            host: route.params?.host,
          },
          navigation,
        );
      });
    } catch (error) {
      // 38.12 D-57: a failed import keeps the loaded list and the selection,
      // so the user can try again; an error snackbar says what happened.
      Logger.error(LOG_SCOPE, "import of picked contacts failed", error);
      if (mounted.current) {
        showSnackbar({ kind: "error", label: LEGACY_IMPORT_FAILED_MESSAGE });
      }
    } finally {
      if (mounted.current) setImporting(false);
    }
  }

  return (
    <View testID="legacy-contact-picker-screen" style={styles.root}>
      <ShellAppBar variant="child" title="Import contacts" />
      <View
        testID="legacy-picker-body"
        style={[styles.body, { paddingBottom: 16 + bottomInset }]}
      >
        {loadState === "loading" ? (
          <PickerMessage>Checking contact access…</PickerMessage>
        ) : loadState === "priming" ? (
          <PermissionMessage
            actionLabel="Continue"
            copy="Orbit reads your contacts on this device so you can choose which to import. Nothing leaves your device."
            onAction={() => void requestAccess()}
          />
        ) : loadState === "denied" ? (
          <PermissionMessage
            actionLabel="Try again"
            copy="Contact access is needed to choose contacts to import."
            onAction={() => void requestAccess()}
            onNotNow={leave}
            secondaryAction={
              denialCount >= SETTINGS_ESCAPE_DENIAL_COUNT
                ? {
                    label: "Open Settings",
                    copy: "If the dialog stopped appearing, open Settings.",
                    onPress: () => void openContactsSettings(),
                  }
                : undefined
            }
          />
        ) : loadState === "permanent" ? (
          <PermissionMessage
            actionLabel="Open Settings"
            copy="Contact access is off for Orbit. Allow it in Settings to choose contacts to import."
            onAction={() => void openContactsSettings()}
            onNotNow={leave}
          />
        ) : loadState === "error" ? (
          <EmptyState
            testID="legacy-picker-read-error"
            icon="warning"
            heading="Couldn't read contacts"
            body="Check that Orbit can still read contacts on this phone, then try again."
            action={{
              label: "Try again",
              onPress: () => void refreshPermission(),
            }}
          />
        ) : (
          <>
            <TextInput
              ref={searchRef}
              accessibilityLabel="Search contacts"
              autoCapitalize="none"
              onChangeText={setQuery}
              placeholder="Search contacts"
              placeholderTextColor={colors.textPlaceholder}
              value={query}
              style={[
                styles.search,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                },
              ]}
            />
            {omittedCount > 0 ? (
              <AppText role="caption">
                {omittedCount} selected contact
                {omittedCount === 1 ? " is" : "s are"} no longer available.
              </AppText>
            ) : null}
            <FlatList
              data={filteredRows}
              // OBS-1: a row tap with the keyboard up selects the row; it no
              // longer only closes the keyboard.
              keyboardShouldPersistTaps="handled"
              keyExtractor={(row) => row.lookupKey}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                query.trim() !== "" ? (
                  // 38.12 D-57: a search that found nobody says so.
                  <EmptyState
                    testID="legacy-picker-no-match"
                    icon="search"
                    heading="No contacts match"
                    term={query.trim()}
                    body="Try a different name, number or email."
                    action={{
                      label: "Clear search",
                      onPress: () => setQuery(""),
                    }}
                  />
                ) : (
                  <PickerMessage>No contacts on this device</PickerMessage>
                )
              }
              renderItem={({ item }) => {
                const selected = selectedLookupKeys.has(item.lookupKey);
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={item.displayName}
                    onPress={() => onToggleSelection(item.lookupKey)}
                    style={[
                      styles.row,
                      {
                        backgroundColor: colors.surface,
                        borderColor: selected ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    {item.photoThumbUri ? (
                      <Image
                        accessibilityLabel={`Photo of ${item.displayName}`}
                        contentFit="cover"
                        recyclingKey={item.lookupKey}
                        source={{ uri: item.photoThumbUri }}
                        style={styles.thumbnail}
                      />
                    ) : (
                      <Avatar photo={null} name={item.displayName} size={40} />
                    )}
                    <View style={styles.rowCopy}>
                      <AppText role="body" numberOfLines={1}>
                        {item.displayName}
                      </AppText>
                      {item.primaryMethod ? (
                        <AppText role="caption" numberOfLines={1}>
                          {item.primaryMethod}
                        </AppText>
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: selected
                            ? colors.accent
                            : colors.borderStrong,
                          backgroundColor: selected
                            ? colors.accent
                            : colors.surface,
                        },
                      ]}
                    >
                      <AppText role="label" style={{ color: colors.onAccent }}>
                        {selected ? "✓" : ""}
                      </AppText>
                    </View>
                  </Pressable>
                );
              }}
            />
          </>
        )}

        {loadState === "ready" ? (
          <Pressable
            testID="legacy-picker-import"
            accessibilityRole="button"
            accessibilityLabel={`Import ${plural(selectedCount, "contact")}`}
            disabled={importing || selectedCount === 0}
            onPress={() => void importSelected()}
            style={[
              styles.importButton,
              {
                backgroundColor: colors.accent,
                opacity: importing || selectedCount === 0 ? 0.5 : 1,
              },
            ]}
          >
            <AppText role="label" style={{ color: colors.onAccent }}>
              Import ({selectedCount})
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {photoBudgetSheet}
    </View>
  );
}

function PickerMessage({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.message}>
      <AppText role="body" style={{ color: colors.textSecondary }}>
        {children}
      </AppText>
    </View>
  );
}

interface PermissionMessageProps {
  actionLabel: string;
  copy: string;
  onAction: () => void;
  /** The in-screen way out (D-57); absent on the priming screen. */
  onNotNow?: () => void;
  secondaryAction?: { copy: string; label: string; onPress: () => void };
}

function PermissionMessage({
  actionLabel,
  copy,
  onAction,
  onNotNow,
  secondaryAction,
}: PermissionMessageProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.permissionMessage}>
      <AppText
        role="body"
        style={[styles.permissionCopy, { color: colors.textSecondary }]}
      >
        {copy}
      </AppText>
      <Button role="primary" label={actionLabel} onPress={onAction} />
      {secondaryAction ? (
        <View style={styles.secondaryAction}>
          <AppText role="caption">{secondaryAction.copy}</AppText>
          <Button
            role="secondary"
            label={secondaryAction.label}
            onPress={secondaryAction.onPress}
          />
        </View>
      ) : null}
      {onNotNow ? (
        <Button role="tertiary" label="Not now" onPress={onNotNow} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, padding: 16, gap: 16 },
  message: { flex: 1, justifyContent: "center", alignItems: "center" },
  permissionMessage: { flex: 1, justifyContent: "center", gap: 16 },
  permissionCopy: { textAlign: "center" },
  secondaryAction: { alignItems: "center", gap: 8 },
  search: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  listContent: { gap: 8, paddingBottom: 8 },
  row: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  thumbnail: { width: 40, height: 40, borderRadius: 20 },
  rowCopy: { flex: 1, gap: 2 },
  checkbox: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 4,
  },
  importButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
});
