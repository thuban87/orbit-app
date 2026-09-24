import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration008 } from "@/db/migrations/008-restore-photo-journal";
import {
  deleteJournalEntryCore,
  enqueueDeleteIntentCore,
  insertFinalizeEntryCore,
  insertJournalEntryCore,
  listJournalEntriesCore,
  mayDeleteCanonicalCore,
} from "@/db/restore-photo-journal-dao";
import type { SqlExecutor } from "@/db/types";

let exec: SqlExecutor;
const entry = {
  relativePath: "avatars/_restore_pending/contact-a-s.jpg",
  action: "finalize" as const,
  targetKind: "contact" as const,
  contactUid: "contact-a",
  valueUid: null,
  fieldDefUid: null,
  canonicalRelativePath: "avatars/contact-1.jpg",
  createdAt: "2026-08-25 12:00:00",
};

beforeEach(async () => {
  exec = nodeSqliteExecutor(openTestDb());
  await migration008.apply(exec, {
    now: entry.createdAt,
    newUid: () => "unused",
  });
  await exec.execAsync(
    "CREATE TABLE contacts (id INTEGER PRIMARY KEY, photo TEXT)",
  );
  await exec.execAsync(
    "CREATE TABLE profile (id INTEGER PRIMARY KEY, photo TEXT)",
  );
  await exec.execAsync(
    "CREATE TABLE custom_field_values (id INTEGER PRIMARY KEY, value TEXT)",
  );
});

describe("restore photo journal cores", () => {
  it("round-trips typed recovery evidence and deletes it by staging path", async () => {
    await insertJournalEntryCore(exec, entry);
    await expect(listJournalEntriesCore(exec)).resolves.toEqual([entry]);
    await deleteJournalEntryCore(exec, entry.relativePath);
    await expect(listJournalEntriesCore(exec)).resolves.toEqual([]);
  });
  it("deduplicates retained delete intents", async () => {
    await enqueueDeleteIntentCore(exec, entry.canonicalRelativePath);
    await enqueueDeleteIntentCore(exec, entry.canonicalRelativePath);
    expect(
      (await listJournalEntriesCore(exec)).map((row) => row.relativePath),
    ).toEqual([`delete:${entry.canonicalRelativePath}`]);
  });
  it("a later finalize retires an older row for the same canonical", async () => {
    await insertFinalizeEntryCore(exec, entry);
    await insertFinalizeEntryCore(exec, {
      ...entry,
      relativePath: "avatars/_restore_pending/contact-a-s2.jpg",
    });
    expect(
      (await listJournalEntriesCore(exec)).map((row) => row.relativePath),
    ).toEqual(["avatars/_restore_pending/contact-a-s2.jpg"]);
  });
  it.each(["contacts", "profile", "custom_field_values"])(
    "protects a %s reference",
    async (table) => {
      if (table === "custom_field_values")
        await exec.runAsync(
          "INSERT INTO custom_field_values (value) VALUES (?)",
          [entry.canonicalRelativePath],
        );
      else
        await exec.runAsync(`INSERT INTO ${table} (photo) VALUES (?)`, [
          entry.canonicalRelativePath,
        ]);
      expect(
        await mayDeleteCanonicalCore(exec, entry.canonicalRelativePath),
      ).toBe(false);
    },
  );
  it("protects a pending finalize and allows an unreferenced canonical", async () => {
    expect(
      await mayDeleteCanonicalCore(exec, entry.canonicalRelativePath),
    ).toBe(true);
    await insertFinalizeEntryCore(exec, entry);
    expect(
      await mayDeleteCanonicalCore(exec, entry.canonicalRelativePath),
    ).toBe(false);
  });
});
