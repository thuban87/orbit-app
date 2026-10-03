/**
 * 38.7-08 (D-59): the RELEASE spike's variant selector. It exists only in a
 * bundle built with EXPO_PUBLIC_ORRERY_SPIKE=1 — render-host.ts requires it
 * as `process.env.EXPO_PUBLIC_ORRERY_SPIKE === "1" ? require(…) : null`, which
 * Expo inlines and Metro folds away in every normal build (Task 2 proves the
 * string `orrery-spike` is absent from a normal-env export).
 *
 * The measurement tools select a variant on the one spike release APK with
 *   adb shell am start -W -a android.intent.action.VIEW \
 *     -d "orbit://orrery-spike?opaque=on&driver=interval&bake=on&ring=world-plane&minRings=400" \
 *     com.bwales.orbit
 * Each URL REPLACES the previous selection (absent keys fall back to the code
 * defaults), so a run never inherits a stale variant. The parser is a strict
 * allow-list: an unknown key, a repeated key or an unknown value rejects the
 * whole URL (logged, selection unchanged). The selection applies at the next
 * canvas mount; every mount logs `orrery-spike host=<effective host>` so the
 * tools confirm the mounted canvas, not just the URL (C-L4).
 *
 * Synthetic measurement knobs only: no user data is read or logged, and the
 * widget deep-link resolver ignores this host (it returns null for it).
 */
import type { OrreryHostOverride, OrreryRenderHost } from "./render-host";

/** The one accepted URL form (scheme + host); a query is optional. */
const SPIKE_URL = /^orbit:\/\/orrery-spike(?:\?([^#]*))?$/;
const MAX_MIN_RINGS = 100_000;

export type SpikeParse =
  | { ok: true; override: OrreryHostOverride }
  | { ok: false; reason: string };

function onOff(value: string): boolean | null {
  return value === "on" ? true : value === "off" ? false : null;
}

/** Strictly parses an `orbit://orrery-spike?…` URL into a host override. */
export function parseOrrerySpikeUrl(url: unknown): SpikeParse {
  if (typeof url !== "string") return { ok: false, reason: "not a string" };
  const match = SPIKE_URL.exec(url);
  if (!match) return { ok: false, reason: "not an orrery-spike url" };
  const query = match[1] ?? "";
  const override: OrreryHostOverride = {};
  const seen = new Set<string>();
  if (query.length === 0) return { ok: true, override };
  for (const pair of query.split("&")) {
    const eq = pair.indexOf("=");
    if (eq <= 0) return { ok: false, reason: `malformed "${pair}"` };
    const key = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    if (seen.has(key)) return { ok: false, reason: `repeated key ${key}` };
    seen.add(key);
    switch (key) {
      case "opaque": {
        const flag = onOff(value);
        if (flag === null) return { ok: false, reason: `bad opaque=${value}` };
        override.opaqueCanvas = flag;
        break;
      }
      case "driver":
        if (value !== "frame-clock" && value !== "interval")
          return { ok: false, reason: `bad driver=${value}` };
        override.ambientDriver = value;
        break;
      case "bake": {
        const flag = onOff(value);
        if (flag === null) return { ok: false, reason: `bad bake=${value}` };
        override.bakePath = flag ? "gpu-offscreen" : "none";
        break;
      }
      case "ring":
        if (
          value !== "world-plane" &&
          value !== "ring-field" &&
          value !== "hybrid"
        )
          return { ok: false, reason: `bad ring=${value}` };
        override.ringMethod = value;
        break;
      case "minRings": {
        if (!/^[0-9]{1,6}$/.test(value))
          return { ok: false, reason: `bad minRings=${value}` };
        const n = Number(value);
        if (!(n >= 1 && n <= MAX_MIN_RINGS))
          return { ok: false, reason: `bad minRings=${value}` };
        override.ringFieldMinRings = n;
        break;
      }
      default:
        return { ok: false, reason: `unknown key ${key}` };
    }
  }
  return { ok: true, override };
}

/** The subset of React Native's Linking the selector uses. */
export interface SpikeLinking {
  addEventListener(
    event: "url",
    listener: (event: { url: string }) => void,
  ): { remove(): void };
  getInitialURL(): Promise<string | null>;
}

export interface OrrerySpikeSelector {
  /** Subscribes once (url events + the launch URL). */
  listen(): void;
  /** The current URL-selected override (a copy). */
  current(): OrreryHostOverride;
  /** Applies one URL; returns whether it was accepted. */
  accept(url: unknown, source: string): boolean;
  /** Logs the effective host of a canvas mount. */
  report(host: OrreryRenderHost, source: string): void;
  stop(): void;
}

/**
 * The selector, with its seams injected (node-testable). `resolveDefaults`
 * gives the host a URL selection is logged against.
 */
export function createOrrerySpikeSelector(deps: {
  linking: () => SpikeLinking;
  log: (line: string) => void;
  resolveDefaults: () => OrreryRenderHost;
  describe: (host: OrreryRenderHost) => string;
}): OrrerySpikeSelector {
  let override: OrreryHostOverride = {};
  let subscription: { remove(): void } | null = null;
  let receivedUrl = false;
  const selector: OrrerySpikeSelector = {
    listen() {
      if (subscription) return;
      const linking = deps.linking();
      subscription = linking.addEventListener("url", ({ url }) => {
        if (SPIKE_URL.test(url)) receivedUrl = true;
        selector.accept(url, "url");
      });
      void linking
        .getInitialURL()
        .then((url) => {
          if (!receivedUrl && url !== null) selector.accept(url, "launch");
        })
        .catch(() => {});
    },
    current: () => ({ ...override }),
    accept(url, source) {
      if (typeof url !== "string" || !SPIKE_URL.test(url)) return false;
      const parsed = parseOrrerySpikeUrl(url);
      if (!parsed.ok) {
        deps.log(`orrery-spike rejected reason=${parsed.reason}`);
        return false;
      }
      override = parsed.override;
      const host = { ...deps.resolveDefaults(), ...override };
      deps.log(`orrery-spike host=${deps.describe(host)} source=${source}`);
      return true;
    },
    report(host, source) {
      deps.log(`orrery-spike host=${deps.describe(host)} source=${source}`);
    },
    stop() {
      subscription?.remove();
      subscription = null;
    },
  };
  return selector;
}

type RenderHostModule = typeof import("./render-host");
let shared: OrrerySpikeSelector | null = null;
function sharedSelector(): OrrerySpikeSelector {
  // Lazy requires: render-host requires THIS module while it loads, so a
  // static import back would be a cycle; react-native stays out of node tests.
  const renderHost = () => require("./render-host") as RenderHostModule;
  if (!shared)
    shared = createOrrerySpikeSelector({
      linking: () => require("react-native").Linking as SpikeLinking,
      log: (line) => console.log(line),
      resolveDefaults: () => renderHost().defaultOrreryRenderHost(),
      describe: (host) => renderHost().describeOrreryHost(host),
    });
  return shared;
}

/** render-host seam: subscribe to spike URLs (once). */
export function ensureOrrerySpikeListening(): void {
  sharedSelector().listen();
}
/** render-host seam: the URL-selected override. */
export function orrerySpikeOverride(): OrreryHostOverride {
  return sharedSelector().current();
}
/** render-host seam: log the effective host of a canvas mount. */
export function reportOrrerySpikeHost(
  host: OrreryRenderHost,
  source: string,
): void {
  sharedSelector().report(host, source);
}
