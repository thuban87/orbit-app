import { describe, expect, it, vi } from "vitest";
import { useOrreryCamera } from "../components/orrery/use-orrery-camera";
import { createOrrerySessionStore } from "../stores/orrery-session-store";
import { HOME_CAMERA } from "./orrery-camera-logic";
import { restoreOrrerySession } from "./orrery-session-logic";

const pose = { ...HOME_CAMERA, x: 60, zoom: 1.4, yaw: 0.8, tilt: 0.4 };
const focus = { kind: "member" as const, id: 1, uid: "one" };
const saved = { pose, focus, systemId: "builtin:all-contacts" };
const hooks = vi.hoisted(() => ({
  effects: [] as (() => (() => void) | undefined)[],
  reactions: [] as ((value: boolean, previous: boolean) => void)[],
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useMemo: (fn: () => unknown) => fn(),
  useEffect: (fn: () => (() => void) | undefined) => hooks.effects.push(fn),
}));
vi.mock("react-native-gesture-handler", () => ({ Gesture: {} }));
vi.mock("react-native-reanimated", () => ({
  useSharedValue: (value: unknown) => ({ value }),
  useAnimatedReaction: (
    _prepare: unknown,
    react: (value: boolean, previous: boolean) => void,
  ) => hooks.reactions.push(react),
  runOnUI: (fn: unknown) => fn,
  cancelAnimation: vi.fn(),
  ReduceMotion: { Never: "never" },
  withTiming: (target: unknown) => target,
}));
describe("Orrery navigation session", () => {
  it("actual camera hook cleanup cancels held input, continuation and stale frame", () => {
    hooks.effects = [];
    hooks.reactions = [];
    const sharedPose = { value: { ...pose } };
    const reduced = { value: false };
    const camera = useOrreryCamera({
      pose: sharedPose as never,
      reduced: reduced as never,
      enabled: true,
      extent: 500,
      viewport: { width: 400, height: 700 },
    });
    const cleanups = hooks.effects.map((effect) => effect());
    camera.coast("pan", 200, 0);
    expect(camera.active.value?.kind).toBe("coast");
    reduced.value = true;
    hooks.reactions[0](true, false);
    expect(camera.active.value).toBeNull();
    camera.input.value = { ...camera.input.value, owner: "reorder" };
    camera.reorder.value = { active: true } as never;
    camera.frame.value = { generation: 3 } as never;
    const stoppedPose = sharedPose.value;
    for (const cleanup of cleanups) cleanup?.();
    expect(camera.live.value).toBe(false);
    expect(camera.input.value.owner).toBe("cancelled");
    expect(camera.reorder.value).toBeNull();
    expect(camera.frame.value).toBeNull();
    camera.recover(HOME_CAMERA);
    expect(sharedPose.value).toEqual(stoppedPose);
  });
  it("restores only an armed Profile pop to the original Orrery route", () => {
    const store = createOrrerySessionStore();
    store.getState().routeChanged([{ key: "o", name: "Orrery" }]);
    store.getState().capture("profile", saved);
    store.getState().routeChanged([
      { key: "o", name: "Orrery" },
      { key: "p", name: "Profile" },
    ]);
    store.getState().routeChanged([{ key: "o", name: "Orrery" }]);
    expect(store.getState().resume).toBe("restore");
    expect(store.getState().saved).toEqual(saved);
  });
  it("tab leave invalidates both saved state and delayed capture callbacks", () => {
    const store = createOrrerySessionStore();
    const ticket = store.getState().generation;
    store.getState().capture("profile", saved);
    store.getState().leaveTab();
    store.getState().capture("background", saved, ticket);
    expect(store.getState()).toMatchObject({ resume: "home", saved: null });
  });
  it("background alone preserves pose, while other routes and launch start Home", () => {
    const store = createOrrerySessionStore();
    expect(store.getState().resume).toBe("home");
    store.getState().capture("background", saved);
    expect(store.getState()).toMatchObject({ resume: "restore", saved });
    store.getState().routeChanged([
      { key: "o", name: "Orrery" },
      { key: "c", name: "Compose" },
    ]);
    expect(store.getState()).toMatchObject({ resume: "home", saved: null });
  });
  it("revalidates UID and contact-sun identity, clamps pose and never carries a cluster", () => {
    const args = {
      saved,
      systemId: saved.systemId,
      members: [focus],
      sun: null,
      extent: 32,
    };
    const restored = restoreOrrerySession(args);
    expect(restored?.focus).toEqual(focus);
    expect(restored?.pose.x).toBeLessThan(pose.x);
    expect(
      restoreOrrerySession({
        ...args,
        members: [{ id: 1, uid: "replacement" }],
      })?.focus,
    ).toBeNull();
    expect(
      restoreOrrerySession({ ...args, systemId: "builtin:favorites" }),
    ).toBeNull();
    expect(
      restoreOrrerySession({
        ...args,
        saved: { ...saved, focus: { ...focus, kind: "contact-sun" } },
        members: [],
        sun: focus,
      })?.focus?.kind,
    ).toBe("contact-sun");
    expect(restored).not.toHaveProperty("cluster");
  });
});
