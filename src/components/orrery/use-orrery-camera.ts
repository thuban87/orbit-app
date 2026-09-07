/** ADR-077: one UI-thread pose/input owner; native adapters publish only discrete intents. */
import { useEffect, useMemo } from "react";
import { Gesture } from "react-native-gesture-handler";
import {
  cancelAnimation,
  runOnJS,
  runOnUI,
  type SharedValue,
  useSharedValue,
} from "react-native-reanimated";
import {
  type CameraCell,
  type CameraPose,
  type OrreryIntent,
  type ProjectedFrame,
  tapIntent,
} from "@/logic/orrery-camera-logic";
import {
  beginInput,
  type CameraInput,
  cameraGestureStep,
  cancelInput,
  initialInput,
  moveInput,
  PAN_DISTANCE,
  TAP_DISTANCE,
  TILT_DISTANCE,
} from "@/logic/orrery-gesture-logic";

interface GestureSamples {
  panX: number;
  panY: number;
  scale: number;
  rotation: number;
  tiltY: number;
  tiltActive: boolean;
}
const initialSamples = (): GestureSamples => ({
  panX: 0,
  panY: 0,
  scale: 1,
  rotation: 0,
  tiltY: 0,
  tiltActive: false,
});
export interface OrreryCameraInput {
  input: CameraCell<CameraInput>;
  samples: CameraCell<GestureSamples>;
  live: CameraCell<boolean>;
}
export function useOrreryCamera({
  pose,
  enabled,
}: {
  pose: SharedValue<CameraPose>;
  enabled: boolean;
}) {
  const input = useSharedValue(initialInput());
  const samples = useSharedValue(initialSamples());
  const live = useSharedValue(enabled);
  const stop = useMemo(
    () => () => {
      "worklet";
      cancelAnimation(pose);
    },
    [pose],
  );
  useEffect(() => {
    runOnUI(() => {
      "worklet";
      live.value = enabled;
      if (!enabled) {
        stop();
        input.value = cancelInput(input.value);
      }
    })();
    return () => {
      runOnUI(() => {
        "worklet";
        live.value = false;
        input.value = cancelInput(input.value);
        stop();
      })();
    };
  }, [enabled, live, input, stop]);
  return useMemo(
    () => ({ input, samples, live, stop }),
    [input, samples, live, stop],
  );
}

/** Export remains available to the real-SQL tracer. Plain cells are test-only defaults. */
export function createOrreryGestures({
  pose,
  frame,
  extent,
  send,
  stop,
  enabled = true,
  camera = {
    input: { value: initialInput() },
    samples: { value: initialSamples() },
    live: { value: enabled },
  },
  coast = () => {},
  onNorth,
  panStart,
}: {
  pose: CameraCell<CameraPose>;
  frame: CameraCell<ProjectedFrame>;
  extent: number;
  send: (intent: OrreryIntent) => void;
  stop: () => void;
  enabled?: boolean;
  camera?: OrreryCameraInput;
  coast?: (kind: "pan" | "yaw", vx: number, vy: number) => void;
  onNorth?: (x: number, y: number) => boolean;
  panStart?: CameraCell<CameraPose | null>;
}) {
  const { input, samples, live } = camera;
  const touch = (pointers: number) => {
    "worklet";
    stop();
    input.value = moveInput(input.value, pointers, 0);
  };
  const tap = Gesture.Tap()
    .enabled(enabled)
    .maxDistance(TAP_DISTANCE)
    .onBegin(() => {
      "worklet";
      stop();
      input.value = beginInput(input.value, 1);
    })
    .onTouchesDown((event) => {
      "worklet";
      touch(event.numberOfTouches);
    })
    .onEnd((event, success) => {
      "worklet";
      if (!success || !live.value || input.value.owner !== "pending") return;
      if (onNorth?.(event.x, event.y)) return;
      runOnJS(send)(tapIntent(frame.value, event.x, event.y, true));
    });
  const pan = Gesture.Pan()
    .enabled(enabled)
    .minDistance(PAN_DISTANCE)
    .maxPointers(1)
    .onBegin(() => {
      "worklet";
      stop();
      if (input.value.owner === "idle" || input.value.owner === "cancelled")
        input.value = beginInput(input.value, 1);
      samples.value = { ...samples.value, panX: 0, panY: 0 };
      if (panStart) panStart.value = pose.value;
    })
    .onTouchesDown((event) => {
      "worklet";
      touch(event.numberOfTouches);
    })
    .onUpdate((event) => {
      "worklet";
      if (!live.value) return;
      const previous = input.value;
      input.value = moveInput(
        previous,
        event.numberOfPointers,
        Math.hypot(event.translationX, event.translationY),
      );
      const sample = samples.value;
      samples.value = {
        ...sample,
        panX: event.translationX,
        panY: event.translationY,
      };
      if (input.value.owner !== "pan" || previous.owner === "multi") return;
      pose.value = cameraGestureStep(
        pose.value,
        {
          kind: "pan",
          dx: event.translationX - sample.panX,
          dy: event.translationY - sample.panY,
        },
        frame.value.viewport,
        extent,
      );
    })
    .onEnd((event, success) => {
      "worklet";
      if (
        success &&
        live.value &&
        input.value.owner === "pan" &&
        event.numberOfPointers <= 1
      )
        coast("pan", event.velocityX, event.velocityY);
    })
    .onFinalize(() => {
      "worklet";
      if (panStart) panStart.value = null;
      if (input.value.owner !== "multi") input.value = cancelInput(input.value);
    });
  const pinch = Gesture.Pinch()
    .enabled(enabled)
    .onStart((event) => {
      "worklet";
      touch(2);
      samples.value = { ...samples.value, scale: event.scale };
    })
    .onUpdate((event) => {
      "worklet";
      if (
        !live.value ||
        input.value.owner !== "multi" ||
        event.numberOfPointers !== 2
      )
        return;
      const previous = samples.value.scale;
      samples.value = { ...samples.value, scale: event.scale };
      pose.value = cameraGestureStep(
        pose.value,
        {
          kind: "pinch",
          delta: event.scale / previous,
          focal: { x: event.focalX, y: event.focalY },
        },
        frame.value.viewport,
        extent,
      );
    })
    .onFinalize(() => {
      "worklet";
      samples.value = { ...samples.value, scale: 1 };
    });
  const rotation = Gesture.Rotation()
    .enabled(enabled)
    .onStart((event) => {
      "worklet";
      touch(2);
      samples.value = { ...samples.value, rotation: event.rotation };
    })
    .onUpdate((event) => {
      "worklet";
      if (
        !live.value ||
        input.value.owner !== "multi" ||
        event.numberOfPointers !== 2
      )
        return;
      const previous = samples.value.rotation;
      samples.value = { ...samples.value, rotation: event.rotation };
      pose.value = cameraGestureStep(
        pose.value,
        { kind: "yaw", delta: event.rotation - previous },
        frame.value.viewport,
        extent,
      );
    })
    .onEnd((event, success) => {
      "worklet";
      if (success && live.value && input.value.owner === "multi")
        coast("yaw", event.velocity, 0);
    })
    .onFinalize(() => {
      "worklet";
      samples.value = { ...samples.value, rotation: 0 };
    });
  const tilt = Gesture.Pan()
    .enabled(enabled)
    .minPointers(2)
    .maxPointers(2)
    .averageTouches(true)
    .activeOffsetY([-TILT_DISTANCE, TILT_DISTANCE])
    .onStart((event) => {
      "worklet";
      touch(2);
      samples.value = {
        ...samples.value,
        tiltY: event.translationY,
        tiltActive: true,
      };
    })
    .onUpdate((event) => {
      "worklet";
      if (
        !live.value ||
        input.value.owner !== "multi" ||
        event.numberOfPointers !== 2 ||
        !samples.value.tiltActive
      )
        return;
      const previous = samples.value.tiltY;
      samples.value = { ...samples.value, tiltY: event.translationY };
      pose.value = cameraGestureStep(
        pose.value,
        {
          kind: "tilt",
          delta: event.translationY - previous,
          travel: TILT_DISTANCE,
        },
        frame.value.viewport,
        extent,
      );
    })
    .onFinalize(() => {
      "worklet";
      samples.value = { ...samples.value, tiltActive: false };
    });
  return Gesture.Race(tap, Gesture.Simultaneous(pan, pinch, rotation, tilt));
}
