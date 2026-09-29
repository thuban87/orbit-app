/**
 * Background slot manifest + resolver (THEME-04 / D-04 / dossier §E).
 *
 * Each package ships ~4 curated bundled backgrounds PLUS a shared None/Solid slot,
 * all LOCAL `require()` assets — no network/CDN/downloadable path (D-04, dossier §E
 * deferred list). A `BackgroundHost` renders the active package's selected
 * background fixed behind scrolling content (D-04 supersedes HANDOFF §7's
 * dashboard/orrery-only scope; ADR-048 tap-to-freeze / creeping motion stays
 * superseded — NOT reinstated).
 *
 * SINGLE canonical slot-id source (REVIEWS 23-01 cycle-4 MEDIUM): the accepted slot
 * ids are IMPORTED from Plan 01's `theme-option-ids.ts` (`BACKGROUND_SLOT_IDS`) —
 * the SAME array the DAO validator (`assertBackgroundId`) consumes. This module keys
 * its manifest by exactly those ids and declares NO parallel list; `backgrounds.test`
 * asserts the manifest's declared slot-id set equals `BACKGROUND_SLOT_IDS` exactly,
 * so the DAO's accepted-id set and this resolver's known-id set cannot drift.
 *
 * Node-testability idiom (mirrors `fonts.ts`): the asset `require()` lives INSIDE a
 * per-slot thunk (`source: () => require(...)`), NEVER at module scope — so importing
 * this module in the node/vitest harness never evaluates a `.webp` require. The
 * resolvers return the thunk (uncalled); only `BackgroundHost` invokes it on device.
 *
 * SLOT x MODE VARIANTS (38.5 D-23 / D-03): a slot is a PAIR of variants, one per
 * resolved appearance mode (`variants.light`, `variants.dark`). The stored value in
 * `app_settings.galaxy_background` / `standard_background` stays the SLOT id — one
 * pick per package that follows the mode, with no new setting and no migration —
 * and the resolvers take the resolved mode and return that mode's variant. Both
 * packages keep both modes (D-03). Until the owner-approved art lands (38.5-05),
 * both variants of every slot point at the same file with the same declared
 * extrema, so this model changes no rendered pixel (D-13).
 *
 * DECLARED-VS-DECODED (REVIEWS 23-06 cycle-4 MEDIUM; RG-029 / D-12): each variant
 * carries a declared worst-case `brightestPixel` AND `darkestPixel` — design
 * CONSTRAINTS the shipped `.webp` must stay within, used by the surface.test
 * both-extrema composited-AA proof. Nothing here decodes the committed bytes; the
 * committed `scripts/measure-background-extrema.py` does (Pillow): it composites
 * every decoded pixel of each variant under every card/chrome tint regime of the
 * slot's package AND that variant's mode, and `--check` fails if either declared bound does not enclose that regime's
 * decoded COMPOSITE extremum. Run it whenever an asset is added or changed
 * (docs/runbooks/theme-visual-system-maintenance.md).
 */

import { BACKGROUND_SLOT_IDS, type BackgroundSlotId } from "./theme-option-ids";
import type { ResolvedMode, ThemePackage } from "./theme-types";

/** The shared None/Solid slot id — resolves to the solid theme background. */
export const NONE_SLOT_ID = "none" as const;

/**
 * One mode's version of a bundled background (38.5 D-23). `source` is a LAZY require
 * thunk (device-only); the two pixels are that file's declared composited-AA bounds.
 */
export interface BackgroundVariant {
  /** Lazy `require()` of the bundled local asset — never evaluated in node tests. */
  source: () => number;
  /**
   * Declared worst-case (brightest representative) `#RRGGBB` pixel — the composited-
   * AA design bound the shipped asset must not exceed (cycle-3 MEDIUM). For the
   * placeholder uniform-fill assets this equals the fill colour (README rows).
   */
  brightestPixel: string;
  /**
   * Declared worst-case (darkest representative) `#RRGGBB` pixel — the dark-end
   * composited-AA design bound the shipped asset must not undercut (RG-029 /
   * ui-accessibility/AUD-UIA-001 / D-12). Dark text is limited by the DARKEST
   * composite, so the proof composites every tint over BOTH this pixel and
   * `brightestPixel`. Reported by `scripts/measure-background-extrema.py` as the
   * channel-wise MIN of the raw-darkest pixel and every regime's composite-argmin
   * pixel; `--check` fails if the decoded asset undercuts it.
   */
  darkestPixel: string;
  /**
   * D-20 small-feature allowance, owner-signed at the 38.5 art sign-off (D-20);
   * declared extrema are the text-bearing bound after the allowance. Absent =
   * no allowance: every decoded pixel must lie inside the declared extrema.
   *
   * The allowance applies to the UNION, per variant (M-4):
   * `scripts/measure-background-extrema.py --check` unions every regime's
   * out-of-bound mask (card, chrome, the BackgroundHost veil at every density)
   * and `scripts/check-background-art.py` unions every foreground token's
   * failure mask (every accent); a pixel in several masks counts once, and
   * disjoint masks that each fit alone can fail together. The variant passes
   * only when every 8-connected component of the union is <= `maxComponentPx`
   * pixels and the union covers <= `maxFailingPct` percent of the canvas.
   * `backgrounds.ts` is parsed by `scripts/background_manifest.py`: keep this
   * field inside its variant block at 8-space indent.
   */
  featureAllowance?: {
    maxComponentPx: number;
    maxFailingPct: number;
    acceptedAt: string;
  };
}

/**
 * One bundled background slot: its owning package and one variant per resolved
 * appearance mode (38.5 D-23). The stored selection is the slot id; the mode picks
 * the variant at render.
 */
export interface BackgroundAssetSlot {
  /** The owning package (drives the per-package default + picker order). */
  package: ThemePackage;
  /** The file rendered in each resolved mode. Both are always present. */
  variants: Record<ResolvedMode, BackgroundVariant>;
}

/**
 * The per-package asset slot manifest, keyed by the imported slot ids (NOT a
 * re-declared list). `none` is intentionally ABSENT (it is the shared solid slot,
 * not an asset). Every key here is a member of `BACKGROUND_SLOT_IDS`; the drift
 * test asserts the union with `none` equals that single source exactly.
 */
export const BACKGROUND_SLOTS: Record<
  Exclude<BackgroundSlotId, typeof NONE_SLOT_ID>,
  BackgroundAssetSlot
> = {
  "galaxy-quiet": {
    package: "galaxy",
    variants: {
      light: {
        source: () =>
          require("../../assets/backgrounds/galaxy-quiet-light.webp"),
        brightestPixel: "#F8F6FF",
        darkestPixel: "#E5DDF9",
      },
      dark: {
        source: () =>
          require("../../assets/backgrounds/galaxy-quiet-dark.webp"),
        brightestPixel: "#1B2149",
        darkestPixel: "#000000",
      },
    },
  },
  "galaxy-aurora": {
    package: "galaxy",
    variants: {
      light: {
        source: () =>
          require("../../assets/backgrounds/galaxy-aurora-light.webp"),
        brightestPixel: "#F6F8F9",
        darkestPixel: "#CEE5E4",
      },
      dark: {
        source: () =>
          require("../../assets/backgrounds/galaxy-aurora-dark.webp"),
        brightestPixel: "#113032",
        darkestPixel: "#000000",
      },
    },
  },
  "galaxy-starfield": {
    package: "galaxy",
    variants: {
      light: {
        source: () =>
          require("../../assets/backgrounds/galaxy-starfield-light.webp"),
        brightestPixel: "#FFFFFF",
        darkestPixel: "#CED9DC",
        featureAllowance: {
          maxComponentPx: 18,
          maxFailingPct: 0.5,
          acceptedAt: "2026-09-28",
        },
      },
      dark: {
        source: () =>
          require("../../assets/backgrounds/galaxy-starfield-dark.webp"),
        // Text-bearing bound after the owner-signed allowance (D-20 / D-31). The
        // checker's channel-wise textBearingBound (#2C2868, L=0.0305) is a
        // synthetic colour brighter than any real text-bearing pixel; the file has
        // an EMPTY luminance band between its brightest non-star pixel (#222544,
        // L=0.0208) and its dimmest star (L>=0.064). This bound sits in that band
        // (L=0.0228), and `measure-background-extrema.py --check` reproduces the
        // signed union exactly (2,680 px, 0.170%, largest 9 px), so it declares
        // the same pixels text-bearing as #2C2868 does.
        brightestPixel: "#262452",
        darkestPixel: "#000000",
        featureAllowance: {
          maxComponentPx: 18,
          maxFailingPct: 0.5,
          acceptedAt: "2026-09-28",
        },
      },
    },
  },
  "galaxy-deep-space": {
    package: "galaxy",
    variants: {
      light: {
        source: () =>
          require("../../assets/backgrounds/galaxy-deep-space.webp"),
        brightestPixel: "#1A1F35",
        darkestPixel: "#000000",
      },
      dark: {
        source: () =>
          require("../../assets/backgrounds/galaxy-deep-space.webp"),
        brightestPixel: "#1A1F35",
        darkestPixel: "#000000",
      },
    },
  },
  "galaxy-nebula": {
    package: "galaxy",
    variants: {
      light: {
        source: () => require("../../assets/backgrounds/galaxy-nebula.webp"),
        brightestPixel: "#2A2148",
        darkestPixel: "#000003",
      },
      dark: {
        source: () => require("../../assets/backgrounds/galaxy-nebula.webp"),
        brightestPixel: "#2A2148",
        darkestPixel: "#000003",
      },
    },
  },
  "standard-dawn": {
    package: "standard",
    variants: {
      light: {
        source: () =>
          require("../../assets/backgrounds/standard-dawn-light.webp"),
        brightestPixel: "#FFF6E8",
        darkestPixel: "#FDD8C0",
      },
      dark: {
        source: () =>
          require("../../assets/backgrounds/standard-dawn-dark.webp"),
        brightestPixel: "#4D201C",
        darkestPixel: "#2D0711",
      },
    },
  },
  "standard-paper": {
    package: "standard",
    variants: {
      light: {
        source: () =>
          require("../../assets/backgrounds/standard-paper-light.webp"),
        brightestPixel: "#F7F3E9",
        darkestPixel: "#E4E0D7",
      },
      dark: {
        source: () =>
          require("../../assets/backgrounds/standard-paper-dark.webp"),
        brightestPixel: "#302E2C",
        darkestPixel: "#191415",
      },
    },
  },
  "standard-dusk": {
    package: "standard",
    variants: {
      light: {
        source: () =>
          require("../../assets/backgrounds/standard-dusk-light.webp"),
        brightestPixel: "#FEF5EA",
        darkestPixel: "#DEDAFD",
      },
      dark: {
        source: () =>
          require("../../assets/backgrounds/standard-dusk-dark.webp"),
        brightestPixel: "#3D253F",
        darkestPixel: "#24143F",
      },
    },
  },
  "standard-mesh": {
    package: "standard",
    variants: {
      light: {
        source: () => require("../../assets/backgrounds/standard-mesh.webp"),
        brightestPixel: "#B8C4D0",
        darkestPixel: "#3A5068",
      },
      dark: {
        source: () => require("../../assets/backgrounds/standard-mesh.webp"),
        brightestPixel: "#B8C4D0",
        darkestPixel: "#3A5068",
      },
    },
  },
};

/**
 * Each package's stable, ordered slot list for the (future) picker — asset slots
 * first in a FIXED order, then the shared None/Solid slot last. The resolved
 * background is a deterministic function of (package, stored slot-id, resolved
 * mode) independent of selection order (THEME-04 ordering edge).
 */
export const BACKGROUND_ORDER: Record<
  ThemePackage,
  readonly BackgroundSlotId[]
> = {
  galaxy: [
    "galaxy-quiet",
    "galaxy-aurora",
    "galaxy-starfield",
    "galaxy-deep-space",
    "galaxy-nebula",
    NONE_SLOT_ID,
  ],
  standard: [
    "standard-dawn",
    "standard-paper",
    "standard-dusk",
    "standard-mesh",
    NONE_SLOT_ID,
  ],
};

/**
 * Each package's DEFAULT background slot — applied when the stored per-package
 * background is NULL (the accent/self-sun NULL-resolve-at-render idiom). Galaxy
 * defaults to the Deep Space gradient, Standard to the soft Dawn gradient (UI-SPEC).
 */
export const PACKAGE_DEFAULT_SLOT: Record<ThemePackage, BackgroundSlotId> = {
  galaxy: "galaxy-quiet",
  standard: "standard-dawn",
};

/** A resolved renderable background — a bundled asset or the solid theme background. */
export type ResolvedBackground =
  | {
      kind: "asset";
      slotId: BackgroundSlotId;
      /** The resolved appearance mode whose variant this is (38.5 D-23). */
      mode: ResolvedMode;
      /** Lazy require of the bundled asset (device-only; never evaluated in node). */
      source: () => number;
      /** The asset's declared worst-case brightest pixel (composited-AA bound). */
      brightestPixel: string;
      /** The asset's declared worst-case darkest pixel (composited-AA bound, RG-029). */
      darkestPixel: string;
    }
  | { kind: "solid" };

/** Narrow a slot id to a known asset slot (not `none`, not tampered). */
function assetSlot(slotId: BackgroundSlotId): BackgroundAssetSlot | undefined {
  if (slotId === NONE_SLOT_ID) {
    return undefined;
  }
  return BACKGROUND_SLOTS[
    slotId as Exclude<BackgroundSlotId, typeof NONE_SLOT_ID>
  ];
}

/** Build the asset descriptor for a known slot's variant in `mode`. */
function assetFor(
  slotId: BackgroundSlotId,
  slot: BackgroundAssetSlot,
  mode: ResolvedMode,
): ResolvedBackground {
  const variant = slot.variants[mode];
  return {
    kind: "asset",
    slotId,
    mode,
    source: variant.source,
    brightestPixel: variant.brightestPixel,
    darkestPixel: variant.darkestPixel,
  };
}

function resolveAssetById(
  slotId: BackgroundSlotId,
  mode: ResolvedMode,
): ResolvedBackground {
  const slot = assetSlot(slotId);
  if (!slot) {
    return { kind: "solid" };
  }
  return assetFor(slotId, slot, mode);
}

/**
 * Resolve `(package, slotId | null, mode)` to a renderable background. PURE and
 * RN-free (node-testable — the returned asset thunk is NOT invoked here). The file
 * is the slot's variant for the resolved `mode` (38.5 D-23); the slot rules are
 * mode-independent:
 *   - NULL   -> the package DEFAULT slot's variant,
 *   - 'none' -> the solid theme background,
 *   - a known slot id -> its variant,
 *   - an unknown/tampered id -> the package default's variant (safe fallback,
 *     T-23-05b / ADR-113).
 */
export function resolveBackground(
  themePackage: ThemePackage,
  slotId: BackgroundSlotId | null,
  mode: ResolvedMode,
): ResolvedBackground {
  if (slotId === null) {
    return resolveAssetById(PACKAGE_DEFAULT_SLOT[themePackage], mode);
  }
  if (slotId === NONE_SLOT_ID) {
    return { kind: "solid" };
  }
  const slot = assetSlot(slotId);
  if (!slot) {
    // Unknown/tampered id (a stored value the DAO would have rejected on write, or
    // one orphaned by a manifest change) — fall back to the package default.
    return resolveAssetById(PACKAGE_DEFAULT_SLOT[themePackage], mode);
  }
  return assetFor(slotId, slot, mode);
}

/**
 * Pure onError -> None/Solid reducer (REVIEWS 23-06 LOW test seam). When a bundled
 * asset fails to RENDER at runtime (Image/Skia `onError`, decode error, null image —
 * NOT a bundle-missing require, which fails at Metro resolution), `BackgroundHost`
 * feeds `renderFailed = true` here and the effective background silently becomes
 * None/Solid. This keeps the fallback branch a node-tested pure function rather than
 * untested inline component logic (the repo has no react-test-renderer to mount
 * `BackgroundHost`). The host resets its failure latch when the selection key
 * (which includes the mode) changes, so a failure never outlives a mode switch.
 */
export function resolveRenderableBackground(
  themePackage: ThemePackage,
  slotId: BackgroundSlotId | null,
  mode: ResolvedMode,
  renderFailed: boolean,
): ResolvedBackground {
  if (renderFailed) {
    return { kind: "solid" };
  }
  return resolveBackground(themePackage, slotId, mode);
}

// Compile-time assurance that every non-None accepted id has a manifest slot and
// vice-versa (a missing/extra id is a TYPE error, complementing the runtime drift
// test). Referencing the import keeps it a used symbol.
const _ALL_IDS: readonly BackgroundSlotId[] = BACKGROUND_SLOT_IDS;
void _ALL_IDS;
