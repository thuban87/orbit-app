import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 38.4 D-64 (owner; review A WR-02): a bulk import's Bound/Unbound choice and
 * cadence lock once any row of the session is resolved, so a batch never ends
 * with mixed lifecycles. Source contract over the setup screen and the shared
 * FrequencyPicker; the data-layer backstop is pinned in
 * `import-session-dao.test.ts`.
 */
const ROOT = join(__dirname, "..", "..");

function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("BulkImportSetupScreen locks the batch lifecycle (D-64)", () => {
  const screen = source("src/screens/BulkImportSetupScreen.tsx");

  it("derives the lock from the session's row counts and the saved lifecycle", () => {
    expect(screen).toMatch(/bulkLifecycleLocked\(counts\)/);
    expect(screen).toMatch(/sessionBatchLifecycle\(session\)/);
  });

  it("disables each Bound/Unbound option, with state and the reason for TalkBack", () => {
    const start = screen.indexOf("LIFECYCLE_OPTIONS.map(");
    const option = screen.slice(start, screen.indexOf("</Pressable>", start));
    expect(option).toContain("disabled={lifecycleLocked}");
    expect(option).toMatch(
      /accessibilityState=\{\{\s*selected,\s*checked: selected,\s*disabled: lifecycleLocked,?\s*\}\}/,
    );
    expect(option).toMatch(
      /accessibilityHint=\{\s*lifecycleLocked \? BULK_LIFECYCLE_LOCKED_COPY : undefined\s*\}/,
    );
  });

  it("disables the frequency picker while locked", () => {
    const start = screen.indexOf("<FrequencyPicker");
    const picker = screen.slice(start, screen.indexOf("/>", start));
    expect(picker).toContain("disabled={lifecycleLocked}");
  });

  it("shows the explanation as visible text while locked", () => {
    expect(screen).toMatch(
      /\{lifecycleLocked \? \(\s*<Text[\s\S]*?testID="bulk-import-lifecycle-locked"[\s\S]*?\{BULK_LIFECYCLE_LOCKED_COPY\}/,
    );
  });

  it("writes the locked lifecycle, never an edited one, on Import and Combine", () => {
    const uses = screen.match(
      /lockedLifecycle \?\?\s*bulkLifecycleChoice\(trackingEnabled, intervalDays\)/g,
    );
    expect(uses?.length).toBe(2);
    expect(screen).not.toMatch(
      /lifecycle: bulkLifecycleChoice\(trackingEnabled, intervalDays\)/,
    );
  });
});

describe("FrequencyPicker supports a disabled state (D-64)", () => {
  const picker = source("src/components/FrequencyPicker.tsx");

  it("takes an optional disabled prop, off by default", () => {
    expect(picker).toMatch(/disabled\?: boolean;/);
    expect(picker).toMatch(/disabled = false,/);
  });

  it("disables every chip and unit, and the custom input", () => {
    const pressables = picker.split("<Pressable").slice(1);
    expect(pressables).toHaveLength(3);
    for (const region of pressables) {
      const element = region.slice(0, region.indexOf(">"));
      expect(element).toContain("disabled={disabled}");
      expect(element).toMatch(/accessibilityState=\{\{[^}]*\bdisabled\b/);
    }
    expect(picker).toContain("editable={!disabled}");
  });
});
