import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import type { YourWeekDayDetail } from "@/components/digest/your-week-section-logic";
import { Icon } from "@/components/icons/Icon";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import type { YourWeekDayRow } from "@/db/your-week-read";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { formatTimeMinuteOrFallback } from "@/utils/dates";

const AVATAR_SIZE = 36;

// Row times (visible caption AND accessibility label) use the shared time-only
// minute formatter — the rows sit within the known selected day, so a clock is
// enough; 12-hour AM/PM, no seconds, neutral fallback (RG-038
// ui-accessibility/AUD-UIA-018, 38.4 D-07, ADR-152).

export interface DigestDayDetailProps {
  date: string;
  /**
   * The selected day's read state (38.3 D-16). "No activity on this date."
   * renders ONLY for `loaded` with zero rows — never while pending or failed.
   */
  state: Exclude<YourWeekDayDetail, { status: "idle" }>;
  /** Re-read the same day with a fresh request (error state's Retry). */
  onRetry: () => void;
  testID?: string;
}

export function DigestDayDetail({
  date,
  state,
  onRetry,
  testID = "digest-day-detail",
}: DigestDayDetailProps) {
  const { colors } = useTheme();

  let body: ReactNode;
  if (state.status === "loading") {
    body = (
      <ActivityIndicator
        testID={`${testID}-loading`}
        color={colors.accent}
        accessibilityLabel={`Loading activity for ${date}`}
        style={styles.indicator}
      />
    );
  } else if (state.status === "error") {
    body = (
      <View style={styles.error}>
        <AppText role="caption" style={{ color: colors.textSecondary }}>
          Couldn't load this day
        </AppText>
        {/* biome-ignore lint/a11y/useValidAriaRole: Button role is the design-system hierarchy role. */}
        <Button
          role="tertiary"
          label="Retry"
          accessibilityLabel="Retry loading this day"
          onPress={onRetry}
          testID={`${testID}-retry`}
        />
      </View>
    );
  } else if (state.rows.length === 0) {
    body = (
      <AppText role="caption" style={{ color: colors.textSecondary }}>
        No activity on this date.
      </AppText>
    );
  } else {
    body = renderDayRows(state.rows, testID, colors);
  }

  return (
    <View
      testID={testID}
      accessibilityLabel={`Activity for ${date}`}
      style={[styles.container, { backgroundColor: colors.surfaceElevated }]}
    >
      {/* biome-ignore lint/a11y/useValidAriaRole: AppText role is a typography role. */}
      <AppText role="label">{date}</AppText>
      {body}
    </View>
  );
}

function renderDayRows(
  rows: readonly YourWeekDayRow[],
  testID: string,
  colors: ReturnType<typeof useTheme>["colors"],
): ReactNode {
  return (
    <View style={styles.list}>
      {rows.map((row) =>
        row.kind === "group_event" ? (
          <View
            key={`group-event-${row.id}`}
            testID={`${testID}-group-event-${row.id}`}
            accessibilityLabel={`Event, ${row.title ?? "Group Event"}, ${formatTimeMinuteOrFallback(row.occurredAt)}`}
            style={[styles.row, { borderColor: colors.border }]}
          >
            <Icon name="group-events" tone="textPrimary" size="sm" />
            <View style={styles.body}>
              {/* biome-ignore lint/a11y/useValidAriaRole: AppText role is a typography role. */}
              <AppText role="body" numberOfLines={1}>
                {row.title ?? "Group Event"}
              </AppText>
              <AppText role="caption" style={{ color: colors.textSecondary }}>
                {formatTimeMinuteOrFallback(row.occurredAt)}
              </AppText>
            </View>
          </View>
        ) : (
          <View
            key={`interaction-${row.id}`}
            testID={`${testID}-interaction-${row.id}`}
            accessibilityLabel={`Interaction with ${row.contactName ?? "Unknown contact"}, ${formatTimeMinuteOrFallback(row.occurredAt)}`}
            style={[styles.row, { borderColor: colors.border }]}
          >
            <Avatar
              photo={null}
              name={row.contactName ?? ""}
              contactId={row.contactId ?? undefined}
              size={AVATAR_SIZE}
            />
            <View style={styles.body}>
              {/* biome-ignore lint/a11y/useValidAriaRole: AppText role is a typography role. */}
              <AppText role="body" numberOfLines={1}>
                {row.contactName ?? "Unknown contact"}
              </AppText>
              <AppText role="caption" style={{ color: colors.textSecondary }}>
                {formatTimeMinuteOrFallback(row.occurredAt)}
              </AppText>
            </View>
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: SPACING.sm, padding: SPACING.md, borderRadius: SPACING.sm },
  list: { gap: SPACING.sm },
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderBottomWidth: 1,
    paddingVertical: SPACING.sm,
  },
  body: { flex: 1, gap: SPACING.xs },
  indicator: { alignSelf: "flex-start" },
  error: { gap: SPACING.xs, alignItems: "flex-start" },
});
