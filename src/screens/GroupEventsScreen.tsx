// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button/AppText `role` is a domain prop, not ARIA.
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Icon } from "@/components/icons/Icon";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText, Button } from "@/components/ui";
import { ChromeScrim } from "@/components/ui/ChromeScrim";
import { getExecutor } from "@/db/database";
import {
  type GroupEventListItem,
  listGroupEvents,
  searchGroupEvents,
} from "@/db/group-events-read";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";

function displayDateTime(value: string): string {
  const [date, time] = value.split(" ");
  return time ? `${date} · ${time.slice(0, 5)}` : date;
}

export function GroupEventsScreen({
  navigation,
}: RootStackScreenProps<"GroupEvents">) {
  const { colors } = useTheme();
  const [items, setItems] = useState<GroupEventListItem[]>([]);
  const [term, setTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (nextTerm: string) => {
    setLoading(true);
    setFailed(false);
    try {
      const next = nextTerm.trim()
        ? await searchGroupEvents(getExecutor(), { term: nextTerm })
        : await listGroupEvents(getExecutor(), {});
      setItems(next);
    } catch {
      setFailed(true);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(term);
    }, [load, term]),
  );
  const emptyCopy = useMemo(
    () => (term.trim() ? `No group events match "${term.trim()}".` : null),
    [term],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ShellAppBar
        variant="child"
        title="Group Events"
        trailing={
          <Button
            role="iconOnly"
            icon="search"
            accessibilityLabel="Search group events"
            onPress={() => setSearchOpen((open) => !open)}
          />
        }
      />
      {searchOpen ? (
        <View style={styles.searchWrap}>
          <TextInput
            accessibilityLabel="Search group events"
            autoFocus
            placeholder="Search title or participant"
            placeholderTextColor={colors.textSecondary}
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
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={
            items.length === 0 ? styles.emptyList : styles.list
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View group event ${item.title}`}
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
                  {displayDateTime(item.occurredAt)}
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
              <AppText role="heading">
                {failed
                  ? "Couldn't load group events"
                  : (emptyCopy ?? "No group events yet")}
              </AppText>
              <AppText role="body" style={{ color: colors.textSecondary }}>
                {failed
                  ? "Please go back and try again."
                  : (emptyCopy ??
                    "Log a get-together with several people at once from the + button, or from Group Log on any contact.")}
              </AppText>
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
