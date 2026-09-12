/**
 * IntensityChart (HIST-06) — the larger Intensity surface for the Profile
 * History section, rendered over the SAME selected window as the Activity
 * Heatmap.
 *
 * EXTENDS IntensityLine (the compact Relationship-Overview tile): it composes
 * IntensityLine for the neutral rate copy — reusing that contract verbatim
 * rather than duplicating it — and adds a larger neutral progress bar so the
 * History section reads as a fuller chart than the compact tile.
 *
 * WINDOW-SCOPED (review HIGH, D-09): it consumes Plan 03's `IntensityWindowResult`
 * — the intensity genuinely scoped to the selected window (effectiveNow =
 * window end-of-day, periodDays = window day-span) — NOT a whole-history
 * `computeContactIntensity`. Because it is presentational and prop-driven,
 * changing the parent's lens/period (a new result) re-renders it over the new
 * window automatically. A no-cadence / Unbound contact yields the tagged
 * `{ available: false }` and renders an explicit unavailable state (never
 * divides by a null interval).
 *
 * NEUTRAL BY DESIGN (IntensityLine contract, dossier Cluster G): figure on
 * `textPrimary`, caption on `textSecondary`; the bar track/fill use the neutral
 * `border` / `textSecondary` structure tokens. NEVER a warning/status hue —
 * frequency is a FLOOR, not a ceiling, so more-than-intended contact is not
 * "too much". No prediction/forecasting. Every colour resolves through
 * `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
import { StyleSheet, View } from "react-native";
import { IntensityLine } from "@/components/IntensityLine";
import { AppText } from "@/components/ui/AppText";
import type { IntensityWindowResult } from "@/services/history/intensity-window";
import { SPACING } from "@/theme/tokens/spacing";
import { useTheme } from "@/theme";

export interface IntensityChartProps {
  /** The window-scoped intensity result the parent derived for the selected window. */
  intensity: IntensityWindowResult;
  testID?: string;
}

export function IntensityChart({
  intensity,
  testID = "intensity-chart",
}: IntensityChartProps) {
  const { colors } = useTheme();

  // No-cadence / Unbound: Cycles-style unavailable state — never divide by null.
  if (!intensity.available) {
    return (
      <View testID={testID} style={styles.container}>
        <AppText
          role="caption"
          style={[styles.heading, { color: colors.textSecondary }]}
        >
          Intensity
        </AppText>
        <AppText
          role="caption"
          testID={`${testID}-unavailable`}
          style={{ color: colors.textSecondary }}
        >
          Not available for this contact
        </AppText>
      </View>
    );
  }

  // Progress toward the intended cadence this window. Capped at 1 — hitting or
  // exceeding the floor fills the bar (a floor met, never a scold).
  const { currentCount, intendedPerPeriod } = intensity;
  const denom = intendedPerPeriod > 0 ? intendedPerPeriod : 1;
  const fillFraction = Math.max(0, Math.min(1, currentCount / denom));

  return (
    <View testID={testID} style={styles.container}>
      {/* Neutral rate copy — reuse the IntensityLine contract. The count/fill
          stay window-scoped, but the "…intended" cadence must describe the
          CONTACT, so pass its real interval (cadenceDays) rather than let the
          caption read the window-span periodDays (Phase 32 review #1). */}
      <IntensityLine intensity={intensity} cadenceDays={intensity.cadenceDays} />
      {/* Neutral progress bar (structure tokens only, never a warning hue). */}
      <View
        testID={`${testID}-bar-track`}
        style={[styles.track, { backgroundColor: colors.border }]}
      >
        <View
          testID={`${testID}-bar-fill`}
          style={[
            styles.fill,
            {
              backgroundColor: colors.textSecondary,
              width: `${fillFraction * 100}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.sm,
  },
  heading: {
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
});
