/**
 * Create / Edit Contact Save is single-flight through a synchronous ref (38.9
 * verification review IN-04).
 *
 * The old guard read the `saving` state from the render closure. Two taps
 * that reach `handleSave` before a re-render both passed it; the second then
 * got `false` from the duplicate-name confirm (confirm-store de-dupe) and its
 * `finally` re-enabled Save while the first save was still running. The ref
 * from `@/utils/single-flight` (node-tested in single-flight.test.ts) is
 * claimed before the first await, so it covers that confirm.
 *
 * Render-free: source assertions over both screens' `handleSave`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

/** The body of `async function handleSave() { … }`. */
function handleSaveBody(path: string): string {
  const source = readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");
  const start = source.indexOf("async function handleSave()");
  expect(start, `${path}: handleSave not found`).toBeGreaterThan(-1);
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
  throw new Error(`${path}: unterminated handleSave`);
}

describe.each([
  "src/screens/CreateContactScreen.tsx",
  "src/screens/EditContactScreen.tsx",
])("%s Save is single-flight (verification IN-04)", (path) => {
  const body = handleSaveBody(path);

  it("never guards on the render-closure `saving` state", () => {
    // `saving` as an operand of a condition (copy such as "before saving
    // again" is not a guard).
    expect(body).not.toMatch(/(?:\(|\|\||&&|!)\s*saving\s*(?:\)|\|\||&&)/);
    expect(body).toContain("savingRef.current");
  });

  it("claims the ref before the first await and the duplicate-name confirm", () => {
    const claim = body.indexOf("if (!beginInFlight(savingRef)) return;");
    expect(claim).toBeGreaterThan(-1);
    expect(claim).toBeLessThan(body.indexOf("await "));
    expect(claim).toBeLessThan(body.indexOf("confirmDuplicate("));
  });

  it("releases the ref only in the finally", () => {
    const release = body.indexOf("endInFlight(savingRef)");
    expect(release).toBeGreaterThan(body.lastIndexOf("} finally {"));
    expect(body.split("endInFlight(savingRef)")).toHaveLength(2);
  });

  it("settles the guard's hold after the release, so a parked RESET is not lost (third fix pass WR-01)", () => {
    const release = body.indexOf("endInFlight(savingRef)");
    expect(body.indexOf("settleHold();", release)).toBeGreaterThan(release);
  });
});

describe.each([
  ["src/screens/CreateContactScreen.tsx", "New contact"],
  ["src/screens/EditContactScreen.tsx", "Edit contact"],
])("%s holds its exits while a save runs (fix-pass WR-02)", (path, title) => {
  const source = readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");

  it("passes the save ref to the guard, so Back cannot offer Discard mid-save", () => {
    expect(source).toMatch(
      /useDiscardKeepGuard\(\{[\s\S]*?busyRef: savingRef,[\s\S]*?\}\);/,
    );
  });

  it("takes settleHold from the guard (third fix pass WR-01)", () => {
    expect(source).toMatch(
      /const \{ requestClose, settleHold \} = useDiscardKeepGuard\(\{/,
    );
  });

  it("draws the header Back disabled while saving (D-26)", () => {
    const header = source.match(
      new RegExp(`<ShellAppBar[^>]*title="${title}"[^>]*/>`, "g"),
    );
    // Edit Contact's loading header has no save to hold; the form's does.
    expect(header?.some((tag) => tag.includes("backDisabled={saving}"))).toBe(
      true,
    );
  });
});
