import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import {
  mergeDroppedLines,
  mergeImpactLines,
} from "@/components/merge-impact-lines";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  createPendingAssist,
  markAssistLogged,
} from "@/db/interaction-assist-dao";
import { mergeContacts } from "@/db/merge-dao";
import {
  readMergeDroppedItems,
  readMergeImpactCounts,
} from "@/db/merge-impact-read";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-10-13 12:00:00";
let exec: SqlExecutor;
let n = 0;
const uid = () => `uid-${++n}`;

beforeEach(async () => {
  n = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
  });
});

async function contact(name: string): Promise<number> {
  const row = await exec.runAsync(
    "INSERT INTO contacts (uid, name, tracking_enabled, created_at, modified_at) VALUES (?, ?, 0, ?, ?)",
    [uid(), name, NOW, NOW],
  );
  return row.lastInsertRowId;
}

describe("readMergeImpactCounts", () => {
  it("counts the absorbed contact's interactions, events, methods and external links only", async () => {
    const absorbed = await contact("Absorbed");
    const other = await contact("Other");
    for (const owner of [absorbed, absorbed, other]) {
      await exec.runAsync(
        "INSERT INTO interactions (uid, contact_id, occurred_at, recorded_at, source, modified_at) VALUES (?, ?, ?, ?, 'manual', ?)",
        [uid(), owner, NOW, NOW, NOW],
      );
    }
    await exec.runAsync(
      "INSERT INTO events (uid, contact_id, type, occurred_at, recorded_at, modified_at) VALUES (?, ?, 'birthday', ?, ?, ?)",
      [uid(), absorbed, NOW, NOW, NOW],
    );
    for (const [order, value] of [
      "+15550000001",
      "+15550000002",
      "+15550000003",
    ].entries()) {
      await exec.runAsync(
        `INSERT INTO contact_methods
           (uid, contact_id, method_type, raw_value, display_value, canonical_value,
            is_actionable, is_primary, display_order, created_at, modified_at)
         VALUES (?, ?, 'phone', ?, ?, ?, 1, 0, ?, ?, ?)`,
        [uid(), absorbed, value, value, value, order, NOW, NOW],
      );
    }
    for (const [externalId, active] of [
      ["a-1", 1],
      ["a-2", 0],
    ] as const) {
      await exec.runAsync(
        "INSERT INTO external_contact_links (uid, contact_id, provider, external_contact_id, is_active, created_at, modified_at) VALUES (?, ?, 'android', ?, ?, ?, ?)",
        [uid(), absorbed, externalId, active, NOW, NOW],
      );
    }
    expect(await readMergeImpactCounts(exec, absorbed)).toMatchObject({
      interactions: 2,
      events: 1,
      methods: 3,
      // A retired link does not move anything the person would see (B-WR-09).
      externalLinks: 1,
    });
  });

  it("returns zeros for a contact that owns nothing", async () => {
    const bare = await contact("Bare");
    expect(await readMergeImpactCounts(exec, bare)).toEqual({
      interactions: 0,
      events: 0,
      methods: 0,
      externalLinks: 0,
      memories: 0,
      keyPeople: 0,
      currentState: 0,
      offLimits: 0,
      customValues: 0,
      links: 0,
      pendingAssists: 0,
    });
  });
});

/**
 * 38.12 D-44: the summary counts every child table mergeContacts reparents
 * (merge-dao.ts reparent list): interactions, events, off_limits,
 * custom_field_values, contact_links, contact_methods, external_contact_links,
 * interaction_assists, memories, relationships, current_state_entries.
 */
describe("readMergeImpactCounts — every moved table (D-44)", () => {
  it("counts memories, Key People, current state, Off Limits, custom values, links and pending assists", async () => {
    const absorbed = await contact("Absorbed");
    const other = await contact("Other");
    for (const owner of [absorbed, absorbed, other]) {
      await exec.runAsync(
        `INSERT INTO memories (uid, contact_id, type, created_at, modified_at)
         VALUES (?, ?, 'general', ?, ?)`,
        [uid(), owner, NOW, NOW],
      );
    }
    await exec.runAsync(
      `INSERT INTO relationships (uid, contact_id, person_name, created_at, modified_at)
       VALUES (?, ?, 'Sam', ?, ?)`,
      [uid(), absorbed, NOW, NOW],
    );
    await exec.runAsync(
      `INSERT INTO current_state_entries
         (uid, contact_id, field_key, value, entry_date, created_at, modified_at)
       VALUES (?, ?, 'city', 'Lisbon', '2026-08-20', ?, ?)`,
      [uid(), absorbed, NOW, NOW],
    );
    await exec.runAsync(
      "INSERT INTO off_limits (uid, contact_id, text, created_at, modified_at) VALUES (?, ?, 'Topic', ?, ?)",
      [uid(), absorbed, NOW, NOW],
    );
    for (const [order, text] of ["Tuesday", "42", "hello", "  "].entries()) {
      const def = await exec.runAsync(
        "INSERT INTO custom_field_defs (uid, col_name, label, type, display_order, created_at, modified_at) VALUES (?, ?, ?, 'text', ?, ?, ?)",
        [uid(), `f${order}`, `F${order}`, order, NOW, NOW],
      );
      await exec.runAsync(
        "INSERT INTO custom_field_values (uid, contact_id, field_def_id, value, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?)",
        [uid(), absorbed, def.lastInsertRowId, text, NOW, NOW],
      );
    }
    await exec.runAsync(
      "INSERT INTO contact_links (uid, contact_id, url, display_order, created_at, modified_at) VALUES (?, ?, 'https://example.com', 0, ?, ?)",
      [uid(), absorbed, NOW, NOW],
    );
    await createPendingAssist(exec, {
      contactId: absorbed,
      channel: "call",
      endpointValue: "+15551234567",
      now: NOW,
    });
    // A resolved assist is history (its interaction is already counted).
    const logged = await createPendingAssist(exec, {
      contactId: absorbed,
      channel: "text",
      endpointValue: "+15551234567",
      now: NOW,
    });
    await markAssistLogged(exec, { assistUid: logged, connected: 1, now: NOW });

    expect(await readMergeImpactCounts(exec, absorbed)).toMatchObject({
      memories: 2,
      keyPeople: 1,
      currentState: 1,
      offLimits: 1,
      // A blank value moves nothing worth listing.
      customValues: 3,
      links: 1,
      pendingAssists: 1,
    });
  });

  it("has a count for every table in mergeContacts' reparent list", async () => {
    const { readFileSync } = await import("node:fs");
    const dao = readFileSync("src/db/merge-dao.ts", "utf8");
    const list = dao.match(/for \(const table of \[([\s\S]*?)\] as const\)/);
    expect(list).not.toBeNull();
    const tables = [...(list?.[1] ?? "").matchAll(/"([a-z_]+)"/g)].map(
      (match) => match[1],
    );
    const read = readFileSync("src/db/merge-impact-read.ts", "utf8");
    for (const table of tables)
      expect(read, table).toMatch(new RegExp(`FROM ${table} WHERE`));
    expect(tables).toHaveLength(11);
  });
});

describe("mergeImpactLines (D-44)", () => {
  const zero = {
    interactions: 0,
    events: 0,
    methods: 0,
    externalLinks: 0,
    memories: 0,
    keyPeople: 0,
    currentState: 0,
    offLimits: 0,
    customValues: 0,
    links: 0,
    pendingAssists: 0,
  };

  it("renders one plural line per non-zero count, singular for one", () => {
    expect(
      mergeImpactLines({
        ...zero,
        interactions: 3,
        memories: 2,
        keyPeople: 1,
        currentState: 1,
        offLimits: 2,
        customValues: 3,
        links: 1,
        pendingAssists: 1,
      }),
    ).toEqual([
      "3 interactions",
      "2 memories",
      "1 Key Person",
      "1 Last Talked About or Current Location entry",
      "2 Off Limits items",
      "3 custom field values",
      "1 link",
      "1 pending confirmation",
    ]);
  });

  it("keeps the existing lines and lists nothing for a contact that owns nothing", () => {
    expect(
      mergeImpactLines({
        ...zero,
        interactions: 1,
        events: 2,
        methods: 1,
        externalLinks: 2,
      }),
    ).toEqual([
      "1 interaction",
      "2 events",
      "1 contact method",
      "2 external links",
    ]);
    expect(mergeImpactLines(zero)).toEqual([]);
  });
});

describe("D-146: the survivor's Profile look and Orrery choices win; the absorbed's are listed (review B-WR-08)", () => {
  async function presentation(contactId: number) {
    await exec.runAsync(
      `INSERT INTO profile_contact_presentation
         (contact_id, freeform_layout_json, created_at, modified_at)
       VALUES (?, '{"version":1}', ?, ?)`,
      [contactId, NOW, NOW],
    );
  }
  async function override(contactId: number, ref: string, mode: string) {
    await exec.runAsync(
      `INSERT INTO system_overrides (uid, system_ref, contact_id, mode, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [uid(), ref, contactId, mode, NOW],
    );
  }

  it("lists the absorbed person's own layout and Orrery choices", async () => {
    const absorbed = await contact("Absorbed");
    expect(await readMergeDroppedItems(exec, absorbed)).toEqual({
      profilePresentation: false,
      orrerySystemChoices: 0,
    });
    await presentation(absorbed);
    await override(absorbed, "user:1", "include");
    await override(absorbed, "user:2", "exclude");
    const dropped = await readMergeDroppedItems(exec, absorbed);
    expect(dropped).toEqual({
      profilePresentation: true,
      orrerySystemChoices: 2,
    });
    expect(mergeDroppedLines(dropped)).toEqual([
      "Profile layout and background",
      "2 Orrery system choices",
    ]);
    expect(
      mergeDroppedLines({ profilePresentation: false, orrerySystemChoices: 0 }),
    ).toEqual([]);
  });

  it("the merge keeps the survivor's rows and drops the absorbed person's", async () => {
    const survivor = await contact("Survivor");
    const absorbed = await contact("Absorbed");
    await presentation(survivor);
    await presentation(absorbed);
    await override(survivor, "user:1", "exclude");
    await override(absorbed, "user:1", "include");
    await override(absorbed, "user:2", "include");
    await mergeContacts(exec, {
      survivorId: survivor,
      absorbedId: absorbed,
      now: NOW,
    });
    expect(
      await exec.getAllAsync(
        "SELECT contact_id FROM profile_contact_presentation ORDER BY contact_id",
      ),
    ).toEqual([{ contact_id: survivor }]);
    expect(
      await exec.getAllAsync(
        "SELECT system_ref, contact_id, mode FROM system_overrides ORDER BY id",
      ),
    ).toEqual([
      { system_ref: "user:1", contact_id: survivor, mode: "exclude" },
    ]);
  });
});

describe("readMergeImpactCounts with the survivor counts only what moves (review B-WR-09)", () => {
  async function phone(contactId: number, value: string) {
    await exec.runAsync(
      `INSERT INTO contact_methods
         (uid, contact_id, method_type, raw_value, display_value, canonical_value,
          is_actionable, is_primary, display_order, created_at, modified_at)
       VALUES (?, ?, 'phone', ?, ?, ?, 1, 0, 0, ?, ?)`,
      [uid(), contactId, value, value, value, NOW, NOW],
    );
  }
  async function value(contactId: number, defId: number, text: string) {
    await exec.runAsync(
      "INSERT INTO custom_field_values (uid, contact_id, field_def_id, value, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?)",
      [uid(), contactId, defId, text, NOW, NOW],
    );
  }
  async function def(name: string): Promise<number> {
    return (
      await exec.runAsync(
        "INSERT INTO custom_field_defs (uid, col_name, label, type, display_order, created_at, modified_at) VALUES (?, ?, ?, 'text', 0, ?, ?)",
        [uid(), name, name, NOW, NOW],
      )
    ).lastInsertRowId;
  }

  it("leaves out duplicate methods and custom values the survivor keeps", async () => {
    const survivor = await contact("Survivor");
    const absorbed = await contact("Absorbed");
    await phone(survivor, "+15550000001");
    await phone(absorbed, "+15550000001");
    await phone(absorbed, "+15550000002");
    const shared = await def("shared");
    const chosen = await def("chosen");
    const blankOwn = await def("blank_own");
    const onlyAbsorbed = await def("only_absorbed");
    await value(survivor, shared, "mine");
    await value(absorbed, shared, "theirs");
    await value(survivor, chosen, "mine");
    await value(absorbed, chosen, "theirs");
    await value(survivor, blankOwn, " ");
    await value(absorbed, blankOwn, "theirs");
    await value(absorbed, onlyAbsorbed, "theirs");
    const counts = await readMergeImpactCounts(exec, absorbed, {
      survivorId: survivor,
      resolutions: { customFields: { [chosen]: "absorbed" } },
    });
    expect(counts.methods).toBe(1);
    // chosen + blank_own + only_absorbed; shared keeps the survivor's.
    expect(counts.customValues).toBe(3);
    // Without the survivor the raw counts stay.
    expect((await readMergeImpactCounts(exec, absorbed)).methods).toBe(2);
  });
});
