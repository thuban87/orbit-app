import {
  AndroidImportance,
  AndroidNotificationVisibility,
  __reset,
  setNotificationChannelAsync,
} from "expo-notifications";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BIRTHDAY_CHANNEL,
  DECAY_PRIVATE_CHANNEL,
  DECAY_PUBLIC_CHANNEL,
} from "./notification-ids";
import { ensureChannels } from "./channels";

vi.mock("expo-notifications");

afterEach(() => {
  __reset();
});

/**
 * Pull the config object each `setNotificationChannelAsync(id, config)` call was
 * made with, keyed by channel id, so assertions read against the intent (LOW,
 * PRIVATE/PUBLIC) rather than argument ordinals.
 */
function configById(): Record<
  string,
  { importance?: number; lockscreenVisibility?: number }
> {
  const out: Record<
    string,
    { importance?: number; lockscreenVisibility?: number }
  > = {};
  for (const call of setNotificationChannelAsync.mock.calls) {
    const [id, config] = call as [
      string,
      { importance?: number; lockscreenVisibility?: number },
    ];
    out[id] = config;
  }
  return out;
}

describe("ensureChannels — immutable, versioned, LOW-importance channel set", () => {
  it("creates exactly the three versioned channels", async () => {
    await ensureChannels();

    expect(setNotificationChannelAsync).toHaveBeenCalledTimes(3);
    const ids = setNotificationChannelAsync.mock.calls.map((c) => c[0]);
    expect(ids).toEqual(
      expect.arrayContaining([
        DECAY_PRIVATE_CHANNEL,
        DECAY_PUBLIC_CHANNEL,
        BIRTHDAY_CHANNEL,
      ]),
    );
  });

  it("creates every channel at AndroidImportance.LOW — silent, no heads-up (not DEFAULT)", async () => {
    await ensureChannels();
    const cfg = configById();

    expect(cfg[DECAY_PRIVATE_CHANNEL].importance).toBe(AndroidImportance.LOW);
    expect(cfg[DECAY_PUBLIC_CHANNEL].importance).toBe(AndroidImportance.LOW);
    expect(cfg[BIRTHDAY_CHANNEL].importance).toBe(AndroidImportance.LOW);
    // Never the sound-playing tier.
    expect(cfg[DECAY_PRIVATE_CHANNEL].importance).not.toBe(
      AndroidImportance.DEFAULT,
    );
  });

  it("splits lock-screen visibility by channel: decay private/public, birthday private (OQ-2)", async () => {
    await ensureChannels();
    const cfg = configById();

    expect(cfg[DECAY_PRIVATE_CHANNEL].lockscreenVisibility).toBe(
      AndroidNotificationVisibility.PRIVATE,
    );
    expect(cfg[DECAY_PUBLIC_CHANNEL].lockscreenVisibility).toBe(
      AndroidNotificationVisibility.PUBLIC,
    );
    expect(cfg[BIRTHDAY_CHANNEL].lockscreenVisibility).toBe(
      AndroidNotificationVisibility.PRIVATE,
    );
  });

  it("does not set a custom sound (LOW is silent by tier)", async () => {
    await ensureChannels();
    for (const call of setNotificationChannelAsync.mock.calls) {
      const [, config] = call as [string, { sound?: unknown }];
      expect(config.sound == null || config.sound === undefined).toBe(true);
    }
  });

  it("is idempotent — a second call re-issues the same create calls, never a mutate", async () => {
    await ensureChannels();
    const first = setNotificationChannelAsync.mock.calls.map((c) => [
      c[0],
      (c[1] as { importance?: number; lockscreenVisibility?: number })
        .importance,
      (c[1] as { importance?: number; lockscreenVisibility?: number })
        .lockscreenVisibility,
    ]);

    await ensureChannels();
    // Six calls total; the second triplet is byte-identical to the first —
    // the same idempotent create, no diff/patch path against an existing id.
    expect(setNotificationChannelAsync).toHaveBeenCalledTimes(6);
    const second = setNotificationChannelAsync.mock.calls
      .slice(3)
      .map((c) => [
        c[0],
        (c[1] as { importance?: number; lockscreenVisibility?: number })
          .importance,
        (c[1] as { importance?: number; lockscreenVisibility?: number })
          .lockscreenVisibility,
      ]);
    expect(second).toEqual(first);
  });
});
