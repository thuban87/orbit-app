import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration008 } from "@/db/migrations/008-restore-photo-journal";
import { deleteJournalEntryCore, insertJournalEntryCore, listJournalEntriesCore } from "@/db/restore-photo-journal-dao";
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
  await migration008.apply(exec, { now: entry.createdAt, newUid: () => "unused" });
});

describe("restore photo journal cores", () => {
  it("round-trips typed recovery evidence and deletes it by staging path", async () => {
    await insertJournalEntryCore(exec, entry);
    await expect(listJournalEntriesCore(exec)).resolves.toEqual([entry]);
    await deleteJournalEntryCore(exec, entry.relativePath);
    await expect(listJournalEntriesCore(exec)).resolves.toEqual([]);
  });
});
