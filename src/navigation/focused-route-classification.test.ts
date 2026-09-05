import { describe, expect, it } from "vitest";
import { isFocusedWorkflow } from "./focused-route-classification";

const focusedRoutes = [
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
];

const browseRoutes = [
  "Home",
  "Orrery",
  "Backup",
  "BackupSettings",
  "Settings",
  "CustomFields",
  "Profile",
  "Archived",
  "UnboundContacts",
  "Digest",
  "GroupEvents",
  "RestorePreview",
  "RestoreResult",
];

describe("isFocusedWorkflow", () => {
  it.each(focusedRoutes)("classifies %s as focused", (routeName) => {
    expect(isFocusedWorkflow(routeName)).toBe(true);
  });

  it.each(browseRoutes)("classifies %s as browse/read", (routeName) => {
    expect(isFocusedWorkflow(routeName)).toBe(false);
  });

  it("treats an unknown route as browse/read", () => {
    expect(isFocusedWorkflow("FutureRoute")).toBe(false);
  });
});
