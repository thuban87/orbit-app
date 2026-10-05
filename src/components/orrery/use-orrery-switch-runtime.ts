import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { CameraPose, WorldBody } from "@/logic/orrery-camera-logic";
import { bodyKey } from "@/logic/orrery-frame";
import {
  beginSettledSwitchChoreography,
  beginSwitchChoreography,
  type ChoreographyWorldBody,
  type SwitchChoreography,
  type SwitchChoreographyOptions,
  type SwitchChoreographySample,
  sampleSwitchChoreography,
  settleSwitchChoreography,
} from "@/logic/orrery-switch-choreography";
import {
  applySwitchBreath,
  fxClamp01,
  type SwitchCameraLook,
  type SwitchCameraMotion,
  switchBaseYaw,
  switchBreath,
  switchHasSpectacle,
} from "@/logic/orrery-switch-fx-logic";
import {
  beginSwitchLead,
  NO_SWITCH_LEAD,
  rotateSwitchWorld,
  SWITCH_LEAD_INTENSITY,
  SWITCH_LEAD_MAX_MS,
  type SwitchLeadState,
  sampleSwitchLead,
  sampleSwitchWorld,
  switchLeadCarry,
  switchLeadCoastStart,
  switchLeadFade,
} from "@/logic/orrery-switch-lead-logic";
import type { OrrerySceneSnapshot } from "@/services/orrery-scene";
import {
  SWITCH_BREATH_PULLBACK,
  SWITCH_BREATH_TILT,
  SWITCH_BREATH_YAW,
  SWITCH_YAW_PATH,
} from "./v2/visual-tunables";

export const NORMAL_SWITCH_DURATION_MS = 2100;
export const REDUCED_SWITCH_DURATION_MS = 180;

export interface OrrerySwitchRuntimeState {
  transition: SwitchChoreography;
  progress: number;
  cameraFrom: CameraPose;
  cameraTo: CameraPose;
  status: "settled" | "running" | "paused";
  remainingFraction: number;
}

export interface OrrerySwitchRuntimeSample {
  world: ChoreographyWorldBody[];
  camera: CameraPose;
  sample: SwitchChoreographySample;
}

export interface OrreryBodyResource {
  key: string;
  body: OrrerySceneSnapshot["world"][number];
  scene: OrrerySceneSnapshot;
}

function clamp01(value: number): number {
  "worklet";
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
}

function smoothstep(value: number): number {
  "worklet";
  const progress = clamp01(value);
  return progress * progress * (3 - 2 * progress);
}

/** The lead clock's timing curve: real time, unshaped. */
function linearEase(t: number): number {
  "worklet";
  return t;
}

/**
 * The switch camera's authored amounts (visual-tunables; one-number edits):
 * Lab C's switch camera, copied (owner S-SWIRL pick, 2026-10-04). Declared
 * above the worklets that read it.
 */
const SWITCH_CAMERA_LOOK: SwitchCameraLook = {
  yawPath: SWITCH_YAW_PATH,
  breathPullback: SWITCH_BREATH_PULLBACK,
  breathYaw: SWITCH_BREATH_YAW,
  breathTilt: SWITCH_BREATH_TILT,
};

/**
 * The plain crossfade camera (Lab C's `interpolateCamera`): every axis
 * smoothstep-mixed. The yaw follows SWITCH_YAW_PATH — "lab-c" is Lab C's raw
 * linear mix (no wrap handling), "shortest" the shortest arc.
 */
function interpolateCamera(
  from: CameraPose,
  to: CameraPose,
  progress: number,
): CameraPose {
  "worklet";
  if (progress <= 0) return { ...from };
  if (progress >= 1) return { ...to };
  const t = smoothstep(progress);
  const mix = (
    a: number | undefined,
    b: number | undefined,
    fallback: number,
  ) => {
    "worklet";
    const start = a ?? fallback;
    return start + ((b ?? fallback) - start) * t;
  };
  return {
    x: mix(from.x, to.x, 0),
    y: mix(from.y, to.y, 0),
    zoom: mix(from.zoom, to.zoom, 1),
    tilt: mix(from.tilt, to.tilt, 0),
    yaw: switchBaseYaw(
      from.yaw ?? 0,
      to.yaw ?? 0,
      t,
      SWITCH_CAMERA_LOOK.yawPath,
    ),
    focalDistance: mix(from.focalDistance, to.focalDistance, 256),
    // 38.7-05 (D-45): the lens shift travels with the other axes.
    lensShift: mix(from.lensShift, to.lensShift, 1),
  };
}

/**
 * The ONE switch camera sampler (C3-H1). Drawing (OrreryWorld's frame
 * worklet), the displayed-camera snapshot (interrupted publish, reduced-motion
 * retarget) and `sampleOrrerySwitchRuntime` all go through it, so a snapshot is
 * always the camera drawn that frame. `motion` is the transition BEING DRAWN
 * (C4-L2: never the live reduced-motion flag). This is Lab C's switch camera
 * (owner S-SWIRL pick, 2026-10-04): the crossfade above plus, with the
 * spectacle, Lab C's breath — dolly-out, yaw swing and lift toward flat, scaled
 * by sin²(πp)·(0.5 + 0.5·intensity) — exactly zero at both ends, so the camera
 * lands exactly on `to` at progress 1; reduced motion (or a spinless switch)
 * is the plain crossfade. Unlike Lab C, the displayed-camera snapshot (a
 * retarget) includes the breath, so a retarget starts from what is drawn.
 * 38.7-15 (D-76): a switch that took over a lead-in also carries the lead's
 * breath, fading over its accelerate phase (zero from there on), so the
 * hand-off is continuous and the landing unchanged.
 * Defined above every worklet that calls it (Hermes forward-ref hazard).
 */
export function sampleOrrerySwitchCamera(
  from: CameraPose,
  to: CameraPose,
  progress: number,
  motion: SwitchCameraMotion,
): CameraPose {
  "worklet";
  const base = interpolateCamera(from, to, progress);
  const own =
    progress > 0 && progress < 1 && switchHasSpectacle(motion)
      ? switchBreath(progress) * (0.5 + 0.5 * fxClamp01(motion.intensity))
      : 0;
  const carried =
    motion.lead && progress < 1
      ? motion.lead.breath * switchLeadFade(progress)
      : 0;
  const breath = own + carried;
  return breath > 0
    ? applySwitchBreath(base, breath, SWITCH_CAMERA_LOOK)
    : base;
}

/**
 * 38.7-15 (D-76): the camera drawn during a lead-in — the live pose with the
 * lead's Lab C breath (zero = the pose itself).
 */
export function sampleSwitchLeadCamera(
  pose: CameraPose,
  breath: number,
): CameraPose {
  "worklet";
  return breath > 0
    ? applySwitchBreath(pose, breath, SWITCH_CAMERA_LOOK)
    : pose;
}

/**
 * D-52 (6): the camera actually on screen. Once a switch has settled the user
 * owns the live pose (pan/zoom/focus), so `cameraTo` is stale; a new switch or a
 * reduced-motion retarget must start from the live pose, not the old target.
 * `motion` is the OUTGOING transition (read before a new one is written).
 */
export function displayedSwitchCamera(
  from: CameraPose,
  to: CameraPose,
  progress: number,
  live: CameraPose,
  motion: SwitchCameraMotion,
): CameraPose {
  "worklet";
  if (progress >= 1) return { ...live };
  return sampleOrrerySwitchCamera(from, to, progress, motion);
}

export function createSettledOrrerySwitchRuntime(
  world: readonly WorldBody[],
  generation: number,
  camera: CameraPose,
): OrrerySwitchRuntimeState {
  return {
    transition: beginSwitchChoreography(world, world, generation, {
      intensity: 0,
      reducedMotion: false,
    }),
    progress: 1,
    cameraFrom: { ...camera },
    cameraTo: { ...camera },
    status: "settled",
    remainingFraction: 0,
  };
}

export function sampleOrrerySwitchRuntime(
  runtime: OrrerySwitchRuntimeState,
  progress = runtime.progress,
): OrrerySwitchRuntimeSample {
  "worklet";
  const fraction = clamp01(progress);
  const sample = sampleSwitchChoreography(runtime.transition, fraction);
  return {
    // 38.7-15: the ONE world sampler (a carried lead's coast included).
    world: sampleSwitchWorld(runtime.transition, fraction),
    camera: sampleOrrerySwitchCamera(
      runtime.cameraFrom,
      runtime.cameraTo,
      fraction,
      runtime.transition,
    ),
    sample,
  };
}

export function beginOrrerySwitchRuntime(
  runtime: OrrerySwitchRuntimeState,
  destinationWorld: readonly WorldBody[],
  generation: number,
  destinationHome: CameraPose,
  options: SwitchChoreographyOptions,
): OrrerySwitchRuntimeState {
  const displayed = sampleOrrerySwitchRuntime(runtime);
  return {
    transition: beginSwitchChoreography(
      displayed.world,
      destinationWorld,
      generation,
      options,
    ),
    progress: 0,
    cameraFrom: displayed.camera,
    cameraTo: { ...destinationHome },
    status: "running",
    remainingFraction: 1,
  };
}

export function pauseOrrerySwitchRuntime(
  runtime: OrrerySwitchRuntimeState,
): OrrerySwitchRuntimeState {
  return runtime.status === "running"
    ? {
        ...runtime,
        status: "paused",
        remainingFraction: 1 - clamp01(runtime.progress),
      }
    : runtime;
}

export function resumeOrrerySwitchRuntime(
  runtime: OrrerySwitchRuntimeState,
): OrrerySwitchRuntimeState {
  return runtime.status === "paused"
    ? {
        ...runtime,
        status: "running",
        remainingFraction: 1 - clamp01(runtime.progress),
      }
    : runtime;
}

function resourcesFor(scene: OrrerySceneSnapshot): OrreryBodyResource[] {
  return scene.world.map((body) => ({ key: bodyKey(body), body, scene }));
}

/** D-53: O(N) keyed merge — same output and order as the per-key find/some scan. */
function mergeResources(
  previous: readonly OrreryBodyResource[],
  scene: OrrerySceneSnapshot,
): OrreryBodyResource[] {
  const current = resourcesFor(scene);
  // First resource per key, exactly what `find` returned.
  const currentByKey = new Map<string, OrreryBodyResource>();
  for (const item of current)
    if (!currentByKey.has(item.key)) currentByKey.set(item.key, item);
  const previousKeys = new Set(previous.map((old) => old.key));
  return [
    ...previous.map((old) => currentByKey.get(old.key) ?? old),
    ...current.filter((item) => !previousKeys.has(item.key)),
  ];
}

/**
 * React resource list after a publication (RG-027, performance/AUD-PERF-001,
 * D-19). Only a running switch keeps departed bodies (their geometry is still
 * choreographed out); the generation-checked prune removes them on completion.
 * A settled publication replaces the list with the current scene. Keys are
 * stable, so bodies present on both sides keep their keyed media.
 */
export function nextOrreryResources(
  current: readonly OrreryBodyResource[],
  scene: OrrerySceneSnapshot,
  isSwitch: boolean,
): OrreryBodyResource[] {
  return isSwitch && current.length > 0
    ? mergeResources(current, scene)
    : resourcesFor(scene);
}

/** Keeps only resources whose key is in the settled scene's world. */
export function pruneOrreryResources(
  current: readonly OrreryBodyResource[],
  scene: OrrerySceneSnapshot,
): OrreryBodyResource[] {
  const keys = new Set(scene.world.map(bodyKey));
  return current.filter((resource) => keys.has(resource.key));
}

export interface OrrerySwitchRuntime {
  transition: SharedValue<SwitchChoreography>;
  progress: SharedValue<number>;
  cameraFrom: SharedValue<CameraPose>;
  cameraTo: SharedValue<CameraPose>;
  running: SharedValue<boolean>;
  /** 38.7-15 (D-76): the lead-in state and its clock (ms since the tap). */
  lead: SharedValue<SwitchLeadState>;
  leadClock: SharedValue<number>;
  resources: OrreryBodyResource[];
  publish: (
    scene: OrrerySceneSnapshot,
    isSwitch: boolean,
    intensity: number,
    destinationHome: CameraPose,
  ) => void;
  pause: () => void;
  resume: () => void;
  /**
   * 38.7-15 (C5-M2): settles a running or paused switch now, through the
   * same path a driven switch completes by (`finish`: progress 1, the pose
   * at the switch's destination, the choreography settled, the prune — whose
   * settle notification adopts Plan 13's held renderer viewport). `done`
   * runs on JS after that prune and settle notification, or (one UI round
   * trip later) when nothing was running: a no-op then.
   */
  settle: (done?: () => void) => void;
  /**
   * 38.7-15 (D-76): a System was tapped (the destination is loading): the
   * current world starts the switch's opening now — spin, warp, streaks,
   * breath — and keeps spinning until `publish` takes over from what is
   * drawn. Nothing under reduced motion, while a switch runs, or twice.
   */
  beginLead: () => void;
  /**
   * 38.7-15: the destination will not come (a failed load): a running lead
   * coasts back to its own world (a crossfade under reduced motion).
   */
  endLead: () => void;
}

/**
 * 38.7-13 (D-53, C4-M1): called on JS when a publication or a driven switch
 * settles at `generation`. A driven switch's settle runs INSIDE the prune's JS
 * callback, so whatever React state the screen sets here batches into the
 * settle commit (one commit at settle, never one per notification). A
 * settled publication notifies synchronously inside `publish`, batching into
 * the publish commit.
 */
export type OrrerySwitchSettled = (generation: number) => void;

export function useOrrerySwitchRuntime(
  pose: SharedValue<CameraPose>,
  reducedMotion: SharedValue<boolean>,
  onSettled?: OrrerySwitchSettled,
): OrrerySwitchRuntime {
  // 38.7-15: the initial values are computed ONCE. A JS-thread `pose.value`
  // read is a synchronous UI-runtime call (it takes the UI runtime's lock and
  // waits out a frame in progress); evaluated as plain hook arguments it ran
  // three times on every render of the screen, including the System tap's.
  const initial = useRef<{
    empty: OrrerySwitchRuntimeState;
    pose: CameraPose;
  } | null>(null);
  if (!initial.current) {
    const start = { ...pose.value };
    initial.current = {
      empty: createSettledOrrerySwitchRuntime([], 0, start),
      pose: start,
    };
  }
  const empty = initial.current.empty;
  const transition = useSharedValue(empty.transition);
  const progress = useSharedValue(1);
  const cameraFrom = useSharedValue({ ...initial.current.pose });
  const cameraTo = useSharedValue({ ...initial.current.pose });
  const running = useSharedValue(false);
  const lead = useSharedValue<SwitchLeadState>(NO_SWITCH_LEAD);
  const leadClock = useSharedValue(0);
  const latestScene = useRef<OrrerySceneSnapshot | null>(null);
  /** 38.7-15: a scene was published (JS mirror; see `publish`). */
  const published = useRef(false);
  const [resources, setResources] = useState<OrreryBodyResource[]>([]);
  // The latest settle listener (a ref, so it never changes the runtime's identity).
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;
  // 38.7-15 (C5-M2): `settle()` callers waiting for the next settle.
  const settleWaiters = useRef<(() => void)[]>([]);
  const flushSettleWaiters = useCallback(() => {
    const waiting = settleWaiters.current;
    settleWaiters.current = [];
    for (const done of waiting) done();
  }, []);

  const prune = useCallback(
    (generation: number) => {
      setResources((current) => {
        const scene = latestScene.current;
        if (!scene || scene.generation !== generation) return current;
        return pruneOrreryResources(current, scene);
      });
      // Same JS callback as the prune: the screen's settle state joins its commit.
      settledRef.current?.(generation);
      flushSettleWaiters();
    },
    [flushSettleWaiters],
  );

  const finish = useCallback(
    (generation: number) => {
      "worklet";
      if (transition.value.generation !== generation) return;
      running.value = false;
      progress.value = 1;
      pose.value = { ...cameraTo.value };
      // RG-027 / performance/AUD-PERF-001: retire departed geometry on settle.
      transition.value = settleSwitchChoreography(transition.value);
      runOnJS(prune)(generation);
    },
    [cameraTo, pose, progress, prune, running, transition],
  );

  const startDriver = useCallback(
    (remaining: number, reduced: boolean, generation: number) => {
      "worklet";
      const duration =
        (reduced ? REDUCED_SWITCH_DURATION_MS : NORMAL_SWITCH_DURATION_MS) *
        remaining;
      running.value = true;
      progress.value = withTiming(
        1,
        { duration, reduceMotion: ReduceMotion.Never },
        (finished) => {
          if (finished) finish(generation);
        },
      );
    },
    [finish, progress, running],
  );

  /** Runs the lead clock from its current value (real time, ms). */
  const startLeadClock = useCallback(() => {
    "worklet";
    leadClock.value = withTiming(SWITCH_LEAD_MAX_MS, {
      duration: Math.max(0, SWITCH_LEAD_MAX_MS - leadClock.value),
      easing: linearEase,
      reduceMotion: ReduceMotion.Never,
    });
  }, [leadClock]);

  /** Ends a lead with no hand-off (the clock stops; the state clears). */
  const clearLead = useCallback(() => {
    "worklet";
    cancelAnimation(leadClock);
    lead.value = NO_SWITCH_LEAD;
    leadClock.value = 0;
  }, [lead, leadClock]);

  const publish = useCallback(
    (
      scene: OrrerySceneSnapshot,
      isSwitch: boolean,
      intensity: number,
      destinationHome: CameraPose,
    ) => {
      latestScene.current = scene;
      // 38.7-15: whether a scene was ever published — a JS mirror of the UI
      // check `transition.value.generation === 0`. Never read
      // `transition.value` on JS: that is a synchronous copy of the whole
      // choreography (every body of the drawn System, e.g. All Contacts)
      // out of the UI runtime under its lock — a UI stall at the hand-off.
      const first = !published.current;
      published.current = true;
      setResources((current) => nextOrreryResources(current, scene, isSwitch));
      // D-52: ship only the geometry the UI thread needs. Capturing `scene`
      // would serialise the whole snapshot (contacts, members, gravity map) to
      // the UI runtime on every publication.
      const world = scene.world;
      const generation = scene.generation;
      // A settled publication (the branch below) settles now: notify inside
      // this JS call so the screen's settle state joins the publish commit.
      if (!isSwitch || first) settledRef.current?.(generation);
      runOnUI(() => {
        "worklet";
        cancelAnimation(progress);
        const reduced = reducedMotion.value;
        if (!isSwitch || first) {
          if (lead.value.active) clearLead();
          // Same choreography as beginSwitchChoreography(world, world, ...)
          // at intensity 0, plus the settled fast path (D-53).
          transition.value = beginSettledSwitchChoreography(
            world,
            generation,
            reduced,
          );
          cameraFrom.value = { ...destinationHome };
          cameraTo.value = { ...destinationHome };
          progress.value = 1;
          running.value = false;
          return;
        }
        const state = lead.value;
        let displayed: ChoreographyWorldBody[];
        let displayedCamera: CameraPose;
        let carry: ReturnType<typeof switchLeadCarry> | null = null;
        if (state.active && progress.value >= 1) {
          // 38.7-15 (D-76): take over the lead-in from what it draws now.
          const now = sampleSwitchLead(
            state,
            leadClock.value,
            NORMAL_SWITCH_DURATION_MS,
          );
          const settled = sampleSwitchChoreography(transition.value, 1).world;
          clearLead();
          if (reduced || state.still) {
            displayed = rotateSwitchWorld(settled, now.rotation);
            displayedCamera = sampleSwitchLeadCamera(pose.value, now.breath);
          } else {
            // The switch inherits the spin's momentum: its source is turned
            // ahead by the coast's start, which its coast offset cancels.
            carry = switchLeadCarry(now);
            displayed = rotateSwitchWorld(
              settled,
              now.rotation + switchLeadCoastStart(carry),
            );
            displayedCamera = { ...pose.value };
          }
        } else {
          if (state.active) clearLead();
          displayed = sampleSwitchWorld(transition.value, progress.value);
          // C3-H1: the camera drawn this frame, with the OUTGOING transition's
          // motion (sampled before the new transition is written).
          displayedCamera = displayedSwitchCamera(
            cameraFrom.value,
            cameraTo.value,
            progress.value,
            pose.value,
            transition.value,
          );
        }
        const next = beginSwitchChoreography(displayed, world, generation, {
          intensity,
          reducedMotion: reduced,
        });
        transition.value = carry ? { ...next, lead: carry } : next;
        cameraFrom.value = displayedCamera;
        cameraTo.value = { ...destinationHome };
        progress.value = 0;
        startDriver(1, reduced, generation);
      })();
    },
    [
      cameraFrom,
      cameraTo,
      clearLead,
      lead,
      leadClock,
      pose,
      progress,
      reducedMotion,
      running,
      startDriver,
      transition,
    ],
  );

  const beginLead = useCallback(() => {
    runOnUI(() => {
      "worklet";
      if (reducedMotion.value || progress.value < 1 || lead.value.active)
        return;
      // The intensity is passed (never a worklet default parameter: those
      // cannot see the captured closure on the UI runtime). The state is built
      // before anything is written, and the clock starts before the lead is
      // marked active, so a throw here can never leave an active lead (the
      // canvas `busy`, the FR-B vote) with no clock and no owner.
      const next = beginSwitchLead(SWITCH_LEAD_INTENSITY);
      leadClock.value = 0;
      startLeadClock();
      lead.value = next;
    })();
  }, [lead, leadClock, progress, reducedMotion, startLeadClock]);

  const endLead = useCallback(() => {
    runOnUI(() => {
      "worklet";
      const state = lead.value;
      if (!state.active) return;
      if (progress.value < 1) {
        clearLead();
        return;
      }
      const now = sampleSwitchLead(
        state,
        leadClock.value,
        NORMAL_SWITCH_DURATION_MS,
      );
      const settled = sampleSwitchChoreography(transition.value, 1).world;
      const generation = transition.value.generation;
      clearLead();
      const reduced = reducedMotion.value || state.still;
      const carry = reduced ? null : switchLeadCarry(now);
      // Back to its own world from what is drawn: a spinless switch (the
      // carry coasts the spin out) or, under reduced motion, a crossfade.
      const back = beginSwitchChoreography(
        rotateSwitchWorld(
          settled,
          now.rotation + (carry ? switchLeadCoastStart(carry) : 0),
        ),
        settled,
        generation,
        { intensity: 0, reducedMotion: reduced },
      );
      transition.value = carry ? { ...back, lead: carry } : back;
      cameraFrom.value = carry
        ? { ...pose.value }
        : sampleSwitchLeadCamera(pose.value, now.breath);
      cameraTo.value = { ...pose.value };
      progress.value = 0;
      startDriver(1, reduced, generation);
    })();
  }, [
    cameraFrom,
    cameraTo,
    clearLead,
    lead,
    leadClock,
    pose,
    progress,
    reducedMotion,
    startDriver,
    transition,
  ]);

  const settle = useCallback(
    (done?: () => void) => {
      if (done) settleWaiters.current.push(done);
      runOnUI(() => {
        "worklet";
        if (lead.value.active) clearLead();
        // `finish` has only a generation guard: a settled switch is a no-op.
        if (progress.value >= 1) {
          runOnJS(flushSettleWaiters)();
          return;
        }
        cancelAnimation(progress);
        finish(transition.value.generation);
      })();
    },
    [clearLead, finish, flushSettleWaiters, lead, progress, transition],
  );

  const pause = useCallback(() => {
    runOnUI(() => {
      "worklet";
      // 38.7-15: a lead-in holds its clock while blurred/backgrounded.
      if (lead.value.active) cancelAnimation(leadClock);
      if (!running.value) return;
      cancelAnimation(progress);
      running.value = false;
    })();
  }, [lead, leadClock, progress, running]);

  const resume = useCallback(() => {
    runOnUI(() => {
      "worklet";
      if (lead.value.active && !lead.value.still && progress.value >= 1)
        startLeadClock();
      if (running.value || progress.value >= 1) return;
      startDriver(
        1 - progress.value,
        transition.value.reducedMotion,
        transition.value.generation,
      );
    })();
  }, [lead, progress, running, startDriver, startLeadClock, transition]);

  useAnimatedReaction(
    () => reducedMotion.value,
    (reduced, previous) => {
      if (!reduced || previous !== false) return;
      // 38.7-15: a lead-in holds where it is (no warp, streaks or breath).
      if (lead.value.active) {
        cancelAnimation(leadClock);
        lead.value = { ...lead.value, still: true };
      }
      if (progress.value >= 1) return;
      cancelAnimation(progress);
      const displayed = sampleSwitchWorld(transition.value, progress.value);
      // C3-H1 / C4-L2: the camera drawn this frame — the frame worklet still
      // draws the outgoing (non-reduced) transition, Lab C breath included.
      const displayedCamera = displayedSwitchCamera(
        cameraFrom.value,
        cameraTo.value,
        progress.value,
        pose.value,
        transition.value,
      );
      const destination = transition.value.entries.flatMap((entry) =>
        entry.destination ? [entry.destination] : [],
      );
      transition.value = beginSwitchChoreography(
        displayed,
        destination,
        transition.value.generation,
        { intensity: transition.value.intensity, reducedMotion: true },
      );
      cameraFrom.value = displayedCamera;
      progress.value = 0;
      startDriver(1, true, transition.value.generation);
    },
  );

  useEffect(
    () => () => {
      runOnUI(() => {
        "worklet";
        cancelAnimation(progress);
      })();
    },
    [progress],
  );

  // D-52: a stable identity, so an unrelated screen render neither restarts
  // the frame mapper nor rebuilds any consumer keyed on the runtime.
  return useMemo(
    () => ({
      transition,
      progress,
      cameraFrom,
      cameraTo,
      running,
      lead,
      leadClock,
      resources,
      publish,
      pause,
      resume,
      settle,
      beginLead,
      endLead,
    }),
    [
      transition,
      progress,
      cameraFrom,
      cameraTo,
      running,
      lead,
      leadClock,
      resources,
      publish,
      pause,
      resume,
      settle,
      beginLead,
      endLead,
    ],
  );
}
