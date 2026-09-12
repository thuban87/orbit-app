// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button/AppText `role` is a domain prop, not ARIA.
/**
 * GroupScopePrompt (HIST-17, D-11) — explicit linked-interaction scope choice.
 *
 * When a group-linked interaction is edited, the user must first choose scope —
 * there is NO hybrid editor (D-05). This prompt presents that choice:
 *   • 'Edit individual interaction' → the participant override editor
 *     (participant-overridable fields only: Channel, Tone, Duration, Direction,
 *     Connected, participant note, Allow AI);
 *   • 'Edit Group Event' → the focused Group Event editor.
 *
 * All colours resolve through theme tokens (check:colors).
 */
import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { SPACING } from "@/theme/tokens/spacing";

export interface GroupScopePromptProps {
  visible: boolean;
  onRequestClose: () => void;
  /** Route to the participant override editor (individual scope). */
  onEditIndividual: () => void;
  /** Route to the Phase-33 Edit Group Event flow (group scope). */
  onEditGroup: () => void;
}

export function GroupScopePrompt({
  visible,
  onRequestClose,
  onEditIndividual,
  onEditGroup,
}: GroupScopePromptProps) {
  return (
    <Sheet visible={visible} onRequestClose={onRequestClose} variant="compact">
      <AppText role="heading">Edit interaction</AppText>
      <View style={styles.options}>
        <Button
          role="primary"
          label="Edit individual interaction"
          onPress={onEditIndividual}
        />
        <Button
          role="secondary"
          label="Edit Group Event"
          onPress={onEditGroup}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  options: {
    marginTop: SPACING.base,
    gap: SPACING.sm,
  },
});
