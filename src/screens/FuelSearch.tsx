/**
 * FuelSearch (FUEL-05) — the minimal, self-contained cross-contact fuel search
 * surface. A themed input drives `searchFuel` (the DAO choke point, fuel-read.ts)
 * and renders one reusable `FuelSearchResultRow` per hit; a tap opens that
 * contact's Profile.
 *
 * SEARCH SURFACE DECISION (07-UI-SPEC.md): Phase 7 ships this minimal screen,
 * reached from Settings, so FUEL-05 is genuinely built and testable now; Phase 8
 * owns the final home (the dashboard search box) and will ABSORB the query +
 * `FuelSearchResultRow` — Phase 8 relocating the box is expected, not a reversal.
 * The exclusions (off_limits, unconfirmed 'ai', archived) live IN `searchFuel`'s
 * query, never here — this screen never filters results.
 *
 * Mirrors the `CustomFieldsScreen` chrome (ScrollView-free FlatList root over a
 * themed background, a header with a `goBack` Back control + 24/700 title). Every
 * colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { FuelSearchResultRow } from "@/components/FuelSearchResultRow";
import { getExecutor } from "@/db/database";
import { type FuelSearchResult, searchFuel } from "@/db/fuel-read";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "fuel-search";

export function FuelSearch() {
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<FuelSearchResult[]>([]);

  const isIdle = term.trim() === "";

  // Query on every change. `searchFuel` guards an empty/whitespace term (returns
  // []) so idle needs no special-casing here; a cancelled flag drops a stale
  // async result if the term moved on before the read resolved.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await searchFuel(getExecutor(), term);
        if (!cancelled) setResults(rows);
      } catch (err) {
        Logger.error(LOG_SCOPE, "search failed", err);
        if (!cancelled) setResults([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [term]);

  return (
    <View
      testID="fuel-search-screen"
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <Pressable
          testID="fuel-search-back"
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
          Search
        </Text>
      </View>

      <TextInput
        testID="fuel-search-input"
        value={term}
        onChangeText={setTerm}
        placeholder="Search names and fuel"
        placeholderTextColor={colors.textSecondary}
        autoCorrect={false}
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.textPrimary,
          },
        ]}
      />

      {isIdle ? (
        <Text
          testID="fuel-search-idle"
          style={[styles.note, { color: colors.textSecondary }]}
        >
          Search your contacts and everything you've saved to talk about.
        </Text>
      ) : results.length === 0 ? (
        <Text
          testID="fuel-search-empty"
          style={[styles.note, { color: colors.textSecondary }]}
        >
          No matches
        </Text>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.contactId)}
          renderItem={({ item }) => (
            <FuelSearchResultRow
              contactId={item.contactId}
              name={item.name}
              snippet={item.snippet}
              onPress={() =>
                navigation.navigate("Profile", { contactId: item.contactId })
              }
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  note: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
});
