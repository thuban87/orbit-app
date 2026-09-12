/**
 * Local, presentation-only Group Event reads (GRP-08 / GRP-09).
 *
 * Group Event parents are never projected as contact-history interactions. This
 * module reads `group_events` directly for browse/detail presentation, while
 * participant cards resolve only their canonical child interactions. Group
 * Notes remain in this local read path and are never an AI-egress input.
 */
import type { ReadOnlyExecutor } from "@/db/transaction";

export interface GroupEventListItem {
  readonly id: number;
  readonly uid: string;
  readonly title: string;
  readonly occurredAt: string;
  readonly channel: string | null;
  readonly quality: string | null;
  readonly duration: number | null;
  readonly groupNote: string | null;
  readonly participantCount: number;
}

export interface ListGroupEventsInput {
  readonly limit?: number;
  readonly offset?: number;
}

export interface SearchGroupEventsInput {
  readonly term: string;
}

const EVENT_LIST_COLUMNS = `ge.id,
                                  ge.uid,
                                  ge.title,
                                  ge.occurred_at AS occurredAt,
                                  ge.channel,
                                  ge.quality,
                                  ge.duration,
                                  ge.group_note AS groupNote,
                                  (SELECT COUNT(*)
                                     FROM interactions AS member
                                    WHERE member.group_event_id = ge.id) AS participantCount`;

const EVENT_LIST_ORDER = "ORDER BY ge.occurred_at DESC, ge.id DESC";

/** Escape user text for SQLite LIKE with a literal backslash escape character. */
function escapedLikeTerm(term: string): string {
  return `%${term.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
}

/**
 * Browse Group Event parents in the one canonical deterministic order. This is
 * deliberately a direct parent-table read, never a projection of interactions.
 */
export function listGroupEvents(
  exec: ReadOnlyExecutor,
  input: ListGroupEventsInput,
): Promise<GroupEventListItem[]> {
  return exec.getAllAsync<GroupEventListItem>(
    `SELECT ${EVENT_LIST_COLUMNS}
       FROM group_events AS ge
       ${EVENT_LIST_ORDER}
       LIMIT ? OFFSET ?`,
    [input.limit ?? -1, input.offset ?? 0],
  );
}

/**
 * Search Group Event titles and participant contact names. The EXISTS clause
 * prevents an event matching multiple participants from appearing more than
 * once; both LIKE values are bound and wildcards are literal user text.
 */
export function searchGroupEvents(
  exec: ReadOnlyExecutor,
  input: SearchGroupEventsInput,
): Promise<GroupEventListItem[]> {
  if (input.term.trim().length === 0) {
    return listGroupEvents(exec, {});
  }

  const likeTerm = escapedLikeTerm(input.term);
  return exec.getAllAsync<GroupEventListItem>(
    `SELECT ${EVENT_LIST_COLUMNS}
       FROM group_events AS ge
      WHERE ge.title LIKE ? ESCAPE '\\'
         OR EXISTS (
              SELECT 1
                FROM interactions AS member
                JOIN contacts AS contact ON contact.id = member.contact_id
               WHERE member.group_event_id = ge.id
                 AND contact.name LIKE ? ESCAPE '\\'
            )
       ${EVENT_LIST_ORDER}`,
    [likeTerm, likeTerm],
  );
}
