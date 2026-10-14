import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import { addOffLimits } from "@/db/off-limits-dao";
import { listOffLimitsForContact } from "@/db/off-limits-read";
import {
  readPopulatedCustomFields,
  readProfileKnowledge,
} from "@/db/profile-knowledge-read";
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
  it("keeps semantic owners distinct, shows hidden rows while the switch is off, and lists pinned rows in both places (D-133, D-134)", async () => {
    const owner = await contact("Owner");
    const linked = await contact("Linked");
    await exec.runAsync(
      `INSERT INTO current_state_entries
         (uid, contact_id, field_key, value, entry_date, created_at, modified_at)
       VALUES (?, ?, 'last_talked_about', 'The garden', '2026-09-09', ?, ?)`,
      [uid(), owner, NOW, NOW],
    );

    const visibleRelationship = await exec.runAsync(
      `INSERT INTO relationships
         (uid, contact_id, person_name, relation_type, linked_contact_id, note,
          pinned, hidden, created_at, modified_at)
       VALUES (?, ?, 'Blair', 'friend', ?, 'Met at work', 1, 0, ?, ?)`,
      [uid(), owner, linked, NOW, NOW],
    );
    const hiddenRelationship = await exec.runAsync(
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
    const hiddenMemory = await exec.runAsync(
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
    expect(result.currentState.last_talked_about?.previous).toEqual([]);
    expect(result.currentState.last_talked_about?.total).toBe(1);
    // Pinned: every pinned row, the hidden ones too (D-134 ignores the flag).
    expect(
      result.featured.items.map((item) => `${item.owner}:${item.id}`).sort(),
    ).toEqual(
      [
        `relationship:${visibleRelationship.lastInsertRowId}`,
        `relationship:${hiddenRelationship.lastInsertRowId}`,
        `memory:${visibleMemory.lastInsertRowId}`,
        `memory:${hiddenMemory.lastInsertRowId}`,
      ].sort(),
    );
    // ...and the same rows in their own sections (D-133).
    expect(result.relationships.items.map((row) => row.id).sort()).toEqual(
      [
        visibleRelationship.lastInsertRowId,
        hiddenRelationship.lastInsertRowId,
      ].sort(),
    );
    expect(result.relationships.total).toBe(2);
    expect(result.relationships.hiddenCount).toBe(0);
    expect(result.relationships.showHiddenAvailable).toBe(false);
    expect(result.memories.items.map((row) => row.id).sort()).toEqual(
      [visibleMemory.lastInsertRowId, hiddenMemory.lastInsertRowId].sort(),
    );
    expect(result.memories.total).toBe(2);
    expect(result.memories.hiddenCount).toBe(0);
    expect(result.memories.showHiddenAvailable).toBe(false);
    expect(result.importedNotes.items).toEqual([
      expect.objectContaining({ type: "imported", value: "Imported note" }),
    ]);
  });

  it("reads Most Recent by entry date, at most five Previous rows, and a total count (D-50, D-52, D-53)", async () => {
    const owner = await contact("Owner");
    await exec.runAsync(
      `INSERT INTO current_state_entries
         (uid, contact_id, field_key, value, entry_date, created_at, modified_at)
       VALUES (?, ?, 'last_talked_about', 'Most recent', '2026-09-09', ?, ?)`,
      [uid(), owner, "2026-09-09 12:00:00", NOW],
    );
    for (let index = 0; index < 6; index += 1) {
      const day = String(index + 1).padStart(2, "0");
      await exec.runAsync(
        `INSERT INTO current_state_entries
           (uid, contact_id, field_key, value, entry_date, created_at, modified_at)
         VALUES (?, ?, 'last_talked_about', ?, ?, ?, ?)`,
        [
          uid(),
          owner,
          `Previous ${index + 1}`,
          `2026-09-${day}`,
          `2026-09-${day} 12:00:00`,
          NOW,
        ],
      );
    }
    // Added last but backdated: it slots into Previous by its entry date.
    await exec.runAsync(
      `INSERT INTO current_state_entries
         (uid, contact_id, field_key, value, entry_date, created_at, modified_at)
       VALUES (?, ?, 'last_talked_about', 'Backdated', '2026-09-05', ?, ?)`,
      [uid(), owner, "2026-09-10 08:00:00", NOW],
    );

    const result = await readProfileKnowledge(readOnly(), owner);
    const current = result.currentState.last_talked_about;
    expect(current?.value).toBe("Most recent");
    expect(current?.total).toBe(8);
    expect(current?.previous).toHaveLength(5);
    expect(current?.previous.map((entry) => entry.value)).toEqual([
      "Previous 6",
      // Same entry date as Previous 5, earlier creation time.
      "Previous 5",
      "Backdated",
      "Previous 4",
      "Previous 3",
    ]);
    expect(current?.previous.map((entry) => entry.id)).not.toContain(
      current?.id,
    );
    expect(current?.previous.every((entry) => entry.total === undefined)).toBe(
      true,
    );
  });

  it("returns entry_date, entry_time, url, interaction_id and link_source on current and previous (c10 C-01)", async () => {
    const owner = await contact("Owner");
    const interactionId = (
      await exec.runAsync(
        `INSERT INTO interactions
           (uid, contact_id, occurred_at, recorded_at, note, source, modified_at)
         VALUES (?, ?, '2026-09-08 18:30:00', ?, 'Their trip', 'manual', ?)`,
        [uid(), owner, NOW, NOW],
      )
    ).lastInsertRowId;
    await exec.runAsync(
      `INSERT INTO current_state_entries
         (uid, contact_id, field_key, value, entry_date, entry_time, url,
          interaction_id, link_source, created_at, modified_at)
       VALUES (?, ?, 'last_talked_about', 'Their trip', '2026-09-08', '18:30:00',
               'https://example.test/trip', ?, 'note', ?, ?)`,
      [uid(), owner, interactionId, NOW, NOW],
    );
    await exec.runAsync(
      `INSERT INTO current_state_entries
         (uid, contact_id, field_key, value, entry_date, url, created_at, modified_at)
       VALUES (?, ?, 'last_talked_about', 'Older', '2026-09-01',
               'https://example.test/older', ?, ?)`,
      [uid(), owner, "2026-09-01 09:00:00", NOW],
    );

    const current = (await readProfileKnowledge(readOnly(), owner)).currentState
      .last_talked_about;
    expect(current).toMatchObject({
      value: "Their trip",
      entry_date: "2026-09-08",
      entry_time: "18:30:00",
      url: "https://example.test/trip",
      interaction_id: interactionId,
      link_source: "note",
      total: 2,
    });
    expect(current?.previous).toEqual([
      expect.objectContaining({
        value: "Older",
        entry_date: "2026-09-01",
        entry_time: null,
        url: "https://example.test/older",
        interaction_id: null,
        link_source: null,
      }),
    ]);
  });

  async function memory(
    owner: number,
    type: string,
    value: string,
    flags: { pinned?: 0 | 1; hidden?: 0 | 1 } = {},
  ): Promise<number> {
    const result = await exec.runAsync(
      `INSERT INTO memories
         (uid, contact_id, type, value, pinned, hidden, provenance,
          created_at, modified_at, allow_ai)
       VALUES (?, ?, ?, ?, ?, ?, 'user', ?, ?, 0)`,
      [
        uid(),
        owner,
        type,
        value,
        flags.pinned ?? 0,
        flags.hidden ?? 0,
        NOW,
        NOW,
      ],
    );
    return result.lastInsertRowId;
  }

  it("splits Memories, Thought of Them and Gift Ideas, and a hidden row shows in its section (D-34, D-134)", async () => {
    const owner = await contact("Owner");
    await memory(owner, "general", "A memory");
    await memory(owner, "thought_of_them", "Saw their band");
    await memory(owner, "gift_idea", "Teapot");
    await memory(owner, "gift_idea", "Hidden gift", { hidden: 1 });

    const result = await readProfileKnowledge(readOnly(), owner);
    expect(result.memories.items.map((row) => row.value)).toEqual(["A memory"]);
    expect(result.thoughtOfThem.items.map((row) => row.value)).toEqual([
      "Saw their band",
    ]);
    expect(result.giftIdeas.items.map((row) => row.value).sort()).toEqual([
      "Hidden gift",
      "Teapot",
    ]);
    expect(result.giftIdeas.total).toBe(2);
    expect(result.giftIdeas.hiddenCount).toBe(0);
    expect(result.giftIdeas.showHiddenAvailable).toBe(false);
    expect(result.memories.hiddenCount).toBe(0);
    expect(result.memories.showHiddenAvailable).toBe(false);
    expect(result.thoughtOfThem.hiddenCount).toBe(0);
  });

  it("returns every pinned item in Pinned with nothing remaining (D-112; c1 F-U6)", async () => {
    const owner = await contact("Owner");
    await memory(owner, "general", "One", { pinned: 1 });
    await memory(owner, "gift_idea", "Two", { pinned: 1 });
    await memory(owner, "thought_of_them", "Three", { pinned: 1 });
    await exec.runAsync(
      `INSERT INTO relationships
         (uid, contact_id, person_name, pinned, hidden, created_at, modified_at)
       VALUES (?, ?, 'Four', 1, 0, ?, ?)`,
      [uid(), owner, NOW, NOW],
    );

    const result = await readProfileKnowledge(readOnly(), owner);
    expect(result.featured.items).toHaveLength(4);
    expect(result.featured.total).toBe(4);
    expect(result.featured.remainingCount).toBe(0);
    // Pinned rows also show in their own sections (D-133), so an only-pinned
    // section is never empty (O6).
    expect(result.memories.items.map((row) => row.value)).toEqual(["One"]);
    expect(result.giftIdeas.items.map((row) => row.value)).toEqual(["Two"]);
    expect(result.thoughtOfThem.items.map((row) => row.value)).toEqual([
      "Three",
    ]);
    expect(result.relationships.items.map((row) => row.person_name)).toEqual([
      "Four",
    ]);
  });

  it("a section shows its newest entries, ignoring pins; Pinned keeps every pinned row (D-148, D-133)", async () => {
    const owner = await contact("Owner");
    const at = (minute: number) =>
      `2026-09-09 12:${String(minute).padStart(2, "0")}:00`;
    const add = async (
      type: string,
      value: string,
      minute: number,
      pinned: 0 | 1,
      meaningfulDate: string | null = null,
    ) =>
      exec.runAsync(
        `INSERT INTO memories
           (uid, contact_id, type, value, meaningful_date, pinned, hidden,
            provenance, created_at, modified_at, allow_ai)
         VALUES (?, ?, ?, ?, ?, ?, 0, 'user', ?, ?, 0)`,
        [uid(), owner, type, value, meaningfulDate, pinned, at(minute), NOW],
      );
    // Three old pinned Thought of Them entries, then four newer ones.
    await add("thought_of_them", "Old pinned 1", 1, 1);
    await add("thought_of_them", "Old pinned 2", 2, 1);
    await add("thought_of_them", "Old pinned 3", 3, 1);
    await add("thought_of_them", "New 4", 4, 0);
    await add("thought_of_them", "New 5", 5, 0);
    await add("thought_of_them", "Newest pinned 6", 6, 1);
    await add("thought_of_them", "Newest 7", 7, 0);
    // Memories: a dated entry still leads undated ones (the read's order
    // without its pin key); pins never jump the queue.
    await add("general", "Dated, pinned", 1, 1, "2020-01-01");
    await add("general", "Dated later", 2, 0, "2024-05-05");
    await add("general", "Undated new", 9, 0);
    await add("general", "Undated newer, pinned", 10, 1);
    for (const [name, minute, pinned] of [
      ["Old pinned person", 1, 1],
      ["Middle", 2, 0],
      ["Newer", 3, 0],
      ["Newest", 4, 0],
    ] as const) {
      await exec.runAsync(
        `INSERT INTO relationships
           (uid, contact_id, person_name, pinned, hidden, created_at, modified_at)
         VALUES (?, ?, ?, ?, 0, ?, ?)`,
        [uid(), owner, name, pinned, at(minute), NOW],
      );
    }

    const result = await readProfileKnowledge(readOnly(), owner);
    expect(result.thoughtOfThem.items.map((row) => row.value)).toEqual([
      "Newest 7",
      "Newest pinned 6",
      "New 5",
    ]);
    expect(result.thoughtOfThem.total).toBe(7);
    expect(result.thoughtOfThem.remainingCount).toBe(4);
    expect(result.memories.items.map((row) => row.value)).toEqual([
      "Dated later",
      "Dated, pinned",
      "Undated newer, pinned",
    ]);
    expect(result.relationships.items.map((row) => row.person_name)).toEqual([
      "Newest",
      "Newer",
      "Middle",
    ]);
    // Pinned is unchanged: every pinned row, people first, in the read's order.
    expect(
      result.featured.items.map((reference) =>
        reference.owner === "memory"
          ? reference.row.value
          : reference.row.person_name,
      ),
    ).toEqual([
      "Old pinned person",
      "Dated, pinned",
      "Undated newer, pinned",
      "Newest pinned 6",
      "Old pinned 3",
      "Old pinned 2",
      "Old pinned 1",
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
    expect(result.customFields.map((group) => group.name)).toEqual([
      "Home",
      null,
    ]);
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

  it("reads only the contact's Off Limits rows from the off_limits table (D-36)", async () => {
    const owner = await contact("Owner");
    const other = await contact("Other");
    await addOffLimits(exec, {
      uid: uid(),
      contactId: owner,
      text: "Avoid layoffs",
      now: NOW,
    });
    await addOffLimits(exec, {
      uid: uid(),
      contactId: other,
      text: "Other secret",
      now: NOW,
    });

    const expected = [
      expect.objectContaining({ contact_id: owner, text: "Avoid layoffs" }),
    ];
    expect(await listOffLimitsForContact(readOnly(), owner)).toEqual(expected);
    expect((await readProfileKnowledge(readOnly(), owner)).offLimits).toEqual(
      expected,
    );
  });

  it("readPopulatedCustomFields returns only populated, non-quarantined fields carrying share_with_ai (A2)", async () => {
    const owner = await contact("Owner");
    const sharedDef = await exec.runAsync(
      `INSERT INTO custom_field_defs
         (uid, col_name, label, type, options, show_on_new, always_show,
          display_order, share_with_ai, scope, history_retained, field_group,
          created_at, modified_at)
       VALUES (?, 'hobby', 'Hobby', 'text', NULL, 0, 0, 0, 1,
               'global', 0, 'Home', ?, ?)`,
      [uid(), NOW, NOW],
    );
    // always_show = 1 but value NULL → an admin placeholder that must be EXCLUDED.
    const alwaysShowEmptyDef = await exec.runAsync(
      `INSERT INTO custom_field_defs
         (uid, col_name, label, type, options, show_on_new, always_show,
          display_order, share_with_ai, scope, history_retained, field_group,
          created_at, modified_at)
       VALUES (?, 'nickname', 'Nickname', 'text', NULL, 0, 1, 1, 0,
               'global', 0, NULL, ?, ?)`,
      [uid(), NOW, NOW],
    );
    // Quarantined def with a populated value → must be EXCLUDED.
    const quarantinedDef = await exec.runAsync(
      `INSERT INTO custom_field_defs
         (uid, col_name, label, type, options, show_on_new, always_show,
          display_order, share_with_ai, scope, history_retained, field_group,
          quarantined_at, created_at, modified_at)
       VALUES (?, 'oldfield', 'Old field', 'text', NULL, 0, 0, 2, 1,
               'global', 0, NULL, ?, ?, ?)`,
      [uid(), NOW, NOW, NOW],
    );
    await exec.runAsync(
      `INSERT INTO custom_field_values
         (uid, contact_id, field_def_id, value, created_at, modified_at)
       VALUES (?, ?, ?, 'Climbing', ?, ?)`,
      [uid(), owner, sharedDef.lastInsertRowId, NOW, NOW],
    );
    await exec.runAsync(
      `INSERT INTO custom_field_values
         (uid, contact_id, field_def_id, value, created_at, modified_at)
       VALUES (?, ?, ?, NULL, ?, ?)`,
      [uid(), owner, alwaysShowEmptyDef.lastInsertRowId, NOW, NOW],
    );
    await exec.runAsync(
      `INSERT INTO custom_field_values
         (uid, contact_id, field_def_id, value, created_at, modified_at)
       VALUES (?, ?, ?, 'quarantined value', ?, ?)`,
      [uid(), owner, quarantinedDef.lastInsertRowId, NOW, NOW],
    );

    const groups = await readPopulatedCustomFields(readOnly(), owner);
    const items = groups.flatMap((group) => group.items);

    // Only the populated, non-quarantined field survives.
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      fieldDefId: sharedDef.lastInsertRowId,
      label: "Hobby",
      rawValue: "Climbing",
      shareWithAi: 1,
    });
    // The always_show-but-empty placeholder and the quarantined field are excluded.
    expect(
      items.some(
        (item) => item.fieldDefId === alwaysShowEmptyDef.lastInsertRowId,
      ),
    ).toBe(false);
    expect(
      items.some((item) => item.fieldDefId === quarantinedDef.lastInsertRowId),
    ).toBe(false);
  });
});
