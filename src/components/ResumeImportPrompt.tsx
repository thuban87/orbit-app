import { type NavigationProp, useNavigation } from "@react-navigation/native";
import { useEffect } from "react";
import {
  type ResumePromptAction,
  ResumePromptSheet,
} from "@/components/ResumePromptSheet";
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
 * App-root, explicit-action-only recovery sheet for a durable import snapshot,
 * on the shared `ResumePromptSheet` layout (D-56).
 * App renders it only when it is the active, unsuppressed prompt, so mounting
 * means visible: that is when the "asked once" marker is written (38.12 D-111;
 * RESEARCH Pitfall 6).
 */
export function ResumeImportPrompt({
  resumable,
  onDismiss,
}: ResumeImportPromptProps) {
  const navigation = useNavigation<RootNavigation>();
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

  const actions: ResumePromptAction[] = [];
  if (!resumable.discardOnly)
    actions.push({ label: "Resume import", tone: "primary", onPress: resume });
  // Photo work keeps its "Later" in place of Discard (B-6); Later only closes.
  actions.push({
    label: resumable.photoOutstanding ? "Later" : "Discard import",
    tone: "danger",
    onPress: () => void discard(),
  });
  // D-111: the prompt asks once; Not now leaves the import paused and
  // findable on Settings → Contacts & Relationships.
  if (!resumable.photoOutstanding)
    actions.push({ label: "Not now", tone: "plain", onPress: onDismiss });

  return (
    <ResumePromptSheet
      heading="Resume your import?"
      body={resumeImportBody(resumable)}
      actions={actions}
    />
  );
}
