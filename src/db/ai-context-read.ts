/**
 * AI-context read (AI-03 / H1) — the SOLE outbound-data projection that turns a
 * contact's local record into a closed `PromptContext`. This is the structural
 * data-minimization boundary: the ONLY contact-derived data that can ever reach
 * an AI prompt is what this dedicated read serializes, and it serializes ONLY the
 * columns named in the closed `PromptContext` type (prompt-types.ts).
 *
 * =============================================================================
 * LOAD-BEARING PRIVACY RULES — READ BEFORE EDITING:
 *   1. NEVER a broad contact/editor read. Select the ONE permitted `contacts`
 *      column (`name`) explicitly by name, plus the category NAME through a
 *      narrow `LEFT JOIN categories`. No `SELECT *`. Every other `contacts`
 *      column — phone, email, birthday, photo, links, snooze, archive state, raw
 *      `last_contact`, `category_id` itself — is prohibited from egress.
 *   2. The free-text interaction column and the free-text events column (a
 *      DIFFERENT table) are NEVER selected here. The aggregate interaction read
 *      lists ONLY channel / quality / connected / occurred_at.
 *   3. `interval_days` and `rarely_responds` are read via `getImpactInputs` for
 *      DERIVATION ONLY. They MUST NOT be placed on `PromptContext` or reach the
 *      payload (C3-M3); Unbound intensity is explicitly neutral.
 *   4. Fuel comes ONLY through `getRankedFuel` (off_limits / unconfirmed-AI /
 *      blank already excluded in SQL). Custom values come ONLY through the
 *      validated `col_name` boundary in field-values-dao, filtered to live,
 *      non-quarantined, `share_with_ai=1` defs. NEVER add a fallback query that
 *      widens the allowlist, and NEVER interpolate a label as SQL.
 * =============================================================================
 */
import type {
  CadenceAggregate,
  PromptContext,
  QualityAggregate,
  RankedFuelEntry,
  SharedFieldValue,
} from "@/ai/prompt-types";
import { listDefs } from "@/db/field-defs-dao";
import type { CustomFieldDef } from "@/db/field-types";
import { getValuesForContact } from "@/db/field-values-dao";
import { getRankedFuel } from "@/db/fuel-read";
import { getImpactInputs } from "@/db/impact-read";
import { listAiEligibleMemories } from "@/db/memories-read";
import { isMemoryTypeKey, MEMORY_TYPE_REGISTRY } from "@/db/memory-registry";
import type { SqlExecutor } from "@/db/types";
import {
  computeContactGravity,
  computeContactIntensity,
} from "@/services/impact";
import { formatLocalDate } from "@/utils/dates";

const MS_PER_DAY = 86_400_000;
const UNSPECIFIED_CHANNEL = "unspecified";

/**
 * Parse a stored `YYYY-MM-DD HH:MM:SS` (or bare `YYYY-MM-DD`) as LOCAL ms —
 * local components so there is no UTC evening off-by-one (dates.ts convention).
 * Returns null for an unparseable value so age falls back to 0 rather than throw.
 */
function parseLocalMs(stored: string): number | null {
  const m = stored
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) {
    return null;
  }
  const [, y, mo, d, hh, mm, ss] = m;
  return new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(hh ?? 0),
    Number(mm ?? 0),
    Number(ss ?? 0),
  ).getTime();
}

/** Whole-day age (clamped ≥ 0) of `createdAt` relative to `now`. */
function ageDaysOf(createdAt: string, now: string): number {
  const createdMs = parseLocalMs(createdAt);
  const nowMs = parseLocalMs(now);
  if (createdMs === null || nowMs === null) {
    return 0;
  }
  return Math.max(0, Math.floor((nowMs - createdMs) / MS_PER_DAY));
}

/** Default local wall-clock `YYYY-MM-DD HH:MM:SS` (production callers omit `now`). */
function localNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${formatLocalDate(d)} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}:${pad(d.getSeconds())}`;
}

/** One row of the aggregate interaction read — NO free-text column is selected. */
interface AggregateRow {
  channel: string;
  quality: string | null;
  connected: number;
}

/**
 * The aggregate interaction read: neutral counts + newest channel ONLY. Selects
 * `channel`, `quality`, `connected`, `occurred_at` — and DELIBERATELY not the
 * free-text interaction column, nor anything from the events table. `contactId`
 * is the sole `?`-bound value; rows arrive newest-first so `rows[0].channel` is
 * the newest channel. Pure read — no transaction.
 */
async function readInteractionAggregates(
  exec: SqlExecutor,
  contactId: number,
): Promise<{
  quality: QualityAggregate;
  cadence: CadenceAggregate;
  newestChannel: string;
}> {
  const rows = await exec.getAllAsync<AggregateRow>(
    `SELECT channel, quality, connected
       FROM interactions
      WHERE contact_id = ?
      ORDER BY occurred_at DESC, id DESC`,
    [contactId],
  );

  // The QualityAggregate field names stay { good, fine, hard } (RESEARCH A3,
  // minimal blast radius) but the STORED vocabulary is now the Tone vocabulary
  // (D-06): good = 'Positive', fine = 'Neutral', hard = 'Negative'. Compare the
  // migrated literals — a stale 'good'/'fine'/'hard' comparison here would count
  // zero on every device the instant migration 025 lands.
  let good = 0;
  let fine = 0;
  let hard = 0;
  let connectedCount = 0;
  for (const r of rows) {
    if (r.connected === 1) {
      connectedCount += 1;
    }
    if (r.quality === "Positive") {
      good += 1;
    } else if (r.quality === "Neutral") {
      fine += 1;
    } else if (r.quality === "Negative") {
      hard += 1;
    }
  }

  return {
    quality: { good, fine, hard },
    cadence: { totalCount: rows.length, connectedCount },
    // channel is NOT NULL DEFAULT 'unspecified'; fall back explicitly when empty.
    newestChannel: rows[0]?.channel ?? UNSPECIFIED_CHANNEL,
  };
}

/**
 * Read the live, opted-in custom field values for a contact: only
 * non-quarantined defs flagged `share_with_ai=1`, resolved through the validated
 * `col_name` boundary and displayed by label. Null / blank values are simply
 * absent (less data, never an error or a disclosure). Preserves display order.
 */
async function readSharedFields(
  exec: SqlExecutor,
  contactId: number,
): Promise<SharedFieldValue[]> {
  // listDefs already excludes quarantined defs; keep only the opted-in ones.
  const liveDefs = await listDefs(exec, { includeQuarantined: false });
  const sharedDefs: CustomFieldDef[] = liveDefs.filter(
    (d) => d.share_with_ai === 1,
  );
  if (sharedDefs.length === 0) {
    return [];
  }

  const values = await getValuesForContact(exec, contactId, sharedDefs);
  const out: SharedFieldValue[] = [];
  for (const def of sharedDefs) {
    const raw = values[def.col_name];
    if (raw === null || raw === undefined) {
      continue;
    }
    if (raw.trim() === "") {
      continue;
    }
    out.push({ label: def.label, value: raw });
  }
  return out;
}

/**
 * The Memory branch of the closed egress projection. Permission is enforced by
 * listAiEligibleMemories in SQL; blanks are minimized away before serialization.
 */
async function readSharedMemories(
  exec: SqlExecutor,
  contactId: number,
): Promise<SharedFieldValue[]> {
  const rows = await listAiEligibleMemories(exec, contactId);
  const out: SharedFieldValue[] = [];
  for (const row of rows) {
    if (row.value === null || row.value.trim() === "") {
      continue;
    }
    const label =
      row.custom_label?.trim() ||
      (isMemoryTypeKey(row.type)
        ? MEMORY_TYPE_REGISTRY[row.type].displayName
        : "Memory");
    out.push({ label, value: row.value });
  }
  return out;
}

/**
 * Build the closed `PromptContext` for one contact — the sole projection that
 * decides what may cross the device boundary into an AI prompt. `now` defaults
 * to the local wall-clock (tests pass an explicit value for determinism).
 *
 * Throws when the contact does not exist (loud failure, never a silent broad
 * read). Every value is `?`-bound; the only interpolated identifiers are the
 * `isSafeColName`-guarded custom-field column names inside field-values-dao.
 */
export async function readPromptContext(
  exec: SqlExecutor,
  contactId: number,
  now: string = localNow(),
): Promise<PromptContext> {
  // (1) The two permitted direct-contact identifiers. Select `name` explicitly
  //     and resolve the category NAME through a narrow join — never category_id,
  //     never any other contacts column, never SELECT *.
  const identity = await exec.getFirstAsync<{
    name: string;
    categoryName: string | null;
  }>(
    `SELECT c.name AS name, cat.name AS categoryName
       FROM contacts c
       LEFT JOIN categories cat ON cat.id = c.category_id
      WHERE c.id = ?`,
    [contactId],
  );
  if (!identity) {
    throw new Error(`readPromptContext: no contact id=${contactId}`);
  }

  // (2) Ranked eligible fuel (off_limits / unconfirmed-AI / blank excluded in
  //     SQL). Keep rank order; attach whole-day age; drop the raw timestamp.
  const fuelRows = await getRankedFuel(exec, contactId);
  const rankedFuel: RankedFuelEntry[] = fuelRows.map((f) => {
    const entry: RankedFuelEntry = {
      text: f.text ?? "",
      kind: f.kind,
      ageDays: ageDaysOf(f.created_at, now),
    };
    return f.label != null ? { ...entry, label: f.label } : entry;
  });

  // (3) Derived gravity tier + intensity aggregate. getImpactInputs reads
  //     lifecycle plus interval_days / rarely_responds internally; none of those
  //     raw values are placed on PromptContext (C3-M3).
  const impact = await getImpactInputs(exec, contactId);
  if (!impact) {
    throw new Error(`readPromptContext: missing impact inputs id=${contactId}`);
  }
  const gravityTier = computeContactGravity(impact, now).tierName;
  const intensityResult = computeContactIntensity(impact, now);
  const intensity =
    "available" in intensityResult
      ? {
          currentCount: 0,
          intendedPerPeriod: 0,
          multiple: 0,
          trailingAvgGapDays: null,
        }
      : {
          // periodDays is intentionally NOT surfaced — it equals interval_days,
          // a derivation-only input barred from egress (C3-M3).
          currentCount: intensityResult.currentCount,
          intendedPerPeriod: intensityResult.intendedPerPeriod,
          multiple: intensityResult.multiple,
          trailingAvgGapDays: intensityResult.trailingAvgGapDays,
        };

  // (4) Neutral interaction aggregates + newest channel (no prose selected).
  const aggregates = await readInteractionAggregates(exec, contactId);

  // (5) Live opted-in custom values, by label, through the validated boundary.
  const sharedFields = await readSharedFields(exec, contactId);
  // The existing fuel projection is intentionally unaffected: its SQL still
  // excludes source='ai', while migration 017 leaves no such fuel rows to read.
  const sharedMemories = await readSharedMemories(exec, contactId);

  return {
    contactName: identity.name,
    category: identity.categoryName ?? "",
    rankedFuel,
    gravityTier,
    intensity,
    quality: aggregates.quality,
    cadence: aggregates.cadence,
    newestChannel: aggregates.newestChannel,
    sharedFields,
    sharedMemories,
  };
}
