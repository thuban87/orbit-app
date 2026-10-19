/**
 * OptionSheet (38.9 D-28) — the one themed single-choice sheet. It replaces
 * every native `@react-native-picker/picker` spinner and the custom-field
 * "Met via" dropdown, at every list length. Built from `CategoryChoiceSheet`,
 * which is now a thin wrapper over it.
 *
 * - An expanded `Sheet` + a `FlatList` (the proven category-sheet
 *   shape; `sheet-consumers-contract.test.ts` needs no opt-out for it). It is
 *   a BaseOverlay sheet, so it registers as open and hosts snackbars (D-24).
 * - Search shows only when `searchable` (default: `shouldSearch` over the
 *   option count). The query resets when the sheet closes or stops being
 *   searchable.
 * - Selected row (D-05 top tier): `accent` fill, `onAccent` label. Selection
 *   never depends on colour alone (38.4 RG-030): the row carries
 *   `accessibilityState.selected` and a filled `select` glyph in `onAccent`.
 * - A pick calls `onSelect` and then `onRequestClose`.
 * - Sized path (38.13 D-71, D-78): with `size` set the sheet opens at that
 *   compact or detail size instead, as a content-sized sheet that opts out of
 *   the scroll body (`scrollBody={false}`), so its FlatList is the only scroll
 *   container and shrinks under the cap. Without `size` (every caller but the
 *   bulk Set Category sheet) the expanded block renders exactly as before.
 *   Both blocks render the same `renderOption` row.
 *
 * Colours come from `useUnscopedTheme()` because this component sits in its
 * caller's (possibly glass) scope while it draws an opaque overlay surface,
 * as ConfirmDialog does. No colour literal (check:colors).
 */
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Icon } from "@/components/icons/Icon";
import { useUnscopedTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { AppText } from "./AppText";
import {
  type OptionSheetOption,
  type OptionSheetRow,
  type OptionValue,
  optionKey,
  optionSheetModel,
  shouldSearch,
} from "./option-sheet-logic";
import { Sheet } from "./Sheet";

export interface OptionSheetProps<T extends OptionValue> {
  visible: boolean;
  /** The sheet heading, e.g. the field name. */
  title: string;
  options: readonly OptionSheetOption<T>[];
  /** The current value. A value not in `options` simply marks no row. */
  selected: T | OptionValue;
  /** Show the search field; defaults to `shouldSearch(options.length)`. */
  searchable?: boolean;
  /** Search field label and placeholder. */
  searchLabel?: string;
  /** Copy shown when a search matches nothing. */
  emptyText?: (query: string) => string;
  /**
   * Opens the sheet at this size, sized to its content (38.13 D-71). Absent →
   * today's expanded sheet. A caller picks it from `optionSheetVariantFor`.
   */
  size?: "compact" | "detail";
  onSelect: (value: T) => void;
  onRequestClose: () => void;
}

export function OptionSheet<T extends OptionValue>({
  visible,
  title,
  options,
  selected,
  searchable: searchableProp,
  searchLabel = "Search",
  emptyText = (query) => `Nothing matches “${query}”.`,
  size,
  onSelect,
  onRequestClose,
}: OptionSheetProps<T>) {
  const { colors } = useUnscopedTheme();
  const [query, setQuery] = useState("");
  const searchable = searchableProp ?? shouldSearch(options.length);
  const model = useMemo(
    () => optionSheetModel({ options, selected, query, searchable }),
    [options, selected, query, searchable],
  );
  useEffect(() => {
    if ((!visible || !searchable) && query) setQuery("");
  }, [searchable, query, visible]);

  // The one option row both lists render (RG-030: selection is never colour
  // alone; D-05 top tier).
  const renderOption = ({ item }: { item: OptionSheetRow<T> }) => {
    const isSelected = item.selected;
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel={item.accessibilityLabel ?? item.label}
        accessibilityState={{ selected: isSelected }}
        onPress={() => {
          onSelect(item.value);
          onRequestClose();
        }}
        style={[
          styles.row,
          {
            backgroundColor: isSelected ? colors.accent : colors.surface,
            borderColor: isSelected ? colors.accent : colors.border,
          },
        ]}
      >
        <AppText
          style={[
            styles.rowLabel,
            {
              color: isSelected ? colors.onAccent : colors.textPrimary,
            },
          ]}
        >
          {item.label}
        </AppText>
        {isSelected ? (
          <Icon name="select" state="active" tone="onAccent" />
        ) : null}
      </Pressable>
    );
  };
  const heading = (
    <AppText role="heading" accessibilityRole="header">
      {title}
    </AppText>
  );
  const search = searchable ? (
    <TextInput
      accessibilityLabel={searchLabel}
      value={query}
      onChangeText={setQuery}
      placeholder={searchLabel}
      placeholderTextColor={colors.textPlaceholder}
      style={[
        styles.search,
        {
          color: colors.textPrimary,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    />
  ) : null;
  const emptyList = (
    <AppText style={{ color: colors.textSecondary }}>
      {emptyText(model.query)}
    </AppText>
  );

  if (size === undefined) {
    return (
      <Sheet
        visible={visible}
        onRequestClose={onRequestClose}
        variant="expanded"
      >
        <View style={styles.root}>
          {heading}
          {search}
          <FlatList
            data={model.rows}
            keyExtractor={(row) => optionKey(row.value)}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={emptyList}
            renderItem={renderOption}
          />
        </View>
      </Sheet>
    );
  }

  const fitsCompact = size === "compact";
  // biome-ignore format: one-line opener, so the sheet-consumers contract and
  // the plan's acceptance check read the sized variant and opt-out together.
  return (
    <Sheet visible={visible} onRequestClose={onRequestClose} variant={fitsCompact ? "compact" : "detail"} scrollBody={false}>
      <View style={styles.sizedRoot}>
        {heading}
        {search}
        <FlatList
          style={styles.sizedList}
          data={model.rows}
          keyExtractor={(row) => optionKey(row.value)}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={emptyList}
          renderItem={renderOption}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: SPACING.md },
  // Sized path (D-71): content height until the sheet's cap, then the list
  // shrinks and scrolls (the opted-out Sheet body is a shrinkable View).
  sizedRoot: { flexShrink: 1, minHeight: 0, gap: SPACING.md },
  sizedList: { flexGrow: 0, flexShrink: 1 },
  search: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADII.md,
    paddingHorizontal: SPACING.md,
  },
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADII.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  rowLabel: { flex: 1 },
});
