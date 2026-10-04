import { beforeEach, describe, expect, it, vi } from "vitest";

const record = vi.hoisted(() => ({ paths: [] as string[][] }));
vi.mock("@shopify/react-native-skia", () => ({
  BlendMode: { Dst: 2 },
  PaintStyle: { Fill: 0, Stroke: 1 },
  StrokeCap: { Butt: 0, Round: 1 },
  VertexMode: { Triangles: 0, TriangleStrip: 1, TriangleFan: 2 },
  Skia: {
    MakeVertices: (mode: number, points: unknown[]) => ({
      mode,
      count: points.length,
    }),
    Paint: () => {
      const paint = {
        color: [] as number[],
        style: 0,
        width: 0,
        shader: null as unknown,
        setAntiAlias: () => {},
        setColor: (c: Float32Array) => {
          paint.color = [...c];
        },
        setStyle: (s: number) => {
          paint.style = s;
        },
        setStrokeWidth: (w: number) => {
          paint.width = w;
        },
        setShader: (shader: unknown) => {
          paint.shader = shader;
        },
        setStrokeCap: () => {},
      };
      return paint;
    },
    XYWHRect: (x: number, y: number, width: number, height: number) => ({
      x,
      y,
      width,
      height,
    }),
    RRectXY: (rect: unknown, rx: number, ry: number) => ({ rect, rx, ry }),
    Path: {
      Make: () => {
        const commands: string[] = [];
        record.paths.push(commands);
        return {
          moveTo: (x: number, y: number) => commands.push(`M${x},${y}`),
          lineTo: (x: number, y: number) => commands.push(`L${x},${y}`),
          addArc: () => commands.push("A"),
          close: () => commands.push("Z"),
        };
      },
    },
  },
}));

import { polarisWorldPoint } from "@/components/orrery/orrery-obstacle-logic";
import {
  type CameraPose,
  type CameraViewport,
  clampCameraPose,
  deriveHomePose,
  HOME_CAMERA,
  HOME_PROFILES,
  MAX_ZOOM,
  MIN_ZOOM,
  tryProjectWorldPoint,
  type WorldBody,
  worldExtent,
} from "@/logic/orrery-camera-logic";
import {
  type FocusCardRect,
  focusCardPlacement,
  HIDDEN_FOCUS_CARD,
} from "@/logic/orrery-focus-card-logic";
import {
  type AnimatedFrame,
  beginWorldTransition,
  projectAnimatedFrame,
} from "@/logic/orrery-frame";
import { POLARIS_RADIUS } from "@/logic/orrery-recovery-logic";
import type { ReorderDrag } from "@/logic/orrery-reorder-logic";
import {
  drawFocusReticle,
  drawOcclusion,
  drawOverlay,
  drawPolaris,
  drawReorderOutline,
  reticleGeometry,
  reticleLockState,
} from "./draw-overlay";
import { makeRingBands } from "./draw-plane";
import { collectOcclusion, type FocusDraw, NO_FOCUS_SPEC } from "./focus-fx";
import type { OrreryInk, OverlaySpec } from "./scene-specs";
import {
  RETICLE_LOCK_END,
  RETICLE_LOCK_SCALE,
  RETICLE_RING_ALPHA,
  RETICLE_SCAN_PARK,
} from "./visual-tunables";

const DEG = Math.PI / 180;
const viewport: CameraViewport = {
  width: 412,
  height: 780,
  usable: { x: 0, y: 64, width: 412, height: 620 },
};
// Float32-exact inks (Skia colours are Float32Array).
const ACCENT: OrreryInk = [0.125, 0.25, 0.875, 1];
const TEXT: OrreryInk = [0.875, 0.875, 0.9375, 1];
const HALO: OrreryInk = [0.75, 0.625, 0.25, 1];
const RETICLE: OrreryInk = [0.375, 0.5, 1, 1];
const OCCLUSION: OrreryInk = [0.03125, 0.0625, 0.125, 1];

interface Call {
  op: string;
  args: unknown[];
}
function recordingCanvas() {
  const calls: Call[] = [];
  const canvas = new Proxy(
    {},
    {
      get:
        (_t, op: string) =>
        (...args: unknown[]) => {
          calls.push({ op, args });
        },
    },
  );
  return { canvas: canvas as never, calls };
}
const effect = { makeShader: (uniforms: number[]) => ({ uniforms }) } as never;
const bands = makeRingBands();
const paintOf = (call: Call) =>
  call.args.at(-1) as { color: number[]; style: number; width: number };

function spec(overrides: Partial<OverlaySpec> = {}): OverlaySpec {
  return {
    ink: {
      accent: ACCENT,
      textPrimary: TEXT,
      polarisHalo: HALO,
      reticle: RETICLE,
      occlusion: OCCLUSION,
    },
    extent: 400,
    ...overrides,
  };
}
function ringWorld(count: number): WorldBody[] {
  return [
    { id: 0, kind: "sun", x: 0, y: 0, radius: 30, ringRadius: 0 },
    ...Array.from({ length: count }, (_, i): WorldBody => {
      const ring = 58 + i * 34;
      const angle = i * 2.399963229728653;
      return {
        id: i + 1,
        kind: "contact",
        x: ring * Math.sin(angle),
        y: -ring * Math.cos(angle),
        radius: 16,
        ringRadius: ring,
      };
    }),
  ];
}
function frameFor(
  world: WorldBody[],
  pose: CameraPose,
  extent = worldExtent(world),
): AnimatedFrame {
  return projectAnimatedFrame(
    beginWorldTransition([], world, 1),
    1,
    clampCameraPose(pose, extent),
    viewport,
    { extent },
  );
}
function drag(id: number, active = true): ReorderDrag {
  return {
    generation: 1,
    id,
    request: {} as never,
    radii: [],
    offset: { x: 0, y: 0 },
    reorderedVisibleIds: [],
    active,
    origin: { x: 0, y: 0 },
  };
}

beforeEach(() => {
  record.paths = [];
});

describe("Polaris (overlay picture)", () => {
  it("draws today's halo, 4-point star and centre dot at projected world north", () => {
    const world = ringWorld(4);
    const frame = frameFor(world, { ...HOME_CAMERA, zoom: 1 });
    const { canvas, calls } = recordingCanvas();
    expect(drawPolaris(canvas, frame, spec())).toBe(true);
    const north = tryProjectWorldPoint(
      polarisWorldPoint(400),
      frame.pose,
      viewport,
    )!;
    const [halo, star, dot] = calls;
    expect(halo.op).toBe("drawCircle");
    expect(halo.args.slice(0, 3)).toEqual([
      north.x,
      north.y,
      POLARIS_RADIUS * 1.5,
    ]);
    expect(paintOf(halo).color).toEqual([0.75, 0.625, 0.25, 0.25]);
    expect(star.op).toBe("drawPath");
    expect(record.paths[0]).toHaveLength(9);
    expect(record.paths[0][0]).toBe(`M${north.x},${north.y - 10}`);
    expect(record.paths[0].at(-1)).toBe("Z");
    expect(paintOf(star).color).toEqual([...TEXT]);
    expect(dot.op).toBe("drawCircle");
    expect(dot.args[2]).toBe(2);
  });
  it("H2: beyond the horizon (62°, north behind the camera) it records nothing and never throws", () => {
    const extent = 2000;
    const pose = {
      ...HOME_CAMERA,
      tilt: 62 * DEG,
      zoom: MAX_ZOOM,
      yaw: Math.PI,
      y: extent,
    };
    const frame = frameFor(ringWorld(2), pose, extent);
    expect(
      tryProjectWorldPoint(polarisWorldPoint(extent), frame.pose, viewport),
    ).toBeNull();
    const { canvas, calls } = recordingCanvas();
    expect(() => drawPolaris(canvas, frame, spec({ extent }))).not.toThrow();
    expect(calls).toHaveLength(0);
  });
});

describe("reorder outline (overlay picture)", () => {
  it("while held: the held orbit on the world plane in accent ink, plus the ring around the body", () => {
    const frame = frameFor(ringWorld(3), {
      ...HOME_CAMERA,
      zoom: 1,
      tilt: 0,
      lensShift: 1,
    });
    const held = frame.bodies.find((b) => b.id === 2)!;
    const { canvas, calls } = recordingCanvas();
    expect(
      drawReorderOutline(canvas, frame, drag(2), spec(), effect, bands, 0.5),
    ).toBe(true);
    const vertices = calls.filter((c) => c.op === "drawVertices");
    expect(vertices).toHaveLength(1);
    const uniforms = (vertices[0].args[2] as { shader: { uniforms: number[] } })
      .shader.uniforms;
    expect(uniforms[9]).toBe(held.worldRingRadius);
    expect(uniforms[10]).toBe(1); // 2 dp line
    expect(uniforms[12]).toBe(0); // solid
    expect(uniforms.slice(15, 19)).toEqual([...ACCENT]);
    // A plain outline: no sun light, no depth fade, the whole ring.
    expect(uniforms.slice(19, 24)).toEqual([1, 0, 1, 0, 1]);
    expect(uniforms.slice(28, 30)).toEqual([0, 0]);
    const circle = calls.find((c) => c.op === "drawCircle")!;
    expect(circle.args.slice(0, 3)).toEqual([held.x, held.y, held.radius + 4]);
    expect(paintOf(circle)).toMatchObject({ style: 1, width: 2 });
    expect(paintOf(circle).color).toEqual([...ACCENT]);
  });
  it("nothing without an active hold", () => {
    const frame = frameFor(ringWorld(3), { ...HOME_CAMERA, zoom: 1 });
    for (const held of [null, drag(2, false), drag(99)]) {
      const { canvas, calls } = recordingCanvas();
      expect(
        drawReorderOutline(canvas, frame, held, spec(), effect, bands, 0.5),
      ).toBe(false);
      expect(calls).toHaveLength(0);
    }
  });
  it("H2: a culled held body gets no screen circle; its orbit is skipped when the disc is wholly beyond the horizon", () => {
    const pose = {
      ...HOME_CAMERA,
      x: 0,
      y: 3000,
      zoom: 4,
      tilt: 62 * DEG,
      yaw: Math.PI,
    };
    const world: WorldBody[] = [
      { id: 1, kind: "contact", x: 0, y: -100, radius: 16, ringRadius: 100 },
      {
        id: 2,
        kind: "contact",
        x: 3000,
        y: 0,
        radius: 16,
        ringRadius: 3000,
      },
    ];
    const frame = frameFor(world, pose, 6000);
    expect(frame.bodies[0].culled).toBe(true);
    const inner = recordingCanvas();
    expect(
      drawReorderOutline(
        inner.canvas,
        frame,
        drag(1),
        spec(),
        effect,
        bands,
        1,
      ),
    ).toBe(false);
    expect(inner.calls).toHaveLength(0);
    // The outer ring still crosses the screen: its visible arc is drawn even
    // when the held body itself is culled (no circle then).
    const culledOuter = { ...frame, bodies: [...frame.bodies] };
    culledOuter.bodies[1] = { ...culledOuter.bodies[1], culled: true };
    const outer = recordingCanvas();
    drawReorderOutline(
      outer.canvas,
      culledOuter,
      drag(2),
      spec(),
      effect,
      bands,
      1,
    );
    expect(outer.calls.filter((c) => c.op === "drawVertices")).toHaveLength(1);
    expect(outer.calls.filter((c) => c.op === "drawCircle")).toHaveLength(0);
  });
});

/** A single focus on `key`, fully mixed, at lock-on time `lock`. */
function focusOn(key: string, lock = RETICLE_LOCK_END, mix = 1): FocusDraw {
  return {
    spec: {
      ...NO_FOCUS_SPEC,
      keys: { [key]: true },
      active: true,
      reticle: key,
      ringDim: 0.65,
    },
    mix,
    lock,
  };
}

describe("38.7-11 (D-18): the reticle's lock-on, then still", () => {
  it("converges, flashes and pings during the lock-on, then holds still", () => {
    const start = reticleLockState(0);
    expect(start.scale).toBeCloseTo(RETICLE_LOCK_SCALE, 12);
    expect(start.rotation).toBeGreaterThan(0);
    expect(start.ringAlpha).toBe(0);
    // The flash and the ping happen inside the timeline only.
    expect(reticleLockState(1).flashAlpha).toBeGreaterThan(0);
    expect(reticleLockState(1.5).ping).toBeCloseTo(0.5, 12);
    const locked = reticleLockState(RETICLE_LOCK_END);
    expect(locked).toEqual({
      scale: 1,
      rotation: 0,
      bracketAlpha: 1,
      ringAlpha: RETICLE_RING_ALPHA,
      flashAlpha: 0,
      ping: null,
      scan: RETICLE_SCAN_PARK,
    });
    // No idle motion (D-37): anything at or past the end is the same state,
    // and a bad clock value is treated as locked.
    expect(reticleLockState(RETICLE_LOCK_END + 5)).toEqual(locked);
    expect(reticleLockState(Number.NaN)).toEqual(locked);
  });

  it("is Lab A's bracket box: drawn radius + gap, arms clamped", () => {
    expect(reticleGeometry(10)).toEqual({ half: 15, arm: 6 });
    const big = reticleGeometry(100);
    expect(big.half).toBeCloseTo(116, 12);
    expect(big.arm).toBe(15);
    expect(reticleGeometry(0)).toEqual({ half: 5, arm: 6 });
  });

  it("only for the single focused body; never for a culled body, a cluster or at mix 0", () => {
    const frame = frameFor(ringWorld(2), { ...HOME_CAMERA, zoom: 2, tilt: 0 });
    const overlay = spec();
    expect(
      drawFocusReticle(
        recordingCanvas().canvas,
        frame,
        overlay,
        focusOn("contact:1"),
      ),
    ).toBe(true);
    expect(
      drawFocusReticle(recordingCanvas().canvas, frame, overlay, null),
    ).toBe(false);
    const cluster: FocusDraw = {
      ...focusOn("contact:1"),
      spec: { ...focusOn("contact:1").spec, reticle: null },
    };
    expect(
      drawFocusReticle(recordingCanvas().canvas, frame, overlay, cluster),
    ).toBe(false);
    expect(
      drawFocusReticle(
        recordingCanvas().canvas,
        frame,
        overlay,
        focusOn("contact:1", RETICLE_LOCK_END, 0),
      ),
    ).toBe(false);
    const culled = frameFor(
      [{ id: 1, kind: "contact", x: 0, y: -100, radius: 16, ringRadius: 100 }],
      { ...HOME_CAMERA, x: 0, y: 3000, zoom: 4, tilt: 62 * DEG, yaw: Math.PI },
      6000,
    );
    expect(culled.bodies[0].culled).toBe(true);
    const { canvas, calls } = recordingCanvas();
    expect(
      drawFocusReticle(canvas, culled, overlay, focusOn("contact:1")),
    ).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe("38.7-11 (D-55/H5): the occlusion dim", () => {
  it("merges the static panels with the focus card's live rect; a hidden card adds none", () => {
    const panel = { x: 10, y: 10, width: 100, height: 40 };
    const card: FocusCardRect = {
      x: 20,
      y: 500,
      width: 280,
      height: 180,
      maxHeight: 300,
      visible: true,
    };
    expect(collectOcclusion([panel], card)).toEqual([
      panel,
      { x: 20, y: 500, width: 280, height: 180 },
    ]);
    expect(collectOcclusion([panel], HIDDEN_FOCUS_CARD)).toEqual([panel]);
    expect(collectOcclusion([], null)).toEqual([]);
  });

  it("follows the card through a focus animation (the same placement, every sample) and drops it when the body is culled", () => {
    const world = ringWorld(3);
    const from = clampCameraPose({ ...HOME_CAMERA, zoom: 1 }, 400);
    const to = clampCameraPose(
      { ...HOME_CAMERA, zoom: 3.2, x: world[1].x, y: world[1].y },
      400,
    );
    for (let i = 0; i <= 8; i++) {
      const f = i / 8;
      const pose = clampCameraPose(
        {
          ...from,
          x: from.x + (to.x - from.x) * f,
          y: from.y + (to.y - from.y) * f,
          zoom: from.zoom + (to.zoom - from.zoom) * f,
        },
        400,
      );
      const frame = frameFor(world, pose);
      const body = frame.bodies.find((b) => b.id === 1)!;
      const card = focusCardPlacement(frame.viewport, body, 180);
      const rects = collectOcclusion([], card);
      expect(rects).toEqual([
        { x: card.x, y: card.y, width: card.width, height: card.height },
      ]);
    }
    const culled = frameFor(
      [{ id: 1, kind: "contact", x: 0, y: -100, radius: 16, ringRadius: 100 }],
      { ...HOME_CAMERA, x: 0, y: 3000, zoom: 4, tilt: 62 * DEG, yaw: Math.PI },
      6000,
    );
    expect(
      collectOcclusion(
        [],
        focusCardPlacement(culled.viewport, culled.bodies[0], 180),
      ),
    ).toEqual([]);
  });

  it("skips a non-finite or empty rect instead of drawing it", () => {
    const { canvas, calls } = recordingCanvas();
    expect(
      drawOcclusion(
        canvas,
        [
          { x: Number.NaN, y: 0, width: 10, height: 10 },
          { x: 0, y: 0, width: 0, height: 10 },
          { x: 0, y: 0, width: 10, height: 10 },
        ],
        spec(),
      ),
    ).toBe(1);
    expect(calls.filter((c) => c.op === "drawRRect")).toHaveLength(1);
  });
});

describe("H2: the whole overlay on a 1,000-ring System at the pan/yaw extremes", () => {
  it("records without throwing at 0/45/62°, MIN/Home/MAX zoom, with focus and a hold", () => {
    const world = ringWorld(1000);
    const extent = worldExtent(world);
    const focusKeys = [1, 250, 999].map((id) => `contact:${id}`);
    // The reorder hold, the reticle at three points of its lock-on, and the
    // occlusion over two panels and the docked card.
    const panels = [
      { x: 0, y: 0, width: 412, height: 60 },
      { x: 300, y: 500, width: 100, height: 200 },
    ];
    let polarisHidden = 0,
      reticlesSkipped = 0;
    for (const tilt of [0, 45 * DEG, HOME_PROFILES.tilted.tilt]) {
      const home = deriveHomePose(world, viewport, {
        ...HOME_PROFILES.tilted,
        tilt,
      })!;
      for (const [px, py] of [
        [extent, 0],
        [-extent, 0],
        [0, extent],
        [0, -extent],
      ])
        for (const yaw of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2])
          for (const zoom of [MIN_ZOOM, home.zoom, MAX_ZOOM]) {
            const frame = frameFor(
              world,
              { ...home, x: px, y: py, yaw, zoom },
              extent,
            );
            const overlay = spec({ extent });
            for (const key of focusKeys)
              for (const lock of [0, 1.5, RETICLE_LOCK_END]) {
                const { canvas, calls } = recordingCanvas();
                const body = frame.bodies.find(
                  (b) => `contact:${b.id}` === key,
                )!;
                const card = focusCardPlacement(frame.viewport, body, 180);
                expect(() =>
                  drawOverlay(
                    canvas,
                    frame,
                    overlay,
                    drag(500),
                    effect,
                    bands,
                    0.4,
                    focusOn(key, lock),
                    collectOcclusion(panels, card),
                  ),
                ).not.toThrow();
                for (const call of calls)
                  for (const arg of call.args)
                    if (typeof arg === "number")
                      expect(Number.isFinite(arg)).toBe(true);
                if (
                  lock === RETICLE_LOCK_END &&
                  !drawFocusReticle(
                    recordingCanvas().canvas,
                    frame,
                    overlay,
                    focusOn(key),
                  )
                )
                  reticlesSkipped++;
              }
            if (!drawPolaris(recordingCanvas().canvas, frame, overlay))
              polarisHidden++;
          }
    }
    expect(polarisHidden).toBeGreaterThan(0);
    expect(reticlesSkipped).toBeGreaterThan(0);
  });
});
