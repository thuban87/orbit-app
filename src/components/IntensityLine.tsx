/**
 * IntensityLine (LOG-03 intensity half) — renders a contact's intensity as a
 * NEUTRAL rate: this period's count vs the intended frequency, plus the long-run
 * trailing cadence. Profile-only (Cluster G: nothing log-derived on the
 * dashboard card), presented BESIDE gravity but never blended into one score.
 *
 * PURELY PRESENTATIONAL: takes the derived `IntensityResult` and draws it. NO
 * data loading, NO DAO/service import — the screen derives intensity via
 * `computeContactIntensity` and passes the result in.
 *
 * NEUTRAL BY DESIGN. The rate is stated as FACT ("5× this period · Monthly
 * intended · 12-day average"), never a scold — frequency is a FLOOR, not a
 * ceiling, so contacting MORE than intended is not "too much" and MUST NOT get a
 * warning colour. Intensity does NOT consume the gravityTiers / rogue tokens
 * (those are for gravity/status); it stays on `colors.textPrimary` (the figure)
 * and `colors.textSecondary` (the caption). Every colour resolves through
 * `useTheme().colors.*` (CLAUDE.md / check:colors) — no hardcoded colour.
 *
 * The intended-frequency LABEL is derived from `periodDays` (= the contact's
 * interval): an exact FREQUENCY_DAYS match renders its name ("Monthly"),
 * otherwise it falls back to "every N days". The trailing-average clause is
 * OMITTED when `trailingAvgGapDays` is null (fewer than 2 qualifying rows).
 */
import { StyleSheet, Text, View } from "react-native";
import type { IntensityResult } from "@/services/intensity-logic";
import { useTheme } from "@/theme";
import { FREQUENCY_DAYS, type Frequency } from "@/types";

/** Reverse of FREQUENCY_DAYS (days → label) for exact-interval phrasing. */
const DAYS_TO_FREQUENCY: Record<number, Frequency> = Object.fromEntries(
  (Object.entries(FREQUENCY_DAYS) as [Frequency, number][]).map(
    ([label, days]) => [days, label],
  ),
) as Record<number, Frequency>;

/** "Monthly" for an exact interval, else "every N days". */
function intendedLabel(periodDays: number): string {
  const named = DAYS_TO_FREQUENCY[periodDays];
  return named ? named : `every ${periodDays} days`;
}

interface IntensityLineProps {
  intensity: IntensityResult;
}

export function IntensityLine({ intensity }: IntensityLineProps) {
  const { colors } = useTheme();
  const { currentCount, multiple, periodDays, trailingAvgGapDays } = intensity;

  // Neutral empty state: no you-reached-out history at all (nothing to state as
  // a rate). Still factual, still no judgement.
  if (currentCount === 0 && trailingAvgGapDays === null) {
    return (
      <View testID="contact-profile-intensity" style={styles.container}>
        <Text style={[styles.heading, { color: colors.textSecondary }]}>
          Intensity
        </Text>
        <Text
          testID="contact-profile-intensity-empty"
          style={[styles.caption, { color: colors.textSecondary }]}
        >
          No outbound contact logged yet
        </Text>
      </View>
    );
  }

  const avgClause =
    trailingAvgGapDays !== null
      ? ` · ${Math.round(trailingAvgGapDays)}-day average`
      : "";

  return (
    <View testID="contact-profile-intensity" style={styles.container}>
      <Text style={[styles.heading, { color: colors.textSecondary }]}>
        Intensity
      </Text>
      <Text
        testID="contact-profile-intensity-rate"
        style={[styles.rate, { color: colors.textPrimary }]}
      >
        {multiple}× this period
      </Text>
      <Text
        testID="contact-profile-intensity-caption"
        style={[styles.caption, { color: colors.textSecondary }]}
      >
        {`${intendedLabel(periodDays)} intended${avgClause}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  heading: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rate: {
    fontSize: 15,
    fontWeight: "600",
  },
  caption: {
    fontSize: 13,
    fontWeight: "500",
  },
});
