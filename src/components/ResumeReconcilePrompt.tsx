import { type NavigationProp, useNavigation } from "@react-navigation/native";
import { useEffect } from "react";
import {
  type ResumePromptAction,
  ResumePromptSheet,
} from "@/components/ResumePromptSheet";
import { getExecutor, localDateTime } from "@/db/database";
import { discardSession } from "@/db/reconcile-session-dao";
import {
  clearReconcileResumePrompted,
  markReconcileResumePrompted,
} from "@/db/resume-prompt-dao";
import { navigateIntoTab } from "@/navigation/tab-entry";
import type { TabParamList } from "@/navigation/types";
import {
  cleanupDiscardedReconcileStagedPhotos,
  type ResumableReconcile,
} from "@/services/import/reconcile-resume-sweep";
import { deleteReconcileStaging } from "@/services/photos/photo-storage";
import { Logger } from "@/utils/logger";
import { plural } from "@/utils/plural";

const LOG_SCOPE = "resume-reconcile-prompt";

type RootNavigation = NavigationProp<TabParamList>;

export interface ResumeReconcilePromptProps {
  resumable: ResumableReconcile | null;
  onDismiss(): void;
  onDiscarded?(): void;
}

/** The body copy: discard-only, or how many contacts are left (D-105). */
export function resumeReconcileBody(resumable: ResumableReconcile): string {
  if (resumable.discardOnly)
    return "This saved check can’t be resumed. You can discard its unresolved contacts. Changes you already applied stay applied.";
  const left = resumable.cardsLeft;
  return `${plural(left, "contact")} ${left === 1 ? "is" : "are"} left to check. Changes you already applied stay applied.`;
}

/**
 * Explicit-action-only recovery sheet for a durable check, on the shared
 * `ResumePromptSheet` layout (D-56). It is rendered only when visible (App's
 * active, unsuppressed prompt, or Settings' Check linked contacts), so its
 * mount is when the "asked once" marker is written (38.12 D-105).
 */
export function ResumeReconcilePrompt({
  resumable,
  onDismiss,
  onDiscarded,
}: ResumeReconcilePromptProps) {
  const navigation = useNavigation<RootNavigation>();
  const sessionId = resumable?.sessionId ?? null;
  useEffect(() => {
    if (sessionId === null) return;
    markReconcileResumePrompted(
      getExecutor(),
      sessionId,
      localDateTime(),
    ).catch((error: unknown) =>
      Logger.error(LOG_SCOPE, "could not record the resume prompt", error),
    );
  }, [sessionId]);
  if (!resumable) return null;

  const resume = () => {
    // L-3: a check resumed and then left again asks once more. Best-effort:
    // a failed clear only means no second prompt; the Settings row remains.
    clearReconcileResumePrompted(getExecutor(), resumable.sessionId).catch(
      (error: unknown) =>
        Logger.error(LOG_SCOPE, "could not clear the resume prompt", error),
    );
    navigateIntoTab(navigation, "SettingsTab", "ReconcileGrid", {
      sessionId: resumable.sessionId,
    });
    onDismiss();
  };

  const discard = async () => {
    try {
      const stagedPaths = await discardSession(
        getExecutor(),
        resumable.sessionId,
        localDateTime(),
      );
      cleanupDiscardedReconcileStagedPhotos(
        { deleteReconcileStaging },
        stagedPaths,
      );
      onDismiss();
      onDiscarded?.();
    } catch (error) {
      Logger.error(LOG_SCOPE, "could not discard check", error);
    }
  };

  const actions: ResumePromptAction[] = [];
  if (!resumable.discardOnly)
    actions.push({
      label: "Resume",
      accessibilityLabel: "Resume check",
      tone: "primary",
      onPress: resume,
    });
  actions.push({
    label: "Discard",
    accessibilityLabel: "Discard check",
    tone: "danger",
    onPress: () => void discard(),
  });
  // D-105: the prompt asks once; Not now leaves the check paused and
  // findable on Settings → Contacts & Relationships.
  actions.push({ label: "Not now", tone: "plain", onPress: onDismiss });

  return (
    <ResumePromptSheet
      heading="Resume your check?"
      body={resumeReconcileBody(resumable)}
      actions={actions}
    />
  );
}
