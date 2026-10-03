import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import { withMutex } from "@/db/mutex";
import { readOrreryContactTargetValidation } from "@/db/orrery-action-read";
import { readOrrerySystemSnapshot } from "@/db/orrery-system-read";
import {
  createCustomSystem,
  setSystemOverride,
  setSystemRules,
} from "@/db/systems-dao";
import {
  HOME_CAMERA,
  MAX_ZOOM,
  projectFrame,
  tapIntent,
} from "./orrery-camera-logic";
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
    await exec.runAsync("UPDATE contacts SET category_id=NULL WHERE id=?", [
      target.id,
    ]);
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
  it("resolves manual, rule-derived, and historically broken custom members for profile, group, and sun actions", async () => {
    const manual = await person();
    const derived = await person();
    const excludedSun = await person();
    const custom = await createCustomSystem(exec, {
      name: "Action System",
      now: "2026-09-01",
    });
    const system: OrrerySystemRef = { kind: "custom", uid: custom.uid };
    await exec.runAsync("UPDATE contacts SET favourite_rank=0 WHERE id=?", [
      derived.id,
    ]);
    await setSystemRules(exec, {
      systemRef: `custom:${custom.uid}`,
      rules: [{ family: "favorite", value: "on" }],
      now: "2026-09-01",
    });
    await setSystemOverride(exec, {
      systemRef: `custom:${custom.uid}`,
      contactId: manual.id,
      mode: "include",
      now: "2026-09-01",
    });
    // Old malformed rows remain observable broken rules, but never prevent
    // the current valid rule and override from resolving.
    await exec.runAsync(
      "INSERT INTO system_rules(uid,system_id,family,value,created_at) VALUES ('historic',?,?,?,'x')",
      [custom.id, "retired-family", "legacy"],
    );
    await exec.runAsync("UPDATE app_settings SET sun_contact_id=?", [
      excludedSun.id,
    ]);

    expect(
      validateOrreryContactTarget(
        manual,
        await readOrreryContactTargetValidation(exec, system, manual),
      ),
    ).toBe(true);
    expect(
      validateOrreryContactTarget(
        derived,
        await readOrreryContactTargetValidation(exec, system, derived),
      ),
    ).toBe(true);
    expect(
      validateOrreryContactTarget(
        excludedSun,
        await readOrreryContactTargetValidation(exec, system, excludedSun),
      ),
    ).toBe(false);
    const sun = { ...excludedSun, kind: "contact-sun" as const };
    expect(
      validateOrreryContactTarget(
        sun,
        await readOrreryContactTargetValidation(exec, system, sun),
      ),
    ).toBe(true);

    const openProfile = vi.fn();
    const group = vi.fn();
    const controller = createOrreryFocusController({
      current: () => ({ generation: 1, system }),
      validate: (ref, target) =>
        readOrreryContactTargetValidation(exec, ref, target),
      focus: vi.fn(),
      group,
      clear: vi.fn(),
      openProfile,
      reject: vi.fn(),
    });
    await controller.dispatch({
      kind: "profile",
      generation: 1,
      ids: [manual.id],
      targets: [manual],
    });
    await controller.dispatch({
      kind: "group",
      generation: 1,
      ids: [manual.id, derived.id],
      targets: [manual, derived],
    });
    await controller.dispatch({
      kind: "profile",
      generation: 1,
      ids: [sun.id],
      targets: [sun],
    });
    expect(openProfile).toHaveBeenNthCalledWith(1, manual.id);
    expect(openProfile).toHaveBeenNthCalledWith(2, sun.id);
    expect(group).toHaveBeenCalledWith([manual, derived]);
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

it("resolves inclusive overlaps without depth winners, deduplicates roles, and a single body tap always focuses (D-60)", () => {
  const a: OrreryContactTarget = { kind: "member", id: 1, uid: "a" };
  const sun: OrreryContactTarget = { kind: "contact-sun", id: 2, uid: "b" };
  const frame = projectFrame(
    [
      { id: 1, kind: "contact", x: 0, y: 0, radius: 10, ringRadius: 0 },
      { id: 2, kind: "sun", x: 44, y: 0, radius: 10, ringRadius: 0 },
    ],
    // A flat Home fixture: screen coordinates are world + the usable centre.
    { ...HOME_CAMERA, tilt: 0, lensShift: 1 },
    { width: 400, height: 600 },
    1,
  );
  const intent = resolveOrreryTap(frame, 222, 300, [a, sun], [a]);
  expect(intent.targets).toEqual([a, sun]);
  expect(intent.kind).toBe("group");
  expect(resolveOrreryTap(frame, 200, 300, [a, sun], [a]).kind).toBe("focus");
  expect(resolveOrreryTap(frame, 0, 0, [a, sun], [a]).kind).toBe("clear");
  expect(reconcileFocus(a, [a], null)).toEqual(a);
  expect(reconcileFocus(a, [{ ...a, uid: "reused" }], null)).toBeNull();
  expect(focusEffectivelyOffscreen(frame, 1)).toBe(false);
  frame.bodies[0].x = -66;
  expect(focusEffectivelyOffscreen(frame, 1)).toBe(false);
  frame.bodies[0].x = -66.01;
  expect(focusEffectivelyOffscreen(frame, 1)).toBe(true);
});

describe("D-60: no body tap ever yields Profile", () => {
  const a: OrreryContactTarget = { kind: "member", id: 1, uid: "a" };
  const b: OrreryContactTarget = { kind: "member", id: 2, uid: "b" };
  const world = [
    { id: 0, kind: "sun" as const, x: 0, y: 0, radius: 30, ringRadius: 0 },
    {
      id: 1,
      kind: "contact" as const,
      x: 0,
      y: -40,
      radius: 16,
      ringRadius: 40,
    },
    {
      id: 2,
      kind: "contact" as const,
      x: 50,
      y: 0,
      radius: 16,
      ringRadius: 50,
    },
  ];
  const viewport = { width: 412, height: 780 };
  it.each([
    [0, 1],
    [0, 2],
    [0, MAX_ZOOM],
    [HOME_CAMERA.tilt ?? 0, 1],
    [HOME_CAMERA.tilt ?? 0, MAX_ZOOM],
  ])(
    "tilt %s, zoom %s: a single target is focus at any magnification",
    (tilt, zoom) => {
      const frame = projectFrame(
        world,
        { ...HOME_CAMERA, tilt, zoom },
        viewport,
        9,
      );
      const body = frame.bodies[1];
      expect(body.culled).toBe(false);
      const intent = resolveOrreryTap(frame, body.x, body.y, [a, b], [a, b]);
      expect(intent).toMatchObject({
        kind: "focus",
        ids: [1],
        targets: [a],
        generation: 9,
      });
      // tapIntent (the fallback when no resolver is supplied) agrees.
      expect(tapIntent(frame, body.x, body.y, true).kind).toBe("focus");
    },
  );
  it("a body with no current identity is never a target; group and clear are unchanged", () => {
    const frame = projectFrame(
      world,
      { ...HOME_CAMERA, tilt: 0, lensShift: 1 },
      viewport,
      4,
    );
    const body = frame.bodies[1];
    // The identity list no longer holds the drawn body's id (a removed row);
    // stale UIDs are rejected by the controller's validation (integration).
    expect(resolveOrreryTap(frame, body.x, body.y, [b], [a, b])).toMatchObject({
      kind: "clear",
      ids: [],
      generation: 4,
    });
    const overlap = {
      ...frame,
      bodies: frame.bodies.map((row) => ({ ...row, x: body.x, y: body.y })),
    };
    expect(resolveOrreryTap(overlap, body.x, body.y, [a, b], [a, b]).kind).toBe(
      "group",
    );
    expect(resolveOrreryTap(frame, 1, 1, [a, b], [a, b]).kind).toBe("clear");
    // A culled (beyond the horizon) body is never a target.
    const culled = {
      ...frame,
      bodies: frame.bodies.map((row) =>
        row.id === 1 ? { ...row, culled: true, interactive: false } : row,
      ),
    };
    expect(resolveOrreryTap(culled, body.x, body.y, [a, b], [a, b]).kind).toBe(
      "clear",
    );
  });
});
