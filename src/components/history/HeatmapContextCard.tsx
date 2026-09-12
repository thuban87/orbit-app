/**
 * HeatmapContextCard (HIST-07, D-10) — the small ANCHORED card a heatmap cell
 * tap opens FIRST, before the big shared Detail Sheet.
 *
 * INTERACTION-COUNT-ONLY (D-10): it shows the tapped date/range and the
 * interaction COUNT only — it NEVER mentions or counts lifecycle events. That
 * exclusion is the whole point of the card existing separately from the Detail
 * Sheet (which does interleave lifecycle rows).
 *
 * PURELY PRESENTATIONAL, PARENT-OWNED: it is a plain themed card (the parent
 * anchors/positions it and owns dismissal). It imports NO DAO and opens NO
 * sheet: `See details` fires `onSeeDetails` (the parent mounts the sheet) and
 * `Log interaction` fires `onLog` (the parent routes to logging). Every colour
 * resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 *
 * COPY (UI-SPEC Copywriting Contract, verbatim):
 *   populated (count > 0): line1 `{date/range}` · line2 `{n} interactions` · `See details`
 *   empty     (count = 0): line1 `{date/range}` · line2 `0 interactions` · `Log interaction`
 */
import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { SPACING } from "@/theme/tokens/spacing";
import { useTheme } from "@/theme";

export interface HeatmapContextCardProps {
  /** Line 1 — the tapped cell's date or date range, e.g. "Aug 4" or "Aug 4 – Aug 17". */
  title: string;
  /** Interaction count for the tapped cell/period (count-only, D-10). */
  count: number;
  /** Populated-card action: the parent mounts the shared Detail Sheet. */
  onSeeDetails: () => void;
  /** Empty-card action: the parent routes to interaction logging for this date. */
  onLog: () => void;
  testID?: string;
}

export function HeatmapContextCard({
  title,
  count,
  onSeeDetails,
  onLog,
  testID = "heatmap-context-card",
}: HeatmapContextCardProps) {
  const { colors } = useTheme();
  const isEmpty = count === 0;

  return (
    <View
      testID={testID}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <AppText
        role="label"
        testID={`${testID}-title`}
        style={{ color: colors.textPrimary }}
      >
        {title}
      </AppText>
      <AppText
        role="caption"
        testID={`${testID}-count`}
        style={{ color: colors.textSecondary }}
      >
        {`${count} interactions`}
      </AppText>
      {isEmpty ? (
        <Button
          role="primary"
          label="Log interaction"
          onPress={onLog}
          testID={`${testID}-log`}
        />
      ) : (
        <Button
          role="tertiary"
          label="See details"
          onPress={onSeeDetails}
          testID={`${testID}-see-details`}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderRadius: 10,
  },
});
