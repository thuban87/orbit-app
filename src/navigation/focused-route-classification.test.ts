import { describe, expect, it } from "vitest";
import {
  densityForRoute,
  isFocusedWorkflow,
  systemBackgroundSlotOverride,
} from "./focused-route-classification";

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

const routeDensities = [
  ["Create", "dense"],
  ["Edit", "dense"],
  ["CustomFields", "dense"],
  ["Compose", "dense"],
  ["Capture", "dense"],
  ["CropPhoto", "dense"],
  ["Settings", "dense"],
  ["Backup", "dense"],
  ["BackupSettings", "dense"],
  ["RestorePreview", "dense"],
  ["RestoreResult", "dense"],
  ["LegacyContactPicker", "dense"],
  ["ImportReview", "dense"],
  ["BulkImportSetup", "dense"],
  ["ImportProgress", "dense"],
  ["DuplicateReview", "dense"],
  ["ImportComplete", "dense"],
  ["BulkReview", "dense"],
  ["ReconcileDetail", "dense"],
  ["ReconcileGrid", "dense"],
  ["ReconcileComplete", "dense"],
  ["SurvivorSelect", "dense"],
  ["MergeConflicts", "dense"],
  ["MergeImpactSummary", "dense"],
  ["SystemBuilder", "dense"],
  ["SystemsManagement", "dense"],
  ["LogContact", "dense"],
  ["GroupLog", "dense"],
  ["UpdateContact", "dense"],
  ["Memory", "dense"],
  ["Digest", "comfortable"],
  ["Home", "presentation"],
  ["Profile", "presentation"],
  ["Archived", "presentation"],
  ["UnboundContacts", "presentation"],
  ["RecentlyDeleted", "presentation"],
  ["GroupEvents", "presentation"],
  ["ThingsToRemember", "presentation"],
  ["MemoryHistory", "presentation"],
] as const;

describe("densityForRoute", () => {
  it.each(routeDensities)("classifies %s as %s", (routeName, density) => {
    expect(densityForRoute(routeName)).toBe(density);
  });

  it.each(["FutureRoute", undefined] as const)(
    "defaults %s to presentation",
    (routeName) => {
      expect(densityForRoute(routeName)).toBe("presentation");
    },
  );
});

describe("systemBackgroundSlotOverride", () => {
  it("suppresses only the Orrery visualization", () => {
    expect(systemBackgroundSlotOverride("Orrery")).toBe("none");
  });

  it.each([
    "ThingsToRemember",
    "RecentlyDeleted",
    "MemoryHistory",
    "SystemBuilder",
    "SystemsManagement",
    "Home",
    "Profile",
    "FutureRoute",
    undefined,
  ] as const)("does not suppress %s", (routeName) => {
    expect(systemBackgroundSlotOverride(routeName)).toBeUndefined();
  });
});
