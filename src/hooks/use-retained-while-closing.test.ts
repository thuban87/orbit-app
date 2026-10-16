import { describe, expect, it, vi } from "vitest";

// One persistent ref across "renders", as React keeps it for a mounted host.
const ref = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: () => ref,
}));

import {
  retainWhileClosing,
  useRetainedWhileClosing,
} from "./use-retained-while-closing";

/**
 * Review IN-06 (38.11): a host nulls a sheet's target in `onClose`, before the
 * close animation ends. The sheet keeps rendering the last target meanwhile,
 * so its title never reads "Snooze " or "Snooze 0 contacts".
 */
describe("retainWhileClosing (review IN-06)", () => {
  it("passes a live value through and keeps the last one once it clears", () => {
    expect(retainWhileClosing(null, { name: "Ann" })).toEqual({ name: "Ann" });
    expect(retainWhileClosing({ name: "Ann" }, null)).toEqual({ name: "Ann" });
    expect(retainWhileClosing({ name: "Ann" }, { name: "Bo" })).toEqual({
      name: "Bo",
    });
    expect(retainWhileClosing(null, null)).toBeNull();
  });

  it("the hook remembers across renders", () => {
    ref.current = null;
    expect(useRetainedWhileClosing<{ name: string }>(null)).toBeNull();
    expect(useRetainedWhileClosing({ name: "Ann" })).toEqual({ name: "Ann" });
    expect(useRetainedWhileClosing<{ name: string }>(null)).toEqual({
      name: "Ann",
    });
  });
});
