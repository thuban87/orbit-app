import { describe, expect, it } from "vitest";
import { isImportFlowActive, withImportFlowActive } from "./import-flow-guard";

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
});
