import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A fake Skia: every native object records its own disposal in `log`, and a
 * snapshot picture REFUSES disposal while the base layer may still draw it
 * (`showing`), i.e. a use-after-free fails the test.
 */
const fake = vi.hoisted(() => ({
  log: [] as string[],
  showing: null as null | { id: number | null },
  surfaces: 0,
  offscreen: true,
  /** Image serial = registry id while each test uses one registry. */
  images: 0,
}));
vi.mock("@shopify/react-native-skia", () => {
  const handle = (label: string) => ({
    label,
    dispose: () => {
      fake.log.push(`dispose ${label}`);
    },
  });
  return {
    FilterMode: { Nearest: 0, Linear: 1 },
    MipmapMode: { None: 0 },
    createPicture: (draw: (canvas: unknown) => void) => {
      const ops: unknown[][] = [];
      draw(
        new Proxy(
          {},
          {
            get:
              (_t, op: string) =>
              (...args: unknown[]) => {
                ops.push([op, ...args]);
              },
          },
        ),
      );
      const image = ops[0]?.[1] as { label: string } | undefined;
      const picture = {
        ...handle(`picture(${image?.label ?? "?"})`),
        ops,
        image,
      };
      picture.dispose = () => {
        const id = Number(image?.label.split("#")[1]);
        if (fake.showing && fake.showing.id === id)
          throw new Error(`use-after-free: snapshot #${id} is still drawn`);
        fake.log.push(`dispose picture(${image?.label})`);
      };
      return picture;
    },
    Skia: {
      XYWHRect: (x: number, y: number, width: number, height: number) => ({
        x,
        y,
        width,
        height,
      }),
      Surface: {
        MakeOffscreen: (w: number, h: number) => {
          if (!fake.offscreen) return null;
          const n = ++fake.surfaces;
          const ops: unknown[][] = [];
          return {
            ...handle(`surface${n}(${w}x${h})`),
            ops,
            getCanvas: () =>
              new Proxy(
                {},
                {
                  get:
                    (_t, op: string) =>
                    (...args: unknown[]) => {
                      ops.push([op, ...args]);
                    },
                },
              ),
            flush: () => {},
            makeImageSnapshot: () => handle(`image#${++fake.images}`),
          };
        },
      },
    },
  };
});

import { createOrreryGenerationLedger } from "../resources/orrery-generation-ledger";
import {
  BAKE_AFTER_STILL_TICKS,
  type BakeRegistry,
  type BakeState,
  bakeBaseSnapshot,
  bakeUnavailable,
  createBaseBakeOwner,
  disposeBakedSnapshots,
  EMPTY_BAKE_REGISTRY,
  INITIAL_BAKE_STATE,
  LIVE_BASE,
  nextBakeState,
  selectBasePicture,
  teardownBakeRegistry,
} from "./base-bake";
import { ORRERY_LAYER, parseLedgerHandle } from "./scene-specs";

beforeEach(() => {
  fake.log = [];
  fake.showing = null;
  fake.surfaces = 0;
  fake.offscreen = true;
  fake.images = 0;
});

const STILL = { sceneChanged: false, busy: false, mountEpoch: 1 };

/** Feeds `ticks` distinct ambient ticks; returns the final state and actions. */
function run(state: BakeState, ticks: number, from = 0, inputs = STILL) {
  const actions: string[] = [];
  let s = state;
  for (let i = 0; i < ticks; i++) {
    const step = nextBakeState(s, { ...inputs, tick: (from + i) * 33 });
    s = step.state;
    actions.push(step.action);
  }
  return { state: s, actions };
}

describe("bake decision table (D-49)", () => {
  it("still → bakes once after BAKE_AFTER_STILL_TICKS distinct ambient ticks", () => {
    const { state, actions } = run(
      INITIAL_BAKE_STATE,
      BAKE_AFTER_STILL_TICKS + 5,
    );
    expect(actions.indexOf("bake")).toBe(BAKE_AFTER_STILL_TICKS - 1);
    expect(actions.filter((a) => a === "bake")).toHaveLength(1);
    expect(state.phase).toBe("baked");
  });
  it("an unchanged ambient tick does not count", () => {
    let s = INITIAL_BAKE_STATE;
    for (let i = 0; i < 100; i++)
      s = nextBakeState(s, { ...STILL, tick: 66 }).state;
    expect(s.still).toBe(1);
    expect(s.phase).toBe("live");
  });
  it("move → live; a baked base is invalidated at once", () => {
    const baked = run(INITIAL_BAKE_STATE, BAKE_AFTER_STILL_TICKS).state;
    const moved = nextBakeState(baked, {
      ...STILL,
      tick: 9999,
      sceneChanged: true,
    });
    expect(moved.action).toBe("invalidate");
    expect(moved.state).toMatchObject({ phase: "live", still: 0 });
    // Moving while live is not an invalidation.
    expect(
      nextBakeState(INITIAL_BAKE_STATE, {
        ...STILL,
        tick: 1,
        sceneChanged: true,
      }).action,
    ).toBe("none");
  });
  it("switch or gesture (busy) → live, ticks do not count, a bake is invalidated", () => {
    const busy = { ...STILL, busy: true };
    const during = run(INITIAL_BAKE_STATE, BAKE_AFTER_STILL_TICKS * 3, 0, busy);
    expect(during.actions.every((a) => a === "none")).toBe(true);
    expect(during.state.phase).toBe("live");
    const baked = run(INITIAL_BAKE_STATE, BAKE_AFTER_STILL_TICKS).state;
    expect(nextBakeState(baked, { ...busy, tick: 5000 }).action).toBe(
      "invalidate",
    );
  });
  it("a base-spec change (theme, ring look) invalidates like a move", () => {
    // A spec change re-records the live picture, which the canvas reports as
    // sceneChanged; the table treats it exactly like a move.
    const baked = run(INITIAL_BAKE_STATE, BAKE_AFTER_STILL_TICKS).state;
    expect(
      nextBakeState(baked, { ...STILL, tick: 7000, sceneChanged: true }).action,
    ).toBe("invalidate");
  });
  it("never bakes without an ambient clock (reduced motion) or before a mount epoch", () => {
    let s = INITIAL_BAKE_STATE;
    for (let i = 0; i < 100; i++)
      s = nextBakeState(s, { ...STILL, tick: -1 }).state;
    expect(s.phase).toBe("live");
    const noEpoch = run(INITIAL_BAKE_STATE, BAKE_AFTER_STILL_TICKS * 2, 0, {
      ...STILL,
      mountEpoch: 0,
    });
    expect(noEpoch.actions).not.toContain("bake");
  });
  it("a failed bake stays live until the scene changes, then may bake again", () => {
    const failed = bakeUnavailable(
      run(INITIAL_BAKE_STATE, BAKE_AFTER_STILL_TICKS).state,
    );
    const still = run(failed, BAKE_AFTER_STILL_TICKS * 2, 100);
    expect(still.actions).not.toContain("bake");
    const moved = nextBakeState(still.state, {
      ...STILL,
      tick: 1,
      sceneChanged: true,
    });
    expect(moved.action).toBe("none");
    expect(run(moved.state, BAKE_AFTER_STILL_TICKS, 200).actions).toContain(
      "bake",
    );
  });
  it("the base layer shows a snapshot only while it matches the live picture", () => {
    const live = { label: "live-1" } as never;
    const other = { label: "live-2" } as never;
    const snapshot = { label: "snap" } as never;
    const baked = {
      ...LIVE_BASE,
      generation: 1,
      mountEpoch: 1,
      picture: snapshot,
      source: live,
      id: 1,
    };
    expect(selectBasePicture(baked, live)).toBe(snapshot);
    expect(selectBasePicture(baked, other)).toBe(other);
    expect(selectBasePicture(LIVE_BASE, live)).toBe(live);
  });
});

describe("UI-thread bake helpers", () => {
  it("bakes at device pixels into one reused surface and blits 1:1", () => {
    const registry = { value: EMPTY_BAKE_REGISTRY };
    const live = { label: "live" } as never;
    const first = bakeBaseSnapshot(registry, live, 400, 800, 2.5);
    const second = bakeBaseSnapshot(registry, live, 400, 800, 2.5);
    expect(first?.id).toBe(1);
    expect(second?.id).toBe(2);
    expect(fake.surfaces).toBe(1);
    expect(registry.value).toMatchObject({ width: 1000, height: 2000 });
    expect(Object.keys(registry.value.snapshots)).toEqual(["1", "2"]);
    const surface = registry.value.surface as unknown as { ops: unknown[][] };
    expect(surface.ops.map((op) => op[0])).toEqual([
      "clear",
      "save",
      "scale",
      "drawPicture",
      "restore",
      "clear",
      "save",
      "scale",
      "drawPicture",
      "restore",
    ]);
    expect(surface.ops[2].slice(1)).toEqual([2.5, 2.5]);
    expect(surface.ops[3][1]).toBe(live);
    const blit = (first as unknown as { picture: { ops: unknown[][] } }).picture
      .ops[0];
    expect(blit[0]).toBe("drawImageRectOptions");
    expect(blit[2]).toEqual({ x: 0, y: 0, width: 1000, height: 2000 });
    expect(blit[3]).toEqual({ x: 0, y: 0, width: 400, height: 800 });
    // A new size makes a new surface and disposes the old one.
    bakeBaseSnapshot(registry, live, 500, 800, 2.5);
    expect(fake.surfaces).toBe(2);
    expect(fake.log).toContain("dispose surface1(1000x2000)");
  });
  it("no offscreen surface → no bake (the base stays live)", () => {
    fake.offscreen = false;
    const registry = { value: EMPTY_BAKE_REGISTRY };
    expect(bakeBaseSnapshot(registry, {} as never, 400, 800, 2)).toBeNull();
    expect(registry.value).toBe(EMPTY_BAKE_REGISTRY);
    expect(bakeBaseSnapshot(registry, {} as never, 0, 800, 2)).toBeNull();
  });
  it("disposes the picture then the image of each listed snapshot", () => {
    const registry = { value: EMPTY_BAKE_REGISTRY };
    bakeBaseSnapshot(registry, {} as never, 10, 10, 1);
    bakeBaseSnapshot(registry, {} as never, 10, 10, 1);
    disposeBakedSnapshots(registry, [1, 99]);
    expect(fake.log).toEqual(["dispose picture(image#1)", "dispose image#1"]);
    expect(Object.keys(registry.value.snapshots)).toEqual(["2"]);
  });
});

/**
 * The canvas + world round trip, simulated: the UI bakes / invalidates and
 * reports to the owner (runOnJS order), the base picture acks what it shows,
 * and the world routes the ledger's retirements to UI disposal.
 */
function lifecycle() {
  const ledger = createOrreryGenerationLedger<string>();
  const epoch = ledger.beginEpoch();
  const registry: { value: BakeRegistry } = { value: EMPTY_BAKE_REGISTRY };
  const owner = createBaseBakeOwner({
    ledger,
    dispose: (ids) => disposeBakedSnapshots(registry, ids),
  });
  let generation = 0;
  const shows = { generation: 0, id: null as number | null };
  fake.showing = shows;
  const live = () => Object.keys(registry.value.snapshots).map(Number);
  return {
    ledger,
    epoch,
    registry,
    live,
    shows,
    bake() {
      const shot = bakeBaseSnapshot(registry, {} as never, 100, 200, 2);
      if (!shot) throw new Error("bake failed");
      generation++;
      shows.generation = generation;
      shows.id = shot.id;
      owner.published(epoch, generation, shot.id);
      return shot.id;
    },
    invalidate() {
      generation++;
      shows.generation = generation;
      shows.id = null;
      owner.published(epoch, generation, null);
    },
    /** The base picture acks the generation it shows (one frame later). */
    ack() {
      ledger.ack(ORRERY_LAYER.base, shows.generation, epoch);
      const ids = ledger
        .retirable()
        .map(parseLedgerHandle)
        .flatMap((h) => (h?.kind === "base" ? [h.id] : []));
      disposeBakedSnapshots(registry, ids);
      return ids;
    },
    owner,
  };
}

describe("baked snapshots through the generation ledger (H3/C-H2)", () => {
  it("delayed consumer: the old snapshot waits for the base ack, then goes", () => {
    const h = lifecycle();
    const first = h.bake();
    expect(h.ack()).toEqual([]);
    h.invalidate(); // the scene moved: the base draws live (ack withheld)
    expect(h.live()).toEqual([first]);
    const second = h.bake(); // still again (ack still withheld)
    expect(h.live()).toEqual([first, second]);
    expect(fake.log).toEqual([]);
    expect(h.ack()).toEqual([first]);
    expect(h.live()).toEqual([second]);
    expect(fake.log).toEqual([
      `dispose picture(image#${first})`,
      `dispose image#${first}`,
    ]);
  });
  it("an out-of-date ack (an older generation) retires nothing it may still draw", () => {
    const h = lifecycle();
    const first = h.bake();
    const shown = h.shows.generation;
    h.invalidate();
    h.bake();
    // An ack for the generation that still drew `first` arrives late.
    h.ledger.ack(ORRERY_LAYER.base, shown, h.epoch);
    expect(h.ledger.retirable()).toEqual([]);
    expect(h.live()).toContain(first);
  });
  it("replacement: exactly one live snapshot after N settles (no leak)", () => {
    const h = lifecycle();
    for (let settle = 0; settle < 12; settle++) {
      h.bake();
      h.ack();
      h.invalidate();
      h.ack();
    }
    expect(h.live()).toEqual([]);
    h.bake();
    h.ack();
    expect(h.live()).toHaveLength(1);
    expect(h.ledger.stats().tracked).toBe(1);
    expect(fake.log.filter((l) => l.startsWith("dispose image"))).toHaveLength(
      12,
    );
    expect(fake.surfaces).toBe(1);
  });
  it("unmount mid-bake: teardown disposes snapshots newest first, then the surface; a late snapshot of the old epoch is disposed and never published", () => {
    const h = lifecycle();
    const a = h.bake();
    h.invalidate();
    const b = h.bake(); // `a` still awaits the base ack
    // Unmount: clock stopped, pictures detached, one UI round trip — then
    // the ledger hands back the epoch's objects in reverse creation order.
    fake.showing = null;
    const order: number[] = [];
    h.ledger.teardown((handle) => {
      const parsed = parseLedgerHandle(handle);
      if (parsed?.kind === "base") order.push(parsed.id);
    }, h.epoch);
    expect(order).toEqual([b, a]);
    teardownBakeRegistry(h.registry, order);
    expect(fake.log).toEqual([
      `dispose picture(image#${b})`,
      `dispose image#${b}`,
      `dispose picture(image#${a})`,
      `dispose image#${a}`,
      "dispose surface1(200x400)",
    ]);
    expect(h.live()).toEqual([]);
    expect(h.registry.value.surface).toBeNull();
    // A bake that completed on the UI thread before the unmount reaches JS
    // only now, tagged with the old epoch.
    fake.log = [];
    const late = bakeBaseSnapshot(h.registry, {} as never, 100, 200, 2);
    expect(h.owner.published(h.epoch, 99, late?.id ?? -1)).toBe(false);
    expect(fake.log).toEqual([
      `dispose picture(image#${late?.id})`,
      `dispose image#${late?.id}`,
    ]);
    expect(h.ledger.holds(`b\u0001${h.epoch}\u0001${late?.id}`)).toBe(false);
    expect(h.ledger.stats().epochs).toBe(0);
  });
  it("teardown also disposes snapshots the ledger never tracked (newest first)", () => {
    const registry = { value: EMPTY_BAKE_REGISTRY };
    bakeBaseSnapshot(registry, {} as never, 10, 10, 1);
    bakeBaseSnapshot(registry, {} as never, 10, 10, 1);
    expect(teardownBakeRegistry(registry, [])).toBe(2);
    expect(fake.log).toEqual([
      "dispose picture(image#2)",
      "dispose image#2",
      "dispose picture(image#1)",
      "dispose image#1",
      "dispose surface1(10x10)",
    ]);
  });
  it("a live (null) publish of a stale epoch is ignored", () => {
    const h = lifecycle();
    h.ledger.teardown(() => {}, h.epoch);
    expect(h.owner.published(h.epoch, 5, null)).toBe(false);
  });
});
