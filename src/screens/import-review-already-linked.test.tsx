import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 38.12 D-53: a single pick that is already linked to an Orbit person loads
 * straight into "Already in Orbit as <name>" with Open and Done: no editable
 * form, and the row is resolved and the session finalized during that load,
 * so no paused import is left behind.
 */

vi.mock("expo-sqlite", () => ({}));
vi.mock("react-native", () => ({
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
}));
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));
vi.mock("@/components/ui/Button", () => ({ Button: "Button" }));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { acceptImportSessionWithRows } from "@/db/import-session-dao";
import { getSessionById, listSessionRows } from "@/db/import-session-read";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import {
  ImportReviewAlreadyLinked,
  resolveAlreadyLinkedReview,
} from "./ImportReviewAlreadyLinked";

const NOW = "2026-10-17 12:00:00";
let exec: SqlExecutor;
let counter = 0;
const uid = () => `already-linked-${++counter}`;

beforeEach(async () => {
  counter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
    defaultPhoneRegion: "US",
  });
});

async function seedLinkedContact(externalContactId: string): Promise<number> {
  const result = await exec.runAsync(
    "INSERT INTO contacts(uid,name,interval_days,created_at,modified_at) VALUES(?,?,30,?,?)",
    [uid(), "Ada Lovelace", NOW, NOW],
  );
  const contactId = Number(result.lastInsertRowId);
  await exec.runAsync(
    "INSERT INTO external_contact_links (uid, contact_id, provider, external_contact_id, is_active, created_at, modified_at) VALUES (?, ?, 'android', ?, 1, ?, ?)",
    [uid(), contactId, externalContactId, NOW, NOW],
  );
  return contactId;
}

async function singleSession(externalContactId: string) {
  const { sessionId, rowIds } = await acceptImportSessionWithRows(exec, {
    session: {
      uid: uid(),
      mode: "single",
      batchCategoryId: null,
      batchTrackingEnabled: false,
      phoneRegion: "US",
      now: NOW,
    },
    rows: [
      {
        uid: uid(),
        externalContactId,
        sourcePayload: JSON.stringify({
          displayName: "Ada on the phone",
          methods: [],
          birthday: null,
        }),
        photoRelPath: null,
      },
    ],
  });
  return { sessionId, rowId: rowIds[0] };
}

describe("resolveAlreadyLinkedReview (D-53)", () => {
  it("resolves an already-linked row and finalizes the session at load", async () => {
    const contactId = await seedLinkedContact("ext-ada");
    const { sessionId, rowId } = await singleSession("ext-ada");

    const result = await resolveAlreadyLinkedReview(exec, {
      sessionId,
      rowId,
      externalContactId: "ext-ada",
      now: NOW,
    });

    expect(result).toEqual({ contactId, name: "Ada Lovelace", inBin: false });
    expect(await listSessionRows(exec, sessionId)).toEqual([
      expect.objectContaining({
        id: rowId,
        rowStatus: "skipped",
        matchOutcome: "already_linked",
      }),
    ]);
    // No paused import is left behind.
    expect(await getSessionById(exec, sessionId)).toEqual(
      expect.objectContaining({ status: "complete" }),
    );
  });

  it("leaves a not-yet-linked pick pending for the editable review", async () => {
    await seedLinkedContact("someone-else");
    const { sessionId, rowId } = await singleSession("ext-new");

    await expect(
      resolveAlreadyLinkedReview(exec, {
        sessionId,
        rowId,
        externalContactId: "ext-new",
        now: NOW,
      }),
    ).resolves.toBeNull();
    expect(await listSessionRows(exec, sessionId)).toEqual([
      expect.objectContaining({ rowStatus: "pending" }),
    ]);
    expect(await getSessionById(exec, sessionId)).toEqual(
      expect.objectContaining({ status: "pending" }),
    );
  });

  it("ignores an inactive link", async () => {
    const contactId = await seedLinkedContact("ext-old");
    await exec.runAsync(
      "UPDATE external_contact_links SET is_active = 0 WHERE contact_id = ?",
      [contactId],
    );
    const { sessionId, rowId } = await singleSession("ext-old");
    await expect(
      resolveAlreadyLinkedReview(exec, {
        sessionId,
        rowId,
        externalContactId: "ext-old",
        now: NOW,
      }),
    ).resolves.toBeNull();
  });
});

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

describe("ImportReviewAlreadyLinked view (D-53)", () => {
  it("shows the Orbit name with Open and Done and no editable fields", () => {
    const onOpen = vi.fn();
    const onDone = vi.fn();
    const tree = nodes(
      ImportReviewAlreadyLinked({ name: "Ada Lovelace", onOpen, onDone }),
    );
    const message = tree.find(
      (n) => n.props.testID === "import-review-already-linked-message",
    );
    expect(message?.props.children).toBe("Already in Orbit as Ada Lovelace");
    const buttons = tree.filter((n) => n.type === "Button");
    expect(buttons.map((b) => b.props.label)).toEqual(["Open", "Done"]);
    (buttons[0].props.onPress as () => void)();
    expect(onOpen).toHaveBeenCalledOnce();
    (buttons[1].props.onPress as () => void)();
    expect(onDone).toHaveBeenCalledOnce();
    // Header Back acts like Done.
    const header = tree.find((n) => n.type === "ShellAppBar");
    expect(header?.props.variant).toBe("child");
    expect(header?.props.onBack).toBe(onDone);
    expect(
      tree.some(
        (n) =>
          n.type === "TextInput" ||
          (typeof n.type === "string" && /Input|Editor|Picker/.test(n.type)),
      ),
    ).toBe(false);
  });
});

describe("a pick linked only to a person in the Bin (38.12 D-154)", () => {
  it("resolves the row as In the Bin and finalizes the session", async () => {
    const contactId = await seedLinkedContact("ext-binned");
    await exec.runAsync("UPDATE contacts SET archived_at = ? WHERE id = ?", [
      NOW,
      contactId,
    ]);
    const { sessionId, rowId } = await singleSession("ext-binned");
    const result = await resolveAlreadyLinkedReview(exec, {
      sessionId,
      rowId,
      externalContactId: "ext-binned",
      now: NOW,
    });
    expect(result).toEqual({ contactId, name: "Ada Lovelace", inBin: true });
    expect(await listSessionRows(exec, sessionId)).toEqual([
      expect.objectContaining({
        rowStatus: "skipped",
        matchOutcome: "already_linked",
        failureReason: "in-bin",
      }),
    ]);
    expect(await getSessionById(exec, sessionId)).toEqual(
      expect.objectContaining({ status: "complete" }),
    );
  });

  it("shows In the Bin: <name> with Open the Bin and Done, never Restore (D-155, ADR-018)", () => {
    const onOpenBin = vi.fn();
    const onOpen = vi.fn();
    const onDone = vi.fn();
    const tree = nodes(
      ImportReviewAlreadyLinked({
        name: "Ada Lovelace",
        inBin: true,
        onOpen,
        onOpenBin,
        onDone,
      }),
    );
    const message = tree.find(
      (n) => n.props.testID === "import-review-already-linked-message",
    );
    expect(message?.props.children).toBe("In the Bin: Ada Lovelace");
    const buttons = tree.filter((n) => n.type === "Button");
    expect(buttons.map((b) => b.props.label)).toEqual(["Open the Bin", "Done"]);
    (buttons[0].props.onPress as () => void)();
    expect(onOpenBin).toHaveBeenCalledOnce();
    expect(onOpen).not.toHaveBeenCalled();
    (buttons[1].props.onPress as () => void)();
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("the review wires Open the Bin to the flow host's Bin opener; no Restore path outside the Bin list", () => {
    const screen = readFileSync(
      join(__dirname, "ImportReviewScreen.tsx"),
      "utf8",
    );
    expect(screen).toMatch(
      /onOpenBin=\{\(\) => openBinFromFlow\(navigation, host\)\}/,
    );
    expect(screen).not.toMatch(/restoreFromBin|restoreContact\b|onRestore/);
  });
});

describe("ImportReviewScreen wiring (D-53)", () => {
  const screen = readFileSync(
    join(__dirname, "ImportReviewScreen.tsx"),
    "utf8",
  );

  it("decides already-linked during the review's load, before the form state is filled", () => {
    const load = screen.slice(
      screen.indexOf("const load = useCallback"),
      screen.indexOf("useEffect(() => {\n    void load();"),
    );
    const resolveAt = load.indexOf("resolveAlreadyLinkedReview(");
    expect(resolveAt).toBeGreaterThan(-1);
    expect(resolveAt).toBeLessThan(load.indexOf("setName("));
    expect(load).toContain("markImportComplete()");
  });

  it("renders the already-linked view instead of the editable form", () => {
    const early = screen.indexOf("<ImportReviewAlreadyLinked");
    expect(early).toBeGreaterThan(-1);
    expect(early).toBeLessThan(screen.indexOf("<TextInput"));
    expect(screen).toMatch(
      /openContactFromFlow\(\s*navigation,\s*host,\s*alreadyLinked\.contactId,?\s*\)/,
    );
    expect(screen).toContain("useBackActsAsDone(");
  });

  it("keeps onImport's own already_linked branch as a race fallback", () => {
    expect(screen).toContain('result.outcome === "already_linked"');
  });
});
