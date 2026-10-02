import { describe, expect, it, vi } from "vitest";

vi.mock("./OrreryLabel", () => ({ prepareOrreryText: () => null }));

import { THEME_PRESETS } from "@/theme/theme-presets";
import { OrreryTextCache } from "./orrery-text-cache";

const colors = THEME_PRESETS.galaxy.dark;
function fakePrepare() {
  const disposed: string[] = [];
  const prepare = vi.fn((text: string) => ({
    text,
    width: 10,
    height: 10,
    paragraph: { dispose: () => disposed.push(text) } as never,
  }));
  return { prepare, disposed };
}
const provider = {} as never;

describe("OrreryTextCache (D.6 Paragraph churn)", () => {
  it("reuses a Paragraph for an identical request and rebuilds on any key change", () => {
    const { prepare } = fakePrepare();
    const cache = new OrreryTextCache(prepare);
    const a = cache.get("Ava", "label", 1, 200, provider, colors);
    expect(cache.get("Ava", "label", 1, 200, provider, colors)).toBe(a);
    expect(prepare).toHaveBeenCalledTimes(1);
    cache.get("Ava", "caption", 1, 200, provider, colors);
    cache.get("Ava", "label", 1.3, 200, provider, colors);
    cache.get("Ava", "label", 1, 180, provider, colors);
    cache.get("Ava", "label", 1, 200, {} as never, colors);
    expect(prepare).toHaveBeenCalledTimes(5);
    expect(cache.get("Ava", "label", 1, 200, null, colors)).toBeNull();
  });
  it("sweep disposes only entries the committed set dropped; clear disposes all", () => {
    const { prepare, disposed } = fakePrepare();
    const cache = new OrreryTextCache(prepare);
    const a = cache.get("A", "label", 1, 200, provider, colors);
    cache.get("B", "label", 1, 200, provider, colors);
    cache.sweep([a, null]);
    expect(disposed).toEqual(["B"]);
    expect(cache.size).toBe(1);
    cache.clear();
    expect(disposed).toEqual(["B", "A"]);
    expect(cache.size).toBe(0);
    expect(cache.disposed).toBe(2);
  });
});
