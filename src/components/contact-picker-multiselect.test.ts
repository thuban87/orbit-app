import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyPickerExclusions,
  clearSelection,
  confirmMultiSelection,
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

  it("reports an awaited owner success while retaining ordered ids for the picker cleanup", async () => {
    const owner = async (ids: number[]) => expect(ids).toEqual([9, 3]);
    await expect(
      confirmMultiSelection(new Set([9, 3]), owner),
    ).resolves.toEqual({
      ok: true,
      contactIds: [9, 3],
    });
  });

  it("retains the ordered selection when an awaited owner rejects", async () => {
    await expect(
      confirmMultiSelection(new Set([9, 3]), async () => {
        throw new Error("write failed");
      }),
    ).resolves.toEqual({ ok: false, contactIds: [9, 3] });
  });

  it("keeps the picker open on a rejected owner and dismisses only after success", () => {
    const picker = readFileSync(
      new URL("./ContactPicker.tsx", import.meta.url),
      "utf8",
    );

    expect(picker).toContain("await confirmMultiSelection(");
    expect(picker).toContain("setConfirmError(true)");
    expect(picker).toContain("setSelectedContactIds(clearSelection())");
    expect(picker).toContain("Couldn't add those contacts. Please try again.");
  });

  it("uses the one awaited batch-and-reload owner contract on both saved-event screens", () => {
    for (const screen of [
      "EditGroupEventScreen.tsx",
      "GroupEventDetailScreen.tsx",
    ]) {
      const source = readFileSync(
        new URL(`../screens/${screen}`, import.meta.url),
        "utf8",
      );
      expect(source).toContain("await addParticipants(getExecutor(), {");
      expect(source).toContain("await load({ throwOnFailure: true });");
      expect(source).toContain("throw error;");
      expect(source).not.toContain("addParticipant(getExecutor()");
    }
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
      applyPickerExclusions(rows, {
        excludeContactId: 1,
        excludeContactIds: [2],
      }),
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
