import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import {
  createPersonalizationSection,
  deletePersonalizationSection,
  getWritingStyle,
  importPersonalizationSection,
  listPersonalizationSections,
  renamePersonalizationSection,
  reorderPersonalizationSections,
  replacePersonalizationSectionFromImport,
  setPersonalizationSectionEnabled,
  updatePersonalizationSectionBody,
  updateWritingStyle,
} from "@/db/personalization-dao";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-14T08:00:00.000Z";
const LATER = "2026-09-14T09:00:00.000Z";

let db: ReturnType<typeof openTestDb>;
let exec: SqlExecutor;

beforeEach(async () => {
  db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => crypto.randomUUID(),
  });
});

afterEach(() => db.close());

describe("personalization-dao — Writing Style", () => {
  it("reads defaults and round-trips every custom opt-out", async () => {
    expect(await getWritingStyle(exec)).toEqual({
      tone: "balanced",
      length: "normal",
      directness: "balanced",
      freeform: "",
    });

    await updateWritingStyle(
      exec,
      {
        tone: "custom",
        length: "custom",
        directness: "custom",
        freeform: "Use short sentences and my usual sign-off.",
      },
      LATER,
    );

    expect(await getWritingStyle(exec)).toEqual({
      tone: "custom",
      length: "custom",
      directness: "custom",
      freeform: "Use short sentences and my usual sign-off.",
    });
  });
});

describe("personalization-dao — ordered local sections", () => {
  it("creates, edits, toggles, deterministically reorders, and deletes sections", async () => {
    const first = await createPersonalizationSection(exec, {
      title: "Voice",
      body: "Warm and specific.",
      now: NOW,
    });
    const second = await createPersonalizationSection(exec, {
      title: "Background",
      body: "Prefer low-pressure invitations.",
      now: NOW,
    });
    const third = await createPersonalizationSection(exec, {
      title: "Sign-off",
      body: "End with my name.",
      now: NOW,
    });

    await renamePersonalizationSection(exec, second.uid, "Preferences", LATER);
    await updatePersonalizationSectionBody(
      exec,
      first.uid,
      "Warm, specific, and unforced.",
      LATER,
    );
    await setPersonalizationSectionEnabled(exec, third.uid, false, LATER);
    await reorderPersonalizationSections(
      exec,
      [third.uid, first.uid, second.uid],
      LATER,
    );

    expect(await listPersonalizationSections(exec)).toMatchObject([
      { uid: third.uid, displayOrder: 0, enabled: false },
      {
        uid: first.uid,
        displayOrder: 1,
        body: "Warm, specific, and unforced.",
      },
      { uid: second.uid, displayOrder: 2, title: "Preferences" },
    ]);

    await deletePersonalizationSection(exec, first.uid);
    expect(
      (await listPersonalizationSections(exec)).map((row) => row.uid),
    ).toEqual([third.uid, second.uid]);
  });

  it("rejects incomplete, duplicate, or unknown reorder inventories", async () => {
    const first = await createPersonalizationSection(exec, {
      title: "One",
      body: "First",
      now: NOW,
    });
    const second = await createPersonalizationSection(exec, {
      title: "Two",
      body: "Second",
      now: NOW,
    });

    await expect(
      reorderPersonalizationSections(exec, [first.uid], LATER),
    ).rejects.toThrow(/complete section inventory/i);
    await expect(
      reorderPersonalizationSections(exec, [first.uid, first.uid], LATER),
    ).rejects.toThrow(/duplicate/i);
    await expect(
      reorderPersonalizationSections(exec, [first.uid, "missing"], LATER),
    ).rejects.toThrow(/unknown/i);

    expect(
      (await listPersonalizationSections(exec)).map((row) => row.uid),
    ).toEqual([first.uid, second.uid]);
  });

  it("copies imported text into editable records without retaining a source reference", async () => {
    const imported = await importPersonalizationSection(exec, {
      title: "Imported voice",
      text: "Copied from a temporary file.",
      now: NOW,
    });
    expect(imported).toMatchObject({
      title: "Imported voice",
      body: "Copied from a temporary file.",
      enabled: true,
    });
    expect(Object.keys(imported)).not.toContain("uri");
    expect(Object.keys(imported)).not.toContain("path");

    await replacePersonalizationSectionFromImport(
      exec,
      imported.uid,
      "A detached replacement copy.",
      LATER,
    );
    await updatePersonalizationSectionBody(
      exec,
      imported.uid,
      "Still editable after import.",
      LATER,
    );

    expect(await listPersonalizationSections(exec)).toMatchObject([
      { uid: imported.uid, body: "Still editable after import." },
    ]);
  });

  it("rolls back a mutation when its row-count invariant fails", async () => {
    await expect(
      renamePersonalizationSection(exec, "missing", "Nope", LATER),
    ).rejects.toThrow(/expected one changed row/i);
    await expect(deletePersonalizationSection(exec, "missing")).rejects.toThrow(
      /expected one changed row/i,
    );
  });
});
