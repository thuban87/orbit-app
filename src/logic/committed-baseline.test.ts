import { describe, expect, it } from "vitest";
import { advanceBaseline } from "@/logic/committed-baseline";

describe("advanceBaseline", () => {
  it("maps identical-content additions by temporary identity and preserves an in-flight edit", () => {
    const submittedDraft = [
      { id: -1, value: "same" },
      { id: -2, value: "same" },
    ];
    const currentDraft = [
      { id: -1, value: "edited while saving" },
      { id: -2, value: "same" },
      { id: -3, value: "added while saving" },
    ];
    const committedRows = [
      { id: 11, value: "same" },
      { id: 12, value: "same" },
    ];
    expect(
      advanceBaseline({
        submittedDraft,
        currentDraft,
        committedRows,
        idMap: new Map([
          [-1, 11],
          [-2, 12],
        ]),
        keyOf: (row) => row.id,
      }),
    ).toEqual({
      seed: committedRows,
      draft: [
        { id: 11, value: "edited while saving" },
        { id: 12, value: "same" },
        { id: -3, value: "added while saving" },
      ],
    });
  });
});
