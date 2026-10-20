import { describe, expect, it, vi } from "vitest";
import {
  confirmThenDelete,
  REMOVE_PARTICIPANT_CHOICES,
} from "./remove-participant-logic";

/**
 * Remove from event (38.14 D-70, D-27): the safe choice first, then the
 * delete, then Cancel; the delete runs only after the standard destructive
 * confirm. The RN sheet is not rendered in tests (no react-test-renderer), so
 * these pure cases are the proof that declining runs nothing.
 */

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("REMOVE_PARTICIPANT_CHOICES (D-70)", () => {
  it("offers Keep, then Delete, then Cancel", () => {
    expect(REMOVE_PARTICIPANT_CHOICES.map((choice) => choice.key)).toEqual([
      "keep",
      "delete",
      "cancel",
    ]);
    expect(REMOVE_PARTICIPANT_CHOICES.map((choice) => choice.label)).toEqual([
      "Keep as individual interaction",
      "Delete interaction",
      "Cancel",
    ]);
  });

  it("draws only the delete choice as destructive", () => {
    expect(
      REMOVE_PARTICIPANT_CHOICES.filter(
        (choice) => choice.role === "destructive",
      ).map((choice) => choice.key),
    ).toEqual(["delete"]);
  });
});

describe("confirmThenDelete (D-70, D-27)", () => {
  it("runs the delete exactly once when the confirm resolves true", async () => {
    const latch = { current: false };
    const onDelete = vi.fn();
    const confirmFn = vi.fn(async () => true);

    await expect(confirmThenDelete(latch, confirmFn, onDelete)).resolves.toBe(
      "deleted",
    );

    expect(confirmFn).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(latch.current).toBe(false);
  });

  it("runs nothing when the confirm is cancelled", async () => {
    const latch = { current: false };
    const onDelete = vi.fn();

    await expect(
      confirmThenDelete(latch, async () => false, onDelete),
    ).resolves.toBe("cancelled");

    expect(onDelete).not.toHaveBeenCalled();
    expect(latch.current).toBe(false);
  });

  it("a double tap while the confirm is open opens no second confirm and deletes at most once", async () => {
    const latch = { current: false };
    const answer = deferred<boolean>();
    const confirmFn = vi.fn(() => answer.promise);
    const onDelete = vi.fn();

    const first = confirmThenDelete(latch, confirmFn, onDelete);
    const second = confirmThenDelete(latch, confirmFn, onDelete);
    await expect(second).resolves.toBe("busy");
    expect(confirmFn).toHaveBeenCalledTimes(1);

    answer.resolve(true);
    await expect(first).resolves.toBe("deleted");
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(latch.current).toBe(false);
  });

  it("releases the latch when the confirm rejects", async () => {
    const latch = { current: false };
    const onDelete = vi.fn();

    await expect(
      confirmThenDelete(
        latch,
        () => Promise.reject(new Error("dialog")),
        onDelete,
      ),
    ).rejects.toThrow("dialog");

    expect(onDelete).not.toHaveBeenCalled();
    expect(latch.current).toBe(false);
  });
});
