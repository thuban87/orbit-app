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
  reorderTargetSlot,
} from "@/logic/orrery-reorder-logic";

// ── 38.7-12 (D-23): the reorder hold's feedback timers (Lab B as drawn) ─────

/** Lab B `SLOT_FLASH_MS`: the armed ring's flash on arming and each slot change. */
export const REORDER_SLOT_FLASH_MS = 340;
/** Lab B `RM_FLASH_MS`: the same flash, shorter and static, under reduced motion. */
export const REORDER_SLOT_FLASH_REDUCED_MS = 150;

/** Linear easing (the charge fills at a constant rate over the hold). */
function linearEase(t: number): number {
  "worklet";
  return t;
}

/**
 * The charge after a successful capture: 0 → 1, linear, over exactly
 * HOLD_MS (the long-press the hold activates after). Under reduced motion it
 * stays 0 until activation (no animated fill).
 */
function startReorderCharge(
  charge: CameraCell<number> | undefined,
  reduced: boolean,
): void {
  "worklet";
  if (!charge) return;
  charge.value = 0;
  if (!reduced)
    charge.value = withTiming(1, {
      duration: HOLD_MS,
      easing: linearEase,
      reduceMotion: ReduceMotion.Never,
    });
}

/** Every failure path: the charge (and any running fill) back to 0. */
function resetReorderCharge(charge: CameraCell<number> | undefined): void {
  "worklet";
  if (charge) charge.value = 0;
}

/** Arming or a slot change: the armed ring's flash timer restarts (0 → 1). */
function flashReorderSlot(
  flash: CameraCell<number> | undefined,
  reduced: boolean,
): void {
  "worklet";
  if (!flash) return;
  flash.value = 0;
  flash.value = withTiming(1, {
    duration: reduced ? REORDER_SLOT_FLASH_REDUCED_MS : REORDER_SLOT_FLASH_MS,
    easing: linearEase,
    reduceMotion: ReduceMotion.Never,
  });
}

interface GestureSamples {
  /**
   * CR-02: a bit per recognizer that is tracking touches (set on its
   * begin/start, cleared on its finalize). When the last one finalizes no
   * finger is down, and the input's pointer count returns to 0 (the canvas
   * `busy` signal reads it). Absent = none.
   */
  tracking?: number;
  panX: number;
  panY: number;
  scale: number;
  rotation: number;
  tiltY: number;
  tiltActive: boolean;
  tiltOriginY?: number;
  /** D-04: where the one-finger pan touched down (anchored pan mapping). */
  panOriginX?: number;
  panOriginY?: number;
}
const initialSamples = (): GestureSamples => {
  "worklet";
  return {
    tracking: 0,
    panX: 0,
    panY: 0,
    scale: 1,
    rotation: 0,
    tiltY: 0,
    tiltActive: false,
  };
};

/** CR-02: the recognizer bits of `GestureSamples.tracking`. */
const TRACK_TAP = 1;
const TRACK_PAN = 2;
const TRACK_PINCH = 4;
const TRACK_ROTATION = 8;
const TRACK_TILT = 16;
const TRACK_HOLD = 32;

/**
 * CR-02: a recognizer began (or activated) tracking touches. Idempotent, so
 * both its begin and its start may mark it.
 */
function markTracking(samples: CameraCell<GestureSamples>, bit: number): void {
  "worklet";
  const tracking = samples.value.tracking ?? 0;
  if ((tracking & bit) === 0)
    samples.value = { ...samples.value, tracking: tracking | bit };
}

/**
 * CR-02: a recognizer finalized. Once none is still tracking, every finger
 * is up: the pointer count returns to 0. Ownership is left alone — the next
 * touch's begin re-establishes it — because a recognizer can finalize while
 * another one is still activating on the same touch (a tap cancelled by the
 * winning pan or hold), and clearing the owner there would strand that one.
 */
function clearTracking(
  samples: CameraCell<GestureSamples>,
  input: CameraCell<CameraInput>,
  bit: number,
): void {
  "worklet";
  const tracking = (samples.value.tracking ?? 0) & ~bit;
  if (tracking !== (samples.value.tracking ?? 0))
    samples.value = { ...samples.value, tracking };
  if (tracking === 0 && input.value.pointers !== 0)
    input.value = { ...input.value, pointers: 0 };
}
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
  // 38.7-12 (D-23): the hold's charge (0..1) and the armed slot flash timer
  // (0..1, 1 = idle), written only by the hold gesture's state transitions.
  const reorderCharge = useSharedValue(0);
  const reorderFlash = useSharedValue(1);
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
        reorderCharge.value = 0;
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
        reorderCharge.value = 0;
        frame.value = null;
        samples.value = initialSamples();
        input.value = cancelInput(input.value);
        stop();
      })();
    };
  }, [enabled, live, input, stop, reorder, reorderCharge, frame, samples]);
  // 38.7-11 (C3-M1): `epoch` bumps on every stop — any touch, recovery,
  // coast or cancel — so a focus framing can tell whether it is still the
  // camera's last word.
  return useMemo(
    () => ({
      input,
      samples,
      live,
      active,
      frame,
      reorder,
      reorderCharge,
      reorderFlash,
      epoch,
      ...motion,
    }),
    [
      input,
      samples,
      live,
      active,
      frame,
      reorder,
      reorderCharge,
      reorderFlash,
      epoch,
      motion,
    ],
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
    /**
     * 38.7-12 (D-23): the hold's charge — 0 → 1 over HOLD_MS from a
     * successful capture, 0 on every failure path, 1 at activation — and the
     * armed ring's slot-flash timer. Both optional (tests, previews).
     */
    charge?: CameraCell<number>;
    flash?: CameraCell<number>;
    /** Reduced motion: no animated charge fill (armed state only). */
    reduced?: CameraCell<boolean>;
  };
}) {
  const { input, samples, live } = camera;
  const touch = (pointers: number) => {
    "worklet";
    stop();
    input.value = moveInput(input.value, pointers, 0);
    if (pointers > 1 && reorder) {
      reorder.drag.value = null;
      resetReorderCharge(reorder.charge);
    }
  };
  const tap = Gesture.Tap()
    .enabled(enabled)
    .maxDistance(TAP_DISTANCE)
    .onBegin(() => {
      "worklet";
      stop();
      input.value = beginInput(input.value, 1);
      markTracking(samples, TRACK_TAP);
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
    })
    .onFinalize(() => {
      "worklet";
      clearTracking(samples, input, TRACK_TAP);
    });
  const pan = Gesture.Pan()
    .enabled(enabled)
    .minDistance(PAN_DISTANCE)
    .maxPointers(1)
    .onBegin((event) => {
      "worklet";
      stop();
      if (input.value.owner === "idle" || input.value.owner === "cancelled")
        input.value = beginInput(input.value, 1);
      samples.value = {
        ...samples.value,
        panX: 0,
        panY: 0,
        panOriginX: event?.x,
        panOriginY: event?.y,
      };
      markTracking(samples, TRACK_PAN);
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
      // D-04: the finger's previous position anchors the drag on the ground.
      const from =
        sample.panOriginX !== undefined && sample.panOriginY !== undefined
          ? {
              x: sample.panOriginX + sample.panX,
              y: sample.panOriginY + sample.panY,
            }
          : undefined;
      pose.value = cameraGestureStep(
        pose.value,
        {
          kind: "pan",
          dx: event.translationX - sample.panX,
          dy: event.translationY - sample.panY,
          from,
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
      clearTracking(samples, input, TRACK_PAN);
    });
  const pinch = Gesture.Pinch()
    .enabled(enabled)
    .onBegin(() => {
      "worklet";
      markTracking(samples, TRACK_PINCH);
    })
    .onStart((event) => {
      "worklet";
      touch(2);
      samples.value = { ...samples.value, scale: event.scale };
      markTracking(samples, TRACK_PINCH);
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
      clearTracking(samples, input, TRACK_PINCH);
    });
  const rotation = Gesture.Rotation()
    .enabled(enabled)
    .onBegin(() => {
      "worklet";
      markTracking(samples, TRACK_ROTATION);
    })
    .onStart((event) => {
      "worklet";
      touch(2);
      samples.value = { ...samples.value, rotation: event.rotation };
      markTracking(samples, TRACK_ROTATION);
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
      clearTracking(samples, input, TRACK_ROTATION);
    });
  const tilt = Gesture.Pan()
    .enabled(enabled)
    .minPointers(2)
    .maxPointers(2)
    .averageTouches(true)
    .manualActivation(true)
    .onBegin(() => {
      "worklet";
      markTracking(samples, TRACK_TILT);
    })
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
      markTracking(samples, TRACK_TILT);
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
      clearTracking(samples, input, TRACK_TILT);
    });
  const cameraGestures = Gesture.Simultaneous(pan, pinch, rotation, tilt);
  if (!reorder) return Gesture.Race(tap, cameraGestures);
  const hold = Gesture.Pan()
    .enabled(enabled)
    .maxPointers(1)
    .activateAfterLongPress(HOLD_MS)
    .onBegin(() => {
      "worklet";
      markTracking(samples, TRACK_HOLD);
    })
    .onTouchesDown((event, manager) => {
      "worklet";
      if (
        event.numberOfTouches !== 1 ||
        !live.value ||
        frame.value.generation !== reorder.generation
      ) {
        reorder.drag.value = null;
        resetReorderCharge(reorder.charge);
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
      if (!reorder.drag.value) {
        resetReorderCharge(reorder.charge);
        manager.fail();
        return;
      }
      // D-23: the charge fills over the hold itself (never its own timer).
      startReorderCharge(reorder.charge, reorder.reduced?.value === true);
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
        resetReorderCharge(reorder.charge);
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
        resetReorderCharge(reorder.charge);
        return;
      }
      stop();
      input.value = { ...input.value, owner: "reorder" };
      markTracking(samples, TRACK_HOLD);
      reorder.drag.value = { ...drag, active: true };
      // Armed: full charge (also the reduced-motion jump), the slot flash.
      if (reorder.charge) reorder.charge.value = 1;
      flashReorderSlot(reorder.flash, reorder.reduced?.value === true);
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
        resetReorderCharge(reorder.charge);
        return;
      }
      const moved = moveReorder(drag, frame.value, event.x, event.y);
      reorder.drag.value = moved;
      if (!moved) {
        resetReorderCharge(reorder.charge);
        input.value = cancelInput(input.value);
        return;
      }
      if (reorderTargetSlot(moved) !== reorderTargetSlot(drag))
        flashReorderSlot(reorder.flash, reorder.reduced?.value === true);
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
      resetReorderCharge(reorder.charge);
      if (intent) runOnJS(reorder.commit)(intent);
    })
    .onFinalize(() => {
      "worklet";
      reorder.drag.value = null;
      resetReorderCharge(reorder.charge);
      if (input.value.owner === "reorder")
        input.value = cancelInput(input.value);
      clearTracking(samples, input, TRACK_HOLD);
    });
  return Gesture.Race(tap, Gesture.Race(hold, cameraGestures));
}
