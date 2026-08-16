/**
 * HomeScreen — the dashboard CORE (DASH-01/03/04/05/07). This IS the app's home
 * surface: a flat, status-sorted `listDashboard` population rendered as
 * `ContactCard`s, with the birthday banner, the contact-count header, the
 * hidden-population footer entries, a reliable freshness path, and cause-aware
 * empty/error states. The interactive controls (filter chips, sort control,
 * search box) land in Plan 09; this ships the default persisted sort/filter.
 *
 * FRESHNESS (DASH-07 / threat T-08-18): the list re-queries on `useFocusEffect`,
 * on an `AppState`→"active" listener, and via pull-to-refresh. It deliberately
 * does NOT subscribe to the connection-scoped SQLite change notification — that
 * mechanism is bound to this screen's own DB connection and is structurally blind
 * to the headless widget / notification "mark contacted" writes that happen on a
 * different connection, so it would silently miss cross-context updates. Focus +
 * foreground + pull is the only path that reflects those writes.
 *
 * READS (threat T-08-16/17): every read is async on-device SQLite (`listDashboard`
 * + the four counts via `getExecutor()`) guarded by a `cancelled` flag so a stale
 * async result can never clobber a newer one; no network sits on the read path,
 * and the DAO already scopes off_limits / unconfirmed-ai / archived rows in-query
 * (this screen performs no `.filter()` on private data).
 *
 * The empty-state decision is delegated to the pure, node-tested
 * `selectDashboardEmptyState` (08-07 Task 1) — no inline count arithmetic here
 * (review HIGH-2): first-run fires ONLY when all four populations are empty, so a
 * never-contacted-only or snoozed-only user gets the hidden-population pointer,
 * never "Add your first contact".
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import {
  AppState,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BirthdayBanner } from "@/components/BirthdayBanner";
import { ContactCard } from "@/components/ContactCard";
import { getExecutor } from "@/db/database";
import {
  countArchived,
  countLiveContacts,
  countNeverContacted,
  countSnoozed,
  type DashboardRow,
  listDashboard,
} from "@/db/dashboard-read";
import { selectDashboardEmptyState } from "@/logic/dashboard-empty-logic";
import type { RootStackParamList } from "@/navigation/types";
import { useDashboardPrefs } from "@/stores/dashboard-prefs-store";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "dashboard-home";

/** The four population counts feeding the header + the empty-state gate. */
interface PopulationCounts {
  live: number;
  neverContacted: number;
  snoozed: number;
  archived: number;
}

const ZERO_COUNTS: PopulationCounts = {
  live: 0,
  neverContacted: 0,
  snoozed: 0,
  archived: 0,
};

export function HomeScreen() {
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const sort = useDashboardPrefs((s) => s.sort);
  const filter = useDashboardPrefs((s) => s.filter);

  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [counts, setCounts] = useState<PopulationCounts>(ZERO_COUNTS);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * The single load: `listDashboard` + the four counts, guarded by a `cancelled`
   * flag it returns as its canceller. Every caller (focus, foreground, pull)
   * runs this same function; the guard drops a stale async result if a newer
   * query started before this one resolved.
   */
  const reload = useCallback(() => {
    let cancelled = false;
    (async () => {
      try {
        const exec = getExecutor();
        const [list, live, neverContacted, snoozed, archived] =
          await Promise.all([
            listDashboard(exec, { filter, sort }),
            countLiveContacts(exec),
            countNeverContacted(exec),
            countSnoozed(exec),
            countArchived(exec),
          ]);
        if (cancelled) return;
        setRows(list);
        setCounts({ live, neverContacted, snoozed, archived });
        setError(false);
      } catch (err) {
        Logger.error(LOG_SCOPE, "failed to load dashboard", err);
        if (!cancelled) {
          setRows([]);
          setError(true);
        }
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filter, sort]);

  // Freshness path 1 — re-query every time the dashboard regains focus.
  useFocusEffect(
    useCallback(() => {
      const cancel = reload();
      return cancel;
    }, [reload]),
  );

  // Freshness path 2 — re-query when the app returns to the foreground, so a
  // headless "mark contacted" write made while backgrounded is reflected. The
  // subscription (and any in-flight guard) is torn down on unmount.
  useEffect(() => {
    let cancelCurrent: (() => void) | undefined;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        cancelCurrent?.();
        cancelCurrent = reload();
      }
    });
    return () => {
      cancelCurrent?.();
      sub.remove();
    };
  }, [reload]);

  // Freshness path 3 — pull-to-refresh.
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    reload();
  }, [reload]);

  const goToProfile = useCallback(
    (contactId: number) => navigation.navigate("Profile", { contactId }),
    [navigation],
  );

  // The cause-aware empty state — delegated to the pure gate (no inline count
  // arithmetic; HIGH-2). `hasTerm: false` — there is no search box until Plan 09,
  // which threads the live term + chips into this same helper (MEDIUM-4).
  const emptyState = selectDashboardEmptyState({
    live: counts.live,
    neverContacted: counts.neverContacted,
    snoozed: counts.snoozed,
    archived: counts.archived,
    rowCount: rows.length,
    activeFilter: filter,
    hasTerm: false,
  });

  const listHeader = (
    <View style={styles.header}>
      <BirthdayBanner onPressContact={goToProfile} />
      {!error && counts.live > 0 ? (
        <Text
          testID="dashboard-header-count"
          style={[styles.countHeader, { color: colors.textSecondary }]}
        >
          {`${counts.live} contact${counts.live === 1 ? "" : "s"}`}
        </Text>
      ) : null}
    </View>
  );

  const listFooter = error ? null : (
    <View style={styles.footer}>
      <Pressable
        testID="dashboard-not-yet-contacted-entry"
        accessibilityRole="button"
        accessibilityLabel={`Not yet contacted (${counts.neverContacted})`}
        onPress={() => navigation.navigate("NeverContacted")}
        style={[
          styles.footerEntry,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.footerText, { color: colors.textPrimary }]}>
          {`Not yet contacted (${counts.neverContacted})`}
        </Text>
      </Pressable>
      <Pressable
        testID="dashboard-archived-entry"
        accessibilityRole="button"
        accessibilityLabel="Archived"
        onPress={() => navigation.navigate("Archived")}
        style={[
          styles.footerEntry,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.footerText, { color: colors.textPrimary }]}>
          Archived
        </Text>
      </Pressable>
    </View>
  );

  const listEmpty = error ? (
    <View testID="dashboard-error-state" style={styles.emptyState}>
      <Text style={[styles.emptyHeading, { color: colors.textPrimary }]}>
        Couldn't load your contacts
      </Text>
      <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
        Pull down to try again.
      </Text>
    </View>
  ) : emptyState === "firstrun" ? (
    <View style={styles.emptyState}>
      <Pressable
        testID="dashboard-empty-firstrun"
        accessibilityRole="button"
        accessibilityLabel="Add your first contact"
        onPress={() => navigation.navigate("Create")}
        style={[
          styles.primaryCta,
          { backgroundColor: colors.accent, borderColor: colors.accent },
        ]}
      >
        <Text style={[styles.primaryCtaText, { color: colors.background }]}>
          Add your first contact
        </Text>
      </Pressable>
    </View>
  ) : emptyState === "hidden" ? (
    <View testID="dashboard-empty-hidden" style={styles.emptyState}>
      <Text style={[styles.emptyHeading, { color: colors.textPrimary }]}>
        Everyone's tucked away
      </Text>
      {counts.neverContacted > 0 ? (
        <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
          {`${counts.neverContacted} not yet contacted →`}
        </Text>
      ) : null}
      {counts.snoozed > 0 ? (
        <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
          {`${counts.snoozed} snoozed`}
        </Text>
      ) : null}
      {counts.archived > 0 ? (
        <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
          {`${counts.archived} archived`}
        </Text>
      ) : null}
    </View>
  ) : emptyState === "filter-empty" ? (
    // A calm generic empty region for a persisted non-'all' filter. The
    // filter-specific copy ('No favourites yet' / 'No one in {category}') and the
    // search-empty state are completed in Plan 09 when the chips + search box ship
    // and thread `activeFilter` / `hasTerm` into the same gate (MEDIUM-4).
    <View testID="dashboard-empty-filter" style={styles.emptyState}>
      <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
        Nothing here right now.
      </Text>
    </View>
  ) : null;

  return (
    <View
      testID="dashboard-root"
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <FlatList
        data={error ? [] : rows}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
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
            onPress={() => goToProfile(item.id)}
          />
        )}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 10,
  },
  header: {
    gap: 10,
    marginBottom: 4,
  },
  countHeader: {
    fontSize: 13,
    fontWeight: "600",
  },
  footer: {
    gap: 10,
    marginTop: 12,
  },
  footerEntry: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  footerText: {
    fontSize: 16,
    fontWeight: "600",
  },
  emptyState: {
    gap: 8,
    marginTop: 24,
    alignItems: "flex-start",
  },
  emptyHeading: {
    fontSize: 18,
    fontWeight: "700",
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 21,
  },
  primaryCta: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryCtaText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
