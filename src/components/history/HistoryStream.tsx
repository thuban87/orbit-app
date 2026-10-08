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
 */
import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import type { CurrentStateFieldKey } from "@/db/memory-registry";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { HistoryRecordRow } from "./HistoryStreamRows";
import {
  emptyYearLabel,
  isYearOpen,
  type StreamModel,
  type StreamViewState,
  type StreamYear,
  visibleYear,
} from "./history-stream-logic";

export interface HistoryStreamProps {
  model: StreamModel;
  state: StreamViewState;
  onExpandYear: (year: number) => void;
  onShowOlder: (year: number) => void;
  onOpenInteraction: (interactionId: number) => void;
  onOpenKnowledgeChange: (fieldKey: CurrentStateFieldKey) => void;
  testID?: string;
}

export function HistoryStream({
  model,
  state,
  onExpandYear,
  onShowOlder,
  onOpenInteraction,
  onOpenKnowledgeChange,
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
            testID={testID}
          />
        ) : null,
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
  testID: string;
}

function OpenYear({
  entry,
  model,
  state,
  onOpenInteraction,
  onOpenKnowledgeChange,
  testID,
}: OpenYearProps) {
  const { colors } = useTheme();
  const { months } = visibleYear(state, model, entry.year);
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
          <View key={month.key} testID={`${testID}-month-${month.key}`}>
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
                style={[styles.day, { borderColor: colors.border }]}
              >
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
  emptyYear: {
    paddingVertical: SPACING.sm,
  },
  month: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  day: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
    gap: SPACING.xs,
  },
});
