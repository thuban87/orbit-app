/**
 * 38.9 review WR-01: a duplicate identical `confirm()` now resolves `false` at
 * once (confirm-store.ts), so one tap on Confirm can never run an
 * irreversible action twice. Two call sites still need their own synchronous
 * single-flight:
 *
 * - Merge contacts: the button stayed live while the merge ran, so a later
 *   tap opened a fresh confirm. It is now guarded by a ref and drawn disabled
 *   (D-26) from the confirm until the merge settles.
 * - Backup export: the readable-JSON prompt (38.12 D-63: a three-way
 *   `choose()` with Cancel) must open once per export. The ref is claimed
 *   before the prompt is shown and released on Cancel.
 *
 * Render-free: source assertions.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(join(__dirname, "../..", path), "utf8").replace(/\r\n/g, "\n");

describe("Merge contacts single-flight (WR-01)", () => {
  const source = read("src/components/MergeImpactSummary.tsx");
  const handler = source.slice(
    source.indexOf("const confirmMerge = () => {"),
    source.indexOf("const rows = counts"),
  );

  it("claims the in-flight ref before the confirm opens", () => {
    // 38.12 review B-WR-10: the guard also refuses before the summary loads.
    const guard = handler.indexOf(
      "if (mergingRef.current || counts === null) return;",
    );
    const claim = handler.indexOf("mergingRef.current = true;");
    const prompt = handler.indexOf("confirm({");
    expect(guard).toBeGreaterThan(-1);
    expect(claim).toBeGreaterThan(guard);
    expect(prompt).toBeGreaterThan(claim);
  });

  it("releases it on Cancel and on a failed merge, not on success", () => {
    expect(handler).toMatch(/if \(!ok\) \{\s*settleMerge\(\);\s*return;/);
    expect(handler).toMatch(
      /\.catch\(\(error: unknown\) => \{\s*settleMerge\(\);/,
    );
  });

  it("draws the Merge button disabled while in flight (D-26)", () => {
    const open = source.lastIndexOf("<Pressable");
    const button = source.slice(open, source.indexOf("</Pressable>", open));
    expect(button).toContain("Merge contacts");
    // B-WR-10: disabled while in flight AND until the summary has loaded.
    expect(source).toMatch(/const mergeDisabled =\s*merging \|\|/);
    expect(button).toContain("disabled={mergeDisabled}");
    expect(button).toContain(
      "accessibilityState={{ disabled: mergeDisabled }}",
    );
    expect(button).toContain("colors.surfaceElevated");
  });
});

describe("Backup export single-flight (WR-01)", () => {
  const source = read("src/screens/BackupScreen.tsx");
  const onExport = source.slice(
    source.indexOf("const onExport = useCallback("),
    source.indexOf("const validateRestore"),
  );

  it("claims the in-flight ref before the readable-JSON prompt", () => {
    const guard = onExport.indexOf("if (exportInFlightRef.current) return;");
    const claim = onExport.indexOf("exportInFlightRef.current = true;");
    const prompt = onExport.indexOf("choose({");
    expect(guard).toBeGreaterThan(-1);
    expect(claim).toBeGreaterThan(guard);
    expect(prompt).toBeGreaterThan(claim);
  });

  it("releases it on Cancel, exporting nothing (38.12 D-63)", () => {
    expect(onExport).toMatch(
      /if \(choice === "cancel"\) \{\s*exportInFlightRef\.current = false;\s*return;/,
    );
    expect(onExport).not.toContain("dismissable: false");
  });

  it("releases it only when the export settles", () => {
    const runExport = source.slice(
      source.indexOf("const runExport = useCallback("),
      source.indexOf("const onExport = useCallback("),
    );
    expect(runExport).toMatch(
      /finally \{\s*exportInFlightRef\.current = false;/,
    );
  });
});
