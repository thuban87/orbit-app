import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import { readOrrerySystemMembersCore } from "@/db/orrery-system-read";
import { addSystemOverride, createCustomSystem } from "@/db/systems-dao";
import type { SqlExecutor } from "@/db/types";
import {
  FAVORITE_RULE_VALUE,
  mapRulesToFilters,
  NOT_CONTACTED_RULE_VALUE,
  resolveCandidateIds,
  resolveCustomSystemMembers,
  SCOPE_POPULATION_FAMILY,
  SCOPE_POPULATION_VALUE,
  SNOOZED_RULE_VALUE,
} from "@/logic/system-rule-resolver";
import { loadOrreryScene } from "@/services/orrery-scene";
import { createOrrerySystemStore } from "@/stores/orrery-system-store";

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

async function addContact(input: {
  uid: string;
  lastContact: string | null;
}): Promise<number> {
  const row = await exec.runAsync(
    "INSERT INTO contacts (uid, name, interval_days, tracking_enabled, last_contact, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [input.uid, input.uid, 14, 1, input.lastContact, NOW, NOW],
  );
  return row.lastInsertRowId;
}

describe("manual-only custom System resolver", () => {
  it("returns eligible inclusions minus exclusions through the read pipeline", async () => {
    const system = await createCustomSystem(exec, { name: "Manual", now: NOW });
    const included = await addContact({
      uid: "included",
      lastContact: "2026-09-01",
    });
    const excluded = await addContact({
      uid: "excluded",
      lastContact: "2026-09-01",
    });
    const ineligible = await addContact({
      uid: "ineligible",
      lastContact: null,
    });
    const ref = { kind: "custom" as const, uid: system.uid };
    for (const [contactId, mode] of [
      [included, "include"],
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

    const store = createOrrerySystemStore({
      load: (selected, generation) =>
        loadOrreryScene(exec, generation, selected),
      persist: async () => true,
    });
    await store.getState().select(ref, system.name);
    expect(store.getState().status).toBe("ready");
    expect(store.getState().current()?.system).toEqual(ref);
  });

  it("distinguishes a missing custom System from a valid empty one", async () => {
    const missing = { kind: "custom" as const, uid: "not-present" };
    expect(await readOrrerySystemMembersCore(exec, missing)).toEqual({
      status: "missing-custom",
      system: missing,
      members: [],
    });
    const system = await createCustomSystem(exec, { name: "Empty", now: NOW });
    expect(
      await readOrrerySystemMembersCore(exec, {
        kind: "custom",
        uid: system.uid,
      }),
    ).toMatchObject({
      status: "ready",
      members: [],
      brokenRules: [],
    });
  });
});

describe("stored System rule mapping", () => {
  it("maps valid category rules and preserves distinct broken rule identities", async () => {
    await exec.runAsync(
      "INSERT INTO categories(uid,name,display_order,created_at,modified_at) VALUES ('friends','Friends',0,?,?)",
      [NOW, NOW],
    );
    const mapped = await mapRulesToFilters(exec, [
      { uid: "rule-good", family: "category", value: "friends" },
      { uid: "rule-missing-a", family: "category", value: "gone" },
      { uid: "rule-missing-b", family: "category", value: "gone" },
      { uid: "rule-battery", family: "social-battery", value: "invalid" },
      { uid: "rule-favorite", family: "favorite", value: "bad" },
      { uid: "rule-scope", family: "scope", value: "bad" },
    ]);
    expect(mapped.filters.category).toHaveLength(1);
    expect(mapped.filters.category?.[0]).toMatch(/^\d+$/);
    expect(mapped.broken).toEqual([
      {
        ruleUid: "rule-missing-a",
        family: "category",
        value: "gone",
        reason: "missing-category",
      },
      {
        ruleUid: "rule-missing-b",
        family: "category",
        value: "gone",
        reason: "missing-category",
      },
      {
        ruleUid: "rule-battery",
        family: "social-battery",
        value: "invalid",
        reason: "invalid-value",
      },
      {
        ruleUid: "rule-favorite",
        family: "favorite",
        value: "bad",
        reason: "invalid-value",
      },
      {
        ruleUid: "rule-scope",
        family: "scope",
        value: "bad",
        reason: "invalid-value",
      },
    ]);
  });

  it("only accepts exported closed boolean and population sentinels", async () => {
    const mapped = await mapRulesToFilters(exec, [
      { uid: "favorite", family: "favorite", value: FAVORITE_RULE_VALUE },
      {
        uid: "not-contacted",
        family: "not-contacted",
        value: NOT_CONTACTED_RULE_VALUE,
      },
      { uid: "snoozed", family: "snoozed", value: SNOOZED_RULE_VALUE },
      {
        uid: "scope",
        family: SCOPE_POPULATION_FAMILY,
        value: SCOPE_POPULATION_VALUE,
      },
    ]);
    expect(mapped).toMatchObject({
      favorite: true,
      notContacted: true,
      snoozed: true,
      populationScope: true,
      broken: [],
    });
  });
});

describe("System candidate resolution", () => {
  it("uses explicit scope, canonical boolean fragments, stable order, and a post-query Gravity pass", async () => {
    const activeFavorite = await addContact({ uid: "active-favorite", lastContact: "2026-09-01" });
    const neverFavorite = await addContact({ uid: "never-favorite", lastContact: null });
    const activePlain = await addContact({ uid: "active-plain", lastContact: "2026-09-01" });
    await exec.runAsync("UPDATE contacts SET favourite_rank=0, ring_seq=3 WHERE id=?", [activeFavorite]);
    await exec.runAsync("UPDATE contacts SET favourite_rank=0, ring_seq=1 WHERE id=?", [neverFavorite]);
    await exec.runAsync("UPDATE contacts SET ring_seq=2 WHERE id=?", [activePlain]);

    const favorites = await mapRulesToFilters(exec, [
      { uid: "favorite", family: "favorite", value: FAVORITE_RULE_VALUE },
    ]);
    expect(await resolveCandidateIds(exec, favorites, NOW, async () => null)).toEqual([activeFavorite]);

    const all = await mapRulesToFilters(exec, [
      { uid: "scope", family: SCOPE_POPULATION_FAMILY, value: SCOPE_POPULATION_VALUE },
    ]);
    expect(await resolveCandidateIds(exec, all, NOW, async () => null)).toEqual([neverFavorite, activePlain, activeFavorite]);

    const deep = await mapRulesToFilters(exec, [
      { uid: "gravity", family: "gravity", value: "deep" },
    ]);
    expect(
      await resolveCandidateIds(exec, deep, NOW, async (id) =>
        id === activePlain
          ? { trackingEnabled: 1, intervalDays: 14, rarelyResponds: 0, interactions: Array.from({ length: 20 }, () => ({ occurredAt: NOW, connected: 1, direction: "outbound" })) }
          : { trackingEnabled: 1, intervalDays: 14, rarelyResponds: 0, interactions: [] },
      ),
    ).toEqual([activePlain]);
  });
});
