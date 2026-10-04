import { beforeEach, describe, expect, it, vi } from "vitest";

/** Fake Skia: counts Make/reset/build/dispose and guards every disposal. */
const fake = vi.hoisted(() => ({
  makes: 0,
  resets: 0,
  builds: 0,
  disposes: 0,
  live: 0,
  maxLive: 0,
  texts: [] as string[],
  /** Throws if a disposal would free a Paragraph the UI may still draw. */
  guard: null as null | ((paragraph: object) => void),
}));
vi.mock("@shopify/react-native-skia", () => ({
  TextAlign: { Center: 2 },
  Skia: {
    Color: (color: string) => color,
    ParagraphBuilder: {
      Make: () => {
        fake.makes++;
        let text = "";
        let ink = "";
        const builder = {
          reset: () => {
            fake.resets++;
            text = "";
            ink = "";
          },
          pushStyle: (style: { color: string }) => {
            ink = style.color;
            return builder;
          },
          addText: (value: string) => {
            text += value;
            return builder;
          },
          pop: () => builder,
          build: () => {
            fake.builds++;
            fake.live++;
            fake.maxLive = Math.max(fake.maxLive, fake.live);
            fake.texts.push(text);
            const paragraph = {
              text,
              ink,
              disposed: false,
              layout: () => {},
              getLongestLine: () => 50,
              getHeight: () => 20,
              dispose: () => {
                fake.guard?.(paragraph);
                if (paragraph.disposed) throw new Error("double dispose");
                paragraph.disposed = true;
                fake.disposes++;
                fake.live--;
              },
            };
            return paragraph;
          },
        };
        return builder;
      },
    },
  },
}));

import type { SemanticLevel } from "@/logic/orrery-label-logic";
import {
  createOrrerySpecPublisher,
  ORRERY_BODY_LAYERS,
  ORRERY_LAYER,
  type OrreryBodyLook,
  parseLedgerHandle,
} from "../v2/scene-specs";
import { createOrreryGenerationLedger } from "./orrery-generation-ledger";
import {
  createOrreryTextPublisher,
  createOrreryTextService,
  ORRERY_INITIALS_MIN_RADIUS_PX,
  ORRERY_TEXT_CACHE_MAX_ENTRIES,
  ORRERY_TEXT_REKEY_MAX_GENERATIONS,
  type OrreryInitialsSpec,
  type OrreryLabelSpec,
  type OrreryTextRequest,
  type OrreryTextScene,
  type OrreryTextService,
  type OrreryTextVisibility,
} from "./orrery-text-service";

beforeEach(() => {
  fake.makes = 0;
  fake.resets = 0;
  fake.builds = 0;
  fake.disposes = 0;
  fake.live = 0;
  fake.maxLive = 0;
  fake.texts = [];
  fake.guard = null;
});

const provider = {} as never;
const request = (
  text: string,
  patch: Partial<OrreryTextRequest> = {},
): OrreryTextRequest => ({
  text,
  role: "label",
  fontScale: 1,
  maxWidth: 200,
  ink: "ink-a",
  family: "Inter",
  weight: 600,
  fontProvider: provider,
  ...patch,
});

describe("OrreryTextService cache", () => {
  it("returns the same Paragraph for identical inputs and builds it once", () => {
    const service = createOrreryTextService();
    const a = service.prepare(request("Ada"));
    const b = service.prepare(request("Ada"));
    expect(a).not.toBeNull();
    expect(b?.paragraph).toBe(a?.paragraph);
    expect(fake.builds).toBe(1);
  });

  it("misses on a different ink, width, role, font size or provider", () => {
    const service = createOrreryTextService();
    const base = service.prepare(request("Ada"));
    const variants = [
      request("Ada", { ink: "ink-b" }),
      request("Ada", { maxWidth: 150 }),
      request("Ada", { role: "caption" }),
      request("Ada", { fontSize: 13 }),
      request("Ada", { fontProvider: {} as never }),
    ];
    for (const variant of variants)
      expect(service.prepare(variant)?.paragraph).not.toBe(base?.paragraph);
    expect(fake.builds).toBe(6);
  });

  it("shares one builder per font provider and resets it before every build", () => {
    const service = createOrreryTextService();
    for (let i = 0; i < 50; i++) service.prepare(request(`Name ${i}`));
    expect(fake.makes).toBe(1);
    expect(fake.resets).toBe(50);
    service.prepare(request("Other", { fontProvider: {} as never }));
    expect(fake.makes).toBe(2);
    expect(service.stats().builders).toBe(2);
    expect(fake.texts.slice(0, 3)).toEqual(["Name 0", "Name 1", "Name 2"]);
  });

  it("evicts warm entries in LRU order and never a pinned one", () => {
    const service = createOrreryTextService({
      maxEntries: 3,
      priorityReserve: 0,
    });
    const owner = "w";
    const epoch = service.mount(owner);
    const a = service.prepare(request("A"));
    const b = service.prepare(request("B"));
    service.prepare(request("C"));
    service.acquire(owner, [service.keyOf(request("A")) as string], 1, epoch);
    service.prepare(request("B")); // touch B: C is now least recently used
    service.prepare(request("D"));
    expect(service.peek(service.keyOf(request("C")) as string)).toBeUndefined();
    expect(service.peek(service.keyOf(request("B")) as string)).toBe(b);
    service.prepare(request("E"));
    // A is pinned, so B (the LRU warm entry) goes instead.
    expect(service.peek(service.keyOf(request("A")) as string)).toBe(a);
    expect(service.peek(service.keyOf(request("B")) as string)).toBeUndefined();
    expect(
      (a?.paragraph as unknown as { disposed: boolean } | undefined)?.disposed,
    ).toBe(false);
  });

  it("keeps retired entries until the owner's ledger confirms them in the same mount epoch", () => {
    const service = createOrreryTextService({ warmMaxEntries: 0 });
    const owner = "w";
    const epoch = service.mount(owner);
    const keys = ["A", "B"].map((t) => {
      service.prepare(request(t));
      return service.keyOf(request(t)) as string;
    });
    service.acquire(owner, keys, 1, epoch);
    service.acquire(owner, [keys[0]], 2, epoch); // B retires at generation 2
    service.trim();
    expect(fake.disposes).toBe(0);
    expect(service.stats()).toMatchObject({ pinned: 1, retired: 1, warm: 0 });
    // A pinned key, an unknown key and a stale-epoch confirmation free nothing.
    service.confirmRetired(owner, [keys[0], "unknown"], epoch);
    service.confirmRetired(owner, [keys[1]], epoch - 1);
    service.trim();
    expect(fake.disposes).toBe(0);
    service.confirmRetired(owner, [keys[1]], epoch);
    service.trim();
    expect(fake.disposes).toBe(1);
    expect(service.peek(keys[1])).toBeUndefined();
  });

  it("release + teardown + clearUnheld disposes exactly the unpinned, ledger-cleared entries", () => {
    const service = createOrreryTextService();
    const epochA = service.mount("a");
    const epochB = service.mount("b");
    for (const t of ["A1", "A2", "B1", "warm"]) service.prepare(request(t));
    const key = (t: string) => service.keyOf(request(t)) as string;
    service.acquire("a", [key("A1"), key("A2")], 1, epochA);
    service.acquire("b", [key("B1")], 1, epochB);
    const released = service.release("a");
    expect(service.clearUnheld()).toBe(1); // only the never-pinned warm entry
    expect(service.peek(key("A1"))).toBeDefined();
    // A confirmation tagged with another epoch cannot free them.
    service.confirmRetired("a", [key("A1"), key("A2")], released + 1);
    expect(service.clearUnheld()).toBe(0);
    service.confirmReleased("a", released);
    expect(service.clearUnheld()).toBe(2);
    expect(service.peek(key("B1"))).toBeDefined();
    expect(fake.disposes).toBe(3);
  });

  it("a re-render with unchanged inputs builds nothing and disposes nothing", () => {
    const service = createOrreryTextService({ warmMaxEntries: 0 });
    const epoch = service.mount("w");
    const texts = ["A", "B", "C"];
    const render = (generation: number) => {
      const keys = texts.map((t) => {
        service.prepare(request(t));
        return service.keyOf(request(t)) as string;
      });
      service.acquire("w", keys, generation, epoch);
      service.trim();
    };
    render(1);
    const built = fake.builds;
    for (let g = 2; g < 10; g++) render(g);
    expect(fake.builds).toBe(built);
    expect(fake.disposes).toBe(0);
  });

  it("confirmRetired with dispose (the H3 teardown) disposes an unheld entry at once, never a pinned one", () => {
    const service = createOrreryTextService();
    const epochA = service.mount("a");
    const epochB = service.mount("b");
    const key = (t: string) => {
      service.prepare(request(t));
      return service.keyOf(request(t)) as string;
    };
    const [shared, own] = [key("shared"), key("own")];
    service.acquire("a", [shared, own], 1, epochA);
    service.acquire("b", [shared], 1, epochB);
    const released = service.release("a");
    expect(
      service.confirmRetired("a", [own, shared], released, { dispose: true }),
    ).toBe(1);
    expect(fake.disposes).toBe(1);
    expect(service.peek(shared)).toBeDefined();
    expect(service.peek(own)).toBeUndefined();
  });

  it("H4: refuses admission before shaping, so built − disposed never exceeds the cap", () => {
    const cap = 8;
    const service = createOrreryTextService({
      maxEntries: cap,
      priorityReserve: 2,
    });
    const epoch = service.mount("w");
    const pinned: string[] = [];
    let refused = 0;
    for (let i = 0; i < 20; i++) {
      const r = request(`N${i}`);
      const prepared = service.prepare(r, { priority: i % 3 === 0 });
      if (prepared) pinned.push(service.keyOf(r) as string);
      else refused++;
      service.acquire("w", pinned, i + 1, epoch);
      expect(fake.builds - fake.disposes).toBeLessThanOrEqual(cap);
    }
    expect(refused).toBeGreaterThan(0);
    expect(service.stats().refused).toBe(refused);
    expect(fake.builds).toBe(pinned.length);
    expect(fake.maxLive).toBeLessThanOrEqual(cap);
  });
});

// --- Publisher harness --------------------------------------------------------

const LAYERS = [...ORRERY_BODY_LAYERS, ORRERY_LAYER.labels];

interface Harness {
  service: OrreryTextService;
  publisher: ReturnType<typeof createOrreryTextPublisher>;
  /** Mounts the body looks for the scene's bodies, then publishes the scene. */
  setScene: (scene: OrreryTextScene) => void;
  labels: () => OrreryLabelSpec;
  initials: () => OrreryInitialsSpec;
  writes: () => number;
  /**
   * Every picture layer recorded its latest spec generation; acks arrive in a
   * shuffled order, each forwarded to the ledger and routed back to the text
   * publisher (38.7-07 H3), exactly as OrreryWorld routes them.
   */
  echo: () => void;
  /** Only `layers` ack their latest generation (others stay behind). */
  ack: (layers: readonly string[]) => void;
}

/**
 * A disposal of a Paragraph that a layer may still re-record — any generation
 * published to that layer that drew it and that the layer has not acked past —
 * is a use-after-free and throws.
 */
function harness(
  options: {
    maxEntries?: number;
    priorityReserve?: number;
    warm?: number;
    seed?: number;
  } = {},
): Harness {
  const service = createOrreryTextService({
    maxEntries: options.maxEntries,
    priorityReserve: options.priorityReserve,
    warmMaxEntries: options.warm ?? 0,
  });
  let labels: OrreryLabelSpec | null = null;
  let initials: OrreryInitialsSpec | null = null;
  let writes = 0;
  let seed = options.seed ?? 3;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const ledger = createOrreryGenerationLedger<string>();
  /** layer → [generation, the Paragraphs it drew]. */
  const history = new Map<string, { generation: number; drew: Set<object> }[]>(
    LAYERS.map((layer) => [layer, []]),
  );
  const latest = new Map<string, { generation: number; epoch: number }>();
  const delivered = new Map<string, number>();
  const record = (
    layers: readonly string[],
    generation: number,
    epoch: number,
    drew: Set<object>,
  ) => {
    for (const layer of layers) {
      history.get(layer)?.push({ generation, drew });
      latest.set(layer, { generation, epoch });
    }
  };
  const specs = createOrrerySpecPublisher({
    ledger,
    writeBodies: (bodies) => {
      const drew = new Set<object>();
      for (const body of bodies.bodies)
        if (body.initials) drew.add(body.initials.paragraph);
      record(ORRERY_BODY_LAYERS, bodies.generation, bodies.mountEpoch, drew);
    },
    writeLabels: (layer) => {
      const drew = new Set<object>();
      for (const entry of Object.values(layer.labels)) {
        if (entry.text) drew.add(entry.text.paragraph);
        if (entry.context) drew.add(entry.context.paragraph);
      }
      record([ORRERY_LAYER.labels], layer.generation, layer.mountEpoch, drew);
    },
  });
  const publisher = createOrreryTextPublisher({
    service,
    owner: "world",
    write: (nextLabels, nextInitials) => {
      writes++;
      if (nextLabels) {
        labels = nextLabels;
        specs.setLabels(nextLabels);
      }
      if (nextInitials) {
        initials = nextInitials;
        specs.setInitials(nextInitials);
      }
    },
  });
  fake.guard = (paragraph) => {
    for (const [layer, items] of history)
      for (const item of items)
        if (
          item.drew.has(paragraph) &&
          !((delivered.get(layer) ?? 0) > item.generation)
        )
          throw new Error(
            `use-after-free: ${layer} may still record generation ${item.generation}`,
          );
  };
  const ack = (layers: readonly string[]) => {
    const order = [...layers];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const layer of order) {
      const at = latest.get(layer);
      if (!at || !ledger.ack(layer, at.generation, at.epoch)) continue;
      delivered.set(layer, at.generation);
      // Batched per epoch, as OrreryWorld's router does.
      const byEpoch = new Map<number, string[]>();
      for (const handle of ledger.retirable()) {
        const parsed = parseLedgerHandle(handle);
        if (parsed?.kind === "text")
          byEpoch.set(parsed.epoch, [
            ...(byEpoch.get(parsed.epoch) ?? []),
            parsed.key,
          ]);
      }
      for (const [epoch, keys] of byEpoch)
        publisher.confirmRetired(keys, epoch);
    }
  };
  const looksFor = (scene: OrreryTextScene): OrreryBodyLook[] =>
    scene.initials.map((source) => ({
      key: source.key,
      kind: "contact",
      worldRadius: 16,
      outlineInk: [1, 1, 1, 1],
      swatchInk: [1, 1, 1, 1],
      photoKey: null,
      initialsFontSize: source.fontSize,
      moonInk: [0.5, 0.5, 0.5, 1],
    }));
  return {
    service,
    publisher,
    setScene: (scene) => {
      specs.setLooks(looksFor(scene));
      publisher.setScene(scene);
    },
    labels: () => labels as OrreryLabelSpec,
    initials: () => initials as OrreryInitialsSpec,
    writes: () => writes,
    echo: () => ack(LAYERS),
    ack,
  };
}

function textScene(
  count: number,
  patch: {
    focused?: number[];
    cluster?: number[];
    ink?: string;
    photo?: (i: number) => boolean;
  } = {},
): OrreryTextScene {
  return {
    labels: Array.from({ length: count }, (_, i) => ({
      key: `contact:${i}`,
      name: `Name ${i}`,
      context: `Context ${i}`,
      focused: patch.focused?.includes(i) ?? false,
      cluster: patch.cluster?.includes(i) ?? false,
      favorite: false,
    })),
    initials: Array.from({ length: count }, (_, i) => ({
      key: `contact:${i}`,
      text: `N${i}`,
      fontSize: 10,
      maxWidth: 17,
      hasPhoto: patch.photo?.(i) ?? false,
    })),
    labelWidth: 200,
    fontScale: 1,
    fontProvider: provider,
    labelInk: patch.ink ?? "label-ink",
    captionInk: "caption-ink",
    initialsInk: "swatch-ink",
  };
}
const visibleAll = (
  count: number,
  eligible: number[] = [],
): OrreryTextVisibility => ({
  visible: Array.from({ length: count }, (_, i) => `contact:${i}`),
  eligible: eligible.map((i) => ({ key: `contact:${i}`, radius: 20 + i })),
});
const labelled = (h: Harness) =>
  Object.keys(h.labels()?.labels ?? {}).filter(
    (key) => h.labels().labels[key].text,
  );

describe("OrreryTextPublisher", () => {
  it("prepares labels per tier: focused/cluster at overview, captions only at detail", () => {
    const h = harness();
    h.setScene(textScene(5, { focused: [1], cluster: [] }));
    h.publisher.setVisibility(visibleAll(5));
    expect(labelled(h)).toEqual(["contact:1"]);
    expect(h.labels().labels["contact:1"].context).toBeNull();
    h.publisher.setTier("identity");
    expect(labelled(h).sort()).toEqual(
      ["contact:0", "contact:1", "contact:2", "contact:3", "contact:4"].sort(),
    );
    expect(h.labels().measured.every((m) => m.context === undefined)).toBe(
      true,
    );
    h.publisher.setTier("detail");
    expect(h.labels().labels["contact:2"].context?.text).toBe("Context 2");
    expect(h.labels().measured.find((m) => m.id === "contact:2")).toMatchObject(
      { context: "Context 2", contextWidth: 66, contextHeight: 28 },
    );
  });

  it("an unchanged scene re-publish builds, writes and disposes nothing", () => {
    const h = harness();
    h.setScene(textScene(6, { focused: [0] }));
    h.publisher.setTier("identity");
    h.publisher.setVisibility(visibleAll(6, [0, 1, 2]));
    h.echo();
    const builds = fake.builds;
    const writes = h.writes();
    const generation = h.publisher.generation();
    for (let i = 0; i < 5; i++) {
      h.setScene(textScene(6, { focused: [0] })); // new, equal object
      h.publisher.setVisibility(visibleAll(6, [0, 1, 2]));
      h.echo();
    }
    expect(fake.builds).toBe(builds);
    expect(h.writes()).toBe(writes);
    expect(h.publisher.generation()).toBe(generation);
    expect(fake.disposes).toBe(0);
  });

  it("C-H2: a withheld echo disposes nothing; a replacement disposes the old entries once, after its echo", () => {
    const h = harness();
    h.setScene(textScene(4));
    h.publisher.setTier("identity");
    h.publisher.setVisibility(visibleAll(4, [0, 1, 2, 3]));
    h.echo();
    expect(fake.disposes).toBe(0);
    // A theme change re-keys everything; the consumer has not echoed yet, and
    // tier churn (captions in, captions out) lands on top of it.
    h.setScene(textScene(4, { ink: "new-ink" }));
    h.publisher.setTier("detail");
    h.publisher.setTier("identity");
    expect(fake.disposes).toBe(0);
    // One echo of the latest generation: the four old-ink labels and the four
    // detail-only captions are disposed, each exactly once (double → throws).
    h.echo();
    expect(fake.disposes).toBe(8);
    h.echo();
    h.echo();
    expect(fake.disposes).toBe(8);
    expect(labelled(h)).toHaveLength(4);
    expect(fake.live).toBe(fake.builds - fake.disposes);
    expect(fake.live).toBe(4 + 4); // new labels + the unchanged initials
  });

  it("C-H2: unmount disposes only after the release round trip", () => {
    const h = harness({ warm: 100 });
    h.setScene(textScene(3, { focused: [0] }));
    h.publisher.setTier("identity");
    h.echo();
    const epoch = h.publisher.release() as number;
    h.service.trim();
    expect(h.service.clearUnheld()).toBe(0);
    expect(fake.disposes).toBe(0);
    // The round trip completed: no pending redraw can read them any more.
    fake.guard = null;
    h.service.confirmReleased("world", epoch);
    expect(h.service.clearUnheld()).toBe(3);
    expect(fake.live).toBe(0);
  });

  it("H4: a 1,000-body All Contacts overview builds a bounded, prioritised set", () => {
    const h = harness({ maxEntries: ORRERY_TEXT_CACHE_MAX_ENTRIES });
    const photo = (i: number) => i % 5 < 2; // 40 % with a stored photo path
    h.setScene(textScene(1000, { focused: [500], photo }));
    // Most bodies are below the initials threshold; 60 are big enough.
    const eligible = Array.from({ length: 60 }, (_, i) => i * 7);
    h.publisher.setVisibility({
      visible: Array.from({ length: 1000 }, (_, i) => `contact:${i}`),
      eligible: eligible.map((i) => ({
        key: `contact:${i}`,
        radius: ORRERY_INITIALS_MIN_RADIUS_PX + (i % 13),
      })),
    });
    h.echo();
    // One focused label + initials for the eligible bodies; never 1 per body.
    expect(fake.builds).toBeLessThanOrEqual(eligible.length + 1);
    expect(fake.builds).toBeLessThan(100);
    expect(labelled(h)).toEqual(["contact:500"]);
    expect(Object.keys(h.initials().initials).length).toBe(eligible.length);
  });

  it("H4: under a tight cap photo-less initials are admitted before photo-path ones, largest first", () => {
    // Normal budget 12 − 2 = 10: the focused label + 9 initials.
    const h = harness({ maxEntries: 12, priorityReserve: 2 });
    const photo = (i: number) => i < 10;
    h.setScene(textScene(20, { focused: [19], photo }));
    h.publisher.setVisibility({
      visible: null,
      eligible: Array.from({ length: 20 }, (_, i) => ({
        key: `contact:${i}`,
        radius: 8 + i,
      })),
    });
    expect(labelled(h)).toEqual(["contact:19"]);
    const admitted = Object.keys(h.initials().initials).sort();
    // Photo-less bodies 10..19 come first (19 is the focused one, also eligible).
    expect(admitted).toEqual(
      Array.from({ length: 9 }, (_, i) => `contact:${19 - i}`).sort(),
    );
    expect(fake.builds - fake.disposes).toBeLessThanOrEqual(12);
  });

  it("C-M1: a focus change at a saturated cap publishes the focused label once capacity frees", () => {
    const cap = 10;
    const h = harness({ maxEntries: cap, priorityReserve: 2 });
    // Another owner holds every slot.
    const other = h.service.mount("other");
    const held: string[] = [];
    for (let i = 0; i < cap; i++) {
      const r = request(`held ${i}`);
      h.service.prepare(r, { priority: true });
      held.push(h.service.keyOf(r) as string);
    }
    h.service.acquire("other", held, 1, other);
    h.setScene(textScene(5, { focused: [3] }));
    expect(labelled(h)).toEqual([]);
    expect(h.publisher.pending()).toBe(true);
    // A superseded request (focus moved before capacity freed) never builds.
    h.setScene(textScene(5, { focused: [4] }));
    expect(fake.texts).not.toContain("Name 3");
    // The other owner lets go; its round trip completes → capacity frees.
    const released = h.service.release("other");
    h.service.confirmReleased("other", released);
    expect(labelled(h)).toEqual(["contact:4"]);
    expect(fake.texts).not.toContain("Name 3");
    expect(fake.maxLive).toBeLessThanOrEqual(cap);
  });

  it("C-M1/C3-L3: a whole-set theme re-key at a saturated cap fully publishes within the generation bound, dropping off-screen entries first", () => {
    const cap = 20;
    const h = harness({ maxEntries: cap, priorityReserve: 2 });
    // 6 cluster labels (always wanted; bodies 0..5 are off-screen) and 12
    // visible others (6..17): 18 pins, the whole normal budget.
    const scene = (ink: string) =>
      textScene(18, { cluster: [0, 1, 2, 3, 4, 5], ink });
    h.setScene(scene("ink-old"));
    h.publisher.setTier("identity");
    h.publisher.setVisibility({
      visible: Array.from({ length: 12 }, (_, i) => `contact:${i + 6}`),
      eligible: [],
    });
    h.echo();
    expect(labelled(h)).toHaveLength(18);
    const before = h.publisher.generation();
    const ink = (key: string) =>
      (h.labels().labels[key]?.text?.paragraph as unknown as { ink: string })
        ?.ink;
    // Theme change: every pinned key is superseded at once.
    h.setScene(scene("ink-new"));
    // Fallback generation, one step: the 2 free slots admit the top-priority
    // replacements; 14 superseded pins are dropped — all 4 remaining
    // off-screen ones before any visible one — and the 2 highest-priority
    // visible labels keep their old-ink Paragraph instead of blinking.
    expect(labelled(h).sort()).toEqual(
      ["contact:0", "contact:1", "contact:6", "contact:7"].sort(),
    );
    expect([ink("contact:0"), ink("contact:1")]).toEqual([
      "ink-new",
      "ink-new",
    ]);
    expect([ink("contact:6"), ink("contact:7")]).toEqual([
      "ink-old",
      "ink-old",
    ]);
    expect(h.publisher.pending()).toBe(true);
    // The echo is delayed: nothing more is published while waiting.
    h.publisher.setTier("identity");
    expect(h.publisher.generation() - before).toBe(1);
    expect(fake.builds - fake.disposes).toBeLessThanOrEqual(cap);
    // Echo → disposal of the dropped/replaced pins → admission of the rest.
    h.echo();
    expect(h.publisher.pending()).toBe(false);
    expect(labelled(h)).toHaveLength(18);
    for (const key of labelled(h)) expect(ink(key)).toBe("ink-new");
    expect(h.publisher.generation() - before).toBeLessThanOrEqual(
      ORRERY_TEXT_REKEY_MAX_GENERATIONS,
    );
    h.echo();
    expect(fake.maxLive).toBeLessThanOrEqual(cap);
    expect(fake.live).toBe(18);
  });

  it("C-M1: repeated tier churn at a saturated cap converges, bounded at every step", () => {
    const cap = 16;
    const h = harness({ maxEntries: cap, priorityReserve: 2, warm: 4 });
    h.setScene(textScene(30, { focused: [7] }));
    h.publisher.setVisibility(visibleAll(30, [0, 1, 2, 3, 4, 5, 6, 7]));
    const tiers: SemanticLevel[] = ["identity", "overview", "detail"];
    for (let round = 0; round < 12; round++) {
      h.publisher.setTier(tiers[round % 3]);
      if (round % 2 === 0) h.echo(); // the echo lags every other change
      expect(fake.builds - fake.disposes).toBeLessThanOrEqual(cap);
      expect(labelled(h)).toContain("contact:7"); // the focused label never blinks
    }
    h.publisher.setTier("identity");
    for (let i = 0; i < 4; i++) h.echo();
    expect(h.publisher.pending()).toBe(false);
    // Normal budget 14: the focused label + 13 others.
    expect(labelled(h)).toHaveLength(14);
    expect(fake.maxLive).toBeLessThanOrEqual(cap);
  });
});

describe("38.7-07 H3: text disposal under the per-layer ledger", () => {
  it("initials pinned by the body layers survive a labels-only ack", () => {
    const h = harness();
    const scene = (initialsInk: string) => ({
      ...textScene(3, { focused: [0] }),
      initialsInk,
    });
    h.setScene(scene("swatch-old"));
    h.publisher.setVisibility(visibleAll(3, [0, 1, 2]));
    h.echo();
    const disposedBefore = fake.disposes;
    // Re-key every initials glyph (and nothing the labels layer draws).
    h.setScene(scene("swatch-new"));
    h.ack([ORRERY_LAYER.labels]);
    expect(fake.disposes).toBe(disposedBefore);
    // Two of the three body layers: still nothing.
    h.ack([ORRERY_LAYER.bodiesBehind, ORRERY_LAYER.sun]);
    expect(fake.disposes).toBe(disposedBefore);
    h.ack([ORRERY_LAYER.bodiesFront]);
    expect(fake.disposes).toBe(disposedBefore + 3);
  });

  it("C3-L3: a whole-set re-key (labels and initials) at a saturated cap fully publishes within the bound with out-of-order and late layer acks", () => {
    const cap = 24;
    const h = harness({ maxEntries: cap, priorityReserve: 2, seed: 11 });
    const scene = (ink: string) => ({
      ...textScene(11, { cluster: [0, 1, 2], ink }),
      initialsInk: `swatch-${ink}`,
    });
    h.setScene(scene("old"));
    h.publisher.setTier("identity");
    h.publisher.setVisibility(
      visibleAll(11, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    );
    h.echo();
    // 11 labels + 11 initials = 22 pins: the whole normal budget.
    expect(fake.live).toBe(22);
    const before = h.publisher.generation();
    h.setScene(scene("new"));
    // The labels layer acks late; the body layers ack one at a time.
    for (const layer of ORRERY_BODY_LAYERS) {
      h.ack([layer]);
      expect(fake.builds - fake.disposes).toBeLessThanOrEqual(cap);
    }
    h.ack([ORRERY_LAYER.labels]);
    for (let i = 0; i < 4 && h.publisher.pending(); i++) h.echo();
    expect(h.publisher.pending()).toBe(false);
    const inks = Object.values(h.labels().labels).map(
      (entry) =>
        (entry.text as unknown as { paragraph: { ink: string } }).paragraph.ink,
    );
    expect(inks).toHaveLength(11);
    expect(new Set(inks)).toEqual(new Set(["new"]));
    const glyphs = Object.values(h.initials().initials).map(
      (entry) =>
        (entry as unknown as { paragraph: { ink: string } }).paragraph.ink,
    );
    expect(new Set(glyphs)).toEqual(new Set(["swatch-new"]));
    expect(h.publisher.generation() - before).toBeLessThanOrEqual(
      ORRERY_TEXT_REKEY_MAX_GENERATIONS,
    );
    expect(fake.maxLive).toBeLessThanOrEqual(cap);
  });
});

it("a UI report arriving after release never re-pins entries for the unmounted consumer", () => {
  const service = createOrreryTextService();
  const publisher = createOrreryTextPublisher({
    service,
    owner: "late",
    write: () => {},
  });
  publisher.setScene(textScene(3, { focused: [0] }));
  const epoch = publisher.release() as number;
  publisher.setTier("identity");
  publisher.setVisibility(visibleAll(3, [0, 1, 2]));
  publisher.confirmRetired([], epoch);
  expect(service.stats().pinned).toBe(0);
  service.confirmReleased("late", epoch);
  expect(service.clearUnheld()).toBe(1);
  // A remount (setScene) starts a fresh epoch and publishes again.
  publisher.setScene(textScene(3, { focused: [0] }));
  expect(publisher.epoch()).not.toBe(epoch);
  expect(service.stats().pinned).toBeGreaterThan(0);
});
