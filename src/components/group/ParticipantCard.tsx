// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's AppText `role` is a domain prop, not ARIA.
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/icons/Icon";
import { OverflowMenu } from "@/components/OverflowMenu";
import { AppText } from "@/components/ui";
import type {
  GroupEventDetail,
  GroupEventParticipant,
} from "@/db/group-events-read";
import { resolveDisplay } from "@/logic/group-inheritance";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";

interface ParticipantCardProps {
  event: GroupEventDetail;
  participant: GroupEventParticipant;
  onPress: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

function summary(
  event: GroupEventDetail,
  participant: GroupEventParticipant,
): string {
  const display = resolveDisplay(participant, {
    channel: event.channel ?? "In Person",
    quality: event.quality,
    duration: event.duration,
  });
  const follows = [display.channel, display.quality, display.duration]
    .filter((field) => field.following)
    .map((field) => field.label);
  return follows.length > 0
    ? `Follows event: ${follows.join(", ")}`
    : "Participant overrides";
}

/** Compact read row; persistence and the shared remove Sheet remain Detail-owned. */
export function ParticipantCard({
  event,
  participant,
  onPress,
  onEdit,
  onRemove,
}: ParticipantCardProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View interaction with ${participant.contactName}`}
      onPress={onPress}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Avatar
        photo={participant.contactPhoto}
        name={participant.contactName}
        contactId={participant.contactId}
        size={SPACING["2xl"]}
      />
      <View style={styles.copy}>
        <AppText role="label">{participant.contactName}</AppText>
        <View style={styles.summary}>
          <Icon name="group-events" tone="textSecondary" size="sm" />
          <AppText role="caption" style={{ color: colors.textSecondary }}>
            {summary(event, participant)}
          </AppText>
        </View>
      </View>
      <OverflowMenu
        actions={[
          { label: "Edit participant record", onPress: onEdit },
          { label: "Remove from group", onPress: onRemove },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADII.md,
    flexDirection: "row",
    gap: SPACING.sm,
    minHeight: 64,
    padding: SPACING.md,
  },
  copy: { flex: 1, gap: SPACING.xs },
  summary: { alignItems: "center", flexDirection: "row", gap: SPACING.xs },
});
