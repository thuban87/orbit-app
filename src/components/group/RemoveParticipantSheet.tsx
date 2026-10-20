// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button and AppText use a
// domain-specific semantic `role` prop, not a web ARIA role.
/**
 * Remove from event (38.14 D-70): Keep as individual interaction first, then
 * Delete interaction, then Cancel. Delete goes through the standard
 * destructive confirm before the host's `onDelete` runs (D-27; phase-11
 * :730); the confirm is single-flight on this sheet's own latch. The heading
 * uses the canonical noun "event" (D-05).
 */
import { useRef } from "react";
import { StyleSheet, View } from "react-native";
import { AppText, Button, Sheet } from "@/components/ui";
import type { GroupEventParticipant } from "@/db/group-events-read";
import { confirm } from "@/stores/confirm-store";
import { SPACING } from "@/theme/tokens/spacing";
import type { InFlightRef } from "@/utils/single-flight";
import {
  confirmThenDelete,
  REMOVE_PARTICIPANT_CHOICES,
} from "./remove-participant-logic";

interface RemoveParticipantSheetProps {
  visible: boolean;
  participant: GroupEventParticipant | null;
  /** Runs only after the delete confirm resolves true. */
  onDelete: () => void;
  onKeep: () => void;
  onRequestClose: () => void;
  /** A remove is in flight: Delete/Keep are disabled (review A-WR-03). */
  busy?: boolean;
}

/** Shared three-intent removal choice for Edit Event and the event screen. */
export function RemoveParticipantSheet({
  visible,
  participant,
  onDelete,
  onKeep,
  onRequestClose,
  busy = false,
}: RemoveParticipantSheetProps) {
  const deleteLatch = useRef<InFlightRef>({ current: false });
  const name = participant?.contactName ?? "this participant";

  const requestDelete = () =>
    void confirmThenDelete(
      deleteLatch.current,
      () =>
        confirm({
          title: "Delete this interaction?",
          message: `This permanently deletes ${name}'s interaction from this event. This can't be undone and may change their Status, Gravity, and Intensity.`,
          confirmLabel: "Delete interaction",
          destructive: true,
        }),
      onDelete,
    );

  const handlers = {
    keep: onKeep,
    delete: requestDelete,
    cancel: onRequestClose,
  } as const;

  return (
    <Sheet visible={visible} onRequestClose={onRequestClose} variant="compact">
      <View style={styles.content}>
        <AppText role="heading">
          Remove {participant?.contactName ?? "participant"} from this event?
        </AppText>
        {REMOVE_PARTICIPANT_CHOICES.map((choice) => (
          <Button
            key={choice.key}
            role={choice.role}
            label={choice.label}
            disabled={choice.key === "cancel" ? false : busy}
            onPress={handlers[choice.key]}
          />
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({ content: { gap: SPACING.sm } });
