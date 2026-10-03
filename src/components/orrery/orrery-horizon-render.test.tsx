/**
 * 38.7-05 (H2): the legacy Polaris marker stays horizon-safe until Plan 06
 * moves it into the overlay picture. Polaris hides (opacity 0) instead of
 * throwing when world north is beyond the horizon. (Orbit rings are drawn on
 * the world plane since 38.7-06; their horizon tests live in
 * v2/draw-plane.test.ts.)
 */
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  type CameraViewport,
  clampCameraPose,
  HOME_CAMERA,
  MAX_ZOOM,
  projectFrame,
} from "@/logic/orrery-camera-logic";
import { THEME_PRESETS } from "@/theme/theme-presets";
import { Polaris } from "./Polaris";

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

describe("38.7-05 H2: legacy Polaris at the horizon", () => {
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
});
