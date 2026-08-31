import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SqlExecutor } from "@/db/types";

const mocks = vi.hoisted(() => ({
  createPendingAssist: vi.fn(),
  markAssistFailed: vi.fn(),
  sendSMSAsync: vi.fn(),
  openURL: vi.fn(),
  alert: vi.fn(),
}));

vi.mock("expo-sms", () => ({ sendSMSAsync: mocks.sendSMSAsync }));
vi.mock("react-native", () => ({
  Alert: { alert: mocks.alert },
  Linking: { openURL: mocks.openURL },
}));
vi.mock("@/db/interaction-assist-dao", () => ({
  createPendingAssist: mocks.createPendingAssist,
  markAssistFailed: mocks.markAssistFailed,
}));

import { performReachOut } from "@/services/reach-out/handoff";

const exec = {} as SqlExecutor;
const input = {
  contactId: 42,
  endpoint: "+15551234567",
  assistEnabled: true,
  now: "2026-08-31 12:00:00",
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createPendingAssist.mockResolvedValue("assist-1");
  mocks.markAssistFailed.mockResolvedValue(undefined);
  mocks.sendSMSAsync.mockResolvedValue({ result: "unknown" });
  mocks.openURL.mockResolvedValue(true);
});

describe("performReachOut", () => {
  it("writes the assist before opening SMS and passes the optional message body", async () => {
    const events: string[] = [];
    mocks.createPendingAssist.mockImplementation(async () => {
      events.push("create");
      return "assist-1";
    });
    mocks.sendSMSAsync.mockImplementation(async () => {
      events.push("launch");
      return { result: "unknown" };
    });

    await performReachOut(exec, {
      ...input,
      channel: "text",
      messageBody: "Thinking of you",
    });

    expect(events).toEqual(["create", "launch"]);
    expect(mocks.sendSMSAsync).toHaveBeenCalledWith(
      input.endpoint,
      "Thinking of you",
    );
    expect(mocks.markAssistFailed).not.toHaveBeenCalled();
    expect(mocks.alert).not.toHaveBeenCalled();
  });

  it("writes the assist before opening a call URL", async () => {
    const events: string[] = [];
    mocks.createPendingAssist.mockImplementation(async () => {
      events.push("create");
      return "assist-1";
    });
    mocks.openURL.mockImplementation(async () => {
      events.push("launch");
      return true;
    });

    await performReachOut(exec, { ...input, channel: "call" });

    expect(events).toEqual(["create", "launch"]);
    expect(mocks.openURL).toHaveBeenCalledWith(`tel:${input.endpoint}`);
  });

  it("marks only a thrown native launch as failed", async () => {
    mocks.openURL.mockRejectedValueOnce(new Error("no mail client"));

    await performReachOut(exec, { ...input, channel: "email" });

    expect(mocks.markAssistFailed).toHaveBeenCalledWith(exec, {
      assistUid: "assist-1",
      now: input.now,
    });
    expect(mocks.alert).toHaveBeenCalledWith(
      "Couldn't open your email app",
      "No app on this device can send email.",
    );
  });

  it("launches without creating or failing an assist when assist is disabled", async () => {
    await performReachOut(exec, {
      ...input,
      channel: "text",
      assistEnabled: false,
    });

    expect(mocks.createPendingAssist).not.toHaveBeenCalled();
    expect(mocks.markAssistFailed).not.toHaveBeenCalled();
    expect(mocks.sendSMSAsync).toHaveBeenCalledWith(input.endpoint, "");
  });
});
