import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { InteractionAssistChannel } from "@/db/interaction-assist-dao";
import { useTheme } from "@/theme";

type AssistConfirmationProps = {
  channel: InteractionAssistChannel;
  onConfirm: (connected: 0 | 1, note?: string) => void | Promise<void>;
  onDismiss: () => void | Promise<void>;
};

/** Presentational confirmation controls; persistence stays with the banner owner. */
export function AssistConfirmation({
  channel,
  onConfirm,
  onDismiss,
}: AssistConfirmationProps) {
  const { colors } = useTheme();
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  const confirm = (connected: 0 | 1) => {
    void onConfirm(connected, note.trim() || undefined);
  };

  return (
    <View style={styles.panel}>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Yes"
          onPress={() => confirm(1)}
          style={[
            styles.button,
            { backgroundColor: colors.accent, borderColor: colors.accent },
          ]}
        >
          <Text style={[styles.buttonText, { color: colors.background }]}>
            Yes
          </Text>
        </Pressable>

        {channel === "call" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="No answer"
            onPress={() => confirm(0)}
            style={[
              styles.button,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.buttonText, { color: colors.textSecondary }]}>
              No answer
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Don't log"
          onPress={() => void onDismiss()}
          style={[
            styles.button,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.buttonText, { color: colors.textSecondary }]}>
            Don't log
          </Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add a note"
        onPress={() => setNoteOpen((open) => !open)}
        style={styles.noteToggle}
      >
        <Text style={[styles.noteToggleText, { color: colors.accent }]}>
          Add a note
        </Text>
      </Pressable>

      {noteOpen ? (
        <TextInput
          accessibilityLabel="Optional note"
          placeholder="Optional note…"
          placeholderTextColor={colors.textSecondary}
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
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8,
  },
  button: {
    minWidth: 44,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
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
