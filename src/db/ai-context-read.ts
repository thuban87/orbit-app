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
 *   2. The free-text events column (a DIFFERENT table) is NEVER selected
 *      here. The free-text interaction column is read ONLY through the gated
 *      recent-interaction projection (rule 4). The aggregate interaction read
 *      lists ONLY channel / quality / connected / occurred_at.
 *   3. `interval_days` and `rarely_responds` are read via `getImpactInputs` for
 *      DERIVATION ONLY. They MUST NOT be placed on `PromptContext` or reach the
 *      payload (C3-M3); Unbound intensity is explicitly neutral.
 *   4. Memories come ONLY through `listAiEligibleMemories`, whose SQL predicate
 *      is two-sided (D-31, D-49, D-102, D-103). An interaction note is gated in
 *      the SQL projection below (a CASE, never a WHERE, so ADR-078's structured
 *      rows keep flowing). Off Limits, Last Talked About and Current Location
 *      are never read here, in any shape (D-09, D-16). Custom values come ONLY
 *      through the validated `col_name` boundary in field-values-dao, filtered
 *      to live, non-quarantined, `share_with_ai=1` defs. NEVER add a fallback
 *      query that widens the allowlist, and NEVER interpolate a label as SQL.
 * =============================================================================
 */
import type {
  CadenceAggregate,
  PromptContext,
  QualityAggregate,
  RecentInteractionContext,
  SharedFieldValue,
} from "@/ai/prompt-types";
import { listDefs } from "@/db/field-defs-dao";
import type { CustomFieldDef } from "@/db/field-types";
import { getValuesForContact } from "@/db/field-values-dao";
import { getImpactInputs } from "@/db/impact-read";
import { listAiEligibleMemories } from "@/db/memories-read";
import { isMemoryTypeKey, MEMORY_TYPE_REGISTRY } from "@/db/memory-registry";
import type { SqlExecutor } from "@/db/types";
import {
  computeContactGravity,
  computeContactIntensity,
} from "@/services/impact";
import { formatLocalDate } from "@/utils/dates";

const UNSPECIFIED_CHANNEL = "unspecified";

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

/** One recent interaction with its internal id (never serialized). */
interface RecentInteractionRow {
  id: number;
  context: RecentInteractionContext;
}

/**
 * The structured recent-interaction branch of the closed egress projection
 * (ADR-078, unchanged by ADR-107). Always carries the compact date/time,
 * channel, and Tone for the contact's three newest rows. The note is gated in
 * SQL by a CASE projection (D-13: fails closed in SQL, never in JS only): it is
 * projected only when the interaction allows AI, is not locked by a move into
 * Off Limits (D-103), and no memory linked to that note has AI off (D-49: one
 * switch covers every place the text appears). Rows are never filtered, so the
 * structured fields keep flowing. Blank notes are minimized away.
 *
 * Group Notes — the Phase 33 event-level shared record — live in the SEPARATE
 * `group_events` table and are DELIBERATELY never read here, so they can never
 * be carried under any `allow_ai` value (D-08). Only `interactions.note` (the
 * per-interaction note) is read, `contactId` is the sole `?`-bound value, and
 * only static column names are literal text. The interaction id is read for
 * the linked-note de-duplication in `readPromptContext` and is never placed on
 * the context. Pure read — no transaction.
 */
async function readRecentInteractions(
  exec: SqlExecutor,
  contactId: number,
): Promise<RecentInteractionRow[]> {
  const rows = await exec.getAllAsync<{
    id: number;
    occurred_at: string;
    channel: string;
    quality: string | null;
    note: string | null;
  }>(
    `SELECT id, occurred_at, channel, quality,
            CASE WHEN allow_ai = 1
                  AND note_ai_locked = 0
                  AND NOT EXISTS (
                        SELECT 1 FROM memories m
                         WHERE m.interaction_id = interactions.id
                           AND m.link_source = 'note'
                           AND m.allow_ai = 0)
                 THEN note END AS note
       FROM interactions
      WHERE contact_id = ?
      ORDER BY occurred_at DESC, id DESC
      LIMIT 3`,
    [contactId],
  );
  return rows.map((row) => {
    const projection: RecentInteractionContext = {
      occurredAt: row.occurred_at,
      channel: row.channel,
      tone: row.quality,
    };
    return {
      id: row.id,
      context: row.note?.trim()
        ? { ...projection, note: row.note }
        : projection,
    };
  });
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
 * A note-linked memory whose interaction note is already sent among the recent
 * interactions is left out, so a linked note is sent once (D-37: the two texts
 * are the same; convergence c1 F-D11). This only narrows egress.
 */
async function readSharedMemories(
  exec: SqlExecutor,
  contactId: number,
  sentNoteInteractionIds: ReadonlySet<number>,
): Promise<SharedFieldValue[]> {
  const rows = await listAiEligibleMemories(exec, contactId);
  const out: SharedFieldValue[] = [];
  for (const row of rows) {
    if (row.value === null || row.value.trim() === "") {
      continue;
    }
    if (
      row.link_source === "note" &&
      row.interaction_id !== null &&
      sentNoteInteractionIds.has(row.interaction_id)
    ) {
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

  // (2) Derived gravity tier + intensity aggregate. getImpactInputs reads
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

  // (3) Neutral interaction aggregates + newest channel (no prose selected).
  const aggregates = await readInteractionAggregates(exec, contactId);

  // (4) Live opted-in custom values, by label, through the validated boundary.
  const sharedFields = await readSharedFields(exec, contactId);

  // (5) SQL-gated recent-interaction notes (D-49, D-103). Off Limits, Last
  //     Talked About and Current Location are carried in no shape (D-09, D-16).
  const recentRows = await readRecentInteractions(exec, contactId);
  const recentInteractions = recentRows.map((row) => row.context);
  const sentNoteInteractionIds = new Set(
    recentRows
      .filter((row) => row.context.note !== undefined)
      .map((row) => row.id),
  );

  // (6) SQL-gated memories, minus note-linked ones already sent as a note.
  const sharedMemories = await readSharedMemories(
    exec,
    contactId,
    sentNoteInteractionIds,
  );

  return {
    contactName: identity.name,
    category: identity.categoryName ?? "",
    gravityTier,
    intensity,
    quality: aggregates.quality,
    cadence: aggregates.cadence,
    newestChannel: aggregates.newestChannel,
    sharedFields,
    sharedMemories,
    recentInteractions,
  };
}
