import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  CANDIDATE_BUDGET,
  readLine3Candidates,
} from "@/db/dashboard-knowledge-read";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { MEMORY_TYPE_REGISTRY } from "@/db/memory-registry";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-06 12:00:00";
let exec: SqlExecutor;
let uidCounter = 0;

beforeEach(async () => {
  uidCounter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => `migration-${++uidCounter}`,
  });
});

async function seedContact(name = "Alex"): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [`contact-${++uidCounter}`, name, 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function seedMemory(
  contactId: number,
  options: Partial<{
    type: string;
    value: string;
    meaningfulDate: string | null;
    pinned: number;
    outdated: number;
    hidden: number | null;
    deletedAt: string | null;
    createdAt: string;
  }> = {},
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO memories (
       uid, contact_id, type, value, meaningful_date, pinned, outdated, hidden,
       provenance, created_at, modified_at, deleted_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `memory-${++uidCounter}`,
      contactId,
      options.type ?? "general",
      options.value ?? "Visible memory",
      options.meaningfulDate ?? null,
      options.pinned ?? 0,
      options.outdated ?? 0,
      options.hidden ?? null,
      "user",
      options.createdAt ?? NOW,
      NOW,
      options.deletedAt ?? null,
    ],
  );
  return result.lastInsertRowId;
}

async function seedRelationship(
  contactId: number,
  options: Partial<{
    personName: string;
    relationType: string | null;
    pinned: number;
    hidden: number | null;
    deletedAt: string | null;
    createdAt: string;
  }> = {},
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO relationships (
       uid, contact_id, person_name, relation_type, pinned, hidden,
       created_at, modified_at, deleted_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `relationship-${++uidCounter}`,
      contactId,
      options.personName ?? "Visible relationship",
      options.relationType ?? "friend",
      options.pinned ?? 0,
      options.hidden ?? null,
      options.createdAt ?? NOW,
      NOW,
      options.deletedAt ?? null,
    ],
  );
  return result.lastInsertRowId;
}

async function seedCurrentState(
  contactId: number,
  value: string,
  options: Partial<{
    fieldKey: string;
    entryDate: string;
    createdAt: string;
  }> = {},
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO current_state_entries (
       uid, contact_id, field_key, value, entry_date, created_at, modified_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      `state-${++uidCounter}`,
      contactId,
      options.fieldKey ?? `field-${uidCounter}`,
      value,
      options.entryDate ?? NOW.slice(0, 10),
      options.createdAt ?? NOW,
      NOW,
    ],
  );
  return result.lastInsertRowId;
}

describe("dashboard line-3 knowledge read", () => {
  it("reads each source once, binds contact ids, and preserves the display candidate shape", async () => {
    const contactId = await seedContact();
    const memoryId = await seedMemory(contactId, {
      value: "Climbing Sundays",
      meaningfulDate: "2026-09-08",
      pinned: 1,
    });
    const relationshipId = await seedRelationship(contactId, {
      personName: "Sam",
    });
    const stateId = await seedCurrentState(contactId, "Austin");
    const seen: Array<{ sql: string; params: readonly unknown[] }> = [];
    const countingExec: SqlExecutor = {
      ...exec,
      getAllAsync: async <T>(sql: string, params?: unknown[]) => {
        seen.push({ sql, params: params ?? [] });
        return exec.getAllAsync<T>(sql, params);
      },
    };

    const candidates = await readLine3Candidates(countingExec, [contactId]);

    expect(seen).toHaveLength(3);
    expect(seen.every(({ sql }) => sql.includes("contact_id IN (?)"))).toBe(
      true,
    );
    expect(seen.every(({ sql }) => !sql.includes("IN (1)"))).toBe(true);
    expect(seen.every(({ params }) => params.includes(contactId))).toBe(true);
    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "memory",
          contactId,
          id: memoryId,
          createdAt: NOW,
          value: "Climbing Sundays",
          type: "general",
          pinned: true,
          meaningfulDate: "2026-09-08",
        }),
        expect.objectContaining({
          kind: "relationship",
          contactId,
          id: relationshipId,
          value: "Sam",
          type: "friend",
          pinned: false,
          meaningfulDate: null,
        }),
        expect.objectContaining({
          kind: "current-state",
          contactId,
          id: stateId,
          value: "Austin",
          pinned: false,
          meaningfulDate: null,
        }),
      ]),
    );
  });

  it("filters each source by its own lifecycle rules, and shows hidden rows while Hide from Profile is off (D-134)", async () => {
    const contactId = await seedContact();
    const visibleMemory = await seedMemory(contactId, {
      value: "Visible memory",
      hidden: 0,
    });
    const hiddenMemory = await seedMemory(contactId, {
      value: "Hidden memory",
      hidden: 1,
    });
    await seedMemory(contactId, { value: "Outdated memory", outdated: 1 });
    await seedMemory(contactId, { value: "Deleted memory", deletedAt: NOW });
    await seedMemory(contactId, { type: "birthday", value: "Birthday memory" });
    const originalDefault =
      MEMORY_TYPE_REGISTRY.thought_of_them.visibilityDefault;
    MEMORY_TYPE_REGISTRY.thought_of_them.visibilityDefault = "hide";
    try {
      const registryHidden = await seedMemory(contactId, {
        type: "thought_of_them",
        value: "Registry hidden default",
      });
      const visibleRelationship = await seedRelationship(contactId, {
        personName: "Visible relationship",
        hidden: 0,
      });
      const hiddenRelationship = await seedRelationship(contactId, {
        personName: "Hidden relationship",
        hidden: 1,
      });
      await seedRelationship(contactId, {
        personName: "Deleted relationship",
        deletedAt: NOW,
      });
      // Same field: the older-dated entry is not Most Recent, even though it
      // was added later (D-45, D-51).
      const currentState = await seedCurrentState(contactId, "Current place", {
        fieldKey: "current_location",
        entryDate: "2026-09-05",
        createdAt: "2026-09-05 12:00:00",
      });
      await seedCurrentState(contactId, "Former place", {
        fieldKey: "current_location",
        entryDate: "2026-08-01",
      });

      const candidates = await readLine3Candidates(exec, [contactId]);
      expect(candidates.map((candidate) => candidate.id)).toEqual(
        expect.arrayContaining([
          visibleMemory,
          visibleRelationship,
          currentState,
          // The stored flag and a registry hide default are ignored for
          // display while Hide from Profile is off (D-134).
          hiddenMemory,
          registryHidden,
          hiddenRelationship,
        ]),
      );
      const values = candidates.map((candidate) => candidate.value);
      for (const excluded of [
        "Outdated memory",
        "Deleted memory",
        "Birthday memory",
        "Deleted relationship",
        "Former place",
      ]) {
        expect(values, excluded).not.toContain(excluded);
      }
    } finally {
      MEMORY_TYPE_REGISTRY.thought_of_them.visibilityDefault = originalDefault;
    }
  });

  it("D-94: leaves out Gift Ideas and includes Thought of Them, shares included", async () => {
    const contactId = await seedContact();
    await seedMemory(contactId, { type: "gift_idea", value: "Pottery class" });
    const thought = await exec.runAsync(
      `INSERT INTO memories (
         uid, contact_id, type, value, provenance, created_at, modified_at
       ) VALUES ('shared-thought', ?, 'thought_of_them', 'Saw their band poster', 'share', ?, ?)`,
      [contactId, NOW, NOW],
    );
    const general = await seedMemory(contactId, { value: "Likes tea" });
    await exec.runAsync(
      `INSERT INTO off_limits (uid, contact_id, text, created_at, modified_at)
       VALUES ('ol-1', ?, 'Avoid the divorce', ?, ?)`,
      [contactId, NOW, NOW],
    );

    const candidates = await readLine3Candidates(exec, [contactId]);
    const memoryIds = candidates
      .filter((candidate) => candidate.kind === "memory")
      .map((candidate) => candidate.id)
      .sort((a, b) => a - b);
    expect(memoryIds).toEqual(
      [thought.lastInsertRowId, general].sort((a, b) => a - b),
    );
    expect(candidates.map((candidate) => candidate.value)).not.toContain(
      "Pottery class",
    );
    expect(candidates.map((candidate) => candidate.value)).not.toContain(
      "Avoid the divorce",
    );
  });

  it("shows each field's Most Recent entry by entry date", async () => {
    const contactId = await seedContact();
    await seedCurrentState(contactId, "Older topic", {
      fieldKey: "last_talked_about",
      entryDate: "2026-08-20",
      createdAt: "2026-09-06 11:00:00",
    });
    const newest = await seedCurrentState(contactId, "Newest topic", {
      fieldKey: "last_talked_about",
      entryDate: "2026-09-02",
      createdAt: "2026-09-02 09:00:00",
    });
    const location = await seedCurrentState(contactId, "Porto", {
      fieldKey: "current_location",
    });

    const states = (await readLine3Candidates(exec, [contactId])).filter(
      (candidate) => candidate.kind === "current-state",
    );
    expect(states.map((candidate) => candidate.id).sort()).toEqual(
      [newest, location].sort(),
    );
  });

  it("bounds candidates per contact without letting deep history starve another contact", async () => {
    const deepContact = await seedContact("Deep");
    const otherContact = await seedContact("Other");
    for (let index = 0; index < CANDIDATE_BUDGET + 6; index += 1) {
      await seedMemory(deepContact, {
        value: `Deep ${index}`,
        createdAt: `2026-09-06 12:${String(index).padStart(2, "0")}:00`,
      });
    }
    await seedMemory(otherContact, { value: "Other contact survives" });

    const candidates = await readLine3Candidates(exec, [
      deepContact,
      otherContact,
    ]);
    expect(
      candidates.filter((candidate) => candidate.contactId === deepContact),
    ).toHaveLength(CANDIDATE_BUDGET);
    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contactId: otherContact,
          value: "Other contact survives",
        }),
      ]),
    );
  });

  it("ignores a registry hide default while Hide from Profile is off, so those rows fill the contact budget (D-134)", async () => {
    const contactId = await seedContact();
    const originalDefault =
      MEMORY_TYPE_REGISTRY.thought_of_them.visibilityDefault;
    MEMORY_TYPE_REGISTRY.thought_of_them.visibilityDefault = "hide";
    try {
      for (let index = 0; index < CANDIDATE_BUDGET + 2; index += 1) {
        await seedMemory(contactId, {
          type: "thought_of_them",
          value: `Hidden default ${index}`,
          createdAt: `2026-09-06 13:${String(index).padStart(2, "0")}:00`,
        });
      }
      await seedMemory(contactId, {
        value: "Visible after hidden defaults",
        createdAt: "2026-09-06 12:00:00",
      });

      const candidates = await readLine3Candidates(exec, [contactId]);
      const own = candidates.filter(
        (candidate) => candidate.contactId === contactId,
      );
      // The newest rows win the budget; none is dropped as hidden.
      expect(own).toHaveLength(CANDIDATE_BUDGET);
      expect(
        own.every((candidate) => candidate.value?.startsWith("Hidden default")),
      ).toBe(true);
    } finally {
      MEMORY_TYPE_REGISTRY.thought_of_them.visibilityDefault = originalDefault;
    }
  });

  it("returns no candidates and issues no query for an empty contact list", async () => {
    const getAllAsync = vi.fn();
    const countingExec: SqlExecutor = {
      ...exec,
      getAllAsync: async <T>(sql: string, params?: unknown[]) => {
        getAllAsync(sql, params);
        return exec.getAllAsync<T>(sql, params);
      },
    };
    await expect(readLine3Candidates(countingExec, [])).resolves.toEqual([]);
    expect(getAllAsync).not.toHaveBeenCalled();
  });
});
