/**
 * The Orrery generation ledger (38.7-07, H3) — the canonical resource-lifetime
 * contract for every native object the V2 picture layers draw (Paragraphs,
 * SkImages and, in later plans, baked snapshots and switch sprites).
 *
 * WHY: a picture layer re-records on the UI thread from the specs it reads.
 * If the JS thread disposed an SkImage or Paragraph while a layer could still
 * re-record a spec that references it, the next recording throws
 * "Attempted to access a disposed object" (Pitfall 3). A recorded SkPicture
 * owns what it painted (see the 38.7-07 SUMMARY for the installed-Skia
 * evidence), so only RE-RECORDING is the hazard, and only the layers can say
 * when they have moved on.
 *
 * THE CONTRACT (38.7-07 PLAN, <resource_lifetime_contract>; Plans 13 and 15
 * cite it):
 *   1. Per-layer acknowledgement. Each layer acks `(layerId, generation,
 *      mountEpoch)` after its picture recorded that generation, forwarded to
 *      JS one UI frame later. Layers never share one "recorded" generation.
 *   2. An object is retired only once EVERY layer that recorded a generation
 *      referencing it has acked a newer generation in the same epoch. One
 *      layer's ack never retires another layer's references; out-of-order
 *      acks are normal.
 *   3. Teardown (unmount/background): the caller stops the clock, detaches
 *      the pictures and waits one UI round trip, then `teardown` hands back
 *      every object of that epoch in reverse creation order and ends it.
 *   4. Stale epochs: an ack, or a late decode/shape result, tagged with an
 *      epoch that is not current is discarded (the result disposed at once).
 *
 * Objects are opaque handles compared by identity (`Map` keys): the V2 spec
 * publisher uses strings such as `t<sep><text key>` and `p<sep><image id>`.
 * Nothing here touches Skia or React; it is pure JS-thread bookkeeping, so it
 * is node-testable with plain values.
 */

/** One tracked object within an epoch. */
interface Tracked<T> {
  object: T;
  /** Creation order within the epoch (teardown runs it in reverse). */
  serial: number;
  /** layer → the newest generation published to that layer that referenced it. */
  lastRef: Map<string, number>;
}

interface EpochState<T> {
  epoch: number;
  tracked: Map<T, Tracked<T>>;
  /** layer → the full reference set of the newest generation published to it. */
  current: Map<string, ReadonlySet<T>>;
  /** layer → the newest generation published to it. */
  latest: Map<string, number>;
  /** layer → the highest generation it has acknowledged. */
  acked: Map<string, number>;
  serial: number;
}

export interface OrreryLedgerStats {
  /** Epochs still holding objects (the current one plus any awaiting teardown). */
  epochs: number;
  /** Objects tracked in the current epoch. */
  tracked: number;
  /** The current epoch's per-layer acknowledged generation. */
  acked: Readonly<Record<string, number>>;
}

export interface OrreryGenerationLedger<T> {
  /**
   * Starts a new mount epoch and makes it current. A previous epoch that was
   * not torn down keeps its objects until `teardown(dispose, thatEpoch)`; its
   * acks are stale from now on.
   */
  beginEpoch(): number;
  /** The current epoch, or null when none is mounted. */
  epoch(): number | null;
  /**
   * Generation `generation` was written to the specs `layerIds` read; it
   * references exactly `objects` (the FULL set those layers' specs draw, not
   * a delta). Generations must increase per layer; a stale or unmounted
   * publish is ignored (returns false).
   */
  publish(
    generation: number,
    layerIds: readonly string[],
    objects: Iterable<T>,
  ): boolean;
  /**
   * `layerId` recorded `generation` of `mountEpoch` (one UI frame ago). A
   * stale epoch, or a layer that was never published to, is discarded.
   */
  ack(layerId: string, generation: number, mountEpoch: number): boolean;
  /**
   * Drains and returns (creation order) every object that no layer of the
   * current epoch can still re-record: for each layer that recorded it, the
   * layer's current spec no longer references it AND the layer has acked a
   * generation newer than the last one that did. Each object is handed out
   * exactly once; the caller disposes or un-pins it.
   */
  retirable(): T[];
  /** True while `object` is tracked by the current epoch. */
  holds(object: T): boolean;
  /** True when `mountEpoch` is the current epoch. */
  isCurrent(mountEpoch: number): boolean;
  /**
   * Rule 4: a late decode/shape result. Returns true when `mountEpoch` is
   * current; otherwise disposes `result` at once and returns false (it never
   * publishes and never retires anything in the new epoch).
   */
  admitResult<R>(
    mountEpoch: number,
    result: R,
    dispose: (result: R) => void,
  ): boolean;
  /**
   * Rule 3: hands every object `mountEpoch` (default: the current epoch)
   * still tracks to `dispose`, in REVERSE creation order, and ends that epoch
   * (later acks tagged with it are stale). Call only after the clock stopped,
   * the pictures were detached and one UI round trip confirmed no mapper can
   * still run. Returns the number of objects handed back.
   */
  teardown(dispose: (object: T) => void, mountEpoch?: number): number;
  stats(): OrreryLedgerStats;
}

export function createOrreryGenerationLedger<T>(): OrreryGenerationLedger<T> {
  const epochs = new Map<number, EpochState<T>>();
  let current: EpochState<T> | null = null;
  let epochSerial = 0;

  function retiredFrom(state: EpochState<T>, entry: Tracked<T>): boolean {
    for (const [layer, lastRef] of entry.lastRef) {
      if (state.current.get(layer)?.has(entry.object)) return false;
      if (!((state.acked.get(layer) ?? 0) > lastRef)) return false;
    }
    return true;
  }

  return {
    beginEpoch() {
      const epoch = ++epochSerial;
      current = {
        epoch,
        tracked: new Map(),
        current: new Map(),
        latest: new Map(),
        acked: new Map(),
        serial: 0,
      };
      epochs.set(epoch, current);
      return epoch;
    },
    epoch: () => current?.epoch ?? null,
    publish(generation, layerIds, objects) {
      const state = current;
      if (!state || !Number.isFinite(generation)) return false;
      for (const layer of layerIds)
        if ((state.latest.get(layer) ?? 0) >= generation) return false;
      const set = new Set(objects);
      for (const layer of layerIds) {
        state.latest.set(layer, generation);
        state.current.set(layer, set);
      }
      for (const object of set) {
        let entry = state.tracked.get(object);
        if (!entry) {
          entry = { object, serial: ++state.serial, lastRef: new Map() };
          state.tracked.set(object, entry);
        }
        for (const layer of layerIds) entry.lastRef.set(layer, generation);
      }
      return true;
    },
    ack(layerId, generation, mountEpoch) {
      const state = current;
      if (!state || state.epoch !== mountEpoch) return false;
      const latest = state.latest.get(layerId);
      if (latest === undefined || !Number.isFinite(generation)) return false;
      // A layer can only have recorded what was published to it.
      const recorded = Math.min(generation, latest);
      if (recorded > (state.acked.get(layerId) ?? 0))
        state.acked.set(layerId, recorded);
      return true;
    },
    retirable() {
      const state = current;
      if (!state) return [];
      const out: Tracked<T>[] = [];
      for (const entry of state.tracked.values())
        if (retiredFrom(state, entry)) out.push(entry);
      out.sort((a, b) => a.serial - b.serial);
      for (const entry of out) state.tracked.delete(entry.object);
      return out.map((entry) => entry.object);
    },
    holds: (object) => current?.tracked.has(object) ?? false,
    isCurrent: (mountEpoch) => current?.epoch === mountEpoch,
    admitResult(mountEpoch, result, dispose) {
      if (current?.epoch === mountEpoch) return true;
      dispose(result);
      return false;
    },
    teardown(dispose, mountEpoch) {
      const epoch = mountEpoch ?? current?.epoch;
      if (epoch === undefined) return 0;
      const state = epochs.get(epoch);
      if (!state) return 0;
      epochs.delete(epoch);
      if (current === state) current = null;
      const entries = [...state.tracked.values()].sort(
        (a, b) => b.serial - a.serial,
      );
      state.tracked.clear();
      for (const entry of entries) dispose(entry.object);
      return entries.length;
    },
    stats() {
      const acked: Record<string, number> = {};
      if (current) for (const [layer, g] of current.acked) acked[layer] = g;
      return {
        epochs: epochs.size,
        tracked: current?.tracked.size ?? 0,
        acked,
      };
    },
  };
}
