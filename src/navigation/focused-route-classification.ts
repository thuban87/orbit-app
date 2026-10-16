/**
 * Explicit focused-workflow allow-list. Unknown routes default to browse/read
 * treatment so a newly added route does not unexpectedly hide shell navigation.
 */
import type { SurfaceDensity } from "@/theme/tokens/surface";

const FOCUSED_WORKFLOW_ROUTES = new Set<string>([
  "Create",
  "Edit",
  "OffLimitsEditor",
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
  "EditGroupEvent",
  "EditParticipant",
  "Memory",
  // D-68 (owner, 2026-09-27): authoring and editing workflows, so the FAB and
  // tab bar hide here too.
  "SystemBuilder",
  "EditInteraction",
  // 38.10 D-75: the per-section memory editor is an editing workflow.
  "SectionEditor",
  // 38.10 D-75: the Key People editor is an editing workflow.
  "KeyPeopleEditor",
  // D-18: Compose's read-only Research side hides the tab bar and the + like
  // Compose does.
  "ComposeResearch",
]);

export function isFocusedWorkflow(routeName: string): boolean {
  return FOCUSED_WORKFLOW_ROUTES.has(routeName);
}

const ROUTE_DENSITY: Readonly<Record<string, SurfaceDensity>> = {
  Create: "dense",
  Edit: "dense",
  OffLimitsEditor: "dense",
  CustomFields: "dense",
  Compose: "dense",
  Capture: "dense",
  CropPhoto: "dense",
  Settings: "dense",
  Backup: "dense",
  BackupSettings: "dense",
  RestorePreview: "dense",
  RestoreResult: "dense",
  LegacyContactPicker: "dense",
  ImportReview: "dense",
  BulkImportSetup: "dense",
  ImportProgress: "dense",
  DuplicateReview: "dense",
  ImportComplete: "dense",
  BulkReview: "dense",
  ReconcileDetail: "dense",
  ReconcileGrid: "dense",
  ReconcileComplete: "dense",
  SurvivorSelect: "dense",
  MergeConflicts: "dense",
  MergeImpactSummary: "dense",
  SystemBuilder: "dense",
  SystemsManagement: "dense",
  LogContact: "dense",
  GroupLog: "dense",
  Memory: "dense",
  SectionEditor: "dense",
  KeyPeopleEditor: "dense",
  Digest: "comfortable",
};

/** Unknown and browse routes remain presentation-first by default. */
export function densityForRoute(routeName: string | undefined): SurfaceDensity {
  return routeName === undefined
    ? "presentation"
    : (ROUTE_DENSITY[routeName] ?? "presentation");
}

/** The Orrery visualization alone must not decode/render a System image. */
export function systemBackgroundSlotOverride(
  routeName: string | undefined,
): "none" | undefined {
  return routeName === "Orrery" ? "none" : undefined;
}
