import type { SqlExecutor } from "@/db/types";
import { isBirthdayUnreadable } from "@/logic/picked-contact-map";

export interface BulkReviewFlag {
  importSessionRowId: number;
  contactId: number;
  contactName: string;
  /** v1 is birthday-specific; migration 013's storage row is future-extensible. */
  flagType: "birthday";
  rawValue: string;
}

interface BulkReviewDbRow {
  import_session_row_id: number;
  contact_id: number;
  contact_name: string;
  source_payload: string;
}

function sourceBirthday(sourcePayload: string): string | null {
  try {
    const parsed: unknown = JSON.parse(sourcePayload);
    if (typeof parsed !== "object" || parsed === null) return null;
    const birthday = (parsed as { birthday?: unknown }).birthday;
    return typeof birthday === "string" ? birthday : null;
  } catch {
    return null;
  }
}

/**
 * Read unresolved unreadable-birthday flags. The source snapshot is immutable,
 * so resolution state is intentionally represented by migration 013's separate
 * `(import_session_row_id, flag_type)` row rather than mutating source_payload.
 */
export async function listBulkReviewFlags(
  exec: SqlExecutor,
): Promise<BulkReviewFlag[]> {
  const rows = await exec.getAllAsync<BulkReviewDbRow>(
    `SELECT r.id AS import_session_row_id, r.contact_id, c.name AS contact_name,
            r.source_payload
       FROM import_session_rows r
       JOIN contacts c ON c.id = r.contact_id
       LEFT JOIN bulk_review_resolutions resolution
         ON resolution.import_session_row_id = r.id
        AND resolution.flag_type = 'birthday'
      WHERE r.contact_id IS NOT NULL
        AND resolution.id IS NULL
      ORDER BY r.id`,
  );

  return rows.flatMap((row) => {
    const rawValue = sourceBirthday(row.source_payload);
    return rawValue !== null && isBirthdayUnreadable(rawValue)
      ? [
          {
            importSessionRowId: row.import_session_row_id,
            contactId: row.contact_id,
            contactName: row.contact_name,
            flagType: "birthday" as const,
            rawValue,
          },
        ]
      : [];
  });
}
