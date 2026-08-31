import { describe, expect, it } from "vitest";
import {
  isAdditiveOnlySelection,
} from "@/logic/reconcile-bulk-eligibility";
import type { ReconcileDiffResult } from "@/logic/reconcile-diff";

function card(
  outcome: ReconcileDiffResult["fields"][number]["outcome"],
): ReconcileDiffResult {
  return {
    missingSource: outcome === "missing-source",
    orbitModifiedAt: null,
    fields: [
      {
        fieldFamily: "name",
        outcome,
        orbitBaseline: null,
        sourceValue: "Contacts name",
        sourceOptions: [],
        reviewedValue: null,
      },
    ],
  };
}

describe("isAdditiveOnlySelection", () => {
  it("accepts an all-additive selection", () => {
    expect(isAdditiveOnlySelection([card("additive")])).toBe(true);
  });

  it("rejects a selection containing a conflict", () => {
    expect(isAdditiveOnlySelection([card("additive"), card("conflict")])).toBe(false);
  });

  it("rejects a removed-from-source card", () => {
    expect(isAdditiveOnlySelection([card("removed-from-source")])).toBe(false);
  });

  it("rejects a missing-source card", () => {
    expect(isAdditiveOnlySelection([card("missing-source")])).toBe(false);
  });

  it("rejects an empty selection", () => {
    expect(isAdditiveOnlySelection([])).toBe(false);
  });
});
