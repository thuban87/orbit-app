import { describe, expect, it } from "vitest";
import {
  isImportFlowActive,
  isImportSessionOpen,
  markImportSessionOpen,
  withImportFlowActive,
} from "./import-flow-guard";

describe("import-flow-guard", () => {
  it("is active only while the wrapped import runs, including after a throw", async () => {
    expect(isImportFlowActive()).toBe(false);
    await withImportFlowActive(async () => {
      expect(isImportFlowActive()).toBe(true);
    });
    expect(isImportFlowActive()).toBe(false);
    await expect(
      withImportFlowActive(async () => {
        throw new Error("picker failed");
      }),
    ).rejects.toThrow("picker failed");
    expect(isImportFlowActive()).toBe(false);
  });

  it("tracks open sessions per screen and releases idempotently", () => {
    const first = markImportSessionOpen(7);
    const second = markImportSessionOpen(7);
    first();
    first();
    expect(isImportSessionOpen(7)).toBe(true);
    second();
    expect(isImportSessionOpen(7)).toBe(false);
  });
});
