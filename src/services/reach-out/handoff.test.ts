import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SqlExecutor } from "@/db/types";

const mocks = vi.hoisted(() => ({
  createPendingAssist: vi.fn(),
  markAssistFailed: vi.fn(),
  sendSMSAsync: vi.fn(),
  openURL: vi.fn(),
  showSnackbar: vi.fn(),
}));

vi.mock("expo-sms", () => ({ sendSMSAsync: mocks.sendSMSAsync }));
vi.mock("react-native", () => ({
  Linking: { openURL: mocks.openURL },
}));
vi.mock("@/stores/snackbar-store", () => ({
  showSnackbar: mocks.showSnackbar,
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
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
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
    // 38.9 D-27: the one-button native error is now an error snackbar with the
    // same words; it renders above the reach-out router window (D-40).
    expect(mocks.showSnackbar).toHaveBeenCalledTimes(1);
    expect(mocks.showSnackbar).toHaveBeenCalledWith({
      kind: "error",
      label:
        "Couldn't open your email app. No app on this device can send email.",
    });
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
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
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

  it("email arm neutralizes a query-injecting recipient so it cannot override the Subject (WR-01)", async () => {
    // EMAIL_RE admits `?`/`&`/`#` in the local part, so an imported address like
    // this would otherwise inject `subject=x` and win over the composed Subject.
    await performReachOut(exec, {
      ...input,
      channel: "email",
      endpoint: "bob?subject=x@example.com",
      subject: "Real subject",
    });

    // The recipient's `?`/`=` are percent-encoded; the single `@` is preserved,
    // so the composed `subject=Real%20subject` is the only query param.
    expect(mocks.openURL).toHaveBeenCalledWith(
      "mailto:bob%3Fsubject%3Dx@example.com?subject=Real%20subject",
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

/**
 * 38.9-05 D-27 (this plan only; Plan 06 adds the app-wide no-native-Alert
 * contract): none of the everyday-surface production files converted in plan
 * 38.9-05 still reaches React Native's Alert API. Parsed with the TypeScript
 * compiler so comments and strings never count; any `Alert` identifier (named
 * import, destructure of a dynamic `import("react-native")`, `Alert.alert`)
 * is a hit.
 */
const PLAN_05_FILES = [
  "src/screens/OffLimitsEditorScreen.tsx",
  "src/screens/ContactProfileScreen.tsx",
  "src/screens/EditContactScreen.tsx",
  "src/screens/EditInteractionScreen.tsx",
  "src/components/MergeImpactSummary.tsx",
  "src/components/profile/ProfileLayoutEditor.tsx",
  "src/components/profile/ProfileTemplateManager.tsx",
  "src/components/profile/ProfileBackgroundManager.tsx",
  "src/screens/CropPhotoScreen.tsx",
  "src/components/LinksEditor.tsx",
  "src/screens/CaptureScreen.tsx",
  "src/screens/ComposeScreen.tsx",
  "src/components/AssistBanner.tsx",
  "src/components/PendingConfirmationsSheet.tsx",
  "src/services/reach-out/handoff.ts",
  "src/services/contacts/use-read-contacts-permission.ts",
  "src/navigation/widget-linking.ts",
] as const;

function alertIdentifierLines(file: string): number[] {
  const text = readFileSync(join(__dirname, "..", "..", "..", file), "utf8");
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.ES2022,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const lines: number[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && node.text === "Alert") {
      lines.push(
        source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return lines;
}

describe("38.9-05 everyday surfaces use no native Alert (D-27)", () => {
  it("covers the 17 production files of the plan", () => {
    expect(PLAN_05_FILES).toHaveLength(17);
  });

  it.each(PLAN_05_FILES)("%s has no Alert identifier", (file) => {
    expect(alertIdentifierLines(file)).toEqual([]);
  });
});
