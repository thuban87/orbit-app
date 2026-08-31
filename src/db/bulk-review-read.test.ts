import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  ignoreBulkReviewFlag,
  resolveBulkReviewFlag,
} from "@/db/bulk-review-dao";
import { listBulkReviewFlags } from "@/db/bulk-review-read";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  acceptImportSessionWithRows,
  setRowContactCore,
} from "@/db/import-session-dao";
import { runMigrations } from "@/db/migrations/runner";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-30 12:00:00";
let exec: SqlExecutor;
let uidCount = 0;
const newUid = () => `bulk-read-${++uidCount}`;

beforeEach(async () => {
  uidCount = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, { now: NOW, newUid });
});

async function seedContact(name: string): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, tracking_enabled, created_at, modified_at)
     VALUES (?, ?, 0, ?, ?)`,
    [newUid(), name, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function seedImportRow(
  contactId: number | null,
  birthday: string,
): Promise<number> {
  const accepted = await acceptImportSessionWithRows(exec, {
    session: {
      uid: newUid(),
      mode: "bulk",
      batchCategoryId: null,
      batchTrackingEnabled: false,
      phoneRegion: "US",
      now: NOW,
    },
    rows: [
      {
        uid: newUid(),
        externalContactId: newUid(),
        sourcePayload: JSON.stringify({
          name: "Imported",
          birthday,
          methods: [],
        }),
        photoRelPath: null,
      },
    ],
  });
  if (contactId !== null) {
    await inWriteTransaction(exec, () =>
      setRowContactCore(exec, accepted.rowIds[0], contactId, "imported", NOW),
    );
  }
  return accepted.rowIds[0];
}

describe("bulk-review-read", () => {
  it("surfaces only linked rows with an unreadable birthday", async () => {
    const aya = await seedContact("Aya");
    await seedImportRow(aya, "next Tuesday");
    await seedImportRow(await seedContact("Valid"), "03-14");
    await seedImportRow(null, "not a birthday");

    await expect(listBulkReviewFlags(exec)).resolves.toEqual([
      expect.objectContaining({
        contactId: aya,
        contactName: "Aya",
        flagType: "birthday",
        rawValue: "next Tuesday",
      }),
    ]);
  });

  it("omits fixed and ignored rows after a durable resolution is written", async () => {
    const fixedContact = await seedContact("Fixed");
    const ignoredContact = await seedContact("Ignored");
    const fixedRow = await seedImportRow(fixedContact, "tomorrow");
    const ignoredRow = await seedImportRow(ignoredContact, "later");

    await resolveBulkReviewFlag(exec, {
      importSessionRowId: fixedRow,
      contactId: fixedContact,
      birthday: "2000-03-14",
      now: NOW,
    });
    await ignoreBulkReviewFlag(exec, {
      importSessionRowId: ignoredRow,
      now: NOW,
    });

    await expect(listBulkReviewFlags(exec)).resolves.toEqual([]);
  });
});
