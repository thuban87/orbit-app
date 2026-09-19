import { Pressable, StyleSheet, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { ringVisual } from "@/components/ContactCard";
import { AppText } from "@/components/ui/AppText";
import type { UpNextCandidateRow } from "@/db/up-next-read";
import { pickUpNext } from "@/logic/digest-composition";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";

export interface UpNextSectionProps {
  candidates: readonly UpNextCandidateRow[];
  onOpenProfile: (contactId: number) => void;
}

export function upNextReason(row: UpNextCandidateRow): string {
  if (row.reason === "unresponsive") return "They may be waiting for a reply";
  if (row.reason === "overdue") return "Well past their usual orbit";
  if (row.status === "wobble") return "Approaching their usual check-in";
  if (row.status === "decay") return "Overdue for a check-in";
  if (row.status === "rogue") return "Well past their usual orbit";
  return "Coming up in your orbit";
}

export function UpNextSection({
  candidates,
  onOpenProfile,
}: UpNextSectionProps) {
  const { colors } = useTheme();
  const rows = pickUpNext(candidates);

  return (
    <View testID="digest-up-next" style={styles.section}>
      <AppText accessibilityRole="header" role="heading">
        Up Next
      </AppText>
      {rows.length === 0 ? (
        <View style={styles.empty}>
          <AppText role="label">You're all caught up</AppText>
          <AppText role="caption" style={{ color: colors.textSecondary }}>
            No one needs a nudge right now.
          </AppText>
        </View>
      ) : (
        rows.map((row) => {
          const ring = ringVisual(row.status, colors);
          return (
            <Pressable
              key={row.id}
              testID={`digest-up-next-row-${row.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${row.name}. ${upNextReason(row)}`}
              onPress={() => onOpenProfile(row.id)}
              style={styles.row}
            >
              <View
                testID={`digest-up-next-status-${row.id}`}
                accessibilityLabel={`${row.status} status`}
                style={[
                  styles.avatarRing,
                  {
                    borderColor: ring.color,
                    borderWidth: ring.width,
                    opacity: ring.opacity,
                  },
                ]}
              >
                <Avatar
                  photo={row.photo}
                  name={row.name}
                  contactId={row.id}
                  size={44}
                />
              </View>
              <View style={styles.copy}>
                <AppText numberOfLines={1} ellipsizeMode="tail" role="body">
                  {row.name}
                </AppText>
                <AppText
                  testID={`digest-up-next-reason-${row.id}`}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  role="label"
                  style={{ color: colors.textSecondary }}
                >
                  {upNextReason(row)}
                </AppText>
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACING.sm },
  empty: { gap: SPACING.xs },
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  avatarRing: { borderRadius: 26, padding: SPACING.xs },
  copy: { flex: 1, gap: SPACING.xs },
});
