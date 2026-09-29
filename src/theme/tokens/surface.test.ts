import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SWIPE_ROW_BACKING_OPACITY,
  swipeRowTintOpacity,
} from "@/components/list-row-swipe-backing";
import { applyAccent, DEFAULT_ACCENT, resolveAccent } from "../accents";
import {
  ART_COMBINATION_KEYS,
  ART_TREATMENTS,
  artOpacityGroup,
  TABLE_DRIVEN_COMPONENTS,
} from "../art-treatments";
import {
  BACKGROUND_SLOTS,
  type BackgroundVariant,
  NONE_SLOT_ID,
} from "../backgrounds";
import {
  AA_LARGE,
  AA_NORMAL,
  contrastRatio,
  relativeLuminance,
} from "../contrast";
import { resolveGlassForegroundPalette } from "../glass-foregrounds";
import {
  ACCENT_IDS,
  type AccentId,
  type BackgroundSlotId,
} from "../theme-option-ids";
import { resolvePalette } from "../theme-presets";
import type { ResolvedMode, ThemePackage, ThemePalette } from "../theme-types";
import { ICON_SIZE } from "./icon-size";
import { SPACING } from "./spacing";
import {
  ART_SEE_THROUGH_OPACITY,
  type ArtOpacityGroup,
  alphaComposite,
  BACKGROUND_VEIL_OPACITY,
  backgroundVeilOpacity,
  CARD_GLASS_OPACITY,
  cardMatchesMode,
  cardTintOpacity,
  chromeScrimOpacity,
  MIN_BACKGROUND_CONTRIBUTION,
  ORRERY_OVERLAY_BACKDROP_VISIBILITY_CEILING,
  orreryOverlayTintOpacity,
  resolveSurfaceStyle,
  SURFACE,
  SURFACE_COLOR_TOKEN_KEYS,
  SURFACE_DENSITIES,
  type SurfaceDensity,
  surfaceOpacityForDensity,
} from "./surface";

const PACKAGES: ThemePackage[] = ["galaxy", "standard"];
const MODES: ResolvedMode[] = ["dark", "light"];
const ART_OPACITY_GROUPS: readonly ArtOpacityGroup[] = [
  "listEntry",
  "cardEntry",
  "artChrome",
];

/**
 * Text foregrounds are gated at AA_NORMAL; status/glyph foregrounds at AA_LARGE
 * (the same split accents.test.ts uses — status hues are large elements). Together
 * these are the "text/status foregrounds" the glass-composite AA gate protects.
 */
const TEXT_FGS = ["textPrimary", "textSecondary"] as const;
const STATUS_FGS = [
  "statusStable",
  "statusWobble",
  "statusDecay",
  "rogue",
] as const;

/**
 * NON-TEXT / LINK / DANGER foregrounds asserted over glass + chrome with the
 * both-extrema + interval proof (RG-029 / D-24). Floors: status hues and rogue
 * are glyph/large elements (AA_LARGE); `danger` renders as validation/warning
 * TEXT, so it carries AA_NORMAL. The set comes from the committed inventory
 * (.planning/phases/38.4-audit-remediation-ui-performance-release/
 * 38.4-RG029-INVENTORY.md); anything not asserted is in PROOF_EXCLUSIONS below.
 */
const GLASS_NONTEXT_FGS: readonly {
  token: keyof ThemePalette;
  floor: number;
}[] = [
  ...STATUS_FGS.map((token) => ({ token, floor: AA_LARGE })),
  { token: "danger", floor: AA_NORMAL },
];

/** The committed inventories an exclusion may cite. */
const RG029_INVENTORY =
  ".planning/phases/38.4-audit-remediation-ui-performance-release/38.4-RG029-INVENTORY.md";
const BARE_TEXT_INVENTORY =
  ".planning/phases/38.5-background-art-text-contrast/38.5-BARE-TEXT-INVENTORY.md";
/** Where an owner-accepted, variant-scoped art allowance is recorded (38.5-04). */
const ART_SIGNOFF =
  ".planning/phases/38.5-background-art-text-contrast/38.5-ART-SIGNOFF.md";

/**
 * Every treatment a proof exclusion can name (38.5-03). `card` and `chrome` are
 * the glass proofs above; `bare` is the bare-text-on-veil proof below. The
 * three art treatments (`listEntry`, `cardEntry`, `artChrome`) are the signed
 * see-through backings of the table-driven components, proven in "Signed art
 * treatments (38.5 v3)" and entered in the extrema regimes (38.5-08, C3-M2).
 */
type ProofTreatment =
  | "card"
  | "chrome"
  | "bare"
  | "listEntry"
  | "cardEntry"
  | "artChrome";

/**
 * Every narrowing of the asserted foreground set, written down (D-24: nothing
 * narrowed silently). Each entry names the inventory row that justifies it.
 */
interface ProofExclusion {
  token: keyof ThemePalette;
  /** Omitted = every package. */
  package?: ThemePackage;
  /**
   * Omitted = every mode. A variant renders only in its own mode (38.5 P-2), so
   * with `slotId` this is also the variant's mode.
   */
  mode?: ResolvedMode;
  /** accentText only: the curated accent excluded. Omitted = every accent. */
  accentId?: AccentId;
  /**
   * REQUIRED: the treatments this exclusion covers (38.5-03). No entry covers
   * every treatment by omission, so a new proof (e.g. bare text) never
   * silently inherits an old exclusion (research Pitfall 2).
   */
  treatment: readonly ProofTreatment[];
  /**
   * Variant scope for an owner-accepted art allowance: an entry with `slotId`
   * matches only a call passing the same `slotId` (a call with another slot or
   * with none never matches it; C3-L2).
   */
  slotId?: BackgroundSlotId;
  /**
   * `accepted` = an owner-ruled, permanent limitation. `held-for-owner` = a
   * failure found by this proof that is the owner's call (a regime other than
   * Standard Light, or a protected tone); nothing is retuned while it is held.
   */
  status: "accepted" | "held-for-owner";
  justification: string;
  inventoryRef: string;
  /** The inventory holding `**inventoryRef**`. Omitted = the 38.4 RG029 inventory. */
  inventoryPath?: string;
}

const BASE_PROOF_EXCLUSIONS: readonly ProofExclusion[] = [
  {
    token: "danger",
    package: "galaxy",
    mode: "dark",
    treatment: ["card", "chrome"],
    justification:
      "ADR-084 owner-accepted Galaxy Dark danger (#E5484D) limitation: danger-as-text reaches 3.58-4.16:1 over the brightest Galaxy composites. D-24 keeps it as it is; it is never retuned here.",
    status: "accepted",
    inventoryRef: "E-1",
  },
  // Present because 38.5-BARE-TEXT-INVENTORY.md records `D24_RESULT: extend`
  // (the sync test below fails if the two disagree).
  {
    token: "danger",
    package: "galaxy",
    mode: "dark",
    treatment: ["bare"],
    justification:
      "ADR-084 owner-accepted Galaxy Dark danger (#E5484D) limitation extended to bare text on the art by D-24 (owner, 2026-09-28): red danger bare sites are 26/302 = 8.61% (bare-only), 29/325 = 8.92% (bare + mixed), 32/347 = 9.22% (per route row), all under 10%. Worst case about 3.5:1 (COMPUTED 3.52:1 at the L* 18.5 art ceiling), still at or above 3:1; never retuned.",
    status: "accepted",
    inventoryRef: "E-1-bare",
    inventoryPath: BARE_TEXT_INVENTORY,
  },
];

/**
 * One owner-approved broad-feature exclusion record from the machine-readable
 * block in 38.5-ART-SIGNOFF.md (38.5-03's "Exclusion-record schema"; H-2). The
 * checker enforces `region` / `feature`; the TS proofs work over extrema, so a
 * record excludes its tokens for that variant and treatments whole (C3-M1).
 */
interface SignedExclusionRecord {
  id: string;
  slotId: string;
  mode: ResolvedMode;
  tokens: readonly string[];
  treatments: readonly ProofTreatment[];
  region?: unknown;
  feature?: unknown;
  reason: string;
  ownerApproved: string;
}

/** The owner-signed block: `featureAllowance` source and exclusion records. */
interface ArtSignoffBlock {
  allowances: readonly {
    slotId: string;
    mode: ResolvedMode;
    maxComponentPx: number;
    maxFailingPct: number;
    acceptedAt: string;
  }[];
  exclusions: readonly SignedExclusionRecord[];
}

/**
 * PURE: parse the one fenced ```json block under "## Accepted exclusions
 * (machine-readable)" — the same block `scripts/background_manifest.py`
 * `parse_accepted_exclusions()` reads. Never hand-typed (H-2).
 */
function parseArtSignoffBlock(text: string): ArtSignoffBlock {
  const section = text.split("## Accepted exclusions (machine-readable)")[1];
  if (section === undefined) {
    throw new Error("ART-SIGNOFF has no machine-readable section");
  }
  const match = /```json\n([\s\S]*?)\n```/.exec(section);
  if (match === null) {
    throw new Error("ART-SIGNOFF machine-readable section has no json block");
  }
  return JSON.parse(match[1]) as ArtSignoffBlock;
}

/**
 * PURE (C2-M2): the deterministic expansion of the signed exclusion records into
 * variant-scoped proof exclusions — one `ProofExclusion` per element of a
 * record's `tokens`, in record order then token order:
 *   - `accentText` -> token accentText, every accent (accentId omitted);
 *   - `accentText:<id>` -> token accentText, that accentId;
 *   - any other element -> that palette key;
 *   - `slotId`/`mode` from the record, `package` omitted (the slot scopes it);
 *   - `treatment` = the record's `treatments`, unchanged;
 *   - `status: "accepted"`, `inventoryRef` = the record id (its bold `**X-n**`
 *     row is in 38.5-ART-SIGNOFF.md), `inventoryPath` = ART_SIGNOFF;
 *   - justification `${reason} [${id}: ${slotId} ${mode}, owner-approved ${ownerApproved}]`,
 *     over 40 characters because the bracketed suffix alone is.
 */
function expandSignedExclusions(
  records: readonly SignedExclusionRecord[],
): ProofExclusion[] {
  const out: ProofExclusion[] = [];
  for (const record of records) {
    for (const element of record.tokens) {
      const [key, accent] = element.split(":");
      out.push({
        token: key as keyof ThemePalette,
        mode: record.mode,
        ...(key === "accentText" && accent !== undefined
          ? { accentId: accent as AccentId }
          : {}),
        treatment: record.treatments,
        slotId: record.slotId as BackgroundSlotId,
        status: "accepted",
        justification: `${record.reason} [${record.id}: ${record.slotId} ${record.mode}, owner-approved ${record.ownerApproved}]`,
        inventoryRef: record.id,
        inventoryPath: ART_SIGNOFF,
      });
    }
  }
  return out;
}

const ART_SIGNOFF_BLOCK = parseArtSignoffBlock(
  readFileSync(ART_SIGNOFF, "utf8"),
);

/** The written-down exclusions plus the owner-signed variant-scoped ones. */
const PROOF_EXCLUSIONS: readonly ProofExclusion[] = [
  ...BASE_PROOF_EXCLUSIONS,
  ...expandSignedExclusions(ART_SIGNOFF_BLOCK.exclusions),
];

/** The call-site scope an exclusion is matched against. */
interface ExclusionScope {
  /** accentText only: the RENDERED accent id. */
  accentId?: AccentId | null;
  treatment: ProofTreatment;
  /** The background variant's slot id; absent for the None (solid) background. */
  slotId?: BackgroundSlotId;
}

/** PURE: does one exclusion entry cover this token at this scope? */
function matchesExclusion(
  entry: ProofExclusion,
  token: keyof ThemePalette,
  pkg: ThemePackage,
  mode: ResolvedMode,
  scope: ExclusionScope,
): boolean {
  return (
    entry.token === token &&
    (entry.package === undefined || entry.package === pkg) &&
    (entry.mode === undefined || entry.mode === mode) &&
    (entry.accentId === undefined || entry.accentId === scope.accentId) &&
    entry.treatment.includes(scope.treatment) &&
    (entry.slotId === undefined || entry.slotId === scope.slotId)
  );
}

function isExcluded(
  token: keyof ThemePalette,
  pkg: ThemePackage,
  mode: ResolvedMode,
  scope: ExclusionScope,
): boolean {
  return PROOF_EXCLUSIONS.some((e) =>
    matchesExclusion(e, token, pkg, mode, scope),
  );
}

function assertNonTextClearsExtrema(
  palette: ThemePalette,
  pkg: ThemePackage,
  mode: ResolvedMode,
  tint: string,
  opacity: number,
  slot: BackgroundVariant,
  label: string,
  scope: { treatment: "card" | "chrome"; slotId: BackgroundSlotId },
) {
  for (const { token, floor } of GLASS_NONTEXT_FGS) {
    if (isExcluded(token, pkg, mode, scope)) continue;
    assertClearsExtrema(
      palette[token] as string,
      tint,
      opacity,
      slot,
      floor,
      `${label}: ${token}`,
    );
  }
}

function assertForegroundsAA(
  surfaceHex: string,
  palette: ThemePalette,
  label: string,
) {
  for (const fg of TEXT_FGS) {
    expect(
      contrastRatio(palette[fg], surfaceHex),
      `${label}: ${fg} vs composite`,
    ).toBeGreaterThanOrEqual(AA_NORMAL);
  }
  for (const fg of STATUS_FGS) {
    expect(
      contrastRatio(palette[fg], surfaceHex),
      `${label}: ${fg} vs composite`,
    ).toBeGreaterThanOrEqual(AA_LARGE);
  }
}

/**
 * BOTH-EXTREMA + INTERVAL proof (RG-029 / ui-accessibility/AUD-UIA-001 / D-12).
 *
 * The tint is composited over BOTH declared extrema of the asset
 * (`darkestPixel`, `brightestPixel`). For a foreground of luminance Lf over a
 * composite whose luminance spans [Lmin, Lmax]:
 *   - if Lf is OUTSIDE the interval the worst contrast is at the nearer
 *     endpoint, so endpoint checks are exact;
 *   - if Lf is INSIDE the interval (the mid-tone pitfall) some pixel between the
 *     extrema composites to ~Lf and contrast collapses toward 1:1 — endpoint
 *     checks alone would falsely pass. So Lf must lie STRICTLY outside
 *     [Lmin, Lmax]; a luminance equal to an endpoint counts as inside (fails).
 * A ratio exactly equal to the floor passes (`>=`, AA thresholds never lowered).
 */
function evaluateOverExtrema(
  fg: string,
  compositeDark: string,
  compositeBright: string,
) {
  const lf = relativeLuminance(fg);
  const la = relativeLuminance(compositeDark);
  const lb = relativeLuminance(compositeBright);
  const lo = Math.min(la, lb);
  const hi = Math.max(la, lb);
  return {
    ratioDark: contrastRatio(fg, compositeDark),
    ratioBright: contrastRatio(fg, compositeBright),
    outside: lf < lo || lf > hi,
  };
}

function clearsExtrema(
  fg: string,
  compositeDark: string,
  compositeBright: string,
  floor: number,
): boolean {
  const e = evaluateOverExtrema(fg, compositeDark, compositeBright);
  return e.ratioDark >= floor && e.ratioBright >= floor && e.outside;
}

/** The tint composited over a variant's declared darkest and brightest pixels. */
function slotComposites(
  tint: string,
  opacity: number,
  slot: BackgroundVariant,
) {
  return {
    dark: alphaComposite(tint, slot.darkestPixel, opacity),
    bright: alphaComposite(tint, slot.brightestPixel, opacity),
  };
}

function assertClearsExtrema(
  fg: string,
  tint: string,
  opacity: number,
  slot: BackgroundVariant,
  floor: number,
  label: string,
) {
  const { dark, bright } = slotComposites(tint, opacity, slot);
  const e = evaluateOverExtrema(fg, dark, bright);
  expect(
    e.ratioDark,
    `${label}: vs darkest composite ${dark}`,
  ).toBeGreaterThanOrEqual(floor);
  expect(
    e.ratioBright,
    `${label}: vs brightest composite ${bright}`,
  ).toBeGreaterThanOrEqual(floor);
  expect(
    e.outside,
    `${label}: foreground luminance must lie outside the composite interval [${dark}, ${bright}]`,
  ).toBe(true);
}

/**
 * The EFFECTIVE palette the runtime renders on a glass card / chrome over an
 * asset: the same `resolveGlassForegroundPalette` the ThemeProvider feeds to
 * `GlassForegroundScope`, falling back to the root palette where it is inactive.
 */
function effectiveGlassPalette(
  pkg: ThemePackage,
  mode: ResolvedMode,
  accentId: AccentId | null = null,
): ThemePalette {
  const palette = applyAccent(
    resolvePalette(pkg, mode),
    resolveAccent(accentId, pkg, mode),
  );
  return (
    resolveGlassForegroundPalette({
      palette,
      package: pkg,
      mode,
      accentId,
      backgroundIsAsset: true,
    }) ?? palette
  );
}

/**
 * Every curated accent plus the package default (`null`) — accentText is a link
 * tone keyed by accent, so the proof loops all of them (RG-029 / D-24 / D-26).
 */
const ACCENT_CHOICES: readonly (AccentId | null)[] = [null, ...ACCENT_IDS];

function resolveDefaultAccentId(pkg: ThemePackage): AccentId {
  return DEFAULT_ACCENT[pkg];
}

/**
 * accentText (link text, AA_NORMAL) on the EFFECTIVE glass palette for every
 * curated accent. In Standard Light over an asset this is the lightness-only
 * `STANDARD_LIGHT_GLASS_ACCENT_TEXT` variant (owner ruling D-26, which also
 * accepts the sub-12% aurora-teal and emerald variants); elsewhere it is the
 * root accent tone.
 */
function assertAccentTextClearsExtrema(
  pkg: ThemePackage,
  mode: ResolvedMode,
  opacityFor: (pkg: ThemePackage, mode: ResolvedMode) => number,
  treatment: "card" | "chrome",
  slot: BackgroundVariant,
  label: string,
  slotId: BackgroundSlotId,
) {
  for (const accentId of ACCENT_CHOICES) {
    // `null` renders the package default; an exclusion keyed by that default
    // id covers it too.
    const rendered = accentId ?? resolveDefaultAccentId(pkg);
    if (
      isExcluded("accentText", pkg, mode, {
        accentId: rendered,
        treatment,
        slotId,
      })
    ) {
      continue;
    }
    const palette = effectiveGlassPalette(pkg, mode, accentId);
    assertClearsExtrema(
      palette.accentText,
      palette[SURFACE[pkg].tintTokenKey],
      opacityFor(pkg, mode),
      slot,
      AA_NORMAL,
      `${label}: accentText (${accentId ?? "default"})`,
    );
  }
}

/**
 * BARE TEXT on the art (38.5-03; brief §E / H5, dossier P-1). Text with no
 * glass, scrim or opaque backing sits on the BackgroundHost veil: the palette
 * `surface` tint at `backgroundVeilOpacity(pkg, density)` over the art. It is
 * drawn with the ROOT palette (bare text has no glass scope, so never the
 * Standard-Light glass variants). Text and links at AA_NORMAL; status glyphs
 * and `rogue` at AA_LARGE. `accentText` is checked for the package default and
 * every curated accent (ACCENT_CHOICES), because the user picks the accent.
 */
const BARE_FOREGROUNDS: readonly {
  token: keyof ThemePalette;
  floor: number;
}[] = [
  { token: "textPrimary", floor: AA_NORMAL },
  { token: "textSecondary", floor: AA_NORMAL },
  { token: "textPlaceholder", floor: AA_NORMAL },
  { token: "danger", floor: AA_NORMAL },
  { token: "accentText", floor: AA_NORMAL },
  ...STATUS_FGS.map((token) => ({ token, floor: AA_LARGE })),
];

/**
 * PURE bare-text proof: the failure labels for every bare foreground over the
 * veil composited on a background's declared extrema at one density (the
 * both-extrema + interval rule, `evaluateOverExtrema`). Exclusions are matched
 * with `treatment: "bare"` and the caller's `slotId` (absent for the None
 * background). Enforcing tests assert `[]`.
 */
function bareTextFailures(
  pkg: ThemePackage,
  mode: ResolvedMode,
  bounds: Pick<BackgroundVariant, "darkestPixel" | "brightestPixel">,
  density: SurfaceDensity,
  scope: { slotId?: BackgroundSlotId },
): string[] {
  return washTextFailures(
    pkg,
    mode,
    bounds,
    {
      tintOf: (palette) => palette.surface,
      opacity: backgroundVeilOpacity(pkg, density),
      label: `bare @ ${density}`,
    },
    scope,
  );
}

/**
 * Split a `#RRGGBBAA` palette token into its `#RRGGBB` colour and its alpha
 * (AA / 255). `profileBackgroundScrim` carries its alpha in the token, and
 * `BackgroundHost` paints it with no extra `opacity` (readability="profile").
 */
function splitAlphaHex(token: string): { color: string; alpha: number } {
  const match = /^#([0-9A-Fa-f]{6})([0-9A-Fa-f]{2})$/.exec(token);
  if (match === null) {
    throw new Error(`expected #RRGGBBAA, got ${token}`);
  }
  return { color: `#${match[1]}`, alpha: Number.parseInt(match[2], 16) / 255 };
}

/**
 * PURE P-8 proof: the root palette's bare foregrounds over the Profile route's
 * own `profileBackgroundScrim` (colour at its alpha) composited on a
 * background's declared extrema. Profile text is bare text on the art under a
 * heavier wash, so exclusions match with `treatment: "bare"`.
 */
function profileScrimFailures(
  pkg: ThemePackage,
  mode: ResolvedMode,
  bounds: Pick<BackgroundVariant, "darkestPixel" | "brightestPixel">,
  scope: { slotId?: BackgroundSlotId },
): string[] {
  const scrim = splitAlphaHex(resolvePalette(pkg, mode).profileBackgroundScrim);
  return washTextFailures(
    pkg,
    mode,
    bounds,
    { tintOf: () => scrim.color, opacity: scrim.alpha, label: "profile scrim" },
    scope,
  );
}

/**
 * What a wash proof checks and with which palette. Defaults: every bare
 * foreground, the ROOT palette, exclusions matched as `bare`.
 */
interface WashProofOptions {
  foregrounds?: readonly { token: keyof ThemePalette; floor: number }[];
  /** The palette the text renders with, per accent (null = package default). */
  paletteOf?: (accentId: AccentId | null) => ThemePalette;
  treatment?: ProofTreatment;
}

/** Shared body of the bare, profile-scrim and signed-treatment proofs (one wash over the art). */
function washTextFailures(
  pkg: ThemePackage,
  mode: ResolvedMode,
  bounds: Pick<BackgroundVariant, "darkestPixel" | "brightestPixel">,
  wash: {
    tintOf: (palette: ThemePalette) => string;
    opacity: number;
    label: string;
  },
  scope: { slotId?: BackgroundSlotId },
  options: WashProofOptions = {},
): string[] {
  const foregrounds = options.foregrounds ?? BARE_FOREGROUNDS;
  const treatment = options.treatment ?? "bare";
  const paletteOf =
    options.paletteOf ??
    ((accentId: AccentId | null) =>
      applyAccent(
        resolvePalette(pkg, mode),
        resolveAccent(accentId, pkg, mode),
      ));
  const failures: string[] = [];
  const opacity = wash.opacity;
  for (const accentId of ACCENT_CHOICES) {
    const rendered = accentId ?? resolveDefaultAccentId(pkg);
    const palette = paletteOf(accentId);
    const tint = wash.tintOf(palette);
    const dark = alphaComposite(tint, bounds.darkestPixel, opacity);
    const bright = alphaComposite(tint, bounds.brightestPixel, opacity);
    for (const { token, floor } of foregrounds) {
      // Non-accent tokens do not vary with the accent: check them once.
      if (token !== "accentText" && accentId !== null) continue;
      if (
        isExcluded(token, pkg, mode, {
          treatment,
          slotId: scope.slotId,
          accentId: rendered,
        })
      ) {
        continue;
      }
      const fg = palette[token] as string;
      if (!clearsExtrema(fg, dark, bright, floor)) {
        const e = evaluateOverExtrema(fg, dark, bright);
        failures.push(
          `${pkg}/${mode} ${wash.label}${scope.slotId ? ` ${scope.slotId}` : ""}: ${token}${
            token === "accentText" ? ` (${accentId ?? "default"})` : ""
          } ${e.ratioDark.toFixed(2)}/${e.ratioBright.toFixed(2)}:1${
            e.outside ? "" : " inside the composite interval"
          } (floor ${floor})`,
        );
      }
    }
  }
  return failures;
}

describe("both-extrema interval helper — boundary + mid-tone edges (RG-029)", () => {
  it("a ratio exactly equal to the floor passes", () => {
    const exact = contrastRatio("#000000", "#FFFFFF");
    expect(clearsExtrema("#000000", "#FFFFFF", "#FFFFFF", exact)).toBe(true);
  });

  it("a foreground luminance equal to an endpoint counts as inside (fails)", () => {
    const e = evaluateOverExtrema("#808080", "#808080", "#FFFFFF");
    expect(e.outside).toBe(false);
    expect(clearsExtrema("#808080", "#808080", "#FFFFFF", 1)).toBe(false);
  });

  it("a mid-tone foreground passing both endpoints still fails the interval", () => {
    // Both endpoint ratios clear AA_LARGE, but the grey sits between them, so
    // some pixel of the asset composites to ~1:1 against it.
    const e = evaluateOverExtrema("#767676", "#000000", "#FFFFFF");
    expect(e.ratioDark).toBeGreaterThanOrEqual(AA_LARGE);
    expect(e.ratioBright).toBeGreaterThanOrEqual(AA_LARGE);
    expect(clearsExtrema("#767676", "#000000", "#FFFFFF", AA_LARGE)).toBe(
      false,
    );
  });

  it("a foreground darker than the whole interval passes at the nearer endpoint", () => {
    expect(clearsExtrema("#000000", "#999999", "#FFFFFF", AA_NORMAL)).toBe(
      true,
    );
  });
});

describe("alphaComposite — fg-over-bg blend, clamped #RRGGBB", () => {
  it("alpha=1 returns the foreground; alpha=0 returns the background", () => {
    expect(alphaComposite("#123456", "#abcdef", 1)).toBe("#123456");
    expect(alphaComposite("#123456", "#abcdef", 0)).toBe("#abcdef");
  });
  it("blends channel-wise at alpha=0.5", () => {
    expect(alphaComposite("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});

describe("SURFACE tokens — density opacity is monotonic (denser -> more opaque)", () => {
  it("each package's density opacity is non-decreasing across SURFACE_DENSITIES", () => {
    for (const pkg of PACKAGES) {
      let prev = -1;
      for (const density of SURFACE_DENSITIES) {
        const o = surfaceOpacityForDensity(pkg, density);
        expect(o).toBeGreaterThan(0);
        expect(o).toBeLessThanOrEqual(1);
        expect(o).toBeGreaterThanOrEqual(prev);
        prev = o;
      }
      // The densest surface is strictly more opaque than the least dense.
      expect(
        surfaceOpacityForDensity(
          pkg,
          SURFACE_DENSITIES[SURFACE_DENSITIES.length - 1],
        ),
      ).toBeGreaterThan(surfaceOpacityForDensity(pkg, SURFACE_DENSITIES[0]));
    }
  });
});

describe("background-veil visibility floor (31.1-05 — the shipped-bug guard)", () => {
  // Regression guard for the owner production-release failure: the BackgroundHost
  // veil must leave a VISIBLE slice of the selected art at every package/density.
  // The shipped 31.1 reused the card density opacity (0.88–1.00) as a full-screen
  // wash, leaving 0–12% art — every selection looked identical. This fails if any
  // package/density background contribution (1 - veil) regresses below its floor.
  it("each package/density keeps background contribution >= its density floor", () => {
    for (const pkg of PACKAGES) {
      for (const density of SURFACE_DENSITIES) {
        const veil = backgroundVeilOpacity(pkg, density);
        expect(veil, `${pkg}/${density} veil in (0,1)`).toBeGreaterThan(0);
        expect(veil, `${pkg}/${density} veil in (0,1)`).toBeLessThan(1);
        const contribution = 1 - veil;
        expect(
          contribution,
          `${pkg}/${density}: only ${(contribution * 100).toFixed(0)}% art visible (floor ${MIN_BACKGROUND_CONTRIBUTION[density]})`,
        ).toBeGreaterThanOrEqual(MIN_BACKGROUND_CONTRIBUTION[density]);
      }
    }
  });

  it("the veil is strictly lighter than the card surface opacity it replaced", () => {
    // The whole fix: the host veil is DECOUPLED from and lighter than the card
    // density opacity, so lightening the veil never silently tracks card opacity.
    for (const pkg of PACKAGES) {
      for (const density of SURFACE_DENSITIES) {
        expect(
          backgroundVeilOpacity(pkg, density),
          `${pkg}/${density}: veil must be lighter than card surface opacity`,
        ).toBeLessThan(surfaceOpacityForDensity(pkg, density));
      }
    }
  });

  it("veil opacity is monotonic non-decreasing (denser -> more veil -> less art)", () => {
    for (const pkg of PACKAGES) {
      let prev = -1;
      for (const density of SURFACE_DENSITIES) {
        const veil = BACKGROUND_VEIL_OPACITY[pkg][density];
        expect(veil).toBeGreaterThanOrEqual(prev);
        prev = veil;
      }
    }
  });
});

describe("live-glass opacity-ordering guard (REVIEWS 23-06 MEDIUM)", () => {
  it("liveGlassTintOpacity >= fallbackTintOpacity per package (live never more translucent)", () => {
    for (const pkg of PACKAGES) {
      expect(SURFACE[pkg].liveGlassTintOpacity).toBeGreaterThanOrEqual(
        SURFACE[pkg].fallbackTintOpacity,
      );
    }
  });

  it("liveGlassTintOpacity equals the least-dense (worst-case, most translucent) density opacity", () => {
    for (const pkg of PACKAGES) {
      expect(SURFACE[pkg].liveGlassTintOpacity).toBe(
        surfaceOpacityForDensity(pkg, SURFACE_DENSITIES[0]),
      );
    }
  });
});

describe("glass-composite AA — Plan 03 handoff over the tinted FALLBACK surface", () => {
  // text/status foregrounds over the semi-opaque tinted fallback surface token
  // (tint over the palette background at fallbackTintOpacity) meet AA-equivalent
  // contrast in all four palettes (the guaranteed-readable blur-unavailable path).
  for (const pkg of PACKAGES) {
    for (const mode of MODES) {
      it(`${pkg}/${mode}: foregrounds over the fallback tinted surface meet AA`, () => {
        const palette = resolvePalette(pkg, mode);
        const tint = palette[SURFACE[pkg].tintTokenKey];
        const fallbackSurface = alphaComposite(
          tint,
          palette.background,
          SURFACE[pkg].fallbackTintOpacity,
        );
        assertForegroundsAA(
          fallbackSurface,
          palette,
          `${pkg}/${mode} fallback`,
        );
      });
    }
  }
});

describe("COMPOSITED per-asset card AA — the ACTUAL mode-aware card tint (31.1-06)", () => {
  // Every text/status foreground composited over
  //   alphaComposite(card tint @ cardTintOpacity(pkg, mode, presentation), asset)
  // meets AA per asset/package/mode. This proves BOTH regimes: the GLASSY matched
  // regime (galaxy↔dark, standard↔light — light/dark text over a matched-tone art)
  // AND the OPAQUE mismatched regime (galaxy-in-light, standard-in-dark — card falls
  // back opaque so text stays readable). Presentation is the most translucent
  // (worst-case) density.
  //
  // RG-029 (ui-accessibility/AUD-UIA-001 / D-12): text foregrounds are checked
  // over BOTH declared extrema (darkestPixel + brightestPixel) with the interval
  // test, on the EFFECTIVE glass palette the runtime scope renders. The declared
  // extrema are validated against the decoded .webp bytes by
  // `scripts/measure-background-extrema.py --check`.
  //
  // 38.5 D-23 / P-2: each slot's VARIANT is proven in its OWN mode only
  // (`slot.variants[mode]`) — the light file is never rendered in dark mode and
  // vice-versa. Labels read `slot/mode`.
  for (const [id, entry] of Object.entries(BACKGROUND_SLOTS)) {
    const pkg = entry.package;
    const slotId = id as BackgroundSlotId;
    for (const mode of MODES) {
      const slot = entry.variants[mode];
      const regime = cardMatchesMode(pkg, mode) ? "glassy" : "opaque";
      it(`${id}/${mode} @ ${pkg}/${mode} (${regime}): text foregrounds over the card clear both extrema`, () => {
        const palette = effectiveGlassPalette(pkg, mode);
        const tint = palette[SURFACE[pkg].tintTokenKey];
        const opacity = cardTintOpacity(pkg, mode, "presentation");
        for (const fg of TEXT_FGS) {
          if (isExcluded(fg, pkg, mode, { treatment: "card", slotId })) {
            continue;
          }
          assertClearsExtrema(
            palette[fg],
            tint,
            opacity,
            slot,
            AA_NORMAL,
            `${id}/${mode} @ ${pkg}/${mode} ${regime} card: ${fg}`,
          );
        }
      });

      it(`${id}/${mode} @ ${pkg}/${mode} (${regime}): status/rogue/danger over the card clear both extrema (RG-029 / D-24)`, () => {
        const palette = effectiveGlassPalette(pkg, mode);
        assertNonTextClearsExtrema(
          palette,
          pkg,
          mode,
          palette[SURFACE[pkg].tintTokenKey],
          cardTintOpacity(pkg, mode, "presentation"),
          slot,
          `${id}/${mode} @ ${pkg}/${mode} ${regime} card`,
          { treatment: "card", slotId },
        );
      });

      it(`${id}/${mode} @ ${pkg}/${mode} (${regime}): accentText for every curated accent over the card clears both extrema (RG-029 / D-24 / D-26)`, () => {
        assertAccentTextClearsExtrema(
          pkg,
          mode,
          (p, m) => cardTintOpacity(p, m, "presentation"),
          "card",
          slot,
          `${id}/${mode} @ ${pkg}/${mode} ${regime} card`,
          slotId,
        );
      });
    }
  }
});

describe("orrery-overlay treatment — AA over the raw brightest Orrery pixel (38.1-01)", () => {
  // Conservative lower-bound model: the tint is composited over the RAW brightest
  // Orrery pixel with no BlurView contribution. Where GlassSurface renders a real
  // BlurView, it averages/dims the backdrop; on the no-blur path this raw model is
  // exact. The on-device composite is therefore never brighter and is at least as
  // legible as this proof.
  for (const pkg of PACKAGES) {
    for (const mode of MODES) {
      it(`${pkg}/${mode}: foregrounds over the Orrery overlay meet AA and retain backdrop visibility`, () => {
        const palette = resolvePalette(pkg, mode);
        const brightestOrreryPixel = [
          palette.textPrimary,
          ...palette.starPalette,
        ].reduce((brightest, candidate) =>
          contrastRatio("#000000", candidate) >
          contrastRatio("#000000", brightest)
            ? candidate
            : brightest,
        );
        const opacity = orreryOverlayTintOpacity(pkg, mode);
        const composite = alphaComposite(
          palette[SURFACE[pkg].tintTokenKey],
          brightestOrreryPixel,
          opacity,
        );

        assertForegroundsAA(
          composite,
          palette,
          `${pkg}/${mode} Orrery overlay`,
        );
        expect(
          opacity,
          `${pkg}/${mode}: overlay remains translucent`,
        ).toBeLessThan(surfaceOpacityForDensity(pkg, "dense"));
        expect(
          opacity,
          `${pkg}/${mode}: overlay preserves a visible Orrery backdrop`,
        ).toBeLessThanOrEqual(ORRERY_OVERLAY_BACKDROP_VISIBILITY_CEILING);
      });
    }
  }

  it("does not retune the shared ordinary-card glass constants", () => {
    expect(CARD_GLASS_OPACITY.galaxy).toBe(0.05);
    expect(CARD_GLASS_OPACITY.standard).toBe(0.5);
  });
});

describe("mode-aware card glass model (31.1-06)", () => {
  it("cardMatchesMode: galaxy↔dark and standard↔light are the glassy (matched) regimes", () => {
    expect(cardMatchesMode("galaxy", "dark")).toBe(true);
    expect(cardMatchesMode("galaxy", "light")).toBe(false);
    expect(cardMatchesMode("standard", "light")).toBe(true);
    expect(cardMatchesMode("standard", "dark")).toBe(false);
  });

  it("the matched-regime glass opacity is genuinely lighter than the opaque band", () => {
    for (const pkg of PACKAGES) {
      expect(CARD_GLASS_OPACITY[pkg]).toBeGreaterThan(0);
      // Glassy cards let the background show through — strictly lighter than the
      // most translucent step of the opaque (mismatched) band.
      expect(CARD_GLASS_OPACITY[pkg]).toBeLessThan(
        surfaceOpacityForDensity(pkg, SURFACE_DENSITIES[0]),
      );
    }
  });

  it("cardTintOpacity returns the glass value when matched, the opaque band when not", () => {
    for (const pkg of PACKAGES) {
      for (const mode of MODES) {
        for (const density of SURFACE_DENSITIES) {
          const o = cardTintOpacity(pkg, mode, density);
          expect(o).toBe(
            cardMatchesMode(pkg, mode)
              ? CARD_GLASS_OPACITY[pkg]
              : surfaceOpacityForDensity(pkg, density),
          );
        }
      }
    }
  });
});

describe("chrome-scrim AA (31.1-05 — bare-on-background text stays readable)", () => {
  // Bare chrome (app bar, dashboard count, section headings, empty states) does
  // NOT sit on a GlassSurface card. With the veil lightened it would sit on raw
  // art, so a LOCAL chrome scrim (surface tint @ chromeScrimOpacity) backs it.
  // Every text/status foreground over that scrim composited on each asset's
  // brightest pixel must meet AA — the guarantee that "protect chrome" preserves
  // readability while the veil reveals the art. Each slot's variant is proven in
  // its OWN mode only (38.5 D-23 / P-2).
  for (const [id, entry] of Object.entries(BACKGROUND_SLOTS)) {
    const pkg = entry.package;
    const slotId = id as BackgroundSlotId;
    for (const mode of MODES) {
      const slot = entry.variants[mode];
      it(`${id}/${mode} @ ${pkg}/${mode}: text foregrounds over the chrome scrim clear both extrema (RG-029)`, () => {
        const palette = effectiveGlassPalette(pkg, mode);
        const tint = palette[SURFACE[pkg].tintTokenKey];
        const opacity = chromeScrimOpacity(pkg, mode);
        for (const fg of TEXT_FGS) {
          if (isExcluded(fg, pkg, mode, { treatment: "chrome", slotId })) {
            continue;
          }
          assertClearsExtrema(
            palette[fg],
            tint,
            opacity,
            slot,
            AA_NORMAL,
            `${id}/${mode} @ ${pkg}/${mode} chrome: ${fg}`,
          );
        }
      });

      it(`${id}/${mode} @ ${pkg}/${mode}: status/rogue/danger over the chrome scrim clear both extrema (RG-029 / D-24)`, () => {
        const palette = effectiveGlassPalette(pkg, mode);
        assertNonTextClearsExtrema(
          palette,
          pkg,
          mode,
          palette[SURFACE[pkg].tintTokenKey],
          chromeScrimOpacity(pkg, mode),
          slot,
          `${id}/${mode} @ ${pkg}/${mode} chrome`,
          { treatment: "chrome", slotId },
        );
      });

      it(`${id}/${mode} @ ${pkg}/${mode}: accentText for every curated accent over the chrome scrim clears both extrema (RG-029 / D-24 / D-26)`, () => {
        assertAccentTextClearsExtrema(
          pkg,
          mode,
          chromeScrimOpacity,
          "chrome",
          slot,
          `${id}/${mode} @ ${pkg}/${mode} chrome`,
          slotId,
        );
      });
    }
  }

  it("chrome goes glassy in the matched regime and opaque when mismatched (mirrors cards)", () => {
    for (const pkg of PACKAGES) {
      for (const mode of MODES) {
        // Chrome reuses the densest card step for a little extra bare-text backing.
        expect(chromeScrimOpacity(pkg, mode)).toBe(
          cardTintOpacity(pkg, mode, "dense"),
        );
      }
    }
  });
});

describe("surface-token-only selector guard (cycle-3 LOW, finding #4)", () => {
  it("resolveSurfaceStyle returns ONLY declared SURFACE token fields (no ad-hoc literal)", () => {
    for (const pkg of PACKAGES) {
      for (const blurAvailable of [true, false]) {
        const style = resolveSurfaceStyle(pkg, blurAvailable);
        // Colour fields are palette-token KEYS drawn from the declared set.
        expect(SURFACE_COLOR_TOKEN_KEYS).toContain(style.tintTokenKey);
        expect(SURFACE_COLOR_TOKEN_KEYS).toContain(style.borderTokenKey);
        if (style.glowTokenKey !== null) {
          expect(SURFACE_COLOR_TOKEN_KEYS).toContain(style.glowTokenKey);
        }
        // Opacity fields are members of the package's declared opacity set.
        const declaredOpacities = new Set<number>([
          ...SURFACE_DENSITIES.map((d) => surfaceOpacityForDensity(pkg, d)),
          SURFACE[pkg].liveGlassTintOpacity,
          SURFACE[pkg].fallbackTintOpacity,
        ]);
        expect(declaredOpacities.has(style.liveGlassTintOpacity)).toBe(true);
        expect(declaredOpacities.has(style.fallbackTintOpacity)).toBe(true);
        // Flags mirror the declared token set.
        expect(style.glass).toBe(SURFACE[pkg].glass);
        expect(style.useBlur).toBe(SURFACE[pkg].glass && blurAvailable);
      }
    }
  });

  it("galaxy is glass-forward (glow token present); standard is flat (no glow)", () => {
    expect(resolveSurfaceStyle("galaxy", true).glass).toBe(true);
    expect(resolveSurfaceStyle("galaxy", true).glowTokenKey).not.toBeNull();
    expect(resolveSurfaceStyle("standard", true).glass).toBe(false);
    expect(resolveSurfaceStyle("standard", true).glowTokenKey).toBeNull();
    // Standard never blurs even when blur is available (flat treatment).
    expect(resolveSurfaceStyle("standard", true).useBlur).toBe(false);
    // Galaxy blurs only where affordable.
    expect(resolveSurfaceStyle("galaxy", false).useBlur).toBe(false);
    expect(resolveSurfaceStyle("galaxy", true).useBlur).toBe(true);
  });
});

describe("background-extrema regime table sync guard (RG-029 / D-12; 38.5 P-1/P-2)", () => {
  // scripts/measure-background-extrema.py validates the declared extrema under
  // the tint regimes in scripts/background-extrema-regimes.json. That table must
  // equal exactly the (package, mode, treatment, density, tint, opacity) tuples
  // the card, chrome and bare-text (BackgroundHost veil, every density) proofs
  // composite, or the script would validate a proof that no longer exists. A new
  // regime enters bound, proof and decoder together (38.5-03).
  interface Regime {
    package: ThemePackage;
    mode: ResolvedMode;
    treatment:
      | "card"
      | "chrome"
      | "veil"
      | "profile"
      | "listEntry"
      | "cardEntry"
      | "artChrome";
    /** veil rows only: the BackgroundHost content density. */
    density?: SurfaceDensity;
    tint: string;
    opacity: number;
  }

  function tsRegimes(): Regime[] {
    const packages = [
      ...new Set(Object.values(BACKGROUND_SLOTS).map((slot) => slot.package)),
    ];
    const out: Regime[] = [];
    for (const pkg of packages) {
      for (const mode of MODES) {
        const tint = resolvePalette(pkg, mode)[SURFACE[pkg].tintTokenKey];
        out.push({
          package: pkg,
          mode,
          treatment: "card",
          tint,
          opacity: cardTintOpacity(pkg, mode, "presentation"),
        });
        out.push({
          package: pkg,
          mode,
          treatment: "chrome",
          tint,
          opacity: chromeScrimOpacity(pkg, mode),
        });
        // Bare text sits on the BackgroundHost veil: palette.surface at the
        // density's veil opacity (the bare-text proof's regime).
        for (const density of SURFACE_DENSITIES) {
          out.push({
            package: pkg,
            mode,
            treatment: "veil",
            density,
            tint: resolvePalette(pkg, mode).surface,
            opacity: backgroundVeilOpacity(pkg, density),
          });
        }
        // The Profile route's own scrim over the art (38.5 P-8 / M-3): the
        // `profileBackgroundScrim` colour at its alpha byte / 255.
        const scrim = splitAlphaHex(
          resolvePalette(pkg, mode).profileBackgroundScrim,
        );
        out.push({
          package: pkg,
          mode,
          treatment: "profile",
          tint: scrim.color,
          opacity: scrim.alpha,
        });
        // The signed see-through backings of the table-driven components
        // (38.5-08): palette.surface at each signed level, one row per group
        // with a signed (non-null) value.
        for (const group of ART_OPACITY_GROUPS) {
          const opacity = ART_SEE_THROUGH_OPACITY[pkg][mode][group];
          if (opacity === null) continue;
          out.push({ package: pkg, mode, treatment: group, tint, opacity });
        }
      }
    }
    return out;
  }

  function sameRegime(a: Regime, b: Regime): boolean {
    return (
      a.package === b.package &&
      a.mode === b.mode &&
      a.treatment === b.treatment &&
      a.density === b.density &&
      a.tint.toLowerCase() === b.tint.toLowerCase() &&
      Math.abs(a.opacity - b.opacity) <= 1e-9
    );
  }

  function label(r: Regime): string {
    return `${r.package}/${r.mode}/${r.treatment}${r.density ? `/${r.density}` : ""} ${r.tint}@${r.opacity}`;
  }

  it("the script's regime table equals the card + chrome + veil + profile + signed art-treatment proof tuples exactly", () => {
    const table = JSON.parse(
      readFileSync("scripts/background-extrema-regimes.json", "utf8"),
    ) as { regimes: Regime[] };
    const ts = tsRegimes();
    // 24 base rows + one per signed see-through group (11 in the v3 answer).
    const signedGroups = PACKAGES.flatMap((pkg) =>
      MODES.flatMap((mode) =>
        ART_OPACITY_GROUPS.filter(
          (group) => ART_SEE_THROUGH_OPACITY[pkg][mode][group] !== null,
        ),
      ),
    ).length;
    expect(signedGroups).toBe(11);
    expect(ts.length).toBe(24 + signedGroups);
    expect(ts.filter((r) => r.treatment === "profile").length).toBe(4);
    expect(
      ts.filter((r) =>
        (ART_OPACITY_GROUPS as readonly string[]).includes(r.treatment),
      ).length,
    ).toBe(signedGroups);
    expect(table.regimes.length).toBe(ts.length);
    for (const want of ts) {
      expect(
        table.regimes.some((got) => sameRegime(got, want)),
        `missing regime ${label(want)}`,
      ).toBe(true);
    }
    for (const got of table.regimes) {
      expect(
        ts.some((want) => sameRegime(got, want)),
        `stale regime ${label(got)}`,
      ).toBe(true);
    }
  });
});

describe("proof exclusions are written down against the committed inventory (D-24)", () => {
  const inventoryOf = (e: ProofExclusion) => e.inventoryPath ?? RG029_INVENTORY;

  it("every exclusion carries a justification and an inventory row that exists in its own inventory", () => {
    expect(PROOF_EXCLUSIONS.length).toBeGreaterThan(0);
    for (const e of PROOF_EXCLUSIONS) {
      expect(e.justification.trim().length, e.token).toBeGreaterThan(40);
      expect(
        e.treatment.length,
        `${e.inventoryRef}: treatment`,
      ).toBeGreaterThan(0);
      const inventory = readFileSync(inventoryOf(e), "utf8");
      expect(
        inventory.includes(`**${e.inventoryRef}**`),
        `${e.token}: inventory row ${e.inventoryRef} missing from ${inventoryOf(e)}`,
      ).toBe(true);
    }
  });

  it("the only ACCEPTED non-Standard-Light exclusions are the ADR-084 Galaxy Dark danger limitation or owner-signed variant allowances", () => {
    const scopedAccepted = PROOF_EXCLUSIONS.filter(
      (e) =>
        e.status === "accepted" &&
        (e.package !== undefined || e.mode !== undefined),
    );
    expect(scopedAccepted.length).toBeGreaterThan(0);
    for (const e of scopedAccepted) {
      const adr084GalaxyDarkDanger =
        e.token === "danger" &&
        e.package === "galaxy" &&
        e.mode === "dark" &&
        e.slotId === undefined &&
        e.accentId === undefined;
      const signedVariantAllowance =
        e.slotId !== undefined && e.inventoryPath === ART_SIGNOFF;
      expect(
        adr084GalaxyDarkDanger || signedVariantAllowance,
        `${e.inventoryRef}: not an accepted exclusion shape`,
      ).toBe(true);
    }
  });

  it("E-7 is resolved (owner ruling D-28): Galaxy Light coral accentText is asserted in every regime, not excluded", () => {
    for (const treatment of ["card", "chrome", "bare"] as const) {
      expect(
        isExcluded("accentText", "galaxy", "light", {
          accentId: "coral",
          treatment,
        }),
        `galaxy/light coral ${treatment}`,
      ).toBe(false);
    }
    expect(PROOF_EXCLUSIONS.some((e) => e.inventoryRef === "E-7")).toBe(false);
  });

  it("every held-for-owner exclusion is fully scoped and named as an open owner question in the inventory", () => {
    const held = PROOF_EXCLUSIONS.filter((e) => e.status === "held-for-owner");
    for (const e of held) {
      // Held items may never blanket-exclude a token: package, mode and (for
      // accentText) the accent must all be named.
      expect(e.package, e.inventoryRef).toBeDefined();
      expect(e.mode, e.inventoryRef).toBeDefined();
      if (e.token === "accentText") {
        expect(e.accentId, e.inventoryRef).toBeDefined();
      }
      const inventory = readFileSync(inventoryOf(e), "utf8");
      expect(
        inventory.includes(`**${e.inventoryRef}** — HELD for the owner`),
        `${e.inventoryRef}: inventory must mark it HELD for the owner`,
      ).toBe(true);
    }
  });
});

describe("exclusions are scoped by treatment and variant (38.5-03; D-24, C3-L2)", () => {
  const BARE_INVENTORY = BARE_TEXT_INVENTORY;

  function d24Result(): string {
    const lines = readFileSync(BARE_INVENTORY, "utf8")
      .split("\n")
      .filter((l) => /^D24_RESULT: (extend|strict|owner-question)$/.test(l));
    expect(lines.length, "exactly one D24_RESULT line").toBe(1);
    return lines[0].slice("D24_RESULT: ".length);
  }

  it("E-1 (Galaxy Dark danger) covers the card and chrome treatments", () => {
    for (const treatment of ["card", "chrome"] as const) {
      expect(isExcluded("danger", "galaxy", "dark", { treatment })).toBe(true);
    }
    const e1 = PROOF_EXCLUSIONS.find((e) => e.inventoryRef === "E-1");
    expect(e1?.treatment).toEqual(["card", "chrome"]);
  });

  it("bare danger in Galaxy Dark is excluded if and only if D24_RESULT is extend (E-1-bare)", () => {
    const extend = d24Result() === "extend";
    expect(isExcluded("danger", "galaxy", "dark", { treatment: "bare" })).toBe(
      extend,
    );
    const bare = PROOF_EXCLUSIONS.filter((e) => e.inventoryRef === "E-1-bare");
    expect(bare.length).toBe(extend ? 1 : 0);
    if (extend) {
      expect(bare[0]).toEqual(
        expect.objectContaining({
          token: "danger",
          package: "galaxy",
          mode: "dark",
          treatment: ["bare"],
          status: "accepted",
          inventoryPath: BARE_INVENTORY,
        }),
      );
    }
    // No entry leaks bare scope to any other token.
    for (const e of PROOF_EXCLUSIONS) {
      if (e.treatment.includes("bare") && e.slotId === undefined) {
        expect(e.inventoryRef).toBe("E-1-bare");
      }
    }
  });

  it("a slot-scoped entry matches only a call for the same slot (C3-L2)", () => {
    const entry: ProofExclusion = {
      token: "textSecondary",
      package: "galaxy",
      mode: "dark",
      treatment: ["bare"],
      slotId: "galaxy-aurora",
      status: "accepted",
      justification: "test-local fixture entry, never in PROOF_EXCLUSIONS",
      inventoryRef: "X-1",
      inventoryPath: ART_SIGNOFF,
    };
    const at = (slotId?: BackgroundSlotId) =>
      matchesExclusion(entry, "textSecondary", "galaxy", "dark", {
        treatment: "bare",
        slotId,
      });
    expect(at("galaxy-aurora")).toBe(true);
    expect(at("galaxy-starfield")).toBe(false);
    expect(at(undefined)).toBe(false);
    expect(
      matchesExclusion(entry, "textSecondary", "galaxy", "dark", {
        treatment: "card",
        slotId: "galaxy-aurora",
      }),
    ).toBe(false);
  });
});

describe("bare-text proof harness (38.5-03; brief H5, P-1)", () => {
  const PAIRS: readonly [ThemePackage, ResolvedMode][] = [
    ["galaxy", "dark"],
    ["galaxy", "light"],
    ["standard", "dark"],
    ["standard", "light"],
  ];
  const IN_BAND: Record<
    string,
    { darkestPixel: string; brightestPixel: string }
  > = {
    "galaxy/dark": { darkestPixel: "#0A0A0A", brightestPixel: "#101010" },
    "galaxy/light": { darkestPixel: "#E8E8E8", brightestPixel: "#FFFFFF" },
    "standard/dark": { darkestPixel: "#101010", brightestPixel: "#202020" },
    "standard/light": { darkestPixel: "#E8E8E8", brightestPixel: "#FFFFFF" },
  };

  it("the bare foreground set is the root palette's text at 4.5 and glyphs at 3.0", () => {
    expect(BARE_FOREGROUNDS).toEqual([
      { token: "textPrimary", floor: AA_NORMAL },
      { token: "textSecondary", floor: AA_NORMAL },
      { token: "textPlaceholder", floor: AA_NORMAL },
      { token: "danger", floor: AA_NORMAL },
      { token: "accentText", floor: AA_NORMAL },
      { token: "statusStable", floor: AA_LARGE },
      { token: "statusWobble", floor: AA_LARGE },
      { token: "statusDecay", floor: AA_LARGE },
      { token: "rogue", floor: AA_LARGE },
    ]);
  });

  for (const [pkg, mode] of PAIRS) {
    it(`${pkg}/${mode}: an in-band synthetic background passes at every density`, () => {
      for (const density of SURFACE_DENSITIES) {
        expect(
          bareTextFailures(pkg, mode, IN_BAND[`${pkg}/${mode}`], density, {}),
        ).toEqual([]);
      }
    });

    it(`${pkg}/${mode}: a mid-grey #777777 background fails`, () => {
      const grey = { darkestPixel: "#777777", brightestPixel: "#777777" };
      expect(
        bareTextFailures(pkg, mode, grey, "presentation", {}).length,
      ).toBeGreaterThan(0);
    });

    it(`${pkg}/${mode}: bare text over the None (solid) background clears every floor at every density, for every accent`, () => {
      const background = resolvePalette(pkg, mode).background;
      for (const density of SURFACE_DENSITIES) {
        expect(
          bareTextFailures(
            pkg,
            mode,
            { darkestPixel: background, brightestPixel: background },
            density,
            {},
          ),
          `${pkg}/${mode} none @ ${density}`,
        ).toEqual([]);
      }
    });
  }
});

describe("PROOF_EXCLUSIONS ⇄ 38.5-ART-SIGNOFF.md exclusion block (H-2 / C2-M2)", () => {
  it("the variant-scoped entries equal expand(block.exclusions) exactly (count, fields, order)", () => {
    const scoped = PROOF_EXCLUSIONS.filter((e) => e.slotId !== undefined);
    expect(scoped).toEqual(
      expandSignedExclusions(ART_SIGNOFF_BLOCK.exclusions),
    );
    // The 38.5-04 sign-off recorded no exclusion, so today there are none.
    expect(ART_SIGNOFF_BLOCK.exclusions.length).toBe(0);
    expect(scoped.length).toBe(0);
  });

  it("expansion is one entry per token element, mapped deterministically (fixture)", () => {
    const records: SignedExclusionRecord[] = [
      {
        id: "X-1",
        slotId: "galaxy-aurora",
        mode: "dark",
        tokens: ["textSecondary", "accentText", "accentText:coral"],
        treatments: ["bare"],
        region: { x: 0, y: 0, w: 10, h: 10 },
        reason: "ribbon",
        ownerApproved: "2026-09-28",
      },
      {
        id: "X-2",
        slotId: "standard-paper",
        mode: "light",
        tokens: ["statusDecay"],
        treatments: ["card", "chrome"],
        feature: "fibre",
        reason: "paper fibre",
        ownerApproved: "2026-09-29",
      },
    ];
    const out = expandSignedExclusions(records);
    expect(out.length).toBe(4);
    expect(out[0]).toEqual({
      token: "textSecondary",
      mode: "dark",
      treatment: ["bare"],
      slotId: "galaxy-aurora",
      status: "accepted",
      justification:
        "ribbon [X-1: galaxy-aurora dark, owner-approved 2026-09-28]",
      inventoryRef: "X-1",
      inventoryPath: ART_SIGNOFF,
    });
    expect(out[1].token).toBe("accentText");
    expect(out[1].accentId).toBeUndefined();
    expect(out[2]).toEqual(
      expect.objectContaining({ token: "accentText", accentId: "coral" }),
    );
    expect(out[3]).toEqual(
      expect.objectContaining({
        token: "statusDecay",
        mode: "light",
        slotId: "standard-paper",
        treatment: ["card", "chrome"],
        inventoryRef: "X-2",
      }),
    );
    for (const e of out) {
      expect(e.package).toBeUndefined();
      expect(e.justification.length).toBeGreaterThan(40);
    }
  });
});

/** Every shipped variant, each in its own mode (38.5 P-2). */
const SHIPPED_VARIANTS = Object.entries(BACKGROUND_SLOTS).flatMap(
  ([slotId, slot]) =>
    MODES.map((mode) => ({
      slotId: slotId as BackgroundSlotId,
      pkg: slot.package,
      mode,
      variant: slot.variants[mode],
    })),
);

describe("BARE text on the shipped art over the BackgroundHost veil (38.5 P-1 / brief H5)", () => {
  it("covers every shipped variant (12 = 6 slots x 2 modes)", () => {
    expect(SHIPPED_VARIANTS.length).toBe(12);
  });

  for (const { slotId, pkg, mode, variant } of SHIPPED_VARIANTS) {
    for (const density of SURFACE_DENSITIES) {
      it(`${slotId}/${mode} @ ${density}: every bare foreground clears its floor for the default and all 8 accents`, () => {
        expect(
          bareTextFailures(pkg, mode, variant, density, { slotId }),
        ).toEqual([]);
      });
    }
  }
});

describe("Profile scrim over the shipped art (P-8)", () => {
  it("splits the #RRGGBBAA scrim token into colour and alpha", () => {
    expect(splitAlphaHex("#0B0E1AB8")).toEqual({
      color: "#0B0E1A",
      alpha: 184 / 255,
    });
    expect(() => splitAlphaHex("#0B0E1A")).toThrow();
  });

  it("a mid-grey background under the profile scrim is not trivially passing (fixture)", () => {
    // Guards the harness: a wash that ignored the art would pass everything.
    const white = { darkestPixel: "#FFFFFF", brightestPixel: "#FFFFFF" };
    expect(
      profileScrimFailures("galaxy", "dark", white, {}).length,
    ).toBeGreaterThan(0);
  });

  for (const { slotId, pkg, mode, variant } of SHIPPED_VARIANTS) {
    it(`${slotId}/${mode}: the root palette's bare foregrounds clear their floors over profileBackgroundScrim`, () => {
      expect(profileScrimFailures(pkg, mode, variant, { slotId })).toEqual([]);
    });
  }
});

/**
 * SIGNED ART TREATMENTS (38.5-08; D-08..D-10, D-36, D-37, D-44; P-11).
 *
 * Every cell of the production table whose backing is `seeThrough` or `none`,
 * for the five table-driven components, is proven over the shipped art of that
 * combination: the variant of its slot in its own mode, or the solid background
 * colour for None.
 *   - `seeThrough`: the palette `surface` tint at the SIGNED level
 *     (`ART_SEE_THROUGH_OPACITY`) composited on the declared extrema, with the
 *     both-extrema + interval rule. The palette is the one the component renders
 *     with: every see-through backing scopes its content in
 *     `GlassForegroundScope`, so the effective glass palette (Standard Light over
 *     an asset), else the root palette (the glass override is inactive over
 *     None). Exclusions match the group's treatment name.
 *   - `none`: the content is unscoped (root palette) and sits on the
 *     BackgroundHost veil, so the bare (veil) model at every density, with
 *     exclusions matched as `bare`.
 * The foregrounds are the ones each component actually paints (read from the
 * component sources, 38.5-08 Task 2). The signed v3 answer flags no inverse cell
 * (D-44), so the proof requires every cell to be `mode`; an inverse cell would
 * need the inverse palette in this proof first.
 */
type TableDrivenComponent = (typeof TABLE_DRIVEN_COMPONENTS)[number];

/** Contact entries: `ListRow` / `GridCard` text, links and status glyphs. */
const CONTACT_ENTRY_FOREGROUNDS: readonly {
  token: keyof ThemePalette;
  floor: number;
}[] = [
  // Name and the highlighted search snippet.
  { token: "textPrimary", floor: AA_NORMAL },
  // Recency / meta / search explanation / snippet / line three, and the
  // default favourite and select icons.
  { token: "textSecondary", floor: AA_NORMAL },
  // The active favourite and select icons (link tone, every accent).
  { token: "accentText", floor: AA_NORMAL },
  // The status ring and the StatusGlyph.
  ...STATUS_FGS.map((token) => ({ token, floor: AA_LARGE })),
];

/**
 * The foregrounds each table-driven component paints on its backing. Not
 * included, with the reason: the ListRow category chip and the Avatar (opaque
 * fills of their own; the chip reads the root palette, C2-L4); the neutral
 * `border` ring and glyph of a never-contacted or snoozed contact (decorative,
 * the state is also a text label; not in any glass proof set). No table-driven
 * component renders `danger`, so E-1 is not extended to the art treatments.
 */
const TABLE_DRIVEN_FOREGROUNDS: Record<
  TableDrivenComponent,
  readonly { token: keyof ThemePalette; floor: number }[]
> = {
  contactsListEntries: CONTACT_ENTRY_FOREGROUNDS,
  contactsCardEntries: CONTACT_ENTRY_FOREGROUNDS,
  // HomeScreen's "N contacts" label reads scoped.textSecondary.
  contactsCountLabel: [{ token: "textSecondary", floor: AA_NORMAL }],
  // ShellAppBar: the title (textPrimary) and the ⋯ glyph (OverflowMenu,
  // textSecondary). The Contacts bar has no Back and no trailing content.
  contactsHeader: [
    { token: "textPrimary", floor: AA_NORMAL },
    { token: "textSecondary", floor: AA_NORMAL },
  ],
  // ShellAppBar: the "Digest" title only.
  digestHeader: [{ token: "textPrimary", floor: AA_NORMAL }],
};

/** The shipped background a combination renders: its own-mode variant, or the solid colour for None. */
function combinationBackground(
  pkg: ThemePackage,
  mode: ResolvedMode,
  bgKey: string,
): {
  bounds: Pick<BackgroundVariant, "darkestPixel" | "brightestPixel">;
  slotId?: BackgroundSlotId;
} {
  if (bgKey === NONE_SLOT_ID) {
    const solid = resolvePalette(pkg, mode).background;
    return { bounds: { darkestPixel: solid, brightestPixel: solid } };
  }
  const slotId = `${pkg}-${bgKey}` as keyof typeof BACKGROUND_SLOTS;
  return { bounds: BACKGROUND_SLOTS[slotId].variants[mode], slotId };
}

/** The palette a scoped see-through backing renders with, per accent. */
function scopedPaletteOf(
  pkg: ThemePackage,
  mode: ResolvedMode,
  backgroundIsAsset: boolean,
) {
  return (accentId: AccentId | null): ThemePalette => {
    const palette = applyAccent(
      resolvePalette(pkg, mode),
      resolveAccent(accentId, pkg, mode),
    );
    return (
      resolveGlassForegroundPalette({
        palette,
        package: pkg,
        mode,
        accentId,
        backgroundIsAsset,
      }) ?? palette
    );
  };
}

/**
 * PURE: the failure labels of one table-driven cell over the given background
 * bounds. `[]` = proven. Throws on an inverse cell (no inverse palette exists)
 * and on a see-through cell with an unsigned level.
 */
function signedTreatmentFailures(
  pkg: ThemePackage,
  mode: ResolvedMode,
  component: TableDrivenComponent,
  backing: "seeThrough" | "none",
  background: {
    bounds: Pick<BackgroundVariant, "darkestPixel" | "brightestPixel">;
    slotId?: BackgroundSlotId;
  },
  opacity: number | null,
): string[] {
  const foregrounds = TABLE_DRIVEN_FOREGROUNDS[component];
  const scope = { slotId: background.slotId };
  if (backing === "none") {
    return SURFACE_DENSITIES.flatMap((density) =>
      washTextFailures(
        pkg,
        mode,
        background.bounds,
        {
          tintOf: (palette) => palette.surface,
          opacity: backgroundVeilOpacity(pkg, density),
          label: `${component} none (bare @ ${density})`,
        },
        scope,
        { foregrounds, treatment: "bare" },
      ),
    );
  }
  if (opacity === null) {
    throw new Error(`${pkg}/${mode} ${component}: see-through level unsigned`);
  }
  const group = artOpacityGroup(component) as ArtOpacityGroup;
  return washTextFailures(
    pkg,
    mode,
    background.bounds,
    {
      tintOf: (palette) => palette[SURFACE[pkg].tintTokenKey],
      opacity,
      label: `${component} seeThrough @ ${opacity}`,
    },
    scope,
    {
      foregrounds,
      treatment: group,
      paletteOf: scopedPaletteOf(pkg, mode, background.slotId !== undefined),
    },
  );
}

/** Every combination × table-driven component whose signed backing is see-through or none. */
const SIGNED_TREATMENT_CASES = ART_COMBINATION_KEYS.flatMap((key) => {
  const [pkg, mode, ...rest] = key.split("-") as [
    ThemePackage,
    ResolvedMode,
    ...string[],
  ];
  const bgKey = rest.join("-");
  return TABLE_DRIVEN_COMPONENTS.flatMap((component) => {
    const cell = ART_TREATMENTS[key][component];
    if (cell.backing === "full") return [];
    return [
      {
        key,
        pkg,
        mode,
        bgKey,
        component,
        backing: cell.backing,
        foreground: cell.foreground,
      },
    ];
  });
});

describe("Signed art treatments (38.5 v3)", () => {
  it("covers every see-through or none cell of the five table-driven components (67 in the v3 answer)", () => {
    expect(SIGNED_TREATMENT_CASES.length).toBe(67);
    expect(
      SIGNED_TREATMENT_CASES.filter((c) => c.backing === "seeThrough").length,
    ).toBe(40);
    expect(
      SIGNED_TREATMENT_CASES.filter((c) => c.backing === "none").length,
    ).toBe(27);
  });

  it("the proven foregrounds cover every table-driven component", () => {
    expect(Object.keys(TABLE_DRIVEN_FOREGROUNDS).sort()).toEqual(
      [...TABLE_DRIVEN_COMPONENTS].sort(),
    );
  });

  it("the harness is not trivially passing: a see-through entry over a mid-grey background fails (fixture)", () => {
    const grey = { darkestPixel: "#777777", brightestPixel: "#777777" };
    for (const [pkg, mode] of [
      ["galaxy", "light"],
      ["standard", "dark"],
    ] as const) {
      expect(
        signedTreatmentFailures(
          pkg,
          mode,
          "contactsListEntries",
          "seeThrough",
          { bounds: grey },
          ART_SEE_THROUGH_OPACITY[pkg][mode].listEntry,
        ).length,
        `${pkg}/${mode}`,
      ).toBeGreaterThan(0);
      expect(
        signedTreatmentFailures(
          pkg,
          mode,
          "contactsHeader",
          "none",
          { bounds: grey },
          null,
        ).length,
        `${pkg}/${mode} none`,
      ).toBeGreaterThan(0);
    }
  });

  it("the harness uses the Standard Light glass palette over an asset and the root palette over None", () => {
    const glass = scopedPaletteOf("standard", "light", true)(null);
    const root = scopedPaletteOf("standard", "light", false)(null);
    expect(glass.textSecondary).toBe(glass.textPrimary);
    expect(root.textSecondary).toBe(
      resolvePalette("standard", "light").textSecondary,
    );
  });

  it("no signed exclusion or E-1 entry narrows an art-treatment proof", () => {
    for (const e of PROOF_EXCLUSIONS) {
      for (const group of ART_OPACITY_GROUPS) {
        expect(e.treatment, e.inventoryRef).not.toContain(group);
      }
    }
  });

  it.each(
    SIGNED_TREATMENT_CASES.map((c) => [
      `${c.key} ${c.component} (${c.backing})`,
      c,
    ]),
  )(
    "%s: every foreground clears its floor over the shipped art",
    (_label, c) => {
      // D-44: no inverse cell; an inverse one needs the inverse palette here first.
      expect(c.foreground).toBe("mode");
      const group = artOpacityGroup(c.component) as ArtOpacityGroup;
      expect(
        signedTreatmentFailures(
          c.pkg,
          c.mode,
          c.component,
          c.backing as "seeThrough" | "none",
          combinationBackground(c.pkg, c.mode, c.bgKey),
          c.backing === "seeThrough"
            ? ART_SEE_THROUGH_OPACITY[c.pkg][c.mode][group]
            : null,
        ),
      ).toEqual([]);
    },
  );
});

/**
 * SWIPED SEE-THROUGH LIST ROW (38.5 review WR-01; owner ruling R1a, D-48,
 * 2026-09-29).
 *
 * `ReanimatedSwipeable` shows the Log/Edit action panel (`SwipeActionSurface`
 * in HomeScreen: a `SWIPE_ACTION_WIDTH` panel of opaque root `surfaceElevated`
 * with a 1 px root `border`, a centred `textSecondary` icon and `textPrimary`
 * label) BEHIND the row as soon as the row moves. While it moves, a see-through
 * row's `surface` tint rises to `SWIPE_ROW_BACKING_OPACITY` (0.5), so each row
 * foreground sits on one of:
 *   - the shipped art, under the 0.5 tint (the part of the row off the panel);
 *   - the panel fill or border, under the 0.5 tint;
 *   - the panel's label and icon glyphs, under the 0.5 tint.
 * Rows signed `full` or `none` are unaffected (no tint layer), so only the
 * signed see-through List cells are in scope: 11 of the 16 combinations (the
 * four None backgrounds and Standard Light · Paper are `full`).
 *
 * The row's content column (name, meta, snippet, line three and its icon)
 * starts `ROW_CONTENT_INSET` px in from either row edge and never reaches the
 * glyphs (the geometry test below), so TEXT must clear its floor over the art,
 * the fill and the border, with no exemption. The trailing favourite/status
 * icons and the ring border do cross the glyphs in motion; that overlap fails
 * at 0.5 and is the owner's recorded exemption (`SWIPE_GLYPH_EXEMPTION`).
 *
 * FONT ASSUMPTION (scoped re-check IN-3): the label widths come from Roboto
 * advance widths measured on the test Pixel (`PANEL_LABEL_ADVANCE_EM`). The
 * label is a raw `Text` with no `fontFamily`, so it renders in the device's
 * system `sans-serif`, which is Roboto on Pixel and stock Android. An OEM
 * default face, or a user-selected font style (for example on Samsung), can be
 * wider, and nothing here models that. The margin at 200% is 3.5 px (70.5
 * against the 74 px content inset), about 7% of the label width; a face that
 * much wider puts the row's text over the panel's glyphs at 200%, where the
 * recorded pairs fall to 3.21:1 and 1.28:1. So the "text never reaches the
 * glyphs" proof holds for Roboto only. Bounding it for
 * any face (for example by capping the label's font scaling) is an
 * accessibility-posture choice for the owner, not made here.
 */

/** Where a row foreground sits in the row, for the glyph-overlap geometry. */
type SwipeRowPlace = "content" | "trailing" | "ring";

/** Every foreground `ListRow` paints on its tint, by element (C2-L4: the chip and Avatar are opaque). */
const SWIPE_ROW_ELEMENTS: readonly {
  element: string;
  token: keyof ThemePalette;
  floor: number;
  place: SwipeRowPlace;
}[] = [
  {
    element: "name / highlighted snippet",
    token: "textPrimary",
    floor: AA_NORMAL,
    place: "content",
  },
  {
    element: "recency / meta / explanation / snippet / line three and its icon",
    token: "textSecondary",
    floor: AA_NORMAL,
    place: "content",
  },
  {
    element: "favourite icon (default)",
    token: "textSecondary",
    floor: AA_NORMAL,
    place: "trailing",
  },
  {
    element: "favourite icon (active)",
    token: "accentText",
    floor: AA_NORMAL,
    place: "trailing",
  },
  ...STATUS_FGS.map((token) => ({
    element: `status glyph (${token})`,
    token,
    floor: AA_LARGE,
    place: "trailing" as const,
  })),
  ...STATUS_FGS.map((token) => ({
    element: `ring border (${token})`,
    token,
    floor: AA_LARGE,
    place: "ring" as const,
  })),
];

/**
 * THE RECORDED EXEMPTION (owner ruling R1a, D-48, 2026-09-29). Owner, verbatim:
 * "I don't want to do a full backing on the row when it's moving, that'll look
 * funny. Can we try a 50% transparency maybe instead?" Shown the measurements,
 * he accepted 0.5 (option R1a), including this transient, in-motion overlap:
 * the row's trailing favourite/status icons cross the Edit panel's glyphs in
 * the first ~32 px of a swipe towards Edit, and the row's 2 px ring border
 * crosses the Log or Edit glyphs as its edge passes them (~34-60 px of travel).
 * Passing there would need ~0.95, effectively the full backing he rejected.
 *
 * Measured at 0.5 (COMPUTED here): the failing icon and ring pairs over the
 * glyphs range from 1.20:1 (Galaxy Dark `statusDecay` over the `textPrimary`
 * label) to 4.38:1, each below its floor. The same composite would fail text too (Galaxy Dark `textPrimary`
 * 3.21:1, `textSecondary` 1.28:1), which is why text is kept off the glyphs
 * by geometry, not by an exemption.
 *
 * NARROW: icons and the ring over the glyphs only. Text (`content`) is never
 * exempt; it is proven over the art, the panel fill and the border, and never
 * reaches the glyphs. The icons and ring are also proven over the art, the
 * fill and the border; only their glyph overlap is exempt. Record: dossier "Code-Review Rulings (2026-09-29)" D-48 and
 * 38.5-CONTEXT D-48.
 */
const SWIPE_GLYPH_EXEMPTION: {
  places: readonly SwipeRowPlace[];
  ruling: string;
} = {
  places: ["trailing", "ring"],
  ruling: "owner ruling R1a, D-48 (2026-09-29)",
};

/** The see-through List cells a swipe affects: the signed `seeThrough` List rows. */
const SWIPED_LIST_CASES = SIGNED_TREATMENT_CASES.filter(
  (c) => c.component === "contactsListEntries" && c.backing === "seeThrough",
);

/** The swiped tint level of a case, through the runtime mapping. */
function swipedOpacity(pkg: ThemePackage, mode: ResolvedMode): number {
  const rest = ART_SEE_THROUGH_OPACITY[pkg][mode].listEntry;
  const swiped = swipeRowTintOpacity(rest, 1);
  if (swiped === null) throw new Error(`${pkg}/${mode}: no List row tint`);
  return swiped;
}

/**
 * PURE: the failures of the swiped row's foregrounds over the action panel.
 * The row renders with its scoped palette (glass in Standard Light over an
 * asset); the panel with the root palette (`useTheme()` outside the row's
 * scope). Each is checked for the package default and every curated accent.
 */
function swipePanelFailures(
  c: (typeof SWIPED_LIST_CASES)[number],
  under: "fill" | "border" | "glyphs",
  places: readonly SwipeRowPlace[],
): string[] {
  const background = combinationBackground(c.pkg, c.mode, c.bgKey);
  const rowPaletteOf = scopedPaletteOf(
    c.pkg,
    c.mode,
    background.slotId !== undefined,
  );
  const opacity = swipedOpacity(c.pkg, c.mode);
  const failures: string[] = [];
  for (const accentId of ACCENT_CHOICES) {
    const row = rowPaletteOf(accentId);
    const root = applyAccent(
      resolvePalette(c.pkg, c.mode),
      resolveAccent(accentId, c.pkg, c.mode),
    );
    const panelColors =
      under === "fill"
        ? [root.surfaceElevated]
        : under === "border"
          ? [root.border]
          : [root.textSecondary, root.textPrimary];
    for (const panel of panelColors) {
      const composite = alphaComposite(row.surface, panel, opacity);
      for (const e of SWIPE_ROW_ELEMENTS) {
        if (!places.includes(e.place)) continue;
        if (e.token !== "accentText" && accentId !== null) continue;
        const ratio = contrastRatio(row[e.token] as string, composite);
        if (ratio < e.floor) {
          failures.push(
            `${c.key} ${under} ${panel}: ${e.element}${
              e.token === "accentText" ? ` (${accentId ?? "default"})` : ""
            } ${ratio.toFixed(2)}:1 (floor ${e.floor})`,
          );
        }
      }
    }
  }
  return failures;
}

/** The row's content column inset from either row edge (ListRow styles). */
const ROW_CONTENT_INSET =
  SPACING.xs / 2 + // row border
  SPACING.md + // row padding
  SPACING["2xl"] + // Avatar (left) / favourite button column (right)
  SPACING.md; // row gap
/** HomeScreen's `SWIPE_ACTION_WIDTH`. */
const SWIPE_PANEL_WIDTH = 96;
/** The OS font scales the glyph geometry is proven at: default, and Android's 200% maximum. */
const PANEL_FONT_SCALES = [1, 2] as const;
/**
 * Advance widths, in em, of the characters of the panel labels in Android's
 * `sans-serif` (the variable `Roboto-Regular.ttf`) on its Weight axis at 600,
 * which is what `fontWeight: "600"` selects. Measured 2026-09-29 (38.5
 * re-review IN-A) from the test phone's `/system/fonts/Roboto-Regular.ttf`
 * (Android 12; UPM 2048) with Pillow `set_variation_by_axes([600, 100, 0])`.
 * These are UNKERNED advances; their sum is at least the kerned run for both
 * labels ("Edit" 3528 vs 3509 units, "Log" 3431 vs 3431), so the derived
 * width is an upper bound. A label character not listed here fails the
 * geometry test until it is measured.
 */
const PANEL_LABEL_FONT_WEIGHT = '"600"';
const PANEL_LABEL_ADVANCE_EM: Readonly<Record<string, number>> = {
  L: 1107 / 2048,
  o: 1159 / 2048,
  g: 1165 / 2048,
  E: 1155 / 2048,
  d: 1153 / 2048,
  i: 532 / 2048,
  t: 688 / 2048,
};

/** The `name: { ... },` body of a top-level `StyleSheet.create` entry, as key -> source value. */
function styleEntry(source: string, name: string): Record<string, string> {
  const match = source.match(
    new RegExp(`\\n  ${name}: \\{\\n([^}]*)\\n  \\},`),
  );
  if (!match) throw new Error(`style ${name} not found`);
  return Object.fromEntries(
    match[1].split("\n").map((line) => {
      const [key, ...value] = line.trim().replace(/,$/, "").split(": ");
      return [key, value.join(": ")];
    }),
  );
}

/**
 * Every style reaching `SwipeActionSurface`'s elements (scoped re-check IN-2):
 * each `style=` value as source text, the keys of every inline style object in
 * the body, and the `Icon` element's source. The geometry test pins all three,
 * so a padding, margin or letterSpacing added anywhere the panel's glyph column
 * can see (a side style, an inline object, a wrapper, the icon) fails it.
 */
function surfaceStyleUses(body: string) {
  const styleProps = [
    ...body.matchAll(/style=\{(\[[\s\S]*?\]|\{[\s\S]*?\})\}/g),
  ].map((m) => m[1].replace(/\s+/g, " "));
  const inlineKeys = styleProps.flatMap((prop) =>
    [...prop.matchAll(/\{([^{}]*)\}/g)].flatMap((o) =>
      [...o[1].matchAll(/(\w+)\s*:/g)].map((k) => k[1]),
    ),
  );
  const elements = [...body.matchAll(/<(\w+)[\s/>]/g)].map((m) => m[1]);
  const icon = body.match(/<Icon\b[^>]*\/>/)?.[0] ?? null;
  return { styleProps, inlineKeys, elements, icon };
}

/**
 * The swipe panel's glyph geometry, derived from HomeScreen's source values
 * rather than measured on a screen: the labels, the label style, the panel
 * style and the icon size. Returns the outer extent of the glyphs from the
 * panel's outer edge at an OS font scale, the widest glyph, and the inputs.
 */
function panelGlyphGeometry(home: string, fontScale: number) {
  const panel = styleEntry(home, "swipeAction");
  const label = styleEntry(home, "swipeActionLabel");
  const panelLeft = styleEntry(home, "swipeActionLeft");
  const panelRight = styleEntry(home, "swipeActionRight");
  const surface = home.match(/function SwipeActionSurface\([\s\S]*?\n\}\n/);
  if (!surface) throw new Error("SwipeActionSurface not found");
  const iconSize = surface[0].match(/<Icon name=\{icon\} size="(\w+)"/)?.[1];
  if (!iconSize || !(iconSize in ICON_SIZE))
    throw new Error("SwipeActionSurface icon size not found");
  const labels = [...home.matchAll(/<SwipeActionSurface label="([^"]+)"/g)].map(
    (m) => m[1],
  );
  const fontSize = Number(label.fontSize);
  const labelWidths = labels.map((text) => {
    let em = 0;
    for (const ch of text) {
      const advance = PANEL_LABEL_ADVANCE_EM[ch];
      if (advance === undefined)
        throw new Error(`measure "${ch}" (label "${text}") at wght 600`);
      em += advance;
    }
    // Android lays text out at the scaled size and rounds the width up.
    return Math.ceil(em * fontSize * fontScale);
  });
  // Ionicons render with `allowFontScaling: false`: the icon keeps its size.
  const iconWidth = ICON_SIZE[iconSize as keyof typeof ICON_SIZE];
  const widest = Math.max(iconWidth, ...labelWidths);
  return {
    panel,
    label,
    panelLeft,
    panelRight,
    surface: surfaceStyleUses(surface[0]),
    labels,
    fontSize,
    iconWidth,
    labelWidths,
    // The column is centred in the panel (its 1 px border is symmetric), so
    // the glyphs reach half the widest glyph past the panel's centre.
    extent: SWIPE_PANEL_WIDTH / 2 + widest / 2,
  };
}

describe("Swiped see-through List row (38.5 review WR-01, D-48)", () => {
  it("covers every signed see-through List cell: 11 (None and Standard Light · Paper are full)", () => {
    expect(SWIPED_LIST_CASES.length).toBe(11);
    expect(
      SWIPED_LIST_CASES.some((c) => c.key === "standard-light-paper"),
    ).toBe(false);
    expect(SWIPED_LIST_CASES.every((c) => c.bgKey !== NONE_SLOT_ID)).toBe(true);
  });

  it("the swiped level is 0.5 in every case, above every signed rest level", () => {
    for (const c of SWIPED_LIST_CASES) {
      expect(swipedOpacity(c.pkg, c.mode)).toBe(SWIPE_ROW_BACKING_OPACITY);
      expect(
        ART_SEE_THROUGH_OPACITY[c.pkg][c.mode].listEntry as number,
      ).toBeLessThan(SWIPE_ROW_BACKING_OPACITY);
    }
  });

  it("geometry: the content column never reaches the panel's glyphs, the trailing icons do", () => {
    const listRow = readFileSync("src/components/ListRow.tsx", "utf8");
    const home = readFileSync("src/screens/HomeScreen.tsx", "utf8");
    // The inputs of ROW_CONTENT_INSET, pinned to the sources.
    expect(listRow).toMatch(/borderWidth: SPACING\.xs \/ 2,/);
    expect(listRow).toMatch(
      /gap: SPACING\.md,\s+minHeight:[^\n]+\n\s+padding: SPACING\.md,/,
    );
    expect(listRow).toMatch(/size=\{SPACING\["2xl"\]\}/);
    expect(listRow).toMatch(
      /favouriteButton: \{[^}]*minWidth: SPACING\["2xl"\],/,
    );
    expect(listRow).toMatch(/statusGlyph: \{[^}]*width: ICON_SIZE\.md,/);
    expect(ICON_SIZE.md).toBeLessThanOrEqual(SPACING["2xl"]);
    // The panel: its width, and its glyphs centred in it.
    expect(home).toMatch(
      new RegExp(`const SWIPE_ACTION_WIDTH = ${SWIPE_PANEL_WIDTH};`),
    );
    // A translation only moves the row away from the panel's outer edge, so the
    // content column is always at least ROW_CONTENT_INSET from it. Every input
    // of the inset is a layout dp value, so it does not grow with font scale.
    expect(ROW_CONTENT_INSET).toBe(74);
    const trailingIconInset =
      SPACING.xs / 2 + SPACING.md + (SPACING["2xl"] - ICON_SIZE.md) / 2;
    for (const fontScale of PANEL_FONT_SCALES) {
      const g = panelGlyphGeometry(home, fontScale);
      // The panel style, exactly: a centred COLUMN (no flexDirection), so `gap`
      // separates the icon and label vertically and adds no width, and there is
      // no padding. Any new key (padding, letterSpacing, a row direction, ...)
      // fails here until the derivation accounts for it.
      expect(g.panel).toEqual({
        width: "SWIPE_ACTION_WIDTH",
        borderWidth: "1",
        justifyContent: '"center"',
        alignItems: '"center"',
        gap: "4",
      });
      expect(g.label).toEqual({
        fontSize: expect.stringMatching(/^\d+$/),
        fontWeight: PANEL_LABEL_FONT_WEIGHT,
      });
      // The side styles, exactly: the two outer corner radii each, which move
      // nothing (scoped re-check IN-2).
      expect(g.panelLeft).toEqual({
        borderTopLeftRadius: "16",
        borderBottomLeftRadius: "16",
      });
      expect(g.panelRight).toEqual({
        borderTopRightRadius: "16",
        borderBottomRightRadius: "16",
      });
      // Every style that reaches the panel and its glyphs: the panel's array
      // (base, one side, an inline colour object) and the label's (label
      // style, an inline colour object). Inline objects carry colours only; the
      // elements are the panel View, the Icon (no style prop) and the label.
      expect(g.surface.styleProps).toEqual([
        '[ styles.swipeAction, side === "left" ? styles.swipeActionLeft : styles.swipeActionRight, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }, ]',
        "[styles.swipeActionLabel, { color: colors.textPrimary }]",
      ]);
      expect(
        g.surface.inlineKeys.filter(
          (k) => !["backgroundColor", "borderColor", "color"].includes(k),
        ),
      ).toEqual([]);
      expect(g.surface.elements).toEqual(["View", "Icon", "Text"]);
      expect(g.surface.icon).toBe(
        '<Icon name={icon} size="md" tone="textSecondary" />',
      );
      expect(g.labels).toEqual(["Log", "Edit"]);
      // The glyphs straddle the panel's centre, and TEXT never reaches them:
      // at the default scale and at Android's 200% maximum.
      expect(g.extent, `font scale ${fontScale}`).toBeGreaterThan(
        SWIPE_PANEL_WIDTH / 2,
      );
      expect(ROW_CONTENT_INSET, `font scale ${fontScale}`).toBeGreaterThan(
        g.extent,
      );
      // The trailing icons (fixed size) start inside the glyph extent at rest:
      // the exempt overlap.
      expect(trailingIconInset).toBeLessThan(g.extent);
    }
    // The derived figures (COMPUTED): 59.5 px at 1.0 (the "about 60" of D-48),
    // 70.5 px at 2.0, against the 74 px content inset.
    expect(
      PANEL_FONT_SCALES.map((s) => panelGlyphGeometry(home, s).extent),
    ).toEqual([59.5, 70.5]);
    // The icon keeps its size under OS font scaling (the derivation relies on it).
    expect(
      readFileSync(
        "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/lib/create-icon-set.js",
        "utf8",
      ),
    ).toMatch(/allowFontScaling: false/);
  });

  it("the harness is not trivially passing: the icon-over-glyph overlap fails at 0.5 (the reason for the exemption)", () => {
    expect(
      SWIPED_LIST_CASES.flatMap((c) =>
        swipePanelFailures(c, "glyphs", SWIPE_GLYPH_EXEMPTION.places),
      ).length,
    ).toBeGreaterThan(0);
  });

  it("the exemption is narrow: icons and the ring, never text", () => {
    expect([...SWIPE_GLYPH_EXEMPTION.places].sort()).toEqual([
      "ring",
      "trailing",
    ]);
    expect(SWIPE_GLYPH_EXEMPTION.places).not.toContain("content");
    expect(SWIPE_GLYPH_EXEMPTION.ruling).toContain("D-48");
    // Every text foreground is a content-column element.
    for (const e of SWIPE_ROW_ELEMENTS) {
      if (e.place !== "content") expect(e.element).toMatch(/icon|glyph|ring/);
    }
    // And no signed exclusion narrows the List proof instead.
    for (const e of PROOF_EXCLUSIONS) {
      expect(e.treatment).not.toContain("listEntry");
    }
  });

  it.each(SWIPED_LIST_CASES.map((c) => [c.key, c]))(
    "%s: every row foreground clears its floor over the shipped art at 0.5",
    (_key, c) => {
      expect(
        signedTreatmentFailures(
          c.pkg,
          c.mode,
          "contactsListEntries",
          "seeThrough",
          combinationBackground(c.pkg, c.mode, c.bgKey),
          swipedOpacity(c.pkg, c.mode),
        ),
      ).toEqual([]);
    },
  );

  it.each(SWIPED_LIST_CASES.map((c) => [c.key, c]))(
    "%s: row text, icons and ring clear their floors over the panel fill and border at 0.5",
    (_key, c) => {
      const every: readonly SwipeRowPlace[] = ["content", "trailing", "ring"];
      expect(swipePanelFailures(c, "fill", every)).toEqual([]);
      expect(swipePanelFailures(c, "border", every)).toEqual([]);
    },
  );
});
