import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { boundFrequencyBlocksImport } from "./bulk-import-setup-logic";

/**
 * 38.4 review Lane C CR-01: `FrequencyPicker` never emits an invalid custom
 * entry, so its parent must wire `onValidityChange` and block Import while the
 * batch (or the single review) is Bound with an invalid frequency. Otherwise
 * the contact(s) are written with the last cadence the picker emitted.
 */
describe("boundFrequencyBlocksImport (CR-01)", () => {
  it("blocks only a Bound choice with an invalid frequency", () => {
    expect(boundFrequencyBlocksImport(true, false)).toBe(true);
    expect(boundFrequencyBlocksImport(true, true)).toBe(false);
    expect(boundFrequencyBlocksImport(false, false)).toBe(false);
    expect(boundFrequencyBlocksImport(false, true)).toBe(false);
  });
});

function source(name: string): string {
  return readFileSync(join(__dirname, name), "utf8");
}

/** The `<FrequencyPicker … />` element text. */
function pickerElement(screen: string): string {
  const start = screen.indexOf("<FrequencyPicker");
  expect(start).toBeGreaterThan(-1);
  return screen.slice(start, screen.indexOf("/>", start));
}

/** The lifecycle option's onPress body (the Bound/Unbound radio). */
function lifecyclePress(screen: string, setter: string): string {
  const at = screen.indexOf(`setTrackingEnabled(${setter})`);
  expect(at, setter).toBeGreaterThan(-1);
  return screen.slice(screen.lastIndexOf("onPress={", at), at + 200);
}

describe("BulkImportSetupScreen frequency validity (CR-01)", () => {
  const screen = source("BulkImportSetupScreen.tsx");

  it("wires the picker's validity into screen state", () => {
    expect(screen).toMatch(
      /const \[intervalValid, setIntervalValid\] = useState\(true\)/,
    );
    expect(pickerElement(screen)).toContain(
      "onValidityChange={setIntervalValid}",
    );
  });

  it("resets validity to valid when Unbound is chosen", () => {
    expect(lifecyclePress(screen, "bound")).toMatch(
      /if \(!bound\) setIntervalValid\(true\)/,
    );
  });

  it("gates the Import button and every write path on the Bound + invalid block", () => {
    expect(screen).toMatch(
      /const importBlocked =\s*saving \|\|\s*count === 0 \|\|\s*boundFrequencyBlocksImport\(trackingEnabled, intervalValid\)/,
    );
    expect(screen).toContain("disabled={importBlocked}");
    for (const name of ["startBatch", "onImport"]) {
      const body = screen.slice(screen.indexOf(`async function ${name}(`));
      expect(body.split("\n")[1], name).toContain("if (importBlocked) return;");
    }
    const combine = screen.slice(screen.indexOf("async function onCombine("));
    // The opening guard, before the first statement that writes anything.
    const guard = combine.slice(0, combine.indexOf("return;"));
    expect(guard).not.toContain("setSaving(true)");
    expect(guard).toContain(
      "boundFrequencyBlocksImport(trackingEnabled, intervalValid)",
    );
  });
});

describe("ImportReviewScreen frequency validity (CR-01)", () => {
  const screen = source("ImportReviewScreen.tsx");

  it("wires the picker's validity into screen state", () => {
    expect(screen).toMatch(
      /const \[intervalValid, setIntervalValid\] = useState\(true\)/,
    );
    expect(pickerElement(screen)).toContain(
      "onValidityChange={setIntervalValid}",
    );
  });

  it("resets validity to valid when Unbound is chosen", () => {
    expect(lifecyclePress(screen, "enabled")).toMatch(
      /if \(!enabled\) setIntervalValid\(true\)/,
    );
  });

  it("includes the Bound + invalid block in canImport", () => {
    const canImport = screen.slice(
      screen.indexOf("const canImport ="),
      screen.indexOf(";", screen.indexOf("const canImport =")),
    );
    expect(canImport).toContain(
      "!boundFrequencyBlocksImport(trackingEnabled, intervalValid)",
    );
  });
});
