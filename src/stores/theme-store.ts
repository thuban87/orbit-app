import { create } from "zustand";
import type { AccentId, BackgroundSlotId } from "@/theme/theme-option-ids";
import { DEFAULT_PRESET_ID } from "@/theme/theme-presets";
import type {
  ThemeMode,
  ThemePackage,
  ThemeSelection,
} from "@/theme/theme-types";

/**
 * Theme-selection store (FND-05 → THEME-01/03/13, Phase 23).
 *
 * The source of truth is now the `app_settings` selection HYDRATED at boot (via
 * `hydrateThemeAtBoot`), NOT an AsyncStorage persist — the durable columns are
 * migration 015's, and the old `orbit-theme` AsyncStorage key is imported once
 * then cleared (D-08). This store holds ONLY the selection (package + per-package
 * mode/accent/background); the resolved palette is derived in `ThemeProvider`,
 * never stored. `ThemeProvider` re-renders from this state, so a live change
 * (Settings, later plans) restyles the whole app — the live-preview plumbing is
 * established here; accent/background DATA lands in Plans 03/06.
 *
 * NO AsyncStorage, NO zustand `persist`: adding any new theme preference to
 * AsyncStorage is prohibited (D-08/D-09). Persistence is a DB write through the
 * DAO; this store is the in-memory selection the provider subscribes to.
 */
interface ThemeStore extends ThemeSelection {
  /** Replace the whole selection from the boot-hydrated `app_settings` read. */
  hydrate: (selection: ThemeSelection) => void;
  /** Switch the active package (restores that package's remembered mode). */
  setPackage: (themePackage: ThemePackage) => void;
  /** Set the appearance mode for the CURRENTLY-ACTIVE package. */
  setModeForActivePackage: (mode: ThemeMode) => void;
  /** Set the accent for the CURRENTLY-ACTIVE package (null = package default). */
  setAccentForActivePackage: (accent: AccentId | null) => void;
}

export const useThemeStore = create<ThemeStore>()((set) => ({
  // Pre-hydrate defaults mirror migration 015's seeded defaults, so the pre-ready
  // splash paints the neutral package default (never a WRONG saved palette).
  package: DEFAULT_PRESET_ID,
  galaxyMode: "system",
  standardMode: "system",
  galaxyAccent: null,
  standardAccent: null,
  galaxyBackground: null,
  standardBackground: null,
  hydrate: (selection) => set(selection),
  setPackage: (themePackage) => set({ package: themePackage }),
  setModeForActivePackage: (mode) =>
    set((state) =>
      state.package === "galaxy"
        ? { galaxyMode: mode }
        : { standardMode: mode },
    ),
  setAccentForActivePackage: (accent) =>
    set((state) =>
      state.package === "galaxy"
        ? { galaxyAccent: accent }
        : { standardAccent: accent },
    ),
}));

/**
 * Project an `app_settings` read (the boot-hydrated shape) into the store's
 * `ThemeSelection`. Pure and node-testable; the boot coordinator returns the
 * post-import `AppSettings` and `App.tsx` maps it through here before flipping
 * `ready`, so the store never hydrates pre-import values.
 */
export function themeSelectionFromSettings(settings: {
  themePackage: ThemePackage;
  galaxyMode: ThemeMode;
  standardMode: ThemeMode;
  galaxyAccent: AccentId | null;
  standardAccent: AccentId | null;
  galaxyBackground: BackgroundSlotId | null;
  standardBackground: BackgroundSlotId | null;
}): ThemeSelection {
  return {
    package: settings.themePackage,
    galaxyMode: settings.galaxyMode,
    standardMode: settings.standardMode,
    galaxyAccent: settings.galaxyAccent,
    standardAccent: settings.standardAccent,
    galaxyBackground: settings.galaxyBackground,
    standardBackground: settings.standardBackground,
  };
}
