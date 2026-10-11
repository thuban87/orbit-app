/**
 * useContactHeader (38.9 D-45) — the name and photo a person-scoped form shows
 * in its person line (`PersonLine`, via `ShellAppBar` `person` or the Add Note
 * sheet).
 *
 * Reads the light by-id header seek (`getContactHeader`) from the local
 * database. No network on this read path (CLAUDE.md local-first). A failed read
 * logs a content-free message (T-38.9-21) and leaves the line hidden.
 */
import { useEffect, useState } from "react";
import { getContactHeader } from "@/db/contact-read";
import { getExecutor } from "@/db/database";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "use-contact-header";

export interface ContactHeaderLine {
  name: string;
  /** Stored RELATIVE photo path, or null for the initials avatar. */
  photo: string | null;
  contactId: number;
}

/**
 * Pure: the header row → the person-line shape, or null when the contact is
 * missing.
 */
export function toContactHeaderLine(
  row: { id: number; name: string; photo: string | null } | null,
): ContactHeaderLine | null {
  if (row === null) return null;
  return { name: row.name, photo: row.photo, contactId: row.id };
}

/**
 * The person line for `contactId`, or null while loading, for a missing
 * contact, after a failed read, or when no contact is chosen yet (`null`).
 */
export function useContactHeader(
  contactId: number | null | undefined,
): ContactHeaderLine | null {
  const [line, setLine] = useState<ContactHeaderLine | null>(null);

  useEffect(() => {
    setLine(null);
    if (contactId == null) return;
    let cancelled = false;
    void getContactHeader(getExecutor(), contactId)
      .then((row) => {
        if (!cancelled) setLine(toContactHeaderLine(row));
      })
      .catch((cause) => {
        Logger.error(LOG_SCOPE, "failed to load the person line", cause);
      });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  return line;
}
