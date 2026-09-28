import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BULK_IMPORT_STOPPED_CONTINUE,
  BULK_IMPORT_STOPPED_DISCARD,
  bulkImportStoppedMessage,
  bulkSetupShowsStopped,
} from "./bulk-import-setup-logic";

/**
 * 38.4 D-73 (c) (owner; supersedes D-64's on-screen lock copy): a partly
 * processed (stopped) bulk import shows only a plain stopped message with
 * Continue and Discard — no Bound/Unbound, frequency or category controls and
 * no lock explanation. The choices were already applied; Continue resumes with
 * the saved batch lifecycle and category. The DAO lock (D-64,
 * `setSessionBatchDefaults`) stays and is pinned in `import-session-dao.test.ts`.
 */
const screen = readFileSync(
  join(__dirname, "BulkImportSetupScreen.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

/** The stopped branch: from `if (stopped)` to its `return (…);` end. */
function stoppedBranch(): string {
  const start = screen.indexOf("if (stopped) {");
  expect(start, "the screen renders a stopped branch").toBeGreaterThan(-1);
  const end = screen.indexOf("\n  }\n", start);
  return screen.slice(start, end);
}

function fn(name: string): string {
  const start = screen.indexOf(`function ${name}(`);
  expect(start, `${name} exists`).toBeGreaterThan(-1);
  return screen.slice(start, screen.indexOf("\n  }\n", start));
}

describe("stopped bulk import copy (D-73c)", () => {
  it("says only that the import stopped and how many contacts are left", () => {
    expect(bulkImportStoppedMessage(3)).toBe(
      "This import stopped partway — 3 contacts left.",
    );
    expect(bulkImportStoppedMessage(1)).toBe(
      "This import stopped partway — 1 contact left.",
    );
    expect(BULK_IMPORT_STOPPED_CONTINUE).toBe("Continue");
    expect(BULK_IMPORT_STOPPED_DISCARD).toBe("Discard");
  });

  it("shows the stopped view only for a locked batch with contacts left that this screen is not already continuing", () => {
    expect(
      bulkSetupShowsStopped({ locked: true, pending: 2, continuing: false }),
    ).toBe(true);
    expect(
      bulkSetupShowsStopped({ locked: false, pending: 2, continuing: false }),
    ).toBe(false);
    expect(
      bulkSetupShowsStopped({ locked: true, pending: 0, continuing: false }),
    ).toBe(false);
    // Combine resolves rows before the batch starts; the user's Import then
    // continues on its own, so that is not a stopped import.
    expect(
      bulkSetupShowsStopped({ locked: true, pending: 2, continuing: true }),
    ).toBe(false);
  });
});

describe("BulkImportSetupScreen stopped view (D-73c)", () => {
  it("renders the message with Continue and Discard, and no choice controls or lock reason", () => {
    const branch = stoppedBranch();
    expect(branch).toContain('testID="bulk-import-stopped"');
    expect(branch).toContain("bulkImportStoppedMessage(count)");
    expect(branch).toContain("BULK_IMPORT_STOPPED_CONTINUE");
    expect(branch).toContain("BULK_IMPORT_STOPPED_DISCARD");
    for (const control of [
      "LIFECYCLE_OPTIONS",
      "FrequencyPicker",
      "<Picker",
      "CategoryChoiceSheet",
      "BULK_BOUND_BLURB",
      "Orbit participation",
      "Category override",
      "selected",
    ]) {
      expect(branch, control).not.toContain(control);
    }
  });

  it("drops the D-64 lock explanation everywhere on the screen", () => {
    expect(screen).not.toContain("BULK_LIFECYCLE_LOCKED_COPY");
    expect(screen).not.toContain("bulk-import-lifecycle-locked");
  });

  it("Continue resumes the saved batch without writing new choices", () => {
    const body = fn("onContinueStopped");
    expect(body).toMatch(/navigation\.navigate\("ImportProgress"/);
    expect(body).toContain("runKey: nextImportRunKey()");
    expect(body).not.toContain("setSessionBatchDefaults");
    expect(body).not.toContain("bulkLifecycleChoice");
  });

  it("Discard leaves through the import leave guard, which discards what is left", () => {
    expect(fn("onDiscardStopped")).toContain("navigation.goBack()");
    // The stopped view has no edits of its own: leaving never asks "Leave import?".
    expect(screen).toMatch(
      /useImportLeaveGuard\(\s*navigation,\s*route\.params\.sessionId,\s*edited && !stopped,?\s*\)/,
    );
  });

  it("a successful Combine continues the user's Import instead of landing on a locked setup", () => {
    const combine = fn("onCombine");
    expect(combine).toContain("setContinuing(true)");
  });
});
