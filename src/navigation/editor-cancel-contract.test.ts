/**
 * Editor Cancel contract (38.9 D-61, D-14).
 *
 * An editor's own Cancel follows the Back rule: with typed changes it shows the
 * "Discard changes?" prompt, untouched it closes at once, and a successful save
 * still closes without a prompt. The behaviour lives in `useDiscardKeepGuard`'s
 * `requestClose` (unit-tested in discard-keep-guard.test.ts); this textual scan
 * pins each surface's wiring to it so a later edit cannot quietly route a
 * Cancel back to a bare close.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

/** The body of `function name() {` or `const name = (...) => {`. */
function functionBody(source: string, name: string): string {
  const start = source.search(
    new RegExp(`(?:function\\s+${name}\\b|const\\s+${name}\\s*=)`),
  );
  expect(start, `${name} not found`).toBeGreaterThanOrEqual(0);
  // The first brace after the name opens the body (no destructured params).
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, index + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

describe("+ → Memory: Back and Cancel close the draft first (G-12; D-14, D-61)", () => {
  const screen = read("src/screens/MemoryScreen.tsx");
  const editor = read("src/components/MemoryEditor.tsx");

  it("MemoryScreen guards with a sub-editor that closes the draft, and no route dirt", () => {
    expect(screen).toMatch(
      /useDiscardKeepGuard\(\{[\s\S]*?hasUnsavedChanges:\s*false/,
    );
    expect(screen).toMatch(/subEditor:\s*\{[\s\S]*?closeDraft\(\)/);
  });

  it("MemoryScreen routes the editor's Cancel through requestClose", () => {
    expect(screen).toMatch(
      /onCancelRequest=\{\(close\)\s*=>\s*requestClose\(close,/,
    );
  });

  it("MemoryEditor's Cancel calls onCancelRequest when given and is never a bare close", () => {
    expect(editor).not.toMatch(/onPress=\{close\}/);
    expect(editor).toMatch(
      /onCancelRequest\s*\?\s*onCancelRequest\(close\)\s*:\s*close\(\)/,
    );
  });

  it("a successful save closes without a prompt", () => {
    const commit = functionBody(editor, "commit");
    expect(commit).toContain("if (saved) close()");
    expect(commit).not.toMatch(/confirmDiscard|requestClose|onCancelRequest/);
    const savedEffect = screen.slice(
      screen.indexOf("if (savedTick > 0)") - 200,
      screen.indexOf("if (savedTick > 0)") + 200,
    );
    expect(savedEffect).not.toMatch(/confirmDiscard|requestClose/);
    expect(savedEffect).toMatch(
      /bypassRef\.current = true;\s*navigation\.goBack\(\)/,
    );
  });
});
