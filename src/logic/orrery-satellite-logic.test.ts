import { describe, expect, it } from "vitest";
import {
  HOME_CAMERA,
  projectFrame,
  type WorldBody,
} from "./orrery-camera-logic";
import { reconcileFocus } from "./orrery-focus-logic";
import {
  beginWorldTransition,
  projectAnimatedFrame,
  sampleWorldTransition,
} from "./orrery-frame";
import { captureReorder } from "./orrery-reorder-logic";
import {
  deriveSatelliteBodies,
  resolveSatelliteTap,
  satelliteKey,
} from "./orrery-satellite-logic";

const parent = { id: 1, uid: "p" };
const row = {
  uid: "r",
  parentId: 1,
  parentUid: "p",
  personName: "名字",
  relationType: null,
};
const world: WorldBody[] = [
  { id: 1, kind: "sun", x: 0, y: 0, radius: 20, ringRadius: 0 },
];
const viewport = { width: 600, height: 800 };
const identities = [{ ...parent, kind: "contact-sun" as const }];
describe("subordinate relationship bodies", () => {
  it("requires enabled and readable current-System parent membership, with no sun override", () => {
    for (const members of [[], [parent]])
      for (const enabled of [false, true])
        for (const level of ["overview", "identity", "detail"] as const) {
          const moons = deriveSatelliteBodies(
            world,
            [row],
            members,
            enabled,
            level,
          );
          expect(moons).toHaveLength(
            members.length && enabled && level !== "overview" ? 1 : 0,
          );
          expect(reconcileFocus(identities[0], members, parent)).toEqual(
            identities[0],
          );
        }
    expect(
      deriveSatelliteBodies(
        world,
        [{ ...row, parentUid: "replaced" }],
        [parent],
        true,
        "identity",
      ),
    ).toEqual([]);
  });
  it("retains UID plus parent identity, small finite deterministic offsets, zero rails or contact semantics", () => {
    const rows = [row, { ...row, uid: "another" }];
    const a = deriveSatelliteBodies(world, rows, [parent], true, "detail");
    expect(a).toEqual(
      deriveSatelliteBodies(
        world,
        [...rows].reverse(),
        [parent],
        true,
        "detail",
      ),
    );
    expect(new Set(a.map(satelliteKey)).size).toBe(2);
    for (const moon of a) {
      expect(moon.kind).toBe("satellite");
      expect(moon.radius).toBeLessThan(world[0].radius / 2);
      expect(moon.ringRadius).toBe(0);
      expect(moon.id).toBeLessThan(0);
      expect(Number.isFinite(moon.x + moon.y)).toBe(true);
    }
  });
  it("projects and hits moons at the displayed intermediate parent position; isolated hit has no contact command", () => {
    const transition = beginWorldTransition(
      world.map((b) => ({ ...b, opacity: 1, interactive: true })),
      [{ ...world[0], x: 60 }],
      2,
    );
    const sampled = sampleWorldTransition(transition, 0.4);
    const moons = deriveSatelliteBodies(
      sampled,
      [row],
      [parent],
      true,
      "identity",
    );
    const current = projectFrame(
      [...sampled, ...moons],
      { ...HOME_CAMERA, zoom: 2, tilt: 0.5, yaw: 0.3 },
      viewport,
      2,
    );
    const moon = current.bodies.find((b) => b.kind === "satellite")!;
    const intent = resolveSatelliteTap(
      current,
      moon.x,
      moon.y,
      identities,
      [],
      [parent],
    );
    expect(intent.kind).toBe("satellite");
    expect(intent.ids).toEqual([]);
    expect(intent.targets).toBeUndefined();
    expect(intent.satelliteTarget?.uid).toBe(row.uid);
    expect(moons[0].x - world[0].x).not.toBe(
      deriveSatelliteBodies(world, [row], [parent], true, "identity")[0].x -
        world[0].x,
    );
  });
  it("mixed moon/contact ambiguity uses contact group and accessible parent path", () => {
    const moons = deriveSatelliteBodies(
      world,
      [row],
      [parent],
      true,
      "identity",
    );
    const frame = projectFrame(
      [...world, ...moons],
      { ...HOME_CAMERA, zoom: 2 },
      viewport,
      1,
    );
    const moon = frame.bodies[1];
    moon.x = frame.bodies[0].x;
    moon.y = frame.bodies[0].y;
    const intent = resolveSatelliteTap(
      frame,
      moon.x,
      moon.y,
      identities,
      [],
      [parent],
    );
    expect(intent.kind).toBe("group");
    expect(intent.ids).toEqual([1]);
    expect(intent.satelliteTarget).toBeUndefined();
    const request = {
      system: { kind: "builtin" as const, id: "all-contacts" as const },
      expectedFullOrderedIds: [1],
      expectedSavedSunContactId: null,
      expectedEligibleVisibleIds: [1],
      expectedContactIdentities: [parent],
    };
    frame.bodies[0].kind = "contact";
    expect(captureReorder(frame, request, moon.x, moon.y)).toBeNull();
  });
  it("removal invalidates every moon target immediately, including decorative parent departures", () => {
    const departed = sampleWorldTransition(
      beginWorldTransition(
        world.map((b) => ({ ...b, opacity: 1, interactive: true })),
        [],
        2,
      ),
      0.2,
    );
    expect(
      deriveSatelliteBodies(departed, [row], [parent], true, "detail"),
    ).toEqual([]);
    const current = projectAnimatedFrame(
      beginWorldTransition([], world, 3),
      1,
      { ...HOME_CAMERA, zoom: 2 },
      viewport,
    );
    expect(
      resolveSatelliteTap(current, 0, 0, identities, [], [parent]).kind,
    ).toBe("clear");
  });
});
