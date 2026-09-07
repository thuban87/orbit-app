import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOrreryGestures } from "@/components/orrery/OrreryWorld";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { getAppSettings, updateAppSettings } from "@/db/app-settings-dao";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import {
  collectHitCandidates,
  HOME_CAMERA,
  projectFrame,
  projectWorldPoint,
  tapIntent,
  unprojectToWorldPlane,
} from "@/logic/orrery-camera-logic";
import {
  createOrreryIntentDispatcher,
  createOrrerySceneController,
  loadOrreryScene,
} from "@/services/orrery-scene";

vi.mock("expo-sqlite", () => ({}));
vi.mock("react-native", () => ({}));
vi.mock("@shopify/react-native-skia", () => ({}));
vi.mock("@/components/orrery/OrbitBody", () => ({}));
vi.mock("@/components/orrery/SunBody", () => ({}));
vi.mock("@/components/orrery/OrreryCanvas", () => ({}));
vi.mock("@/theme/use-reduced-motion", () => ({}));
vi.mock("react-native-reanimated", () => ({
  runOnJS: (fn: unknown) => fn,
  cancelAnimation: vi.fn(),
}));
vi.mock("react-native-gesture-handler", () => {
  const builder = () => {
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    const g: Record<string, unknown> = { handlers };
    for (const key of [
      "minDistance",
      "maxDistance",
      "maxPointers",
      "enabled",
      "minPointers",
      "averageTouches",
      "activeOffsetY",
      "manualActivation",
    ])
      g[key] = () => g;
    for (const key of [
      "onBegin",
      "onStart",
      "onUpdate",
      "onEnd",
      "onFinalize",
      "onTouchesDown",
      "onTouchesMove",
      "onTouchesUp",
    ])
      g[key] = (fn: (...args: unknown[]) => void) => {
        handlers[key] = fn;
        return g;
      };
    return g;
  };
  return {
    Gesture: {
      Pan: builder,
      Tap: builder,
      Pinch: builder,
      Rotation: builder,
      Simultaneous: (...gestures: unknown[]) => ({ gestures }),
      Race: (...gestures: unknown[]) => ({ gestures }),
    },
  };
});

const viewport = { width: 400, height: 600 };
let db: ReturnType<typeof openTestDb>;
let exec: ReturnType<typeof nodeSqliteExecutor>;
let id: number;
beforeEach(async () => {
  db = openTestDb();
  exec = nodeSqliteExecutor(db);
  let uid = 0;
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: "2026-09-01 12:00:00",
    newUid: () => `scene-${++uid}`,
    defaultPhoneRegion: "US",
  });
  id = (
    await exec.runAsync(
      `INSERT INTO contacts (uid, name, interval_days, tracking_enabled, last_contact, ring_seq, created_at, modified_at) VALUES ('person', 'Alex', 30, 1, datetime('now','localtime'), 0, '2026-09-01', '2026-09-01')`,
    )
  ).lastInsertRowId;
});
afterEach(() => db.close());

describe("canonical SQLite scene tracer", () => {
  it("feeds canonical Gravity into the same rendered and hit-tested mass without storing scores", async () => {
    const before = await loadOrreryScene(exec);
    await exec.runAsync(
      `INSERT INTO interactions(uid,contact_id,occurred_at,recorded_at,connected,direction,modified_at,source,channel)
      SELECT 'mass-' || value, ?, datetime('now','localtime'),datetime('now','localtime'),1,'mutual',datetime('now','localtime'),'manual','unspecified'
      FROM json_each(?)`,
      [id, JSON.stringify(Array.from({ length: 24 }, (_, i) => i))],
    );
    const after = await loadOrreryScene(exec);
    expect(after.gravity.get(id)?.tierName).toBe("deep");
    expect(after.world[0].radius).toBeGreaterThan(before.world[0].radius);
    const body = after.world[0];
    const frame = projectFrame(
      after.world,
      { x: body.x, y: body.y, zoom: 2 },
      viewport,
      0,
    );
    expect(frame.bodies[0].radius).toBe(body.radius * 2);
    expect(frame.bodies[0].hitRadius).toBe(frame.bodies[0].radius);
    expect(
      await exec.getAllAsync(
        "SELECT name FROM pragma_table_info('contacts') WHERE name LIKE '%gravity%' OR name LIKE '%mass%'",
      ),
    ).toEqual([]);
  });
  it("carries committed density and satellite preferences into scene presentation without changing membership", async () => {
    const before = await loadOrreryScene(exec);
    await updateAppSettings(
      exec,
      { orreryDensity: "compact", orrerySatellitesEnabled: 1 },
      "2026-09-07",
    );
    const after = await loadOrreryScene(exec);
    expect(after.preferences).toEqual({
      density: "compact",
      satellitesEnabled: 1,
      lastSystem: "builtin:all-contacts",
    });
    expect(after.contacts.map((contact) => contact.id)).toEqual(
      before.contacts.map((contact) => contact.id),
    );
  });
  it("reads self and configured contact sun through the real snapshot and five readers", async () => {
    const scene = await loadOrreryScene(exec, 1);
    expect(scene.contacts.map((c) => c.id)).toEqual([id]);
    expect(scene.sun.selfPhoto).toBeNull();
    await updateAppSettings(exec, { sunContactId: id }, "2026-09-02");
    const withSun = await loadOrreryScene(exec, 2);
    expect(withSun.contacts).toEqual([]);
    expect(withSun.sun.occupant?.status).toBe("stable");
    expect(withSun.world.find((b) => b.id === id)?.kind).toBe("sun");
  });

  it("the registered pan changes pose over a body but never rank, timestamps or revision, even on cancellation", async () => {
    const scene = await loadOrreryScene(exec, 1);
    const before = await exec.getAllAsync(
      "SELECT ring_seq, modified_at FROM contacts",
    );
    const revision = (await getAppSettings(exec)).dataRevision;
    const pose = { value: { ...HOME_CAMERA } };
    const frame = {
      get value() {
        return projectFrame(scene.world, pose.value, viewport, 1);
      },
    };
    const send = vi.fn();
    const gestures = createOrreryGestures({
      pose,
      frame,
      panStart: { value: null },
      extent: scene.extent,
      send,
      stop: vi.fn(),
    });
    const [tap, multi] = (
      gestures as unknown as {
        gestures: { handlers: Record<string, (...args: unknown[]) => void> }[];
      }
    ).gestures;
    const pan = (multi as unknown as { gestures: (typeof tap)[] }).gestures[0];
    const drawn = frame.value.bodies.find((b) => b.id === id)!;
    pan.handlers.onBegin({ x: drawn.x, y: drawn.y });
    pan.handlers.onUpdate({
      translationX: 70,
      translationY: 35,
      numberOfPointers: 1,
    });
    pan.handlers.onEnd({}, false);
    pan.handlers.onFinalize({}, false);
    expect(pose.value).not.toEqual(HOME_CAMERA);
    const moved = frame.value.bodies.find((b) => b.id === id)!;
    expect(collectHitCandidates(frame.value, moved.x, moved.y)).toEqual([id]);
    tap.handlers.onEnd({ x: moved.x, y: moved.y }, false);
    expect(send).not.toHaveBeenCalled();
    tap.handlers.onBegin({});
    tap.handlers.onEnd({ x: moved.x, y: moved.y }, true);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "focus", ids: [id] }),
    );
    expect(
      await exec.getAllAsync("SELECT ring_seq, modified_at FROM contacts"),
    ).toEqual(before);
    expect((await getAppSettings(exec)).dataRevision).toBe(revision);
  });

  it("Home, pan and halfway focus use the same drawn centers for hits and identity-level Profile dispatch", async () => {
    const scene = await loadOrreryScene(exec, 3);
    const body = scene.world.find((b) => b.id === id)!;
    for (const pose of [
      HOME_CAMERA,
      { x: -30, y: 20, zoom: 1 },
      { x: body.x / 2, y: body.y / 2, zoom: 1.5 },
    ]) {
      const frame = projectFrame(scene.world, pose, viewport, 3);
      const drawn = frame.bodies.find((b) => b.id === id)!;
      expect(collectHitCandidates(frame, drawn.x, drawn.y)).toEqual([id]);
      expect(projectFrame(scene.world, pose, viewport, 3)).toEqual(frame);
    }
    const focus = vi.fn(),
      openProfile = vi.fn();
    const dispatch = createOrreryIntentDispatcher({
      current: () => scene,
      validate: async () => loadOrreryScene(exec, 3),
      focus,
      group: vi.fn(),
      clear: vi.fn(),
      openProfile,
    });
    const home = projectFrame(scene.world, HOME_CAMERA, viewport, 3);
    const drawn = home.bodies.find((b) => b.id === id)!;
    await dispatch(tapIntent(home, drawn.x, drawn.y, true));
    expect(focus).toHaveBeenCalledWith([id]);
    const inspect = projectFrame(
      scene.world,
      { x: body.x, y: body.y, zoom: 2 },
      viewport,
      3,
    );
    await dispatch(tapIntent(inspect, 200, 300, true));
    await dispatch(tapIntent(inspect, 200, 300, true));
    expect(openProfile).toHaveBeenCalledExactlyOnceWith(id);
    await dispatch({ kind: "profile", ids: [id], generation: 2 });
    expect(openProfile).toHaveBeenCalledTimes(1);
  });

  it("rejects removed and queued stale targets and never chooses an ambiguous hit", async () => {
    const scene = await loadOrreryScene(exec, 1);
    const body = scene.world.find((b) => b.id === id)!;
    const frame = projectFrame(
      [body, { ...body, id: id + 1 }],
      HOME_CAMERA,
      viewport,
      1,
    );
    expect(
      tapIntent(frame, frame.bodies[0].x, frame.bodies[0].y, true).kind,
    ).toBe("group");
    const openProfile = vi.fn(),
      focus = vi.fn();
    const dispatch = createOrreryIntentDispatcher({
      current: () => scene,
      validate: async () => loadOrreryScene(exec, 1),
      openProfile,
      focus,
      group: vi.fn(),
      clear: vi.fn(),
    });
    await exec.runAsync(
      "UPDATE contacts SET archived_at = '2026-09-02' WHERE id = ?",
      [id],
    );
    await dispatch({ kind: "profile", ids: [id], generation: 1 });
    expect(openProfile).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
  });

  it("only publishes the newest load; cancellation and read failures remain explicit", async () => {
    const scene = await loadOrreryScene(exec, 1);
    const resolvers: ((value: typeof scene) => void)[] = [];
    const publish = vi.fn();
    const controller = createOrrerySceneController(
      () => new Promise((resolve) => resolvers.push(resolve)),
      publish,
    );
    const first = controller.reload(),
      second = controller.reload();
    resolvers[1](scene);
    await second;
    resolvers[0]({ ...scene, contacts: [] });
    await first;
    expect(controller.current()?.contacts).toEqual(scene.contacts);
    const third = controller.reload();
    controller.cancel();
    resolvers[2](scene);
    await third;
    expect(controller.current()).toBeNull();
    const failure = createOrrerySceneController(async () => {
      throw new Error("read failed");
    }, publish);
    await failure.reload();
    expect(publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "error", snapshot: null }),
    );
  });

  it("rejects a validated intent if a newer load or cancellation wins while validation waits", async () => {
    const scene = await loadOrreryScene(exec, 1);
    let current: typeof scene | null = scene;
    let resolve!: (value: typeof scene) => void;
    const openProfile = vi.fn();
    const dispatch = createOrreryIntentDispatcher({
      current: () => current,
      validate: () =>
        new Promise((done) => {
          resolve = done;
        }),
      focus: vi.fn(),
      group: vi.fn(),
      clear: vi.fn(),
      openProfile,
    });
    const pending = dispatch({ kind: "profile", ids: [id], generation: 1 });
    current = { ...scene, generation: 2 };
    resolve(scene);
    await pending;
    expect(openProfile).not.toHaveBeenCalled();
    const cancelled = dispatch({ kind: "profile", ids: [id], generation: 2 });
    current = null;
    resolve(scene);
    await cancelled;
    expect(openProfile).not.toHaveBeenCalled();
  });

  it("retains the last scene with a refresh error and makes its old generation nonactionable", async () => {
    const scene = await loadOrreryScene(exec, 1);
    const publish = vi.fn();
    const controller = createOrrerySceneController(
      vi
        .fn()
        .mockResolvedValueOnce(scene)
        .mockRejectedValueOnce(new Error("read")),
      publish,
    );
    await controller.reload();
    await controller.reload();
    expect(publish).toHaveBeenLastCalledWith({
      status: "error",
      snapshot: scene,
    });
    expect(controller.current()).toBeNull();
  });

  it("projects invertibly and rejects nonfinite/invalid measurement inputs", () => {
    const point = { x: 123, y: -45 };
    const pose = { x: 30, y: 50, zoom: 2 };
    expect(
      unprojectToWorldPlane(
        projectWorldPoint(point, pose, viewport),
        pose,
        viewport,
      ),
    ).toEqual(point);
    expect(() =>
      projectWorldPoint(point, pose, { width: 0, height: 2 }),
    ).toThrow();
    expect(() =>
      projectWorldPoint(point, { ...pose, zoom: Number.NaN }, viewport),
    ).toThrow();
  });
});
