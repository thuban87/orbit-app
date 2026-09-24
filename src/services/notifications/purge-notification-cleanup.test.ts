/**
 * Co-located unit test for the post-commit notification purge cleanup.
 *
 * Uses the dependency-free `expo-notifications` double (11-01) so the adapter can
 * be driven without the native binding. Asserts BOTH identifiers are cancelled
 * for a purged contact, and that a rejected first cancel still attempts the
 * second and never rejects the adapter (best-effort / error-resilient, mirroring
 * the photo cleanup contract).
 */
import {
  cancelScheduledNotificationAsync,
  dismissNotificationAsync,
} from "expo-notifications";
import { afterEach, describe, expect, it, vi } from "vitest";
import { birthdayIdentifier, decayIdentifier } from "./notification-ids";
import { buildNotificationPurgeCleanup } from "./purge-notification-cleanup";

vi.mock("expo-notifications");

const cancel = vi.mocked(cancelScheduledNotificationAsync);
const dismiss = vi.mocked(dismissNotificationAsync);

afterEach(() => {
  vi.clearAllMocks();
});

describe("buildNotificationPurgeCleanup — post-commit decay+birthday cancel", () => {
  it("cancels both the decay and birthday identifiers for the purged contact", async () => {
    const cleanup = buildNotificationPurgeCleanup();

    await cleanup(42);

    const ids = cancel.mock.calls.map((c) => c[0]);
    expect(ids).toContain(decayIdentifier(42));
    expect(ids).toContain(birthdayIdentifier(42));
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(dismiss.mock.calls.map((c) => c[0])).toEqual([
      decayIdentifier(42),
      birthdayIdentifier(42),
    ]);
  });

  it("still attempts the birthday cancel after the decay cancel rejects, and does not reject", async () => {
    cancel.mockRejectedValueOnce(new Error("decay cancel blew up"));

    const cleanup = buildNotificationPurgeCleanup();

    await expect(cleanup(7)).resolves.toBeUndefined();

    const ids = cancel.mock.calls.map((c) => c[0]);
    expect(ids).toContain(decayIdentifier(7));
    expect(ids).toContain(birthdayIdentifier(7));
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(dismiss).toHaveBeenCalledTimes(2);
  });

  it("does not reject when both cancels reject", async () => {
    cancel.mockRejectedValue(new Error("both blew up"));

    const cleanup = buildNotificationPurgeCleanup();

    await expect(cleanup(9)).resolves.toBeUndefined();
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(dismiss).toHaveBeenCalledTimes(2);
  });

  it("still dismisses birthday after decay dismissal fails", async () => {
    dismiss.mockRejectedValueOnce(new Error("decay dismiss failed"));
    await expect(buildNotificationPurgeCleanup()(7)).resolves.toBeUndefined();
    expect(dismiss.mock.calls.map((c) => c[0])).toEqual([
      decayIdentifier(7),
      birthdayIdentifier(7),
    ]);
  });
});
