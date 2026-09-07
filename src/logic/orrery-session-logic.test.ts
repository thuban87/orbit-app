import { describe, expect, it } from "vitest";
import { createOrrerySessionStore } from "../stores/orrery-session-store";
import { HOME_CAMERA } from "./orrery-camera-logic";
import { restoreOrrerySession } from "./orrery-session-logic";

const pose = { ...HOME_CAMERA, x: 60, zoom: 1.4, yaw: 0.8, tilt: 0.4 };
const focus = { kind: "member" as const, id: 1, uid: "one" };
const saved = { pose, focus, systemId: "builtin:all-contacts" };
describe("Orrery navigation session", () => {
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
