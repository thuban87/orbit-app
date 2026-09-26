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
 * DECLARED-VS-DECODED (REVIEWS 23-06 cycle-4 MEDIUM; RG-029 / D-12): each asset
 * carries a declared worst-case `brightestPixel` AND `darkestPixel` — design
 * CONSTRAINTS the shipped `.webp` must stay within, used by the surface.test
 * both-extrema composited-AA proof. Nothing here decodes the committed bytes; the
 * committed `scripts/measure-background-extrema.py` does (Pillow): it composites
 * every decoded pixel under every card/chrome tint regime of the slot's package
 * and `--check` fails if either declared bound does not enclose that regime's
 * decoded COMPOSITE extremum. Run it whenever an asset is added or changed
 * (docs/runbooks/theme-visual-system-maintenance.md).
 */

import { BACKGROUND_SLOT_IDS, type BackgroundSlotId } from "./theme-option-ids";
import type { ThemePackage } from "./theme-types";

/** The shared None/Solid slot id — resolves to the solid theme background. */
export const NONE_SLOT_ID = "none" as const;

/** One bundled background asset slot. `source` is a LAZY require thunk (device-only). */
export interface BackgroundAssetSlot {
  /** The owning package (drives the per-package default + picker order). */
  package: ThemePackage;
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
  "galaxy-deep-space": {
    package: "galaxy",
    source: () => require("../../assets/backgrounds/galaxy-deep-space.webp"),
    brightestPixel: "#1A1F35",
    darkestPixel: "#000000",
  },
  "galaxy-starfield": {
    package: "galaxy",
    source: () => require("../../assets/backgrounds/galaxy-starfield.webp"),
    brightestPixel: "#202545",
    darkestPixel: "#000000",
  },
  "galaxy-nebula": {
    package: "galaxy",
    source: () => require("../../assets/backgrounds/galaxy-nebula.webp"),
    brightestPixel: "#2A2148",
    darkestPixel: "#000003",
  },
  "galaxy-aurora": {
    package: "galaxy",
    source: () => require("../../assets/backgrounds/galaxy-aurora.webp"),
    brightestPixel: "#16303A",
    darkestPixel: "#000103",
  },
  "standard-dawn": {
    package: "standard",
    source: () => require("../../assets/backgrounds/standard-dawn.webp"),
    brightestPixel: "#E8D8C0",
    darkestPixel: "#D09E76",
  },
  "standard-paper": {
    package: "standard",
    source: () => require("../../assets/backgrounds/standard-paper.webp"),
    brightestPixel: "#EDE6D8",
    darkestPixel: "#B4997A",
  },
  "standard-dusk": {
    package: "standard",
    source: () => require("../../assets/backgrounds/standard-dusk.webp"),
    brightestPixel: "#C8B0C0",
    darkestPixel: "#292634",
  },
  "standard-mesh": {
    package: "standard",
    source: () => require("../../assets/backgrounds/standard-mesh.webp"),
    brightestPixel: "#B8C4D0",
    darkestPixel: "#3A5069",
  },
};

/**
 * Each package's stable, ordered slot list for the (future) picker — asset slots
 * first in a FIXED order, then the shared None/Solid slot last. The resolved
 * background is a deterministic function of (package, stored slot-id) independent
 * of selection order (THEME-04 ordering edge).
 */
export const BACKGROUND_ORDER: Record<
  ThemePackage,
  readonly BackgroundSlotId[]
> = {
  galaxy: [
    "galaxy-deep-space",
    "galaxy-starfield",
    "galaxy-nebula",
    "galaxy-aurora",
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
  galaxy: "galaxy-deep-space",
  standard: "standard-dawn",
};

/** A resolved renderable background — a bundled asset or the solid theme background. */
export type ResolvedBackground =
  | {
      kind: "asset";
      slotId: BackgroundSlotId;
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

function resolveAssetById(slotId: BackgroundSlotId): ResolvedBackground {
  const slot = assetSlot(slotId);
  if (!slot) {
    return { kind: "solid" };
  }
  return {
    kind: "asset",
    slotId,
    source: slot.source,
    brightestPixel: slot.brightestPixel,
    darkestPixel: slot.darkestPixel,
  };
}

/**
 * Resolve `(package, slotId | null)` to a renderable background. PURE and RN-free
 * (node-testable — the returned asset thunk is NOT invoked here):
 *   - NULL   -> the package DEFAULT slot's asset,
 *   - 'none' -> the solid theme background,
 *   - a known slot id -> its bundled asset,
 *   - an unknown/tampered id -> the package default asset (safe fallback, T-23-05b).
 */
export function resolveBackground(
  themePackage: ThemePackage,
  slotId: BackgroundSlotId | null,
): ResolvedBackground {
  if (slotId === null) {
    return resolveAssetById(PACKAGE_DEFAULT_SLOT[themePackage]);
  }
  if (slotId === NONE_SLOT_ID) {
    return { kind: "solid" };
  }
  const slot = assetSlot(slotId);
  if (!slot) {
    // Unknown/tampered id (a stored value the DAO would have rejected on write, or
    // one orphaned by a manifest change) — fall back to the package default.
    return resolveAssetById(PACKAGE_DEFAULT_SLOT[themePackage]);
  }
  return {
    kind: "asset",
    slotId,
    source: slot.source,
    brightestPixel: slot.brightestPixel,
    darkestPixel: slot.darkestPixel,
  };
}

/**
 * Pure onError -> None/Solid reducer (REVIEWS 23-06 LOW test seam). When a bundled
 * asset fails to RENDER at runtime (Image/Skia `onError`, decode error, null image —
 * NOT a bundle-missing require, which fails at Metro resolution), `BackgroundHost`
 * feeds `renderFailed = true` here and the effective background silently becomes
 * None/Solid. This keeps the fallback branch a node-tested pure function rather than
 * untested inline component logic (the repo has no react-test-renderer to mount
 * `BackgroundHost`).
 */
export function resolveRenderableBackground(
  themePackage: ThemePackage,
  slotId: BackgroundSlotId | null,
  renderFailed: boolean,
): ResolvedBackground {
  if (renderFailed) {
    return { kind: "solid" };
  }
  return resolveBackground(themePackage, slotId);
}

// Compile-time assurance that every non-None accepted id has a manifest slot and
// vice-versa (a missing/extra id is a TYPE error, complementing the runtime drift
// test). Referencing the import keeps it a used symbol.
const _ALL_IDS: readonly BackgroundSlotId[] = BACKGROUND_SLOT_IDS;
void _ALL_IDS;
