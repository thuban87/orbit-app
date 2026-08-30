import { Image } from "expo-image";
import { useEffect, useMemo, useRef, useState } from "react";
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
  getContactsPermission,
  requestContactsPermission,
} from "@/services/contacts/use-read-contacts-permission";
import { getDeviceRegion } from "@/services/device-region";
import { routePickedImport } from "@/services/import/import-acquire";
import { useTheme } from "@/theme";
import {
  listContactsSummary,
  readAllContacts,
} from "../../modules/orbit-contact-picker";

type LoadState = "loading" | "denied" | "ready" | "error";

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

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const current = await getContactsPermission();
      const permission = current.granted
        ? current
        : await requestContactsPermission();
      if (!active) return;
      if (!permission.granted) {
        setLoadState("denied");
        return;
      }

      try {
        // Summary-only browse data: no full photos are staged until Import.
        const summaries = await listContactsSummary();
        if (!active) return;
        setRows(toPickerRows(summaries));
        setLoadState("ready");
      } catch {
        if (!active) return;
        setLoadState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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
        <PickerMessage>Loading contacts…</PickerMessage>
      ) : loadState === "denied" ? (
        <PickerMessage>
          Contact access is needed to choose contacts to import.
        </PickerMessage>
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
