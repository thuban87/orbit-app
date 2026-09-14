/**
 * The CLOSED outbound-data allowlist (AI-03 / H1), global personalization, and
 * the immutable resolved prompt (AI-04) for AI message suggestions.
 *
 * =============================================================================
 * THIS TYPE IS A PRIVACY / SECURITY CONTROL — READ BEFORE EDITING:
 *
 *   `PromptContext` enumerates EVERY field that may be SERIALIZED into an AI
 *   prompt and cross the device boundary. It is a CLOSED type: adding a field is
 *   a deliberate COMPILE-TIME widening, never a silent runtime broadening.
 *   `readPromptContext` (ai-context-read.ts) is the sole contact-data projection;
 *   the Compose boundary adds only the separately approved global Writing Style
 *   and personalization rows — never a broad contact/editor record.
 *
 *   Local-first is a product commitment (CLAUDE.md): contact data is DATA, never
 *   instructions. `resolvePrompt` (prompt-template.ts) is the sole construction
 *   path from a `PromptContext` to a `ResolvedPrompt`; the resulting object is
 *   DEEPLY FROZEN and the SAME instance flows unchanged to the inspector, the
 *   per-provider acknowledgement, and the provider adapter (Plan 05).
 * =============================================================================
 */

/**
 * One ranked conversational-fuel entry that is eligible for a prompt. Sourced
 * ONLY through `getRankedFuel`, which already excludes `off_limits`,
 * unconfirmed `source='ai'`, and blank rows IN SQL (fuel-read.ts). `ageDays` is
 * the whole-day age of the row at read time (FUEL-04 age), never the raw
 * `created_at` timestamp.
 */
export interface RankedFuelEntry {
  readonly text: string;
  readonly kind: string;
  readonly label?: string;
  readonly ageDays: number;
}

/**
 * The neutral this-period contact-rate / long-run cadence aggregate derived from
 * the interaction log (LOG-03 intensity). Every field is a derived NUMBER — the
 * raw interaction rows, and in particular the free-text interaction column, are
 * never serialized. `intendedPerPeriod` is a floor, not a ceiling (Cluster G).
 *
 * `periodDays` is DELIBERATELY OMITTED: it equals the contact's `interval_days`
 * verbatim, and `interval_days` is a derivation-only input that must NEVER cross
 * the egress boundary (C3-M3). The neutral multiple / cadence below carry the
 * intensity signal without disclosing the raw interval.
 */
export interface IntensityAggregate {
  readonly currentCount: number;
  readonly intendedPerPeriod: number;
  readonly multiple: number;
  readonly trailingAvgGapDays: number | null;
}

/**
 * A neutral aggregate distribution of interaction quality over a contact's
 * history. A pure count, never the underlying rows and never any free-text column.
 *
 * FIELD-NAME / VALUE MISMATCH IS DELIBERATE (D-06, RESEARCH A3): Phase 32 renamed
 * the STORED vocabulary to Tone but KEPT these internal field names to hold the
 * blast radius. The mapping is exact and unmissable:
 *   `good`  = Positive
 *   `fine`  = Neutral
 *   `hard`  = Negative
 * `readInteractionAggregates` compares the migrated Positive/Neutral/Negative
 * literals and tallies them into these fields; do NOT ripple a rename into the
 * prompt builder this phase.
 */
export interface QualityAggregate {
  /** Count of `Positive` (Tone) interactions. */
  readonly good: number;
  /** Count of `Neutral` (Tone) interactions. */
  readonly fine: number;
  /** Count of `Negative` (Tone) interactions. */
  readonly hard: number;
}

/**
 * Neutral cadence COUNT aggregates over the interaction log: how many
 * touchpoints exist and how many connected. Counts only — no timestamps, no
 * prose, no per-row data leaves through here.
 */
export interface CadenceAggregate {
  readonly totalCount: number;
  readonly connectedCount: number;
}

/**
 * One live, opted-in custom field value (`share_with_ai=1`, non-quarantined,
 * non-blank), displayed by its user label. Resolved through the validated
 * `col_name` boundary in field-values-dao — a label is NEVER interpolated as SQL.
 */
export interface SharedFieldValue {
  readonly label: string;
  readonly value: string;
}

/** The bounded latest-three interaction projection approved by ADR-078. */
export interface RecentInteractionContext {
  readonly occurredAt: string;
  readonly channel: string;
  readonly tone: string | null;
  /** Present only when this interaction's per-row Allow AI gate is enabled. */
  readonly note?: string;
}

/** Structured, durable user-authored voice controls for prompt personalization. */
export interface PromptWritingStyle {
  readonly tone: "casual" | "balanced" | "polished" | "custom";
  readonly length: "concise" | "normal" | "detailed" | "custom";
  readonly directness: "gentle" | "balanced" | "direct" | "custom";
  readonly freeform: string;
}

/** A global personalization section. `enabled` is its only egress gate. */
export interface PromptPersonalizationSection {
  readonly uid: string;
  readonly title: string;
  readonly body: string;
  readonly enabled: boolean;
  readonly displayOrder: number;
}

/**
 * The CLOSED allowlist of contact-derived data that may enter an AI prompt.
 *
 * Direct-contact fields are EXACTLY two: `contactName` and `category` (the
 * category NAME, resolved via a narrow join — there is no `category` column on
 * `contacts`). Every other `contacts` column (phone, email, birthday, photo,
 * links, snooze, archive state, raw `last_contact`, `category_id` itself, and
 * the derivation-only `interval_days` / `rarely_responds`) is PROHIBITED from
 * egress. Everything else here is ranked eligible fuel, neutral derived
 * aggregates, or live opted-in field values.
 */
export interface PromptContext {
  /** The contact's display name — one of the two permitted direct identifiers. */
  readonly contactName: string;
  /**
   * The category NAME (empty string when the contact has no category). Resolved
   * through a narrow `LEFT JOIN categories` — NEVER the raw `category_id`.
   */
  readonly category: string;
  /** Ranked eligible fuel with age, in rank order (≤ any resolver limit). */
  readonly rankedFuel: ReadonlyArray<RankedFuelEntry>;
  /** Coarse named gravity tier (LOG-03) — never the raw gravity number. */
  readonly gravityTier: string;
  /** Neutral this-period rate / cadence aggregate. */
  readonly intensity: IntensityAggregate;
  /** Neutral quality-distribution aggregate. */
  readonly quality: QualityAggregate;
  /** Neutral interaction-count aggregate. */
  readonly cadence: CadenceAggregate;
  /** The newest interaction's channel, with an explicit `"unspecified"`. */
  readonly newestChannel: string;
  /** Live, opted-in custom field values keyed by display label. */
  readonly sharedFields: ReadonlyArray<SharedFieldValue>;
  /**
   * Live Memories explicitly opted into AI egress. Each entry is serialized by
   * `resolvePrompt` in its own bounded DATA block; the read boundary always
   * supplies an array.
   */
  readonly sharedMemories?: ReadonlyArray<SharedFieldValue>;
  /**
   * The newest three interactions. Date/time, channel, and Tone are always
   * carried; `note` exists only when that row's `allow_ai=1`. Group Notes are
   * never read. Each row is serialized explicitly in its own bounded DATA block.
   */
  readonly recentInteractions?: ReadonlyArray<RecentInteractionContext>;
  /** Durable global Writing Style. When present it supersedes the legacy note. */
  readonly writingStyle?: PromptWritingStyle;
  /** Global context sections; only enabled rows are serialized by resolvePrompt. */
  readonly personalizationSections?: ReadonlyArray<PromptPersonalizationSection>;
}

/**
 * One safe truncation disclosure. `category` names WHAT was trimmed (e.g.
 * "conversational fuel", "style template", or a field label); `detail` is a
 * safe, count-oriented description. Neither field ever contains the omitted
 * content itself (no retained withheld text — AI-04).
 */
export interface TruncationNotice {
  readonly category: string;
  readonly detail: string;
}

/**
 * The single immutable resolved prompt. `prompt`, `inspectorDisplay`, and
 * `payload` are the SAME exact string the user inspects and the adapter sends —
 * byte-identical by construction (strict reference identity, Plan 05 / M1). The
 * whole object is DEEPLY frozen: `Object.isFrozen` is true for it and for its
 * nested `truncations` array and entries.
 */
export interface ResolvedPrompt {
  /** The exact outbound prompt string. */
  readonly prompt: string;
  /** What the pre-send inspector renders — the SAME string instance as `prompt`. */
  readonly inspectorDisplay: string;
  /** Safe truncation disclosures (no omitted content retained). */
  readonly truncations: ReadonlyArray<TruncationNotice>;
  /** The adapter payload — the SAME string instance as `prompt`. */
  readonly payload: string;
}
