import { describe, expect, it } from "vitest";
import {
  classifyImportStop,
  importProgressRunIdentity,
  nextImportRunKey,
} from "./import-progress-state";

describe("classifyImportStop (RG-035, D-20)", () => {
  it("offers the summary when the session is still readable", async () => {
    await expect(classifyImportStop(async () => ({ id: 7 }))).resolves.toBe(
      "summary-available",
    );
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

describe("import run identity (38.3 review B-WR-01)", () => {
  it("a resume re-entry into the same stopped ImportProgress route yields a new run identity", () => {
    // React Navigation 7 reuses the current same-name route on NAVIGATE and only
    // swaps its params, so the run effect must be keyed on a per-entry run key.
    const stopped = importProgressRunIdentity({ sessionId: 5 });
    const resumed = importProgressRunIdentity({
      sessionId: 5,
      runKey: nextImportRunKey(),
    });
    expect(resumed).not.toBe(stopped);
  });

  it("every explicit resume gets a distinct run key", () => {
    const a = nextImportRunKey();
    const b = nextImportRunKey();
    expect(a).not.toBe(b);
    expect(importProgressRunIdentity({ sessionId: 5, runKey: a })).not.toBe(
      importProgressRunIdentity({ sessionId: 5, runKey: b }),
    );
  });

  it("keys on the session too", () => {
    expect(importProgressRunIdentity({ sessionId: 5 })).not.toBe(
      importProgressRunIdentity({ sessionId: 6 }),
    );
  });
});
