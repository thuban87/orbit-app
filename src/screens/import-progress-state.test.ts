import { describe, expect, it } from "vitest";
import { classifyImportStop } from "./import-progress-state";

describe("classifyImportStop (RG-035, D-20)", () => {
  it("offers the summary when the session is still readable", async () => {
    await expect(
      classifyImportStop(async () => ({ id: 7 })),
    ).resolves.toBe("summary-available");
  });

  it("reports an unreadable session when the session is gone", async () => {
    await expect(classifyImportStop(async () => null)).resolves.toBe(
      "session-unreadable",
    );
  });

  it("reports an unreadable session when the probe rejects, never throwing", async () => {
    await expect(
      classifyImportStop(async () => {
        throw new Error("database is locked");
      }),
    ).resolves.toBe("session-unreadable");
  });
});
