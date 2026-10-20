// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button/AppText `role` is a domain prop, not ARIA.
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Icon } from "@/components/icons/Icon";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText, Button, EmptyState } from "@/components/ui";
import { ChromeScrim } from "@/components/ui/ChromeScrim";
import { EVENTS } from "@/constants/product-labels";
import { getExecutor } from "@/db/database";
import type { GroupEventListItem } from "@/db/group-events-read";
import type { RootStackScreenProps } from "@/navigation/types";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { formatDateTimeMinuteOrFallback } from "@/utils/dates";
import { createLatestRequestAuthority } from "@/utils/latest-request";
import {
  readEventsForTerm,
  runEventsSearch,
} from "./group-events-search-logic";

export function GroupEventsScreen({
  navigation,
}: RootStackScreenProps<"GroupEvents">) {
  const { colors } = useTheme();
  // The last item scrolls fully above the shell FAB (38.4 D-52, OA-E3).
  const bottomClearance = useBottomClearance();
  // Drives the term load: a refocus (Back from Event detail or Edit Event)
  // rereads the current term once, picking up a rename, dissolve or delete.
  const isFocused = useIsFocused();
  const [items, setItems] = useState<readonly GroupEventListItem[]>([]);
  const [term, setTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // Only the latest search may publish; blur invalidates outstanding reads
  // (38.14 D-25; ADR-162).
  const searchAuthority = useMemo(() => createLatestRequestAuthority(), []);
  // The spinner replaces the list only until a read settles while current, so
  // a first read cut off by a blur leaves the next one a first load.
  const firstLoadPendingRef = useRef(true);

  const load = useCallback(
    async (nextTerm: string) => {
      const settledCurrent = await runEventsSearch({
        gate: searchAuthority,
        term: nextTerm,
        isFirstLoad: firstLoadPendingRef.current,
        read: (searchTerm) => readEventsForTerm(getExecutor(), searchTerm),
        publish: (patch) => {
          if (patch.loading) {
            setLoading(true);
            return;
          }
          setItems(patch.items);
          setFailed(patch.failed);
          setLoading(false);
        },
      });
      if (settledCurrent) firstLoadPendingRef.current = false;
    },
    [searchAuthority],
  );

  // Closing search clears its term (D-25 "clears on close"). It does not
  // invalidate: a changed term starts a newer read that supersedes the old
  // one, and an unchanged blank term lets the in-flight read of that same
  // blank term publish, so the first-load spinner cannot stick.
  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setTerm("");
  }, []);

  // Focus lifecycle (stable deps, never `term`, so typing never runs it):
  // leaving the screen stops any in-flight read from publishing. It keeps the
  // term: opening a result and coming Back returns to the same search.
  useFocusEffect(
    useCallback(() => () => searchAuthority.invalidate(), [searchAuthority]),
  );

  // Term-driven load: every term change and every refocus reads once.
  useEffect(() => {
    if (!isFocused) return;
    void load(term);
  }, [isFocused, term, load]);

  // Android Back closes an open search first (D-25). Registered per focus, so
  // it is back after a blur and refocus with search still open.
  useFocusEffect(
    useCallback(() => {
      if (!searchOpen) return undefined;
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          closeSearch();
          return true;
        },
      );
      return () => subscription.remove();
    }, [searchOpen, closeSearch]),
  );

  // The one empty-state component (38.9 D-20), each state with its one action
  // (D-71): failed → "Try again", a search that found nothing → "Clear
  // search", none yet → "Log an event" (opens Group Log, no params; D-22 noun).
  const searchTerm = term.trim();
  const emptyState = failed ? (
    <EmptyState
      testID="events-empty-failed"
      icon="warning"
      heading="Couldn't load events"
      // A tab root has no Back (D-22); the list also rereads on focus.
      body="Try opening it again in a moment."
      action={{ label: "Try again", onPress: () => void load(term) }}
    />
  ) : searchTerm ? (
    <EmptyState
      testID="events-empty-search"
      icon="search"
      heading="No events match"
      term={searchTerm}
      body="Try a different title or participant."
      action={{ label: "Clear search", onPress: () => setTerm("") }}
    />
  ) : (
    <EmptyState
      testID="events-empty"
      icon="group-events"
      heading="No events yet"
      body="Log a get-together with several people at once from the + button, or from Group Log on any contact."
      action={{
        label: "Log an event",
        onPress: () => navigation.navigate("GroupLog"),
      }}
    />
  );

  return (
    // No page fill: the background art shows through, and every row is a full
    // (opaque `surface`) card over it (38.5, owner 2026-09-29).
    <View style={styles.root}>
      {/* Events is a tab root: root header, never a Back (D-22). */}
      <ShellAppBar
        variant="root"
        title={EVENTS}
        trailing={
          <Button
            role="iconOnly"
            icon="search"
            accessibilityLabel="Search events"
            onPress={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
          />
        }
      />
      {searchOpen ? (
        <View style={styles.searchWrap}>
          <TextInput
            accessibilityLabel="Search events"
            autoFocus
            placeholder="Search title or participant"
            placeholderTextColor={colors.textPlaceholder}
            value={term}
            onChangeText={setTerm}
            style={[
              styles.search,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
          />
        </View>
      ) : null}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accentText} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[
            items.length === 0 ? styles.emptyList : styles.list,
            { paddingBottom: bottomClearance },
          ]}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View event ${item.title}`}
              onPress={() =>
                navigation.navigate("GroupEventDetail", {
                  groupEventId: item.id,
                })
              }
              style={[
                styles.row,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.rowCopy}>
                <AppText role="label">{item.title}</AppText>
                <AppText role="caption" style={{ color: colors.textSecondary }}>
                  {formatDateTimeMinuteOrFallback(item.occurredAt)}
                </AppText>
                <AppText role="caption" style={{ color: colors.textSecondary }}>
                  {item.participantCount === 1
                    ? "1 participant"
                    : `${item.participantCount} participants`}
                </AppText>
              </View>
              <Icon name="forward" tone="textSecondary" size="sm" />
            </Pressable>
          )}
          ListEmptyComponent={
            <ChromeScrim style={styles.emptyPanel} radius={RADII.lg}>
              {emptyState}
            </ChromeScrim>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchWrap: { paddingHorizontal: SPACING.base, paddingTop: SPACING.sm },
  search: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADII.md,
    minHeight: 44,
    paddingHorizontal: SPACING.md,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { gap: SPACING.sm, padding: SPACING.base },
  emptyList: { flexGrow: 1, justifyContent: "center", padding: SPACING.base },
  emptyPanel: { alignItems: "center", gap: SPACING.sm, padding: SPACING.lg },
  row: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADII.md,
    flexDirection: "row",
    gap: SPACING.md,
    padding: SPACING.base,
  },
  rowCopy: { flex: 1, gap: SPACING.xs },
});
