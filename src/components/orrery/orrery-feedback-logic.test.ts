import { describe, expect, it, vi } from "vitest";
import { createFeedbackRetry, feedbackCopy } from "./orrery-feedback-logic";

describe("surface-specific Orrery feedback", () => {
  it("keeps loading, missing, stale, and optional failures distinct", () => {
    expect(feedbackCopy("world-loading").message).toBe("Loading your Orrery…");
    expect(feedbackCopy("read")).toEqual({
      message: "Couldn't load this System. Try loading it again.",
      action: "Reload System",
    });
    expect(feedbackCopy("stale").message).toContain("last loaded contacts");
    expect(feedbackCopy("satellites").message).toContain(
      "Your contacts are still available.",
    );
    expect(feedbackCopy("removed").action).toBe("Show All Contacts");
    expect(feedbackCopy("reorder").message).toContain(
      "saved order has been restored",
    );
  });
  it("suppresses a double tap and permits retry after rejection", async () => {
    let reject!: (error: Error) => void;
    const operation = vi.fn(
      () =>
        new Promise<void>((_, no) => {
          reject = no;
        }),
    );
    const states: boolean[] = [];
    const retry = createFeedbackRetry((busy) => states.push(busy));
    const first = retry.run(operation);
    void retry.run(operation);
    expect(operation).toHaveBeenCalledTimes(1);
    reject(new Error("read"));
    await first;
    await retry.run(async () => {});
    expect(states).toEqual([true, false, true, false]);
    retry.dispose();
    await retry.run(operation);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
