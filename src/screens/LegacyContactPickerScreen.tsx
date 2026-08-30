import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getAppSettings } from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import type { RootStackScreenProps } from "@/navigation/types";
import {
  getContactsPermission,
  requestContactsPermission,
} from "@/services/contacts/use-read-contacts-permission";
import { getDeviceRegion } from "@/services/device-region";
import { routePickedImport } from "@/services/import/import-acquire";
import { useTheme } from "@/theme";
import {
  type PickedContact,
  readAllContacts,
} from "../../modules/orbit-contact-picker";

type LoadState = "loading" | "denied" | "ready" | "error";

/**
 * The deliberately minimal API <= 36 picker. Plans 03/04 add its search,
 * avatars, and full permission states; this tracer keeps a real virtualized
 * multi-select path into the shared import session pipeline.
 */
export function LegacyContactPickerScreen({
  navigation,
}: RootStackScreenProps<"LegacyContactPicker">) {
  const { colors } = useTheme();
  const [contacts, setContacts] = useState<PickedContact[]>([]);
  const [selectedLookupKeys, setSelectedLookupKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const current = await getContactsPermission();
      const permission = current.granted
        ? current
        : await requestContactsPermission();
      if (!permission.granted) {
        if (active) setLoadState("denied");
        return;
      }

      try {
        const next = await readAllContacts();
        if (active) {
          setContacts(next);
          setLoadState("ready");
        }
      } catch {
        if (active) {
          setLoadState("error");
          Alert.alert("Couldn't import contacts", "Please try again.");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selectedContacts = useMemo(
    () =>
      contacts.filter((contact) => selectedLookupKeys.has(contact.lookupKey)),
    [contacts, selectedLookupKeys],
  );

  function toggleSelection(lookupKey: string) {
    setSelectedLookupKeys((current) => {
      const next = new Set(current);
      if (next.has(lookupKey)) next.delete(lookupKey);
      else next.add(lookupKey);
      return next;
    });
  }

  async function importSelected() {
    if (importing || selectedContacts.length === 0) return;
    setImporting(true);
    try {
      const exec = getExecutor();
      const settings = await getAppSettings(exec);
      await routePickedImport(
        exec,
        selectedContacts,
        {
          effectivePhoneRegion:
            settings.phoneRegionOverride ?? getDeviceRegion(),
          // Read settings and clock when the user imports, not when the picker
          // opened: a long-open picker should use current local settings.
          now: localDateTime(),
        },
        navigation,
      );
    } catch {
      Alert.alert("Couldn't import contacts", "Please try again.");
    } finally {
      setImporting(false);
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
        <View style={styles.message}>
          <Text style={{ color: colors.textSecondary }}>Loading contacts…</Text>
        </View>
      ) : loadState === "denied" ? (
        <View style={styles.message}>
          <Text style={{ color: colors.textSecondary }}>
            Contact access is needed to choose contacts to import.
          </Text>
        </View>
      ) : loadState === "error" ? (
        <View style={styles.message}>
          <Text style={{ color: colors.textSecondary }}>
            Couldn&apos;t read contacts. Please go back and try again.
          </Text>
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(contact) => contact.lookupKey}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.message}>
              <Text style={{ color: colors.textSecondary }}>
                No contacts available to import.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const selected = selectedLookupKeys.has(item.lookupKey);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={item.displayName ?? "Unnamed contact"}
                onPress={() => toggleSelection(item.lookupKey)}
                style={[
                  styles.row,
                  {
                    backgroundColor: colors.surface,
                    borderColor: selected ? colors.accent : colors.border,
                  },
                ]}
              >
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
                <Text
                  numberOfLines={1}
                  style={[styles.rowName, { color: colors.textPrimary }]}
                >
                  {item.displayName ?? "Unnamed contact"}
                </Text>
              </Pressable>
            );
          }}
        />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Import ${selectedContacts.length} contacts`}
        disabled={importing || selectedContacts.length === 0}
        onPress={() => void importSelected()}
        style={[
          styles.importButton,
          {
            backgroundColor: colors.accent,
            opacity: importing || selectedContacts.length === 0 ? 0.5 : 1,
          },
        ]}
      >
        <Text style={{ color: colors.background, fontWeight: "600" }}>
          Import ({selectedContacts.length})
        </Text>
      </Pressable>
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
  listContent: { gap: 8, paddingBottom: 8 },
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 4,
  },
  rowName: { flex: 1, fontSize: 16 },
  importButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
});
