import { type NavigationProp, useNavigation } from "@react-navigation/native";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { getExecutor, localDateTime } from "@/db/database";
import { discardSession } from "@/db/reconcile-session-dao";
import type { RootStackParamList } from "@/navigation/types";
import {
  cleanupDiscardedReconcileStagedPhotos,
  type ResumableReconcile,
} from "@/services/import/reconcile-resume-sweep";
import { deleteReconcileStaging } from "@/services/photos/photo-storage";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";

type RootNavigation = NavigationProp<RootStackParamList>;

export interface ResumeReconcilePromptProps {
  resumable: ResumableReconcile | null;
  onDismiss(): void;
  onDiscarded?(): void;
}

/** App-root, explicit-action-only recovery sheet for a durable check. */
export function ResumeReconcilePrompt({ resumable, onDismiss, onDiscarded }: ResumeReconcilePromptProps) {
  const { colors } = useTheme();
  const navigation = useNavigation<RootNavigation>();
  if (!resumable) return null;
  const discard = async () => {
    try {
      const stagedPaths = await discardSession(getExecutor(), resumable.sessionId, localDateTime());
      cleanupDiscardedReconcileStagedPhotos({ deleteReconcileStaging }, stagedPaths);
      onDismiss();
      onDiscarded?.();
    } catch (error) {
      Logger.error("resume-reconcile-prompt", "could not discard check", error);
    }
  };
  return <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
    <View style={styles.scrim}>
      <View style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]}>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>Resume your check?</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          {resumable.discardOnly ? "This saved check can’t be resumed. You can discard its unresolved contacts. Changes you already applied stay applied." : "Unresolved contacts are saved. Changes you already applied stay applied."}
        </Text>
        {!resumable.discardOnly ? <Pressable accessibilityRole="button" accessibilityLabel="Resume check" onPress={() => { navigation.navigate("ReconcileGrid", { sessionId: resumable.sessionId }); onDismiss(); }} style={[styles.button, { backgroundColor: colors.accent }]}><Text style={[styles.buttonLabel, { color: colors.background }]}>Resume</Text></Pressable> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Discard check" onPress={() => void discard()} style={[styles.button, styles.discardButton, { borderColor: colors.danger }]}><Text style={[styles.buttonLabel, { color: colors.danger }]}>Discard</Text></Pressable>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0, 0, 0, 0.5)" },
  sheet: { gap: 16, padding: 20, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  heading: { fontSize: 18, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 22 },
  button: { minHeight: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  discardButton: { borderWidth: 1 },
  buttonLabel: { fontSize: 16, fontWeight: "700" },
});
