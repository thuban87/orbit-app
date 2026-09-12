// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button and AppText use a
// domain-specific semantic `role` prop, not a web ARIA role.
import { StyleSheet, View } from "react-native";
import { AppText, Button, Sheet } from "@/components/ui";
import type { GroupEventParticipant } from "@/db/group-events-read";
import { SPACING } from "@/theme/tokens/spacing";

interface RemoveParticipantSheetProps {
  visible: boolean;
  participant: GroupEventParticipant | null;
  onDelete: () => void;
  onKeep: () => void;
  onRequestClose: () => void;
}

/** Shared three-intent removal choice for group-edit and participant-card flows. */
export function RemoveParticipantSheet({
  visible,
  participant,
  onDelete,
  onKeep,
  onRequestClose,
}: RemoveParticipantSheetProps) {
  return (
    <Sheet visible={visible} onRequestClose={onRequestClose} variant="compact">
      <View style={styles.content}>
        <AppText role="heading">
          Remove {participant?.contactName ?? "participant"} from this group?
        </AppText>
        <Button
          role="destructive"
          label="Delete interaction"
          onPress={onDelete}
        />
        <Button
          role="secondary"
          label="Keep as individual interaction"
          onPress={onKeep}
        />
        <Button role="tertiary" label="Cancel" onPress={onRequestClose} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({ content: { gap: SPACING.sm } });
