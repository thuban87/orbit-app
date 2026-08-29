import { type NavigationProp, useNavigation } from "@react-navigation/native";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { getExecutor, localDateTime } from "@/db/database";
import { discardSession } from "@/db/import-session-dao";
import type { RootStackParamList } from "@/navigation/types";
import {
  cleanupDiscardedStagedPhotos,
  type ResumableImport,
} from "@/services/import/contact-import-resume-sweep";
import { deleteImportStaging } from "@/services/photos/photo-storage";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";

type RootNavigation = NavigationProp<RootStackParamList>;

export interface ResumeImportPromptProps {
  resumable: ResumableImport | null;
  onDismiss(): void;
}

function resumeImport(
  navigation: RootNavigation,
  resumable: ResumableImport,
): void {
  const { counts, mode, sessionId } = resumable;
  if (mode === "single" && counts.pending > 0) {
    navigation.navigate("ImportReview", { sessionId });
    return;
  }

  if (mode === "bulk" && counts.pending > 0) {
    const nonPending =
      counts.imported +
      counts.linked +
      counts.skipped +
      counts.failed +
      counts.needs_review;
    if (nonPending === 0) {
      navigation.navigate("BulkImportSetup", { sessionId });
      return;
    }
    navigation.navigate("ImportProgress", { sessionId, batchCategoryId: null });
    return;
  }

  if (counts.needs_review > 0) {
    navigation.navigate("DuplicateReview", { sessionId });
    return;
  }
  navigation.navigate("ImportComplete", { sessionId });
}

/** App-root, explicit-action-only recovery sheet for a durable import snapshot. */
export function ResumeImportPrompt({
  resumable,
  onDismiss,
}: ResumeImportPromptProps) {
  const { colors } = useTheme();
  const navigation = useNavigation<RootNavigation>();
  if (!resumable) return null;

  const discard = async () => {
    try {
      const stagedPaths = await discardSession(
        getExecutor(),
        resumable.sessionId,
        localDateTime(),
      );
      // The transaction has resolved before it returns these paths.
      cleanupDiscardedStagedPhotos({ deleteImportStaging }, stagedPaths);
      onDismiss();
    } catch (error) {
      Logger.error("resume-import-prompt", "could not discard import", error);
    }
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      // Explicit buttons are the only exit; an Android back press must not
      // silently abandon a pending import.
      onRequestClose={() => undefined}
    >
      <View style={styles.modalRoot}>
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.scrim,
            { backgroundColor: colors.background },
          ]}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.heading, { color: colors.textPrimary }]}>
            Resume your import?
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            {resumable.discardOnly
              ? "This saved import can’t be resumed. You can discard its unresolved items. Contacts already imported stay in Orbit."
              : "Unresolved items are saved. Contacts already imported stay in Orbit."}
          </Text>
          {!resumable.discardOnly ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Resume import"
              onPress={() => {
                resumeImport(navigation, resumable);
                onDismiss();
              }}
              style={[styles.button, { backgroundColor: colors.accent }]}
            >
              <Text style={[styles.buttonLabel, { color: colors.background }]}>
                Resume import
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Discard import"
            onPress={() => void discard()}
            style={[
              styles.button,
              styles.discardButton,
              { borderColor: colors.danger },
            ]}
          >
            <Text style={[styles.buttonLabel, { color: colors.danger }]}>
              Discard import
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  scrim: {
    opacity: 0.85,
  },
  sheet: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    gap: 14,
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingHorizontal: 16,
  },
  discardButton: {
    borderWidth: 1,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
});
