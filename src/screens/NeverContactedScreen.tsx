/**
 * NeverContactedScreen (DASH-04) — the "Not yet contacted" sibling screen, the
 * inverse-population home reached from the dashboard's counted "Not yet contacted
 * (N)" footer entry (Plan 07 wires that entry; this plan owns the screen + route).
 *
 * It lists the never-contacted, non-archived population via `listNeverContacted`
 * (the sole `archived_at IS NULL AND last_contact IS NULL` inverse read, 08-01),
 * renders each row through the SAME shared `ContactCard` the dashboard uses (a
 * never-contacted row carries `status: null` → the card's neutral "Not yet
 * contacted" state; it still shows the ranked fuel line), and offers its OWN
 * three-way sort — Oldest added (DEFAULT) / Newest added / Name (A–Z) — distinct
 * from the dashboard's four-way sort (CONTEXT Area 1 / 08-UI-SPEC § Copywriting).
 *
 * READ-ONLY, async only, offline: the load runs `listNeverContacted(getExecutor())`
 * inside `useFocusEffect` with a cancelled-flag guard (FuelSearch pattern) so a
 * stale async result is dropped if focus/sort moved on, and re-runs on focus and on
 * sort change. No writer, no network, no `...Sync`. The exclusions live IN the
 * query (archived structurally excluded; off_limits / unconfirmed 'ai' / blank fuel
 * excluded by the ranked-fuel subquery) — this screen never `.filter()`s.
 *
 * Mirrors the ArchivedContactsScreen chrome (themed root over `colors.background`,
 * a header with a `goBack` Back control + 24/700 title; native-stack
 * `headerShown:false`). Every colour resolves through `useTheme().colors.*` — no
 * hex/named literal (CLAUDE.md / check:colors).
 */
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ContactCard } from "@/components/ContactCard";
import { getExecutor } from "@/db/database";
import { type DashboardRow, listNeverContacted } from "@/db/dashboard-read";
import type { NeverContactedSort } from "@/db/dashboard-read";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "never-contacted";

/**
 * The three sort options in their fixed order — Oldest added is the DEFAULT
 * (08-UI-SPEC § Copywriting: "Oldest added" / "Newest added" / "Name (A–Z)").
 * The keys are the `NeverContactedSort` union `listNeverContacted` already exposes.
 */
const SORT_OPTIONS: ReadonlyArray<{ key: NeverContactedSort; label: string }> = [
  { key: "oldest", label: "Oldest added" },
  { key: "newest", label: "Newest added" },
  { key: "name", label: "Name (A–Z)" },
];

export function NeverContactedScreen({
  navigation,
}: RootStackScreenProps<"NeverContacted">) {
  const { colors } = useTheme();
  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [sort, setSort] = useState<NeverContactedSort>("oldest");

  // Re-query on focus AND whenever the sort changes; a cancelled flag drops a
  // stale async result if focus is lost / the sort moved on before it resolves
  // (FuelSearch pattern). Async reads only — no `...Sync` on a read path.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const next = await listNeverContacted(getExecutor(), { sort });
          if (!cancelled) setRows(next);
        } catch (err) {
          Logger.error(LOG_SCOPE, "failed to load never-contacted list", err);
          if (!cancelled) setRows([]);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [sort]),
  );

  return (
    <View
      testID="never-contacted-root"
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <Pressable
          testID="never-contacted-back"
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
          Not yet contacted
        </Text>
      </View>

      {/* The screen's OWN three-way sort control (default Oldest added). Single
          active option, mirroring the FilterChipRow filled-accent idiom. */}
      <View
        testID="never-contacted-sort-control"
        style={styles.sortControl}
      >
        {SORT_OPTIONS.map((opt) => {
          const isActive = opt.key === sort;
          return (
            <Pressable
              key={opt.key}
              testID={`never-contacted-sort-${opt.key}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={opt.label}
              onPress={() => setSort(opt.key)}
              style={[
                styles.sortOption,
                isActive
                  ? {
                      backgroundColor: colors.accent,
                      borderColor: colors.borderStrong,
                    }
                  : {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.sortLabel,
                  {
                    color: isActive ? colors.background : colors.textSecondary,
                  },
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {rows.length === 0 ? (
        <View testID="never-contacted-empty" style={styles.emptyState}>
          <Text style={[styles.emptyHeading, { color: colors.textPrimary }]}>
            You've reached everyone
          </Text>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
            No one is waiting.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View testID={`never-contacted-card-${item.id}`}>
              <ContactCard
                contactId={item.id}
                name={item.name}
                photo={item.photo}
                modifiedAt={item.modified_at}
                status={item.status}
                categoryLabel={item.categoryLabel}
                isFavourite={item.favourite_rank !== null}
                fuelText={item.fuelText}
                snippet={item.snippet}
                onPress={() =>
                  navigation.navigate("Profile", { contactId: item.id })
                }
              />
            </View>
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
  sortControl: {
    flexDirection: "row",
    gap: 8,
  },
  sortOption: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  sortLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  emptyState: {
    gap: 8,
    marginTop: 8,
  },
  emptyHeading: {
    fontSize: 18,
    fontWeight: "700",
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 21,
  },
  listContent: {
    gap: 8,
    paddingBottom: 16,
  },
});
