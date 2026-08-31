import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { applyReconcileSelections } from "@/db/reconcile-apply";
import { readDataRevision } from "@/db/data-revision-dao";
import { getReviewedSnapshots } from "@/db/reconcile-snapshot-dao";
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
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-30 12:00:00";
const migrations = [migration001, migration002, migration003, migration004, migration005, migration006, migration007, migration008, migration009, migration010, migration011, migration012, migration013];
let exec: SqlExecutor;
let count = 0;
const uid = () => `apply-${++count}`;
let contactId: number;
let externalContactLinkId: number;

beforeEach(async () => {
  count = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, migrations, 13, { now: NOW, newUid: uid });
  contactId = (await exec.runAsync("INSERT INTO contacts (uid, name, tracking_enabled, birthday, created_at, modified_at) VALUES (?, 'Orbit Original', 0, '2000-01-01', ?, ?)", [uid(), NOW, NOW])).lastInsertRowId;
  externalContactLinkId = (await exec.runAsync("INSERT INTO external_contact_links (uid, contact_id, provider, external_contact_id, created_at, modified_at) VALUES (?, ?, 'android', 'source', ?, ?)", [uid(), contactId, NOW, NOW])).lastInsertRowId;
});

function nameSelection(baseline = "Orbit Original") {
  return { fieldFamily: "name" as const, baseline, useSource: true, sourceValue: "Source Changed", sourceLinkIds: [externalContactLinkId], reviewedValue: "Source Changed" };
}

describe("applyReconcileSelections", () => {
  it("bumps data_revision for scalar-only writes and snapshots prior Orbit values", async () => {
    const before = await readDataRevision(exec);
    await inWriteTransaction(exec, () => applyReconcileSelections(exec, { contactId, now: NOW, selections: [nameSelection()] }));
    expect(await readDataRevision(exec)).toBe(before + 1);
    expect(await exec.getFirstAsync<{ name: string }>("SELECT name FROM contacts WHERE id = ?", [contactId])).toEqual({ name: "Source Changed" });
    expect(await exec.getFirstAsync<{ old_value: string }>("SELECT old_value FROM field_history WHERE contact_id = ?", [contactId])).toEqual({ old_value: "Orbit Original" });
  });

  it("preserves a post-scan Orbit edit, reports staleFields, and does not bump the revision", async () => {
    await exec.runAsync("UPDATE contacts SET name = 'User Edited Later' WHERE id = ?", [contactId]);
    const before = await readDataRevision(exec);
    const result = await inWriteTransaction(exec, () => applyReconcileSelections(exec, { contactId, now: NOW, selections: [nameSelection()] }));
    expect(result.staleFields).toEqual(["name"]);
    expect(await readDataRevision(exec)).toBe(before);
    expect(await exec.getFirstAsync<{ name: string }>("SELECT name FROM contacts WHERE id = ?", [contactId])).toEqual({ name: "User Edited Later" });
  });

  it("defers the photo reviewed snapshot until a successful post-commit photo apply", async () => {
    const photo = { fieldFamily: "photo" as const, baseline: null, useSource: true, sourceValue: "photo-hash", sourceLinkIds: [externalContactLinkId], reviewedValue: "photo-hash", stagedPhotoRelative: "reconcile-staging/reconcile-source.jpg", photoContentHash: "photo-hash" };
    const result = await inWriteTransaction(exec, () => applyReconcileSelections(exec, { contactId, now: NOW, selections: [photo] }));
    expect(result.pendingPhoto).toEqual(photo);
    expect(await getReviewedSnapshots(exec, externalContactLinkId)).toEqual({});
  });

  it("never promotes a photo before a throwing apply transaction commits", async () => {
    let promoted = false;
    await expect(inWriteTransaction(exec, async () => {
      await applyReconcileSelections(exec, { contactId, now: NOW, selections: [nameSelection()] });
      throw new Error("force rollback before post-commit photo promotion");
    })).rejects.toThrow("force rollback");
    expect(promoted).toBe(false);
    expect(await exec.getFirstAsync<{ name: string }>("SELECT name FROM contacts WHERE id = ?", [contactId])).toEqual({ name: "Orbit Original" });
  });
});
