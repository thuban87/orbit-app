import type { ResumableImport } from "@/services/import/contact-import-resume-sweep";
import type { ResumableReconcile } from "@/services/import/reconcile-resume-sweep";

export interface ResumePromptOptions {
  /**
   * True while a share is pending or the Capture screen is focused (38.10
   * D-23). Both prompts are hidden; the resumable state is kept by the
   * caller, so the prompt returns once the share is finished.
   */
  suppressed?: boolean;
}

/** Keep the app root to one recovery sheet even when both snapshots exist. */
export function resolveActiveResumePrompt(
  resumableImport: ResumableImport | null,
  resumableReconcile: ResumableReconcile | null,
  options: ResumePromptOptions = {},
): "import" | "reconcile" | null {
  if (options.suppressed === true) return null;
  if (resumableImport) return "import";
  if (resumableReconcile) return "reconcile";
  return null;
}
