/**
 * Merge review counts: what the absorbed contact brings to the survivor, as
 * the merge review screen lists it (MergeImpactSummary). A pure read — no
 * transaction. Every table name is a literal and the contact id is `?`-bound.
 *
 * 38.12 D-44: one count for every child table `mergeContacts` reparents (the
 * `for (const table of [...])` list in merge-dao.ts; merge-impact-read.test.ts
 * pins the match): interactions, events, off_limits, custom_field_values,
 * contact_links, contact_methods, external_contact_links,
 * interaction_assists, memories, relationships, current_state_entries. The
 * audit trails merge also moves (`field_history`,
 * `custom_field_value_history`) are not user data and are not listed.
 *
 * Two counts are narrowed to what the person would recognise: custom field
 * values count only non-blank values (a blank row moves nothing), and
 * interaction assists count only pending ones (a resolved assist is already an
 * interaction or was dismissed).
 *
 * Counts are what the merge carries over, not raw rows (38.12 review
 * B-WR-09): external links count only active ones; given the survivor,
 * contact methods leave out canonical duplicates of the survivor's (the merge
 * deletes those), and custom values leave out the ones the survivor's value
 * wins (the merge drops those to history).
 */
import type { MergeResolutions } from "@/db/merge-dao";
import type { SqlExecutor } from "@/db/types";

export interface MergeImpactCounts {
  interactions: number;
  events: number;
  methods: number;
  externalLinks: number;
  /** `memories` (every Things to Remember memory type). */
  memories: number;
  /** `relationships` owned by the absorbed contact. */
  keyPeople: number;
  /** `current_state_entries` (Last Talked About / Current Location). */
  currentState: number;
  offLimits: number;
  /** Non-blank `custom_field_values`. */
  customValues: number;
  /** `contact_links` (the person's saved links). */
  links: number;
  /** Pending `interaction_assists`. */
  pendingAssists: number;
}

async function count(
  exec: SqlExecutor,
  sql: string,
  contactId: number,
  ...more: number[]
): Promise<number> {
  const row = await exec.getFirstAsync<{ n: number }>(sql, [
    contactId,
    ...more,
  ]);
  return row?.n ?? 0;
}

function isBlank(value: string | null): boolean {
  return value == null || value.trim() === "";
}

/**
 * Non-blank absorbed custom values that end up on the survivor, mirroring
 * mergeContacts' rule: a value moves when the survivor has none for that
 * field, or when it wins (an explicit "absorbed" choice, or no choice and a
 * blank survivor value). A stored photo with no survivor value, or chosen,
 * moves through the photo transfer.
 */
async function movedCustomValues(
  exec: SqlExecutor,
  absorbedId: number,
  survivorId: number,
  resolutions: MergeResolutions | undefined,
): Promise<number> {
  const [absorbed, survivor] = await Promise.all(
    [absorbedId, survivorId].map((id) =>
      exec.getAllAsync<{ field_def_id: number; value: string | null }>(
        "SELECT field_def_id, value FROM custom_field_values WHERE contact_id = ?",
        [id],
      ),
    ),
  );
  const survivorById = new Map(
    survivor.map((row) => [row.field_def_id, row.value]),
  );
  return absorbed.filter((row) => {
    if (isBlank(row.value)) return false;
    if (!survivorById.has(row.field_def_id)) return true;
    const choice = resolutions?.customFields?.[row.field_def_id];
    const own = survivorById.get(row.field_def_id) ?? null;
    if (choice === "absorbed") return true;
    if (choice === "survivor") return false;
    // Same fallback for text and stored photos (merge-photo-rehome `selected`).
    return isBlank(own);
  }).length;
}

/**
 * The row counts the merge review lists for the contact being absorbed.
 * With `survivor`, counts leave out what the merge drops (B-WR-09).
 */
export async function readMergeImpactCounts(
  exec: SqlExecutor,
  contactId: number,
  survivor?: { survivorId: number; resolutions?: MergeResolutions },
): Promise<MergeImpactCounts> {
  const [
    interactions,
    events,
    methods,
    externalLinks,
    memories,
    keyPeople,
    currentState,
    offLimits,
    customValues,
    links,
    pendingAssists,
  ] = await Promise.all([
    count(
      exec,
      "SELECT COUNT(*) AS n FROM interactions WHERE contact_id = ?",
      contactId,
    ),
    count(
      exec,
      "SELECT COUNT(*) AS n FROM events WHERE contact_id = ?",
      contactId,
    ),
    survivor
      ? count(
          exec,
          `SELECT COUNT(*) AS n FROM contact_methods a WHERE contact_id = ?
             AND (a.canonical_value IS NULL OR NOT EXISTS (
               SELECT 1 FROM contact_methods s
                WHERE s.contact_id = ? AND s.method_type = a.method_type
                  AND s.canonical_value = a.canonical_value))`,
          contactId,
          survivor.survivorId,
        )
      : count(
          exec,
          "SELECT COUNT(*) AS n FROM contact_methods WHERE contact_id = ?",
          contactId,
        ),
    count(
      exec,
      "SELECT COUNT(*) AS n FROM external_contact_links WHERE contact_id = ? AND is_active = 1",
      contactId,
    ),
    count(
      exec,
      "SELECT COUNT(*) AS n FROM memories WHERE contact_id = ?",
      contactId,
    ),
    count(
      exec,
      "SELECT COUNT(*) AS n FROM relationships WHERE contact_id = ?",
      contactId,
    ),
    count(
      exec,
      "SELECT COUNT(*) AS n FROM current_state_entries WHERE contact_id = ?",
      contactId,
    ),
    count(
      exec,
      "SELECT COUNT(*) AS n FROM off_limits WHERE contact_id = ?",
      contactId,
    ),
    survivor
      ? movedCustomValues(
          exec,
          contactId,
          survivor.survivorId,
          survivor.resolutions,
        )
      : count(
          exec,
          "SELECT COUNT(*) AS n FROM custom_field_values WHERE contact_id = ? AND NULLIF(TRIM(COALESCE(value, '')), '') IS NOT NULL",
          contactId,
        ),
    count(
      exec,
      "SELECT COUNT(*) AS n FROM contact_links WHERE contact_id = ?",
      contactId,
    ),
    count(
      exec,
      "SELECT COUNT(*) AS n FROM interaction_assists WHERE contact_id = ? AND status = 'pending'",
      contactId,
    ),
  ]);
  return {
    interactions,
    events,
    methods,
    externalLinks,
    memories,
    keyPeople,
    currentState,
    offLimits,
    customValues,
    links,
    pendingAssists,
  };
}

/**
 * What of the absorbed person a merge does NOT keep (38.12 D-146, owner):
 * the survivor's Profile layout, background and Orrery overrides win, so the
 * absorbed person's own are dropped (their rows cascade with the absorbed
 * contact) and the merge review lists them (review B-WR-08).
 */
export interface MergeDroppedItems {
  /** The absorbed person has their own Profile layout or background. */
  profilePresentation: boolean;
  /** The absorbed person's manual include/exclude choices in Orrery systems. */
  orrerySystemChoices: number;
}

export async function readMergeDroppedItems(
  exec: SqlExecutor,
  absorbedId: number,
): Promise<MergeDroppedItems> {
  const [presentation, orrerySystemChoices] = await Promise.all([
    count(
      exec,
      `SELECT COUNT(*) AS n FROM profile_contact_presentation
        WHERE contact_id = ?
          AND (layout_template_uid IS NOT NULL
            OR freeform_layout_json IS NOT NULL
            OR background_template_uid IS NOT NULL)`,
      absorbedId,
    ),
    count(
      exec,
      "SELECT COUNT(*) AS n FROM system_overrides WHERE contact_id = ?",
      absorbedId,
    ),
  ]);
  return { profilePresentation: presentation > 0, orrerySystemChoices };
}
