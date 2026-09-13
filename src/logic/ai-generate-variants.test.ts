/**
 * ai-generate-variants — proof of the node-pure three-call fan-out and the
 * per-variant temperature ladder (Phase 35-04, COMP-12 / HIGH-3).
 */
import { describe, expect, it, vi } from "vitest";
import {
  generateVariants,
  variantTemperature,
} from "@/logic/ai-generate-variants";

/** A never-settling promise, to model a still-in-flight sibling call. */
function pending<T>(): Promise<T> {
  return new Promise<T>(() => {
    /* never settles */
  });
}

describe("generateVariants — fan-out order + index", () => {
  it("resolves exactly three drafts in deterministic (index) order", async () => {
    const generateOne = vi.fn(
      async (_p: string, _s: AbortSignal, i: number) => ["a", "b", "c"][i],
    );
    const controller = new AbortController();

    const drafts = await generateVariants(
      generateOne,
      "PROMPT",
      controller.signal,
      3,
    );
    expect(drafts).toEqual(["a", "b", "c"]);
    expect(generateOne).toHaveBeenCalledTimes(3);
  });

  it("passes each call its expected 0-based variantIndex (0,1,2)", async () => {
    const generateOne = vi.fn(
      async (_p: string, _s: AbortSignal, _i: number) => "draft",
    );
    const controller = new AbortController();

    await generateVariants(generateOne, "PROMPT", controller.signal, 3);
    const indices = generateOne.mock.calls.map((c) => c[2]);
    expect(indices).toEqual([0, 1, 2]);
    // Every call shared the ONE signal.
    for (const call of generateOne.mock.calls) {
      expect(call[1]).toBe(controller.signal);
    }
  });

  it("resolves the drafts in index order even when they settle out of order", async () => {
    const generateOne = vi.fn((_p: string, _s: AbortSignal, i: number) => {
      // Later indices settle first — Promise.all must still order by index.
      const delay = (3 - i) * 5;
      return new Promise<string>((resolve) =>
        setTimeout(() => resolve(`v${i}`), delay),
      );
    });
    const controller = new AbortController();

    const drafts = await generateVariants(
      generateOne,
      "PROMPT",
      controller.signal,
      3,
    );
    expect(drafts).toEqual(["v0", "v1", "v2"]);
  });
});

describe("generateVariants — failure + pre-abort", () => {
  it("rejects with the first error when one call rejects (fast-fail)", async () => {
    const err = { code: "network" };
    const generateOne = vi.fn((_p: string, _s: AbortSignal, i: number) =>
      i === 1 ? Promise.reject(err) : pending<string>(),
    );
    const controller = new AbortController();

    await expect(
      generateVariants(generateOne, "PROMPT", controller.signal, 3),
    ).rejects.toBe(err);
    // It fired all three calls but does NOT abort — the caller owns the signal.
    expect(generateOne).toHaveBeenCalledTimes(3);
    expect(controller.signal.aborted).toBe(false);
  });

  it("fires ZERO calls when the signal is already aborted", async () => {
    const generateOne = vi.fn(async () => "draft");
    const controller = new AbortController();
    controller.abort();

    await expect(
      generateVariants(generateOne, "PROMPT", controller.signal, 3),
    ).rejects.toBeDefined();
    expect(generateOne).not.toHaveBeenCalled();
  });
});

describe("variantTemperature — distinct, in-range ladder (COMP-12 / D-12)", () => {
  function assertLadder(base: number): void {
    const temps = [0, 1, 2].map((i) => variantTemperature(base, i, 3));
    // In range.
    for (const t of temps) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(1);
    }
    // Pairwise distinct (never collapses).
    expect(new Set(temps).size).toBe(3);
  }

  it("yields three distinct in-range values at base=0 (low extreme)", () => {
    assertLadder(0);
  });

  it("yields three distinct in-range values at base=1 (high extreme)", () => {
    assertLadder(1);
  });

  it("yields three distinct in-range values at a mid base", () => {
    assertLadder(0.5);
  });

  it("is deterministic given the same inputs", () => {
    expect(variantTemperature(0.5, 2, 3)).toBe(variantTemperature(0.5, 2, 3));
  });

  it("centres the window on a mid base", () => {
    // base 0.5, step 0.15 → 0.35, 0.5, 0.65
    expect(variantTemperature(0.5, 0, 3)).toBeCloseTo(0.35, 6);
    expect(variantTemperature(0.5, 1, 3)).toBeCloseTo(0.5, 6);
    expect(variantTemperature(0.5, 2, 3)).toBeCloseTo(0.65, 6);
  });
});
