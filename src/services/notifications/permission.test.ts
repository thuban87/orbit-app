import {
  getPermissionsAsync,
  requestPermissionsAsync,
} from "expo-notifications";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getNotificationPermission,
  requestNotificationPermission,
} from "./permission";

vi.mock("expo-notifications");

const getPerms = vi.mocked(getPermissionsAsync);
const requestPerms = vi.mocked(requestPermissionsAsync);

afterEach(() => {
  vi.clearAllMocks();
});

describe("getNotificationPermission — fresh status read (never cached)", () => {
  it("reads via getPermissionsAsync and maps a granted result", async () => {
    getPerms.mockResolvedValueOnce({
      status: "granted",
      granted: true,
      canAskAgain: true,
      // biome-ignore lint/suspicious/noExplicitAny: partial OS result is enough
    } as any);

    const result = await getNotificationPermission();

    expect(getPerms).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ granted: true, status: "granted" });
  });

  it("maps a denied result to granted:false", async () => {
    getPerms.mockResolvedValueOnce({
      status: "denied",
      granted: false,
      canAskAgain: false,
      // biome-ignore lint/suspicious/noExplicitAny: partial OS result is enough
    } as any);

    const result = await getNotificationPermission();

    expect(result).toEqual({ granted: false, status: "denied" });
  });

  it("resolves to granted:false when the OS call rejects (never throws)", async () => {
    getPerms.mockRejectedValueOnce(new Error("OS blew up"));

    await expect(getNotificationPermission()).resolves.toEqual({
      granted: false,
      status: "denied",
    });
  });
});

describe("requestNotificationPermission — value-moment request, no re-nag", () => {
  it("requests via requestPermissionsAsync and maps a granted result", async () => {
    requestPerms.mockResolvedValueOnce({
      status: "granted",
      granted: true,
      canAskAgain: true,
      // biome-ignore lint/suspicious/noExplicitAny: partial OS result is enough
    } as any);

    const result = await requestNotificationPermission();

    expect(requestPerms).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ granted: true, status: "granted" });
  });

  it("does not loop or re-prompt on denial — a single request call", async () => {
    requestPerms.mockResolvedValueOnce({
      status: "denied",
      granted: false,
      canAskAgain: false,
      // biome-ignore lint/suspicious/noExplicitAny: partial OS result is enough
    } as any);

    const result = await requestNotificationPermission();

    expect(requestPerms).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ granted: false, status: "denied" });
  });

  it("resolves to granted:false when the OS call rejects (graceful degrade)", async () => {
    requestPerms.mockRejectedValueOnce(new Error("OS blew up"));

    await expect(requestNotificationPermission()).resolves.toEqual({
      granted: false,
      status: "denied",
    });
  });
});
