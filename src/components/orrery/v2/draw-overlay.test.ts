import { beforeEach, describe, expect, it, vi } from "vitest";

const record = vi.hoisted(() => ({ paths: [] as string[][] }));
vi.mock("@shopify/react-native-skia", () => ({
  BlendMode: { Dst: 2 },
  PaintStyle: { Fill: 0, Stroke: 1 },
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
      };
      return paint;
    },
    Path: {
      Make: () => {
        const commands: string[] = [];
        record.paths.push(commands);
        return {
          moveTo: (x: number, y: number) => commands.push(`M${x},${y}`),
          lineTo: (x: number, y: number) => commands.push(`L${x},${y}`),
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
  type AnimatedFrame,
  beginWorldTransition,
  projectAnimatedFrame,
} from "@/logic/orrery-frame";
import { POLARIS_RADIUS } from "@/logic/orrery-recovery-logic";
import type { ReorderDrag } from "@/logic/orrery-reorder-logic";
import {
  drawFocusOutlines,
  drawOverlay,
  drawPolaris,
  drawReorderOutline,
} from "./draw-overlay";
import { makeRingBands } from "./draw-plane";
import type { OrreryInk, OverlaySpec } from "./scene-specs";

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
    ink: { accent: ACCENT, textPrimary: TEXT, polarisHalo: HALO },
    extent: 400,
    focus: [],
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

describe("focus outlines (overlay picture)", () => {
  it("today's accent ring: gap and 2-unit stroke scaled with the body, at its opacity", () => {
    const frame = frameFor(ringWorld(2), { ...HOME_CAMERA, zoom: 2, tilt: 0 });
    const contact = frame.bodies.find((b) => b.id === 1)!;
    const sun = frame.bodies.find((b) => b.kind === "sun")!;
    const { canvas, calls } = recordingCanvas();
    const drawn = drawFocusOutlines(
      canvas,
      frame,
      spec({
        focus: [
          { key: "contact:1", worldRadius: 16, gap: 4 },
          { key: "sun:0", worldRadius: 30, gap: 6 },
        ],
      }),
    );
    expect(drawn).toBe(2);
    const [a, b] = calls;
    const scaleA = contact.radius / 16;
    expect(a.args.slice(0, 3)).toEqual([
      contact.x,
      contact.y,
      contact.radius + 4 * scaleA,
    ]);
    expect(paintOf(a)).toMatchObject({ style: 1, width: 2 * scaleA });
    expect(paintOf(a).color).toEqual([...ACCENT]);
    const scaleB = sun.radius / 30;
    expect(b.args[2]).toBe(sun.radius + 6 * scaleB);
  });
  it("H2: a culled focused body draws no outline", () => {
    const pose = {
      ...HOME_CAMERA,
      x: 0,
      y: 3000,
      zoom: 4,
      tilt: 62 * DEG,
      yaw: Math.PI,
    };
    const frame = frameFor(
      [{ id: 1, kind: "contact", x: 0, y: -100, radius: 16, ringRadius: 100 }],
      pose,
      6000,
    );
    expect(frame.bodies[0].culled).toBe(true);
    const { canvas, calls } = recordingCanvas();
    expect(
      drawFocusOutlines(
        canvas,
        frame,
        spec({ focus: [{ key: "contact:1", worldRadius: 16, gap: 4 }] }),
      ),
    ).toBe(0);
    expect(calls).toHaveLength(0);
  });
});

describe("H2: the whole overlay on a 1,000-ring System at the pan/yaw extremes", () => {
  it("records without throwing at 0/45/62°, MIN/Home/MAX zoom, with focus and a hold", () => {
    const world = ringWorld(1000);
    const extent = worldExtent(world);
    const focus = [1, 250, 999].map((id) => ({
      key: `contact:${id}`,
      worldRadius: 16,
      gap: 4,
    }));
    let polarisHidden = 0,
      outlinesSkipped = 0;
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
            const { canvas, calls } = recordingCanvas();
            const overlay = spec({ extent, focus });
            expect(() =>
              drawOverlay(
                canvas,
                frame,
                overlay,
                drag(500),
                effect,
                bands,
                0.4,
              ),
            ).not.toThrow();
            for (const call of calls)
              for (const arg of call.args)
                if (typeof arg === "number")
                  expect(Number.isFinite(arg)).toBe(true);
            if (!drawPolaris(recordingCanvas().canvas, frame, overlay))
              polarisHidden++;
            outlinesSkipped +=
              focus.length -
              drawFocusOutlines(recordingCanvas().canvas, frame, overlay);
          }
    }
    expect(polarisHidden).toBeGreaterThan(0);
    expect(outlinesSkipped).toBeGreaterThan(0);
  });
});
