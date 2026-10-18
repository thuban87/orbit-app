import { type NavigationProp, useNavigation } from "@react-navigation/native";
import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RegisteredModal } from "@/components/ui/RegisteredModal";
import { getExecutor, localDateTime } from "@/db/database";
import { discardSession } from "@/db/import-session-dao";
import { importPeopleLeft } from "@/db/import-session-read";
import {
  clearImportResumePrompted,
  markImportResumePrompted,
} from "@/db/resume-prompt-dao";
import {
  navigateIntoTab,
  type TabEntryNavigator,
} from "@/navigation/tab-entry";
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
import { plural } from "@/utils/plural";

const LOG_SCOPE = "resume-import-prompt";

type RootNavigation = NavigationProp<TabParamList>;

export interface ResumeImportPromptProps {
  resumable: ResumableImport | null;
  onDismiss(): void;
}

/**
 * Route into a paused import (shared by this prompt and Settings' pre-check,
 * 38.12 D-111). pending → review / setup / progress; else needs_review →
 * DuplicateReview; else ImportComplete — where a failed-only session's Retry
 * lives (convergence c5 F-2).
 */
export function resumeImport(
  navigation: TabEntryNavigator,
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

/** The body copy: photo work, discard-only, or how many people are left. */
export function resumeImportBody(resumable: ResumableImport): string {
  if (resumable.photoOutstanding && !resumable.discardOnly)
    return "Imported contacts have photos waiting to be added. Continue to retry or skip them.";
  if (resumable.discardOnly)
    return "This saved import can’t be resumed. You can discard its unresolved items. Contacts already imported stay in Orbit.";
  const left = importPeopleLeft(resumable.counts);
  return `${plural(left, "person", "people")} ${left === 1 ? "is" : "are"} left to import. Discard drops them; nothing already imported changes.`;
}

/**
 * App-root, explicit-action-only recovery sheet for a durable import snapshot.
 * App renders it only when it is the active, unsuppressed prompt, so mounting
 * means visible: that is when the "asked once" marker is written (38.12 D-111;
 * RESEARCH Pitfall 6).
 */
export function ResumeImportPrompt({
  resumable,
  onDismiss,
}: ResumeImportPromptProps) {
  const { colors } = useTheme();
  const navigation = useNavigation<RootNavigation>();
  // D-49: inset by the safe area so the bounded card never meets the bars.
  const insets = useSafeAreaInsets();
  const sessionId = resumable?.sessionId ?? null;
  useEffect(() => {
    if (sessionId === null) return;
    markImportResumePrompted(getExecutor(), sessionId, localDateTime()).catch(
      (error: unknown) =>
        Logger.error(LOG_SCOPE, "could not record the resume prompt", error),
    );
  }, [sessionId]);
  if (!resumable) return null;

  const resume = () => {
    // L-3: a session resumed and then left again asks once more. Best-effort:
    // a failed clear only means no second prompt; the Settings row remains.
    clearImportResumePrompted(getExecutor(), resumable.sessionId).catch(
      (error: unknown) =>
        Logger.error(LOG_SCOPE, "could not clear the resume prompt", error),
    );
    resumeImport(navigation, resumable);
    onDismiss();
  };

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
      Logger.error(LOG_SCOPE, "could not discard import", error);
    }
  };

  return (
    <RegisteredModal
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
              {resumeImportBody(resumable)}
            </Text>
          </ScrollView>
          {!resumable.discardOnly ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Resume import"
              onPress={resume}
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
          {resumable.photoOutstanding ? null : (
            // D-111: the prompt asks once; Not now leaves the import paused
            // and findable on Settings → Contacts & Relationships.
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Not now"
              onPress={onDismiss}
              style={styles.button}
            >
              <Text style={[styles.buttonLabel, { color: colors.textPrimary }]}>
                Not now
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </RegisteredModal>
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
