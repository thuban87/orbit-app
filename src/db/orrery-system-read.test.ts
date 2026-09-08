import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import { listOrbitingContacts } from "@/db/orrery-read";
import {
  readOrrerySystemMembersCore,
  readOrrerySystemSnapshot,
} from "@/db/orrery-system-read";
import { addSystemOverride } from "@/db/systems-dao";
import { inWriteTransaction } from "@/db/transaction";
import {
  buildOrrerySystemWhere,
  parseSystemRef,
} from "@/logic/orrery-system-logic";
import { loadOrreryScene } from "@/services/orrery-scene";

vi.mock("expo-sqlite", () => ({}));
let db: ReturnType<typeof openTestDb>;
let exec: ReturnType<typeof nodeSqliteExecutor>;
let seq = 0;
const ref = (id: string) => parseSystemRef(id)!;
const ids = (rows: { id: number }[]) => rows.map((row) => row.id);
beforeEach(async () => {
  db = openTestDb();
  exec = nodeSqliteExecutor(db);
  seq = 0;
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: "2026-09-01",
    newUid: () => `uid-${++seq}`,
    defaultPhoneRegion: "US",
  });
});
afterEach(() => db.close());
async function person(
  p: {
    contacted?: boolean;
    bound?: boolean;
    archived?: boolean;
    favorite?: boolean;
    days?: number;
    snooze?: number;
    category?: number;
    ring?: number;
  } = {},
) {
  const uid = `contact-${++seq}`;
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid,name,interval_days,tracking_enabled,last_contact,archived_at,favourite_rank,social_battery,snooze_until,category_id,ring_seq,created_at,modified_at)
    VALUES (?, 'Alex', 10, ?, CASE WHEN ? THEN date('now','localtime',?) ELSE NULL END, ?, ?, 'Charger', CASE WHEN ? IS NULL THEN NULL ELSE date('now','localtime',?) END, ?, ?, '2026-01-01','2026-01-01')`,
    [
      uid,
      p.bound === false ? 0 : 1,
      p.contacted === false ? 0 : 1,
      `-${p.days ?? 8} days`,
      p.archived ? "2026-01-02" : null,
      p.favorite ? 0 : null,
      p.snooze ?? null,
      `${p.snooze ?? 0} days`,
      p.category ?? null,
      p.ring ?? null,
    ],
  );
  return { id: result.lastInsertRowId, uid };
}

describe("explicit Orrery System membership", () => {
  it("layers built-in overrides onto base members and reselects full included rows", async () => {
    const favorite = await person({ favorite: true, ring: 2 });
    const added = await person({ ring: 1 });
    await exec.runAsync(
      "UPDATE contacts SET name='Manual add', photo='file://photo' WHERE id=?",
      [added.id],
    );
    await addSystemOverride(exec, {
      systemRef: "builtin:favorites",
      contactId: added.id,
      mode: "include",
      now: "2026-09-01",
    });
    await addSystemOverride(exec, {
      systemRef: "builtin:favorites",
      contactId: favorite.id,
      mode: "exclude",
      now: "2026-09-01",
    });
    const result = await readOrrerySystemMembersCore(
      exec,
      ref("builtin:favorites"),
    );
    expect(result.members).toEqual([
      expect.objectContaining({
        id: added.id,
        name: "Manual add",
        photo: "file://photo",
        ring_seq: 1,
      }),
    ]);
  });
  it("crosses contacted/never × Bound/Unbound × live/archived without widening the default reader", async () => {
    let live!: { id: number; uid: string };
    let neutral!: typeof live;
    for (const contacted of [true, false])
      for (const bound of [true, false])
        for (const archived of [false, true]) {
          const row = await person({
            contacted,
            bound,
            archived,
            favorite: true,
          });
          if (bound && !archived) {
            if (contacted) live = row;
            else neutral = row;
          }
        }
    const all = await readOrrerySystemMembersCore(
      exec,
      ref("builtin:all-contacts"),
    );
    expect(ids(all.members)).toEqual([live.id, neutral.id]);
    expect(all.members[1]).toMatchObject({
      progress: null,
      status: null,
      last_contact: null,
    });
    expect(ids(await listOrbitingContacts(exec))).toEqual([live.id]);
    for (const name of ["favorites", "needs-attention", "chargers"])
      expect(
        ids(
          (await readOrrerySystemMembersCore(exec, ref(`builtin:${name}`)))
            .members,
        ),
      ).toEqual([live.id]);
    expect(
      ids(
        (await readOrrerySystemMembersCore(exec, ref("builtin:not-contacted")))
          .members,
      ),
    ).toEqual([neutral.id]);
  });
  it("shares exact current threshold and local-day snooze semantics inside an open write transaction", async () => {
    await person({ days: 7 });
    const due = await person({ days: 8, snooze: 0 });
    const snoozed = await person({ days: 8, snooze: 1 });
    for (const [name, expected] of [
      ["needs-attention", [due.id]],
      ["snoozed", [snoozed.id]],
    ] as const) {
      const system = ref(`builtin:${name}`);
      const snapshot = await readOrrerySystemSnapshot(exec, system);
      const core = await inWriteTransaction(exec, () =>
        readOrrerySystemMembersCore(exec, system),
      );
      expect(ids(core.members)).toEqual(expected);
      expect(snapshot.eligibleContactedVisibleIds).toEqual(expected);
    }
  });
  it("uses category UID identity, preserves duplicate names, and distinguishes removed from empty", async () => {
    await exec.runAsync(
      "INSERT INTO categories(uid,name,display_order,created_at,modified_at) VALUES ('cat-z','Same',-1,'x','x'),('cat-a','Same',-1,'x','x')",
    );
    const category = await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM categories WHERE uid='cat-z'",
    );
    const member = await person({ category: category!.id });
    await person({ category: category!.id, contacted: false });
    const snapshot = await readOrrerySystemSnapshot(
      exec,
      ref("category:cat-z"),
    );
    expect(ids(snapshot.members)).toEqual([member.id]);
    expect(snapshot.categories.slice(0, 2).map((row) => row.uid)).toEqual([
      "cat-a",
      "cat-z",
    ]);
    expect(
      (await readOrrerySystemMembersCore(exec, ref("category:cat-a"))).status,
    ).toBe("ready");
    expect(
      (await readOrrerySystemMembersCore(exec, ref("category:absent"))).status,
    ).toBe("missing-category");
    const hostile = "category:x')OR(1)--";
    const predicate = buildOrrerySystemWhere(ref(hostile));
    expect(predicate.sql).not.toContain("x')OR");
    expect(predicate.params).toEqual(["x')OR(1)--"]);
    expect((await readOrrerySystemMembersCore(exec, ref(hostile))).status).toBe(
      "missing-category",
    );
    expect(parseSystemRef("builtin:unknown")).toBeNull();
    expect(parseSystemRef("category:")).toBeNull();
  });
  it("partitions qualifying sun once and retains nonmember global identity plus complete reorder fingerprints", async () => {
    const sun = await person({ ring: 5 });
    const favorite = await person({ favorite: true, ring: 2 });
    const neutral = await person({ contacted: false, ring: 1 });
    await exec.runAsync("UPDATE app_settings SET sun_contact_id=?", [sun.id]);
    const all = await readOrrerySystemSnapshot(
      exec,
      ref("builtin:all-contacts"),
    );
    expect(ids(all.members)).toEqual([neutral.id, favorite.id, sun.id]);
    expect(ids(all.orbiting)).toEqual([neutral.id, favorite.id]);
    expect(all.resolvedSunIdentity).toEqual(sun);
    expect(all.completeContactedOrder).toEqual([favorite.id]);
    expect(all.contactIdentities).toEqual([favorite, sun]);
    const favorites = await readOrrerySystemSnapshot(
      exec,
      ref("builtin:favorites"),
    );
    expect(ids(favorites.members)).toEqual([favorite.id]);
    expect(favorites.resolvedSunIdentity).toEqual(sun);
    expect(favorites.savedSunContactId).toBe(sun.id);
    expect(
      (await readOrrerySystemSnapshot(exec, ref("builtin:not-contacted")))
        .eligibleContactedVisibleIds,
    ).toEqual([]);
    const scene = await loadOrreryScene(exec, 1);
    expect(scene.world.filter((row) => row.id === sun.id)).toHaveLength(1);
    const body = scene.world.find((row) => row.id === neutral.id)!;
    expect(body.x).toBe(0);
    expect(body.y).toBe(-body.ringRadius);
    expect(
      scene.contacts.find((row) => row.id === neutral.id)?.progress,
    ).toBeNull();
  });
  it("keeps saved-sun identity on archived fallback, and returns genuine zero and sun-only member sets", async () => {
    const sun = await person();
    await exec.runAsync("UPDATE app_settings SET sun_contact_id=?", [sun.id]);
    const only = await readOrrerySystemSnapshot(
      exec,
      ref("builtin:all-contacts"),
    );
    expect(ids(only.members)).toEqual([sun.id]);
    expect(only.orbiting).toEqual([]);
    await exec.runAsync("UPDATE contacts SET archived_at='today' WHERE id=?", [
      sun.id,
    ]);
    const empty = await readOrrerySystemSnapshot(
      exec,
      ref("builtin:all-contacts"),
    );
    expect(empty.members).toEqual([]);
    expect(empty.resolvedSunIdentity).toBeNull();
    expect(empty.contactIdentities).toEqual([sun]);
  });
});
