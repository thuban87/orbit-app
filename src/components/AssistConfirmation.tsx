import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ConfirmActions } from "@/components/ui/ConfirmDialog";
import type { InteractionAssistChannel } from "@/db/interaction-assist-dao";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";

type AssistConfirmationProps = {
  channel: InteractionAssistChannel;
  onConfirm: (connected: 0 | 1, note?: string) => void | Promise<void>;
  onDismiss: () => void | Promise<void>;
  /**
   * True while the owner's write is in flight (38.3 RG-023 / D-08): disables
   * Yes / No answer / Don't log. The owner's synchronous latch is what actually
   * guarantees write-once; this is the visible state.
   */
  pending?: boolean;
  /**
   * Overlay guard (38.9 D-13, D-14; J-07): reports whether the note holds typed
   * text (`note.trim() !== ""`), on mount and whenever that changes. Optional;
   * the inline banner passes nothing.
   */
  onNoteDirtyChange?: (dirty: boolean) => void;
};

/** Presentational confirmation controls; persistence stays with the banner owner. */
export function AssistConfirmation({
  channel,
  onConfirm,
  onDismiss,
  pending = false,
  onNoteDirtyChange,
}: AssistConfirmationProps) {
  const { colors } = useTheme();
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  // Report through a ref so a fresh parent closure never re-fires the report;
  // the effect runs only when the typed/untyped state flips.
  const noteDirty = note.trim() !== "";
  const onNoteDirtyChangeRef = useRef(onNoteDirtyChange);
  onNoteDirtyChangeRef.current = onNoteDirtyChange;
  useEffect(() => {
    onNoteDirtyChangeRef.current?.(noteDirty);
  }, [noteDirty]);

  // Owners are expected never to reject (they surface failures themselves via
  // the shared assist runner); awaiting + logging here is defense in depth so a
  // rejection is never silently dropped (D-08).
  const confirm = async (connected: 0 | 1) => {
    try {
      await onConfirm(connected, note.trim() || undefined);
    } catch (error) {
      Logger.error(
        "assist-confirmation",
        "confirmation handler rejected",
        error,
      );
    }
  };

  const dismiss = async () => {
    try {
      await onDismiss();
    } catch (error) {
      Logger.error(
        "assist-confirmation",
        "confirmation handler rejected",
        error,
      );
    }
  };

  return (
    <View style={styles.panel}>
      {/* 38.14 D-80 / D-73: the answers sit in a ConfirmActions
          measure-and-stack row (D-11, ADR-174 :38 rejected plain wrapping), so
          Yes is on the right like dialogs. The answer set per channel is
          unchanged (D-09, ADR-071): Call offers Yes / No answer / Don't log;
          Text and Email offer Yes / Don't log. */}
      <ConfirmActions
        cancelLabel="Don't log"
        confirmLabel="Yes"
        {...(channel === "call"
          ? { secondaryLabel: "No answer", onSecondary: () => confirm(0) }
          : {})}
        destructive={false}
        cancelDisabled={pending}
        secondaryDisabled={pending}
        confirmDisabled={pending}
        onCancel={dismiss}
        onConfirm={() => confirm(1)}
        testIDs={{
          cancel: "assist-dont-log",
          secondary: "assist-no-answer",
          confirm: "assist-yes",
        }}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add a note"
        onPress={() => setNoteOpen((open) => !open)}
        style={styles.noteToggle}
      >
        <Text style={[styles.noteToggleText, { color: colors.accentText }]}>
          Add a note
        </Text>
      </Pressable>

      {noteOpen ? (
        <TextInput
          accessibilityLabel="Optional note"
          placeholder="Optional note…"
          placeholderTextColor={colors.textPlaceholder}
          value={note}
          onChangeText={setNote}
          multiline
          style={[
            styles.noteInput,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 10,
  },
  noteToggle: {
    minWidth: 44,
    minHeight: 44,
    alignSelf: "flex-end",
    justifyContent: "center",
  },
  noteToggleText: {
    fontSize: 15,
    fontWeight: "600",
  },
  noteInput: {
    minHeight: 88,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    textAlignVertical: "top",
  },
});
