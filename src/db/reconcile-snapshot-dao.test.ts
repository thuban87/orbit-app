import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { migration007 } from "@/db/migrations/007-tombstones";
import { migration008 } from "@/db/migrations/008-restore-photo-journal";
import { migration009 } from "@/db/migrations/009-contact-method-normalization";
import { migration010 } from "@/db/migrations/010-contact-method-label";
import { migration011 } from "@/db/migrations/011-contact-lifecycle-schema";
import { migration012 } from "@/db/migrations/012-import-sessions";
import { migration013 } from "@/db/migrations/013-reconciliation-and-merge";
import { runMigrations } from "@/db/migrations/runner";
import {
  getReviewedSnapshots,
  recordImportedPhotoFingerprint,
  reviewedValueFor,
  upsertReviewedSnapshot,
  upsertReviewedSnapshotCore,
} from "@/db/reconcile-snapshot-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-30 12:00:00";
const migrations = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008,
  migration009,
  migration010,
  migration011,
  migration012,
  migration013,
];
let exec: SqlExecutor;
let count = 0;
const uid = () => `snapshot-${++count}`;

beforeEach(async () => {
  count = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, migrations, 13, { now: NOW, newUid: uid });
  const contact = await exec.runAsync(
    "INSERT INTO contacts (uid, name, tracking_enabled, created_at, modified_at) VALUES (?, 'Orbit', 0, ?, ?)",
    [uid(), NOW, NOW],
  );
  await exec.runAsync(
    "INSERT INTO external_contact_links (uid, contact_id, provider, external_contact_id, created_at, modified_at) VALUES (?, ?, 'android', 'source', ?, ?)",
    [uid(), contact.lastInsertRowId, NOW, NOW],
  );
});

async function linkId(): Promise<number> {
  return (await exec.getFirstAsync<{ id: number }>(
    "SELECT id FROM external_contact_links",
  ))!.id;
}

describe("reconcile source snapshots", () => {
  it("upserts one row per external-link and field-family pair and returns a classifier map", async () => {
    const externalContactLinkId = await linkId();
    await upsertReviewedSnapshot(exec, {
      externalContactLinkId,
      fieldFamily: "name",
      reviewedValue: "First",
      reviewedAt: NOW,
    });
    await upsertReviewedSnapshot(exec, {
      externalContactLinkId,
      fieldFamily: "name",
      reviewedValue: "Second",
      reviewedAt: "2026-08-30 13:00:00",
    });
    expect(await getReviewedSnapshots(exec, externalContactLinkId)).toEqual({
      name: "Second",
    });
    expect(
      await exec.getFirstAsync<{ count: number }>(
        "SELECT count(*) AS count FROM reconcile_source_snapshot",
      ),
    ).toEqual({ count: 1 });
  });

  it("allows a core upsert to compose inside the owner transaction", async () => {
    const externalContactLinkId = await linkId();
    await inWriteTransaction(exec, () =>
      upsertReviewedSnapshotCore(exec, {
        externalContactLinkId,
        fieldFamily: "birthday",
        reviewedValue: "2000-01-02",
        reviewedAt: NOW,
      }),
    );
    expect(await getReviewedSnapshots(exec, externalContactLinkId)).toEqual({
      birthday: "2000-01-02",
    });
  });

  it("serializes multi-method families identically across order and differently for source changes", () => {
    const methods = [
      { type: "phone" as const, value: "(312) 555-1234", label: "Mobile" },
      { type: "phone" as const, value: "312-555-9999", label: "Work" },
    ];
    const reviewed = reviewedValueFor("phones", methods);
    expect(reviewedValueFor("phones", [...methods].reverse())).toBe(reviewed);
    expect(
      reviewedValueFor("phones", [
        ...methods,
        { type: "phone", value: "312-555-0000", label: null },
      ]),
    ).not.toBe(reviewed);
    expect(reviewedValueFor("phones", methods.slice(1))).not.toBe(reviewed);
    expect(
      reviewedValueFor("phones", [
        { ...methods[0], label: "Home" },
        methods[1],
      ]),
    ).not.toBe(reviewed);
  });
});

describe("recordImportedPhotoFingerprint (D-132)", () => {
  const FINGERPRINT =
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

  async function contactId(): Promise<number> {
    return (await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM contacts",
    ))!.id;
  }

  async function insertRow(
    sourcePayload: string,
    externalContactId = "source",
  ): Promise<number> {
    const session = await exec.runAsync(
      "INSERT INTO import_sessions (uid, mode, status, batch_tracking_enabled, total_rows, created_at, modified_at) VALUES (?, 'single', 'pending', 0, 1, ?, ?)",
      [uid(), NOW, NOW],
    );
    const row = await exec.runAsync(
      "INSERT INTO import_session_rows (uid, session_id, external_contact_id, source_payload, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?)",
      [
        uid(),
        session.lastInsertRowId,
        externalContactId,
        sourcePayload,
        NOW,
        NOW,
      ],
    );
    return row.lastInsertRowId;
  }

  async function snapshotCount(): Promise<number> {
    return (await exec.getFirstAsync<{ count: number }>(
      "SELECT count(*) AS count FROM reconcile_source_snapshot",
    ))!.count;
  }

  it("writes a 'photo' reviewed row for the active link equal to the bridge fingerprint", async () => {
    const rowId = await insertRow(
      JSON.stringify({ displayName: "Orbit", photoFingerprint: FINGERPRINT }),
    );
    await recordImportedPhotoFingerprint(exec, {
      rowId,
      contactId: await contactId(),
      now: NOW,
    });
    expect(await getReviewedSnapshots(exec, await linkId())).toEqual({
      photo: FINGERPRINT,
    });
  });

  it("is a no-op for a missing fingerprint, a non-string fingerprint or bad JSON", async () => {
    const id = await contactId();
    for (const payload of [
      JSON.stringify({ displayName: "Orbit" }),
      JSON.stringify({ photoFingerprint: null }),
      JSON.stringify({ photoFingerprint: 42 }),
      JSON.stringify({ photoFingerprint: "" }),
      "not json",
      "null",
    ]) {
      const rowId = await insertRow(payload);
      await expect(
        recordImportedPhotoFingerprint(exec, {
          rowId,
          contactId: id,
          now: NOW,
        }),
      ).resolves.toBeUndefined();
    }
    expect(await snapshotCount()).toBe(0);
  });

  it("is a no-op when there is no active link or no import row", async () => {
    const id = await contactId();
    const otherSource = await insertRow(
      JSON.stringify({ photoFingerprint: FINGERPRINT }),
      "other-source",
    );
    await recordImportedPhotoFingerprint(exec, {
      rowId: otherSource,
      contactId: id,
      now: NOW,
    });
    const inactive = await insertRow(
      JSON.stringify({ photoFingerprint: FINGERPRINT }),
    );
    await exec.runAsync("UPDATE external_contact_links SET is_active = 0");
    await recordImportedPhotoFingerprint(exec, {
      rowId: inactive,
      contactId: id,
      now: NOW,
    });
    await recordImportedPhotoFingerprint(exec, {
      rowId: 9999,
      contactId: id,
      now: NOW,
    });
    expect(await snapshotCount()).toBe(0);
  });
});
