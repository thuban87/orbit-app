import type { ReadOnlyExecutor } from "@/db/transaction";

export const PROFILE_HISTORY_MODULE_ID = "interaction-history" as const;

export interface ProfileHistoryEntry {
  id: number;
  occurredAt: string;
  channel: string;
  direction: string | null;
  connected: number;
  quality: string | null;
}

export type ProfileHistorySummary =
  | { kind: "empty"; text: "No interactions yet" }
  | { kind: "latest"; lastContact: string; text: string };

export interface ProfileHistory {
  moduleId: typeof PROFILE_HISTORY_MODULE_ID;
  summary: ProfileHistorySummary;
  entries: ProfileHistoryEntry[];
  viewAll: {
    moduleId: typeof PROFILE_HISTORY_MODULE_ID;
    contactId: number;
  };
}

interface ProfileHistoryDbRow {
  last_contact: string | null;
  id: number | null;
  occurred_at: string | null;
  channel: string | null;
  direction: string | null;
  connected: number | null;
  quality: string | null;
}

/**
 * Read the deliberately interim Profile history projection. The closed SELECT
 * omits interaction prose, binds the contact id, and hard-limits rows to three;
 * Phase 32 can replace this renderer contract without changing persistence.
 */
export async function readProfileHistory(
  exec: ReadOnlyExecutor,
  contactId: number,
): Promise<ProfileHistory> {
  const rows = await exec.getAllAsync<ProfileHistoryDbRow>(
    `SELECT c.last_contact, i.id, i.occurred_at, i.channel,
            i.direction, i.connected, i.quality
       FROM contacts c
       LEFT JOIN interactions i ON i.contact_id = c.id
      WHERE c.id = ?
      ORDER BY i.occurred_at DESC, i.id DESC
      LIMIT 3`,
    [contactId],
  );
  const entries = rows
    .filter(
      (row): row is ProfileHistoryDbRow & { id: number; occurred_at: string } =>
        row.id !== null && row.occurred_at !== null,
    )
    .map(
      (row): ProfileHistoryEntry => ({
        id: row.id,
        occurredAt: row.occurred_at,
        channel: row.channel ?? "unspecified",
        direction: row.direction,
        connected: row.connected ?? 1,
        quality: row.quality,
      }),
    );
  const latest = rows[0]?.last_contact ?? entries[0]?.occurredAt ?? null;
  return {
    moduleId: PROFILE_HISTORY_MODULE_ID,
    summary:
      latest === null
        ? { kind: "empty", text: "No interactions yet" }
        : {
            kind: "latest",
            lastContact: latest,
            text: `Last interaction ${latest}`,
          },
    entries,
    viewAll: { moduleId: PROFILE_HISTORY_MODULE_ID, contactId },
  };
}
