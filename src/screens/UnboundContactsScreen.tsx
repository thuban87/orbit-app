import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { getExecutor } from "@/db/database";
import { listUnbound, type UnboundRow } from "@/db/unbound-read";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import {
  unboundCountLabel,
  unboundRowAccessibilityLabel,
} from "./unbound-list-logic";

const LOG_SCOPE = "unbound-contacts";

/** Dedicated, deliberately neutral browse surface for contacts outside the active orbit. */
export function UnboundContactsScreen({
  navigation,
}: RootStackScreenProps<"UnboundContacts">) {
  const { colors } = useTheme();
  const [rows, setRows] = useState<UnboundRow[] | null>(null);
  const [error, setError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        try {
          const next = await listUnbound(getExecutor());
          if (!cancelled) {
            setRows(next);
            setError(false);
          }
        } catch (err) {
          Logger.error(LOG_SCOPE, "failed to load Unbound contacts", err);
          if (!cancelled) {
            setRows(null);
            setError(true);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <View
      testID="unbound-contacts-screen"
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <Pressable
          testID="unbound-contacts-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textSecondary }}>Back</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.textPrimary }]}
        >
          Unbound contacts
        </Text>
      </View>

      {error ? (
        <View testID="unbound-contacts-error" style={styles.emptyState}>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
            Couldn&apos;t load contacts. Please go back and retry.
          </Text>
        </View>
      ) : rows === null ? (
        <View testID="unbound-contacts-loading" style={styles.emptyState}>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
            Loading contacts…
          </Text>
        </View>
      ) : rows.length === 0 ? (
        <View testID="unbound-contacts-empty" style={styles.emptyState}>
          <Text style={[styles.emptyHeading, { color: colors.textPrimary }]}>
            No unbound contacts
          </Text>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
            Contacts you unbind stay here, with their details and history ready
            when you want to bind them again.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={
            <Text
              testID="unbound-contacts-count"
              style={[styles.count, { color: colors.textSecondary }]}
            >
              {unboundCountLabel(rows.length)}
            </Text>
          }
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              testID={`unbound-contacts-row-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={unboundRowAccessibilityLabel(item.name, null)}
              onPress={() =>
                navigation.navigate("Profile", { contactId: item.id })
              }
              style={[
                styles.row,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Avatar
                photo={item.photo}
                name={item.name}
                contactId={item.id}
                cacheBust={item.modified_at}
                size={40}
              />
              <View style={styles.rowText}>
                <Text
                  numberOfLines={1}
                  style={[styles.rowName, { color: colors.textPrimary }]}
                >
                  {item.name}
                </Text>
                <Text
                  style={[styles.unboundLabel, { color: colors.textSecondary }]}
                >
                  Unbound
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  title: { fontSize: 24, fontWeight: "600" },
  count: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
  listContent: { gap: 8, paddingBottom: 16 },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  rowText: { flex: 1, gap: 4 },
  rowName: { fontSize: 16, fontWeight: "600" },
  unboundLabel: { fontSize: 13, fontWeight: "600" },
  emptyState: { gap: 8, marginTop: 24 },
  emptyHeading: { fontSize: 18, fontWeight: "600" },
  emptyBody: { fontSize: 15, lineHeight: 21 },
});
