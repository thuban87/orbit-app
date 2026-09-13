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

    const outcome = await performReachOut(exec, {
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
    // HIGH-1: the created assist UID is EXPOSED so the Compose confirmation panel
    // can log THIS assist rather than re-querying the table by contact+timestamp.
    expect(outcome).toEqual({ handoffStarted: true, assistUid: "assist-1" });
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

    const outcome = await performReachOut(exec, { ...input, channel: "call" });

    expect(events).toEqual(["create", "launch"]);
    expect(mocks.openURL).toHaveBeenCalledWith(`tel:${input.endpoint}`);
    expect(outcome).toEqual({ handoffStarted: true, assistUid: "assist-1" });
  });

  it("marks only a thrown native launch as failed and reports handoffStarted false", async () => {
    mocks.openURL.mockRejectedValueOnce(new Error("no mail client"));

    const outcome = await performReachOut(exec, { ...input, channel: "email" });

    expect(mocks.markAssistFailed).toHaveBeenCalledWith(exec, {
      assistUid: "assist-1",
      now: input.now,
    });
    expect(mocks.alert).toHaveBeenCalledWith(
      "Couldn't open your email app",
      "No app on this device can send email.",
    );
    // A failed native launch never surfaces the confirmation panel — the panel
    // gates on handoffStarted (T-35-21). assistUid is null so no fragile re-query.
    expect(outcome).toEqual({ handoffStarted: false, assistUid: null });
  });

  it("email arm carries the encoded subject + body via a mailto query string and returns the structured outcome (COMP-04, T-35-04)", async () => {
    const events: string[] = [];
    mocks.createPendingAssist.mockImplementation(async () => {
      events.push("create");
      return "assist-1";
    });
    mocks.openURL.mockImplementation(async () => {
      events.push("launch");
      return true;
    });

    const outcome = await performReachOut(exec, {
      ...input,
      channel: "email",
      endpoint: "person@example.com",
      subject: "Hi & bye",
      messageBody: "line1\nline2",
    });

    // The assist row is stamped BEFORE the OS handoff.
    expect(events).toEqual(["create", "launch"]);
    // Subject and body are encodeURIComponent-escaped so `&`, newlines, etc.
    // cannot break out of / inject into the query string (T-35-04).
    expect(mocks.openURL).toHaveBeenCalledWith(
      "mailto:person@example.com?subject=Hi%20%26%20bye&body=line1%0Aline2",
    );
    expect(mocks.markAssistFailed).not.toHaveBeenCalled();
    expect(mocks.alert).not.toHaveBeenCalled();
    // The plan-35-01 return contract is preserved on the email arm.
    expect(outcome).toEqual({ handoffStarted: true, assistUid: "assist-1" });
  });

  it("email arm omits empty query params — a bare recipient stays mailto:<endpoint>", async () => {
    await performReachOut(exec, {
      ...input,
      channel: "email",
      endpoint: "person@example.com",
    });

    expect(mocks.openURL).toHaveBeenCalledWith("mailto:person@example.com");
  });

  it("email arm carries a subject with no body (body param omitted)", async () => {
    await performReachOut(exec, {
      ...input,
      channel: "email",
      endpoint: "person@example.com",
      subject: "Just the subject",
    });

    expect(mocks.openURL).toHaveBeenCalledWith(
      "mailto:person@example.com?subject=Just%20the%20subject",
    );
  });

  it("launches without creating or failing an assist when assist is disabled", async () => {
    const outcome = await performReachOut(exec, {
      ...input,
      channel: "text",
      assistEnabled: false,
    });

    expect(mocks.createPendingAssist).not.toHaveBeenCalled();
    expect(mocks.markAssistFailed).not.toHaveBeenCalled();
    expect(mocks.sendSMSAsync).toHaveBeenCalledWith(input.endpoint, "");
    // Assists opted out: handoff still started, but there is no UID to log, so
    // the Compose confirmation panel does not appear.
    expect(outcome).toEqual({ handoffStarted: true, assistUid: null });
  });
});
