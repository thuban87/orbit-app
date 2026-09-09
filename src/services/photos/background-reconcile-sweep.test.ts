import { describe, expect, it } from "vitest";
import { planBackgroundReconciliation } from "./background-reconcile-sweep";

describe("background launch reconciliation plan", () => {
  it("keeps a path while any template row can still reach it through global, Category, or contact assignment", () => {
    const path = "profile-backgrounds/shared.jpg";
    const plan = planBackgroundReconciliation({
      entries: ["shared.jpg"],
      referencedPaths: new Set([path]),
    });
    expect(plan.actions).toEqual([]);
  });

  it("removes only zero-referrer canonical orphans and records missing restore-era bytes", () => {
    const plan = planBackgroundReconciliation({
      entries: ["orphan.jpg", "live.jpg.bak"],
      referencedPaths: new Set([
        "profile-backgrounds/live.jpg",
        "profile-backgrounds/missing.jpg",
      ]),
    });
    expect(plan.actions).toEqual([
      { kind: "deleteCanonical", relative: "profile-backgrounds/orphan.jpg" },
      {
        kind: "restoreBak",
        from: "profile-backgrounds/live.jpg.bak",
        to: "profile-backgrounds/live.jpg",
      },
    ]);
    expect(plan.missingReferences).toEqual([
      "profile-backgrounds/missing.jpg",
    ]);
  });

  it("deletes an unreferenced interrupted backup instead of resurrecting it", () => {
    expect(
      planBackgroundReconciliation({
        entries: ["unreferenced.jpg.bak"],
        referencedPaths: new Set(),
      }).actions,
    ).toEqual([
      { kind: "deleteBak", relative: "profile-backgrounds/unreferenced.jpg.bak" },
    ]);
  });
});
