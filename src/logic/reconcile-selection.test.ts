import { describe, expect, it } from "vitest";
import { classifyReconciliation } from "@/logic/reconcile-diff";
import {
  buildReconcileSelections,
  remainingReconcileFields,
} from "@/logic/reconcile-selection";

function diff(birthday: string | null = "1990-01-01") {
  return classifyReconciliation({
    orbit: { name: "Orbit", birthday, photo: null, methods: [] },
    sources: [
      {
        externalContactLinkId: 1,
        displayName: "First",
        birthday: "1991-01-01",
        methods: [],
      },
      {
        externalContactLinkId: 2,
        displayName: "Second",
        birthday: "1992-01-01",
        methods: [],
      },
    ],
    lastReviewed: {},
  });
}

describe("buildReconcileSelections", () => {
  it("gives every source row a unique choice id and carries the chosen value", () => {
    const classified = diff();
    const birthday = classified.fields.find(
      (field) => field.fieldFamily === "birthday",
    )!;
    expect(
      new Set(birthday.sourceOptions.map((option) => option.optionId)).size,
    ).toBe(2);
    for (const option of birthday.sourceOptions) {
      const [selection] = buildReconcileSelections(classified, {
        birthday: `source:${option.optionId}`,
      });
      expect(selection.sourceValue).toBe(option.value);
      expect(selection.sourceOptionId).toBe(option.optionId);
      expect(selection.reviewedValue).toBe(birthday.reviewedComparable);
      expect(selection.sourceLinkIds).toEqual([1, 2]);
    }
    const [kept] = buildReconcileSelections(classified, { birthday: "orbit" });
    expect(kept.useSource).toBe(false);
    expect(kept.reviewedValue).toBe(birthday.reviewedComparable);
  });

  it("excludes ambiguous scalars from source bulk actions and leaves them for detail review", () => {
    for (const birthday of ["1990-01-01", null]) {
      const classified = diff(birthday);
      for (const mode of [
        "use-contact-values",
        "apply-recommendation",
      ] as const) {
        expect(
          buildReconcileSelections(classified, mode).some(
            (item) => item.fieldFamily === "birthday",
          ),
        ).toBe(false);
        expect(
          remainingReconcileFields(mode, classified, []),
        ).toBeGreaterThanOrEqual(1);
      }
      expect(
        buildReconcileSelections(classified, "keep-orbit").find(
          (item) => item.fieldFamily === "birthday",
        )?.reviewedValue,
      ).toBe(
        classified.fields.find((field) => field.fieldFamily === "birthday")
          ?.reviewedComparable,
      );
    }
  });
});
