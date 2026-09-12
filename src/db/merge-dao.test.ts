import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { createGroupEvent } from "@/db/group-events-dao";
import {
  createPendingAssist,
  markAssistLogged,
} from "@/db/interaction-assist-dao";
import {
  GroupMergeCollisionError,
  mergeContacts,
  normalizeMergeResolutions,
} from "@/db/merge-dao";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-30 12:00:00";
let exec: SqlExecutor;
let n = 0;
const uid = () => `uid-${++n}`;

async function contact(name: string): Promise<number> {
  const row = await exec.runAsync(
    "INSERT INTO contacts (uid, name, tracking_enabled, created_at, modified_at) VALUES (?, ?, 0, ?, ?)",
    [uid(), name, NOW, NOW],
  );
  return row.lastInsertRowId;
}

beforeEach(async () => {
  n = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
  });
});

async function assertNoRelationshipSelfLinks(): Promise<void> {
  expect(
    await exec.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM relationships WHERE contact_id = linked_contact_id",
    ),
  ).toEqual({ n: 0 });
}

describe("mergeContacts", () => {
  it("reparents children and field history, then retires the absorbed identity as a tombstone", async () => {
    const survivor = await contact("Survivor");
    const absorbed = await contact("Absorbed");
    await exec.runAsync(
      "INSERT INTO interactions (uid, contact_id, occurred_at, recorded_at, source, modified_at) VALUES (?, ?, ?, ?, 'manual', ?)",
      [uid(), absorbed, NOW, NOW, NOW],
    );
    await exec.runAsync(
      "INSERT INTO field_history (contact_id, field_col_name, old_value, operation, created_at) VALUES (?, 'name', 'old', 'edit', ?)",
      [absorbed, NOW],
    );
    const absorbedUid = (await exec.getFirstAsync<{ uid: string }>(
      "SELECT uid FROM contacts WHERE id = ?",
      [absorbed],
    ))!.uid;
    await mergeContacts(exec, {
      survivorId: survivor,
      absorbedId: absorbed,
      now: NOW,
    });
    await assertNoRelationshipSelfLinks();
    expect(
      await exec.getFirstAsync("SELECT id FROM contacts WHERE id = ?", [
        absorbed,
      ]),
    ).toBeNull();
    expect(
      await exec.getFirstAsync<{ contact_id: number }>(
        "SELECT contact_id FROM interactions",
      ),
    ).toEqual({ contact_id: survivor });
    expect(
      await exec.getFirstAsync<{ contact_id: number }>(
        "SELECT contact_id FROM field_history WHERE old_value = 'old'",
      ),
    ).toEqual({ contact_id: survivor });
    expect(
      await exec.getFirstAsync<{ entity_uid: string }>(
        "SELECT entity_uid FROM tombstones WHERE entity_type = 'contact'",
        [],
      ),
    ).toEqual({ entity_uid: absorbedUid });
  });

  it("reparents retained custom-field history instead of losing it to contact cascade", async () => {
    const survivor = await contact("Survivor");
    const absorbed = await contact("Absorbed");
    const def = await exec.runAsync(
      "INSERT INTO custom_field_defs (uid, col_name, label, type, display_order, created_at, modified_at) VALUES (?, 'note', 'Note', 'text', 0, ?, ?)",
      [uid(), NOW, NOW],
    );
    await exec.runAsync(
      `INSERT INTO custom_field_value_history (uid, contact_id, field_def_id, value, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [uid(), absorbed, def.lastInsertRowId, "prior", NOW],
    );
    await mergeContacts(exec, {
      survivorId: survivor,
      absorbedId: absorbed,
      now: NOW,
    });
    expect(
      await exec.getAllAsync(
        "SELECT contact_id, value FROM custom_field_value_history ORDER BY id",
      ),
    ).toEqual([{ contact_id: survivor, value: "prior" }]);
  });

  it("reparents a pending assist to the survivor so confirmation logs against the live identity", async () => {
    const survivor = await contact("Survivor");
    const absorbed = await contact("Absorbed");
    const assistUid = await createPendingAssist(exec, {
      contactId: absorbed,
      channel: "call",
      endpointValue: "+15551234567",
      now: NOW,
    });

    await mergeContacts(exec, {
      survivorId: survivor,
      absorbedId: absorbed,
      now: NOW,
    });
    await assertNoRelationshipSelfLinks();

    expect(
      await exec.getFirstAsync<{ contact_id: number }>(
        "SELECT contact_id FROM interaction_assists WHERE uid = ?",
        [assistUid],
      ),
    ).toEqual({ contact_id: survivor });

    await markAssistLogged(exec, { assistUid, connected: 1, now: NOW });

    expect(
      await exec.getFirstAsync<{ contact_id: number }>(
        "SELECT contact_id FROM interactions WHERE source = 'assist'",
      ),
    ).toEqual({ contact_id: survivor });
  });

  it("defaults custom-field collisions to survivor and honours an absorbed resolution", async () => {
    const survivor = await contact("Survivor");
    const absorbed = await contact("Absorbed");
    const def = await exec.runAsync(
      "INSERT INTO custom_field_defs (uid, col_name, label, type, display_order, created_at, modified_at) VALUES (?, 'nickname', 'Nickname', 'text', 0, ?, ?)",
      [uid(), NOW, NOW],
    );
    await exec.runAsync(
      "INSERT INTO custom_field_values (uid, contact_id, field_def_id, value, created_at, modified_at) VALUES (?, ?, ?, 'survivor', ?, ?), (?, ?, ?, 'absorbed', ?, ?)",
      [
        uid(),
        survivor,
        def.lastInsertRowId,
        NOW,
        NOW,
        uid(),
        absorbed,
        def.lastInsertRowId,
        NOW,
        NOW,
      ],
    );
    await mergeContacts(exec, {
      survivorId: survivor,
      absorbedId: absorbed,
      now: NOW,
      resolutions: { customFields: { [def.lastInsertRowId]: "absorbed" } },
    });
    await assertNoRelationshipSelfLinks();
    expect(
      await exec.getFirstAsync<{ value: string }>(
        "SELECT value FROM custom_field_values WHERE contact_id = ?",
        [survivor],
      ),
    ).toEqual({ value: "absorbed" });
  });

  it("preserves populated absorbed scalar and custom values when the survivor is empty without a resolution", async () => {
    const survivor = await contact("");
    const absorbed = await contact("Absorbed name");
    const def = await exec.runAsync(
      "INSERT INTO custom_field_defs (uid, col_name, label, type, display_order, created_at, modified_at) VALUES (?, 'nickname', 'Nickname', 'text', 0, ?, ?)",
      [uid(), NOW, NOW],
    );
    await exec.runAsync(
      "INSERT INTO custom_field_values (uid, contact_id, field_def_id, value, created_at, modified_at) VALUES (?, ?, ?, '', ?, ?), (?, ?, ?, 'Absorbed nickname', ?, ?)",
      [
        uid(),
        survivor,
        def.lastInsertRowId,
        NOW,
        NOW,
        uid(),
        absorbed,
        def.lastInsertRowId,
        NOW,
        NOW,
      ],
    );

    await mergeContacts(exec, {
      survivorId: survivor,
      absorbedId: absorbed,
      now: NOW,
    });
    await assertNoRelationshipSelfLinks();

    expect(
      await exec.getFirstAsync<{ name: string }>(
        "SELECT name FROM contacts WHERE id = ?",
        [survivor],
      ),
    ).toEqual({ name: "Absorbed name" });
    expect(
      await exec.getFirstAsync<{ value: string }>(
        "SELECT value FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
        [survivor, def.lastInsertRowId],
      ),
    ).toEqual({ value: "Absorbed nickname" });
    expect(
      await exec.getAllAsync<{
        field_col_name: string;
        old_value: string | null;
      }>(
        "SELECT field_col_name, old_value FROM field_history WHERE contact_id = ? AND operation = 'merge-overwritten' ORDER BY field_col_name",
        [survivor],
      ),
    ).toEqual([
      { field_col_name: "custom_field:" + def.lastInsertRowId, old_value: "" },
      { field_col_name: "name", old_value: "" },
    ]);
  });

  it("rejects self-merges without mutating a contact", async () => {
    const id = await contact("Only");
    await expect(
      mergeContacts(exec, { survivorId: id, absorbedId: id, now: NOW }),
    ).rejects.toThrow("cannot absorb itself");
    expect(
      await exec.getFirstAsync<{ name: string }>(
        "SELECT name FROM contacts WHERE id = ?",
        [id],
      ),
    ).toEqual({ name: "Only" });
  });

  it("preserves knowledge, repoints third-party links, and prevents merge-created self-links", async () => {
    const survivor = await contact("Survivor");
    const absorbed = await contact("Absorbed");
    const third = await contact("Third");
    await exec.runAsync(
      `INSERT INTO memories (uid, contact_id, type, created_at, modified_at)
       VALUES (?, ?, 'general', ?, ?)`,
      [uid(), absorbed, NOW, NOW],
    );
    await exec.runAsync(
      `INSERT INTO relationships
         (uid, contact_id, person_name, linked_contact_id, created_at, modified_at)
       VALUES (?, ?, 'Survivor-owned', ?, ?, ?),
              (?, ?, 'Absorbed-owned', ?, ?, ?),
              (?, ?, 'Third-party', ?, ?, ?),
              (?, ?, 'Ordinary', NULL, ?, ?)`,
      [
        uid(),
        survivor,
        absorbed,
        NOW,
        NOW,
        uid(),
        absorbed,
        survivor,
        NOW,
        NOW,
        uid(),
        third,
        absorbed,
        NOW,
        NOW,
        uid(),
        absorbed,
        NOW,
        NOW,
      ],
    );
    await exec.runAsync(
      `INSERT INTO current_state_entries
         (uid, contact_id, field_key, value, is_current, created_at, modified_at)
       VALUES (?, ?, 'city', 'Survivor city', 1, ?, ?),
              (?, ?, 'city', 'Absorbed city', 1, ?, ?),
              (?, ?, 'hobby', 'Climbing', 1, ?, ?)`,
      [
        uid(),
        survivor,
        NOW,
        NOW,
        uid(),
        absorbed,
        NOW,
        NOW,
        uid(),
        absorbed,
        NOW,
        NOW,
      ],
    );

    await mergeContacts(exec, {
      survivorId: survivor,
      absorbedId: absorbed,
      now: NOW,
    });
    await assertNoRelationshipSelfLinks();

    expect(
      await exec.getFirstAsync<{ contact_id: number }>(
        "SELECT contact_id FROM memories WHERE contact_id = ?",
        [survivor],
      ),
    ).toEqual({ contact_id: survivor });
    expect(
      await exec.getAllAsync<{
        person_name: string;
        contact_id: number;
        linked_contact_id: number | null;
      }>(
        "SELECT person_name, contact_id, linked_contact_id FROM relationships ORDER BY person_name",
      ),
    ).toEqual([
      {
        person_name: "Absorbed-owned",
        contact_id: survivor,
        linked_contact_id: null,
      },
      {
        person_name: "Ordinary",
        contact_id: survivor,
        linked_contact_id: null,
      },
      {
        person_name: "Survivor-owned",
        contact_id: survivor,
        linked_contact_id: null,
      },
      {
        person_name: "Third-party",
        contact_id: third,
        linked_contact_id: survivor,
      },
    ]);
    expect(
      await exec.getAllAsync<{
        field_key: string;
        value: string;
        is_current: number;
        contact_id: number;
      }>(
        "SELECT field_key, value, is_current, contact_id FROM current_state_entries ORDER BY field_key, is_current DESC",
      ),
    ).toEqual([
      {
        field_key: "city",
        value: "Survivor city",
        is_current: 1,
        contact_id: survivor,
      },
      {
        field_key: "city",
        value: "Absorbed city",
        is_current: 0,
        contact_id: survivor,
      },
      {
        field_key: "hobby",
        value: "Climbing",
        is_current: 1,
        contact_id: survivor,
      },
    ]);
  });

  it("normalizes only known per-type primary choices", () => {
    expect(
      normalizeMergeResolutions({
        primaryMethod: { phone: "absorbed", email: "bad" },
        customFields: { 1: "survivor", nope: "absorbed" },
      }),
    ).toEqual({
      primaryMethod: { phone: "absorbed" },
      customFields: { 1: "survivor" },
    });
  });

  it("rejects a same-Group-Event merge without mutating either contact or child", async () => {
    const survivor = await contact("Survivor");
    const absorbed = await contact("Absorbed");
    await createGroupEvent(exec, {
      uid: uid(),
      title: "Dinner",
      occurredAt: NOW,
      now: NOW,
      participants: [
        { contactId: survivor, uid: uid() },
        { contactId: absorbed, uid: uid() },
      ],
    });
    await expect(
      mergeContacts(exec, {
        survivorId: survivor,
        absorbedId: absorbed,
        now: NOW,
      }),
    ).rejects.toBeInstanceOf(GroupMergeCollisionError);
    expect(
      await exec.getFirstAsync("SELECT id FROM contacts WHERE id = ?", [
        absorbed,
      ]),
    ).not.toBeNull();
    expect(
      await exec.getAllAsync<{ contact_id: number }>(
        "SELECT contact_id FROM interactions ORDER BY contact_id",
      ),
    ).toEqual([{ contact_id: survivor }, { contact_id: absorbed }]);
    expect(
      await exec.getFirstAsync(
        "SELECT id FROM tombstones WHERE entity_type = 'contact'",
      ),
    ).toBeNull();
  });

  it("reparents a non-colliding Group Event child and recomputes survivor recency", async () => {
    const survivor = await contact("Survivor");
    const absorbed = await contact("Absorbed");
    const occurredAt = "2026-08-20 10:00:00";
    const { groupEventId } = await createGroupEvent(exec, {
      uid: uid(),
      title: "Dinner",
      occurredAt,
      now: NOW,
      participants: [{ contactId: absorbed, uid: uid() }],
    });
    await mergeContacts(exec, {
      survivorId: survivor,
      absorbedId: absorbed,
      now: NOW,
    });
    expect(
      await exec.getFirstAsync<{ contact_id: number; group_event_id: number }>(
        "SELECT contact_id, group_event_id FROM interactions",
      ),
    ).toEqual({ contact_id: survivor, group_event_id: groupEventId });
    expect(
      await exec.getFirstAsync<{ last_contact: string }>(
        "SELECT last_contact FROM contacts WHERE id = ?",
        [survivor],
      ),
    ).toEqual({ last_contact: occurredAt });
  });
});
