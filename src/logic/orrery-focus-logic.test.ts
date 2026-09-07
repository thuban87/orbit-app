import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import { withMutex } from "@/db/mutex";
import { readOrreryContactTargetValidation } from "@/db/orrery-action-read";
import { readOrrerySystemSnapshot } from "@/db/orrery-system-read";
import { HOME_CAMERA, projectFrame } from "./orrery-camera-logic";
import {
  createOrreryFocusController,
  focusEffectivelyOffscreen,
  type OrreryContactTarget,
  reconcileFocus,
  resolveOrreryTap,
  validateOrreryContactTarget,
} from "./orrery-focus-logic";
import {
  ALL_CONTACTS_SYSTEM,
  BUILTIN_SYSTEMS,
  type OrrerySystemRef,
} from "./orrery-system-logic";

vi.mock("expo-sqlite", () => ({}));
let db: ReturnType<typeof openTestDb>;
let exec: ReturnType<typeof nodeSqliteExecutor>;
let seq = 0;
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
async function person(never = false): Promise<OrreryContactTarget> {
  const uid = `person-${++seq}`;
  const row = await exec.runAsync(
    "INSERT INTO contacts(uid,name,interval_days,tracking_enabled,last_contact,created_at,modified_at) VALUES (?,'Alex',10,1,CASE WHEN ? THEN NULL ELSE date('now','localtime','-8 days') END,'x','x')",
    [uid, never ? 1 : 0],
  );
  return { kind: "member", id: row.lastInsertRowId, uid };
}
const deferred = () => {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
};

describe("fresh narrow contact actions", () => {
  it("keeps probes narrow at large size and reflects favorites, category rename/deletion and sun reassignment immediately", async () => {
    const target = await person();
    for (let i = 0; i < 120; i++) await person();
    const system: OrrerySystemRef = { kind: "builtin", id: "favorites" };
    const first = vi.spyOn(exec, "getFirstAsync");
    const commands = vi.spyOn(exec, "execAsync");
    expect(
      (await readOrreryContactTargetValidation(exec, system, target)).isMember,
    ).toBe(false);
    expect(first).toHaveBeenCalledTimes(2);
    expect(commands.mock.calls.map(([sql]) => sql)).toEqual([
      "BEGIN",
      "COMMIT",
    ]);
    first.mockRestore();
    commands.mockRestore();
    await exec.runAsync("UPDATE contacts SET favourite_rank=0 WHERE id=?", [
      target.id,
    ]);
    expect(
      (await readOrreryContactTargetValidation(exec, system, target)).isMember,
    ).toBe(true);
    await exec.runAsync(
      "INSERT INTO categories(uid,name,display_order,created_at,modified_at) VALUES ('stable-category','Before',0,'x','x')",
    );
    await exec.runAsync(
      "UPDATE contacts SET category_id=(SELECT id FROM categories WHERE uid='stable-category') WHERE id=?",
      [target.id],
    );
    const category: OrrerySystemRef = {
      kind: "category",
      uid: "stable-category",
    };
    await exec.runAsync(
      "UPDATE categories SET name='After' WHERE uid='stable-category'",
    );
    expect(
      (await readOrreryContactTargetValidation(exec, category, target))
        .isMember,
    ).toBe(true);
    await exec.runAsync("DELETE FROM categories WHERE uid='stable-category'");
    expect(
      (await readOrreryContactTargetValidation(exec, category, target)).status,
    ).toBe("missing-category");
    await exec.runAsync("UPDATE app_settings SET sun_contact_id=?", [
      target.id,
    ]);
    const sun = { ...target, kind: "contact-sun" as const };
    expect(
      validateOrreryContactTarget(
        sun,
        await readOrreryContactTargetValidation(exec, system, sun),
      ),
    ).toBe(true);
    await exec.runAsync("UPDATE app_settings SET sun_contact_id=NULL");
    expect(
      validateOrreryContactTarget(
        sun,
        await readOrreryContactTargetValidation(exec, system, sun),
      ),
    ).toBe(false);
    expect(() =>
      readOrreryContactTargetValidation(
        exec,
        { kind: "builtin", id: "invalid" } as never,
        target,
      ),
    ).toThrow();
  });
  it("matches every System snapshot and global sun with two/three SELECTs, no broad history", async () => {
    const sun = await person();
    const member = await person();
    const neutral = await person(true);
    await exec.runAsync("UPDATE app_settings SET sun_contact_id=?", [sun.id]);
    await exec.runAsync(
      "UPDATE contacts SET favourite_rank=0,social_battery='Charger',snooze_until=date('now','localtime','+1 day') WHERE id=?",
      [member.id],
    );
    await exec.runAsync(
      "INSERT INTO categories(uid,name,display_order,created_at,modified_at) VALUES ('cat','Same',0,'x','x')",
    );
    await exec.runAsync(
      "UPDATE contacts SET category_id=(SELECT id FROM categories WHERE uid='cat') WHERE id=?",
      [member.id],
    );
    const systems: OrrerySystemRef[] = [
      ...BUILTIN_SYSTEMS.map((s) => s.ref),
      { kind: "category", uid: "cat" },
    ];
    for (const system of systems) {
      const snapshot = await readOrrerySystemSnapshot(exec, system);
      for (const target of [sun, member, neutral]) {
        const read = vi.spyOn(exec, "getFirstAsync");
        const all = vi.spyOn(exec, "getAllAsync");
        const result = await readOrreryContactTargetValidation(
          exec,
          system,
          target,
        );
        expect(result.isMember).toBe(
          snapshot.members.some((m) => m.id === target.id),
        );
        expect(result.resolvedSunIdentity).toEqual(
          snapshot.resolvedSunIdentity,
        );
        expect(
          read.mock.calls.length + all.mock.calls.length,
        ).toBeLessThanOrEqual(3);
        expect(read.mock.calls.map(([sql]) => sql).join(" ")).not.toMatch(
          /interactions|gravity|ORDER BY/i,
        );
        read.mockRestore();
        all.mockRestore();
      }
    }
  });
  it("rejects removed membership, category and reused identities, but preserves current nonmember sun", async () => {
    const member = await person();
    const sun = { ...member, kind: "contact-sun" as const };
    const system: OrrerySystemRef = { kind: "builtin", id: "favorites" };
    await exec.runAsync("UPDATE app_settings SET sun_contact_id=?", [sun.id]);
    const probe = () => readOrreryContactTargetValidation(exec, system, sun);
    expect(validateOrreryContactTarget(member, await probe())).toBe(false);
    expect(validateOrreryContactTarget(sun, await probe())).toBe(true);
    for (const change of [
      "archived_at='x'",
      "archived_at=NULL,tracking_enabled=0",
      "tracking_enabled=1,uid='replacement'",
    ]) {
      await exec.runAsync(`UPDATE contacts SET ${change} WHERE id=?`, [sun.id]);
      expect(validateOrreryContactTarget(sun, await probe())).toBe(false);
    }
    const missing = await readOrreryContactTargetValidation(
      exec,
      { kind: "category", uid: "gone" },
      sun,
    );
    expect(missing.status).toBe("missing-category");
    expect(validateOrreryContactTarget(sun, missing)).toBe(false);
  });
  for (const reason of [
    "superseded",
    "clear",
    "outside",
    "recenter",
    "system",
    "blur",
    "background",
    "dispose",
  ] as const)
    it(`cancels a production SQL probe queued behind the mutex on ${reason}`, async () => {
      const target = await person();
      const gate = deferred();
      const holder = withMutex(() => gate.promise);
      const focus = vi.fn();
      const openProfile = vi.fn();
      const controller = createOrreryFocusController({
        current: () => ({ generation: 1, system: ALL_CONTACTS_SYSTEM }),
        validate: (system, item) =>
          readOrreryContactTargetValidation(exec, system, item),
        focus,
        group: vi.fn(),
        clear: vi.fn(),
        openProfile,
        reject: vi.fn(),
      });
      const pending = controller.dispatch({
        kind: "profile",
        generation: 1,
        ids: [target.id],
        targets: [target],
      });
      controller.cancel(reason);
      gate.release();
      await holder;
      await pending;
      expect(focus).not.toHaveBeenCalled();
      expect(openProfile).not.toHaveBeenCalled();
    });
  it("waits for fresh validation, dispatches once, and a rejected holder does not poison the chain", async () => {
    const target = await person();
    const gate = deferred();
    const holder = withMutex(async () => {
      await gate.promise;
      throw new Error("holder");
    }).catch(() => {});
    const openProfile = vi.fn();
    const controller = createOrreryFocusController({
      current: () => ({ generation: 1, system: ALL_CONTACTS_SYSTEM }),
      validate: (system, item) =>
        readOrreryContactTargetValidation(exec, system, item),
      focus: vi.fn(),
      group: vi.fn(),
      clear: vi.fn(),
      openProfile,
      reject: vi.fn(),
    });
    const intent = {
      kind: "profile" as const,
      generation: 1,
      ids: [target.id],
      targets: [target],
    };
    const pending = controller.dispatch(intent);
    expect(openProfile).not.toHaveBeenCalled();
    gate.release();
    await holder;
    await pending;
    expect(openProfile).toHaveBeenCalledOnce();
  });
});

it("resolves inclusive overlaps without depth winners, deduplicates roles and requires visible names for Profile", () => {
  const a: OrreryContactTarget = { kind: "member", id: 1, uid: "a" };
  const sun: OrreryContactTarget = { kind: "contact-sun", id: 2, uid: "b" };
  const frame = projectFrame(
    [
      { id: 1, kind: "contact", x: 0, y: 0, radius: 10, ringRadius: 0 },
      { id: 2, kind: "sun", x: 44, y: 0, radius: 10, ringRadius: 0 },
    ],
    HOME_CAMERA,
    { width: 400, height: 600 },
    1,
  );
  const intent = resolveOrreryTap(frame, 222, 300, [a, sun], [], [a]);
  expect(intent.targets).toEqual([a, sun]);
  expect(intent.kind).toBe("group");
  expect(resolveOrreryTap(frame, 200, 300, [a, sun], [], [a]).kind).toBe(
    "focus",
  );
  expect(
    resolveOrreryTap(frame, 200, 300, [a, sun], ["contact:1"], [a]).kind,
  ).toBe("profile");
  expect(resolveOrreryTap(frame, 0, 0, [a, sun], [], [a]).kind).toBe("clear");
  expect(reconcileFocus(a, [a], null)).toEqual(a);
  expect(reconcileFocus(a, [{ ...a, uid: "reused" }], null)).toBeNull();
  expect(focusEffectivelyOffscreen(frame, 1)).toBe(false);
  frame.bodies[0].x = -66;
  expect(focusEffectivelyOffscreen(frame, 1)).toBe(false);
  frame.bodies[0].x = -66.01;
  expect(focusEffectivelyOffscreen(frame, 1)).toBe(true);
});
