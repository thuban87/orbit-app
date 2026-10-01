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
    note: "WP-1.3 fills",
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
    note: "WP-1.3 fills",
  },
  {
    id: "fx",
    label: "L7 Focus / feedback / switch FX",
    section: "layers",
    default: true,
    heavy: true,
    note: "WP-2.x fills",
  },
  // Debug instrumentation (research 03 §4).
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
