import { describe, expect, it, vi } from "vitest";
import { beginInFlight, endInFlight, type InFlightRef } from "./single-flight";

describe("single-flight guard", () => {
  it("claims a free ref and rejects a second synchronous claim", () => {
    const ref: InFlightRef = { current: false };

    expect(beginInFlight(ref)).toBe(true);
    // A second tap in the same tick — before any await resolves — is rejected.
    expect(beginInFlight(ref)).toBe(false);
    expect(ref.current).toBe(true);
  });

  it("re-arms after the in-flight slot is released", () => {
    const ref: InFlightRef = { current: false };

    expect(beginInFlight(ref)).toBe(true);
    endInFlight(ref);
    expect(ref.current).toBe(false);
    // A later, distinct action can claim the slot again.
    expect(beginInFlight(ref)).toBe(true);
  });

  it("a synchronous double-invoke of a guarded async writer writes exactly once", async () => {
    const ref: InFlightRef = { current: false };
    const write = vi.fn(() => Promise.resolve());

    // Mirrors a save handler: begin synchronously, bail if already in flight,
    // release in finally. This is the mechanism that prevents duplicate rows.
    const save = async () => {
      if (!beginInFlight(ref)) return;
      try {
        await write();
      } finally {
        endInFlight(ref);
      }
    };

    // Two taps dispatched in the same tick, before the first await resolves.
    const first = save();
    const second = save();
    await Promise.all([first, second]);

    expect(write).toHaveBeenCalledTimes(1);
    // The guard is re-armed once the single write settles.
    expect(ref.current).toBe(false);
  });
});
