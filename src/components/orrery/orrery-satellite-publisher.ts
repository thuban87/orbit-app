/**
 * 38.7-10 (C-M3/D-53): the satellite publisher.
 *
 * `createOrrerySatelliteController` (orrery-scene.ts) publishes `loading`
 * synchronously and the async `ready` rows (or `error`) later — often while a
 * System switch is still animating. This publisher is that controller's
 * callback. It:
 * - builds the satellite index ONCE per (scene generation, rows) on the JS
 *   thread and writes `{ sceneGeneration, status, index }` to the SharedValue
 *   the frame worklet reads — never React state, so OrreryWorld does not
 *   re-render for a satellite load;
 * - notifies its JS subscribers (OrreryWorld rebuilds the moon looks through
 *   its spec publisher, again without a React render);
 * - forwards the React copy the focus card / companion sheet need, EXCEPT
 *   while a switch is in flight: then only the latest state is held and it is
 *   flushed once, when the switch settles.
 */
import type { ContactIdentity } from "@/db/orrery-system-read";
import {
  EMPTY_SATELLITE_INDEX,
  indexSatellites,
  type OrrerySatelliteSpec,
} from "@/logic/orrery-satellite-logic";
import type { OrrerySatelliteState } from "@/services/orrery-scene";

/** What OrreryWorld reads: the SharedValue plus a JS-side change signal. */
export interface OrrerySatelliteSource {
  /** Read by the frame worklet only (`.value`). */
  spec: { value: OrrerySatelliteSpec };
  /** The latest spec (JS thread). */
  current(): OrrerySatelliteSpec;
  /** Called after every spec write; returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
}

export interface OrrerySatellitePublisher {
  source: OrrerySatelliteSource;
  /** The satellite load's scene: its members filter the index (ADR-105). */
  noteScene(generation: number, members: readonly ContactIdentity[]): void;
  /** The satellite controller's publish callback. */
  publish(state: OrrerySatelliteState): void;
  /** A System switch animating to `generation` has begun (JS, before publication). */
  switchStarted(generation: number): void;
  /** The switch runtime settled on `generation`: flush a held React copy. */
  switchSettled(generation: number): void;
}

export function createOrrerySatellitePublisher(options: {
  /** The stable SharedValue the frame worklet reads. */
  spec: { value: OrrerySatelliteSpec };
  /** The React copy (focus card moon list, companion sheet). */
  setState: (state: OrrerySatelliteState) => void;
}): OrrerySatellitePublisher {
  const { spec, setState } = options;
  const listeners = new Set<() => void>();
  let latest: OrrerySatelliteSpec = spec.value;
  let scene: {
    generation: number;
    members: readonly ContactIdentity[];
  } | null = null;
  let built: {
    generation: number | null;
    rows: OrrerySatelliteState["rows"];
    members: readonly ContactIdentity[] | null;
    index: OrrerySatelliteSpec["index"];
  } | null = null;
  /** The generation of the switch in flight, or null. */
  let pending: number | null = null;
  let held: OrrerySatelliteState | null = null;

  const source: OrrerySatelliteSource = {
    spec,
    current: () => latest,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  function indexFor(state: OrrerySatelliteState) {
    if (state.rows.length === 0 || state.sceneGeneration === null)
      return EMPTY_SATELLITE_INDEX;
    const members =
      scene && scene.generation === state.sceneGeneration
        ? scene.members
        : null;
    if (
      built &&
      built.generation === state.sceneGeneration &&
      built.rows === state.rows &&
      built.members === members
    )
      return built.index;
    // No members known for this generation: nothing qualifies (ADR-105).
    const index = members
      ? indexSatellites(state.rows, members)
      : EMPTY_SATELLITE_INDEX;
    built = {
      generation: state.sceneGeneration,
      rows: state.rows,
      members,
      index,
    };
    return index;
  }

  return {
    source,
    noteScene(generation, members) {
      scene = { generation, members };
    },
    publish(state) {
      const next: OrrerySatelliteSpec = {
        sceneGeneration: state.sceneGeneration,
        status: state.status,
        index: indexFor(state),
      };
      latest = next;
      spec.value = next;
      for (const listener of [...listeners]) listener();
      if (pending !== null) held = state;
      else setState(state);
    },
    switchStarted(generation) {
      pending = generation;
    },
    switchSettled(generation) {
      if (pending === null || generation < pending) return;
      pending = null;
      const flush = held;
      held = null;
      if (flush) setState(flush);
    },
  };
}
