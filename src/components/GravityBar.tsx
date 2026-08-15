/**
 * GravityBar (LOG-03 gravity half) — renders a contact's gravity as a NAMED TIER
 * plus a bar. Profile-only (Cluster G: nothing log-derived on the dashboard card).
 *
 * PURELY PRESENTATIONAL: takes the derived gravity result and draws it. NO data
 * loading, NO DAO/service import — the screen derives gravity via
 * `computeContactGravity` and passes the result in.
 *
 * NEVER SHOWS THE RAW NUMBER AS TEXT. The label is the tier NAME; the raw score
 * is a streak-shaped, gameable quantity (it climbs on one more tap), so it only
 * drives the DISCRETE bar fill, never any visible digits (Cluster G [DECIDED]:
 * "named tiers with a bar, never as a raw number"). The fill is tier-discrete
 * `(tierIndex+1)/tierCount` — coarse by design, so it does not nudge for one more
 * tap.
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors):
 * the FILL uses the per-tier ramp `colors.gravityTiers[tierIndex]` (added in Plan
 * 06-04, one colour per tier), the TRACK uses `colors.border`, the tier name uses
 * `colors.textPrimary`, and the caption uses `colors.textSecondary`. The index is
 * CLAMPED into the ramp's range so a mismatched tier count can never crash.
 */
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme";

interface GravityBarProps {
  /** Tier display name — the ONLY gravity magnitude ever shown as text. */
  tierName: string;
  /** Zero-based tier index (clamped here before indexing the colour ramp). */
  tierIndex: number;
  /** Total tier count — the denominator for the discrete fill fraction. */
  tierCount: number;
}

export function GravityBar({
  tierName,
  tierIndex,
  tierCount,
}: GravityBarProps) {
  const { colors } = useTheme();

  // Clamp defensively: the ramp length matches GRAVITY_TIERS, but an out-of-range
  // tierIndex (e.g. a future retune drift) must never index past the array.
  const ramp = colors.gravityTiers;
  const safeIndex = Math.max(0, Math.min(tierIndex, ramp.length - 1));
  const fillColor = ramp[safeIndex];

  // Discrete, tier-aligned fill — coarse on purpose (never the raw score).
  const denom = tierCount > 0 ? tierCount : 1;
  const fillFraction = Math.max(0, Math.min((safeIndex + 1) / denom, 1));

  return (
    <View testID="contact-profile-gravity" style={styles.container}>
      <Text style={[styles.heading, { color: colors.textSecondary }]}>
        Gravity
      </Text>
      <View
        testID="contact-profile-gravity-track"
        style={[styles.track, { backgroundColor: colors.border }]}
      >
        <View
          testID="contact-profile-gravity-fill"
          style={[
            styles.fill,
            {
              backgroundColor: fillColor,
              width: `${fillFraction * 100}%`,
            },
          ]}
        />
      </View>
      <Text
        testID="contact-profile-gravity-tier"
        style={[styles.tierName, { color: colors.textPrimary }]}
      >
        {tierName}
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
  track: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
  tierName: {
    fontSize: 15,
    fontWeight: "600",
    textTransform: "capitalize",
  },
});
