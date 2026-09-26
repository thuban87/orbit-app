import { describe, expect, it } from "vitest";
import { importCompleteRetryState } from "./import-complete-logic";

describe("importCompleteRetryState (RG-035, D-26)", () => {
  it("offers Retry for pending rows left by a fatal stop", () => {
    const state = importCompleteRetryState({
      failed: 0,
      pending: 3,
      photoRows: 0,
    });
    expect(state.visible).toBe(true);
    expect(state.message).toBe("Some contacts haven't been imported yet.");
  });

  it("keeps the failed-rows message", () => {
    expect(
      importCompleteRetryState({ failed: 2, pending: 0, photoRows: 0 }),
    ).toEqual({
      visible: true,
      message: "Some contacts couldn't be imported.",
    });
  });

  it("keeps the unfinished-photos message", () => {
    expect(
      importCompleteRetryState({ failed: 0, pending: 0, photoRows: 2 }),
    ).toEqual({
      visible: true,
      message: "Some contact photos still need to be added.",
    });
  });

  it("is hidden when nothing is left to retry", () => {
    expect(
      importCompleteRetryState({ failed: 0, pending: 0, photoRows: 0 }),
    ).toEqual({ visible: false, message: null });
  });

  it("prefers failed, then pending, then photos", () => {
    expect(
      importCompleteRetryState({ failed: 1, pending: 1, photoRows: 1 }).message,
    ).toBe("Some contacts couldn't be imported.");
    expect(
      importCompleteRetryState({ failed: 0, pending: 1, photoRows: 1 }).message,
    ).toBe("Some contacts haven't been imported yet.");
  });
});
