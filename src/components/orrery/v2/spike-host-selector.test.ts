import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  PixelRatio: { get: () => 2 },
}));

import { resolveWidgetUri } from "@/navigation/widget-linking";
import {
  applyOrreryHostOverride,
  defaultOrreryRenderHost,
  describeOrreryHost,
} from "./render-host";
import {
  createOrrerySpikeSelector,
  parseOrrerySpikeUrl,
  type SpikeLinking,
} from "./spike-host-selector";

const URL_BASE = "orbit://orrery-spike";

describe("parseOrrerySpikeUrl (D-59 release spike selector)", () => {
  it("parses every key", () => {
    expect(
      parseOrrerySpikeUrl(
        `${URL_BASE}?opaque=on&driver=interval&bake=on&ring=hybrid&minRings=250`,
      ),
    ).toEqual({
      ok: true,
      override: {
        opaqueCanvas: true,
        ambientDriver: "interval",
        bakePath: "gpu-offscreen",
        ringMethod: "hybrid",
        ringFieldMinRings: 250,
      },
    });
    expect(
      parseOrrerySpikeUrl(
        `${URL_BASE}?opaque=off&driver=frame-clock&bake=off&ring=world-plane`,
      ),
    ).toEqual({
      ok: true,
      override: {
        opaqueCanvas: false,
        ambientDriver: "frame-clock",
        bakePath: "none",
        ringMethod: "world-plane",
      },
    });
    expect(parseOrrerySpikeUrl(`${URL_BASE}?ring=ring-field`)).toEqual({
      ok: true,
      override: { ringMethod: "ring-field" },
    });
  });
  it("a bare URL selects the code defaults (an empty override)", () => {
    expect(parseOrrerySpikeUrl(URL_BASE)).toEqual({ ok: true, override: {} });
    expect(parseOrrerySpikeUrl(`${URL_BASE}?`)).toEqual({
      ok: true,
      override: {},
    });
  });
  it.each([
    ["an unknown key", `${URL_BASE}?opaque=on&nebula=on`],
    ["a repeated key", `${URL_BASE}?opaque=on&opaque=off`],
    ["a bad opaque value", `${URL_BASE}?opaque=yes`],
    ["a bad driver", `${URL_BASE}?driver=vsync`],
    ["a bad bake value", `${URL_BASE}?bake=1`],
    ["a bad ring method", `${URL_BASE}?ring=stroke`],
    ["a non-integer minRings", `${URL_BASE}?minRings=1.5`],
    ["a zero minRings", `${URL_BASE}?minRings=0`],
    ["a negative minRings", `${URL_BASE}?minRings=-4`],
    ["an oversized minRings", `${URL_BASE}?minRings=9999999`],
    ["a pair without =", `${URL_BASE}?opaque`],
    ["an empty key", `${URL_BASE}?=on`],
    ["a fragment", `${URL_BASE}?opaque=on#x`],
    ["another host", "orbit://orrery-spikes?opaque=on"],
    ["another scheme", "https://orrery-spike?opaque=on"],
    ["a path", `${URL_BASE}/x?opaque=on`],
  ])("rejects %s", (_label, url) => {
    expect(parseOrrerySpikeUrl(url).ok).toBe(false);
  });
  it("rejects a non-string", () => {
    expect(parseOrrerySpikeUrl(null).ok).toBe(false);
    expect(parseOrrerySpikeUrl(42).ok).toBe(false);
  });
  it("the widget deep-link resolver ignores the spike host (never routed as a screen)", () => {
    expect(resolveWidgetUri(`${URL_BASE}?opaque=on`)).toBeNull();
    expect(resolveWidgetUri(URL_BASE)).toBeNull();
  });
});

function fakeLinking(initial: string | null = null) {
  let listener: ((event: { url: string }) => void) | null = null;
  let removed = false;
  const linking: SpikeLinking = {
    addEventListener: (_event, next) => {
      listener = next;
      return {
        remove: () => {
          removed = true;
        },
      };
    },
    getInitialURL: () => Promise.resolve(initial),
  };
  return {
    linking,
    emit: (url: string) => listener?.({ url }),
    removed: () => removed,
  };
}

function selector(initial: string | null = null) {
  const lines: string[] = [];
  const fake = fakeLinking(initial);
  const s = createOrrerySpikeSelector({
    linking: () => fake.linking,
    log: (line) => lines.push(line),
    resolveDefaults: () => defaultOrreryRenderHost("android"),
    describe: describeOrreryHost,
  });
  return { s, lines, fake };
}

describe("spike selector (url events, effective-host log)", () => {
  it("a URL event selects a variant and logs the effective host", () => {
    const { s, lines, fake } = selector();
    s.listen();
    fake.emit(`${URL_BASE}?opaque=on&driver=interval&bake=on`);
    expect(s.current()).toEqual({
      opaqueCanvas: true,
      ambientDriver: "interval",
      bakePath: "gpu-offscreen",
    });
    expect(lines).toEqual([
      "orrery-spike host=opaque=on,driver=interval,bake=on,ring=world-plane,minRings=400 source=url",
    ]);
  });
  it("each URL replaces the previous selection (absent keys fall back to the defaults)", () => {
    const { s, fake } = selector();
    s.listen();
    fake.emit(`${URL_BASE}?opaque=on&driver=interval`);
    fake.emit(`${URL_BASE}?bake=on`);
    expect(s.current()).toEqual({ bakePath: "gpu-offscreen" });
  });
  it("a rejected URL leaves the selection unchanged and logs why; other URLs are ignored silently", () => {
    const { s, lines, fake } = selector();
    s.listen();
    fake.emit(`${URL_BASE}?opaque=on`);
    fake.emit(`${URL_BASE}?opaque=on&evil=1`);
    fake.emit("orbit://contact/12");
    expect(s.current()).toEqual({ opaqueCanvas: true });
    expect(lines.at(-1)).toBe("orrery-spike rejected reason=unknown key evil");
    expect(lines).toHaveLength(2);
  });
  it("applies the launch URL when no url event came first; listens once; stops", async () => {
    const { s, fake } = selector(`${URL_BASE}?driver=interval`);
    s.listen();
    s.listen();
    await Promise.resolve();
    await Promise.resolve();
    expect(s.current()).toEqual({ ambientDriver: "interval" });
    s.stop();
    expect(fake.removed()).toBe(true);
  });
  it("a url event beats a late launch URL", async () => {
    const { s, fake } = selector(`${URL_BASE}?driver=interval`);
    s.listen();
    fake.emit(`${URL_BASE}?opaque=on`);
    await Promise.resolve();
    await Promise.resolve();
    expect(s.current()).toEqual({ opaqueCanvas: true });
  });
  it("report() logs the mounted canvas's effective host", () => {
    const { s, lines } = selector();
    s.report(
      applyOrreryHostOverride(defaultOrreryRenderHost("android"), {
        ringMethod: "ring-field",
      }),
      "mount",
    );
    expect(lines).toEqual([
      "orrery-spike host=opaque=on,driver=frame-clock,bake=on,ring=ring-field,minRings=400 source=mount",
    ]);
  });
});
