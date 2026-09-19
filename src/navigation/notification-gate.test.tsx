import { describe, expect, it, vi } from "vitest";

vi.mock("expo-notifications", () => ({
  DEFAULT_ACTION_IDENTIFIER: "default",
  addNotificationResponseReceivedListener: vi.fn(),
  clearLastNotificationResponseAsync: vi.fn(),
  getLastNotificationResponseAsync: vi.fn(),
}));
vi.mock("@/services/notifications/notification-actions", () => ({
  handleNotificationAction: vi.fn(),
}));
vi.mock("./linking", () => ({ navigationRef: { current: null } }));

import { navigationRef } from "./linking";
import { applyBodyNav, guardNotificationBodyIntent } from "./notification-gate";

const decay = {
  kind: "decay" as const,
  contactId: 7,
  occurrenceKey: "2026-08-29",
};
const birthday = {
  kind: "birthday" as const,
  contactId: 7,
  occurrenceKey: "2026-08-29",
};
const digest = { kind: "digest" as const };

describe("guardNotificationBodyIntent", () => {
  it("keeps Digest as a lookup-free promoted-tab intent", async () => {
    const lookup = vi.fn();

    await expect(
      guardNotificationBodyIntent(digest, lookup),
    ).resolves.toEqual({ type: "select-digest" });
    expect(lookup).not.toHaveBeenCalled();
  });
  it("keeps a Bound decay tap on Compose", async () => {
    await expect(
      guardNotificationBodyIntent(decay, async () => ({
        archived_at: null,
        trackingEnabled: 1,
      })),
    ).resolves.toMatchObject({
      routes: [{ name: "Home" }, { name: "Compose" }],
    });
  });

  it("routes a now-Unbound decay tap to Profile instead of Compose", async () => {
    await expect(
      guardNotificationBodyIntent(decay, async () => ({
        archived_at: null,
        trackingEnabled: 0,
      })),
    ).resolves.toEqual({
      type: "reset",
      index: 1,
      routes: [{ name: "Home" }, { name: "Profile", params: { contactId: 7 } }],
    });
  });

  it("keeps an Unbound birthday tap on Profile", async () => {
    await expect(
      guardNotificationBodyIntent(birthday, async () => ({
        archived_at: null,
        trackingEnabled: 0,
      })),
    ).resolves.toEqual({
      type: "reset",
      index: 1,
      routes: [{ name: "Home" }, { name: "Profile", params: { contactId: 7 } }],
    });
  });

  it("leaves malformed notification data unroutable", async () => {
    await expect(
      guardNotificationBodyIntent(
        { kind: "unknown" } as never,
        async () => null,
      ),
    ).resolves.toBeNull();
  });
});

describe("applyBodyNav", () => {
  it("resets a Digest body tap to the Digest tab root without a lookup", async () => {
    const reset = vi.fn();
    const lookup = vi.fn();
    navigationRef.current = { reset } as never;

    await applyBodyNav(digest, () => true, lookup);

    expect(lookup).not.toHaveBeenCalled();
    expect(reset).toHaveBeenCalledWith({
      index: 0,
      routes: [
        {
          name: "DigestTab",
          state: { index: 0, routes: [{ name: "Digest" }] },
        },
      ],
    });
  });
  it("does not let an older lookup overwrite a newer notification destination", async () => {
    let resolveFirst:
      | ((value: { archived_at: null; trackingEnabled: 1 }) => void)
      | undefined;
    let resolveSecond:
      | ((value: { archived_at: null; trackingEnabled: 1 }) => void)
      | undefined;
    const firstLookup = new Promise<{
      archived_at: null;
      trackingEnabled: 1;
    }>((resolve) => {
      resolveFirst = resolve;
    });
    const secondLookup = new Promise<{
      archived_at: null;
      trackingEnabled: 1;
    }>((resolve) => {
      resolveSecond = resolve;
    });
    const reset = vi.fn();
    navigationRef.current = { reset } as never;

    let latestRequestId = 1;
    const first = applyBodyNav(
      decay,
      () => latestRequestId === 1,
      async () => firstLookup,
    );
    latestRequestId = 2;
    const second = applyBodyNav(
      { ...decay, contactId: 8 },
      () => latestRequestId === 2,
      async () => secondLookup,
    );

    resolveSecond?.({ archived_at: null, trackingEnabled: 1 });
    await second;
    resolveFirst?.({ archived_at: null, trackingEnabled: 1 });
    await first;

    expect(reset).toHaveBeenCalledTimes(1);
    expect(reset.mock.calls[0][0]).toMatchObject({
      routes: [
        {
          name: "DashboardTab",
          state: {
            routes: [
              { name: "Home" },
              { name: "Compose", params: { contactId: 8 } },
            ],
          },
        },
      ],
    });
  });
});
