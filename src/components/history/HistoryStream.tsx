// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button/AppText `role` is a domain prop, not ARIA.
/**
 * HistoryStream (38.8 D-10, D-14, D-15, D-32..D-39) — the Profile History
 * stream: the contact's records newest first, grouped year → month → day.
 *
 * Presentational: the model and view state come in as props (built by the pure
 * `history-stream-logic.ts`), taps go out as callbacks, and it holds no React
 * state. It renders plain Views inside the Profile's own ScrollView — no nested
 * ScrollView, FlatList or SectionList; chunking keeps it bounded (D-39).
 *
 * A flat list (D-38): a year header, month headers, then each day label on its
 * own line with that day's records indented beneath and a thin divider between
 * days. No per-day cards, no gap markers (D-37), nothing sticky (D-32). Every
 * colour is a theme token read through `useTheme()` inside the glass card (D-07).
 *
 * Jumps (38.8 D-17, D-19/D-20/D-53): every day group and month group registers
 * its View as a measurable scroll target and reports its layout; a highlighted
 * day mounts the HistoryHighlight overlay, keyed by the jump generation.
 */
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "@/components/icons/Icon";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import type { CurrentStateFieldKey } from "@/db/memory-registry";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { HistoryHighlight } from "./HistoryHighlight";
import { HistoryRecordRow } from "./HistoryStreamRows";
import {
  dayNodeKey,
  emptyYearLabel,
  interactionCountLabel,
  isYearOpen,
  monthNodeKey,
  type StreamModel,
  type StreamViewState,
  type StreamYear,
  visibleYear,
  yearRowLabel,
} from "./history-stream-logic";

export interface HistoryStreamProps {
  model: StreamModel;
  state: StreamViewState;
  onExpandYear: (year: number) => void;
  onShowOlder: (year: number) => void;
  onOpenInteraction: (interactionId: number) => void;
  onOpenKnowledgeChange: (fieldKey: CurrentStateFieldKey) => void;
  /**
   * Each rendered day group's View, keyed by `dayNodeKey(date)`, and each month
   * group's View, keyed by `monthNodeKey(YYYY-MM)` (null when it unmounts) — the
   * scroll targets of a heatmap jump and a month jump (38.8 D-17, D-19/D-20).
   */
  registerNode: (key: string, node: View | null) => void;
  /** A day or month group laid out (a jump waiting for it scrolls then). */
  onNodeLayout: (key: string) => void;
  /**
   * The days a heatmap jump highlights, keyed by the jump generation (38.8
   * D-53/D-54); null when no highlight is showing.
   */
  highlight: HistoryStreamHighlight | null;
  testID?: string;
}

export interface HistoryStreamHighlight {
  readonly days: ReadonlySet<string>;
  readonly gen: number;
}

export function HistoryStream({
  model,
  state,
  onExpandYear,
  onShowOlder,
  onOpenInteraction,
  onOpenKnowledgeChange,
  registerNode,
  onNodeLayout,
  highlight,
  testID = "history-stream",
}: HistoryStreamProps) {
  return (
    <View testID={testID} style={styles.stream}>
      {model.years.map((entry) =>
        isYearOpen(state, model, entry.year) ? (
          <OpenYear
            key={entry.year}
            entry={entry}
            model={model}
            state={state}
            onShowOlder={onShowOlder}
            onOpenInteraction={onOpenInteraction}
            onOpenKnowledgeChange={onOpenKnowledgeChange}
            registerNode={registerNode}
            onNodeLayout={onNodeLayout}
            highlight={highlight}
            testID={testID}
          />
        ) : (
          <CollapsedYearRow
            key={entry.year}
            entry={entry}
            onExpandYear={onExpandYear}
            testID={testID}
          />
        ),
      )}
    </View>
  );
}

interface OpenYearProps {
  entry: StreamYear;
  model: StreamModel;
  state: StreamViewState;
  onShowOlder: (year: number) => void;
  onOpenInteraction: (interactionId: number) => void;
  onOpenKnowledgeChange: (fieldKey: CurrentStateFieldKey) => void;
  registerNode: (key: string, node: View | null) => void;
  onNodeLayout: (key: string) => void;
  highlight: HistoryStreamHighlight | null;
  testID: string;
}

interface CollapsedYearRowProps {
  entry: StreamYear;
  onExpandYear: (year: number) => void;
  testID: string;
}

/** An older year: one full-width row, '<year> · <n> interaction(s)' (D-35). */
function CollapsedYearRow({
  entry,
  onExpandYear,
  testID,
}: CollapsedYearRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={`${testID}-year-row-${entry.year}`}
      accessibilityRole="button"
      accessibilityState={{ expanded: false }}
      accessibilityLabel={yearRowLabel(entry.year, entry.interactionCount)}
      onPress={() => onExpandYear(entry.year)}
      style={[styles.yearRow, { borderColor: colors.border }]}
    >
      <Icon name="forward" tone="textSecondary" size="sm" />
      <AppText role="label">{String(entry.year)}</AppText>
      <AppText role="caption" style={{ color: colors.textSecondary }}>
        {`· ${interactionCountLabel(entry.interactionCount)}`}
      </AppText>
    </Pressable>
  );
}

function OpenYear({
  entry,
  model,
  state,
  onShowOlder,
  onOpenInteraction,
  onOpenKnowledgeChange,
  registerNode,
  onNodeLayout,
  highlight,
  testID,
}: OpenYearProps) {
  const { colors } = useTheme();
  const { months, hasOlder } = visibleYear(state, model, entry.year);
  return (
    <View testID={`${testID}-year-${entry.year}`}>
      <View
        accessibilityRole="header"
        style={[styles.yearHeader, { borderColor: colors.border }]}
      >
        <AppText
          role="label"
          style={[styles.yearHeaderText, { color: colors.textSecondary }]}
        >
          {String(entry.year)}
        </AppText>
      </View>
      {entry.records.length === 0 ? (
        <AppText
          role="caption"
          style={[styles.emptyYear, { color: colors.textSecondary }]}
        >
          {emptyYearLabel(entry.year)}
        </AppText>
      ) : (
        months.map((month) => (
          <View
            key={month.key}
            testID={`${testID}-month-${month.key}`}
            // A real native view starting at the month header, so a Jump to
            // date month jump can scroll to it and the picker can measure it
            // (38.8 D-17, D-50).
            collapsable={false}
            ref={(node) => registerNode(monthNodeKey(month.key), node)}
            onLayout={() => onNodeLayout(monthNodeKey(month.key))}
          >
            <AppText
              role="body"
              accessibilityRole="header"
              accessibilityLabel={month.accessibilityLabel}
              style={styles.month}
            >
              {month.label}
            </AppText>
            {month.days.map((day) => (
              <View
                key={day.date}
                testID={`${testID}-day-${day.date}`}
                // A real native view (never flattened) so a jump can measure it.
                collapsable={false}
                ref={(node) => registerNode(dayNodeKey(day.date), node)}
                onLayout={() => onNodeLayout(dayNodeKey(day.date))}
                style={[styles.day, { borderColor: colors.border }]}
              >
                {highlight?.days.has(day.date) ? (
                  // First child, so it paints behind the day's label and rows.
                  <HistoryHighlight key={highlight.gen} gen={highlight.gen} />
                ) : null}
                <AppText
                  role="label"
                  accessibilityLabel={day.accessibilityLabel}
                >
                  {day.label}
                </AppText>
                {day.records.map((item) => (
                  <HistoryRecordRow
                    key={item.key}
                    item={item}
                    onOpenInteraction={onOpenInteraction}
                    onOpenKnowledgeChange={onOpenKnowledgeChange}
                  />
                ))}
              </View>
            ))}
          </View>
        ))
      )}
      {hasOlder ? (
        <View style={styles.more}>
          <Button
            role="tertiary"
            label="Show older"
            accessibilityLabel={`Show older records from ${entry.year}`}
            testID={`${testID}-show-older-${entry.year}`}
            onPress={() => onShowOlder(entry.year)}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stream: {
    gap: SPACING.xs,
  },
  yearHeader: {
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  yearHeaderText: {
    letterSpacing: 1,
  },
  yearRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  more: {
    alignItems: "flex-start",
    paddingLeft: SPACING.md,
  },
  emptyYear: {
    paddingVertical: SPACING.sm,
  },
  month: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  day: {
    borderTopWidth: StyleSheet.hairlineWidth,
    // Clears the jump highlight's left accent bar (mockup `.day` padding-left).
    paddingLeft: SPACING.sm,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
    gap: SPACING.xs,
  },
});
