/**
 * ManageFavouritesScreen (DASH-06) — the shared "Manage favourites" reorder home
 * reached from the Settings row (Plan 10) and the favourites-chip Manage
 * affordance (Plan 09). Lists all non-archived favourites (`listFavourites`,
 * `favourite_rank ASC`) as avatar + name + a drag handle, and reorders them.
 *
 * Reorder-ONLY: marking / unmarking a favourite stays the profile star
 * (ContactProfileScreen) — this screen deliberately offers no unstar affordance
 * (UI-SPEC § Interaction States).
 *
 * A drag computes the new id order via the pure `computeReorder`
 * (favourites-reorder-logic) and persists it via the transactional
 * `rewriteFavouriteRanks` (favourites-dao) — ranks 0..n-1 in ONE transaction.
 * The reorder math and the rank write are the existing, node-tested logic; this
 * screen only wires the gesture to them (never reimplements either, and never
 * nests `inWriteTransaction` — the DAO opens exactly one).
 *
 * Drag/animation is driven by `react-native-reorderable-list` (owner-approved at
 * the blocking legitimacy checkpoint, T-08-SC) on its own Reanimated worklets —
 * never per-frame React `setState` (CLAUDE.md animation rule). The library's
 * `ReorderableList` is a FlatList, so `Avatar`'s `recyclingKey` correctness
 * requirement (fed `contactId` + `cacheBust`) still holds.
 *
 * Mirrors the ArchivedContactsScreen chrome: themed root, a `goBack` Back
 * control, a 24/700 title. Every colour resolves through `useTheme().colors.*`
 * (CLAUDE.md / check:colors).
 */
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import ReorderableList, {
  type ReorderableListReorderEvent,
  useReorderableDrag,
} from "react-native-reorderable-list";
import { Avatar } from "@/components/Avatar";
import { getExecutor, localDateTime } from "@/db/database";
import { type FavouriteRow, listFavourites } from "@/db/dashboard-read";
import { rewriteFavouriteRanks } from "@/db/favourites-dao";
import { computeReorder } from "@/logic/favourites-reorder-logic";
import type { RootStackScreenProps } from "@/navigation/types";
import { type ThemePalette, useTheme } from "@/theme";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "manage-favourites";
const AVATAR_SIZE = 44;

/**
 * One reorderable row. Split into its own component because `useReorderableDrag`
 * is a hook that must run inside a `ReorderableList` cell — it returns the `drag`
 * starter bound to the dedicated handle (`onPressIn`, so grabbing the handle
 * begins the drag immediately). The rest of the row is inert (reorder-only).
 */
function FavouriteReorderRow({
  row,
  colors,
}: {
  row: FavouriteRow;
  colors: ThemePalette;
}) {
  const drag = useReorderableDrag();
  return (
    <View
      testID={`manage-favourites-row-${row.id}`}
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Avatar
        photo={row.photo}
        name={row.name}
        contactId={row.id}
        size={AVATAR_SIZE}
        cacheBust={row.modified_at}
      />
      <Text
        numberOfLines={1}
        style={[styles.rowName, { color: colors.textPrimary }]}
      >
        {row.name}
      </Text>
      <Pressable
        testID={`manage-favourites-handle-${row.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Reorder ${row.name}`}
        onPressIn={drag}
        style={styles.handle}
      >
        <Text style={[styles.handleGlyph, { color: colors.textSecondary }]}>
          ≡
        </Text>
      </Pressable>
    </View>
  );
}

export function ManageFavouritesScreen({
  navigation,
}: RootStackScreenProps<"ManageFavourites">) {
  const { colors } = useTheme();
  const [rows, setRows] = useState<FavouriteRow[]>([]);

  const load = useCallback(async () => {
    try {
      setRows(await listFavourites(getExecutor()));
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load favourites", err);
      Alert.alert("Couldn't load favourites", "Please go back and retry.");
    }
  }, []);

  // Focus-effect load with a cancelled-flag guard so a fast back-out can't set
  // state on an unmounted screen.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await listFavourites(getExecutor());
        if (!cancelled) {
          setRows(next);
        }
      } catch (err) {
        if (!cancelled) {
          Logger.error(LOG_SCOPE, "failed to load favourites", err);
          Alert.alert("Couldn't load favourites", "Please go back and retry.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(
    async (orderedIds: number[]) => {
      try {
        await rewriteFavouriteRanks(
          getExecutor(),
          orderedIds,
          localDateTime(),
        );
      } catch (err) {
        Logger.error(LOG_SCOPE, "failed to persist favourite order", err);
        Alert.alert("Couldn't save order", "Please try again.");
        // Re-read so the on-screen order matches what actually persisted.
        await load();
      }
    },
    [load],
  );

  const onReorder = useCallback(
    ({ from, to }: ReorderableListReorderEvent) => {
      setRows((prev) => {
        const currentIds = prev.map((r) => r.id);
        const newIds = computeReorder(currentIds, from, to);
        const byId = new Map(prev.map((r) => [r.id, r] as const));
        const nextRows = newIds.map((id) => byId.get(id) as FavouriteRow);
        void persist(newIds);
        return nextRows;
      });
    },
    [persist],
  );

  return (
    <View
      testID="manage-favourites-root"
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <Pressable
          testID="manage-favourites-back"
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
          Manage favourites
        </Text>
      </View>

      {rows.length === 0 ? (
        <View testID="manage-favourites-empty" style={styles.emptyState}>
          <Text style={[styles.emptyHeading, { color: colors.textPrimary }]}>
            No favourites yet
          </Text>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
            Mark a contact as a favourite from their profile, then come back here
            to reorder them.
          </Text>
        </View>
      ) : (
        <>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Drag to reorder
          </Text>
          <ReorderableList
            data={rows}
            onReorder={onReorder}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <FavouriteReorderRow row={item} colors={colors} />
            )}
            contentContainerStyle={styles.listContent}
          />
        </>
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
  hint: {
    fontSize: 13,
    fontWeight: "600",
  },
  listContent: {
    gap: 12,
    paddingBottom: 16,
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  rowName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  handle: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  handleGlyph: {
    fontSize: 22,
    fontWeight: "700",
  },
});
