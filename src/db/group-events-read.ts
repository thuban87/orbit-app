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

export interface GroupEventParticipant {
  readonly interactionId: number;
  readonly contactId: number;
  readonly contactName: string;
  readonly contactPhoto: string | null;
  readonly channel: string;
  readonly quality: string | null;
  readonly duration: number | null;
  readonly direction: string | null;
  readonly connected: number;
  readonly geFollowChannel: number | null;
  readonly geFollowQuality: number | null;
  readonly geFollowDuration: number | null;
  readonly note: string | null;
}

export interface GroupEventDetail {
  readonly id: number;
  readonly uid: string;
  readonly title: string;
  readonly occurredAt: string;
  readonly channel: string | null;
  readonly quality: string | null;
  readonly duration: number | null;
  readonly groupNote: string | null;
  readonly participants: readonly GroupEventParticipant[];
}

export interface ListGroupEventsInput {
  readonly limit?: number;
  readonly offset?: number;
}

export interface SearchGroupEventsInput {
  readonly term: string;
}

export interface GroupEventIdInput {
  readonly groupEventId: number;
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

const EVENT_DETAIL_COLUMNS = `id,
                                    uid,
                                    title,
                                    occurred_at AS occurredAt,
                                    channel,
                                    quality,
                                    duration,
                                    group_note AS groupNote`;

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

/** Resolve canonical child interaction values for Group Event participant cards. */
export function resolveParticipants(
  exec: ReadOnlyExecutor,
  input: GroupEventIdInput,
): Promise<GroupEventParticipant[]> {
  return exec.getAllAsync<GroupEventParticipant>(
    `SELECT member.id AS interactionId,
            member.contact_id AS contactId,
            contact.name AS contactName,
            contact.photo AS contactPhoto,
            member.channel,
            member.quality,
            member.duration,
            member.direction,
            member.connected,
            member.ge_follow_channel AS geFollowChannel,
            member.ge_follow_quality AS geFollowQuality,
            member.ge_follow_duration AS geFollowDuration,
            member.note
       FROM interactions AS member
       JOIN contacts AS contact ON contact.id = member.contact_id
      WHERE member.group_event_id = ?
      ORDER BY member.id ASC`,
    [input.groupEventId],
  );
}

/** Read a Group Event presentation record and its resolved participant cards. */
export async function readGroupEventDetail(
  exec: ReadOnlyExecutor,
  input: GroupEventIdInput,
): Promise<GroupEventDetail | null> {
  const event = await exec.getFirstAsync<
    Omit<GroupEventDetail, "participants">
  >(
    `SELECT ${EVENT_DETAIL_COLUMNS}
       FROM group_events
      WHERE id = ?`,
    [input.groupEventId],
  );
  if (!event) return null;

  return {
    ...event,
    participants: await resolveParticipants(exec, input),
  };
}
