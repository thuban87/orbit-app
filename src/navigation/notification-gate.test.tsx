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

import { guardNotificationBodyIntent } from "./notification-gate";

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

describe("guardNotificationBodyIntent", () => {
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
      name: "Profile",
      params: { contactId: 7 },
      type: "navigate",
    });
  });

  it("keeps an Unbound birthday tap on Profile", async () => {
    await expect(
      guardNotificationBodyIntent(birthday, async () => ({
        archived_at: null,
        trackingEnabled: 0,
      })),
    ).resolves.toEqual({
      name: "Profile",
      params: { contactId: 7 },
      type: "navigate",
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
