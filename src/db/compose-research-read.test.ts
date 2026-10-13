import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { readComposeResearch } from "@/db/compose-research-read";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import { addOffLimits } from "@/db/off-limits-dao";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-13 12:00:00";
let exec: SqlExecutor;
let sequence = 0;
const uid = () => `compose-research-${++sequence}`;

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

async function addMemory(
  contactId: number,
  opts: {
    value: string;
    allowAi: 0 | 1;
    hidden?: 0 | 1;
    deleted?: boolean;
    type?: string;
    pinned?: 0 | 1;
    customLabel?: string;
    meaningfulDate?: string;
    interactionId?: number;
  },
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO memories
       (uid, contact_id, type, custom_label, value, meaningful_date, pinned,
        hidden, provenance, created_at, modified_at, deleted_at, allow_ai,
        interaction_id, link_source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'user', ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      contactId,
      opts.type ?? "general",
      opts.customLabel ?? null,
      opts.value,
      opts.meaningfulDate ?? null,
      opts.pinned ?? 0,
      opts.hidden ?? 0,
      NOW,
      NOW,
      opts.deleted ? NOW : null,
      opts.allowAi,
      opts.interactionId ?? null,
      opts.interactionId === undefined ? null : "note",
    ],
  );
  return result.lastInsertRowId;
}

async function addRelationship(
  contactId: number,
  opts: { personName: string; relationType?: string; hidden?: 0 | 1 },
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO relationships
       (uid, contact_id, person_name, relation_type, pinned, hidden,
        created_at, modified_at)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
    [
      uid(),
      contactId,
      opts.personName,
      opts.relationType ?? null,
      opts.hidden ?? 0,
      NOW,
      NOW,
    ],
  );
  return result.lastInsertRowId;
}

async function addCustomField(
  contactId: number,
  opts: {
    colName: string;
    label: string;
    shareWithAi: 0 | 1;
    value: string | null;
    alwaysShow?: 0 | 1;
  },
): Promise<number> {
  const def = await exec.runAsync(
    `INSERT INTO custom_field_defs
       (uid, col_name, label, type, options, show_on_new, always_show,
        display_order, share_with_ai, scope, history_retained, field_group,
        created_at, modified_at)
     VALUES (?, ?, ?, 'text', NULL, 0, ?, 0, ?, 'global', 0, NULL, ?, ?)`,
    [
      uid(),
      opts.colName,
      opts.label,
      opts.alwaysShow ?? 0,
      opts.shareWithAi,
      NOW,
      NOW,
    ],
  );
  await exec.runAsync(
    `INSERT INTO custom_field_values
       (uid, contact_id, field_def_id, value, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uid(), contactId, def.lastInsertRowId, opts.value, NOW, NOW],
  );
  return def.lastInsertRowId;
}

function byId(items: Awaited<ReturnType<typeof readComposeResearch>>) {
  return new Map(items.map((item) => [item.id, item]));
}

describe("compose-research-read — normalized ResearchItem projection", () => {
  it("derives per-source aiEligible, marks off-limits, and includes visible Key People", async () => {
    const owner = await contact("Owner");
    const aiMemory = await addMemory(owner, {
      value: "Bring the recipe",
      allowAi: 1,
    });
    const privateMemory = await addMemory(owner, {
      value: "Do not share",
      allowAi: 0,
    });
    const sharedField = await addCustomField(owner, {
      colName: "hobby",
      label: "Hobby",
      shareWithAi: 1,
      value: "Climbing",
    });
    const privateField = await addCustomField(owner, {
      colName: "salary",
      label: "Salary",
      shareWithAi: 0,
      value: "secret",
    });
    await exec.runAsync(`UPDATE contacts SET birthday = ? WHERE id = ?`, [
      "1990-02-14",
      owner,
    ]);
    const relationship = await addRelationship(owner, {
      personName: "Blair",
      relationType: "friend",
    });
    await addOffLimits(exec, {
      uid: uid(),
      contactId: owner,
      label: "Layoffs",
      text: "Avoid the layoffs topic",
      now: NOW,
    });

    const items = await readComposeResearch(exec, owner);
    const map = byId(items);

    expect(map.get(`memory:${aiMemory}`)?.aiEligible).toBe(true);
    expect(map.get(`memory:${privateMemory}`)?.aiEligible).toBe(false);
    expect(map.get(`custom:${sharedField}`)?.aiEligible).toBe(true);
    expect(map.get(`custom:${privateField}`)?.aiEligible).toBe(false);

    // First-class field: present, never Add-to-AI.
    expect(map.get("firstclass:birthday")).toMatchObject({
      group: "Basics",
      value: "1990-02-14",
      aiEligible: false,
    });

    // Key People: a populated, visible relationship appears, aiEligible false.
    expect(map.get(`relationship:${relationship}`)).toMatchObject({
      label: "Blair",
      aiEligible: false,
      isOffLimits: false,
    });

    // Off Limits → its own Off Limits group (D-87), never Add-to-AI, never
    // Message Focus (D-10).
    const offLimits = items.find((item) => item.isOffLimits);
    expect(offLimits).toMatchObject({
      groupId: "off_limits",
      group: "Off Limits",
      label: "Layoffs",
      value: "Avoid the layoffs topic",
      aiEligible: false,
      isOffLimits: true,
    });
  });

  it("omits empty groups — only populated knowledge is returned", async () => {
    // A truly sparse contact: no interval, no category — so no first-class items.
    const sparse = await exec.runAsync(
      `INSERT INTO contacts
         (uid, name, interval_days, tracking_enabled, created_at, modified_at)
       VALUES (?, 'Sparse', NULL, 0, ?, ?)`,
      [uid(), NOW, NOW],
    );
    const owner = sparse.lastInsertRowId;
    await addMemory(owner, { value: "One memory", allowAi: 0 });

    const items = await readComposeResearch(exec, owner);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ group: "Memory", value: "One memory" });
    // No current-state, Basics, Key People, custom, or Off Limits groups materialize.
    expect(items.some((item) => item.isOffLimits)).toBe(false);
    expect(items.some((item) => item.id.startsWith("firstclass:"))).toBe(false);
  });

  it("excludes hidden, soft-deleted, and historical knowledge from the projection", async () => {
    const owner = await contact("Owner");
    const visibleMemory = await addMemory(owner, {
      value: "Visible",
      allowAi: 0,
    });
    await addMemory(owner, { value: "Hidden", allowAi: 0, hidden: 1 });
    await addMemory(owner, { value: "Deleted", allowAi: 0, deleted: true });
    const visibleRel = await addRelationship(owner, { personName: "Casey" });
    await addRelationship(owner, { personName: "Hidden Pat", hidden: 1 });

    // An earlier and a Most Recent entry for one key (D-45: newest date wins;
    // the earlier one is inserted last so insertion order cannot decide).
    await exec.runAsync(
      `INSERT INTO current_state_entries
         (uid, contact_id, field_key, value, entry_date, created_at, modified_at)
       VALUES (?, ?, 'current_location', 'New city', '2026-09-01', ?, ?)`,
      [uid(), owner, NOW, NOW],
    );
    await exec.runAsync(
      `INSERT INTO current_state_entries
         (uid, contact_id, field_key, value, entry_date, created_at, modified_at)
       VALUES (?, ?, 'current_location', 'Old town', '2026-01-01', ?, ?)`,
      [uid(), owner, NOW, NOW],
    );

    const items = await readComposeResearch(exec, owner);
    const ids = items.map((item) => item.id);

    expect(ids).toContain(`memory:${visibleMemory}`);
    expect(items.some((item) => item.value === "Hidden")).toBe(false);
    expect(items.some((item) => item.value === "Deleted")).toBe(false);
    expect(ids).toContain(`relationship:${visibleRel}`);
    expect(items.some((item) => item.label === "Hidden Pat")).toBe(false);

    // Only the current value renders — the superseded one never leaks.
    const location = items.find(
      (item) => item.id === "current:current_location",
    );
    expect(location?.value).toBe("New city");
    expect(location?.entryDate).toBe("2026-09-01");
    expect(items.some((item) => item.value === "Old town")).toBe(false);
  });

  it("shows an unlabeled Off Limits item's text once, with an empty label (D-111)", async () => {
    const owner = await contact("Owner");
    await addOffLimits(exec, {
      uid: uid(),
      contactId: owner,
      text: "Their divorce",
      now: NOW,
    });

    const [item] = (await readComposeResearch(exec, owner)).filter(
      (row) => row.isOffLimits,
    );
    expect(item).toMatchObject({
      group: "Off Limits",
      label: "",
      value: "Their divorce",
      aiEligible: false,
    });
  });

  it("takes memory Add-to-AI eligibility from the SQL AI predicate (D-49)", async () => {
    const owner = await contact("Owner");
    const interaction = await exec.runAsync(
      `INSERT INTO interactions
         (uid, contact_id, occurred_at, recorded_at, channel, direction,
          connected, source, modified_at, note, allow_ai)
       VALUES (?, ?, ?, ?, 'Message', 'outbound', 1, 'manual', ?, 'Linked', 0)`,
      [uid(), owner, NOW, NOW, NOW],
    );
    const linked = await addMemory(owner, {
      value: "Linked",
      allowAi: 1,
      interactionId: interaction.lastInsertRowId,
    });

    const before = byId(await readComposeResearch(exec, owner));
    expect(before.get(`memory:${linked}`)?.aiEligible).toBe(false);

    await exec.runAsync("UPDATE interactions SET allow_ai = 1 WHERE id = ?", [
      interaction.lastInsertRowId,
    ]);
    const after = byId(await readComposeResearch(exec, owner));
    expect(after.get(`memory:${linked}`)?.aiEligible).toBe(true);
  });

  it("groups Gift Ideas and Thought of Them under their registry names (D-91)", async () => {
    const owner = await contact("Owner");
    const gift = await addMemory(owner, {
      type: "gift_idea",
      value: "Pottery class",
      customLabel: "Birthday",
      allowAi: 0,
    });
    const thought = await addMemory(owner, {
      type: "thought_of_them",
      value: "A cat video",
      allowAi: 1,
    });

    const map = byId(await readComposeResearch(exec, owner));
    expect(map.get(`memory:${gift}`)).toMatchObject({
      groupId: "memory:gift_idea",
      group: "Gift Ideas",
      label: "Birthday",
      aiEligible: false,
    });
    expect(map.get(`memory:${thought}`)).toMatchObject({
      groupId: "memory:thought_of_them",
      group: "Thought of Them",
      label: "Thought of Them",
      aiEligible: true,
    });
  });

  it("keeps a memory's value and meaningful date raw (the read formats nothing)", async () => {
    const owner = await contact("Owner");
    const id = await addMemory(owner, {
      value: "2026-10-20 trip",
      meaningfulDate: "2026-10-20",
      allowAi: 1,
    });

    const item = byId(await readComposeResearch(exec, owner)).get(
      `memory:${id}`,
    );
    expect(item?.value).toBe("2026-10-20 trip");
    expect(item?.meaningfulDate).toBe("2026-10-20");
  });

  it("shows a value-less memory's note but never offers it to Message Focus (D-124)", async () => {
    const owner = await contact("Owner");
    const id = await addMemory(owner, {
      value: "placeholder",
      customLabel: "Anniversary",
      allowAi: 1,
    });
    await exec.runAsync(
      "UPDATE memories SET value = NULL, note = 'private note' WHERE id = ?",
      [id],
    );
    const withMain = await addMemory(owner, {
      value: "Likes jazz",
      allowAi: 1,
    });

    const items = byId(await readComposeResearch(exec, owner));
    expect(items.get(`memory:${id}`)?.value).toBe("private note");
    expect(items.get(`memory:${id}`)?.focusValue).toBe("");
    expect(items.get(`memory:${withMain}`)?.focusValue).toBe("Likes jazz");
  });

  it("gives every item of one section the same group id, pinned or not (J-X01)", async () => {
    const owner = await contact("Owner");
    await addMemory(owner, { value: "Pinned", allowAi: 0, pinned: 1 });
    await addMemory(owner, {
      type: "imported",
      value: "Imported note",
      allowAi: 0,
    });
    await addMemory(owner, { value: "Unpinned", allowAi: 0 });

    const items = await readComposeResearch(exec, owner);
    const general = items.filter((item) => item.groupId === "memory:general");
    expect(general.map((item) => item.value)).toEqual(["Pinned", "Unpinned"]);
    expect(new Set(general.map((item) => item.group))).toEqual(
      new Set(["Memory"]),
    );
  });
});
