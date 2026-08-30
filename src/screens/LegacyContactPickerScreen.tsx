import { Image } from "expo-image";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Avatar } from "@/components/Avatar";
import { getAppSettings } from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import {
  filterRows,
  selectionCount,
  toggleSelection,
} from "@/logic/contact-picker-selection";
import type { ContactPickerRow } from "@/logic/contact-picker-source";
import { toPickerRows } from "@/logic/contact-picker-source";
import type { RootStackScreenProps } from "@/navigation/types";
import {
  getContactsPermissionState,
  openContactsSettings,
  requestContactsPermission,
} from "@/services/contacts/use-read-contacts-permission";
import { getDeviceRegion } from "@/services/device-region";
import { routePickedImport } from "@/services/import/import-acquire";
import { useTheme } from "@/theme";
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

/** API <= 36's standalone, provider-backed multi-select contact picker. */
export function LegacyContactPickerScreen({
  navigation,
}: RootStackScreenProps<"LegacyContactPicker">) {
  const { colors } = useTheme();
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

  // Freshly CHECK on focus, including after app-info Settings. This deliberately
  // never requests permission: requests only happen after an explicit button tap.
  useFocusEffect(
    useCallback(() => {
      void refreshPermission();
    }, [refreshPermission]),
  );

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

  const filteredRows = useMemo(() => filterRows(rows, query), [rows, query]);
  const selectedCount = selectionCount(selectedLookupKeys);

  function onToggleSelection(lookupKey: string) {
    setSelectedLookupKeys((current) => toggleSelection(current, lookupKey));
  }

  async function importSelected() {
    if (importing || selectedCount === 0) return;
    const selectedKeys = [...selectedLookupKeys];
    setImporting(true);
    setOmittedCount(0);
    try {
      const result = await readAllContacts(selectedKeys);
      if (!mounted.current) return;
      if (result.omittedCount > 0) setOmittedCount(result.omittedCount);

      const exec = getExecutor();
      const settings = await getAppSettings(exec);
      if (!mounted.current) return;
      await routePickedImport(
        exec,
        result.contacts,
        {
          effectivePhoneRegion:
            settings.phoneRegionOverride ?? getDeviceRegion(),
          // Read settings and clock at Import, not when the picker opened.
          now: localDateTime(),
        },
        navigation,
      );
    } catch {
      if (mounted.current) setLoadState("error");
    } finally {
      if (mounted.current) setImporting(false);
    }
  }

  return (
    <View
      testID="legacy-contact-picker-screen"
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={[styles.back, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textSecondary }}>Back</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.textPrimary }]}
        >
          Import contacts
        </Text>
      </View>

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
          actionLabel="Grant access"
          copy="Contact access is needed to choose contacts to import."
          onAction={() => void requestAccess()}
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
        />
      ) : loadState === "error" ? (
        <PickerMessage>
          Couldn&apos;t read contacts. Please go back and try again.
        </PickerMessage>
      ) : (
        <>
          <TextInput
            accessibilityLabel="Search contacts"
            autoCapitalize="none"
            onChangeText={setQuery}
            placeholder="Search contacts"
            placeholderTextColor={colors.textSecondary}
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
            <Text style={[styles.notice, { color: colors.textSecondary }]}>
              {omittedCount} selected contact
              {omittedCount === 1 ? " is" : "s are"} no longer available.
            </Text>
          ) : null}
          <FlatList
            data={filteredRows}
            keyExtractor={(row) => row.lookupKey}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <PickerMessage>No contacts on this device</PickerMessage>
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
                    <Text
                      numberOfLines={1}
                      style={[styles.rowName, { color: colors.textPrimary }]}
                    >
                      {item.displayName}
                    </Text>
                    {item.primaryMethod ? (
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.subtitle,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {item.primaryMethod}
                      </Text>
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
                    <Text style={{ color: colors.background }}>
                      {selected ? "✓" : ""}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
          />
        </>
      )}

      {loadState === "ready" ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Import ${selectedCount} contacts`}
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
          <Text style={{ color: colors.background, fontWeight: "600" }}>
            Import ({selectedCount})
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function PickerMessage({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.message}>
      <Text style={{ color: colors.textSecondary }}>{children}</Text>
    </View>
  );
}

interface PermissionMessageProps {
  actionLabel: string;
  copy: string;
  onAction: () => void;
  secondaryAction?: { copy: string; label: string; onPress: () => void };
}

function PermissionMessage({
  actionLabel,
  copy,
  onAction,
  secondaryAction,
}: PermissionMessageProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.permissionMessage}>
      <Text style={[styles.permissionCopy, { color: colors.textSecondary }]}>
        {copy}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        onPress={onAction}
        style={[styles.permissionAction, { backgroundColor: colors.accent }]}
      >
        <Text style={{ color: colors.background, fontWeight: "600" }}>
          {actionLabel}
        </Text>
      </Pressable>
      {secondaryAction ? (
        <View style={styles.secondaryAction}>
          <Text style={{ color: colors.textSecondary }}>
            {secondaryAction.copy}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={secondaryAction.label}
            onPress={secondaryAction.onPress}
            style={[
              styles.settingsAction,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>
              {secondaryAction.label}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  title: { fontSize: 22, fontWeight: "700" },
  message: { flex: 1, justifyContent: "center", alignItems: "center" },
  permissionMessage: { flex: 1, justifyContent: "center", gap: 16 },
  permissionCopy: { fontSize: 16, lineHeight: 24, textAlign: "center" },
  permissionAction: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  secondaryAction: { alignItems: "center", gap: 8 },
  settingsAction: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  search: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  notice: { fontSize: 14 },
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
  rowName: { fontSize: 16 },
  subtitle: { fontSize: 14 },
  importButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
});
