import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { WorldBody } from "@/logic/orrery-camera-logic";
import { projectAnimatedFrame } from "@/logic/orrery-frame";
import {
  PREVIEW_HIT_PADDING,
  PREVIEW_LAYER,
  PREVIEW_MAX_ZOOM,
  PREVIEW_MIN_ZOOM,
  previewBodyAt,
  previewCanvasMounted,
  previewHomeZoom,
  previewMemberOptions,
  previewMembershipSummary,
  previewPose,
  previewTransition,
} from "./system-preview-logic";

const VIEWPORT = { width: 400, height: 800 };
const WORLD: WorldBody[] = [
  { id: 0, kind: "sun", x: 0, y: 0, radius: 30, ringRadius: 0 },
  { id: 7, kind: "contact", x: -58, y: 0, radius: 16, ringRadius: 58 },
  { id: 9, kind: "contact", x: 0, y: 92, radius: 18, ringRadius: 92 },
  {
    id: -1,
    kind: "satellite",
    x: -40,
    y: 0,
    radius: 4,
    ringRadius: 0,
    satelliteTarget: {
      kind: "satellite",
      uid: "m",
      parentId: 7,
      parentUid: "p",
    },
  },
];

function frameAt(panX: number, panY: number, zoom: number) {
  return projectAnimatedFrame(
    previewTransition(WORLD, 1),
    1,
    previewPose(panX, panY, zoom),
    VIEWPORT,
  );
}

describe("38.7-14 (D-57): the Preview camera is always flat", () => {
  it.each([
    [0, 0, 1],
    [120, -80, 2.5],
    [-300, 500, 0.1],
    [Number.NaN, Number.POSITIVE_INFINITY, Number.NaN],
  ])(
    "pan (%s, %s) zoom %s → tilt 0, yaw 0, the flat lens, a clamped zoom",
    (x, y, z) => {
      const pose = previewPose(x, y, z);
      expect(pose.tilt).toBe(0);
      expect(pose.yaw).toBe(0);
      expect(pose.lensShift).toBe(1);
      expect(pose.zoom).toBeGreaterThanOrEqual(PREVIEW_MIN_ZOOM);
      expect(pose.zoom).toBeLessThanOrEqual(PREVIEW_MAX_ZOOM);
      expect(Number.isFinite(pose.x) && Number.isFinite(pose.y)).toBe(true);
      const frame = frameAt(x, y, z);
      expect(frame.pose.tilt ?? 0).toBe(0);
      expect(frame.pose.yaw ?? 0).toBe(0);
    },
  );

  it("projects like the old 2D preview: centre + pan + world × zoom", () => {
    const frame = frameAt(30, -20, 1.5);
    const ada = frame.bodies.find((b) => b.id === 7)!;
    expect(ada.x).toBeCloseTo(VIEWPORT.width / 2 + 30 - 58 * 1.5, 6);
    expect(ada.y).toBeCloseTo(VIEWPORT.height / 2 - 20, 6);
  });

  it("the world is settled (present and interactive) and carries no moons", () => {
    const transition = previewTransition(WORLD, 3);
    expect(transition.generation).toBe(3);
    expect(transition.to.map((b) => b.id)).toEqual([0, 7, 9]);
    for (const body of transition.to) {
      expect(body.opacity).toBe(1);
      expect(body.interactive).toBe(true);
    }
  });

  it("Home frames the whole System, within the pinch range and never above 1", () => {
    expect(previewHomeZoom(100, 400, 800)).toBe(1);
    expect(previewHomeZoom(1000, 400, 800)).toBe(PREVIEW_MIN_ZOOM);
    expect(previewHomeZoom(300, 400, 800)).toBeCloseTo(352 / 600, 6);
    expect(previewHomeZoom(Number.NaN, 400, 800)).toBe(1);
  });
});

describe("38.7-14: tap resolves the nearest member in the drawn frame", () => {
  it("a tap on a contact (within its disc plus padding) focuses it; the sun and empty sky do not", () => {
    const frame = frameAt(0, 0, 1);
    const ada = frame.bodies.find((b) => b.id === 7)!;
    expect(previewBodyAt(frame, ada.x, ada.y)).toBe(7);
    expect(
      previewBodyAt(frame, ada.x + ada.radius + PREVIEW_HIT_PADDING - 1, ada.y),
    ).toBe(7);
    const sun = frame.bodies.find((b) => b.kind === "sun")!;
    expect(previewBodyAt(frame, sun.x, sun.y)).toBeNull();
    expect(previewBodyAt(frame, 5, 5)).toBeNull();
    expect(previewBodyAt(frame, Number.NaN, 5)).toBeNull();
  });

  it("follows pan and pinch (the same frame the pictures draw)", () => {
    const frame = frameAt(-100, 60, 2);
    const bea = frame.bodies.find((b) => b.id === 9)!;
    expect(bea.x).toBeCloseTo(VIEWPORT.width / 2 - 100, 6);
    expect(previewBodyAt(frame, bea.x, bea.y)).toBe(9);
  });
});

describe("38.7-14: lifecycle and scope", () => {
  it("the canvas mounts only while the route is focused and the app active", () => {
    expect(previewCanvasMounted(true, true)).toBe(true);
    expect(previewCanvasMounted(false, true)).toBe(false);
    expect(previewCanvasMounted(true, false)).toBe(false);
    expect(previewCanvasMounted(false, false)).toBe(false);
  });

  it("D-57: the Preview canvas mounts its four flat layers only — no warp, pulses, reticle, labels or ambient clock", () => {
    const source = readFileSync(
      "src/components/orrery/SystemPreviewCanvas.tsx",
      "utf8",
    );
    expect(source).toContain(
      "if (!previewCanvasMounted(focused, appActive)) return null;",
    );
    expect(source.match(/<Picture picture=\{(\w+)\} \/>/g)).toEqual([
      "<Picture picture={skyPicture} />",
      "<Picture picture={planePicture} />",
      "<Picture picture={bodiesPicture} />",
      "<Picture picture={focusPicture} />",
    ]);
    for (const banned of [
      "drawPlanePulses",
      "drawOrbitTrails",
      "drawSwitch",
      "drawReticle",
      "drawFocusReticle",
      "drawOverlay",
      "drawLabels",
      "useOrreryAmbient",
      "WARP_STRENGTH",
    ])
      expect(source, banned).not.toContain(banned);
    // The sky is still (no drift, no twinkle) and never warps (no signal).
    expect(source).toMatch(/STILL_AMBIENT,\s*skyEffect,\s*null,/);
    expect(source).toContain("pulseBudget: 0");
    // The pose comes only from previewPose (flat).
    expect(source).toContain("previewPose(panX.value, panY.value, zoom.value)");
    expect(Object.values(PREVIEW_LAYER).sort()).toEqual([
      "preview-bodies",
      "preview-focus",
      "preview-plane",
      "preview-sky",
    ]);
  });
});

describe("System preview membership", () => {
  it("uses the copy-contract membership summary", () => {
    expect(previewMembershipSummary([])).toBe("0 members");
    expect(previewMembershipSummary([{ id: 1 }])).toBe("1 member");
    expect(previewMembershipSummary([{ id: 1 }, { id: 2 }])).toBe("2 members");
  });

  it("provides named, non-canvas focus targets for every preview member", () => {
    expect(
      previewMemberOptions([
        { id: 7, name: "Alex" },
        { id: 9, name: "Bea" },
      ]),
    ).toEqual([
      { id: 7, name: "Alex" },
      { id: 9, name: "Bea" },
    ]);
  });
});
