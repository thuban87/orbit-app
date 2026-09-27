import { type NavigationProp, useNavigation } from "@react-navigation/native";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getExecutor, localDateTime } from "@/db/database";
import { discardSession } from "@/db/import-session-dao";
import { navigateIntoTab } from "@/navigation/tab-entry";
import type { TabParamList } from "@/navigation/types";
import { nextImportRunKey } from "@/screens/import-progress-state";
import {
  cleanupDiscardedStagedPhotos,
  type ResumableImport,
} from "@/services/import/contact-import-resume-sweep";
import { deleteImportStaging } from "@/services/photos/photo-storage";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";

type RootNavigation = NavigationProp<TabParamList>;

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
    navigateIntoTab(navigation, "SettingsTab", "ImportReview", { sessionId });
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
      navigateIntoTab(navigation, "SettingsTab", "BulkImportSetup", {
        sessionId,
      });
      return;
    }
    // A fresh run key: if the stopped ImportProgress for this session is the
    // Settings stack's current route, React Navigation reuses it and only swaps
    // params — the key is what makes that explicit resume re-run (B-WR-01).
    navigateIntoTab(navigation, "SettingsTab", "ImportProgress", {
      sessionId,
      batchCategoryId: null,
      runKey: nextImportRunKey(),
    });
    return;
  }

  if (counts.needs_review > 0) {
    navigateIntoTab(navigation, "SettingsTab", "DuplicateReview", {
      sessionId,
    });
    return;
  }
  navigateIntoTab(navigation, "SettingsTab", "ImportComplete", { sessionId });
}

/** App-root, explicit-action-only recovery sheet for a durable import snapshot. */
export function ResumeImportPrompt({
  resumable,
  onDismiss,
}: ResumeImportPromptProps) {
  const { colors } = useTheme();
  const navigation = useNavigation<RootNavigation>();
  // D-49: inset by the safe area so the bounded card never meets the bars.
  const insets = useSafeAreaInsets();
  if (!resumable) return null;

  const discard = async () => {
    if (resumable.photoOutstanding) {
      onDismiss();
      return;
    }
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
      <View
        style={[
          styles.modalRoot,
          {
            paddingTop: insets.top + SPACING.lg,
            paddingBottom: insets.bottom + SPACING.lg,
          },
        ]}
      >
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
          {/* D-49: the heading and body give up height first and scroll at
              large text; the actions below stay outside, always reachable. */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
          >
            <Text style={[styles.heading, { color: colors.textPrimary }]}>
              Resume your import?
            </Text>
            <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
              {resumable.photoOutstanding && !resumable.discardOnly
                ? "Imported contacts have photos waiting to be added. Continue to retry or skip them."
                : resumable.discardOnly
                  ? "This saved import can’t be resumed. You can discard its unresolved items. Contacts already imported stay in Orbit."
                  : "Unresolved items are saved. Contacts already imported stay in Orbit."}
            </Text>
          </ScrollView>
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
              <Text style={[styles.buttonLabel, { color: colors.onAccent }]}>
                Resume import
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              resumable.photoOutstanding ? "Later" : "Discard import"
            }
            onPress={() => void discard()}
            style={[
              styles.button,
              styles.discardButton,
              { borderColor: colors.danger },
            ]}
          >
            <Text style={[styles.buttonLabel, { color: colors.danger }]}>
              {resumable.photoOutstanding ? "Later" : "Discard import"}
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
  // flexShrink: the card never outgrows the (safe-area inset) window (D-49).
  sheet: {
    flexShrink: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    gap: 14,
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
  },
  // Bounded scroll body: short copy keeps its height, tall copy scrolls (D-49).
  body: {
    flexGrow: 0,
    flexShrink: 1,
  },
  bodyContent: {
    gap: 14,
  },
  bodyText: {
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
