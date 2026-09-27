import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * AIPermissionsScreen source contract (38.4 review, Lane D). Textual: the
 * screen's React state wiring, which the node test environment cannot render.
 */
const screen = readFileSync(join(__dirname, "AIPermissionsScreen.tsx"), "utf8");

/** Text of `async function name(` up to the next top-level screen function. */
function functionBody(name: string): string {
  const start = screen.indexOf(`async function ${name}(`);
  expect(start, name).toBeGreaterThan(-1);
  const ends = ["\n  async function ", "\n  function ", "\n  const "]
    .map((marker) => screen.indexOf(marker, start + 1))
    .filter((index) => index > -1);
  return screen.slice(start, Math.min(...ends));
}

describe("AI permissions read vs action errors (Lane D WR-01)", () => {
  it("keeps a read error apart from a failed write", () => {
    expect(screen).toContain(
      "const [readError, setReadError] = useState<string | null>(null);",
    );
    expect(screen).toContain(
      "const [actionError, setActionError] = useState<string | null>(null);",
    );
    expect(screen).not.toMatch(/\bsetError\(/);
  });

  it("only a failed or missing read suppresses the counts", () => {
    expect(screen).toMatch(/loadFailed: !loaded \|\| readError !== null/);
    expect(screen).not.toMatch(/loadFailed:[^\n]*actionError/);
  });

  it("the read sets and clears only the read error", () => {
    const load = screen.slice(
      screen.indexOf("const load = useCallback("),
      screen.indexOf("useEffect(() => {"),
    );
    expect(load).toContain("setReadError(null)");
    expect(load).toMatch(/setReadError\("Couldn't load AI permissions/);
    expect(load).not.toContain("setActionError(");
  });

  it("every write reports through the action error, never the read error", () => {
    for (const name of ["toggleDefault", "requestEnable", "applyPending"]) {
      const body = functionBody(name);
      expect(body, name).toContain("setActionError(");
      expect(body, name).not.toContain("setReadError(");
    }
  });

  it("shows whichever error is present", () => {
    expect(screen).toContain("const shownError = readError ?? actionError;");
    expect(screen).toContain("{shownError ? (");
  });
});

describe("AI permissions selection acts only on visible rows (Lane D WR-04)", () => {
  it("derives the effective selection from the filtered view and the expanded contact", () => {
    expect(screen).toMatch(
      /visibleSelectedKeys\(filtered, expandedContact, selected\)/,
    );
  });

  it("builds bulk refs from the visible selection only", () => {
    expect(screen).toMatch(
      /selectedPermissionRefs\(filtered, visibleSelected\)/,
    );
    expect(screen).not.toMatch(/selectedPermissionRefs\(items,/);
  });

  it("counts and shows the bulk bar from the visible selection only", () => {
    expect(screen).not.toMatch(/\bselected\.size\b/);
    expect(screen).toContain("{visibleSelected.size > 0 ? (");
    expect(screen).toContain("{visibleSelected.size} selected");
  });

  it("still writes consent only through the confirmed bulk apply", () => {
    const writers = [
      ...screen.matchAll(/\bbulk(Enable|Disable)AiPermissions\(/g),
    ];
    // Exactly one call each, both inside applyPending, both on `refs`.
    const apply = functionBody("applyPending");
    expect(apply).toContain("bulkEnableAiPermissions(getExecutor(), refs,");
    expect(apply).toContain("bulkDisableAiPermissions(getExecutor(), refs,");
    expect(writers.length).toBe(2);
  });
});
