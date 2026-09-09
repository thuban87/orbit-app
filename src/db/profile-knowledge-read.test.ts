import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { getRankedFuel, RANKED_FUEL_EXCLUSIONS } from "@/db/fuel-read";
import {
  readProfileKnowledge,
  readProfileOffLimits,
} from "@/db/profile-knowledge-read";
import { runMigrations } from "@/db/migrations/runner";
import type { ReadOnlyExecutor } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-09 12:00:00";
let exec: SqlExecutor;
let sequence = 0;
const uid = () => `profile-knowledge-${++sequence}`;

beforeEach(async () => {
  sequence = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
    defaultPhoneRegion: "US",
  });
});

async function contact(name: string): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, interval_days, tracking_enabled, created_at, modified_at)
     VALUES (?, ?, 30, 1, ?, ?)`,
    [uid(), name, NOW, NOW],
  );
  return result.lastInsertRowId;
}

function readOnly(): ReadOnlyExecutor {
  return {
    getFirstAsync: exec.getFirstAsync.bind(exec),
    getAllAsync: exec.getAllAsync.bind(exec),
  };
}

describe("Profile knowledge projection", () => {
  it("keeps semantic owners distinct, filters hidden before caps, and dedupes featured references", async () => {
    const owner = await contact("Owner");
    const linked = await contact("Linked");
    await exec.runAsync(
      `INSERT INTO current_state_entries
         (uid, contact_id, field_key, value, is_current, created_at, modified_at)
       VALUES (?, ?, 'last_talked_about', 'The garden', 1, ?, ?)`,
      [uid(), owner, NOW, NOW],
    );

    const visibleRelationship = await exec.runAsync(
      `INSERT INTO relationships
         (uid, contact_id, person_name, relation_type, linked_contact_id, note,
          pinned, hidden, created_at, modified_at)
       VALUES (?, ?, 'Blair', 'friend', ?, 'Met at work', 1, 0, ?, ?)`,
      [uid(), owner, linked, NOW, NOW],
    );
    await exec.runAsync(
      `INSERT INTO relationships
         (uid, contact_id, person_name, pinned, hidden, created_at, modified_at)
       VALUES (?, ?, 'Hidden pinned', 1, 1, ?, ?)`,
      [uid(), owner, NOW, NOW],
    );

    const visibleMemory = await exec.runAsync(
      `INSERT INTO memories
         (uid, contact_id, type, value, pinned, hidden, provenance,
          created_at, modified_at, allow_ai)
       VALUES (?, ?, 'general', 'Bring the recipe', 1, 0, 'user', ?, ?, 1)`,
      [uid(), owner, NOW, NOW],
    );
    await exec.runAsync(
      `INSERT INTO memories
         (uid, contact_id, type, value, pinned, hidden, provenance,
          created_at, modified_at, allow_ai)
       VALUES (?, ?, 'general', 'Hidden secret', 1, 1, 'user', ?, ?, 1)`,
      [uid(), owner, NOW, NOW],
    );
    await exec.runAsync(
      `INSERT INTO memories
         (uid, contact_id, type, value, pinned, hidden, provenance,
          created_at, modified_at, allow_ai)
       VALUES (?, ?, 'imported', 'Imported note', 0, 0, 'import', ?, ?, 0)`,
      [uid(), owner, NOW, NOW],
    );

    const result = await readProfileKnowledge(readOnly(), owner);
    expect(result.currentState.last_talked_about?.value).toBe("The garden");
    expect(result.featured.items.map((item) => `${item.owner}:${item.id}`)).toEqual([
      `relationship:${visibleRelationship.lastInsertRowId}`,
      `memory:${visibleMemory.lastInsertRowId}`,
    ]);
    expect(result.relationships.items).toEqual([]);
    expect(result.relationships.hiddenCount).toBe(1);
    expect(result.relationships.showHiddenAvailable).toBe(true);
    expect(result.memories.items).toEqual([]);
    expect(result.memories.hiddenCount).toBe(1);
    expect(result.memories.showHiddenAvailable).toBe(true);
    expect(result.importedNotes.items).toEqual([
      expect.objectContaining({ type: "imported", value: "Imported note" }),
    ]);
  });

  it("caps repeatable visible collections after filtering and reports truthful totals", async () => {
    const owner = await contact("Owner");
    for (let index = 0; index < 5; index += 1) {
      await exec.runAsync(
        `INSERT INTO memories
           (uid, contact_id, type, value, pinned, hidden, provenance,
            created_at, modified_at, allow_ai)
         VALUES (?, ?, 'general', ?, 0, 0, 'user', ?, ?, 0)`,
        [uid(), owner, `Memory ${index}`, NOW, NOW],
      );
    }
    const result = await readProfileKnowledge(readOnly(), owner);
    expect(result.memories.items).toHaveLength(3);
    expect(result.memories.total).toBe(5);
    expect(result.memories.remainingCount).toBe(2);
  });

  it("preserves custom-field grouping, raw invalid values, and value-history identity", async () => {
    const owner = await contact("Owner");
    const other = await contact("Other");
    const numberDef = await exec.runAsync(
      `INSERT INTO custom_field_defs
         (uid, col_name, label, type, options, show_on_new, always_show,
          display_order, share_with_ai, scope, history_retained, field_group,
          created_at, modified_at)
       VALUES (?, 'pets', 'Pets', 'number', NULL, 0, 0, 0, 0,
               'global', 1, 'Home', ?, ?)`,
      [uid(), NOW, NOW],
    );
    const ungroupedDef = await exec.runAsync(
      `INSERT INTO custom_field_defs
         (uid, col_name, label, type, options, show_on_new, always_show,
          display_order, share_with_ai, scope, history_retained, field_group,
          created_at, modified_at)
       VALUES (?, 'nickname', 'Nickname', 'text', NULL, 0, 1, 1, 0,
               'global', 0, NULL, ?, ?)`,
      [uid(), NOW, NOW],
    );
    await exec.runAsync(
      `INSERT INTO custom_field_values
         (uid, contact_id, field_def_id, value, created_at, modified_at)
       VALUES (?, ?, ?, 'about three', ?, ?)`,
      [uid(), owner, numberDef.lastInsertRowId, NOW, NOW],
    );
    await exec.runAsync(
      `INSERT INTO custom_field_values
         (uid, contact_id, field_def_id, value, created_at, modified_at)
       VALUES (?, ?, ?, NULL, ?, ?)`,
      [uid(), owner, ungroupedDef.lastInsertRowId, NOW, NOW],
    );
    await exec.runAsync(
      `INSERT INTO custom_field_values
         (uid, contact_id, field_def_id, value, created_at, modified_at)
       VALUES (?, ?, ?, 'other', ?, ?)`,
      [uid(), other, numberDef.lastInsertRowId, NOW, NOW],
    );

    const result = await readProfileKnowledge(readOnly(), owner);
    expect(result.customFields.map((group) => group.name)).toEqual(["Home", null]);
    expect(result.customFields[0].items[0]).toMatchObject({
      fieldDefId: numberDef.lastInsertRowId,
      rawValue: "about three",
      parsed: { ok: false },
      historyKey: { contactId: owner, fieldDefId: numberDef.lastInsertRowId },
    });
    expect(result.customFields[1].items[0]).toMatchObject({
      fieldDefId: ungroupedDef.lastInsertRowId,
      rawValue: null,
      parsed: { ok: true, value: null },
    });
  });

  it("reads only bound Off Limits rows and leaves ranked exclusions unchanged", async () => {
    const owner = await contact("Owner");
    const other = await contact("Other");
    for (const [contactId, kind, text] of [
      [owner, "off_limits", "Avoid layoffs"],
      [owner, "topic", "Ask about hiking"],
      [other, "off_limits", "Other secret"],
    ] as const) {
      await exec.runAsync(
        `INSERT INTO fuel
           (uid, contact_id, kind, text, created_at, source, modified_at)
         VALUES (?, ?, ?, ?, ?, 'manual', ?)`,
        [uid(), contactId, kind, text, NOW, NOW],
      );
    }

    expect(await readProfileOffLimits(readOnly(), owner)).toEqual([
      expect.objectContaining({ kind: "off_limits", text: "Avoid layoffs" }),
    ]);
    expect(await getRankedFuel(readOnly(), owner)).toEqual([
      expect.objectContaining({ kind: "topic", text: "Ask about hiking" }),
    ]);
    expect(RANKED_FUEL_EXCLUSIONS).toBe(
      `kind != 'off_limits'\n     AND source != 'ai'\n     AND NULLIF(TRIM(text, char(9) || char(10) || char(11) || char(12) || char(13) || char(160) || ' '), '') IS NOT NULL`,
    );
  });
});
