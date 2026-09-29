/**
 * Per-combination art treatment table (38.5-06; owner rulings D-08, D-13, D-28).
 *
 * The owner signs scrim choices per theme × mode × background × component
 * (D-04, D-08). This module is the ONE pure table those choices live in, keyed
 * by package × resolved mode × rendered background × component. The component
 * keys are the v2 sign-off sheet's 11 field names (`38.5-scrim-signoff-v2.json`);
 * the planner never chooses placement (D-04).
 *
 * Only the five v2-marked components read it at runtime, through opt-in props
 * (D-28): Contacts List entries (`ListRow`), Contacts Card entries (`GridCard` via
 * `GlassSurface treatment="contact-entry"`), the "N contacts" count label
 * (`ChromeScrim artComponent`), and the Contacts and Digest headers
 * (`ShellAppBar artComponent`). Everything else keeps today's treatment through
 * default props. The Population/Filters/Sort overlay menus and every Orrery
 * control and menu are never table-driven (D-12, D-04); the Contacts control-row
 * triggers read only their ACTIVE-state backing from here (see
 * `activeTriggerBacking`), and their inactive fill is fixed.
 *
 * PRODUCTION DATA = TODAY (D-13): until 38.5-08 replaces `ART_TREATMENTS` with
 * the owner's re-signed v3 answers, the table is built from `currentArtCell`,
 * which encodes today's mode-matched rule (ADR-115). `art-treatments.test.ts`
 * proves the identity for every combination.
 *
 * Vocabulary only (`full` / `seeThrough` / `none`): no colour and no opacity
 * number lives here. Opacities come from `tokens/surface.ts`
 * (`artBackingOpacity`, `ART_SEE_THROUGH_OPACITY`); colours from theme tokens.
 *
 * PURE: no react-native import, node-testable.
 */
import {
  BACKGROUND_ORDER,
  NONE_SLOT_ID,
  PACKAGE_DEFAULT_SLOT,
  type ResolvedBackground,
  resolveBackground,
} from "./backgrounds";
import type { StoredBackgroundId } from "./theme-option-ids";
import type { ResolvedMode, ThemePackage } from "./theme-types";
import {
  type ArtOpacityGroup,
  artBackingOpacity,
  cardMatchesMode,
} from "./tokens/surface";

/** The v2 sign-off sheet's component field names, exactly (D-08). */
export const ART_COMPONENTS = [
  "contactsListEntries",
  "contactsCardEntries",
  "contactsTopButtons",
  "contactsSearchAndToggle",
  "contactsCountLabel",
  "contactsHeader",
  "digestHeader",
  "digestSectionHeadings",
  "digestUpNextItems",
  "digestHorizonItems",
  "digestYourWeek",
] as const;

export type ArtComponent = (typeof ART_COMPONENTS)[number];

/** The sheet's vocabulary: F (solid), T (see-through glass), N (no backing). */
export const ART_BACKINGS = ["full", "seeThrough", "none"] as const;
export type ArtBacking = (typeof ART_BACKINGS)[number];

/**
 * The foreground a cell's text takes (D-10, D-26: one per combination ×
 * component). `mode` is the mode's own palette; `inverse` is reserved for the
 * signed v3 data (38.5-08). Every production cell is `mode`.
 */
export type ArtForeground = "mode" | "inverse";

/**
 * The backing an ACTIVE Population/Filters/Sort trigger draws. Only `full` or
 * `none`: a control that opens an overlay menu keeps a scrim (D-04), and the
 * open question (38.5-01 gap H-3) is only whether its active state gets one too.
 */
export const ART_TRIGGER_BACKINGS = ["full", "none"] as const;
export type ArtTriggerBacking = (typeof ART_TRIGGER_BACKINGS)[number];

export interface ArtCell {
  backing: ArtBacking;
  foreground: ArtForeground;
  /**
   * `contactsHeader` only: with backing `none`, draw a local backing behind the
   * ⋯ overflow trigger (the owner's ⋯ question on the re-sign-off sheet).
   * False everywhere in production.
   */
  overflowLocalBacking: boolean;
  /**
   * `contactsTopButtons` only (null for every other component): the backing of
   * an ACTIVE Population/Filters/Sort trigger. Production is `none`, today's
   * border-only look, although D-08 marks "Top btns" F in every combination.
   * That gap (38.5-01 H-3) is recorded here so the re-sign-off (38.5-07)
   * captures it and 38.5-08 applies the signed value. An inactive trigger's
   * solid fill is fixed and never table-driven (D-04, D-12).
   */
  activeTriggerBacking: ArtTriggerBacking | null;
}

/**
 * The rendered background's table key: the slot id without its package prefix
 * (`galaxy-quiet` -> `quiet`), or `none` for the solid background.
 */
export function artBackgroundKey(resolved: ResolvedBackground): string {
  if (resolved.kind === "solid") return NONE_SLOT_ID;
  return resolved.slotId.replace(/^(galaxy|standard)-/, "");
}

/** The v2 JSON key format: `<theme>-<mode>-<bg>`. */
export function artCombinationKey(
  themePackage: ThemePackage,
  mode: ResolvedMode,
  backgroundKey: string,
): string {
  return `${themePackage}-${mode}-${backgroundKey}`;
}

const PACKAGES: readonly ThemePackage[] = ["galaxy", "standard"];
const MODES: readonly ResolvedMode[] = ["light", "dark"];

function slotKey(slotId: string): string {
  return slotId === NONE_SLOT_ID
    ? NONE_SLOT_ID
    : slotId.replace(/^(galaxy|standard)-/, "");
}

/** Every combination the lineup can render (per package: 3 art slots + none, × 2 modes). */
export const ART_COMBINATION_KEYS: readonly string[] = PACKAGES.flatMap(
  (themePackage) =>
    MODES.flatMap((mode) =>
      BACKGROUND_ORDER[themePackage].map((slotId) =>
        artCombinationKey(themePackage, mode, slotKey(slotId)),
      ),
    ),
);

/**
 * TODAY's shipped treatment for a component (ADR-115's mode-matched rule):
 *   - List entries: full (a solid fill in every combination);
 *   - Card entries, the count label and both headers: see-through when the art
 *     tone matches the mode (`cardMatchesMode`), else full;
 *   - top buttons and search: full (an active trigger is border-only today);
 *   - Digest content: none;
 *   - foreground: the mode's own palette.
 * Independent of the background: today's rule never looked at it.
 */
export function currentArtCell(
  themePackage: ThemePackage,
  mode: ResolvedMode,
  component: ArtComponent,
): ArtCell {
  const matched = cardMatchesMode(themePackage, mode);
  let backing: ArtBacking;
  switch (component) {
    case "contactsCardEntries":
    case "contactsCountLabel":
    case "contactsHeader":
    case "digestHeader":
      backing = matched ? "seeThrough" : "full";
      break;
    case "contactsListEntries":
    case "contactsTopButtons":
    case "contactsSearchAndToggle":
      backing = "full";
      break;
    default:
      backing = "none";
  }
  return {
    backing,
    foreground: "mode",
    overflowLocalBacking: false,
    activeTriggerBacking: component === "contactsTopButtons" ? "none" : null,
  };
}

export type ArtTreatmentTable = Record<string, Record<ArtComponent, ArtCell>>;

function buildCurrentTable(): ArtTreatmentTable {
  const table: ArtTreatmentTable = {};
  for (const themePackage of PACKAGES) {
    for (const mode of MODES) {
      for (const slotId of BACKGROUND_ORDER[themePackage]) {
        const row = {} as Record<ArtComponent, ArtCell>;
        for (const component of ART_COMPONENTS) {
          row[component] = currentArtCell(themePackage, mode, component);
        }
        table[artCombinationKey(themePackage, mode, slotKey(slotId))] = row;
      }
    }
  }
  return table;
}

/**
 * THE production table: today's treatment for every combination, until 38.5-08
 * replaces it with the owner's signed v3 answers (D-13).
 */
export const ART_TREATMENTS: ArtTreatmentTable = buildCurrentTable();

/**
 * Look up a cell. The background key comes from the resolver, so it is always a
 * lineup key; a key the table lacks falls back to the package default slot's
 * row, then to today's cell (never to a thinner backing).
 */
export function resolveArtCell(
  table: ArtTreatmentTable,
  themePackage: ThemePackage,
  mode: ResolvedMode,
  backgroundKey: string,
  component: ArtComponent,
): ArtCell {
  const row =
    table[artCombinationKey(themePackage, mode, backgroundKey)] ??
    table[
      artCombinationKey(
        themePackage,
        mode,
        slotKey(PACKAGE_DEFAULT_SLOT[themePackage]),
      )
    ];
  return row?.[component] ?? currentArtCell(themePackage, mode, component);
}

/** The opacity group of a marked component, or null for the rest. */
export function artOpacityGroup(
  component: ArtComponent,
): ArtOpacityGroup | null {
  switch (component) {
    case "contactsListEntries":
      return "listEntry";
    case "contactsCardEntries":
      return "cardEntry";
    case "contactsCountLabel":
    case "contactsHeader":
    case "digestHeader":
      return "artChrome";
    default:
      return null;
  }
}

/** What a marked component renders with: the cell plus its backing opacity. */
export interface ArtTreatment {
  backing: ArtBacking;
  foreground: ArtForeground;
  /** The backing opacity, or null when the backing is `none`. */
  opacity: number | null;
  overflowLocalBacking: boolean;
  activeTriggerBacking: ArtTriggerBacking | null;
}

/** The opacity of a cell: its group's token value, or a plain solid/none. */
function cellOpacity(
  themePackage: ThemePackage,
  mode: ResolvedMode,
  component: ArtComponent,
  backing: ArtBacking,
): number | null {
  const group = artOpacityGroup(component);
  if (group !== null) {
    return artBackingOpacity(themePackage, mode, group, backing);
  }
  return backing === "none" ? null : 1;
}

/**
 * The pure core of `useArtTreatment`: resolve the stored background (retired,
 * unknown and null ids go to the package default, exactly as the host renders
 * them), look up the cell, and attach its opacity.
 */
export function resolveArtTreatment(
  themePackage: ThemePackage,
  mode: ResolvedMode,
  storedBackground: StoredBackgroundId | null,
  component: ArtComponent,
  table: ArtTreatmentTable = ART_TREATMENTS,
): ArtTreatment {
  const key = artBackgroundKey(
    resolveBackground(themePackage, storedBackground, mode),
  );
  const cell = resolveArtCell(table, themePackage, mode, key, component);
  return {
    ...cell,
    opacity: cellOpacity(themePackage, mode, component, cell.backing),
  };
}

/**
 * The scrim decision shared by `ChromeScrim` and `ShellAppBar`:
 *   - no treatment (no opt-in): today's scrim at `defaultOpacity`, scoped;
 *   - backing `none`: no scrim, children unscoped (D-10: text on the art takes
 *     the root, art-suited palette);
 *   - otherwise: the treatment's opacity, scoped.
 */
export function artScrimBacking(
  treatment: Pick<ArtTreatment, "backing" | "opacity"> | null,
  defaultOpacity: number,
): { opacity: number | null; scoped: boolean } {
  if (treatment === null) return { opacity: defaultOpacity, scoped: true };
  if (treatment.backing === "none") return { opacity: null, scoped: false };
  return { opacity: treatment.opacity, scoped: true };
}

/**
 * The List row's backing (38.5-06; D-08, D-09):
 *   - no treatment or `full`: today's solid `surface` fill, content unscoped
 *     (root palette, as today);
 *   - `seeThrough`: no solid fill; an absolute-fill `surface` tint at the cell
 *     opacity, and the content inside the glass foreground scope;
 *   - `none`: neither fill nor tint; content unscoped (D-10: text on the art
 *     takes the root, art-suited palette).
 */
export function listRowBacking(
  treatment: Pick<ArtTreatment, "backing" | "opacity"> | null,
): { solidFill: boolean; tintOpacity: number | null; scoped: boolean } {
  if (treatment === null || treatment.backing === "full") {
    return { solidFill: true, tintOpacity: null, scoped: false };
  }
  if (treatment.backing === "none") {
    return { solidFill: false, tintOpacity: null, scoped: false };
  }
  return { solidFill: false, tintOpacity: treatment.opacity, scoped: true };
}

/**
 * A Contacts Population/Filters/Sort trigger's backing (orchestrator addition to
 * 38.5-06; 38.5-01 gap H-3). An INACTIVE trigger is always `full` (its solid
 * `surface` fill; D-04: a button that opens an overlay menu keeps its scrim), so
 * it is never table-driven. An ACTIVE trigger takes the table's
 * `activeTriggerBacking`; with no treatment it keeps today's border-only look.
 */
export function controlTriggerBacking(
  active: boolean,
  activeTriggerBacking: ArtTriggerBacking | null,
): ArtTriggerBacking {
  if (!active) return "full";
  return activeTriggerBacking ?? "none";
}
