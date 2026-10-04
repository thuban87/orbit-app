import { describe, expect, it, vi } from "vitest";
import type { OrrerySatellite } from "@/db/orrery-satellites-read";
import {
  type CameraPose,
  type CameraViewport,
  clampCameraPose,
  frameBodies,
  HOME_CAMERA,
  IDENTITY_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  projectFrame,
  tryProjectWorldPoint,
  usableCameraRect,
  type WorldBody,
  worldExtent,
} from "./orrery-camera-logic";
import {
  CLUSTER_SEPARATION_PX,
  clusterZoomPose,
  expectedFocusCardRect,
  FOCUS_CARD_ESTIMATED_HEIGHT,
  FOCUS_TARGET_PX,
  focusCardPlacement,
  focusFramingPose,
  focusFramingRegion,
  HIDDEN_FOCUS_CARD,
} from "./orrery-focus-card-logic";
import {
  createOrreryFocusController,
  type OrreryContactTarget,
} from "./orrery-focus-logic";
import {
  type AnimatedWorldBody,
  bodyKey,
  projectAnimatedFrame,
} from "./orrery-frame";
import {
  deriveSatelliteBodies,
  indexSatellites,
  resolveSatelliteTap,
} from "./orrery-satellite-logic";
import { ALL_CONTACTS_SYSTEM } from "./orrery-system-logic";

const DEG = Math.PI / 180;
const TILTS = [0, 45 * DEG, 62 * DEG] as const;
/** A measured Orrery canvas: the selector row on top, the controls column right. */
const viewport: CameraViewport = {
  width: 412,
  height: 700,
  obstacles: [
    { x: 0, y: 0, width: 412, height: 60 },
    { x: 340, y: 430, width: 72, height: 270 },
  ],
};

function contact(
  id: number,
  x: number,
  y: number,
  ringRadius = Math.hypot(x, y),
): WorldBody {
  return { id, kind: "contact", x, y, radius: 16, ringRadius };
}
const sun: WorldBody = {
  id: 0,
  kind: "sun",
  x: 0,
  y: 0,
  radius: 30,
  ringRadius: 0,
};
const focused = contact(1, 0, -92);
const neighbour = contact(2, 24, -120);
const clusterA = contact(3, -30, -70);
const clusterB = contact(4, -30, -71);
const world: WorldBody[] = [sun, focused, neighbour, clusterA, clusterB];
const members = [1, 2, 3, 4].map((id) => ({ id, uid: `u${id}` }));
const identities: OrreryContactTarget[] = members.map((m) => ({
  ...m,
  kind: "member",
}));
const rows: OrrerySatellite[] = ["m-a", "m-b", "m-c"].map((uid) => ({
  uid,
  parentId: 1,
  parentUid: "u1",
  personName: uid,
  relationType: null,
}));
/** The focused body's moons at full split (as the frame draws them at focus). */
const moons = deriveSatelliteBodies(
  [{ ...focused, opacity: 1, interactive: true }],
  indexSatellites(rows, members),
  true,
  1,
).moons;
const extent = worldExtent(world);

function poseAt(tilt: number, overrides: Partial<CameraPose> = {}) {
  return clampCameraPose({ ...HOME_CAMERA, tilt, zoom: 1, ...overrides }, 400);
}
function animated(bodies: readonly WorldBody[]): AnimatedWorldBody[] {
  return bodies.map((b) => ({ ...b, opacity: 1, interactive: true }));
}

describe("38.7-11 (D-19): the docked focus card", () => {
  it("docks at the canvas bottom, left of the side controls, near the body", () => {
    const card = focusCardPlacement(
      viewport,
      { x: 170, y: 300, radius: 30 },
      180,
    );
    expect(card.visible).toBe(true);
    expect(card.y + card.height).toBeCloseTo(700 - 8, 6);
    expect(card.x + card.width).toBeLessThanOrEqual(412 - 92 + 1e-9);
    expect(card.width).toBeLessThanOrEqual(280);
    // Near the body horizontally (centred on it when the clamp allows).
    const far = focusCardPlacement(
      viewport,
      { x: 30, y: 300, radius: 30 },
      180,
    );
    expect(far.x).toBe(usableCameraRect(viewport)?.x);
  });

  it("caps the card at half its own column (below the top HUD, down to its dock) and is hidden without a body", () => {
    const card = focusCardPlacement(
      viewport,
      { x: 170, y: 300, radius: 30 },
      2000,
    );
    const usable = usableCameraRect(viewport)!;
    // Never below today's half-usable cap.
    const cap = Math.max(700 - 8 - usable.y, usable.height) / 2;
    expect(card.height).toBeCloseTo(cap, 6);
    expect(card.maxHeight).toBeCloseTo(cap, 6);
    expect(focusCardPlacement(viewport, null, 180)).toBe(HIDDEN_FOCUS_CARD);
    expect(
      focusCardPlacement(viewport, { x: 1, y: 1, radius: 0 }, 180).visible,
    ).toBe(false);
    expect(
      focusCardPlacement(
        { width: 0, height: 0 },
        { x: 1, y: 1, radius: 5 },
        180,
      ).visible,
    ).toBe(false);
  });
});

describe("38.7-12: the focus card shows every moon row", () => {
  // As on the Pixel: the controls stack's measured obstacle is its wide
  // (200 dp) free column, so the largest usable rect is the band ABOVE the
  // controls, not the card's own column at the canvas bottom.
  const phone: CameraViewport = {
    width: 412,
    height: 700,
    obstacles: [
      { x: 0, y: 0, width: 412, height: 60 },
      { x: 196, y: 430, width: 200, height: 270 },
    ],
  };
  it("a card with two moon rows (~250 dp) is not cut to half the band above the controls", () => {
    const usable = usableCameraRect(phone)!;
    expect(usable.y + usable.height).toBe(430); // the band above the controls
    const card = focusCardPlacement(phone, { x: 150, y: 250, radius: 30 }, 250);
    expect(card.height).toBe(250);
    expect(card.y + card.height).toBeCloseTo(700 - 8, 6);
    expect(card.y).toBeGreaterThanOrEqual(usable.y);
    // The framing reserves the same full-height card.
    expect(expectedFocusCardRect(phone, 250).height).toBe(250);
  });
});

describe("38.7-11 (D-19/D-47): single focus framing", () => {
  it.each(TILTS)(
    "frames the person centred and large above the card, moons inside (tilt %s)",
    (tilt) => {
      const start = poseAt(tilt);
      const card = expectedFocusCardRect(viewport, FOCUS_CARD_ESTIMATED_HEIGHT);
      const framed = focusFramingPose(
        focused,
        moons,
        viewport,
        card,
        start,
        extent,
      );
      expect(framed).not.toBeNull();
      if (!framed) return;
      // Yaw, tilt and lens shift kept.
      expect(framed.tilt).toBeCloseTo(start.tilt ?? 0, 12);
      expect(framed.yaw).toBe(start.yaw);
      expect(framed.lensShift).toBe(start.lensShift);
      const frame = projectFrame([...world, ...moons], framed, viewport, 1);
      const body = frame.bodies.find((b) => b.id === 1 && b.kind === "contact");
      if (!body) throw new Error("focused body missing");
      const region = focusFramingRegion(viewport, card)!;
      // Centred in the region above the card.
      expect(body.x).toBeCloseTo(region.x + region.width / 2, 2);
      expect(body.y).toBeCloseTo(region.y + region.height / 2, 2);
      // Beyond the old IDENTITY_ZOOM cap (D-47), toward FOCUS_TARGET_PX.
      expect(body.magnification).toBeGreaterThanOrEqual(IDENTITY_ZOOM);
      expect(framed.zoom).toBeGreaterThan(IDENTITY_ZOOM);
      expect(body.radius * 2).toBeLessThanOrEqual(FOCUS_TARGET_PX + 1e-3);
      // Moons inside the framed region.
      for (const moon of frame.bodies.filter((b) => b.kind === "satellite")) {
        expect(moon.culled).toBe(false);
        expect(moon.x - moon.radius).toBeGreaterThanOrEqual(region.x - 1e-3);
        expect(moon.x + moon.radius).toBeLessThanOrEqual(
          region.x + region.width + 1e-3,
        );
        expect(moon.y - moon.radius).toBeGreaterThanOrEqual(region.y - 1e-3);
        expect(moon.y + moon.radius).toBeLessThanOrEqual(
          region.y + region.height + 1e-3,
        );
      }
      // The docked card is never above the person.
      const placed = focusCardPlacement(viewport, body, 180);
      expect(placed.visible).toBe(true);
      expect(placed.y).toBeGreaterThan(body.y + body.radius);
    },
  );

  it.each(TILTS)("stays bounded on a tiny viewport (tilt %s)", (tilt) => {
    const tiny: CameraViewport = { width: 160, height: 200 };
    const framed = focusFramingPose(
      focused,
      moons,
      tiny,
      expectedFocusCardRect(tiny, 180),
      poseAt(tilt),
      extent,
    );
    expect(framed).not.toBeNull();
    expect(framed!.zoom).toBeGreaterThanOrEqual(MIN_ZOOM);
    expect(framed!.zoom).toBeLessThanOrEqual(MAX_ZOOM);
    expect(tryProjectWorldPoint(focused, framed!, tiny)).not.toBeNull();
  });

  it("never throws at the horizon: a 1,000-ring far rim at 62° and pan/yaw extremes", () => {
    const rim = 58 + 999 * 34;
    const far = contact(9, 0, -rim);
    const near = contact(10, 0, rim);
    const bigExtent = rim + 40;
    for (const target of [far, near])
      for (const x of [-bigExtent, 0, bigExtent])
        for (const yaw of [0, Math.PI / 2, Math.PI, 1.5 * Math.PI])
          for (const zoom of [MIN_ZOOM, 1, MAX_ZOOM]) {
            const start = clampCameraPose(
              { ...HOME_CAMERA, tilt: 62 * DEG, x, y: -x, yaw, zoom },
              bigExtent,
            );
            let framed: CameraPose | null = null;
            expect(() => {
              framed = focusFramingPose(
                target,
                [],
                viewport,
                expectedFocusCardRect(viewport, 180),
                start,
                bigExtent,
              );
            }).not.toThrow();
            if (framed)
              expect(
                tryProjectWorldPoint(target, framed, viewport),
              ).not.toBeNull();
          }
  });

  it("a culled target gets a hidden card and is framed to a safe pose (never a throw)", () => {
    // Zoomed in at 62°, a near-side body lies behind the camera.
    const behind = contact(11, 0, 1000);
    const start = clampCameraPose(
      { ...HOME_CAMERA, tilt: 62 * DEG, zoom: MAX_ZOOM },
      1100,
    );
    const frame = projectFrame([sun, behind], start, viewport, 1, {
      extent: 1100,
    });
    const body = frame.bodies.find((b) => b.id === 11)!;
    expect(body.culled).toBe(true);
    expect(focusCardPlacement(viewport, body, 180)).toBe(HIDDEN_FOCUS_CARD);
    const framed = focusFramingPose(
      behind,
      [],
      viewport,
      expectedFocusCardRect(viewport, 180),
      start,
      1100,
    );
    expect(framed).not.toBeNull();
    const after = projectFrame([sun, behind], framed!, viewport, 1, {
      extent: 1100,
    });
    expect(after.bodies.find((b) => b.id === 11)!.culled).toBe(false);
    // Invalid input or an unmeasured canvas: null, never a throw.
    expect(
      focusFramingPose(
        { ...behind, x: Number.NaN },
        [],
        viewport,
        null,
        start,
        1100,
      ),
    ).toBeNull();
    expect(
      focusFramingPose(behind, [], { width: 0, height: 0 }, null, start, 1100),
    ).toBeNull();
  });
});

describe("38.7-11 (D-60): taps after the new framing go through the real tap path", () => {
  function framedFrame() {
    const framed = focusFramingPose(
      focused,
      moons,
      viewport,
      expectedFocusCardRect(viewport, 180),
      poseAt(62 * DEG),
      extent,
    )!;
    const bodies = animated([...world]);
    const frame = projectAnimatedFrame(
      { generation: 7, from: bodies, to: bodies },
      1,
      framed,
      viewport,
      { extent },
    );
    return frame;
  }
  function controller(uidFor = (id: number) => `u${id}`) {
    const io = {
      current: () => ({ generation: 7, system: ALL_CONTACTS_SYSTEM }),
      validate: vi.fn(
        async (_system: unknown, target: OrreryContactTarget) => ({
          status: "ready" as const,
          identity: { id: target.id, uid: uidFor(target.id) },
          isMember: true,
          resolvedSunIdentity: null,
        }),
      ),
      focus: vi.fn(),
      group: vi.fn(),
      clear: vi.fn(),
      openProfile: vi.fn(),
      reject: vi.fn(),
    };
    return { io, actions: createOrreryFocusController(io) };
  }

  it("a second tap on the focused person keeps focus and never opens Profile", async () => {
    const frame = framedFrame();
    const body = frame.bodies.find((b) => bodyKey(b) === "contact:1")!;
    expect(body.magnification).toBeGreaterThanOrEqual(IDENTITY_ZOOM);
    // Labels take no part in tap resolution (D-60: no visibleNames argument),
    // so the answer is the same whether or not the name is allocated.
    for (let attempt = 0; attempt < 2; attempt++) {
      const intent = resolveSatelliteTap(
        frame,
        body.x,
        body.y,
        identities,
        members,
      );
      expect(intent).toEqual({
        kind: "focus",
        generation: 7,
        ids: [1],
        targets: [{ kind: "member", id: 1, uid: "u1" }],
      });
      const { io, actions } = controller();
      await actions.dispatch(intent);
      expect(io.focus).toHaveBeenCalledWith([
        { kind: "member", id: 1, uid: "u1" },
      ]);
      expect(io.openProfile).not.toHaveBeenCalled();
    }
  });

  it("a tap on another person re-focuses; a cluster hit is a group; an unknown identity clears", () => {
    const frame = framedFrame();
    const other = frame.bodies.find((b) => bodyKey(b) === "contact:2")!;
    expect(other.visible && !other.culled).toBe(true);
    expect(
      resolveSatelliteTap(frame, other.x, other.y, identities, members),
    ).toMatchObject({ kind: "focus", ids: [2] });
    const a = frame.bodies.find((b) => bodyKey(b) === "contact:3")!;
    expect(
      resolveSatelliteTap(frame, a.x, a.y, identities, members),
    ).toMatchObject({ kind: "group", ids: [3, 4] });
    // A body whose identity is not in the current snapshot yields no target.
    expect(
      resolveSatelliteTap(
        frame,
        other.x,
        other.y,
        identities.filter((t) => t.id !== 2),
        members,
      ),
    ).toMatchObject({ kind: "clear", ids: [] });
  });

  it("the card's Open Profile intent opens Profile once; a stale generation or uid does not", async () => {
    const target: OrreryContactTarget = { kind: "member", id: 1, uid: "u1" };
    const intent = {
      kind: "profile" as const,
      ids: [1],
      targets: [target],
      generation: 7,
    };
    const ok = controller();
    await ok.actions.dispatch(intent);
    expect(ok.io.openProfile).toHaveBeenCalledTimes(1);
    expect(ok.io.openProfile).toHaveBeenCalledWith(1);
    const staleGeneration = controller();
    await staleGeneration.actions.dispatch({ ...intent, generation: 6 });
    expect(staleGeneration.io.openProfile).not.toHaveBeenCalled();
    const staleUid = controller(() => "replaced");
    await staleUid.actions.dispatch(intent);
    expect(staleUid.io.openProfile).not.toHaveBeenCalled();
    expect(staleUid.io.reject).toHaveBeenCalledWith("removed");
  });
});

describe("38.7-11 (D-19): a cluster tap zooms into the cluster", () => {
  /** The cluster panel docked at the bottom (an obstacle, as today). */
  const panelled: CameraViewport = {
    ...viewport,
    obstacles: [
      ...(viewport.obstacles ?? []),
      { x: 0, y: 470, width: 412, height: 230 },
    ],
  };
  const tight = [
    contact(21, -14, -200),
    contact(22, 0, -200),
    contact(23, 14, -200),
  ];
  const wide = [
    contact(31, -150, -60),
    contact(32, 150, -60),
    contact(33, 152, -62),
  ];

  function closest(
    frame: ReturnType<typeof projectFrame>,
    ids: number[],
  ): number {
    const bodies = frame.bodies.filter((b) => ids.includes(b.id));
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < bodies.length; i++)
      for (let j = i + 1; j < bodies.length; j++)
        best = Math.min(
          best,
          Math.hypot(bodies[i].x - bodies[j].x, bodies[i].y - bodies[j].y),
        );
    return best;
  }
  function inside(
    frame: ReturnType<typeof projectFrame>,
    ids: number[],
    view: CameraViewport,
  ) {
    const rect = usableCameraRect(view)!;
    for (const b of frame.bodies.filter((body) => ids.includes(body.id))) {
      expect(b.culled).toBe(false);
      expect(b.x - b.radius).toBeGreaterThanOrEqual(rect.x - 1e-3);
      expect(b.x + b.radius).toBeLessThanOrEqual(rect.x + rect.width + 1e-3);
      expect(b.y - b.radius).toBeGreaterThanOrEqual(rect.y - 1e-3);
      expect(b.y + b.radius).toBeLessThanOrEqual(rect.y + rect.height + 1e-3);
    }
  }

  it.each(TILTS)(
    "zooms in until the members separate, never below frameBodies, inside the usable rect (tilt %s)",
    (tilt) => {
      const start = poseAt(tilt, { zoom: 0.5 });
      const all = [sun, ...tight];
      const ext = worldExtent(all);
      const base = frameBodies(tight, panelled, ext, start)!;
      const zoomed = clusterZoomPose(tight, panelled, start, ext);
      expect(zoomed).not.toBeNull();
      expect(zoomed!.zoom).toBeGreaterThanOrEqual(base.pose.zoom - 1e-9);
      const frame = projectFrame(all, zoomed!, panelled, 1, { extent: ext });
      // Separated, unless MAX_ZOOM bounds it first.
      if (zoomed!.zoom < MAX_ZOOM - 1e-6)
        expect(closest(frame, [21, 22, 23])).toBeGreaterThanOrEqual(
          CLUSTER_SEPARATION_PX - 0.5,
        );
      expect(zoomed!.zoom).toBeGreaterThan(start.zoom);
      inside(frame, [21, 22, 23], panelled);
    },
  );

  it.each(TILTS)(
    "a group that cannot separate within the frame zooms only as far as it still fits (tilt %s)",
    (tilt) => {
      const start = poseAt(tilt, { zoom: 0.5 });
      const all = [sun, ...wide];
      const ext = worldExtent(all);
      const base = frameBodies(wide, panelled, ext, start)!;
      const zoomed = clusterZoomPose(wide, panelled, start, ext)!;
      expect(zoomed.zoom).toBeGreaterThanOrEqual(base.pose.zoom - 1e-9);
      const frame = projectFrame(all, zoomed, panelled, 1, { extent: ext });
      inside(frame, [31, 32, 33], panelled);
    },
  );

  it("never throws for a cluster straddling the horizon at 62°; null keeps the camera", () => {
    const rim = 58 + 999 * 34;
    const straddle = [contact(41, 0, rim), contact(42, 4, rim + 2)];
    const ext = rim + 40;
    for (const zoom of [MIN_ZOOM, 1, MAX_ZOOM])
      for (const yaw of [0, Math.PI]) {
        const start = clampCameraPose(
          { ...HOME_CAMERA, tilt: 62 * DEG, zoom, yaw },
          ext,
        );
        let result: CameraPose | null = null;
        expect(() => {
          result = clusterZoomPose(straddle, panelled, start, ext);
        }).not.toThrow();
        if (result)
          for (const body of straddle)
            expect(tryProjectWorldPoint(body, result, panelled)).not.toBeNull();
      }
    expect(
      clusterZoomPose(straddle, { width: 0, height: 0 }, poseAt(0), ext),
    ).toBeNull();
  });
});
