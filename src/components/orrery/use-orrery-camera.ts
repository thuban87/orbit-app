/** ADR-077: one UI-thread pose/input owner; native adapters publish only discrete intents. */
import { useEffect, useMemo } from "react";
import { Gesture } from "react-native-gesture-handler";
import {
  cancelAnimation,
  ReduceMotion,
  runOnJS,
  runOnUI,
  type SharedValue,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  type CameraCell,
  type CameraPose,
  type CameraViewport,
  type OrreryIntent,
  type ProjectedFrame,
  tapIntent,
} from "@/logic/orrery-camera-logic";
import {
  beginInput,
  type CameraInput,
  cameraGestureStep,
  cancelInput,
  HOLD_MS,
  HOLD_SLOP,
  initialInput,
  moveInput,
  PAN_DISTANCE,
  TAP_DISTANCE,
  TILT_DISTANCE,
} from "@/logic/orrery-gesture-logic";
import {
  cameraExtent,
  createCameraMotion,
  type MotionRequest,
  recoveryCurve,
} from "@/logic/orrery-recovery-logic";
import {
  captureReorder,
  moveReorder,
  type ReorderDrag,
  type ReorderExpectation,
  type ReorderIntent,
  releaseReorder,
} from "@/logic/orrery-reorder-logic";

interface GestureSamples {
  panX: number;
  panY: number;
  scale: number;
  rotation: number;
  tiltY: number;
  tiltActive: boolean;
  tiltOriginY?: number;
}
const initialSamples = (): GestureSamples => {
  "worklet";
  return {
    panX: 0,
    panY: 0,
    scale: 1,
    rotation: 0,
    tiltY: 0,
    tiltActive: false,
  };
};
export interface OrreryCameraInput {
  input: CameraCell<CameraInput>;
  samples: CameraCell<GestureSamples>;
  live: CameraCell<boolean>;
}
export function useOrreryCamera({
  pose,
  enabled,
  extent,
  viewport,
  reduced,
}: {
  pose: SharedValue<CameraPose>;
  enabled: boolean;
  extent: number;
  viewport: CameraViewport;
  reduced: SharedValue<boolean>;
}) {
  const input = useSharedValue(initialInput());
  const samples = useSharedValue(initialSamples());
  const live = useSharedValue(enabled);
  const reorder = useSharedValue<ReorderDrag | null>(null);
  const epoch = useSharedValue(0);
  const active = useSharedValue<MotionRequest | null>(null);
  const frame = useSharedValue<ProjectedFrame | null>(null);
  const motion = useMemo(
    () =>
      createCameraMotion({
        pose,
        epoch,
        active,
        live,
        reduced,
        extent: cameraExtent(extent),
        viewport,
        cancel: () => {
          "worklet";
          cancelAnimation(pose);
        },
        animate: (plan, complete) => {
          "worklet";
          pose.value = plan.from;
          pose.value = withTiming(
            plan.animatedTarget,
            {
              duration: plan.duration,
              easing: plan.reduced
                ? (t: number) => {
                    "worklet";
                    return t;
                  }
                : recoveryCurve,
              reduceMotion: ReduceMotion.Never,
            },
            (finished) => complete(finished === true),
          );
        },
      }),
    [pose, epoch, active, live, reduced, extent, viewport],
  );
  const stop = motion.stop;
  useAnimatedReaction(
    () => reduced.value,
    (value, previous) => {
      if (value && previous === false) motion.motionChanged();
    },
  );
  useEffect(() => {
    runOnUI(() => {
      "worklet";
      live.value = enabled;
      if (!enabled) {
        reorder.value = null;
        frame.value = null;
        samples.value = initialSamples();
        stop();
        input.value = cancelInput(input.value);
      }
    })();
    return () => {
      runOnUI(() => {
        "worklet";
        live.value = false;
        reorder.value = null;
        frame.value = null;
        samples.value = initialSamples();
        input.value = cancelInput(input.value);
        stop();
      })();
    };
  }, [enabled, live, input, stop, reorder, frame, samples]);
  return useMemo(
    () => ({ input, samples, live, active, frame, reorder, ...motion }),
    [input, samples, live, active, frame, reorder, motion],
  );
}

export type OrreryCameraController = ReturnType<typeof useOrreryCamera>;

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
  resolveTap,
  reorder,
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
  resolveTap?: (frame: ProjectedFrame, x: number, y: number) => OrreryIntent;
  reorder?: {
    drag: CameraCell<ReorderDrag | null>;
    expectation: ReorderExpectation;
    generation: number;
    acknowledge: () => void;
    commit: (intent: ReorderIntent) => void;
  };
}) {
  const { input, samples, live } = camera;
  const touch = (pointers: number) => {
    "worklet";
    stop();
    input.value = moveInput(input.value, pointers, 0);
    if (pointers > 1 && reorder) reorder.drag.value = null;
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
      runOnJS(send)(
        resolveTap
          ? resolveTap(frame.value, event.x, event.y)
          : tapIntent(frame.value, event.x, event.y, true),
      );
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
      stop();
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
      // Losing a race may finalize Pan before the winning hold's onStart.
      if (input.value.owner === "pan") input.value = cancelInput(input.value);
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
      stop();
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
      stop();
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
    .manualActivation(true)
    .onTouchesDown((event) => {
      "worklet";
      samples.value = {
        ...samples.value,
        tiltOriginY:
          event.allTouches.length === 2
            ? (event.allTouches[0].y + event.allTouches[1].y) / 2
            : undefined,
      };
    })
    .onTouchesMove((event, manager) => {
      "worklet";
      if (!live.value || event.allTouches.length !== 2) return;
      const centroid = (event.allTouches[0].y + event.allTouches[1].y) / 2;
      const origin = samples.value.tiltOriginY;
      if (origin === undefined)
        samples.value = { ...samples.value, tiltOriginY: centroid };
      else if (Math.abs(centroid - origin) >= TILT_DISTANCE) manager.activate();
    })
    .onTouchesUp(() => {
      "worklet";
      samples.value = {
        ...samples.value,
        tiltOriginY: undefined,
        tiltActive: false,
      };
    })
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
      stop();
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
  const cameraGestures = Gesture.Simultaneous(pan, pinch, rotation, tilt);
  if (!reorder) return Gesture.Race(tap, cameraGestures);
  const hold = Gesture.Pan()
    .enabled(enabled)
    .maxPointers(1)
    .activateAfterLongPress(HOLD_MS)
    .onTouchesDown((event, manager) => {
      "worklet";
      if (
        event.numberOfTouches !== 1 ||
        !live.value ||
        frame.value.generation !== reorder.generation
      ) {
        reorder.drag.value = null;
        manager.fail();
        return;
      }
      const point = event.allTouches[0];
      reorder.drag.value = captureReorder(
        frame.value,
        reorder.expectation,
        point.x,
        point.y,
      );
      if (!reorder.drag.value) manager.fail();
    })
    .onTouchesMove((event, manager) => {
      "worklet";
      const drag = reorder.drag.value;
      const point = event.allTouches[0];
      if (
        event.numberOfTouches !== 1 ||
        !live.value ||
        frame.value.generation !== reorder.generation ||
        (drag &&
          !drag.active &&
          point &&
          Math.hypot(point.x - drag.origin.x, point.y - drag.origin.y) >
            HOLD_SLOP)
      ) {
        reorder.drag.value = null;
        manager.fail();
      }
    })
    .onStart((event) => {
      "worklet";
      const drag = reorder.drag.value;
      if (
        !drag ||
        !live.value ||
        input.value.owner !== "pending" ||
        event.numberOfPointers !== 1 ||
        Math.hypot(event.translationX, event.translationY) > HOLD_SLOP
      ) {
        reorder.drag.value = null;
        return;
      }
      stop();
      input.value = { ...input.value, owner: "reorder" };
      reorder.drag.value = { ...drag, active: true };
      runOnJS(reorder.acknowledge)();
    })
    .onUpdate((event) => {
      "worklet";
      const drag = reorder.drag.value;
      if (
        !drag?.active ||
        !live.value ||
        input.value.owner !== "reorder" ||
        event.numberOfPointers !== 1 ||
        frame.value.generation !== drag.generation
      ) {
        reorder.drag.value = null;
        return;
      }
      reorder.drag.value = moveReorder(drag, frame.value, event.x, event.y);
    })
    .onEnd((event, success) => {
      "worklet";
      const drag = reorder.drag.value;
      const intent = releaseReorder(
        drag,
        frame.value.generation,
        success &&
          live.value &&
          drag?.active === true &&
          input.value.owner === "reorder" &&
          event.numberOfPointers <= 1,
      );
      reorder.drag.value = null;
      if (intent) runOnJS(reorder.commit)(intent);
    })
    .onFinalize(() => {
      "worklet";
      reorder.drag.value = null;
      if (input.value.owner === "reorder")
        input.value = cancelInput(input.value);
    });
  return Gesture.Race(tap, Gesture.Race(hold, cameraGestures));
}
