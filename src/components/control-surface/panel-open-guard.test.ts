import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { openIfStillFocused } from "./panel-open-guard";

describe("openIfStillFocused (D-50)", () => {
  it("opens when the screen is still focused at callback time", () => {
    const open = vi.fn();
    openIfStillFocused(() => true, open);
    expect(open).toHaveBeenCalledOnce();
  });

  it("does not open when the screen lost focus between the tap and the measure callback", () => {
    const open = vi.fn();
    let focused = true;
    const measureCallback = () => openIfStillFocused(() => focused, open);
    focused = false;
    measureCallback();
    expect(open).not.toHaveBeenCalled();
  });
});

describe("DashboardControlRow's focus check reads live navigation state (D-50; 38.13 review A-IN-03)", () => {
  it("asks navigation.isFocused() at callback time, not a render-time ref", () => {
    const row = readFileSync(
      "src/components/control-surface/DashboardControlRow.tsx",
      "utf8",
    );
    expect(row).toMatch(
      /const stillFocused = useCallback\(\s*\(\) => navigation\.isFocused\(\),\s*\[navigation\],?\s*\)/,
    );
    expect(row).not.toContain("isFocusedRef");
  });
});
