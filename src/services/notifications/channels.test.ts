import {
  AndroidImportance,
  AndroidNotificationVisibility,
  setNotificationChannelAsync,
} from "expo-notifications";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureChannels } from "./channels";
import {
  BIRTHDAY_CHANNEL,
  DECAY_PRIVATE_CHANNEL,
  DECAY_PUBLIC_CHANNEL,
} from "./notification-ids";

vi.mock("expo-notifications");

// `vi.mocked` gives the typed Mock view (`.mock.calls`) that the real
// expo-notifications signature lacks; at runtime vi.mock has swapped in the
// __mocks__ double, so AndroidImportance.LOW here is the double's value and
// matches what channels.ts writes.
const setChannel = vi.mocked(setNotificationChannelAsync);

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * Pull the config object each `setNotificationChannelAsync(id, config)` call was
 * made with, keyed by channel id, so assertions read against the intent (LOW,
 * PRIVATE/PUBLIC) rather than argument ordinals.
 */
function configById(): Record<
  string,
  { importance?: number; lockscreenVisibility?: number; sound?: unknown }
> {
  const out: Record<
    string,
    { importance?: number; lockscreenVisibility?: number; sound?: unknown }
  > = {};
  for (const [id, config] of setChannel.mock.calls) {
    out[id] = config;
  }
  return out;
}

describe("ensureChannels — immutable, versioned, LOW-importance channel set", () => {
  it("creates exactly the three versioned channels", async () => {
    await ensureChannels();

    expect(setChannel).toHaveBeenCalledTimes(3);
    const ids = setChannel.mock.calls.map((c) => c[0]);
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
    const cfg = configById();
    for (const config of Object.values(cfg)) {
      expect(config.sound == null).toBe(true);
    }
  });

  it("is idempotent — a second call re-issues the same create calls, never a mutate", async () => {
    await ensureChannels();
    const first = setChannel.mock.calls.map((c) => [
      c[0],
      c[1].importance,
      c[1].lockscreenVisibility,
    ]);

    await ensureChannels();
    // Six calls total; the second triplet is identical to the first — the same
    // idempotent create, no diff/patch path against an existing id.
    expect(setChannel).toHaveBeenCalledTimes(6);
    const second = setChannel.mock.calls
      .slice(3)
      .map((c) => [c[0], c[1].importance, c[1].lockscreenVisibility]);
    expect(second).toEqual(first);
  });
});
