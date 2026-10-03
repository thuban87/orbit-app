/**
 * OrreryTextService (38.7 D-46 / D-52): the single path every Orrery Paragraph
 * takes — body labels, context captions and body/sun initials.
 *
 * WHY: RN-Skia charges 1 MiB of external memory pressure per Paragraph and per
 * ParagraphBuilder (`JsiSkParagraph.h:174`, `JsiSkParagraphBuilder.h:119`), and
 * before this service every label and initials Paragraph was rebuilt on every
 * parent render with one new builder per body and never disposed. At All
 * Contacts scale that is thousands of MiB of reported pressure per render.
 *
 * WHAT IT GUARANTEES
 *   - One ParagraphBuilder per font provider, `reset()` before each build.
 *   - A keyed LRU cache: an unchanged request returns the same Paragraph, so a
 *     re-render with unchanged inputs builds nothing and disposes nothing.
 *   - A HARD cap: pinned + warm + retired-awaiting-ledger entries never exceed
 *     `ORRERY_TEXT_CACHE_MAX_ENTRIES`, because admission is checked BEFORE
 *     shaping. A request that cannot fit builds nothing and returns null; the
 *     caller draws its fallback (no label; a plain swatch disc with no glyph).
 *   - Use-after-free safety (38.7-07, the H3 generation-ledger contract). An
 *     entry is disposed only when no owner pins it AND every owner that
 *     un-pinned it has confirmed it through its generation ledger: every
 *     picture layer that recorded a generation drawing it (the body layers for
 *     initials, the labels layer for labels and captions) acked a newer
 *     generation in the same mount epoch (`confirmRetired`). In-flight native
 *     draws are protected separately: a recorded SkPicture owns the text blobs
 *     `drawParagraph` painted into it (38.7-04 / 38.7-07 SUMMARY evidence).
 *
 * ENTRY STATES (all counted against the cap)
 *   - pinned: some owner's currently published spec draws it;
 *   - retired: an owner un-pinned it and its ledger has not yet confirmed it;
 *   - warm: neither — an evictable cache entry (LRU order, disposed on eviction).
 *
 * THE PUBLISHER (`createOrreryTextPublisher`) turns scene inputs, the semantic
 * tier and the eligible-initials list into published text specs (written to
 * SharedValues by the caller, never React state), in admission-priority order,
 * with the C-M1 replacement protocol at a saturated cap.
 *
 * JS thread only. Nothing in this module is a worklet.
 */
import {
  Skia,
  type SkParagraph,
  type SkParagraphBuilder,
  type SkTypefaceFontProvider,
  TextAlign,
} from "@shopify/react-native-skia";
import type { SemanticLevel } from "@/logic/orrery-label-logic";
import type { ThemePalette } from "@/theme/theme-types";
import { SPACING } from "@/theme/tokens/spacing";
import { TYPOGRAPHY } from "@/theme/tokens/typography";

// --- Tunable constants (top-of-file per project convention) ------------------

/** Labels are at most this wide (dp, × the font scale, ≤ the viewport). */
export const ORRERY_LABEL_MAX_WIDTH = 200;
/** The gap between a body's disc and its label backplate (dp). */
export const ORRERY_LABEL_BODY_GAP = 8;

/**
 * Hard bound on built-but-undisposed Orrery Paragraphs (pinned + warm + retired).
 * Each one reports 1 MiB of external memory pressure to Hermes, so this bounds
 * the reported text pressure at ~400 MiB in the worst case.
 * 38.7-08 (measured on the Pixel 6 Pro, debug): 15 pinned / ≤ 24 warm at the
 * Size 120 and All Contacts overviews and with a body focused. 400 still fits
 * a whole Size 120 at the detail tier (120 labels + 120 captions + 120
 * initials) plus the priority reserve; it was 1,200 (~1.2 GiB worst case).
 */
export const ORRERY_TEXT_CACHE_MAX_ENTRIES = 400;
/**
 * Slots inside the cap that only focused/cluster labels and same-slot
 * replacements (a re-keyed label or initials for a body that already had one)
 * may use. Ordinary prepares are admitted only up to cap − reserve, so a focus
 * change can always be admitted at once.
 */
export const ORRERY_TEXT_PRIORITY_RESERVE = 32;
/**
 * C3-L3: a whole-set re-key (theme, accent, font scale or font provider change)
 * whose new set fits within the cap reaches full publication within this many
 * published text-spec generations (fallback → per-layer acks → admission).
 */
export const ORRERY_TEXT_REKEY_MAX_GENERATIONS = 3;
/**
 * Initials are prepared only for bodies whose projected radius is at least this
 * many canvas px: below it the glyph is unreadable, and at the All Contacts
 * overview most bodies are far smaller.
 */
export const ORRERY_INITIALS_MIN_RADIUS_PX = 7;
/** The UI thread reports visibility/eligibility changes at most this often. */
export const ORRERY_TEXT_ELIGIBILITY_INTERVAL_MS = 250;
/**
 * Unpinned, ledger-cleared (warm) entries kept for reuse (tier churn, panning
 * back). `trim()` disposes the least recently used warm entries above this.
 */
export const ORRERY_TEXT_WARM_MAX_ENTRIES = 256;

/** Label/caption backplate padding (the label box is text + padding). */
export const ORRERY_TEXT_HORIZONTAL_PADDING = SPACING.sm;
export const ORRERY_TEXT_VERTICAL_PADDING = SPACING.xs;

/** U+0001 separates key fields (as Lab C did); it never occurs in a name. */
const KEY_SEPARATOR = "\u0001";

export interface PreparedOrreryText {
  /** The original identity remains available to companion/accessibility callers. */
  text: string;
  paragraph: SkParagraph;
  width: number;
  height: number;
}

export type OrreryTextRole = "label" | "caption" | "initials";

export interface OrreryTextRequest {
  text: string;
  role: OrreryTextRole;
  fontScale: number;
  maxWidth: number;
  /** Absolute font size; label/caption default to the typography size × scale. */
  fontSize?: number;
  /** The resolved ink colour (a theme token value, never a literal). */
  ink: string;
  family: string;
  weight?: number;
  fontProvider: SkTypefaceFontProvider | null;
}

export interface PrepareOptions {
  /**
   * Focused/cluster labels and same-slot replacements may use the priority
   * reserve; everything else is admitted only up to cap − reserve.
   */
  priority?: boolean;
  /** Keys chosen earlier in the same publish pass: never evicted by this prepare. */
  protect?: ReadonlySet<string>;
}

export interface OrreryTextStats {
  /** Entries currently pinned by at least one owner. */
  pinned: number;
  /** Unpinned, ledger-cleared entries (evictable). */
  warm: number;
  /** Unpinned entries still awaiting an owner's ledger confirmation. */
  retired: number;
  /** Lifetime Paragraph builds. */
  built: number;
  /** Lifetime Paragraph disposals. */
  disposed: number;
  /** Lifetime admissions refused (nothing built). */
  refused: number;
  /** Builders made (one per font provider). */
  builders: number;
}

export interface OrreryTextServiceOptions {
  maxEntries?: number;
  priorityReserve?: number;
  warmMaxEntries?: number;
}

export interface OrreryTextService {
  readonly maxEntries: number;
  readonly priorityReserve: number;
  /** The cache key for a request, or null when it can never be prepared. */
  keyOf(request: OrreryTextRequest): string | null;
  /** A built entry by key (no LRU touch), or undefined. */
  peek(key: string): PreparedOrreryText | undefined;
  prepare(
    request: OrreryTextRequest,
    options?: PrepareOptions,
  ): PreparedOrreryText | null;
  /** Starts a new mount epoch for `owner`; confirmations of older epochs only clear their own marks. */
  mount(owner: string): number;
  /** Replaces `owner`'s pinned set with `keys` (the keys `generation` draws). */
  acquire(
    owner: string,
    keys: Iterable<string>,
    generation: number,
    epoch: number,
  ): void;
  /**
   * H3: `owner`'s generation ledger released `keys` of `epoch` (every layer
   * that recorded them acked a newer generation). Their retirement marks clear;
   * an entry nothing holds turns warm, or is disposed with `dispose`. Returns
   * how many entries became unheld.
   */
  confirmRetired(
    owner: string,
    keys: Iterable<string>,
    epoch: number,
    options?: { dispose?: boolean },
  ): number;
  /** Drops `owner`'s pins (they retire) and ends its epoch; returns that epoch. */
  release(owner: string): number;
  /** After the post-release teardown: the released entries turn warm. */
  confirmReleased(owner: string, epoch: number): number;
  /** Disposes LRU warm entries while over the cap or the warm budget. */
  trim(): number;
  /** Disposes every entry that is neither pinned nor awaiting confirmation. */
  clearUnheld(): number;
  stats(): OrreryTextStats;
  /**
   * Called (synchronously) whenever capacity frees: entries turn warm after a
   * ledger confirmation or a released mount, or are disposed by
   * trim/clearUnheld. Queued prepares retry from here. Returns the unsubscribe
   * function.
   */
  onCapacityFreed(listener: () => void): () => void;
}

interface RetireMark {
  epoch: number;
  /** First generation that no longer draws the entry (Infinity = released). */
  generation: number;
}
interface Entry {
  key: string;
  prepared: PreparedOrreryText;
  /** Owners whose published spec draws this entry. */
  pins: Set<string>;
  /** Owners that un-pinned it and whose ledger has not yet confirmed it. */
  retired: Map<string, RetireMark>;
}
interface OwnerState {
  epoch: number;
  pinned: Set<string>;
  generation: number;
}

let providerSerial = 0;
const providerIds = new WeakMap<object, number>();
function providerId(provider: SkTypefaceFontProvider): number {
  let id = providerIds.get(provider);
  if (id === undefined) {
    id = ++providerSerial;
    providerIds.set(provider, id);
  }
  return id;
}

function normalScale(fontScale: number): number {
  return Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
}

function disposeParagraph(paragraph: SkParagraph): void {
  (paragraph as { dispose?: () => void }).dispose?.();
}

export function createOrreryTextService(
  options: OrreryTextServiceOptions = {},
): OrreryTextService {
  const maxEntries = options.maxEntries ?? ORRERY_TEXT_CACHE_MAX_ENTRIES;
  const priorityReserve = Math.min(
    maxEntries,
    options.priorityReserve ?? ORRERY_TEXT_PRIORITY_RESERVE,
  );
  const warmMaxEntries = options.warmMaxEntries ?? ORRERY_TEXT_WARM_MAX_ENTRIES;
  /** Map insertion order is the LRU order (oldest first); a hit re-inserts. */
  const entries = new Map<string, Entry>();
  const builders = new WeakMap<object, SkParagraphBuilder>();
  const owners = new Map<string, OwnerState>();
  let epochSerial = 0;
  const counters = { built: 0, disposed: 0, refused: 0, builders: 0 };
  const listeners = new Set<() => void>();
  function freed(count: number): number {
    if (count > 0) for (const listener of [...listeners]) listener();
    return count;
  }

  const isWarm = (entry: Entry) =>
    entry.pins.size === 0 && entry.retired.size === 0;

  function ownerState(owner: string): OwnerState {
    let state = owners.get(owner);
    if (!state) {
      state = { epoch: ++epochSerial, pinned: new Set(), generation: 0 };
      owners.set(owner, state);
    }
    return state;
  }

  function dispose(entry: Entry): void {
    entries.delete(entry.key);
    disposeParagraph(entry.prepared.paragraph);
    counters.disposed++;
  }

  function builderFor(provider: SkTypefaceFontProvider): SkParagraphBuilder {
    let builder = builders.get(provider);
    if (!builder) {
      builder = Skia.ParagraphBuilder.Make(
        { textAlign: TextAlign.Center, maxLines: 1, ellipsis: "…" },
        provider,
      );
      builders.set(provider, builder);
      counters.builders++;
    }
    return builder;
  }

  /** Evicts LRU warm entries (not protected) until `entries.size < limit`. */
  function makeRoom(limit: number, protect?: ReadonlySet<string>): boolean {
    if (entries.size < limit) return true;
    for (const entry of [...entries.values()]) {
      if (entries.size < limit) break;
      if (!isWarm(entry) || protect?.has(entry.key)) continue;
      dispose(entry);
    }
    return entries.size < limit;
  }

  function keyOf(request: OrreryTextRequest): string | null {
    const { fontProvider, maxWidth, role, text } = request;
    if (!fontProvider) return null;
    if (role === "initials") {
      if (text.length === 0 || !(maxWidth > 0)) return null;
    } else if (!(maxWidth > ORRERY_TEXT_HORIZONTAL_PADDING * 2)) return null;
    return [
      providerId(fontProvider),
      role,
      normalScale(request.fontScale),
      maxWidth,
      request.fontSize ?? "",
      request.ink,
      request.family,
      request.weight ?? "",
      text,
    ].join(KEY_SEPARATOR);
  }

  function build(request: OrreryTextRequest): PreparedOrreryText {
    const provider = request.fontProvider as SkTypefaceFontProvider;
    const builder = builderFor(provider);
    builder.reset();
    const scale = normalScale(request.fontScale);
    if (request.role === "initials") {
      const paragraph = builder
        .pushStyle({
          color: Skia.Color(request.ink),
          fontFamilies: [request.family],
          fontSize: request.fontSize ?? 14,
        })
        .addText(request.text)
        .pop()
        .build();
      paragraph.layout(request.maxWidth);
      counters.built++;
      return {
        text: request.text,
        paragraph,
        width: request.maxWidth,
        height: paragraph.getHeight(),
      };
    }
    const typography = TYPOGRAPHY[request.role];
    const paragraph = builder
      .pushStyle({
        color: Skia.Color(request.ink),
        fontFamilies: [request.family],
        fontStyle: { weight: request.weight ?? typography.weight },
        fontSize: request.fontSize ?? typography.size * scale,
      })
      .addText(request.text)
      .pop()
      .build();
    const { maxWidth } = request;
    paragraph.layout(maxWidth - ORRERY_TEXT_HORIZONTAL_PADDING * 2);
    const width = Math.min(
      maxWidth,
      Math.max(1, Math.ceil(paragraph.getLongestLine())) +
        ORRERY_TEXT_HORIZONTAL_PADDING * 2,
    );
    paragraph.layout(width - ORRERY_TEXT_HORIZONTAL_PADDING * 2);
    counters.built++;
    return {
      text: request.text,
      paragraph,
      width,
      height:
        Math.max(paragraph.getHeight(), typography.lineHeight * scale) +
        ORRERY_TEXT_VERTICAL_PADDING * 2,
    };
  }

  return {
    maxEntries,
    priorityReserve,
    keyOf,
    peek: (key) => entries.get(key)?.prepared,
    prepare(request, prepareOptions = {}) {
      const key = keyOf(request);
      if (key === null) return null;
      const hit = entries.get(key);
      if (hit) {
        entries.delete(key);
        entries.set(key, hit);
        return hit.prepared;
      }
      // Admission BEFORE shaping: nothing is built unless a slot is free.
      const limit = prepareOptions.priority
        ? maxEntries
        : maxEntries - priorityReserve;
      if (!makeRoom(limit, prepareOptions.protect)) {
        counters.refused++;
        return null;
      }
      const prepared = build(request);
      entries.set(key, { key, prepared, pins: new Set(), retired: new Map() });
      return prepared;
    },
    mount(owner) {
      const state = ownerState(owner);
      state.epoch = ++epochSerial;
      state.generation = 0;
      return state.epoch;
    },
    acquire(owner, keys, generation, epoch) {
      const state = ownerState(owner);
      if (epoch !== state.epoch) return;
      const next = new Set<string>();
      for (const key of keys) if (entries.has(key)) next.add(key);
      for (const key of state.pinned) {
        if (next.has(key)) continue;
        const entry = entries.get(key);
        if (!entry) continue;
        entry.pins.delete(owner);
        entry.retired.set(owner, { epoch, generation });
      }
      for (const key of next) {
        const entry = entries.get(key) as Entry;
        entry.pins.add(owner);
        entry.retired.delete(owner);
      }
      state.pinned = next;
      state.generation = generation;
    },
    confirmRetired(owner, keys, epoch, confirmOptions = {}) {
      let cleared = 0;
      for (const key of keys) {
        const entry = entries.get(key);
        const mark = entry?.retired.get(owner);
        if (!entry || !mark || mark.epoch !== epoch) continue;
        entry.retired.delete(owner);
        if (!isWarm(entry)) continue;
        cleared++;
        if (confirmOptions.dispose) dispose(entry);
      }
      return freed(cleared);
    },
    release(owner) {
      const state = ownerState(owner);
      const epoch = state.epoch;
      for (const key of state.pinned) {
        const entry = entries.get(key);
        if (!entry) continue;
        entry.pins.delete(owner);
        entry.retired.set(owner, { epoch, generation: Infinity });
      }
      state.pinned = new Set();
      // End the epoch: confirmations now clear only this epoch's own marks.
      state.epoch = ++epochSerial;
      return epoch;
    },
    confirmReleased(owner, epoch) {
      let cleared = 0;
      for (const entry of entries.values()) {
        const mark = entry.retired.get(owner);
        if (!mark || mark.epoch !== epoch) continue;
        entry.retired.delete(owner);
        if (isWarm(entry)) cleared++;
      }
      return freed(cleared);
    },
    trim() {
      let warm = 0;
      for (const entry of entries.values()) if (isWarm(entry)) warm++;
      let disposed = 0;
      for (const entry of [...entries.values()]) {
        if (entries.size <= maxEntries && warm <= warmMaxEntries) break;
        if (!isWarm(entry)) continue;
        dispose(entry);
        warm--;
        disposed++;
      }
      return freed(disposed);
    },
    clearUnheld() {
      let disposed = 0;
      for (const entry of [...entries.values()])
        if (isWarm(entry)) {
          dispose(entry);
          disposed++;
        }
      return freed(disposed);
    },
    stats() {
      let pinned = 0;
      let warm = 0;
      let retired = 0;
      for (const entry of entries.values()) {
        if (entry.pins.size > 0) pinned++;
        else if (entry.retired.size > 0) retired++;
        else warm++;
      }
      return { pinned, warm, retired, ...counters };
    },
    onCapacityFreed(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The app-wide instance: today's renderer, the V2 renderer and the warm cache share it. */
export const orreryTextService = createOrreryTextService();

/**
 * One label or caption Paragraph through the shared service (JS thread only,
 * never inside a frame worklet). Native shaping and its one-line ellipsis own
 * Unicode boundaries; no JS name slicing. Null when admission is refused at
 * the cap or the font has not loaded.
 */
export function prepareOrreryText(
  text: string,
  role: "label" | "caption",
  fontScale: number,
  maxWidth: number,
  fontProvider: SkTypefaceFontProvider | null,
  colors: ThemePalette,
): PreparedOrreryText | null {
  const typography = TYPOGRAPHY[role];
  return orreryTextService.prepare({
    text,
    role,
    fontScale,
    maxWidth,
    ink: colors[typography.colorToken],
    family: typography.family,
    weight: typography.weight,
    fontProvider,
  });
}

// --- The text-spec publisher --------------------------------------------------

/** One labelable body, as the React side knows it (plain data, no Paragraphs). */
export interface OrreryLabelSource {
  /** Body key (`bodyKey`). */
  key: string;
  name: string;
  /** Context caption text; drawn only at the detail tier. */
  context?: string;
  focused: boolean;
  cluster: boolean;
  favorite: boolean;
}
/** One body that can show initials on its swatch disc. */
export interface OrreryInitialsSource {
  key: string;
  /** `orreryInitials(name)`; empty → no glyph ever. */
  text: string;
  /** Quantised font size (canvas px, body-local). */
  fontSize: number;
  /** The inner disc width the glyph is centred in. */
  maxWidth: number;
  /** The body has a stored photo path; its initials only show if the photo fails. */
  hasPhoto: boolean;
}
export interface OrreryTextScene {
  labels: readonly OrreryLabelSource[];
  initials: readonly OrreryInitialsSource[];
  labelWidth: number;
  fontScale: number;
  fontProvider: SkTypefaceFontProvider | null;
  labelInk: string;
  captionInk: string;
  initialsInk: string;
}
export interface OrreryTextVisibility {
  /** Keys of the bodies currently visible; null = not reported yet (all). */
  visible: readonly string[] | null;
  /** Visible bodies whose projected radius ≥ ORRERY_INITIALS_MIN_RADIUS_PX. */
  eligible: readonly { key: string; radius: number }[];
}
/** Plain allocation input; mirrors `LabelCandidate` without the per-frame position. */
export interface OrreryMeasuredLabel {
  id: string;
  name: string;
  width: number;
  height: number;
  focused: boolean;
  cluster: boolean;
  favorite: boolean;
  context?: string;
  contextWidth?: number;
  contextHeight?: number;
}
export interface OrreryLabelSpec {
  generation: number;
  mountEpoch: number;
  /** Every cache key this spec draws (labels and captions): its ledger handles. */
  keys: readonly string[];
  labels: Readonly<
    Record<
      string,
      { text: PreparedOrreryText | null; context: PreparedOrreryText | null }
    >
  >;
  measured: readonly OrreryMeasuredLabel[];
}
export interface OrreryInitialsSpec {
  generation: number;
  mountEpoch: number;
  /** Every cache key this spec draws: its ledger handles. */
  keys: readonly string[];
  initials: Readonly<Record<string, PreparedOrreryText | null>>;
}
export const EMPTY_LABEL_SPEC: OrreryLabelSpec = Object.freeze({
  generation: 0,
  mountEpoch: 0,
  keys: Object.freeze([]) as readonly string[],
  labels: Object.freeze({}),
  measured: Object.freeze([]) as readonly OrreryMeasuredLabel[],
});
export const EMPTY_INITIALS_SPEC: OrreryInitialsSpec = Object.freeze({
  generation: 0,
  mountEpoch: 0,
  keys: Object.freeze([]) as readonly string[],
  initials: Object.freeze({}),
});

export interface OrreryTextPublisherOptions {
  service?: OrreryTextService;
  owner: string;
  /** Writes the specs to SharedValues; `undefined` = unchanged since the last write. */
  write: (
    labels: OrreryLabelSpec | undefined,
    initials: OrreryInitialsSpec | undefined,
  ) => void;
}
export interface OrreryTextPublisher {
  /** Publishes (mounting a new epoch after a release). */
  setScene(scene: OrreryTextScene): void;
  /** Tier and visibility only publish while mounted. */
  setTier(tier: SemanticLevel): void;
  setVisibility(visibility: OrreryTextVisibility): void;
  /**
   * H3: the generation ledger released `keys` of `epoch` (every layer that
   * recorded them acked a newer generation); `dispose` at teardown.
   */
  confirmRetired(
    keys: Iterable<string>,
    epoch: number,
    dispose?: boolean,
  ): void;
  /** Unmount: pins retire; returns the epoch the post-round-trip confirm needs. */
  release(): number | null;
  /** Published generations so far. */
  generation(): number;
  /** The current mount epoch (null when not mounted). */
  epoch(): number | null;
  /** True while some wanted text is waiting for capacity. */
  pending(): boolean;
}

type Slot = string;
interface Want {
  slot: Slot;
  bodyKey: string;
  kind: "label" | "caption" | "initials";
  request: OrreryTextRequest;
  /** Focused/cluster label (or its caption): may use the reserve. */
  priority: boolean;
  visible: boolean;
}

const slotOf = (kind: Want["kind"], bodyKey: string): Slot =>
  `${kind}${KEY_SEPARATOR}${bodyKey}`;

export function createOrreryTextPublisher(
  options: OrreryTextPublisherOptions,
): OrreryTextPublisher {
  const service = options.service ?? orreryTextService;
  const { owner, write } = options;
  let scene: OrreryTextScene | null = null;
  let tier: SemanticLevel = "overview";
  let visibility: OrreryTextVisibility = { visible: null, eligible: [] };
  let epoch: number | null = null;
  let generation = 0;
  /** slot → key drawn by the last published generation. */
  let published = new Map<Slot, string>();
  let labelSignature = "";
  let initialsSignature = "";
  let waiting = false;
  /**
   * Slots whose superseded entry a fallback generation dropped to make room:
   * they stay same-slot replacements (may use the reserve) until admitted.
   */
  let dropped = new Set<Slot>();
  /** The first publish of a mount writes both specs unconditionally. */
  let firstSinceMount = true;
  let publishing = false;
  let unsubscribe: (() => void) | null = null;

  /** Every wanted text, highest admission priority first. */
  function wants(current: OrreryTextScene): Want[] {
    const visibleSet = visibility.visible ? new Set(visibility.visible) : null;
    const isVisible = (key: string) => !visibleSet || visibleSet.has(key);
    const label = (source: OrreryLabelSource, priority: boolean): Want[] => {
      const base = {
        bodyKey: source.key,
        priority,
        visible: isVisible(source.key),
      };
      const out: Want[] = [
        {
          ...base,
          slot: slotOf("label", source.key),
          kind: "label",
          request: {
            text: source.name,
            role: "label",
            fontScale: current.fontScale,
            maxWidth: current.labelWidth,
            ink: current.labelInk,
            family: TYPOGRAPHY.label.family,
            weight: TYPOGRAPHY.label.weight,
            fontProvider: current.fontProvider,
          },
        },
      ];
      // allocateLabels draws context captions only at the detail tier.
      if (tier === "detail" && source.context)
        out.push({
          ...base,
          slot: slotOf("caption", source.key),
          kind: "caption",
          request: {
            text: source.context,
            role: "caption",
            fontScale: current.fontScale,
            maxWidth: current.labelWidth,
            ink: current.captionInk,
            family: TYPOGRAPHY.caption.family,
            weight: TYPOGRAPHY.caption.weight,
            fontProvider: current.fontProvider,
          },
        });
      return out;
    };
    const focused = current.labels.filter((s) => s.focused);
    const cluster = current.labels.filter((s) => !s.focused && s.cluster);
    // At overview only focused/cluster labels can show (allocateLabels drops
    // the rest); above it, only visible bodies are labelled.
    const others =
      tier === "overview"
        ? []
        : current.labels.filter(
            (s) => !s.focused && !s.cluster && isVisible(s.key),
          );
    const initialsByKey = new Map(current.initials.map((s) => [s.key, s]));
    const eligible = visibility.eligible
      .flatMap((item) => {
        const source = initialsByKey.get(item.key);
        return source && source.text.length > 0
          ? [{ source, radius: item.radius }]
          : [];
      })
      .sort(
        (a, b) =>
          Number(a.source.hasPhoto) - Number(b.source.hasPhoto) ||
          b.radius - a.radius ||
          (a.source.key < b.source.key
            ? -1
            : a.source.key > b.source.key
              ? 1
              : 0),
      );
    return [
      ...focused.flatMap((s) => label(s, true)),
      ...cluster.flatMap((s) => label(s, true)),
      ...others.flatMap((s) => label(s, false)),
      ...eligible.map(
        ({ source }): Want => ({
          slot: slotOf("initials", source.key),
          bodyKey: source.key,
          kind: "initials",
          priority: false,
          visible: true,
          request: {
            text: source.text,
            role: "initials",
            fontScale: 1,
            maxWidth: source.maxWidth,
            fontSize: source.fontSize,
            ink: current.initialsInk,
            family: "Inter",
            fontProvider: current.fontProvider,
          },
        }),
      ),
    ];
  }

  /** Keeps the highest-priority prefix that fits the budget (priority may use the reserve). */
  function budgeted(list: Want[]): Want[] {
    const out: Want[] = [];
    const normalBudget = service.maxEntries - service.priorityReserve;
    for (const want of list) {
      if (
        want.priority
          ? out.length < service.maxEntries
          : out.length < normalBudget
      )
        out.push(want);
    }
    return out;
  }

  function publish(): void {
    if (!scene || publishing) return;
    publishing = true;
    try {
      publishPass(scene);
    } finally {
      publishing = false;
    }
  }

  function publishPass(current: OrreryTextScene): void {
    if (epoch === null) {
      epoch = service.mount(owner);
      // Queued work retries whenever capacity actually frees (a ledger
      // confirmation, a released mount, a trim), never on a timer.
      unsubscribe = service.onCapacityFreed(() => {
        if (waiting && !publishing) publish();
      });
    }
    const target = budgeted(wants(current));
    const chosen = new Map<Slot, string>();
    const protect = new Set<string>();
    const refused: Want[] = [];
    for (const want of target) {
      const key = service.keyOf(want.request);
      if (key === null) continue;
      const previous = published.get(want.slot);
      const replacement =
        (previous !== undefined && previous !== key) || dropped.has(want.slot);
      const prepared = service.prepare(want.request, {
        priority: want.priority || replacement,
        protect,
      });
      if (prepared) {
        chosen.set(want.slot, key);
        protect.add(key);
      } else refused.push(want);
    }
    // Stale fallback: a refused slot keeps drawing its previous (still pinned)
    // entry rather than blinking, unless that space is needed (below).
    const stale = new Map<Slot, string>();
    for (const want of refused) {
      const previous = published.get(want.slot);
      if (previous !== undefined && service.peek(previous))
        stale.set(want.slot, previous);
    }
    const keepKeys = new Set<string>([...chosen.values(), ...stale.values()]);
    let freed = 0;
    for (const key of new Set(published.values()))
      if (!keepKeys.has(key)) freed++;
    const need = refused.length;
    if (need > freed && stale.size > 0) {
      // Drop just enough superseded pins, in one generation: not-visible
      // first, then the lowest-priority visible ones (`refused` is in
      // priority order, so each group is walked from its end).
      const dropOrder = [
        ...refused.filter((w) => !w.visible).reverse(),
        ...refused.filter((w) => w.visible).reverse(),
      ];
      let toFree = need - freed;
      for (const want of dropOrder) {
        if (toFree <= 0) break;
        const key = stale.get(want.slot);
        if (key === undefined) continue;
        stale.delete(want.slot);
        dropped.add(want.slot);
        const stillUsed =
          [...chosen.values()].includes(key) ||
          [...stale.values()].includes(key);
        if (!stillUsed) toFree--;
      }
    }
    const drawn = new Map<Slot, string>([...chosen, ...stale]);
    // A dropped slot keeps its replacement status only while still wanted
    // and not yet admitted.
    const wanted = new Set(target.map((want) => want.slot));
    dropped = new Set(
      [...dropped].filter((slot) => wanted.has(slot) && !chosen.has(slot)),
    );
    waiting = refused.length > 0;

    // Build the specs from what is drawn.
    const labels: Record<
      string,
      { text: PreparedOrreryText | null; context: PreparedOrreryText | null }
    > = {};
    const measured: OrreryMeasuredLabel[] = [];
    const initials: Record<string, PreparedOrreryText | null> = {};
    const labelParts: string[] = [];
    const initialsParts: string[] = [];
    const labelKeys: string[] = [];
    const initialsKeys: string[] = [];
    const sourceByKey = new Map(current.labels.map((s) => [s.key, s]));
    for (const source of current.labels) {
      const textKey = drawn.get(slotOf("label", source.key));
      if (textKey === undefined) continue;
      const text = service.peek(textKey) ?? null;
      if (!text) continue;
      const contextKey = drawn.get(slotOf("caption", source.key));
      const context =
        contextKey === undefined ? null : (service.peek(contextKey) ?? null);
      labels[source.key] = { text, context };
      labelParts.push(source.key, textKey, contextKey ?? "");
      labelKeys.push(textKey);
      if (context && contextKey !== undefined) labelKeys.push(contextKey);
    }
    for (const [key, entry] of Object.entries(labels)) {
      const source = sourceByKey.get(key) as OrreryLabelSource;
      measured.push({
        id: key,
        name: source.name,
        width: entry.text?.width ?? 0,
        height: entry.text?.height ?? 0,
        focused: source.focused,
        cluster: source.cluster,
        favorite: source.favorite,
        ...(entry.context
          ? {
              context: entry.context.text,
              contextWidth: entry.context.width,
              contextHeight: entry.context.height,
            }
          : {}),
      });
      labelParts.push(
        `${Number(source.focused)}${Number(source.cluster)}${Number(source.favorite)}`,
      );
    }
    for (const [slot, key] of drawn) {
      if (!slot.startsWith(`initials${KEY_SEPARATOR}`)) continue;
      const bodyKey = slot.slice(`initials${KEY_SEPARATOR}`.length);
      initials[bodyKey] = service.peek(key) ?? null;
      initialsParts.push(bodyKey, key);
      initialsKeys.push(key);
    }
    initialsParts.sort();
    const nextLabelSignature = labelParts.join(KEY_SEPARATOR);
    const nextInitialsSignature = initialsParts.join(KEY_SEPARATOR);
    const labelsChanged = nextLabelSignature !== labelSignature;
    const initialsChanged = nextInitialsSignature !== initialsSignature;
    if (!labelsChanged && !initialsChanged && !firstSinceMount) {
      published = drawn;
      return;
    }
    generation++;
    const mountEpoch = epoch;
    service.acquire(owner, drawn.values(), generation, mountEpoch);
    published = drawn;
    labelSignature = nextLabelSignature;
    initialsSignature = nextInitialsSignature;
    write(
      labelsChanged || firstSinceMount
        ? { generation, mountEpoch, keys: labelKeys, labels, measured }
        : undefined,
      initialsChanged || firstSinceMount
        ? { generation, mountEpoch, keys: initialsKeys, initials }
        : undefined,
    );
    firstSinceMount = false;
  }

  return {
    setScene(next) {
      scene = next;
      publish();
    },
    setTier(next) {
      if (next === tier) return;
      tier = next;
      // Only setScene (re)mounts: a UI report that lands after release must
      // never re-pin entries for an unmounted consumer.
      if (epoch !== null) publish();
    },
    setVisibility(next) {
      visibility = next;
      if (epoch !== null) publish();
    },
    confirmRetired(keys, keysEpoch, dispose = false) {
      // Freed capacity re-runs a waiting publish via onCapacityFreed. A
      // released epoch's keys are confirmed too (the teardown); its marks
      // carry that epoch, so a newer mount's pins are never touched.
      service.confirmRetired(owner, keys, keysEpoch, { dispose });
      service.trim();
    },
    release() {
      if (epoch === null) return null;
      unsubscribe?.();
      unsubscribe = null;
      const released = service.release(owner);
      epoch = null;
      published = new Map();
      dropped = new Set();
      labelSignature = "";
      initialsSignature = "";
      waiting = false;
      firstSinceMount = true;
      return released;
    },
    generation: () => generation,
    epoch: () => epoch,
    pending: () => waiting,
  };
}
