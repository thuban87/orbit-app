import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { addSystemOverride, createCustomSystem } from "@/db/systems-dao";
import { readOrrerySystemMembersCore } from "@/db/orrery-system-read";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { resolveCustomSystemMembers } from "@/logic/system-rule-resolver";

const NOW = "2026-09-08 12:00:00";
let exec: SqlExecutor;
let sequence = 0;

beforeEach(async () => {
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => `migration-${++sequence}`,
  });
});

async function addContact(input: { uid: string; lastContact: string | null }): Promise<number> {
  const row = await exec.runAsync(
    "INSERT INTO contacts (uid, name, interval_days, tracking_enabled, last_contact, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [input.uid, input.uid, 14, 1, input.lastContact, NOW, NOW],
  );
  return row.lastInsertRowId;
}

describe("manual-only custom System resolver", () => {
  it("returns eligible inclusions minus exclusions through the read pipeline", async () => {
    const system = await createCustomSystem(exec, { name: "Manual", now: NOW });
    const included = await addContact({ uid: "included", lastContact: "2026-09-01" });
    const excluded = await addContact({ uid: "excluded", lastContact: "2026-09-01" });
    const ineligible = await addContact({ uid: "ineligible", lastContact: null });
    const ref = { kind: "custom" as const, uid: system.uid };
    for (const [contactId, mode] of [
      [included, "include"],
      [excluded, "include"],
      [excluded, "exclude"],
      [ineligible, "include"],
    ] as const)
      await addSystemOverride(exec, {
        systemRef: `custom:${system.uid}`,
        contactId,
        mode,
        now: NOW,
      });

    const resolved = await resolveCustomSystemMembers(exec, ref);
    expect(resolved).toEqual({
      memberIds: [included],
      candidateIds: [],
      brokenRules: [],
      prunableExclusionContactIds: [],
    });
    expect(await readOrrerySystemMembersCore(exec, ref)).toMatchObject({
      status: "ready",
      members: [{ id: included }],
      brokenRules: [],
    });
  });

  it("distinguishes a missing custom System from a valid empty one", async () => {
    const missing = { kind: "custom" as const, uid: "not-present" };
    expect(await readOrrerySystemMembersCore(exec, missing)).toEqual({
      status: "missing-custom",
      system: missing,
      members: [],
    });
    const system = await createCustomSystem(exec, { name: "Empty", now: NOW });
    expect(await readOrrerySystemMembersCore(exec, { kind: "custom", uid: system.uid })).toMatchObject({
      status: "ready",
      members: [],
      brokenRules: [],
    });
  });
});
