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
 * The intended-frequency LABEL describes the CONTACT'S cadence: an exact
 * FREQUENCY_DAYS match renders its name ("Monthly"), otherwise "every N days".
 * The cadence comes from the optional `cadenceDays` prop, defaulting to
 * `periodDays` — correct for the compact profile tile, where the intensity
 * period IS the contact's interval. The window-scoped IntensityChart passes the
 * contact's REAL interval explicitly, so the caption keeps describing the
 * contact even though its `periodDays` is a window span (Phase 32 review #1).
 * The trailing-average clause is OMITTED when `trailingAvgGapDays` is null
 * (fewer than 2 qualifying rows). Label/caption formatting lives in the RN-free
 * `intensity-line-caption` sibling so it stays node-testable.
 */
import { StyleSheet, Text, View } from "react-native";
import { intendedCaption } from "@/components/intensity-line-caption";
import type { IntensityResult } from "@/services/intensity-logic";
import { useTheme } from "@/theme";

interface IntensityLineProps {
  intensity: IntensityResult;
  /**
   * The CONTACT'S configured cadence interval (days) for the "…intended"
   * phrasing. Defaults to the result's `periodDays` — correct for the compact
   * profile tile, where the period IS the contact's interval. The window-scoped
   * IntensityChart passes the contact's REAL interval so the caption keeps
   * describing the contact, not the window span (Phase 32 review #1).
   */
  cadenceDays?: number;
}

export function IntensityLine({ intensity, cadenceDays }: IntensityLineProps) {
  const { colors } = useTheme();
  const { currentCount, multiple, periodDays, trailingAvgGapDays } = intensity;
  // The cadence label describes the CONTACT. On the profile tile periodDays is
  // the contact's interval; the window-scoped chart overrides it with the real
  // interval so a window span never masquerades as the cadence.
  const effectiveCadenceDays = cadenceDays ?? periodDays;

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
        {intendedCaption(effectiveCadenceDays, trailingAvgGapDays)}
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
