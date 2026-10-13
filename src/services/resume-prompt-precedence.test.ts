import { describe, expect, it } from "vitest";
import { resolveActiveResumePrompt } from "@/services/resume-prompt-precedence";

const CASES = [
  [null, null, null],
  [{ sessionId: 1 }, null, "import"],
  [null, { sessionId: 2 }, "reconcile"],
  [{ sessionId: 1 }, { sessionId: 2 }, "import"],
] as const;

describe("resolveActiveResumePrompt", () => {
  it.each(CASES)(
    "resolves %o and %o as %s",
    (resumableImport, resumableReconcile, expected) => {
      expect(
        resolveActiveResumePrompt(
          resumableImport as never,
          resumableReconcile as never,
        ),
      ).toBe(expected);
    },
  );

  it.each(CASES)(
    "keeps today's precedence for %o and %o when not suppressed (%s)",
    (resumableImport, resumableReconcile, expected) => {
      expect(
        resolveActiveResumePrompt(
          resumableImport as never,
          resumableReconcile as never,
          { suppressed: false },
        ),
      ).toBe(expected);
    },
  );

  // 38.10 D-23: a pending share or a focused Capture screen hides both
  // prompts; the resumable state is kept, so they return afterwards.
  it.each(CASES)(
    "shows no prompt for %o and %o while a share is in progress",
    (resumableImport, resumableReconcile) => {
      expect(
        resolveActiveResumePrompt(
          resumableImport as never,
          resumableReconcile as never,
          { suppressed: true },
        ),
      ).toBeNull();
    },
  );
});
