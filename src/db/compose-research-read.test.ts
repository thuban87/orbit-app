import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { readComposeResearch } from "@/db/compose-research-read";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
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
  },
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO memories
       (uid, contact_id, type, value, pinned, hidden, provenance,
        created_at, modified_at, deleted_at, allow_ai)
     VALUES (?, ?, ?, ?, 0, ?, 'user', ?, ?, ?, ?)`,
    [
      uid(),
      contactId,
      opts.type ?? "general",
      opts.value,
      opts.hidden ?? 0,
      NOW,
      NOW,
      opts.deleted ? NOW : null,
      opts.allowAi,
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
    await exec.runAsync(
      `INSERT INTO fuel (uid, contact_id, kind, label, text, created_at, source, modified_at)
       VALUES (?, ?, 'off_limits', 'Layoffs', 'Avoid the layoffs topic', ?, 'manual', ?)`,
      [uid(), owner, NOW, NOW],
    );

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

    // Off Limits → Avoid group, never Add-to-AI, never Message Focus.
    const avoid = items.find((item) => item.isOffLimits);
    expect(avoid).toMatchObject({
      group: "Avoid",
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
    // No current-state, Basics, Key People, custom, or Avoid groups materialize.
    expect(items.some((item) => item.group === "Avoid")).toBe(false);
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

    // A superseded (is_current = 0) and a current (is_current = 1) entry for one key.
    await exec.runAsync(
      `INSERT INTO current_state_entries
         (uid, contact_id, field_key, value, is_current, created_at, modified_at)
       VALUES (?, ?, 'current_location', 'Old town', 0, ?, ?)`,
      [uid(), owner, NOW, NOW],
    );
    await exec.runAsync(
      `INSERT INTO current_state_entries
         (uid, contact_id, field_key, value, is_current, created_at, modified_at)
       VALUES (?, ?, 'current_location', 'New city', 1, ?, ?)`,
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
    const location = items.find((item) => item.id === "current:current_location");
    expect(location?.value).toBe("New city");
    expect(items.some((item) => item.value === "Old town")).toBe(false);
  });
});
