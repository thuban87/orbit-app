/**
 * Per-combination art treatment table (38.5-06; owner rulings D-08, D-13, D-28).
 *
 * The owner signs scrim choices per theme × mode × background × component
 * (D-04, D-08). This module is the ONE pure table those choices live in, keyed
 * by package × resolved mode × rendered background × component. The component
 * keys are the v2 sign-off sheet's 11 field names (`38.5-scrim-signoff-v2.json`);
 * the planner never chooses placement (D-04).
 *
 * Only the five v2-marked components (`TABLE_DRIVEN_COMPONENTS`) read it at
 * runtime, through opt-in props (D-28): Contacts List entries (`ListRow`),
 * Contacts Card entries (`GridCard` via `GlassSurface treatment="contact-entry"`),
 * the "N contacts" count label (`ChromeScrim artComponent`), and the Contacts and
 * Digest headers (`ShellAppBar artComponent`). Everything else keeps today's
 * treatment through default props. The Population/Filters/Sort overlay menus and
 * every Orrery control and menu are never table-driven (D-12, D-04); the Contacts
 * control-row triggers read only their ACTIVE-state backing from here (see
 * `activeTriggerBacking`), and their inactive fill is fixed.
 *
 * PRODUCTION DATA = THE OWNER'S SIGNED v3 ANSWERS (38.5-08; D-13 step 4, D-36):
 * `SIGNED_V3_BACKINGS` is transcribed from
 * `.planning/phases/38.5-background-art-text-contrast/38.5-scrim-signoff-v3.json`
 * (signed 2026-09-29, the assembled answer with his chat amendments). The sync
 * guard in `art-treatments.test.ts` compares every cell with that file, so an
 * edit to either side that the other does not mirror fails (ADR-177).
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
import type { BackgroundSlotId, StoredBackgroundId } from "./theme-option-ids";
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
 * component). `mode` is the mode's own palette; `inverse` would be the opposite
 * mode's text roles. The signed v3 answer flags no inverse cell (D-44: the art
 * matches the mode), so every production cell is `mode` and no inverse palette
 * exists.
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
   * False everywhere in production: the ⋯ follows the header (D-43).
   */
  overflowLocalBacking: boolean;
  /**
   * `contactsTopButtons` only (null for every other component): the backing of
   * an ACTIVE Population/Filters/Sort trigger. Production is `none`, today's
   * border-only look, although D-08 marks "Top btns" F in every combination.
   * The v3 sheet showed that gap (38.5-01 H-3, item I1) for information only;
   * it was not ruled, so it stays `none` and sits on the end-of-phase owner
   * list (D-28, D-45). An inactive trigger's solid fill is fixed and never
   * table-driven (D-04, D-12).
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
 * The PRE-38.5 treatment for a component (ADR-115's mode-matched rule). Kept for
 * two reasons: the sync guard proves that only `TABLE_DRIVEN_COMPONENTS` differ
 * from it (D-28), and `resolveArtCell` falls back to it for a key the table
 * lacks (never reached for a lineup key). The rule:
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

/**
 * The components the table drives at runtime (D-28): the five the owner marked
 * on the v2 sheet. The v3 answers changed no cell outside them (38.5-SIGNOFF-V3
 * §2), so none joins. Every other component's signed column equals its
 * pre-38.5 behaviour (`currentArtCell`); the sync guard proves both.
 */
export const TABLE_DRIVEN_COMPONENTS = [
  "contactsListEntries",
  "contactsCardEntries",
  "contactsCountLabel",
  "contactsHeader",
  "digestHeader",
] as const satisfies readonly ArtComponent[];

// The sheet's vocabulary: F solid, T see-through (the sheet's "transparent"),
// N no backing.
const F: ArtBacking = "full";
const T: ArtBacking = "seeThrough";
const N: ArtBacking = "none";

/** One signed row: the 11 backings in `ART_COMPONENTS` order. */
type SignedRow = readonly [
  ArtBacking,
  ArtBacking,
  ArtBacking,
  ArtBacking,
  ArtBacking,
  ArtBacking,
  ArtBacking,
  ArtBacking,
  ArtBacking,
  ArtBacking,
  ArtBacking,
];

/**
 * The owner's signed v3 backings (38.5-SIGNOFF-V3.md §7; D-36), one row per
 * combination. Columns, in `ART_COMPONENTS` order:
 *   List | Card | Top btns | Search | Count | C. header | D. header |
 *   D. headings | Up Next | Horizon | Your Week
 * Galaxy's `quiet` slot is the one labelled "Deep Space" (D-33). The levels of
 * the T cells live in `ART_SEE_THROUGH_OPACITY` (tokens/surface.ts; D-37).
 */
export const SIGNED_V3_BACKINGS: Readonly<Record<string, SignedRow>> = {
  "galaxy-light-quiet": [T, T, F, F, N, N, N, N, N, N, N],
  "galaxy-light-aurora": [T, T, F, F, N, N, N, N, N, N, N],
  "galaxy-light-starfield": [T, T, F, F, N, N, N, N, N, N, N],
  "galaxy-light-none": [F, F, F, F, N, N, N, N, N, N, N],
  "galaxy-dark-quiet": [T, T, F, F, T, T, T, N, N, N, N],
  "galaxy-dark-aurora": [T, T, F, F, T, T, T, N, N, N, N],
  "galaxy-dark-starfield": [T, T, F, F, T, T, T, N, N, N, N],
  // List and Card full: the owner's chat amendment 4 ("I meant full scrim").
  "galaxy-dark-none": [F, F, F, F, T, T, T, N, N, N, N],
  "standard-light-dawn": [T, T, F, F, N, N, N, N, N, N, N],
  // Paper keeps its intentional full entries (D-08 correction (b)).
  "standard-light-paper": [F, F, F, F, N, N, N, N, N, N, N],
  "standard-light-dusk": [T, T, F, F, N, N, N, N, N, N, N],
  "standard-light-none": [F, F, F, F, T, T, T, N, N, N, N],
  // Count label T at the signed Standard Dark level 0 (Q2g R1); headers none.
  "standard-dark-dawn": [T, T, F, F, T, N, N, N, N, N, N],
  "standard-dark-paper": [T, T, F, F, T, N, N, N, N, N, N],
  "standard-dark-dusk": [T, T, F, F, T, N, N, N, N, N, N],
  "standard-dark-none": [F, F, F, F, F, F, F, N, N, N, N],
};

/**
 * The signed foreground of every cell (D-44): text on the see-through contact
 * entries keeps the mode default in Galaxy Light and Standard Dark, because the
 * new art matches the mode; no cell is flagged inverse.
 */
const SIGNED_V3_FOREGROUND: ArtForeground = "mode";

/**
 * The signed ⋯ answer (D-43, `followHeader`): where the Contacts header has no
 * backing, the ⋯ has none either, so no cell draws a local ⋯ backing.
 */
const SIGNED_V3_OVERFLOW_LOCAL_BACKING = false;

function buildSignedTable(): ArtTreatmentTable {
  const table: ArtTreatmentTable = {};
  for (const [key, backings] of Object.entries(SIGNED_V3_BACKINGS)) {
    const row = {} as Record<ArtComponent, ArtCell>;
    ART_COMPONENTS.forEach((component, index) => {
      row[component] = {
        backing: backings[index],
        foreground: SIGNED_V3_FOREGROUND,
        overflowLocalBacking:
          component === "contactsHeader" &&
          backings[index] === "none" &&
          SIGNED_V3_OVERFLOW_LOCAL_BACKING,
        // I1 (the active trigger's fill) was not ruled on v3: production stays
        // border-only (D-28 gap list).
        activeTriggerBacking:
          component === "contactsTopButtons" ? "none" : null,
      };
    });
    table[key] = row;
  }
  return table;
}

/** THE production table: the owner's signed v3 answers (D-13 step 4, D-36). */
export const ART_TREATMENTS: ArtTreatmentTable = buildSignedTable();

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

/** The opacity group of a table-driven component, or null for the rest. */
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
  devOverrides: unknown = null,
  table: ArtTreatmentTable = ART_TREATMENTS,
): ArtTreatment {
  const key = artBackgroundKey(
    resolveBackground(themePackage, storedBackground, mode),
  );
  const found = resolveArtCell(table, themePackage, mode, key, component);
  const { cell, opacity } = applyArtDevOverrides(
    found,
    cellOpacity(themePackage, mode, component, found.backing),
    devOverrides,
    artCombinationKey(themePackage, mode, key),
    component,
    artOpacityGroup(component),
  );
  return { ...cell, opacity };
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

// ---------------------------------------------------------------------------
// DEV-only override (38.5-06 Task 3; D-27; T-38.5-06-01).
//
// The re-sign-off capture (38.5-07) renders the owner's v2 choices over the new
// art on a DEBUG build through `src/theme/__dev__/art-treatment-dev-overrides.json`
// (schema in `use-art-treatment.ts`). That file reaches the app ONLY through a
// `__DEV__ ? require(...) : null` guard, so a release bundle never contains it;
// these pure helpers are inert on `null` and on a disabled file. The file is
// untrusted input: every field is validated and an invalid one is ignored.
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function enabledOverrides(overrides: unknown): Record<string, unknown> | null {
  return isRecord(overrides) && overrides.enabled === true ? overrides : null;
}

function member<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  return typeof value === "string" &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

function ownRecord(
  holder: unknown,
  key: string,
): Record<string, unknown> | undefined {
  if (!isRecord(holder) || !Object.hasOwn(holder, key)) return undefined;
  const value = holder[key];
  return isRecord(value) ? value : undefined;
}

/**
 * Apply the DEV override to a resolved cell. Returns the input unchanged when
 * `overrides` is null, not an object or not `enabled: true`. Otherwise:
 *   - `cells[comboKey][component]` replaces `backing`, `overflowLocalBacking`
 *     and `activeTriggerBacking` (each only when valid);
 *   - the opacity follows the (possibly overridden) backing, and for a
 *     see-through backing `opacity["<pkg>-<mode>"][group]` (a candidate or
 *     card-blend value in [0, 1]) replaces the see-through opacity. Without a
 *     valid candidate an unsigned see-through fails safe to the full value.
 */
export function applyArtDevOverrides(
  cell: ArtCell,
  opacity: number | null,
  overrides: unknown,
  comboKey: string,
  component: ArtComponent,
  group: ArtOpacityGroup | null,
): { cell: ArtCell; opacity: number | null } {
  const enabled = enabledOverrides(overrides);
  const combo = /^(galaxy|standard)-(light|dark)-/.exec(comboKey);
  if (enabled === null || combo === null) return { cell, opacity };
  const themePackage = combo[1] as ThemePackage;
  const mode = combo[2] as ResolvedMode;

  const cellOverride = ownRecord(ownRecord(enabled.cells, comboKey), component);
  const backing = member(cellOverride?.backing, ART_BACKINGS);
  const activeTrigger = member(
    cellOverride?.activeTriggerBacking,
    ART_TRIGGER_BACKINGS,
  );
  const next: ArtCell = {
    ...cell,
    ...(backing !== undefined ? { backing } : {}),
    ...(typeof cellOverride?.overflowLocalBacking === "boolean"
      ? { overflowLocalBacking: cellOverride.overflowLocalBacking }
      : {}),
    ...(activeTrigger !== undefined && cell.activeTriggerBacking !== null
      ? { activeTriggerBacking: activeTrigger }
      : {}),
  };

  const candidate =
    group !== null
      ? ownRecord(enabled.opacity, `${themePackage}-${mode}`)?.[group]
      : undefined;
  const validCandidate =
    typeof candidate === "number" &&
    Number.isFinite(candidate) &&
    candidate >= 0 &&
    candidate <= 1
      ? candidate
      : undefined;

  let nextOpacity: number | null;
  if (next.backing === "seeThrough" && validCandidate !== undefined) {
    nextOpacity = validCandidate;
  } else if (next.backing === cell.backing) {
    nextOpacity = opacity;
  } else {
    nextOpacity = cellOpacity(themePackage, mode, component, next.backing);
  }
  return { cell: next, opacity: nextOpacity };
}

/** The in-memory combination the DEV override applies (validated), or null. */
export interface ArtDevCombo {
  package: ThemePackage;
  mode: ResolvedMode;
  background: BackgroundSlotId;
}

/**
 * The DEV override's `combo` as an in-memory selection, or null when the file
 * is absent, disabled or the combo is invalid. `background` is the package's
 * active slot id or its short key (`aurora` -> `galaxy-aurora`, `none`); a
 * retired slot or another package's slot is rejected.
 */
export function artDevCombo(overrides: unknown): ArtDevCombo | null {
  const combo = ownRecord(enabledOverrides(overrides), "combo");
  if (!combo) return null;
  const themePackage = member(combo.package, PACKAGES);
  const mode = member(combo.mode, MODES);
  if (themePackage === undefined || mode === undefined) return null;
  const requested = combo.background;
  if (typeof requested !== "string") return null;
  const background = BACKGROUND_ORDER[themePackage].find(
    (slotId) => slotId === requested || slotKey(slotId) === requested,
  );
  return background === undefined
    ? null
    : { package: themePackage, mode, background };
}
