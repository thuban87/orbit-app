import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/icons/Icon";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { filterRows } from "@/logic/contact-picker-selection";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import {
  applyAdd,
  applyDeselect,
  type DerivedMemberRow,
  deriveMemberRows,
  type OverrideIntent,
  overrideCounts,
  type SystemMemberRow,
  toPickerRow,
} from "./manage-members-logic";

export interface ManageMembersGridProps {
  /** Rule-derived ids from ResolvedMembership.candidateIds; never re-derived here. */
  readonly candidateIds: readonly number[];
  readonly includeIds: readonly number[];
  readonly excludeIds: readonly number[];
  /**
   * Union of id-set display rows and the active Add People pool. The caller must
   * retain candidate/override rows even when they are unavailable to add anew.
   */
  readonly rows: readonly SystemMemberRow[];
  /** A delta for systems-dao.setSystemOverride(ref, contactId, mode | null). */
  readonly onChange: (intent: OverrideIntent) => void;
}

function displayName(row: SystemMemberRow): string {
  return row.name?.trim() || "Unnamed contact";
}

function tagFor(row: DerivedMemberRow): string | null {
  if (row.state === "excluded") return "Excluded";
  if (row.state === "added") return "Added";
  return null;
}

/** Controlled, virtualized System membership editor over shared picker logic. */
export function ManageMembersGrid({
  candidateIds,
  includeIds,
  excludeIds,
  rows,
  onChange,
}: ManageMembersGridProps) {
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const [addingPeople, setAddingPeople] = useState(false);
  const memberRows = useMemo(
    () => deriveMemberRows(candidateIds, includeIds, excludeIds, rows),
    [candidateIds, excludeIds, includeIds, rows],
  );
  const counts = useMemo(() => overrideCounts(memberRows), [memberRows]);
  const matchedKeys = useMemo(
    () =>
      new Set(
        filterRows(rows.map(toPickerRow), query).map((row) => row.lookupKey),
      ),
    [query, rows],
  );
  const filteredMembers = memberRows.filter((row) =>
    matchedKeys.has(String(row.id)),
  );
  const candidateSet = useMemo(() => new Set(candidateIds), [candidateIds]);
  const includeSet = useMemo(() => new Set(includeIds), [includeIds]);
  const addableRows = rows.filter(
    (row) =>
      row.available &&
      !candidateSet.has(row.id) &&
      !includeSet.has(row.id) &&
      matchedKeys.has(String(row.id)),
  );

  return (
    <View style={styles.root}>
      <AppText role="caption">
        {counts.total} members · {counts.added} added · {counts.excluded}{" "}
        excluded
      </AppText>
      <TextInput
        accessibilityLabel="Search members"
        autoCapitalize="none"
        onChangeText={setQuery}
        placeholder="Search members"
        placeholderTextColor={colors.textSecondary}
        value={query}
        style={[
          styles.search,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.textPrimary,
          },
        ]}
      />
      {/* biome-ignore lint/a11y/useValidAriaRole: Button's role is its design-system prop. */}
      <Button
        role="secondary"
        label="Add People"
        accessibilityLabel="Add People"
        onPress={() => setAddingPeople((current) => !current)}
      />
      {addingPeople ? (
        <View style={[styles.addPanel, { backgroundColor: colors.surface }]}>
          <AppText role="caption" style={{ color: colors.textSecondary }}>
            Searches your active contacts.
          </AppText>
          <FlatList
            data={addableRows}
            keyExtractor={(row) => `add-${row.id}`}
            keyboardShouldPersistTaps="handled"
            style={styles.addList}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: false }}
                accessibilityLabel={`Add ${displayName(item)}`}
                onPress={() => {
                  const intent = applyAdd(item);
                  if (intent) onChange(intent);
                }}
                style={[styles.addRow, { borderColor: colors.border }]}
              >
                <Avatar
                  photo={item.photo}
                  name={displayName(item)}
                  contactId={item.id}
                  size={40}
                />
                <AppText style={styles.rowName}>{displayName(item)}</AppText>
                <Icon name="add" tone="accentText" size="md" />
              </Pressable>
            )}
          />
        </View>
      ) : null}
      <FlatList
        data={filteredMembers}
        numColumns={2}
        keyExtractor={(row) => String(row.id)}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        ListEmptyComponent={
          <AppText role="caption" style={{ color: colors.textSecondary }}>
            No members match this search.
          </AppText>
        }
        renderItem={({ item }) => {
          const selected = item.state === "member" || item.state === "added";
          const tag = tagFor(item);
          const archived = item.state === "archived-added";
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled: archived }}
              accessibilityLabel={
                archived
                  ? `${displayName(item)} — Archived (unavailable)`
                  : displayName(item)
              }
              disabled={archived}
              onPress={() => onChange(applyDeselect(item))}
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: selected ? colors.accent : colors.border,
                },
                item.state === "excluded" && styles.excluded,
              ]}
            >
              <Avatar
                photo={item.photo}
                name={displayName(item)}
                contactId={item.id}
                size={48}
              />
              <AppText style={styles.cardName} numberOfLines={2}>
                {archived
                  ? `${displayName(item)} — Archived (unavailable)`
                  : displayName(item)}
              </AppText>
              {tag ? (
                <View
                  accessibilityLabel={tag}
                  style={[
                    styles.tag,
                    { backgroundColor: colors.surfaceElevated },
                  ]}
                >
                  <AppText
                    role="caption"
                    style={{ color: colors.textSecondary }}
                  >
                    {tag}
                  </AppText>
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: SPACING.md },
  search: {
    borderRadius: RADII.md,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: SPACING.md,
  },
  addPanel: { borderRadius: RADII.md, gap: SPACING.sm, padding: SPACING.md },
  addList: { maxHeight: 220 },
  addRow: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: SPACING.md,
    minHeight: 44,
    paddingVertical: SPACING.xs,
  },
  rowName: { flex: 1 },
  gridContent: { gap: SPACING.sm, paddingBottom: SPACING.base },
  gridRow: { gap: SPACING.sm },
  card: {
    alignItems: "center",
    borderRadius: RADII.md,
    borderWidth: 1,
    flex: 1,
    gap: SPACING.xs,
    minHeight: 140,
    padding: SPACING.md,
  },
  cardName: { textAlign: "center" },
  excluded: { opacity: 0.58 },
  tag: {
    borderRadius: RADII.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
});
