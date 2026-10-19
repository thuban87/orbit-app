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
