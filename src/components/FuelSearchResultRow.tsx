/**
 * FuelSearchResultRow (FUEL-05) — the ONE reusable, purely PRESENTATIONAL row a
 * cross-contact fuel search renders per hit: an Avatar + the contact name + the
 * matched fuel snippet (or nothing on a name-only match).
 *
 * It is deliberately dumb — NO DB read, NO navigation, NO `getExecutor` — so
 * Phase 8 can drop it straight under the dashboard search box without a rewrite
 * (the Search Surface Decision in 07-UI-SPEC.md: Phase 7 builds the query +
 * result-row as reusable units; Phase 8 owns the final home). The caller wires
 * the tap via `onPress`.
 *
 * `searchFuel` returns no photo (a lean projection), so the Avatar renders its
 * themed initials swatch from the name — `photo={null}` is the intended state.
 *
 * Every colour resolves through `useTheme().colors.*` — no colour literal
 * (CLAUDE.md / check:colors).
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { useTheme } from "@/theme";

interface FuelSearchResultRowProps {
  /** The matching contact's id — passed back to `onPress`, never read here. */
  contactId: number;
  /** The contact's display name (Body line + Avatar initials/swatch source). */
  name: string;
  /** A matching fuel snippet, or null on a name-only match (then nothing shows). */
  snippet: string | null;
  /** Caller wires navigation — the row stays presentational. */
  onPress: () => void;
}

export function FuelSearchResultRow({
  contactId,
  name,
  snippet,
  onPress,
}: FuelSearchResultRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={`fuel-search-row-${contactId}`}
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={onPress}
      style={[styles.row, { borderColor: colors.border }]}
    >
      <Avatar photo={null} name={name} contactId={contactId} size={36} />
      <View style={styles.text}>
        <Text
          numberOfLines={1}
          style={[styles.name, { color: colors.textPrimary }]}
        >
          {name}
        </Text>
        {snippet !== null ? (
          <Text
            numberOfLines={1}
            style={[styles.snippet, { color: colors.textSecondary }]}
          >
            {snippet}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: "400",
  },
  snippet: {
    fontSize: 13,
    fontWeight: "600",
  },
});
