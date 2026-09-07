import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildExportManifest } from "@/backup/export-manifest";
import { applyRestore } from "@/backup/restore-apply";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { openSqliteLocalDayFixture } from "@/db/__testkit__/sqlite-local-day";
import { getAppSettings, updateAppSettings } from "@/db/app-settings-dao";
import { bulkSetCategory } from "@/db/bulk-actions-dao";
import { bindContact, unbindContact } from "@/db/contact-lifecycle-dao";
import {
  archiveContact,
  createContactFull,
  restoreContact,
} from "@/db/contacts-dao";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { clearFavouriteRank, setFavouriteRank } from "@/db/favourites-dao";
import { mergeContacts } from "@/db/merge-dao";
import { runMigrations } from "@/db/migrations/runner";
import { withMutex } from "@/db/mutex";
import { readOrreryContactTargetValidation } from "@/db/orrery-action-read";
import { readOrrerySatellites } from "@/db/orrery-satellites-read";
import { setProfilePhoto } from "@/db/profile-dao";
import { purgeContact } from "@/db/purge-dao";
import { recordTouchpoint } from "@/db/recency-dao";
import {
  addRelationship,
  deleteRelationship,
  editRelationship,
  restoreRelationship,
} from "@/db/relationships-dao";
import { commitRingReorder, type RingReorderRequest } from "@/db/ring-seq-dao";
import { snoozeContact } from "@/db/snooze-dao";
import type { SqlExecutor } from "@/db/types";
import { HOME_CAMERA, projectFrame } from "@/logic/orrery-camera-logic";
import {
  createOrreryFocusController,
  type OrreryContactTarget,
  resolveOrreryTap,
} from "@/logic/orrery-focus-logic";
import {
  deriveSatelliteBodies,
  resolveSatelliteTap,
} from "@/logic/orrery-satellite-logic";
import { restoreOrrerySession } from "@/logic/orrery-session-logic";
import {
  ALL_CONTACTS_SYSTEM,
  type OrrerySystemRef,
  parseSystemRef,
  systemRefId,
} from "@/logic/orrery-system-logic";
import {
  loadOrreryScene,
  type OrrerySceneSnapshot,
} from "@/services/orrery-scene";
import { createOrrerySessionStore } from "@/stores/orrery-session-store";
import { createOrrerySystemStore } from "@/stores/orrery-system-store";

vi.mock("expo-sqlite", () => ({}));
vi.mock("@/services/notifications/notification-schedule", () => ({
  reconcileSchedule: async () => {},
}));
vi.mock("@/services/notifications/digest-schedule", () => ({
  reconcileDigestSchedule: async () => {},
}));
vi.mock("@/services/photos/photo-storage", () => ({}));

const NOW = "2026-09-07 12:00:00";
const LATER = "2026-09-08 12:00:00";
const viewport = { width: 400, height: 600 };
const system = (name: string) => parseSystemRef(`builtin:${name}`)!;
function deferred() {
  let release!: () => void;
  let released = false;
  const promise = new Promise<void>((resolve) => {
    release = () => {
      released = true;
      resolve();
    };
  });
  return {
    promise,
    release,
    get released() {
      return released;
    },
  };
}
async function migrate(exec: SqlExecutor) {
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: randomUUID,
  });
}
async function person(
  exec: SqlExecutor,
  name = "Zoë 👩🏽‍🚀 李",
  contacted = true,
) {
  const uid = randomUUID();
  const { contactId } = await createContactFull(exec, {
    uid,
    name,
    intervalDays: 10,
    now: NOW,
    ...(contacted
      ? {
          firstInteraction: {
            uid: randomUUID(),
            occurredAt: "2026-08-31 12:00:00",
          },
        }
      : {}),
  });
  return { id: contactId, uid };
}
function rankRequest(scene: OrrerySceneSnapshot): RingReorderRequest {
  const snapshot = scene.systemSnapshot;
  return {
    system: scene.system,
    expectedFullOrderedIds: snapshot.completeContactedOrder,
    expectedSavedSunContactId: snapshot.savedSunContactId,
    expectedEligibleVisibleIds: snapshot.eligibleContactedVisibleIds,
    expectedContactIdentities: snapshot.contactIdentities,
    reorderedVisibleIds: [...snapshot.eligibleContactedVisibleIds].reverse(),
  };
}
function focusHarness(
  exec: SqlExecutor,
  current: () => OrrerySceneSnapshot | null,
) {
  const io = {
    current,
    validate: (ref: OrrerySystemRef, target: OrreryContactTarget) =>
      readOrreryContactTargetValidation(exec, ref, target),
    focus: vi.fn(),
    group: vi.fn(),
    clear: vi.fn(),
    openProfile: vi.fn(),
    reject: vi.fn(),
  };
  return { ...io, controller: createOrreryFocusController(io) };
}
async function stored(exec: SqlExecutor) {
  return {
    contacts: await exec.getAllAsync("SELECT * FROM contacts ORDER BY id"),
    settings: await exec.getAllAsync("SELECT * FROM app_settings"),
    interactions: await exec.getAllAsync(
      "SELECT * FROM interactions ORDER BY id",
    ),
  };
}

describe("Orrery production exploration integration", () => {
  let db: ReturnType<typeof openTestDb>;
  let exec: SqlExecutor;
  beforeEach(async () => {
    db = openTestDb();
    exec = nodeSqliteExecutor(db);
    await migrate(exec);
  });
  afterEach(() => {
    db.close();
    vi.unstubAllGlobals();
  });

  it.each([true, false])(
    "photo snapshot holds queued scene/actions; cancellation=%s",
    async (cancel) => {
      // Sole photo-bearing row is production-written; entry must precede enqueue.
      const contact = await person(exec);
      await setProfilePhoto(exec, "avatars/profile.jpg", NOW);
      const scene = await loadOrreryScene(exec, 1);
      const before = await stored(exec);
      const entered = deferred(),
        releasePhoto = deferred();
      const readPhotoBase64 = vi.fn(async (_path: string) => {
        entered.release();
        await releasePhoto.promise;
        return "aGVsbG8=";
      });
      const exporting = buildExportManifest(exec, {
        exportedAt: NOW,
        readPhotoBase64,
      });
      const prematurelySettled = exporting.then(() => {
        throw new Error("Export settled before photo reader entry");
      });
      // Consume both branches even when the entry signal wins the race.
      void prematurelySettled.catch(() => {});
      const readQueries: string[] = [];
      const observed: SqlExecutor = {
        ...exec,
        getFirstAsync: (sql, params) => {
          readQueries.push(sql);
          return exec.getFirstAsync(sql, params);
        },
        getAllAsync: (sql, params) => {
          readQueries.push(sql);
          return exec.getAllAsync(sql, params);
        },
      };
      const persist = vi.fn(async (ref: OrrerySystemRef) => {
        await updateAppSettings(
          exec,
          { orreryLastSystem: systemRefId(ref) },
          LATER,
        );
        return true;
      });
      const store = createOrrerySystemStore({
        load: (ref, gen) => loadOrreryScene(observed, gen, ref),
        persist,
      });
      const actions = focusHarness(observed, () => scene);
      const target = { ...contact, kind: "member" as const };
      let queuedScene: Promise<void> | undefined,
        queuedAction: Promise<void> | undefined;
      try {
        await Promise.race([entered.promise, prematurelySettled]);
        expect(readPhotoBase64).toHaveBeenCalledExactlyOnceWith(
          "avatars/profile.jpg",
        );
        expect(releasePhoto.released).toBe(false);
        queuedScene = store.getState().select(system("favorites"));
        queuedAction = actions.controller.dispatch({
          kind: "profile",
          ids: [contact.id],
          targets: [target],
          generation: 1,
        });
        expect(readQueries).toEqual([]);
        expect(store.getState().status).toBe("loading");
        expect(persist).not.toHaveBeenCalled();
        expect(actions.openProfile).not.toHaveBeenCalled();
        if (cancel) {
          store.getState().cancel();
          actions.controller.cancel("background");
        }
      } finally {
        releasePhoto.release();
        await exporting;
        await Promise.all([queuedScene, queuedAction]);
      }
      expect(readQueries.length).toBeGreaterThan(0);
      expect(readPhotoBase64).toHaveBeenCalledTimes(1);
      if (cancel) {
        expect(store.getState().current()).toBeNull();
        expect(store.getState().snapshot).toBeNull();
        expect(persist).not.toHaveBeenCalled();
        expect(actions.openProfile).not.toHaveBeenCalled();
        expect(actions.focus).not.toHaveBeenCalled();
        expect(await stored(exec)).toEqual(before);
      } else {
        expect(store.getState().current()?.system).toEqual(system("favorites"));
        expect(actions.openProfile).toHaveBeenCalledExactlyOnceWith(contact.id);
        expect(persist).toHaveBeenCalledTimes(1);
        expect((await getAppSettings(exec)).orreryLastSystem).toBe(
          "builtin:favorites",
        );
      }
    },
  );

  it("a coherent scene blocks a queued recency writer until its snapshot releases", async () => {
    const contact = await person(exec, "未連絡", false);
    const entered = deferred(),
      releaseRead = deferred();
    const observed: SqlExecutor = {
      ...exec,
      getAllAsync: async (sql, params) => {
        const result = await exec.getAllAsync(sql, params);
        if (sql.includes("FROM contacts c WHERE")) {
          entered.release();
          await releaseRead.promise;
        }
        return result as never;
      },
    };
    const reading = loadOrreryScene(observed);
    let writing: Promise<unknown> | undefined,
      writeSettled = false;
    try {
      await entered.promise;
      writing = recordTouchpoint(exec, {
        contactId: contact.id,
        uid: randomUUID(),
        occurredAt: NOW,
        now: NOW,
      }).then(() => {
        writeSettled = true;
      });
      expect(writeSettled).toBe(false);
      expect(
        await exec.getFirstAsync(
          "SELECT last_contact FROM contacts WHERE id=?",
          [contact.id],
        ),
      ).toEqual({ last_contact: null });
    } finally {
      releaseRead.release();
    }
    const before = await reading;
    await writing;
    expect(before.contacts[0].last_contact).toBeNull();
    expect(before.gravity.has(contact.id)).toBe(true);
    expect(writeSettled).toBe(true);
    const after = await loadOrreryScene(exec);
    expect(after.contacts[0].last_contact).toBe(NOW);
    expect(after.dataRevision).toBe(before.dataRevision + 1);
    expect(
      await exec.getFirstAsync("SELECT last_contact FROM contacts WHERE id=?", [
        contact.id,
      ]),
    ).toEqual({ last_contact: NOW });
  });

  it.each(["favorites", "category"])(
    "excluded global sun retains actions but no companion/moons/context in %s",
    async (selection) => {
      const sun = await person(exec),
        member = await person(exec);
      const category = (await exec.getFirstAsync<{ id: number; uid: string }>(
        "SELECT id,uid FROM categories LIMIT 1",
      ))!;
      await setFavouriteRank(exec, member.id, NOW);
      await bulkSetCategory(exec, [member.id], category.id, NOW);
      await updateAppSettings(
        exec,
        { sunContactId: sun.id, orrerySatellitesEnabled: 1 },
        NOW,
      );
      await addRelationship(exec, {
        contactId: sun.id,
        personName: "É 👨‍👩‍👧",
        createdAt: NOW,
        now: NOW,
      });
      const ref: OrrerySystemRef =
        selection === "category"
          ? { kind: "category", uid: category.uid }
          : system(selection);
      const scene = await loadOrreryScene(exec, 1, ref);
      expect(scene.systemSnapshot.members.map((row) => row.id)).toEqual([
        member.id,
      ]);
      expect(scene.world.filter((row) => row.id === sun.id)).toHaveLength(1);
      expect(await readOrrerySatellites(exec, [sun], ref)).toEqual([]);
      const staleRows = await readOrrerySatellites(exec, [sun]);
      expect(staleRows).toHaveLength(1);
      expect(
        deriveSatelliteBodies(
          scene.world,
          staleRows,
          scene.systemSnapshot.members,
          true,
          "detail",
        ),
      ).toEqual([]);
      const target = { ...sun, kind: "contact-sun" as const };
      const identities: OrreryContactTarget[] = [
        target,
        { ...member, kind: "member" },
      ];
      const frame = projectFrame(scene.world, HOME_CAMERA, viewport, 1);
      const body = frame.bodies.find((row) => row.id === sun.id)!;
      const io = focusHarness(exec, () => scene);
      await io.controller.dispatch(
        resolveOrreryTap(
          frame,
          body.x,
          body.y,
          identities,
          [],
          scene.systemSnapshot.members,
        ),
      );
      expect(io.focus).toHaveBeenCalledWith([target]);
      await io.controller.dispatch(
        resolveOrreryTap(
          frame,
          body.x,
          body.y,
          identities,
          [`sun:${sun.id}`],
          scene.systemSnapshot.members,
        ),
      );
      expect(io.openProfile).toHaveBeenCalledExactlyOnceWith(sun.id);
      const overlap = {
        ...frame,
        bodies: frame.bodies.map((row) => ({ ...row, x: body.x, y: body.y })),
      };
      const ambiguous = resolveOrreryTap(
        overlap,
        body.x,
        body.y,
        identities,
        [],
        scene.systemSnapshot.members,
      );
      expect(ambiguous.ids).toEqual([member.id, sun.id]);
      await io.controller.dispatch(ambiguous);
      expect(io.group).toHaveBeenCalledExactlyOnceWith([identities[1], target]);
      const staleMoon = deriveSatelliteBodies(
        scene.world,
        staleRows,
        [sun],
        true,
        "detail",
      );
      const moonFrame = projectFrame(staleMoon, HOME_CAMERA, viewport, 1);
      expect(
        resolveSatelliteTap(
          moonFrame,
          moonFrame.bodies[0].x,
          moonFrame.bodies[0].y,
          identities,
          [],
          scene.systemSnapshot.members,
        ).kind,
      ).toBe("clear");
      if (selection === "category")
        await bulkSetCategory(exec, [sun.id], category.id, NOW);
      else await setFavouriteRank(exec, sun.id, NOW);
      const qualified = await loadOrreryScene(exec, 2, ref);
      const rows = await readOrrerySatellites(
        exec,
        qualified.systemSnapshot.members,
        ref,
      );
      expect(
        qualified.systemSnapshot.members.filter((row) => row.id === sun.id),
      ).toHaveLength(1);
      expect(rows).toHaveLength(1);
      expect(
        deriveSatelliteBodies(
          qualified.world,
          rows,
          qualified.systemSnapshot.members,
          true,
          "detail",
        ),
      ).toHaveLength(1);
      await updateAppSettings(exec, { sunContactId: member.id }, NOW);
      await io.controller.dispatch({
        kind: "profile",
        generation: 1,
        ids: [sun.id],
        targets: [target],
      });
      expect(io.openProfile).toHaveBeenCalledTimes(1);
      expect(io.reject).toHaveBeenLastCalledWith("removed");
    },
  );

  it("neutral→contacted→unbind/bind→archive/restore→merge/purge preserves actual recency and sun identity", async () => {
    const fetch = vi.fn(() => {
      throw new Error("Unexpected network");
    });
    vi.stubGlobal("fetch", fetch);
    expect((await loadOrreryScene(exec)).contacts).toEqual([]);
    const first = await person(exec, "同名 é", false);
    const neutral = await loadOrreryScene(exec, 1, system("not-contacted"));
    expect(neutral.contacts).toMatchObject([
      { ...first, status: null, progress: null, photo: null },
    ]);
    for (const name of ["favorites", "needs-attention", "snoozed", "chargers"])
      expect((await loadOrreryScene(exec, 1, system(name))).contacts).toEqual(
        [],
      );
    await recordTouchpoint(exec, {
      contactId: first.id,
      uid: randomUUID(),
      occurredAt: NOW,
      now: NOW,
    });
    expect(
      (await loadOrreryScene(exec, 1, system("not-contacted"))).contacts,
    ).toEqual([]);
    await setFavouriteRank(exec, first.id, NOW);
    await updateAppSettings(exec, { sunContactId: first.id }, NOW);
    const sunOnly = await loadOrreryScene(exec);
    expect(sunOnly.contacts).toEqual([]);
    expect(sunOnly.systemSnapshot.members.map((row) => row.id)).toEqual([
      first.id,
    ]);
    expect(sunOnly.world.map((row) => row.id)).toEqual([first.id]);
    await unbindContact(exec, first.id, NOW);
    expect(
      (await loadOrreryScene(exec)).systemSnapshot.resolvedSunIdentity,
    ).toBeNull();
    await bindContact(exec, first.id, NOW);
    await archiveContact(exec, first.id, NOW);
    expect((await loadOrreryScene(exec)).systemSnapshot.members).toEqual([]);
    await restoreContact(exec, first.id, NOW);
    expect(
      (await loadOrreryScene(exec)).systemSnapshot.resolvedSunIdentity,
    ).toEqual(first);
    const second = await person(exec, "同名 é");
    const relation = await addRelationship(exec, {
      contactId: first.id,
      personName: "李",
      relationType: "friend",
      createdAt: NOW,
      now: NOW,
    });
    await mergeContacts(exec, {
      survivorId: second.id,
      absorbedId: first.id,
      now: LATER,
    });
    const merged = await loadOrreryScene(exec);
    expect(merged.systemSnapshot.members.map((row) => row.id)).toEqual([
      second.id,
    ]);
    expect(merged.systemSnapshot.resolvedSunIdentity).toEqual(second);
    expect(
      await exec.getFirstAsync("SELECT last_contact FROM contacts WHERE id=?", [
        second.id,
      ]),
    ).toEqual({ last_contact: NOW });
    expect((await readOrrerySatellites(exec, [second]))[0]).toMatchObject({
      parentId: second.id,
      personName: "李",
    });
    expect(
      await exec.getFirstAsync(
        "SELECT contact_id FROM relationships WHERE id=?",
        [relation],
      ),
    ).toEqual({ contact_id: second.id });
    await archiveContact(exec, second.id, LATER);
    await purgeContact(exec, second.id, { now: LATER });
    expect((await loadOrreryScene(exec)).systemSnapshot.members).toEqual([]);
    expect((await getAppSettings(exec)).sunContactId).toBeNull();
    expect(await exec.getAllAsync("SELECT * FROM interactions")).toEqual([]);
    expect(await exec.getAllAsync("SELECT * FROM relationships")).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("relationship hidden/link/delete/restore and portable omission retain distinct boundaries", async () => {
    const parent = await person(exec),
      linked = await person(exec);
    const id = await addRelationship(exec, {
      contactId: parent.id,
      personName: "李 é",
      createdAt: NOW,
      now: NOW,
    });
    const rows = () => readOrrerySatellites(exec, [parent]);
    expect(await rows()).toMatchObject([
      { personName: "李 é", relationType: null },
    ]);
    await editRelationship(exec, {
      id,
      contactId: parent.id,
      hidden: 1,
      now: NOW,
    });
    expect(await rows()).toEqual([]);
    await editRelationship(exec, {
      id,
      contactId: parent.id,
      hidden: 0,
      linkedContactId: linked.id,
      now: NOW,
    });
    expect(await rows()).toEqual([]);
    await editRelationship(exec, {
      id,
      contactId: parent.id,
      linkedContactId: null,
      now: NOW,
    });
    await deleteRelationship(exec, { id, contactId: parent.id, now: NOW });
    expect(await rows()).toEqual([]);
    await restoreRelationship(exec, { id, contactId: parent.id, now: NOW });
    expect(await rows()).toHaveLength(1);
    await updateAppSettings(
      exec,
      {
        orreryDensity: "compact",
        orrerySatellitesEnabled: 1,
        orreryLastSystem: "builtin:favorites",
        sunContactId: parent.id,
      },
      NOW,
    );
    const manifest = await buildExportManifest(exec, {
      exportedAt: NOW,
      readPhotoBase64: vi.fn(),
    });
    for (const key of [
      "orreryDensity",
      "orrerySatellitesEnabled",
      "orreryLastSystem",
      "camera",
      "pose",
      "focus",
      "sunContactId",
    ])
      expect(manifest.appSettings).not.toHaveProperty(key);
    expect(manifest.backupFormatVersion).toBe(4);
    await deleteRelationship(exec, { id, contactId: parent.id, now: LATER });
    const restored = await applyRestore(exec, manifest, "replace-all", {
      reconcileNotificationSchedule: async () => {},
      reconcileDigestSchedule: async () => {},
      stagePhoto: async () => {
        throw new Error("Unexpected photo staging");
      },
      persistPhoto: async () => {
        throw new Error("Unexpected photo persistence");
      },
      deleteCanonicalPhoto: () => {
        throw new Error("Unexpected photo delete");
      },
      canonicalPhotoExists: () => false,
    });
    expect(restored.status).toBe("applied");
    expect(await getAppSettings(exec)).toMatchObject({
      orreryDensity: "compact",
      orrerySatellitesEnabled: 1,
      orreryLastSystem: "builtin:favorites",
    });
    const scene = await loadOrreryScene(exec);
    expect(scene.systemSnapshot.members.map((row) => row.uid).sort()).toEqual(
      [parent.uid, linked.uid].sort(),
    );
    expect(scene.systemSnapshot.resolvedSunIdentity?.uid).toBe(parent.uid);
    const restoredParent = scene.systemSnapshot.members.find(
      (row) => row.uid === parent.uid,
    )!;
    expect(await readOrrerySatellites(exec, [restoredParent])).toMatchObject([
      { personName: "李 é" },
    ]);
    const session = {
      pose: { ...HOME_CAMERA, zoom: 2 },
      focus: { ...restoredParent, kind: "contact-sun" as const },
      systemId: "builtin:all-contacts",
    };
    expect(
      restoreOrrerySession({
        saved: session,
        systemId: session.systemId,
        members: scene.systemSnapshot.members,
        sun: scene.systemSnapshot.resolvedSunIdentity,
        extent: scene.extent,
      })?.focus?.uid,
    ).toBe(parent.uid);
    expect(
      restoreOrrerySession({
        saved: null,
        systemId: session.systemId,
        members: scene.systemSnapshot.members,
        sun: null,
        extent: scene.extent,
      }),
    ).toBeNull();
    const navigation = createOrrerySessionStore();
    const route = { key: "orrery-1", name: "Orrery" },
      profile = { key: "profile-1", name: "Profile" };
    navigation.getState().routeChanged([route]);
    navigation.getState().capture("profile", session);
    navigation.getState().routeChanged([route, profile]);
    navigation.getState().routeChanged([route]);
    expect(navigation.getState().resume).toBe("restore");
    expect(navigation.getState().saved).toEqual(session);
    navigation.getState().resumed();
    navigation.getState().capture("background", session);
    expect(navigation.getState().saved).toEqual(session);
    navigation.getState().leaveTab();
    expect(navigation.getState().saved).toBeNull();
    expect(navigation.getState().resume).toBe("home");
  });

  it("A→B→A real reads publish only the final generation; refresh failure is retained and retry succeeds", async () => {
    await person(exec);
    const gates = [deferred(), deferred(), deferred()];
    let calls = 0;
    const persist = vi.fn(async () => true);
    const store = createOrrerySystemStore({
      load: async (ref, gen) => {
        const scene = await loadOrreryScene(exec, gen, ref);
        const index = calls++;
        if (index < 3) await gates[index].promise;
        if (index === 3) throw new Error("read failure");
        return scene;
      },
      persist,
    });
    const a = store.getState().select(ALL_CONTACTS_SYSTEM);
    const b = store.getState().select(system("favorites"));
    const finalA = store.getState().select(ALL_CONTACTS_SYSTEM);
    gates[2].release();
    await finalA;
    gates[1].release();
    gates[0].release();
    await Promise.all([a, b]);
    expect(store.getState().current()?.generation).toBe(3);
    expect(store.getState().snapshot?.systemSnapshot.members).toHaveLength(1);
    expect(persist).toHaveBeenCalledTimes(1);
    await store.getState().reload();
    expect(store.getState().status).toBe("stale");
    expect(store.getState().current()).toBeNull();
    expect(store.getState().snapshot?.systemSnapshot.members).toHaveLength(1);
    await store.getState().retryReload();
    expect(store.getState().status).toBe("ready");
  });

  it("filtered membership and queued production favorite writes cannot evade unchanged full order/sun guards", async () => {
    const a = await person(exec),
      hidden = await person(exec),
      b = await person(exec);
    await setFavouriteRank(exec, a.id, NOW);
    await setFavouriteRank(exec, b.id, NOW);
    const scene = await loadOrreryScene(exec, 1, system("favorites"));
    const request = rankRequest(scene);
    const before = await stored(exec);
    await commitRingReorder(
      exec,
      { ...request, reorderedVisibleIds: request.expectedEligibleVisibleIds },
      LATER,
    );
    await expect(
      commitRingReorder(exec, request, LATER, () => false),
    ).rejects.toThrow(/Cancelled/);
    expect(await stored(exec)).toEqual(before);
    await commitRingReorder(exec, request, LATER);
    expect((await loadOrreryScene(exec)).contacts.map((row) => row.id)).toEqual(
      [b.id, hidden.id, a.id],
    );
    const fresh = rankRequest(
      await loadOrreryScene(exec, 2, system("favorites")),
    );
    const entered = deferred(),
      release = deferred();
    const blocker = withMutex(async () => {
      entered.release();
      await release.promise;
    });
    await entered.promise;
    const changed = clearFavouriteRank(exec, a.id, LATER);
    const queued = commitRingReorder(exec, fresh, LATER);
    const rejection = expect(queued).rejects.toThrow(/membership/);
    release.release();
    await blocker;
    await changed;
    const afterMutation = await stored(exec);
    await rejection;
    expect(await stored(exec)).toEqual(afterMutation);
    expect(
      (await loadOrreryScene(exec)).systemSnapshot.completeContactedOrder,
    ).toEqual(fresh.expectedFullOrderedIds);
    expect((await getAppSettings(exec)).sunContactId).toBe(
      fresh.expectedSavedSunContactId,
    );
    expect((await stored(exec)).interactions).toEqual(before.interactions);
  });

  it.each([false, true])(
    "clock-only lock-time membership check with day advanced=%s",
    async (advance) => {
      const fixture = openSqliteLocalDayFixture("2026-09-07");
      try {
        await migrate(fixture.exec);
        const a = await person(fixture.exec),
          b = await person(fixture.exec);
        // Both cross the production 0.8 needs-attention threshold at local midnight.
        const scene = await loadOrreryScene(
          fixture.exec,
          1,
          system("needs-attention"),
        );
        expect(scene.systemSnapshot.members).toEqual([]);
        const request = rankRequest(scene),
          before = await stored(fixture.exec);
        const entered = deferred(),
          release = deferred();
        const blocker = withMutex(async () => {
          entered.release();
          await release.promise;
        });
        await entered.promise;
        const pending = commitRingReorder(fixture.exec, request, LATER);
        const result = advance
          ? expect(pending).rejects.toThrow(/membership/)
          : expect(pending).resolves.toBeUndefined();
        if (advance) fixture.setLocalDay("2026-09-08");
        release.release();
        await blocker;
        await result;
        expect(await stored(fixture.exec)).toEqual(before);
        const after = await loadOrreryScene(
          fixture.exec,
          2,
          system("needs-attention"),
        );
        expect(after.systemSnapshot.members.map((row) => row.id)).toEqual(
          advance ? [a.id, b.id] : [],
        );
        expect(after.systemSnapshot.completeContactedOrder).toEqual(
          request.expectedFullOrderedIds,
        );
        expect(after.systemSnapshot.contactIdentities).toEqual(
          request.expectedContactIdentities,
        );
      } finally {
        fixture.close();
      }
    },
  );

  it("scene and narrow action reads remain bounded as real history/population grows", async () => {
    const first = await person(exec);
    const queries: string[] = [];
    const observed: SqlExecutor = {
      ...exec,
      getAllAsync: (sql, params) => {
        queries.push(sql);
        return exec.getAllAsync(sql, params);
      },
      getFirstAsync: (sql, params) => {
        queries.push(sql);
        return exec.getFirstAsync(sql, params);
      },
    };
    await loadOrreryScene(observed);
    const small = queries.length;
    for (let i = 0; i < 35; i++) await person(exec);
    for (let i = 0; i < 25; i++)
      await recordTouchpoint(exec, {
        contactId: first.id,
        uid: randomUUID(),
        occurredAt: "2020-01-01 12:00:00",
        now: NOW,
      });
    queries.length = 0;
    const scene = await loadOrreryScene(observed);
    expect(queries).toHaveLength(small);
    expect(
      scene.systemSnapshot.impactInputs.get(first.id)?.interactions,
    ).toHaveLength(26);
    expect(scene.world.filter((row) => row.kind === "contact")).toHaveLength(
      36,
    );
    queries.length = 0;
    expect(
      (
        await readOrreryContactTargetValidation(observed, ALL_CONTACTS_SYSTEM, {
          ...first,
          kind: "member",
        })
      ).isMember,
    ).toBe(true);
    expect(queries).toHaveLength(2);
    expect(queries.every((sql) => !sql.includes("interactions"))).toBe(true);
  });

  it("reused numeric identity rejects both an old rank request and a contact action", async () => {
    const a = await person(exec),
      removed = await person(exec);
    const scene = await loadOrreryScene(exec, 1);
    const request = rankRequest(scene);
    const io = focusHarness(exec, () => scene);
    await archiveContact(exec, removed.id, NOW);
    await purgeContact(exec, removed.id, { now: NOW });
    const replacement = await person(exec);
    expect(replacement.id).toBe(removed.id);
    expect(replacement.uid).not.toBe(removed.uid);
    const before = await stored(exec);
    const after = await loadOrreryScene(exec);
    expect(after.systemSnapshot.completeContactedOrder).toEqual([
      a.id,
      removed.id,
    ]);
    await expect(commitRingReorder(exec, request, LATER)).rejects.toThrow(
      /identities/,
    );
    await io.controller.dispatch({
      kind: "profile",
      ids: [removed.id],
      targets: [{ ...removed, kind: "member" }],
      generation: 1,
    });
    expect(io.openProfile).not.toHaveBeenCalled();
    expect(io.reject).toHaveBeenCalledWith("removed");
    expect(await stored(exec)).toEqual(before);
  });

  it("native SQLite clock predicates cover every built-in and UID categories survive rename then report removal", async () => {
    const a = await person(exec),
      neutral = await person(exec, "未連絡", false);
    // Use production writer + unmodified SQLite clock; no caller-day override.
    await snoozeContact(exec, {
      contactId: a.id,
      uid: randomUUID(),
      preset: "1w",
      now: NOW,
    });
    await setFavouriteRank(exec, a.id, NOW);
    const category = (await exec.getFirstAsync<{ id: number; uid: string }>(
      "SELECT id,uid FROM categories LIMIT 1",
    ))!;
    await bulkSetCategory(exec, [a.id], category.id, NOW);
    const manifest = await buildExportManifest(exec, {
      exportedAt: NOW,
      readPhotoBase64: vi.fn(),
    });
    const row = manifest.contacts.find((contact) => contact.uid === a.uid)!;
    row.socialBattery = "Charger";
    row.modifiedAt = LATER;
    const categoryRow = manifest.categories.find(
      (item) => item.uid === category.uid,
    )!;
    categoryRow.name = "名前 👩🏽‍🚀";
    categoryRow.modifiedAt = LATER;
    await applyRestore(exec, manifest, "merge", {
      stagePhoto: async () => {},
      persistPhoto: async () => {},
      deleteCanonicalPhoto: () => {},
      canonicalPhotoExists: () => false,
      reconcileNotificationSchedule: async () => {},
      reconcileDigestSchedule: async () => {},
    });
    const expected: Record<string, number[]> = {
      "all-contacts": [a.id, neutral.id],
      "not-contacted": [neutral.id],
      favorites: [a.id],
      snoozed: [a.id],
      chargers: [a.id],
      "needs-attention": [],
    };
    for (const [name, ids] of Object.entries(expected)) {
      const scene = await loadOrreryScene(exec, 1, system(name));
      expect(scene.systemSnapshot.members.map((member) => member.id)).toEqual(
        ids,
      );
      for (const contact of [a, neutral]) {
        const probe = await readOrreryContactTargetValidation(
          exec,
          system(name),
          { ...contact, kind: "member" },
        );
        expect(probe.isMember).toBe(ids.includes(contact.id));
      }
    }
    const ref: OrrerySystemRef = { kind: "category", uid: category.uid };
    const scene = await loadOrreryScene(exec, 1, ref);
    expect(
      scene.systemSnapshot.categories.find((row) => row.uid === category.uid)
        ?.name,
    ).toBe("名前 👩🏽‍🚀");
    expect(scene.systemSnapshot.members.map((row) => row.id)).toEqual([a.id]);
    // Category CRUD is Phase37: explicit fixture deletion exercises its read seam.
    await bulkSetCategory(exec, [a.id], null, NOW);
    await exec.runAsync("DELETE FROM categories WHERE id=?", [category.id]);
    await expect(loadOrreryScene(exec, 2, ref)).rejects.toThrow(
      /no longer exists/,
    );
    expect(
      (
        await readOrreryContactTargetValidation(exec, ref, {
          ...a,
          kind: "member",
        })
      ).status,
    ).toBe("missing-category");
  });
});
