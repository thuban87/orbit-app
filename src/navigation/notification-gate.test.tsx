import { beforeEach, describe, expect, it, vi } from "vitest";

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

import {
  clearLastNotificationResponseAsync,
  getLastNotificationResponseAsync,
  type NotificationResponse,
} from "expo-notifications";
import { handleNotificationAction } from "@/services/notifications/notification-actions";
import {
  ACTION_MARK,
  ACTION_SNOOZE,
} from "@/services/notifications/notification-ids";
import { Logger } from "@/utils/logger";
import { navigationRef } from "./linking";
import {
  applyBodyNav,
  createNotificationIngressChronology,
  guardNotificationBodyIntent,
  handleColdStartResponse,
  handleWarmNotificationResponse,
} from "./notification-gate";

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

    await expect(guardNotificationBodyIntent(digest, lookup)).resolves.toEqual({
      type: "select-digest",
    });
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

// ─── RG-042: cold/warm body-tap chronology ───────────────────────────────────

type LiveContact = { archived_at: null; trackingEnabled: 1 };
const LIVE: LiveContact = { archived_at: null, trackingEnabled: 1 };

/** A hand-controlled promise so each test decides the arrival order. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Let every queued microtask (awaits inside the handler) run. */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve();
  }
}

function responseOf(
  actionIdentifier: string,
  data: unknown,
): NotificationResponse {
  return {
    actionIdentifier,
    notification: { request: { content: { data } } },
  } as unknown as NotificationResponse;
}

function composeTarget(reset: ReturnType<typeof vi.fn>, call: number) {
  return reset.mock.calls[call][0].routes[0].state.routes[1];
}

const getLast = vi.mocked(getLastNotificationResponseAsync);
const clearLast = vi.mocked(clearLastNotificationResponseAsync);
const actionHandler = vi.mocked(handleNotificationAction);

describe("createNotificationIngressChronology", () => {
  it("keeps cold current until a warm body tap is accepted", () => {
    const chronology = createNotificationIngressChronology();
    expect(chronology.coldIsCurrent()).toBe(true);
    chronology.markWarmBodyAccepted();
    expect(chronology.coldIsCurrent()).toBe(false);
  });

  it("makes cold stale after teardown", () => {
    const chronology = createNotificationIngressChronology();
    chronology.teardown();
    expect(chronology.coldIsCurrent()).toBe(false);
  });

  it("gives every instance (remount) independent state", () => {
    const first = createNotificationIngressChronology();
    first.markWarmBodyAccepted();
    first.teardown();
    expect(createNotificationIngressChronology().coldIsCurrent()).toBe(true);
  });
});

describe("handleWarmNotificationResponse", () => {
  beforeEach(() => {
    actionHandler.mockReset();
    actionHandler.mockResolvedValue(undefined as never);
  });

  it("marks a warm DEFAULT body tap as accepted before parking it", () => {
    const chronology = createNotificationIngressChronology();
    const park = vi.fn(() => {
      expect(chronology.coldIsCurrent()).toBe(false);
    });

    handleWarmNotificationResponse(
      responseOf("default", decay),
      chronology,
      park,
    );

    expect(park).toHaveBeenCalledWith(decay);
    expect(chronology.coldIsCurrent()).toBe(false);
  });

  it.each([ACTION_MARK, ACTION_SNOOZE])(
    "never marks a warm %s action tap as a body tap",
    (actionId) => {
      const chronology = createNotificationIngressChronology();
      const park = vi.fn();

      handleWarmNotificationResponse(
        responseOf(actionId, decay),
        chronology,
        park,
      );

      expect(actionHandler).toHaveBeenCalledWith(decay, actionId);
      expect(park).not.toHaveBeenCalled();
      expect(chronology.coldIsCurrent()).toBe(true);
    },
  );

  it("ignores any other action identifier", () => {
    const chronology = createNotificationIngressChronology();
    const park = vi.fn();

    handleWarmNotificationResponse(
      responseOf("other", decay),
      chronology,
      park,
    );

    expect(actionHandler).not.toHaveBeenCalled();
    expect(park).not.toHaveBeenCalled();
    expect(chronology.coldIsCurrent()).toBe(true);
  });
});

describe("handleColdStartResponse chronology", () => {
  let reset: ReturnType<typeof vi.fn>;
  let debug: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    reset = vi.fn();
    navigationRef.current = { reset } as never;
    getLast.mockReset();
    clearLast.mockReset();
    clearLast.mockResolvedValue(undefined);
    actionHandler.mockReset();
    actionHandler.mockResolvedValue(undefined as never);
    debug?.mockRestore();
    debug = vi.spyOn(Logger, "debug");
  });

  it("drops a cold result whose lookup resolves after a warm body tap was accepted", async () => {
    const chronology = createNotificationIngressChronology();
    const lookup = deferred<LiveContact>();
    getLast.mockResolvedValue(responseOf("default", decay));

    const cold = handleColdStartResponse(
      chronology.coldIsCurrent,
      () => lookup.promise,
    );
    await flush();
    chronology.markWarmBodyAccepted();
    lookup.resolve(LIVE);
    await cold;

    expect(reset).not.toHaveBeenCalled();
    expect(clearLast).toHaveBeenCalledTimes(1);
  });

  it("drops a cold result when retrieval itself is delayed past a warm accept", async () => {
    const chronology = createNotificationIngressChronology();
    const retrieval = deferred<NotificationResponse | null>();
    getLast.mockReturnValue(retrieval.promise);

    const cold = handleColdStartResponse(
      chronology.coldIsCurrent,
      async () => LIVE,
    );
    chronology.markWarmBodyAccepted();
    retrieval.resolve(responseOf("default", decay));
    await cold;

    expect(reset).not.toHaveBeenCalled();
    expect(clearLast).toHaveBeenCalledTimes(1);
  });

  it("applies a cold result that lands first, then lets a later warm tap win", async () => {
    const chronology = createNotificationIngressChronology();
    getLast.mockResolvedValue(responseOf("default", decay));

    await handleColdStartResponse(chronology.coldIsCurrent, async () => LIVE);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(composeTarget(reset, 0)).toEqual({
      name: "Compose",
      params: { contactId: 7 },
    });

    chronology.markWarmBodyAccepted();
    await applyBodyNav(
      { ...decay, contactId: 8 },
      () => true,
      async () => LIVE,
    );

    expect(reset).toHaveBeenCalledTimes(2);
    expect(composeTarget(reset, 1)).toEqual({
      name: "Compose",
      params: { contactId: 8 },
    });
    expect(debug).not.toHaveBeenCalled();
  });

  it("resolves a duplicate cold+warm delivery of the same tap to one (warm) navigation", async () => {
    const chronology = createNotificationIngressChronology();
    const coldLookup = deferred<LiveContact>();
    getLast.mockResolvedValue(responseOf("default", decay));

    const cold = handleColdStartResponse(
      chronology.coldIsCurrent,
      () => coldLookup.promise,
    );
    await flush();
    // The same tap arrives through the warm listener and is navigated first.
    chronology.markWarmBodyAccepted();
    await applyBodyNav(
      decay,
      () => true,
      async () => LIVE,
    );
    coldLookup.resolve(LIVE);
    await cold;

    expect(reset).toHaveBeenCalledTimes(1);
    expect(composeTarget(reset, 0)).toEqual({
      name: "Compose",
      params: { contactId: 7 },
    });
  });

  it("drops a pending cold result after the gate tears down", async () => {
    const chronology = createNotificationIngressChronology();
    const lookup = deferred<LiveContact>();
    getLast.mockResolvedValue(responseOf("default", decay));

    const cold = handleColdStartResponse(
      chronology.coldIsCurrent,
      () => lookup.promise,
    );
    await flush();
    chronology.teardown();
    lookup.resolve(LIVE);
    await cold;

    expect(reset).not.toHaveBeenCalled();
    expect(clearLast).toHaveBeenCalledTimes(1);
  });

  it("logs a dropped cold result once, at debug level, with no payload data", async () => {
    const chronology = createNotificationIngressChronology();
    const lookup = deferred<LiveContact>();
    getLast.mockResolvedValue(
      responseOf("default", { ...decay, contactId: 4213 }),
    );

    const cold = handleColdStartResponse(
      chronology.coldIsCurrent,
      () => lookup.promise,
    );
    await flush();
    chronology.markWarmBodyAccepted();
    lookup.resolve(LIVE);
    await cold;

    expect(debug).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(debug.mock.calls[0]);
    expect(logged).toContain("stale cold notification navigation dropped");
    expect(logged).not.toMatch(/\d/);
  });

  it("still routes a cold action tap and never treats it as a body navigation", async () => {
    const chronology = createNotificationIngressChronology();
    getLast.mockResolvedValue(responseOf(ACTION_MARK, decay));

    await handleColdStartResponse(chronology.coldIsCurrent, async () => LIVE);

    expect(actionHandler).toHaveBeenCalledWith(decay, ACTION_MARK);
    expect(reset).not.toHaveBeenCalled();
    expect(clearLast).toHaveBeenCalledTimes(1);
  });

  it("clears the launch response exactly once when retrieval rejects", async () => {
    const chronology = createNotificationIngressChronology();
    getLast.mockRejectedValue(new Error("native read failed"));

    await expect(
      handleColdStartResponse(chronology.coldIsCurrent, async () => LIVE),
    ).rejects.toThrow("native read failed");

    expect(clearLast).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
  });

  it("clears the launch response exactly once when the cold body lookup rejects", async () => {
    const chronology = createNotificationIngressChronology();
    getLast.mockResolvedValue(responseOf("default", decay));

    await expect(
      handleColdStartResponse(chronology.coldIsCurrent, async () => {
        throw new Error("lookup failed");
      }),
    ).rejects.toThrow("lookup failed");

    expect(clearLast).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
  });

  it("clears the launch response even when the cold result is dropped or absent", async () => {
    getLast.mockResolvedValue(null);

    await handleColdStartResponse(
      () => true,
      async () => LIVE,
    );

    expect(clearLast).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
  });

  it("swallows (and logs) a failing clear so it never masks routing", async () => {
    const error = vi.spyOn(Logger, "error");
    getLast.mockResolvedValue(responseOf("default", decay));
    clearLast.mockRejectedValue(new Error("clear failed"));

    await expect(
      handleColdStartResponse(
        () => true,
        async () => LIVE,
      ),
    ).resolves.toBeUndefined();

    expect(reset).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      "notif-gate",
      "clear last notification response failed",
      expect.any(Error),
    );
    error.mockRestore();
  });
});
