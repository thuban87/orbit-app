/**
 * ORRERY LAB B — effect toggle store (experiment/orrery-skia-unleashed).
 *
 * Session-only, never persisted. Drives the lab renderer A/B switch, the
 * per-layer toggles, the global intensity and the debug instrumentation. The
 * React side reads it through `useLabFxStore`; the renderer mirrors a plain
 * snapshot (`labFxSnapshot`) into ONE SharedValue for worklets.
 *
 * Extending (WP-1.1+): add an id to `LAB_FLAG_REGISTRY` (section + default +
 * `heavy` when the layer must be UNMOUNTED while off). The panel renders the
 * registry generically, so a new effect needs no panel code.
 *
 * Import-safe in node tests: plain zustand, no react-native / reanimated.
 */
import { create } from "zustand";
import { setReducedMotionOverride } from "@/theme/reduced-motion-override";

export type LabRenderer = "legacy" | "lab";
export type LabReducedMotionMode = "os" | "on" | "off";

export interface LabFlagSpec {
  id: string;
  label: string;
  section: "layers" | "debug" | "effects";
  default: boolean;
  /** Heavy layers are unmounted (not just hidden) while off. */
  heavy?: boolean;
  /** Short note shown in the panel (e.g. which WP fills the slot). */
  note?: string;
}

/** Every lab toggle. Ids are stable strings; worklets read `flags[id]`. */
export const LAB_FLAG_REGISTRY = [
  // L0..L7 layer slots of the lab renderer (research 03 §1.3 / §2.2).
  {
    id: "environment",
    label: "L0 Environment (sky, nebula, stars)",
    section: "layers",
    default: true,
    heavy: true,
  },
  // L0 environment effects (WP-1.1).
  {
    id: "nebula",
    label: "L0 Nebula (baked fbm, warp-sampled)",
    section: "effects",
    default: true,
    heavy: true,
  },
  {
    id: "nebulaLive",
    label: "L0 Nebula LIVE full-res fbm (A/B cost)",
    section: "effects",
    default: false,
    heavy: true,
    note: "replaces the baked sample while on",
  },
  {
    id: "nebulaDrift",
    label: "L0 Nebula drift + breathing",
    section: "effects",
    default: true,
  },
  {
    id: "vignette",
    label: "L0 Vignette",
    section: "effects",
    default: true,
  },
  {
    id: "stars",
    label: "L0 Starfield (3-depth Atlas)",
    section: "effects",
    default: true,
    heavy: true,
  },
  {
    id: "twinkle",
    label: "L0 Star twinkle",
    section: "effects",
    default: true,
  },
  {
    id: "parallax",
    label: "L0 Sky parallax (frame.value.pose)",
    section: "effects",
    default: true,
  },
  {
    id: "rings",
    label: "L1 Orbit rings",
    section: "layers",
    default: true,
    heavy: true,
    note: "WP-1.3 instrument orbits",
  },
  // L1 instrument orbits (WP-1.3).
  {
    id: "ringShader",
    label: "L1 Ring stroke shader (depth fade, dashes, flow)",
    section: "effects",
    default: true,
    heavy: true,
    note: "off = flat hairlines + CPU dash fallback",
  },
  {
    id: "ringFlow",
    label: "L1 Ring energy flow (uniform comets; owner glance C-04)",
    section: "effects",
    default: true,
  },
  {
    id: "ringWake",
    label: "L1 Progress wake arcs (owner glance C-17)",
    section: "effects",
    default: true,
    heavy: true,
  },
  {
    id: "ringTethers",
    label: "L1 Drift tethers, decay/rogue (owner glance C-17)",
    section: "effects",
    default: true,
    heavy: true,
  },
  {
    id: "ringTicks",
    label: "L1 Instrument ticks (detail north ticks, focus scale, compass)",
    section: "effects",
    default: true,
    heavy: true,
  },
  {
    id: "ringsPathRebuild",
    label: "L1 A/B: WP-1.0 rings (128-pt Path rebuilt per ring)",
    section: "effects",
    default: false,
    heavy: true,
    note: "replaces the instrument orbits while on",
  },
  {
    id: "polaris",
    label: "L5 Polaris",
    section: "layers",
    default: true,
    heavy: true,
  },
  {
    id: "bodies",
    label: "L2-L4 Sun, bodies, moons",
    section: "layers",
    default: true,
    heavy: true,
    note: "WP-1.2 fills",
  },
  { id: "sunPulse", label: "L2 Sun pulse", section: "layers", default: true },
  // L2–L5 worlds (WP-1.2).
  {
    id: "bodyLighting",
    label: "L2-L4 Lit surfaces (body/sun/moon shaders)",
    section: "effects",
    default: true,
    heavy: true,
    note: "off = WP-1.0 flat discs",
  },
  {
    id: "bodyAtmosphere",
    label: "L3 Status atmosphere / light-theme shadow",
    section: "effects",
    default: true,
  },
  {
    id: "bodyProcedural",
    label: "L3 Procedural surface (initials bodies)",
    section: "effects",
    default: true,
  },
  {
    id: "depthHaze",
    label: "L3 Far-side depth haze",
    section: "effects",
    default: true,
  },
  {
    id: "sunCorona",
    label: "L2 Sun corona (rays + limb)",
    section: "effects",
    default: true,
  },
  {
    id: "sunPlasma",
    label: "L2 Self-sun stellar surface (no photo)",
    section: "effects",
    default: true,
  },
  {
    id: "moonShader",
    label: "L4 Moon runtime shader (off = cheap 3-circle lit moon)",
    section: "effects",
    default: false,
    heavy: true,
  },
  {
    id: "polarisLab",
    label: "L5 Lab Polaris (glow + spikes)",
    section: "effects",
    default: true,
    heavy: true,
  },
  {
    id: "labels",
    label: "L6 Labels",
    section: "layers",
    default: true,
    heavy: true,
  },
  {
    id: "labelHud",
    label: "L6 HUD-tag labels (off = legacy plates)",
    section: "effects",
    default: true,
    heavy: true,
  },
  {
    id: "fx",
    label: "L7 Focus / feedback / switch FX",
    section: "layers",
    default: true,
    heavy: true,
    note: "master for WP-2.1 switch FX and WP-2.2 focus / feedback",
  },
  // WP-2.1 System-switch showcase (L0/L1/L2/L7; master = `fx`).
  {
    id: "fxStreaks",
    label: "SW Hyperspace star streaks + sky push",
    section: "effects",
    default: true,
  },
  {
    id: "fxParticles",
    label: "SW Departing particle bursts (Atlas)",
    section: "effects",
    default: true,
    heavy: true,
  },
  {
    id: "fxDissolve",
    label: "SW Departing body dissolve (body shader)",
    section: "effects",
    default: true,
  },
  {
    id: "fxRingTrim",
    label: "SW Ring unwind / draw-on",
    section: "effects",
    default: true,
    heavy: true,
  },
  {
    id: "fxComets",
    label: "SW Arrival comets + retained motion smears",
    section: "effects",
    default: true,
    heavy: true,
  },
  {
    id: "fxFlares",
    label: "SW Capture flares",
    section: "effects",
    default: true,
    heavy: true,
  },
  {
    id: "fxShockwave",
    label: "SW System-lock shockwave (projected ring)",
    section: "effects",
    default: true,
    heavy: true,
  },
  {
    id: "fxSpool",
    label: "SW Corona flare + ring-flow spool-up",
    section: "effects",
    default: true,
  },
  {
    id: "fxSkyHue",
    label: "SW Per-System sky hue (owner glance C-05)",
    section: "effects",
    default: true,
  },
  {
    id: "fxShockFilter",
    label: "SW EXPERIMENT displacement shockwave image filter",
    section: "effects",
    default: false,
    heavy: true,
    note: "wraps the world layer in a saveLayer + runtime filter",
  },
  // WP-2.2 focus state + interaction feedback (L7; master = `fx`).
  {
    id: "fxFocus",
    label: "FO Target-lock reticle (replaces the accent focus ring)",
    section: "effects",
    default: true,
  },
  {
    id: "fxFocusDim",
    label: "FO World response (defocus others, focused atmosphere, vignette)",
    section: "effects",
    default: true,
  },
  {
    id: "fxFeedback",
    label: "FB Tap pings / empty-space ripples / Polaris flare",
    section: "effects",
    default: true,
  },
  {
    id: "fxReorder",
    label:
      "FB Reorder hold charge, held-ring glow, slot flash (replaces ghost)",
    section: "effects",
    default: true,
  },
  {
    id: "focusCardAnchor",
    label: "FO Focus card keeps clear of the locked body + its label",
    section: "effects",
    default: true,
  },
  {
    id: "hudChrome",
    label: "HUD Instrument chrome (selector, view options, controls, card)",
    section: "effects",
    default: true,
  },
  {
    id: "stdChart",
    label: "STD Standard package chart graticule + quiet sky profile",
    section: "effects",
    default: true,
    heavy: true,
  },
  // Debug instrumentation (research 03 §4).
  {
    id: "layerPictures",
    label: "Bodies + labels as ONE picture per layer (switch-stall fix)",
    section: "debug",
    default: true,
    heavy: true,
    note: "off = one component per body / label (A/B baseline)",
  },
  {
    id: "fpsHud",
    label: "FPS / frame-time HUD",
    section: "debug",
    default: true,
    heavy: true,
  },
  {
    id: "forceFallback",
    label: "Force effect fallback (all shaders null)",
    section: "debug",
    default: false,
  },
  {
    id: "freezeClock",
    label: "Freeze ambient clock (t = 0)",
    section: "debug",
    default: false,
  },
  {
    id: "warmup",
    label: "Shader warm-up at mount",
    section: "debug",
    default: true,
  },
] as const satisfies readonly LabFlagSpec[];

export type LabFlagId = (typeof LAB_FLAG_REGISTRY)[number]["id"];
export type LabFlags = Record<LabFlagId, boolean>;

export function defaultLabFlags(): LabFlags {
  return Object.fromEntries(
    LAB_FLAG_REGISTRY.map((flag) => [flag.id, flag.default]),
  ) as LabFlags;
}

/** The plain snapshot mirrored into the renderer's `fxFlags` SharedValue. */
export interface LabFxSnapshot {
  renderer: LabRenderer;
  flags: LabFlags;
  intensity: number;
}

interface LabFxState extends LabFxSnapshot {
  reducedMotion: LabReducedMotionMode;
  /** WP-2.1 debug: System-switch duration multiplier (1 = production). */
  switchTimeScale: number;
  setSwitchTimeScale: (value: number) => void;
  setRenderer: (renderer: LabRenderer) => void;
  toggleFlag: (id: LabFlagId) => void;
  setFlag: (id: LabFlagId, value: boolean) => void;
  setIntensity: (value: number) => void;
  setReducedMotion: (mode: LabReducedMotionMode) => void;
  reset: () => void;
}

export const LAB_INTENSITY_MIN = 0;
export const LAB_INTENSITY_MAX = 2;
/** Default renderer: the lab one (the legacy tree stays one tap away for A/B). */
export const LAB_DEFAULT_RENDERER: LabRenderer = "lab";

export const useLabFxStore = create<LabFxState>((set) => ({
  renderer: LAB_DEFAULT_RENDERER,
  flags: defaultLabFlags(),
  intensity: 1,
  reducedMotion: "os",
  switchTimeScale: 1,
  setSwitchTimeScale: (value) =>
    set({ switchTimeScale: Math.min(20, Math.max(0.25, value)) }),
  setRenderer: (renderer) => set({ renderer }),
  toggleFlag: (id) =>
    set((state) => ({ flags: { ...state.flags, [id]: !state.flags[id] } })),
  setFlag: (id, value) =>
    set((state) => ({ flags: { ...state.flags, [id]: value } })),
  setIntensity: (value) =>
    set({
      intensity: Math.min(
        LAB_INTENSITY_MAX,
        Math.max(LAB_INTENSITY_MIN, Math.round(value * 100) / 100),
      ),
    }),
  setReducedMotion: (mode) => {
    setReducedMotionOverride(mode === "os" ? null : mode === "on");
    set({ reducedMotion: mode });
  },
  reset: () => {
    setReducedMotionOverride(null);
    set({
      renderer: LAB_DEFAULT_RENDERER,
      flags: defaultLabFlags(),
      intensity: 1,
      reducedMotion: "os",
      switchTimeScale: 1,
    });
  },
}));

export function labFxSnapshot(state: LabFxSnapshot): LabFxSnapshot {
  return {
    renderer: state.renderer,
    flags: { ...state.flags },
    intensity: state.intensity,
  };
}
