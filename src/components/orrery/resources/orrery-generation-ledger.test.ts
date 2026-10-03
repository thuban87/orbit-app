import { describe, expect, it } from "vitest";
import { createOrreryGenerationLedger } from "./orrery-generation-ledger";

const BODY_LAYERS = ["bodiesBehind", "sun", "bodiesFront"] as const;

/** A disposable fake that fails loudly on a double dispose. */
function fake(name: string) {
  return {
    name,
    disposals: 0,
    dispose() {
      this.disposals++;
      if (this.disposals > 1) throw new Error(`${name} disposed twice`);
    },
  };
}

describe("38.7-07 H3: the generation ledger (canonical resource-lifetime contract)", () => {
  it("out-of-order acks across three layers retire nothing until the last recording layer acks", () => {
    const ledger = createOrreryGenerationLedger<string>();
    const epoch = ledger.beginEpoch();
    ledger.publish(1, BODY_LAYERS, ["old", "kept"]);
    ledger.publish(2, BODY_LAYERS, ["new", "kept"]);
    // Acks arrive in any order; each layer only speaks for itself.
    expect(ledger.ack("bodiesFront", 2, epoch)).toBe(true);
    expect(ledger.retirable()).toEqual([]);
    ledger.ack("bodiesBehind", 2, epoch);
    expect(ledger.retirable()).toEqual([]);
    // An ack of the OLD generation by the last layer still retires nothing.
    ledger.ack("sun", 1, epoch);
    expect(ledger.retirable()).toEqual([]);
    ledger.ack("sun", 2, epoch);
    expect(ledger.retirable()).toEqual(["old"]);
    // Drained exactly once; the still-referenced object stays tracked.
    expect(ledger.retirable()).toEqual([]);
    expect(ledger.holds("kept")).toBe(true);
    expect(ledger.holds("new")).toBe(true);
  });

  it("one layer's ack never retires another layer's references (labels vs bodies)", () => {
    const ledger = createOrreryGenerationLedger<string>();
    const epoch = ledger.beginEpoch();
    ledger.publish(1, BODY_LAYERS, ["initials-A"]);
    ledger.publish(2, ["labels"], ["label-A"]);
    ledger.publish(3, ["labels"], ["label-B"]);
    // Only labels moved on: the initials the bodies layers draw are untouched
    // even though the labels layer acked a generation newer than theirs.
    ledger.ack("labels", 3, epoch);
    expect(ledger.retirable()).toEqual(["label-A"]);
    for (const layer of BODY_LAYERS) ledger.ack(layer, 1, epoch);
    expect(ledger.retirable()).toEqual([]);
    expect(ledger.holds("initials-A")).toBe(true);
  });

  it("a delayed consumer (its ack held back, incl. the one-frame forward delay) keeps everything it recorded", () => {
    const ledger = createOrreryGenerationLedger<string>();
    const epoch = ledger.beginEpoch();
    ledger.publish(1, BODY_LAYERS, ["g1"]);
    ledger.publish(2, BODY_LAYERS, ["g2"]);
    ledger.publish(3, BODY_LAYERS, ["g3"]);
    ledger.ack("bodiesBehind", 3, epoch);
    ledger.ack("sun", 3, epoch);
    // bodiesFront recorded g3 but its ack is still waiting for the next UI
    // frame callback: nothing it may still replay is released.
    for (let i = 0; i < 5; i++) expect(ledger.retirable()).toEqual([]);
    ledger.ack("bodiesFront", 2, epoch);
    expect(ledger.retirable()).toEqual(["g1"]);
    ledger.ack("bodiesFront", 3, epoch);
    expect(ledger.retirable()).toEqual(["g2"]);
  });

  it("an ack can never claim a generation newer than the layer was given", () => {
    const ledger = createOrreryGenerationLedger<string>();
    const epoch = ledger.beginEpoch();
    ledger.publish(4, BODY_LAYERS, ["a"]);
    for (const layer of BODY_LAYERS) ledger.ack(layer, 99, epoch);
    ledger.publish(5, BODY_LAYERS, ["b"]);
    // The earlier over-claim counted as generation 4 only.
    expect(ledger.retirable()).toEqual([]);
    for (const layer of BODY_LAYERS) ledger.ack(layer, 5, epoch);
    expect(ledger.retirable()).toEqual(["a"]);
    // A layer that was never published to cannot ack.
    expect(ledger.ack("labels", 5, epoch)).toBe(false);
    // Generations must increase per layer.
    expect(ledger.publish(5, BODY_LAYERS, ["c"])).toBe(false);
  });

  it("replacement: the old object is disposed exactly once, after every recording layer acked", () => {
    const ledger = createOrreryGenerationLedger<ReturnType<typeof fake>>();
    const epoch = ledger.beginEpoch();
    const old = fake("old");
    const next = fake("next");
    ledger.publish(1, [...BODY_LAYERS, "labels"], [old]);
    ledger.publish(2, [...BODY_LAYERS, "labels"], [next]);
    const disposeAll = () => {
      for (const object of ledger.retirable()) object.dispose();
    };
    ledger.ack("labels", 2, epoch);
    ledger.ack("sun", 2, epoch);
    disposeAll();
    expect(old.disposals).toBe(0);
    ledger.ack("bodiesBehind", 2, epoch);
    disposeAll();
    expect(old.disposals).toBe(0);
    ledger.ack("bodiesFront", 2, epoch);
    disposeAll();
    disposeAll();
    expect(old.disposals).toBe(1);
    expect(next.disposals).toBe(0);
  });

  it("an object referenced again before its retirement is not retired", () => {
    const ledger = createOrreryGenerationLedger<string>();
    const epoch = ledger.beginEpoch();
    ledger.publish(1, BODY_LAYERS, ["a"]);
    ledger.publish(2, BODY_LAYERS, []);
    ledger.publish(3, BODY_LAYERS, ["a"]);
    for (const layer of BODY_LAYERS) ledger.ack(layer, 2, epoch);
    expect(ledger.retirable()).toEqual([]);
    for (const layer of BODY_LAYERS) ledger.ack(layer, 3, epoch);
    expect(ledger.retirable()).toEqual([]);
    expect(ledger.holds("a")).toBe(true);
  });

  it("remount: a new epoch ignores old-epoch acks still arriving; the old epoch keeps its objects until its teardown", () => {
    const ledger = createOrreryGenerationLedger<string>();
    const first = ledger.beginEpoch();
    ledger.publish(1, BODY_LAYERS, ["first-1"]);
    ledger.publish(2, BODY_LAYERS, ["first-2"]);
    const second = ledger.beginEpoch();
    expect(second).not.toBe(first);
    ledger.publish(1, BODY_LAYERS, ["second-1"]);
    ledger.publish(2, BODY_LAYERS, ["second-2"]);
    // Late acks of the first mount: discarded, and they retire nothing.
    for (const layer of BODY_LAYERS)
      expect(ledger.ack(layer, 2, first)).toBe(false);
    expect(ledger.retirable()).toEqual([]);
    for (const layer of BODY_LAYERS) ledger.ack(layer, 2, second);
    expect(ledger.retirable()).toEqual(["second-1"]);
    expect(ledger.stats().epochs).toBe(2);
    const handed: string[] = [];
    expect(ledger.teardown((o) => handed.push(o), first)).toBe(2);
    expect(handed).toEqual(["first-2", "first-1"]);
    // The current epoch is untouched by the old one's teardown.
    expect(ledger.epoch()).toBe(second);
    expect(ledger.holds("second-2")).toBe(true);
  });

  it("teardown: every retained object of the epoch in reverse creation order, once; later acks are stale", () => {
    const ledger = createOrreryGenerationLedger<string>();
    const epoch = ledger.beginEpoch();
    ledger.publish(1, BODY_LAYERS, ["a", "b"]);
    ledger.publish(2, ["labels"], ["c"]);
    ledger.publish(3, BODY_LAYERS, ["b", "d"]);
    const order: string[] = [];
    expect(ledger.teardown((o) => order.push(o))).toBe(4);
    expect(order).toEqual(["d", "c", "b", "a"]);
    expect(ledger.epoch()).toBeNull();
    expect(ledger.ack("bodiesBehind", 3, epoch)).toBe(false);
    expect(ledger.retirable()).toEqual([]);
    expect(ledger.teardown(() => order.push("again"))).toBe(0);
    expect(order).toHaveLength(4);
    // Publishing while unmounted is ignored.
    expect(ledger.publish(4, BODY_LAYERS, ["e"])).toBe(false);
  });

  it("a late decode completing after unmount is disposed at once and never published", () => {
    const ledger = createOrreryGenerationLedger<string>();
    const epoch = ledger.beginEpoch();
    ledger.publish(1, BODY_LAYERS, ["a"]);
    ledger.teardown(() => {});
    const late = fake("late decode");
    expect(ledger.admitResult(epoch, late, (r) => r.dispose())).toBe(false);
    expect(late.disposals).toBe(1);
    // In the next mount it is a stale result too.
    const next = ledger.beginEpoch();
    const stale = fake("stale shape");
    expect(ledger.admitResult(epoch, stale, (r) => r.dispose())).toBe(false);
    expect(stale.disposals).toBe(1);
    const fresh = fake("fresh");
    expect(ledger.admitResult(next, fresh, (r) => r.dispose())).toBe(true);
    expect(fresh.disposals).toBe(0);
  });
});
