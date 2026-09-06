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
  isCurrent: number,
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO current_state_entries (
       uid, contact_id, field_key, value, is_current, created_at, modified_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      `state-${++uidCounter}`,
      contactId,
      `field-${uidCounter}`,
      value,
      isCurrent,
      NOW,
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
    const relationshipId = await seedRelationship(contactId, { personName: "Sam" });
    const stateId = await seedCurrentState(contactId, "Austin", 1);
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
    expect(seen.every(({ sql }) => sql.includes("contact_id IN (?)"))).toBe(true);
    expect(seen.every(({ sql }) => !sql.includes(String(contactId)))).toBe(true);
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

  it("filters each source by its own visibility and lifecycle rules", async () => {
    const contactId = await seedContact();
    const visibleMemory = await seedMemory(contactId, { value: "Visible memory", hidden: 0 });
    await seedMemory(contactId, { value: "Hidden memory", hidden: 1 });
    await seedMemory(contactId, { value: "Outdated memory", outdated: 1 });
    await seedMemory(contactId, { value: "Deleted memory", deletedAt: NOW });
    await seedMemory(contactId, { type: "birthday", value: "Birthday memory" });
    const originalDefault = MEMORY_TYPE_REGISTRY.custom.visibilityDefault;
    MEMORY_TYPE_REGISTRY.custom.visibilityDefault = "hide";
    try {
      await seedMemory(contactId, { type: "custom", value: "Registry hidden default" });
      const visibleRelationship = await seedRelationship(contactId, {
        personName: "Visible relationship",
        hidden: 0,
      });
      await seedRelationship(contactId, { personName: "Hidden relationship", hidden: 1 });
      await seedRelationship(contactId, { personName: "Deleted relationship", deletedAt: NOW });
      const currentState = await seedCurrentState(contactId, "Current place", 1);
      await seedCurrentState(contactId, "Former place", 0);

      const candidates = await readLine3Candidates(exec, [contactId]);
      expect(candidates.map((candidate) => candidate.id)).toEqual(
        expect.arrayContaining([visibleMemory, visibleRelationship, currentState]),
      );
      expect(candidates.map((candidate) => candidate.value)).not.toEqual(
        expect.arrayContaining([
          "Hidden memory",
          "Outdated memory",
          "Deleted memory",
          "Birthday memory",
          "Registry hidden default",
          "Hidden relationship",
          "Deleted relationship",
          "Former place",
        ]),
      );
    } finally {
      MEMORY_TYPE_REGISTRY.custom.visibilityDefault = originalDefault;
    }
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

    const candidates = await readLine3Candidates(exec, [deepContact, otherContact]);
    expect(candidates.filter((candidate) => candidate.contactId === deepContact)).toHaveLength(
      CANDIDATE_BUDGET,
    );
    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ contactId: otherContact, value: "Other contact survives" }),
      ]),
    );
  });

  it("over-fetches before registry visibility filtering so hidden defaults cannot consume a contact budget", async () => {
    const contactId = await seedContact();
    const originalDefault = MEMORY_TYPE_REGISTRY.custom.visibilityDefault;
    MEMORY_TYPE_REGISTRY.custom.visibilityDefault = "hide";
    try {
      for (let index = 0; index < CANDIDATE_BUDGET + 2; index += 1) {
        await seedMemory(contactId, {
          type: "custom",
          value: `Hidden default ${index}`,
          createdAt: `2026-09-06 13:${String(index).padStart(2, "0")}:00`,
        });
      }
      await seedMemory(contactId, {
        value: "Visible after hidden defaults",
        createdAt: "2026-09-06 12:00:00",
      });

      const candidates = await readLine3Candidates(exec, [contactId]);
      expect(candidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ value: "Visible after hidden defaults" }),
        ]),
      );
      expect(candidates.filter((candidate) => candidate.contactId === contactId)).toHaveLength(1);
    } finally {
      MEMORY_TYPE_REGISTRY.custom.visibilityDefault = originalDefault;
    }
  });

  it("returns no candidates and issues no query for an empty contact list", async () => {
    const getAllAsync = vi.fn(exec.getAllAsync.bind(exec));
    const countingExec: SqlExecutor = { ...exec, getAllAsync };
    await expect(readLine3Candidates(countingExec, [])).resolves.toEqual([]);
    expect(getAllAsync).not.toHaveBeenCalled();
  });
});
