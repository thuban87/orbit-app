import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme";

export type ConfidenceOutcome =
  | "already_linked"
  | "probable"
  | "possible"
  | "new"
  | "needs_review";

const labels: Record<ConfidenceOutcome, string> = {
  already_linked: "Already in Orbit",
  probable: "Probable match",
  possible: "Possible match",
  new: "New person",
  needs_review: "Needs review",
};

export function ConfidenceChip({ outcome }: { outcome: ConfidenceOutcome }) {
  const { colors } = useTheme();

  return (
    <View
      accessibilityLabel={labels[outcome]}
      style={[styles.chip, { backgroundColor: colors.surfaceElevated }]}
    >
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {labels[outcome]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
});
