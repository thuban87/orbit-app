import { describe, expect, it } from "vitest";
import {
  applyPickerExclusions,
  clearSelection,
  orderedSelection,
  selectionCount,
  toggleSelection,
} from "./contact-picker-multiselect";

describe("contact picker multi-select helpers", () => {
  it("toggles a contact into and out of the selected set", () => {
    const selected = toggleSelection(new Set<number>(), 7);

    expect(selected).toEqual(new Set([7]));
    expect(toggleSelection(selected, 7)).toEqual(new Set());
  });

  it("adds distinct contacts and returns them in deterministic insertion order", () => {
    const selected = toggleSelection(toggleSelection(new Set<number>(), 9), 3);

    expect(selectionCount(selected)).toBe(2);
    expect(orderedSelection(selected)).toEqual([9, 3]);
  });

  it("clears every selected contact", () => {
    expect(clearSelection(new Set([1, 2, 3]))).toEqual(new Set());
  });
});

describe("applyPickerExclusions", () => {
  const rows = [
    { id: 1, name: "Ada" },
    { id: 2, name: "Grace" },
    { id: 3, name: "Katherine" },
  ];

  it("removes the single excluded contact", () => {
    expect(applyPickerExclusions(rows, { excludeContactId: 2 })).toEqual([
      rows[0],
      rows[2],
    ]);
  });

  it("removes every contact in the excluded id set", () => {
    expect(applyPickerExclusions(rows, { excludeContactIds: [1, 3] })).toEqual([
      rows[1],
    ]);
  });

  it("never offers an already-present contact", () => {
    expect(
      applyPickerExclusions(rows, { excludeContactId: 1, excludeContactIds: [2] }),
    ).toEqual([rows[2]]);
  });

  it("leaves rows unchanged without exclusions", () => {
    expect(applyPickerExclusions(rows, {})).toBe(rows);
    expect(
      applyPickerExclusions(rows, {
        excludeContactId: undefined,
        excludeContactIds: [],
      }),
    ).toBe(rows);
  });
});
