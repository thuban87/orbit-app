/**
 * Orrery perf fixture, end to end (38.7 Plan 01, D-56): the seed writes the
 * spec through the real DAO Core writers into a FULLY migrated node-sqlite
 * database; the Orrery's own member read resolves every Size System; the
 * fixture is idempotent without trusting a name; an altered fixture reports
 * `partial` and writes nothing; re-anchoring, the photo restore and the C-M5
 * preference/ring-order restore each bring verification back to `ok`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { getAppSettings, updateAppSettings } from "@/db/app-settings-dao";
import { setContactPhoto, setContactPhotoCore } from "@/db/contacts-dao";
import { localDateTime, MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import { listOrbitingContacts } from "@/db/orrery-read";
import { readOrrerySystemMembersCore } from "@/db/orrery-system-read";
import { deleteTouchpoint } from "@/db/recency-dao";
import { commitRingReorder } from "@/db/ring-seq-dao";
import {
  createCustomSystem,
  listCustomSystems,
  setSystemOverride,
} from "@/db/systems-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { ALL_CONTACTS_SYSTEM } from "@/logic/orrery-system-logic";
import {
  reanchorOrreryPerfFixture,
  restoreOrreryPerfFixturePhotos,
  restoreOrreryPerfFixturePreferences,
  seedOrreryPerfFixture,
  verifyOrreryPerfFixture,
} from "./orrery-seed";
import {
  buildOrrerySeedPlan,
  SIZE_SYSTEM_SIZES,
  STRESS_SYSTEM_NAME,
} from "./orrery-seed-spec";

vi.mock("expo-sqlite", () => ({}));

const NOW = new Date(2026, 8, 20, 12, 0, 0);
const plan = buildOrrerySeedPlan();
const photoMembers = [...plan.cast, ...plan.stress].filter((m) => m.photo);

let db: ReturnType<typeof openTestDb>;
let exec: SqlExecutor;
let seq = 0;

beforeEach(async () => {
  db = openTestDb();
  exec = nodeSqliteExecutor(db);
  seq = 0;
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: localDateTime(NOW),
    newUid: () => `mig-${++seq}`,
    defaultPhoneRegion: "US",
  });
});
afterEach(() => db.close());

function fakeDeps(now: Date = NOW) {
  const calls: Array<[number, number]> = [];
  const logs: string[] = [];
  return {
    calls,
    logs,
    deps: {
      now: () => now,
      log: (message: string) => logs.push(message),
      async writePhoto(e: SqlExecutor, contactId: number, seed: number) {
        calls.push([contactId, seed]);
        await inWriteTransaction(e, () =>
          setContactPhotoCore(
            e,
            contactId,
            `avatars/contact-${contactId}.jpg`,
            localDateTime(now),
          ),
        );
      },
    },
  };
}

async function counts() {
  const one = async (table: string) =>
    (
      await exec.getFirstAsync<{ n: number }>(
        `SELECT COUNT(*) AS n FROM ${table}`,
      )
    )?.n;
  return {
    contacts: await one("contacts"),
    interactions: await one("interactions"),
    relationships: await one("relationships"),
    systems: await one("systems"),
    overrides: await one("system_overrides"),
  };
}

async function systemRef(name: string) {
  const system = (await listCustomSystems(exec)).find((s) => s.name === name);
  if (!system) throw new Error(`no System ${name}`);
  return { ref: { kind: "custom" as const, uid: system.uid }, system };
}

async function members(name: string) {
  const { ref } = await systemRef(name);
  return (await readOrrerySystemMembersCore(exec, ref)).members;
}

async function contactId(name: string): Promise<number> {
  const row = await exec.getFirstAsync<{ id: number }>(
    "SELECT id FROM contacts WHERE name = ?",
    [name],
  );
  if (!row) throw new Error(`no contact ${name}`);
  return row.id;
}

describe("seedOrreryPerfFixture", () => {
  it("creates the Size cast and the stress set through the real DAOs, end to end", async () => {
    const { deps, calls, logs } = fakeDeps();
    const result = await seedOrreryPerfFixture(exec, deps);
    expect(result).toMatchObject({
      cast: "created",
      stress: "created",
      offsetDays: 0,
      problems: [],
    });
    expect(result.allContacts).toBeGreaterThanOrEqual(1000);
    expect(
      (await readOrrerySystemMembersCore(exec, ALL_CONTACTS_SYSTEM)).members
        .length,
    ).toBe(result.allContacts);
    for (const size of SIZE_SYSTEM_SIZES) {
      const resolved = await members(`Size ${size}`);
      expect(resolved).toHaveLength(size);
      expect(new Set(resolved.map((m) => m.name))).toEqual(
        new Set(plan.cast.slice(0, size).map((m) => m.name)),
      );
    }
    expect(await members(STRESS_SYSTEM_NAME)).toHaveLength(plan.stress.length);
    // One photo write per photo member, with the spec's seed.
    expect(calls).toHaveLength(photoMembers.length);
    expect(new Set(calls.map(([, seed]) => seed))).toEqual(
      new Set(photoMembers.map((m) => m.photoSeed)),
    );
    // Status inputs land as specified (recency derived by the single writer).
    const luca = await exec.getFirstAsync<{
      interval_days: number;
      last_contact: string;
      rarely_responds: number;
    }>(
      "SELECT interval_days, last_contact, rarely_responds FROM contacts WHERE name = ?",
      ["Luca Lombardi"],
    );
    expect(luca).toEqual({
      interval_days: 90,
      last_contact: "2026-06-28 09:00:00",
      rarely_responds: 0,
    });
    expect(logs.at(-1)).toMatch(
      /^orrery-seed cast=created stress=created allContacts=\d+ spec=[0-9a-f]{12} offsetDays=0$/,
    );
    expect(await verifyOrreryPerfFixture(exec, NOW)).toMatchObject({
      ok: true,
      offsetDays: 0,
    });
  }, 60_000);

  it("is a no-op on a second run (present/present, no row count changes)", async () => {
    await seedOrreryPerfFixture(exec, fakeDeps().deps);
    const before = await counts();
    const second = fakeDeps();
    const result = await seedOrreryPerfFixture(exec, second.deps);
    expect(result).toMatchObject({
      cast: "present",
      stress: "present",
      problems: [],
    });
    expect(second.calls).toEqual([]);
    expect(await counts()).toEqual(before);
  }, 60_000);

  it("reports a Size System that lost a member as partial and writes nothing", async () => {
    await seedOrreryPerfFixture(exec, fakeDeps().deps);
    const { ref } = await systemRef("Size 32");
    const victim = plan.cast[31].name;
    await setSystemOverride(exec, {
      systemRef: `custom:${ref.uid}`,
      contactId: await contactId(victim),
      mode: null,
      now: localDateTime(NOW),
    });
    const before = await counts();
    const run = fakeDeps();
    const result = await seedOrreryPerfFixture(exec, run.deps);
    expect(result.cast).toBe("partial");
    expect(result.stress).toBe("present");
    expect(result.problems.join("\n")).toContain(
      `Size 32 is missing: ${victim}`,
    );
    expect(run.calls).toEqual([]);
    expect(await counts()).toEqual(before);
  }, 60_000);

  it("reports a stress contact that lost a touchpoint as partial", async () => {
    await seedOrreryPerfFixture(exec, fakeDeps().deps);
    const target = plan.stress.find((m) => m.history >= 1)!;
    const id = await contactId(target.name);
    const oldest = await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM interactions WHERE contact_id = ? ORDER BY occurred_at LIMIT 1",
      [id],
    );
    await deleteTouchpoint(exec, {
      interactionId: oldest!.id,
      contactId: id,
      now: localDateTime(NOW),
    });
    const before = await counts();
    const result = await seedOrreryPerfFixture(exec, fakeDeps().deps);
    expect(result.stress).toBe("partial");
    expect(result.cast).toBe("present");
    expect(result.problems.join("\n")).toContain(target.name);
    expect(await counts()).toEqual(before);
  }, 60_000);

  it("never reports present on a name marker alone", async () => {
    await createCustomSystem(exec, { name: "Size 5", now: localDateTime(NOW) });
    const before = await counts();
    const result = await seedOrreryPerfFixture(exec, fakeDeps().deps);
    expect(result.cast).toBe("partial");
    expect(result.stress).toBe("skipped");
    expect(result.problems.join("\n")).toContain("Size 5 is missing");
    expect(await counts()).toEqual(before);
  });

  it("reports seeded contacts without their marker System as partial", async () => {
    await seedOrreryPerfFixture(exec, fakeDeps().deps);
    const { system } = await systemRef("Size 5");
    db.prepare("DELETE FROM systems WHERE id = ?").run(system.id);
    const before = await counts();
    const result = await seedOrreryPerfFixture(exec, fakeDeps().deps);
    expect(result.cast).toBe("partial");
    expect(result.problems.join("\n")).toContain(
      'cast contacts exist without the "Size 5" System',
    );
    expect(await counts()).toEqual(before);
  }, 60_000);
});

describe("reanchorOrreryPerfFixture", () => {
  it("re-anchors an aged fixture to the requested offset through editTouchpointFullCore", async () => {
    await seedOrreryPerfFixture(exec, fakeDeps().deps);
    const later = new Date(2026, 8, 29, 12, 0, 0);
    expect(await verifyOrreryPerfFixture(exec, later)).toMatchObject({
      ok: true,
      offsetDays: 9,
    });
    const back = await reanchorOrreryPerfFixture(exec, fakeDeps(later).deps, {
      offsetDays: 0,
    });
    expect(back).toMatchObject({ ok: true, offsetDays: 0, problems: [] });
    const stale = await exec.getAllAsync<{ id: number }>(
      `SELECT c.id FROM contacts c
        WHERE c.last_contact IS NOT (SELECT MAX(i.occurred_at) FROM interactions i
                                      WHERE i.contact_id = c.id)`,
    );
    expect(stale).toEqual([]);
    expect(
      (
        await exec.getFirstAsync<{ last_contact: string }>(
          "SELECT last_contact FROM contacts WHERE name = ?",
          ["Luca Lombardi"],
        )
      )?.last_contact,
    ).toBe("2026-07-07 09:00:00");
    const three = await reanchorOrreryPerfFixture(exec, fakeDeps(later).deps, {
      offsetDays: 3,
    });
    expect(three).toMatchObject({ ok: true, offsetDays: 3 });
  }, 60_000);

  it("refuses an offset that would put touchpoints in the future", async () => {
    await seedOrreryPerfFixture(exec, fakeDeps().deps);
    await expect(
      reanchorOrreryPerfFixture(exec, fakeDeps().deps, { offsetDays: -5 }),
    ).rejects.toThrow(/whole number >= 0/);
  }, 60_000);
});

describe("restoreOrreryPerfFixturePhotos", () => {
  it("returns photo presence (and the spec photo path) to the spec", async () => {
    await seedOrreryPerfFixture(exec, fakeDeps().deps);
    const now = localDateTime(NOW);
    const replaced = plan.cast.filter((m) => m.photo).slice(0, 3);
    for (const member of replaced)
      await setContactPhoto(
        exec,
        await contactId(member.name),
        `avatars/portrait-${member.index}.jpg`,
        now,
      );
    const bare = plan.cast.find((m) => !m.photo)!;
    await setContactPhoto(
      exec,
      await contactId(bare.name),
      "avatars/portrait-extra.jpg",
      now,
    );
    const broken = await verifyOrreryPerfFixture(exec, NOW);
    expect(broken.ok).toBe(false);
    expect(broken.problems.join("\n")).toContain(bare.name);

    const run = fakeDeps();
    const restored = await restoreOrreryPerfFixturePhotos(exec, run.deps);
    expect(restored).toMatchObject({ ok: true, problems: [] });
    expect(run.calls).toHaveLength(photoMembers.length);
    for (const member of replaced) {
      const id = await contactId(member.name);
      expect(
        (
          await exec.getFirstAsync<{ photo: string }>(
            "SELECT photo FROM contacts WHERE id = ?",
            [id],
          )
        )?.photo,
      ).toBe(`avatars/contact-${id}.jpg`);
    }
    expect(
      (
        await exec.getFirstAsync<{ photo: string | null }>(
          "SELECT photo FROM contacts WHERE name = ?",
          [bare.name],
        )
      )?.photo,
    ).toBeNull();
  }, 60_000);
});

describe("Orrery preferences and ring order (C-M5)", () => {
  async function seededRingOrder(): Promise<string[]> {
    const names = new Set(
      [...plan.cast, ...plan.stress]
        .filter((m) => m.days !== null)
        .map((m) => m.name),
    );
    return (await listOrbitingContacts(exec))
      .map((row) => row.name)
      .filter((name) => names.has(name));
  }
  const specOrder = [...plan.cast, ...plan.stress]
    .filter((m) => m.days !== null)
    .map((m) => m.name);

  it("pins the preferences and the spec ring order, reports drift, and restores both", async () => {
    // A pre-existing orbiting contact on the phone keeps its place after the seeded ones.
    await exec.runAsync(
      `INSERT INTO contacts (uid, name, interval_days, tracking_enabled, last_contact, created_at, modified_at)
       VALUES ('pre-1', 'Phone Resident', 14, 1, '2026-09-10 10:00:00', '2026-01-01 00:00:00', '2026-01-01 00:00:00')`,
    );
    await seedOrreryPerfFixture(exec, fakeDeps().deps);
    const { system: size120 } = await systemRef("Size 120");
    expect(await getAppSettings(exec)).toMatchObject({
      orreryDensity: "balanced",
      orrerySatellitesEnabled: 1,
      orreryLastSystem: `custom:${size120.uid}`,
      sunContactId: null,
    });
    expect(await seededRingOrder()).toEqual(specOrder);
    const all = (await listOrbitingContacts(exec)).map((row) => row.name);
    expect(all.at(-1)).toBe("Phone Resident");

    // Drift: later debug passes toggle satellites, density, last System, and reorder.
    const now = localDateTime(NOW);
    await updateAppSettings(
      exec,
      {
        orreryDensity: "compact",
        orrerySatellitesEnabled: 0,
        orreryLastSystem: "builtin:all-contacts",
      },
      now,
    );
    const { ref: size20 } = await systemRef("Size 20");
    const full = (await listOrbitingContacts(exec)).map((row) => row.id);
    const eligible = (await readOrrerySystemMembersCore(exec, size20)).members
      .filter((row) => full.includes(row.id))
      .map((row) => row.id);
    const reordered = [...eligible];
    [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
    const identities = await exec.getAllAsync<{ id: number; uid: string }>(
      "SELECT id, uid FROM contacts WHERE last_contact IS NOT NULL AND archived_at IS NULL AND tracking_enabled = 1",
    );
    await commitRingReorder(
      exec,
      {
        system: size20,
        expectedFullOrderedIds: full,
        expectedSavedSunContactId: null,
        expectedEligibleVisibleIds: eligible,
        expectedContactIdentities: identities,
        reorderedVisibleIds: reordered,
      },
      now,
    );
    expect(await seededRingOrder()).not.toEqual(specOrder);

    const drifted = await verifyOrreryPerfFixture(exec, NOW);
    expect(drifted.ok).toBe(false);
    const report = drifted.parts.orrery.join("\n");
    expect(report).toContain("orrery_density compact");
    expect(report).toContain("orrery_satellites_enabled 0");
    expect(report).toContain('is not "Size 120"');
    expect(report).toContain("ring order differs");
    expect(drifted.parts.cast).toEqual([]);
    expect(drifted.parts.stress).toEqual([]);

    const restored = await restoreOrreryPerfFixturePreferences(
      exec,
      fakeDeps().deps,
    );
    expect(restored.problems).toEqual([]);
    expect(restored.rewroteRing).toBe(true);
    expect(await verifyOrreryPerfFixture(exec, NOW)).toMatchObject({
      ok: true,
      problems: [],
    });
    expect(await seededRingOrder()).toEqual(specOrder);
    expect(
      (await listOrbitingContacts(exec)).map((row) => row.name).at(-1),
    ).toBe("Phone Resident");
  }, 60_000);

  it("reports a sun that differs from the seed-time value and leaves it alone", async () => {
    await seedOrreryPerfFixture(exec, fakeDeps().deps);
    const sun = await contactId(plan.cast[0].name);
    await updateAppSettings(exec, { sunContactId: sun }, localDateTime(NOW));
    const result = await restoreOrreryPerfFixturePreferences(
      exec,
      fakeDeps().deps,
    );
    expect(result.problems.join("\n")).toContain("sun_contact_id");
    expect((await getAppSettings(exec)).sunContactId).toBe(sun);
  }, 60_000);
});
