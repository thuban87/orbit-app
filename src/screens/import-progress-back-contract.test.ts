import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BULK_IMPORT_STILL_RUNNING_BODY,
  BULK_IMPORT_STILL_RUNNING_TITLE,
} from "./bulk-import-setup-logic";
import {
  IMPORT_PROGRESS_BACK_NOTICE,
  importProgressBlocksLeave,
} from "./import-progress-state";

/**
 * 38.4 D-74 (owner): while a bulk import pass is running, Back (hardware Back,
 * the system back gesture, a tab pop or any other removal) must not leave
 * Import Progress. Leaving used to return to bulk setup while the pass kept
 * running in the background, and Continue there started a second pass over
 * the same rows. Once the pass finishes or stops, leaving works as before.
 * Every entry into a run also refuses to start a second pass: it follows the
 * pass already in flight (the driver-level guard is pinned in
 * `import-run-guard.test.ts` and `import-driver.test.ts`).
 */
const collapse = (source: string) =>
  source.replace(/\r\n/g, "\n").replace(/\s+/g, " ");
const progress = readFileSync(
  join(__dirname, "ImportProgressScreen.tsx"),
  "utf8",
);
const setup = readFileSync(
  join(__dirname, "BulkImportSetupScreen.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("Import Progress Back rule (D-74)", () => {
  it("blocks leaving while this screen drives a pass or any pass for the session is in flight", () => {
    expect(importProgressBlocksLeave({ driving: true, runActive: false })).toBe(
      true,
    );
    expect(importProgressBlocksLeave({ driving: false, runActive: true })).toBe(
      true,
    );
    expect(
      importProgressBlocksLeave({ driving: false, runActive: false }),
    ).toBe(false);
  });

  it("says plainly why Back did nothing", () => {
    expect(IMPORT_PROGRESS_BACK_NOTICE).toBe(
      "Still importing. You can go back when it finishes.",
    );
  });

  it("intercepts every removal of the screen while the pass runs", () => {
    const source = collapse(progress);
    expect(source).toContain('navigation.addListener("beforeRemove"');
    expect(source).toMatch(
      /importProgressBlocksLeave\(\{ driving: driving\.current !== null, runActive: isImportRunActive\(route\.params\.sessionId\), \}\)/,
    );
    expect(source).toContain("event.preventDefault()");
    expect(source).toContain("IMPORT_PROGRESS_BACK_NOTICE");
    // The notice is announced, not only drawn.
    expect(source).toContain(
      "AccessibilityInfo.announceForAccessibility(IMPORT_PROGRESS_BACK_NOTICE)",
    );
  });

  it("releases the block before its own navigation to Import Complete or the stopped view", () => {
    const source = collapse(progress);
    const release = source.indexOf("releaseDriving();");
    expect(release).toBeGreaterThan(-1);
    expect(release).toBeLessThan(
      source.indexOf('navigation.replace("ImportComplete"'),
    );
    expect(source).toMatch(
      /releaseDriving\(\); const outcome = await classifyImportStop/,
    );
  });

  it("an entry follows a pass already in flight instead of starting another", () => {
    const source = collapse(progress);
    const follow = source.indexOf("followImportRun(route.params.sessionId");
    const start = source.indexOf("await runImportBatch(exec");
    expect(follow).toBeGreaterThan(-1);
    expect(start).toBeGreaterThan(follow);
    expect(source).toMatch(/if \(following\) await following; else \{/);
    // A screen that is already gone never starts a pass.
    expect(source).toMatch(/if \(!run\.live\) return;/);
  });
});

describe("Bulk setup stopped view with a pass in flight (D-74)", () => {
  function fn(name: string): string {
    const start = setup.indexOf(`function ${name}(`);
    expect(start, `${name} exists`).toBeGreaterThan(-1);
    return setup.slice(start, setup.indexOf("\n  }\n", start));
  }

  it("Discard refuses while the batch is still importing", () => {
    const body = fn("onDiscardStopped");
    const guard = body.indexOf("isImportRunActive(route.params.sessionId)");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(body.indexOf("discardUnresolvedSession("));
    expect(body).toContain("BULK_IMPORT_STILL_RUNNING_TITLE");
    expect(BULK_IMPORT_STILL_RUNNING_TITLE).toBe("Still importing");
    expect(BULK_IMPORT_STILL_RUNNING_BODY).toBe(
      "Try again when the import finishes.",
    );
  });

  it("Continue never starts a run itself: it opens Import Progress, which follows a pass in flight", () => {
    const body = fn("onContinueStopped");
    expect(body).not.toContain("runImportBatch");
    expect(body).toMatch(/navigation\.navigate\("ImportProgress"/);
  });
});
