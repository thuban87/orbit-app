import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import {
  type LayoutChangeEvent,
  useWindowDimensions,
  type View,
} from "react-native";
import type { CameraRect } from "@/logic/orrery-camera-logic";
import {
  createWindowMeasurement,
  useShellObstacleStore,
} from "@/stores/shell-obstacle-store";
import { useShellTopOffset } from "@/stores/shell-offset-store";

/** Measure actual native views on discrete layout/visibility changes, never a frame loop. */
export function useWindowMeasurement(
  publish: (rect: CameraRect | null) => void,
  enabled = true,
  revision: unknown = null,
) {
  const ref = useRef<View>(null);
  const latest = useRef(publish);
  latest.current = publish;
  const measurement = useMemo(
    () => createWindowMeasurement((rect) => latest.current(rect)),
    [],
  );
  const { width, height, fontScale } = useWindowDimensions();
  // 38.6 review WR5-01: the in-flow assist banner (D-38) shifts every screen
  // below it without firing a view's own onLayout when the view keeps its
  // frame relative to its parent, so its height is a re-measure trigger.
  const shellTopOffset = useShellTopOffset();
  const measure = useCallback(() => {
    if (!enabled || !ref.current) {
      measurement.clear();
      return;
    }
    ref.current.measureInWindow(measurement.begin());
  }, [enabled, measurement]);
  useLayoutEffect(() => {
    // revision includes positioning inputs that can move a native ancestor;
    // shellTopOffset moves the whole navigator.
    void revision;
    void width;
    void height;
    void fontScale;
    void shellTopOffset;
    measure();
    return () => measurement.clear();
  }, [
    measure,
    measurement,
    revision,
    width,
    height,
    fontScale,
    shellTopOffset,
  ]);
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      if (!(width > 0 && height > 0)) measurement.clear();
      else measure();
    },
    [measure, measurement],
  );
  return { ref, onLayout, measure };
}

export function useWindowObstacle(
  key: string,
  enabled = true,
  revision: unknown = null,
) {
  const publish = useCallback(
    (rect: CameraRect | null) =>
      useShellObstacleStore.getState().publish(key, rect),
    [key],
  );
  return useWindowMeasurement(publish, enabled, revision);
}
