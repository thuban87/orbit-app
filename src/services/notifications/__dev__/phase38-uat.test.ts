import {
  __reset,
  cancelScheduledNotificationAsync,
  scheduleNotificationAsync,
} from "expo-notifications";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelPhase38DigestUat,
  schedulePhase38DigestUat,
} from "./phase38-uat";
import {
  DIGEST_BODY,
  DIGEST_CHANNEL,
  DIGEST_IDENTIFIER,
  DIGEST_TITLE,
} from "../notification-ids";

vi.mock("expo-notifications");

describe("Phase 38 Digest notification UAT probe", () => {
  beforeEach(() => __reset());

  it("schedules generic Digest copy on the Digest channel under a UAT-only id", async () => {
    const now = new Date("2026-09-19T15:00:00.000Z");
    const identifier = await schedulePhase38DigestUat(now, 5_000);

    expect(identifier).toMatch(/^digest:uat:/);
    expect(identifier).not.toBe(DIGEST_IDENTIFIER);
    expect(scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier,
      content: {
        title: DIGEST_TITLE,
        body: DIGEST_BODY,
        data: { kind: "digest" },
        autoDismiss: true,
      },
      trigger: {
        type: "date",
        channelId: DIGEST_CHANNEL,
        date: new Date(now.getTime() + 5_000),
      },
    });
  });

  it("cancels only a retained UAT identifier and refuses the weekly singleton", async () => {
    await cancelPhase38DigestUat("digest:uat:123");
    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "digest:uat:123",
    );

    await expect(cancelPhase38DigestUat(DIGEST_IDENTIFIER)).rejects.toThrow(
      "UAT-only",
    );
    expect(cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
  });
});
