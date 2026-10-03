/**
 * 38.7-05 (H2): the legacy Polaris marker and projected orbit rings stay
 * horizon-safe until Plan 06 replaces them. Polaris hides (opacity 0) instead
 * of throwing when world north is beyond the horizon; a ring that lost samples
 * is drawn as open arcs, never closed across the gap.
 */
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  type CameraViewport,
  clampCameraPose,
  HOME_CAMERA,
  MAX_ZOOM,
  projectFrame,
  type WorldBody,
} from "@/logic/orrery-camera-logic";
import {
  beginWorldTransition,
  projectAnimatedFrame,
} from "@/logic/orrery-frame";
import { THEME_PRESETS } from "@/theme/theme-presets";
import { Polaris } from "./Polaris";
import { ProjectedOrbitRing } from "./ProjectedOrbitRing";

const pen = vi.hoisted(() => ({ commands: [] as string[] }));
vi.mock("react-native-reanimated", () => ({
  useDerivedValue: (fn: () => unknown) => ({ value: fn() }),
}));
vi.mock("@shopify/react-native-skia", () => ({
  Group: "Group",
  Circle: "Circle",
  Path: "Path",
  DashPathEffect: "DashPathEffect",
  Skia: {
    Path: {
      Make: () => ({
        moveTo: () => pen.commands.push("M"),
        lineTo: () => pen.commands.push("L"),
        close: () => pen.commands.push("Z"),
      }),
    },
  },
}));

const viewport: CameraViewport = { width: 412, height: 780 };
const colors = THEME_PRESETS.galaxy.dark;
type Props = Record<string, unknown> & {
  transform?: { value: unknown };
  opacity?: { value: unknown };
};
const render = (element: ReactElement) =>
  (element.type as (props: unknown) => ReactElement<Props>)(element.props);

describe("38.7-05 H2: legacy Polaris and orbit rings at the horizon", () => {
  it("Polaris shows at a visible north and hides (no throw) beyond the horizon", () => {
    const extent = 2000;
    const visible = projectFrame(
      [],
      clampCameraPose({ ...HOME_CAMERA, zoom: 1 }, extent),
      viewport,
      1,
      { extent },
    );
    const shown = render(
      <Polaris frame={{ value: visible }} extent={extent} colors={colors} />,
    );
    expect(shown.props.opacity?.value).toBe(1);
    // Looking south (yaw π) from close up: world north is behind the camera.
    const behind = projectFrame(
      [],
      clampCameraPose(
        { ...HOME_CAMERA, zoom: MAX_ZOOM, yaw: Math.PI, y: extent },
        extent,
      ),
      viewport,
      1,
      { extent },
    );
    const hidden = render(
      <Polaris frame={{ value: behind }} extent={extent} colors={colors} />,
    );
    expect(hidden.props.opacity?.value).toBe(0);
    expect(hidden.props.transform?.value).toEqual([
      { translateX: 0 },
      { translateY: 0 },
    ]);
  });
  it("a ring with samples beyond the horizon is drawn open; a complete ring closes", () => {
    const world: WorldBody[] = [
      { id: 1, kind: "contact", x: 0, y: -60, radius: 16, ringRadius: 60 },
      { id: 2, kind: "contact", x: 0, y: -400, radius: 16, ringRadius: 400 },
    ];
    const frame = projectAnimatedFrame(
      beginWorldTransition([], world, 1),
      1,
      clampCameraPose({ ...HOME_CAMERA, zoom: 2 }, 400),
      viewport,
    );
    const style = {
      color: colors.textPrimary,
      width: 1,
      opacity: 1,
      strokeStyle: "solid",
    } as never;
    pen.commands = [];
    render(
      <ProjectedOrbitRing
        identity="contact:1"
        frame={{ value: frame } as never}
        style={style}
      />,
    );
    expect(pen.commands.at(-1)).toBe("Z");
    expect(pen.commands.filter((c) => c === "M")).toHaveLength(1);
    pen.commands = [];
    render(
      <ProjectedOrbitRing
        identity="contact:2"
        frame={{ value: frame } as never}
        style={style}
      />,
    );
    expect(frame.bodies[1].ringClosed).toBe(false);
    expect(pen.commands).not.toContain("Z");
    expect(pen.commands.length).toBe(frame.bodies[1].ringPath.length);
  });
});
