import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  editHistoryEntry,
  promoteToCurrentValue,
  setCurrentStateValue,
} from "@/db/current-state-history-dao";
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
import { migration014 } from "@/db/migrations/014-interaction-assists";
import { migration015 } from "@/db/migrations/015-theme-settings";
import { migration016 } from "@/db/migrations/016-contact-knowledge";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-04 12:00:00";

let uidCounter = 0;
const uid = () => `current-state-uid-${++uidCounter}`;

let exec: SqlExecutor;

const MIGRATIONS = [
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
  migration014,
  migration015,
  migration016,
];

beforeEach(async () => {
  uidCounter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, 16, { now: NOW, newUid: uid });
});

async function makeContact(name = "Current state contact"): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [uid(), name, 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function entries(contactId: number, fieldKey = "current_location") {
  return exec.getAllAsync<{
    id: number;
    value: string;
    is_current: number;
    created_at: string;
  }>(
    `SELECT id, value, is_current, created_at
       FROM current_state_entries
      WHERE contact_id = ? AND field_key = ?
      ORDER BY id`,
    [contactId, fieldKey],
  );
}

describe("setCurrentStateValue — new current + retained history", () => {
  it("creates the first current entry", async () => {
    const contactId = await makeContact();

    await setCurrentStateValue(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Chicago",
      now: NOW,
    });

    expect(await entries(contactId)).toEqual([
      expect.objectContaining({ value: "Chicago", is_current: 1, created_at: NOW }),
    ]);
  });

  it("demotes the prior current without losing it when a new value is set", async () => {
    const contactId = await makeContact();
    await setCurrentStateValue(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Chicago",
      now: NOW,
    });

    await setCurrentStateValue(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Madison",
      now: "2026-09-05 12:00:00",
    });

    const rows = await entries(contactId);
    expect(rows.filter((row) => row.is_current === 1)).toHaveLength(1);
    expect(rows).toEqual([
      expect.objectContaining({ value: "Chicago", is_current: 0, created_at: NOW }),
      expect.objectContaining({ value: "Madison", is_current: 1 }),
    ]);
  });

  it("rejects an unknown field before writing rows", async () => {
    const contactId = await makeContact();

    await expect(
      setCurrentStateValue(exec, {
        contactId,
        fieldKey: "bogus" as "current_location",
        value: "Nope",
        now: NOW,
      }),
    ).rejects.toThrow("current-state-history-dao: unknown field_key");

    const count = await exec.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM current_state_entries WHERE contact_id = ?",
      [contactId],
    );
    expect(count?.count).toBe(0);
  });
});

describe("promoteToCurrentValue and editHistoryEntry", () => {
  async function seedHistory(contactId: number): Promise<{
    historicId: number;
    currentId: number;
  }> {
    const historicId = await setCurrentStateValue(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Chicago",
      now: NOW,
    });
    const currentId = await setCurrentStateValue(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Madison",
      now: "2026-09-05 12:00:00",
    });
    return { historicId, currentId };
  }

  it("promotes history while preserving the formerly-current value", async () => {
    const contactId = await makeContact();
    const { historicId, currentId } = await seedHistory(contactId);

    await promoteToCurrentValue(exec, {
      contactId,
      fieldKey: "current_location",
      targetId: historicId,
      now: "2026-09-06 12:00:00",
    });

    const rows = await entries(contactId);
    expect(rows).toEqual([
      expect.objectContaining({ id: historicId, value: "Chicago", is_current: 1 }),
      expect.objectContaining({ id: currentId, value: "Madison", is_current: 0 }),
    ]);
    expect(rows.filter((row) => row.is_current === 1)).toHaveLength(1);
  });

  it("is no-op-safe when promoting the already-current entry", async () => {
    const contactId = await makeContact();
    const { currentId } = await seedHistory(contactId);
    const before = await entries(contactId);

    await promoteToCurrentValue(exec, {
      contactId,
      fieldKey: "current_location",
      targetId: currentId,
      now: "2026-09-06 12:00:00",
    });

    const after = await entries(contactId);
    expect(after.map(({ id, value, is_current }) => ({ id, value, is_current }))).toEqual(
      before.map(({ id, value, is_current }) => ({ id, value, is_current })),
    );
    expect(after.filter((row) => row.is_current === 1)).toHaveLength(1);
  });

  it("edits a history value in place without changing its current state", async () => {
    const contactId = await makeContact();
    const { historicId } = await seedHistory(contactId);

    await editHistoryEntry(exec, {
      contactId,
      fieldKey: "current_location",
      entryId: historicId,
      value: "Milwaukee",
      now: "2026-09-06 12:00:00",
    });

    expect(await entries(contactId)).toEqual([
      expect.objectContaining({ id: historicId, value: "Milwaukee", is_current: 0 }),
      expect.objectContaining({ value: "Madison", is_current: 1 }),
    ]);
  });

  it("rolls back a promote whose target does not belong to the field", async () => {
    const contactId = await makeContact();
    const { currentId } = await seedHistory(contactId);
    const otherId = await setCurrentStateValue(exec, {
      contactId,
      fieldKey: "last_talked_about",
      value: "Coffee",
      now: NOW,
    });

    await expect(
      promoteToCurrentValue(exec, {
        contactId,
        fieldKey: "current_location",
        targetId: otherId,
        now: "2026-09-06 12:00:00",
      }),
    ).rejects.toThrow("promoteToCurrentValue");

    expect((await entries(contactId)).find((row) => row.id === currentId)).toEqual(
      expect.objectContaining({ is_current: 1, value: "Madison" }),
    );
  });

  it("rolls back an edit misrouted to another current-state field", async () => {
    const contactId = await makeContact();
    const locationId = await setCurrentStateValue(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Chicago",
      now: NOW,
    });
    const topicId = await setCurrentStateValue(exec, {
      contactId,
      fieldKey: "last_talked_about",
      value: "Gardening",
      now: NOW,
    });

    await expect(
      editHistoryEntry(exec, {
        contactId,
        fieldKey: "last_talked_about",
        entryId: locationId,
        value: "Misrouted",
        now: "2026-09-06 12:00:00",
      }),
    ).rejects.toThrow("editHistoryEntry");

    expect((await entries(contactId)).find((row) => row.id === locationId)).toEqual(
      expect.objectContaining({ value: "Chicago", is_current: 1 }),
    );
    expect((await entries(contactId, "last_talked_about")).find((row) => row.id === topicId)).toEqual(
      expect.objectContaining({ value: "Gardening", is_current: 1 }),
    );
  });
});
