/**
 * ORRERY LAB B — R1 per-worklet timing probe (debug flag `perfProbe`).
 *
 * Measures the UI-thread JS time of the per-frame worklets (the model half's
 * frame projection + label allocation, and the lab layer pictures). It cannot
 * see Skia replay / GPU time — pair it with `dumpsys gfxinfo` (RenderThread)
 * and, on the phone, Perfetto (research/PHONE-PASS-SCRIPT.md).
 *
 * State lives on the UI runtime's `globalThis` (no SharedValue, no React):
 * `probeStart()` returns -1 while the probe is off, so an off probe costs one
 * global read per worklet run. Every `REPORT_MS` the accumulated stats are
 * logged in ONE line (`[labb-probe] name=n/mean/p95/max …` in ms; n = runs in
 * the window) and reset. The switch is flipped from React with
 * `setLabProbeEnabled` (runs on the UI thread).
 *
 * Hermes rule: helpers are declared ABOVE their worklet callers.
 */

/** Report window (ms). */
const REPORT_MS = 3000;
/** Samples kept per name per window for the p95 (ring buffer cap). */
const MAX_SAMPLES = 400;

interface ProbeStat {
  n: number;
  sum: number;
  max: number;
  samples: number[];
}

interface ProbeState {
  on: boolean;
  t: number;
  stats: Record<string, ProbeStat>;
}

function probeState(): ProbeState {
  "worklet";
  const g = globalThis as unknown as { __labbProbe?: ProbeState };
  if (!g.__labbProbe) g.__labbProbe = { on: false, t: 0, stats: {} };
  return g.__labbProbe;
}

function probeNow(): number {
  "worklet";
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/** Round to 0.1 ms for the log line. */
function r1(v: number): number {
  "worklet";
  return Math.round(v * 10) / 10;
}

/** One summary line for the window, then reset. */
function probeReport(st: ProbeState, now: number): void {
  "worklet";
  const parts: string[] = [];
  const names = Object.keys(st.stats).sort();
  for (let i = 0; i < names.length; i++) {
    const s = st.stats[names[i]];
    const sorted = s.samples.slice().sort((a, b) => a - b);
    const p95 = sorted.length
      ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
      : 0;
    parts.push(
      `${names[i]}=${s.n}/${r1(s.sum / Math.max(1, s.n))}/${r1(p95)}/${r1(s.max)}`,
    );
  }
  if (parts.length > 0)
    console.log(
      `[labb-probe] win=${Math.round(now - st.t)}ms ${parts.join(" ")}`,
    );
  st.stats = {};
  st.t = now;
}

/** Start a timed section: a timestamp, or -1 while the probe is off. */
export function probeStart(): number {
  "worklet";
  return probeState().on ? probeNow() : -1;
}

/** End a timed section started by `probeStart` (no-op when it returned -1). */
export function probeEnd(name: string, t0: number): void {
  "worklet";
  if (t0 < 0) return;
  const st = probeState();
  if (!st.on) return;
  const now = probeNow();
  const dt = now - t0;
  let s = st.stats[name];
  if (!s) {
    s = { n: 0, sum: 0, max: 0, samples: [] };
    st.stats[name] = s;
  }
  s.n += 1;
  s.sum += dt;
  if (dt > s.max) s.max = dt;
  if (s.samples.length < MAX_SAMPLES) s.samples.push(dt);
  if (st.t === 0) st.t = now;
  else if (now - st.t >= REPORT_MS) probeReport(st, now);
}

/** UI-thread switch (call through `runOnUI`). */
export function setLabProbeEnabled(on: boolean): void {
  "worklet";
  const st = probeState();
  if (st.on === on) return;
  st.on = on;
  st.stats = {};
  st.t = 0;
}
