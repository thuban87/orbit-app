import type { ResumableImport } from "@/services/import/contact-import-resume-sweep";
import type { ResumableReconcile } from "@/services/import/reconcile-resume-sweep";

/** Keep the app root to one recovery sheet even when both snapshots exist. */
export function resolveActiveResumePrompt(
  resumableImport: ResumableImport | null,
  resumableReconcile: ResumableReconcile | null,
): "import" | "reconcile" | null {
  if (resumableImport) return "import";
  if (resumableReconcile) return "reconcile";
  return null;
}
