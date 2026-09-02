/**
 * Explicit focused-workflow allow-list. Unknown routes default to browse/read
 * treatment so a newly added route does not unexpectedly hide shell navigation.
 */
const FOCUSED_WORKFLOW_ROUTES = new Set<string>([
  "Create",
  "Edit",
  "Compose",
  "Capture",
  "CropPhoto",
  "LegacyContactPicker",
  "ImportReview",
  "BulkImportSetup",
  "ImportProgress",
  "DuplicateReview",
  "ImportComplete",
  "BulkReview",
  "SurvivorSelect",
  "MergeConflicts",
  "MergeImpactSummary",
  "ReconcileDetail",
  "ReconcileGrid",
  "ReconcileComplete",
  "LogContact",
  "GroupLog",
  "UpdateContact",
  "Memory",
]);

export function isFocusedWorkflow(routeName: string): boolean {
  return FOCUSED_WORKFLOW_ROUTES.has(routeName);
}
