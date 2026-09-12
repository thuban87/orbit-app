/** Durable Group Event write path. The parent is context, never an interaction. */
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { rejectFutureOccurredAt } from "@/db/log-guards";
import {
  insertInteractionCore,
  recomputeLastContactCore,
} from "@/db/recency-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

export interface CreateGroupEventParticipant {
  contactId: number;
  uid: string;
  direction?: string | null;
  connected?: number;
  note?: string | null;
}

export interface CreateGroupEventInput {
  uid: string;
  title: string;
  occurredAt: string;
  now: string;
  channel?: string | null;
  quality?: string | null;
  duration?: number | null;
  groupNote?: string | null;
  participants: CreateGroupEventParticipant[];
}

/**
 * Create one Group Event and its canonical participant child interactions.
 * Every child uses the single-writer recency cores inside this one transaction.
 */
export function createGroupEvent(
  exec: SqlExecutor,
  input: CreateGroupEventInput,
): Promise<{ groupEventId: number }> {
  if (typeof input.title !== "string" || input.title.trim().length === 0) {
    return Promise.reject(new Error("createGroupEvent: title must not be blank"));
  }
  if (typeof input.uid !== "string" || input.uid.trim().length === 0) {
    return Promise.reject(new Error("createGroupEvent: uid must not be blank"));
  }
  try {
    rejectFutureOccurredAt(input.occurredAt, input.now);
  } catch (error) {
    return Promise.reject(error);
  }

  return inWriteTransaction(exec, async () => {
    const parent = await exec.runAsync(
      `INSERT INTO group_events
         (uid, title, occurred_at, channel, quality, duration, group_note, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.uid,
        input.title.trim(),
        input.occurredAt,
        input.channel ?? "In Person",
        input.quality ?? null,
        input.duration ?? null,
        input.groupNote ?? null,
        input.now,
        input.now,
      ],
    );
    const groupEventId = parent.lastInsertRowId;
    for (const participant of input.participants) {
      await insertInteractionCore(exec, participant.contactId, input.now, {
        uid: participant.uid,
        occurredAt: input.occurredAt,
        channel: input.channel ?? "In Person",
        quality: input.quality ?? null,
        duration: input.duration ?? null,
        direction: participant.direction ?? null,
        connected: participant.connected,
        note: participant.note ?? null,
        groupEventId,
        geFollowChannel: 1,
        geFollowQuality: 1,
        geFollowDuration: 1,
      });
      await recomputeLastContactCore(exec, participant.contactId, input.now);
    }
    await bumpDataRevisionCore(exec);
    return { groupEventId };
  });
}
