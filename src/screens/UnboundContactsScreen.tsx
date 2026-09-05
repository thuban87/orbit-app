import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Avatar } from "@/components/Avatar";
import { ShellAppBar } from "@/components/ShellAppBar";
import { getExecutor } from "@/db/database";
import { listUnbound, type UnboundRow } from "@/db/unbound-read";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import {
  filterUnboundByName,
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
  const [term, setTerm] = useState("");
  const hasTerm = term.trim() !== "";
  const filteredRows = rows === null ? [] : filterUnboundByName(rows, term);

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
      <ShellAppBar variant="child" title="Unbound contacts" />

      {error ? (
        <View testID="unbound-contacts-error" style={styles.screenState}>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
            Couldn&apos;t load contacts. Please go back and retry.
          </Text>
        </View>
      ) : rows === null ? (
        <View testID="unbound-contacts-loading" style={styles.screenState}>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
            Loading contacts…
          </Text>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.searchRow}>
            <TextInput
              testID="unbound-contacts-search-input"
              accessibilityLabel="Search unbound contacts"
              autoCapitalize="none"
              value={term}
              onChangeText={setTerm}
              placeholder="Search unbound contacts"
              placeholderTextColor={colors.textSecondary}
              style={[
                styles.searchInput,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                },
              ]}
            />
            {term !== "" ? (
              <Pressable
                testID="unbound-contacts-search-clear"
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setTerm("")}
                style={styles.searchClear}
              >
                <Text style={{ color: colors.textSecondary }}>✕</Text>
              </Pressable>
            ) : null}
          </View>

          {rows.length === 0 ? (
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
            <>
              <Text
                testID="unbound-contacts-count"
                style={[styles.count, { color: colors.textSecondary }]}
              >
                {hasTerm
                  ? unboundCountLabel(filteredRows.length, { matching: true })
                  : unboundCountLabel(rows.length)}
              </Text>
              {hasTerm && filteredRows.length === 0 ? (
                <View testID="unbound-contacts-no-match" style={styles.emptyState}>
                  <Text style={[styles.emptyHeading, { color: colors.textPrimary }]}>
                    No matching unbound contacts
                  </Text>
                  <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
                    Try another name.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={filteredRows}
                  keyExtractor={(item) => String(item.id)}
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
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
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
                          style={[
                            styles.unboundLabel,
                            { color: colors.textSecondary },
                          ]}
                        >
                          Unbound
                        </Text>
                      </View>
                    </Pressable>
                  )}
                />
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, padding: 16, gap: 16 },
  screenState: { padding: 16, gap: 8, marginTop: 8 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: "400",
  },
  searchClear: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
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
