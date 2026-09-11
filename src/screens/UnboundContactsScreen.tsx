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
import { ChromeScrim } from "@/components/ui/ChromeScrim";
import { getExecutor } from "@/db/database";
import { listUnbound, type UnboundRow } from "@/db/unbound-read";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
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
      style={styles.root}
    >
      <ShellAppBar variant="child" title="Unbound contacts" />

      {error ? (
        <ChromeScrim style={styles.screenStateScrim} radius={RADII.md}>
          <View testID="unbound-contacts-error" style={styles.screenState}>
            <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
              Couldn&apos;t load contacts. Please go back and retry.
            </Text>
          </View>
        </ChromeScrim>
      ) : rows === null ? (
        <ChromeScrim style={styles.screenStateScrim} radius={RADII.md}>
          <View testID="unbound-contacts-loading" style={styles.screenState}>
            <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
              Loading contacts…
            </Text>
          </View>
        </ChromeScrim>
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
            <ChromeScrim style={styles.emptyScrim} radius={RADII.md}>
              <View testID="unbound-contacts-empty" style={styles.emptyState}>
                <Text style={[styles.emptyHeading, { color: colors.textPrimary }]}>
                  No unbound contacts
                </Text>
                <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
                  Contacts you unbind stay here, with their details and history ready
                  when you want to bind them again.
                </Text>
              </View>
            </ChromeScrim>
          ) : (
            <>
              <ChromeScrim style={styles.countScrim} radius={RADII.sm}>
                <Text
                  testID="unbound-contacts-count"
                  style={[styles.count, { color: colors.textSecondary }]}
                >
                  {hasTerm
                    ? unboundCountLabel(filteredRows.length, { matching: true })
                    : unboundCountLabel(rows.length)}
                </Text>
              </ChromeScrim>
              {hasTerm && filteredRows.length === 0 ? (
                <ChromeScrim style={styles.emptyScrim} radius={RADII.md}>
                  <View testID="unbound-contacts-no-match" style={styles.emptyState}>
                    <Text style={[styles.emptyHeading, { color: colors.textPrimary }]}>
                      No matching unbound contacts
                    </Text>
                    <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
                      Try another name.
                    </Text>
                  </View>
                </ChromeScrim>
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
  count: { fontSize: 13, fontWeight: "600" },
  countScrim: {
    alignSelf: "flex-start",
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  emptyScrim: { padding: 16, overflow: "hidden" },
  screenStateScrim: { overflow: "hidden" },
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
