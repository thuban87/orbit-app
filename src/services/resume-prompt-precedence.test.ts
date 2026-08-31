import { describe, expect, it } from "vitest";
import { resolveActiveResumePrompt } from "@/services/resume-prompt-precedence";

describe("resolveActiveResumePrompt", () => {
  it.each([
    [null, null, null],
    [{ sessionId: 1 }, null, "import"],
    [null, { sessionId: 2 }, "reconcile"],
    [{ sessionId: 1 }, { sessionId: 2 }, "import"],
  ] as const)("resolves %o and %o as %s", (resumableImport, resumableReconcile, expected) => {
    expect(resolveActiveResumePrompt(
      resumableImport as never,
      resumableReconcile as never,
    )).toBe(expected);
  });
});
