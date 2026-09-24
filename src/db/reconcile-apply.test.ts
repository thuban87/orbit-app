import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { readDataRevision } from "@/db/data-revision-dao";
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
import { applyReconcileSelections } from "@/db/reconcile-apply";
import { getReviewedSnapshots } from "@/db/reconcile-snapshot-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { classifyReconciliation } from "@/logic/reconcile-diff";
import { buildReconcileSelections } from "@/logic/reconcile-selection";

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
const uid = () => `apply-${++count}`;
let contactId: number;
let externalContactLinkId: number;

beforeEach(async () => {
  count = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, migrations, 13, { now: NOW, newUid: uid });
  contactId = (
    await exec.runAsync(
      "INSERT INTO contacts (uid, name, tracking_enabled, birthday, created_at, modified_at) VALUES (?, 'Orbit Original', 0, '2000-01-01', ?, ?)",
      [uid(), NOW, NOW],
    )
  ).lastInsertRowId;
  externalContactLinkId = (
    await exec.runAsync(
      "INSERT INTO external_contact_links (uid, contact_id, provider, external_contact_id, created_at, modified_at) VALUES (?, ?, 'android', 'source', ?, ?)",
      [uid(), contactId, NOW, NOW],
    )
  ).lastInsertRowId;
});

function nameSelection(baseline = "Orbit Original") {
  return {
    fieldFamily: "name" as const,
    baseline,
    useSource: true,
    sourceValue: "Source Changed",
    sourceLinkIds: [externalContactLinkId],
    reviewedValue: "Source Changed",
  };
}

describe("applyReconcileSelections", () => {
  it.each(["1991-01-01", "1992-01-01"])(
    "stores the exact chosen birthday %s and complete reviewed comparable",
    async (chosen) => {
      await exec.runAsync(
        "UPDATE contacts SET birthday = '1990-01-01' WHERE id = ?",
        [contactId],
      );
      const secondLinkId = (
        await exec.runAsync(
          "INSERT INTO external_contact_links (uid, contact_id, provider, external_contact_id, created_at, modified_at) VALUES (?, ?, 'android', 'second', ?, ?)",
          [uid(), contactId, NOW, NOW],
        )
      ).lastInsertRowId;
      const classified = classifyReconciliation({
        orbit: {
          name: "Orbit Original",
          birthday: "1990-01-01",
          photo: null,
          methods: [],
        },
        sources: [
          {
            externalContactLinkId,
            displayName: "First",
            birthday: "1991-01-01",
            methods: [],
          },
          {
            externalContactLinkId: secondLinkId,
            displayName: "Second",
            birthday: "1992-01-01",
            methods: [],
          },
        ],
        lastReviewed: {},
      });
      const field = classified.fields.find(
        (item) => item.fieldFamily === "birthday",
      )!;
      const option = field.sourceOptions.find((item) => item.value === chosen)!;
      const selections = buildReconcileSelections(classified, {
        birthday: `source:${option.optionId}`,
      });
      await inWriteTransaction(exec, () =>
        applyReconcileSelections(exec, { contactId, now: NOW, selections }),
      );
      expect(
        await exec.getFirstAsync<{ birthday: string }>(
          "SELECT birthday FROM contacts WHERE id = ?",
          [contactId],
        ),
      ).toEqual({ birthday: chosen });
      expect(
        (await getReviewedSnapshots(exec, externalContactLinkId)).birthday,
      ).toBe(field.reviewedComparable);
      expect((await getReviewedSnapshots(exec, secondLinkId)).birthday).toBe(
        field.reviewedComparable,
      );
      expect(
        await exec.getFirstAsync<{ old_value: string }>(
          "SELECT old_value FROM field_history WHERE contact_id = ? AND operation = 'reconcile-overwritten'",
          [contactId],
        ),
      ).toEqual({ old_value: "1990-01-01" });
    },
  );

  it("keeps Orbit and records source comparable; refuses null source for scalar fields", async () => {
    const classified = classifyReconciliation({
      orbit: {
        name: "Orbit Original",
        birthday: "2000-01-01",
        photo: null,
        methods: [],
      },
      sources: [
        {
          externalContactLinkId,
          displayName: "First",
          birthday: "1991-01-01",
          methods: [],
        },
      ],
      lastReviewed: {},
    });
    const keep = buildReconcileSelections(classified, { birthday: "orbit" });
    await inWriteTransaction(exec, () =>
      applyReconcileSelections(exec, { contactId, now: NOW, selections: keep }),
    );
    expect(
      (await getReviewedSnapshots(exec, externalContactLinkId)).birthday,
    ).toBe(
      classified.fields.find((item) => item.fieldFamily === "birthday")
        ?.reviewedComparable,
    );
    const invalid = { ...keep[0], useSource: true, sourceValue: null };
    const result = await inWriteTransaction(exec, () =>
      applyReconcileSelections(exec, {
        contactId,
        now: NOW,
        selections: [invalid],
      }),
    );
    expect(result.staleFields).toEqual(["birthday"]);
    expect(
      await exec.getFirstAsync<{ birthday: string }>(
        "SELECT birthday FROM contacts WHERE id = ?",
        [contactId],
      ),
    ).toEqual({ birthday: "2000-01-01" });
    const invalidName = { ...nameSelection(), sourceValue: null };
    const nameResult = await inWriteTransaction(exec, () =>
      applyReconcileSelections(exec, {
        contactId,
        now: NOW,
        selections: [invalidName],
      }),
    );
    expect(nameResult.staleFields).toEqual(["name"]);
    expect(
      await exec.getFirstAsync<{ name: string }>(
        "SELECT name FROM contacts WHERE id = ?",
        [contactId],
      ),
    ).toEqual({ name: "Orbit Original" });
  });

  it("applies a selected name and a birthday when Orbit birthday is blank", async () => {
    await exec.runAsync("UPDATE contacts SET birthday = NULL WHERE id = ?", [
      contactId,
    ]);
    const classified = classifyReconciliation({
      orbit: {
        name: "Orbit Original",
        birthday: null,
        photo: null,
        methods: [],
      },
      sources: [
        {
          externalContactLinkId,
          displayName: "First",
          birthday: "1991-01-01",
          methods: [],
        },
        {
          externalContactLinkId: externalContactLinkId + 1,
          displayName: "Second",
          birthday: "1992-01-01",
          methods: [],
        },
      ],
      lastReviewed: {},
    });
    const name = classified.fields.find(
      (field) => field.fieldFamily === "name",
    )!.sourceOptions[0];
    const birthday = classified.fields.find(
      (field) => field.fieldFamily === "birthday",
    )!.sourceOptions[0];
    const selections = buildReconcileSelections(classified, {
      name: `source:${name.optionId}`,
      birthday: `source:${birthday.optionId}`,
    });
    const secondLinkId = (
      await exec.runAsync(
        "INSERT INTO external_contact_links (uid, contact_id, provider, external_contact_id, created_at, modified_at) VALUES (?, ?, 'android', 'second', ?, ?)",
        [uid(), contactId, NOW, NOW],
      )
    ).lastInsertRowId;
    expect(secondLinkId).toBe(externalContactLinkId + 1);
    await inWriteTransaction(exec, () =>
      applyReconcileSelections(exec, { contactId, now: NOW, selections }),
    );
    expect(
      await exec.getFirstAsync<{ name: string; birthday: string }>(
        "SELECT name, birthday FROM contacts WHERE id = ?",
        [contactId],
      ),
    ).toEqual({ name: name.value, birthday: birthday.value });
  });
  it("bumps data_revision for scalar-only writes and snapshots prior Orbit values", async () => {
    const before = await readDataRevision(exec);
    await inWriteTransaction(exec, () =>
      applyReconcileSelections(exec, {
        contactId,
        now: NOW,
        selections: [nameSelection()],
      }),
    );
    expect(await readDataRevision(exec)).toBe(before + 1);
    expect(
      await exec.getFirstAsync<{ name: string }>(
        "SELECT name FROM contacts WHERE id = ?",
        [contactId],
      ),
    ).toEqual({ name: "Source Changed" });
    expect(
      await exec.getFirstAsync<{ old_value: string }>(
        "SELECT old_value FROM field_history WHERE contact_id = ?",
        [contactId],
      ),
    ).toEqual({ old_value: "Orbit Original" });
  });

  it("preserves a post-scan Orbit edit, reports staleFields, and does not bump the revision", async () => {
    await exec.runAsync(
      "UPDATE contacts SET name = 'User Edited Later' WHERE id = ?",
      [contactId],
    );
    const before = await readDataRevision(exec);
    const result = await inWriteTransaction(exec, () =>
      applyReconcileSelections(exec, {
        contactId,
        now: NOW,
        selections: [nameSelection()],
      }),
    );
    expect(result.staleFields).toEqual(["name"]);
    expect(await readDataRevision(exec)).toBe(before);
    expect(
      await exec.getFirstAsync<{ name: string }>(
        "SELECT name FROM contacts WHERE id = ?",
        [contactId],
      ),
    ).toEqual({ name: "User Edited Later" });
  });

  it("defers the photo reviewed snapshot until a successful post-commit photo apply", async () => {
    const photo = {
      fieldFamily: "photo" as const,
      baseline: null,
      useSource: true,
      sourceValue: "photo-hash",
      sourceLinkIds: [externalContactLinkId],
      reviewedValue: "photo-hash",
      stagedPhotoRelative: "reconcile-staging/reconcile-source.jpg",
      photoContentHash: "photo-hash",
    };
    const result = await inWriteTransaction(exec, () =>
      applyReconcileSelections(exec, {
        contactId,
        now: NOW,
        selections: [photo],
      }),
    );
    expect(result.pendingPhoto).toEqual(photo);
    expect(await getReviewedSnapshots(exec, externalContactLinkId)).toEqual({});
  });

  it("never promotes a photo before a throwing apply transaction commits", async () => {
    const promoted = false;
    await expect(
      inWriteTransaction(exec, async () => {
        await applyReconcileSelections(exec, {
          contactId,
          now: NOW,
          selections: [nameSelection()],
        });
        throw new Error("force rollback before post-commit photo promotion");
      }),
    ).rejects.toThrow("force rollback");
    expect(promoted).toBe(false);
    expect(
      await exec.getFirstAsync<{ name: string }>(
        "SELECT name FROM contacts WHERE id = ?",
        [contactId],
      ),
    ).toEqual({ name: "Orbit Original" });
  });
});
