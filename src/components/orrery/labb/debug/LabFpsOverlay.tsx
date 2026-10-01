/**
 * ORRERY LAB B — frame-time HUD (research 03 §4).
 *
 * Derived from the lab canvas's single clock — no extra loop, no
 * `useFrameCallback`, no React state. A reaction over `clock.value` records the
 * delta between consecutive clock ticks into a fixed 120-slot ring buffer held
 * in a SharedValue; every `SUMMARY_EVERY` frames it publishes a summary (mean
 * fps, p50/p95/max, frames over 16.7 / 33.3 ms) drawn as Skia glyph text plus a
 * sparkline.
 *
 * HONEST LABEL: this is the UI-thread frame CADENCE (clock deltas). It cannot
 * see GPU or RenderThread time; pair it with
 * `adb shell dumpsys gfxinfo com.bwales.orbit.labb framestats`. Emulator numbers
 * are not phone performance.
 *
 * Mounted only while the `fpsHud` flag is on; it lives inside the canvas
 * subtree, so it unmounts (and stops) with everything else.
 */
import {
  Group,
  Line,
  matchFont,
  Path,
  RoundedRect,
  Skia,
  type SkTypefaceFontProvider,
  Text,
  vec,
} from "@shopify/react-native-skia";
import { useMemo } from "react";
import {
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import { type LabFxProfile, labColor } from "@/theme/orrery-lab-fx";
import type { ThemePalette } from "@/theme/theme-types";
import { useLabRenderContext } from "../labb-context";

// --- Tunables -----------------------------------------------------------------
const SLOTS = 120;
const SUMMARY_EVERY = 8;
const HUD_W = 236;
const HUD_H = 78;
const PAD = 6;
const GRAPH_H = 28;
/** Graph y-axis ceiling (ms). */
const GRAPH_MAX_MS = 50;
const BUDGET_60 = 1000 / 60;
const BUDGET_30 = 1000 / 30;
const FONT_SIZE = 10;
/** Ignore pauses longer than this (clock gaps, e.g. a GC or debugger stop). */
const MAX_SAMPLE_MS = 1000;

interface HudStats {
  buf: number[];
  i: number;
  n: number;
  last: number;
  frames: number;
}

interface HudSummary {
  line1: string;
  line2: string;
  graph: number[];
}

/** Summarise the ring buffer (oldest → newest) into text + graph samples. */
export function summarizeFrameDeltas(stats: HudStats): HudSummary {
  "worklet";
  const n = Math.min(stats.n, SLOTS);
  const ordered: number[] = [];
  for (let k = 0; k < n; k++) {
    const idx = (stats.i - n + k + SLOTS) % SLOTS;
    ordered.push(stats.buf[idx]);
  }
  if (n === 0) return { line1: "collecting…", line2: "", graph: [] };
  const sorted = ordered.slice().sort((a, b) => a - b);
  let sum = 0;
  let over60 = 0;
  let over30 = 0;
  for (let k = 0; k < n; k++) {
    sum += ordered[k];
    if (ordered[k] > BUDGET_60 + 0.5) over60++;
    if (ordered[k] > BUDGET_30 + 0.5) over30++;
  }
  const mean = sum / n;
  const p50 = sorted[Math.floor((n - 1) * 0.5)];
  const p95 = sorted[Math.floor((n - 1) * 0.95)];
  const max = sorted[n - 1];
  return {
    line1: `${(1000 / mean).toFixed(1)} fps  p50 ${p50.toFixed(1)}  p95 ${p95.toFixed(1)}  max ${max.toFixed(0)} ms`,
    line2: `>16.7ms ${over60}  >33ms ${over30}  of ${n}  (UI-thread clock Δ)`,
    graph: ordered,
  };
}

export function LabFpsOverlay({
  x,
  y,
  colors,
  profile,
  fontProvider,
}: {
  x: number;
  y: number;
  colors: ThemePalette;
  profile: LabFxProfile;
  fontProvider: SkTypefaceFontProvider | null;
}) {
  const ctx = useLabRenderContext();
  const stats = useSharedValue<HudStats>({
    buf: new Array(SLOTS).fill(0),
    i: 0,
    n: 0,
    last: -1,
    frames: 0,
  });
  const summary = useSharedValue<HudSummary>({
    line1: "collecting…",
    line2: "",
    graph: [],
  });
  useAnimatedReaction(
    () => (ctx ? ctx.clock.value : -1),
    (t) => {
      if (t < 0) return;
      const s = stats.value;
      const dt = s.last < 0 ? 0 : t - s.last;
      if (s.last < 0 || dt <= 0 || dt > MAX_SAMPLE_MS) {
        stats.value = { ...s, last: t };
        return;
      }
      const buf = s.buf.slice();
      buf[s.i] = dt;
      const next = {
        buf,
        i: (s.i + 1) % SLOTS,
        n: Math.min(SLOTS, s.n + 1),
        last: t,
        frames: s.frames + 1,
      };
      stats.value = next;
      if (next.frames % SUMMARY_EVERY === 0)
        summary.value = summarizeFrameDeltas(next);
    },
  );
  const graphW = HUD_W - PAD * 2;
  const graphTop = y + HUD_H - PAD - GRAPH_H;
  const yFor = (ms: number) =>
    graphTop + GRAPH_H - (Math.min(ms, GRAPH_MAX_MS) / GRAPH_MAX_MS) * GRAPH_H;
  const path = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const g = summary.value.graph;
    for (let k = 0; k < g.length; k++) {
      const px = x + PAD + (k / (SLOTS - 1)) * graphW;
      const py =
        graphTop +
        GRAPH_H -
        (Math.min(g[k], GRAPH_MAX_MS) / GRAPH_MAX_MS) * GRAPH_H;
      if (k === 0) p.moveTo(px, py);
      else p.lineTo(px, py);
    }
    return p;
  });
  const line1 = useDerivedValue(() => summary.value.line1);
  const line2 = useDerivedValue(() => summary.value.line2);
  const font = useMemo(() => {
    if (!fontProvider) return null;
    try {
      return matchFont(
        { fontFamily: "Inter", fontSize: FONT_SIZE },
        fontProvider,
      );
    } catch {
      return null;
    }
  }, [fontProvider]);
  const hud = profile.hud;
  const text = labColor(colors, hud.text);
  return (
    <Group>
      <RoundedRect
        x={x}
        y={y}
        width={HUD_W}
        height={HUD_H}
        r={6}
        color={labColor(colors, hud.plate)}
        opacity={hud.plateOpacity}
      />
      {font ? (
        <>
          <Text
            font={font}
            x={x + PAD}
            y={y + PAD + FONT_SIZE}
            text="LAB B · UI-thread frame cadence"
            color={text}
          />
          <Text
            font={font}
            x={x + PAD}
            y={y + PAD + FONT_SIZE * 2.3}
            text={line1}
            color={text}
          />
          <Text
            font={font}
            x={x + PAD}
            y={y + PAD + FONT_SIZE * 3.6}
            text={line2}
            color={text}
          />
        </>
      ) : null}
      <Line
        p1={vec(x + PAD, yFor(BUDGET_60))}
        p2={vec(x + PAD + graphW, yFor(BUDGET_60))}
        color={labColor(colors, hud.warn)}
        strokeWidth={1}
        opacity={0.7}
      />
      <Line
        p1={vec(x + PAD, yFor(BUDGET_30))}
        p2={vec(x + PAD + graphW, yFor(BUDGET_30))}
        color={labColor(colors, hud.bad)}
        strokeWidth={1}
        opacity={0.7}
      />
      <Path
        path={path}
        style="stroke"
        strokeWidth={1.25}
        color={labColor(colors, hud.graph)}
      />
    </Group>
  );
}
