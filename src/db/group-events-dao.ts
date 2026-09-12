/** Durable Group Event write path. The parent is context, never an interaction. */
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { rejectFutureOccurredAt } from "@/db/log-guards";
import {
  editTouchpointFullCore,
  insertInteractionCore,
  recomputeLastContactCore,
} from "@/db/recency-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import {
  computeFollowingChildren,
  type GroupInheritanceChild,
  type InheritableGroupField,
} from "@/logic/group-inheritance";

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

export interface UpdateGroupEventPatch {
  /** Channel is non-nullable because interaction rows require a channel. */
  channel?: { value: string };
  quality?: { value: string | null };
  duration?: { value: number | null };
  /** Event-only shared context. It never materializes on child interactions. */
  groupNote?: { value: string | null };
}

export interface UpdateGroupEventInput {
  groupEventId: number;
  now: string;
  occurredAt?: string;
  patch: UpdateGroupEventPatch;
}

type ParticipantFollowChange =
  | { follow: true }
  | { follow: false; value: string | null | number };

export interface SaveParticipantEditsInput {
  interactionId: number;
  contactId: number;
  groupEventId: number;
  now: string;
  follow?: Partial<Record<InheritableGroupField, ParticipantFollowChange>>;
  fields?: {
    direction?: string | null;
    connected?: number;
    note?: string | null;
  };
}

export interface SetParticipantOverrideInput {
  interactionId: number;
  contactId: number;
  groupEventId: number;
  now: string;
  field: InheritableGroupField;
  value: string | number | null;
}

export interface ClearParticipantOverrideInput {
  interactionId: number;
  contactId: number;
  groupEventId: number;
  now: string;
  field: InheritableGroupField;
}

export interface SetParticipantFieldsInput {
  interactionId: number;
  contactId: number;
  groupEventId: number;
  now: string;
  fields: NonNullable<SaveParticipantEditsInput["fields"]>;
}

interface GroupEventRow {
  id: number;
  occurred_at: string;
  channel: string | null;
  quality: string | null;
  duration: number | null;
}

interface GroupChildRow extends GroupInheritanceChild {
  readonly id: number;
  readonly contactId: number;
  readonly groupEventId: number;
  readonly occurredAt: string;
  readonly note: string | null;
  readonly allowAi: number;
}

const GROUP_CHILD_SELECT = `SELECT id,
                                    contact_id AS contactId,
                                    group_event_id AS groupEventId,
                                    occurred_at AS occurredAt,
                                    channel,
                                    direction,
                                    connected,
                                    quality,
                                    note,
                                    duration,
                                    allow_ai AS allowAi,
                                    ge_follow_channel AS geFollowChannel,
                                    ge_follow_quality AS geFollowQuality,
                                    ge_follow_duration AS geFollowDuration
                               FROM interactions`;

const followColumn: Record<InheritableGroupField, string> = {
  channel: "ge_follow_channel",
  quality: "ge_follow_quality",
  duration: "ge_follow_duration",
};

const INHERITABLE_FIELDS = ["channel", "quality", "duration"] as const;

function assertInheritableField(
  field: string,
): asserts field is InheritableGroupField {
  if (!(INHERITABLE_FIELDS as readonly string[]).includes(field)) {
    throw new Error(`Group Event field ${field} cannot follow the event`);
  }
}

function eventValue(
  event: GroupEventRow,
  field: InheritableGroupField,
): string | number | null {
  if (field === "channel") return event.channel ?? "unspecified";
  return event[field];
}

function assertFieldValue(
  field: InheritableGroupField,
  value: string | number | null,
): void {
  if (field === "channel" && typeof value !== "string") {
    throw new Error("Group Event channel overrides require a string value");
  }
  if (field === "quality" && value !== null && typeof value !== "string") {
    throw new Error("Group Event Tone overrides require string or null values");
  }
  if (field === "duration" && value !== null && typeof value !== "number") {
    throw new Error(
      "Group Event duration overrides require number or null values",
    );
  }
}

function changedChild(
  child: GroupChildRow,
  now: string,
  changes: Partial<
    Pick<
      GroupChildRow,
      "occurredAt" | InheritableGroupField | "direction" | "connected" | "note"
    >
  >,
) {
  return {
    interactionId: child.id,
    contactId: child.contactId,
    occurredAt: changes.occurredAt ?? child.occurredAt,
    now,
    channel: changes.channel ?? child.channel,
    direction:
      changes.direction !== undefined ? changes.direction : child.direction,
    connected: changes.connected ?? child.connected,
    quality: changes.quality !== undefined ? changes.quality : child.quality,
    note: changes.note !== undefined ? changes.note : child.note,
    duration:
      changes.duration !== undefined ? changes.duration : child.duration,
    allowAi: child.allowAi,
  };
}

async function loadGroupEvent(
  exec: SqlExecutor,
  groupEventId: number,
): Promise<GroupEventRow> {
  const row = await exec.getFirstAsync<GroupEventRow>(
    `SELECT id, occurred_at, channel, quality, duration
       FROM group_events
      WHERE id = ?`,
    [groupEventId],
  );
  if (!row) throw new Error(`Group Event id=${groupEventId} no longer exists`);
  return row;
}

async function loadGroupChildren(
  exec: SqlExecutor,
  groupEventId: number,
): Promise<GroupChildRow[]> {
  return exec.getAllAsync<GroupChildRow>(
    `${GROUP_CHILD_SELECT} WHERE group_event_id = ? ORDER BY id ASC`,
    [groupEventId],
  );
}

async function loadGroupChild(
  exec: SqlExecutor,
  input: Pick<
    SaveParticipantEditsInput,
    "interactionId" | "contactId" | "groupEventId"
  >,
): Promise<GroupChildRow> {
  const row = await exec.getFirstAsync<GroupChildRow>(
    `${GROUP_CHILD_SELECT}
      WHERE id = ? AND contact_id = ? AND group_event_id = ?`,
    [input.interactionId, input.contactId, input.groupEventId],
  );
  if (!row) {
    throw new Error(
      `Group Event child id=${input.interactionId} is not a member of groupEventId=${input.groupEventId}`,
    );
  }
  return row;
}

async function updateFollowFlag(
  exec: SqlExecutor,
  input: Pick<
    SaveParticipantEditsInput,
    "interactionId" | "contactId" | "groupEventId"
  >,
  field: InheritableGroupField,
  following: boolean,
): Promise<void> {
  const result = await exec.runAsync(
    `UPDATE interactions
        SET ${followColumn[field]} = ?
      WHERE id = ? AND contact_id = ? AND group_event_id = ?`,
    [
      following ? 1 : 0,
      input.interactionId,
      input.contactId,
      input.groupEventId,
    ],
  );
  if (result.changes !== 1) {
    throw new Error(
      `Group Event child id=${input.interactionId} no longer belongs to groupEventId=${input.groupEventId}`,
    );
  }
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
    return Promise.reject(
      new Error("createGroupEvent: title must not be blank"),
    );
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

/**
 * The sole atomic Edit Group Event save. Group Note remains on the parent; the
 * three ordinary shared values are materialized only onto children that follow.
 */
export function updateGroupEvent(
  exec: SqlExecutor,
  input: UpdateGroupEventInput,
): Promise<void> {
  try {
    if (input.occurredAt !== undefined) {
      rejectFutureOccurredAt(input.occurredAt, input.now);
    }
  } catch (error) {
    return Promise.reject(error);
  }

  return inWriteTransaction(exec, async () => {
    // This guarded read intentionally remains the transaction's first statement.
    await loadGroupEvent(exec, input.groupEventId);
    let changed = false;

    if (input.occurredAt !== undefined) {
      await exec.runAsync(
        "UPDATE group_events SET occurred_at = ?, modified_at = ? WHERE id = ?",
        [input.occurredAt, input.now, input.groupEventId],
      );
      for (const child of await loadGroupChildren(exec, input.groupEventId)) {
        await editTouchpointFullCore(
          exec,
          changedChild(child, input.now, { occurredAt: input.occurredAt }),
        );
      }
      changed = true;
    }

    for (const field of ["channel", "quality", "duration"] as const) {
      const operation = input.patch[field];
      if (operation === undefined) continue;
      const result = await exec.runAsync(
        `UPDATE group_events SET ${field} = ?, modified_at = ? WHERE id = ?`,
        [operation.value, input.now, input.groupEventId],
      );
      if (result.changes !== 1) {
        throw new Error(
          `Group Event id=${input.groupEventId} no longer exists`,
        );
      }
      const children = computeFollowingChildren(
        await loadGroupChildren(exec, input.groupEventId),
        field,
      );
      for (const child of children) {
        await editTouchpointFullCore(
          exec,
          changedChild(child, input.now, { [field]: operation.value }),
        );
      }
      changed = true;
    }

    if (input.patch.groupNote !== undefined) {
      const result = await exec.runAsync(
        "UPDATE group_events SET group_note = ?, modified_at = ? WHERE id = ?",
        [input.patch.groupNote.value, input.now, input.groupEventId],
      );
      if (result.changes !== 1) {
        throw new Error(
          `Group Event id=${input.groupEventId} no longer exists`,
        );
      }
      changed = true;
    }

    if (changed) await bumpDataRevisionCore(exec);
  });
}

/** Set one inheritable participant field to a deliberately detached value. */
export function setParticipantOverride(
  exec: SqlExecutor,
  input: SetParticipantOverrideInput,
): Promise<void> {
  try {
    assertInheritableField(input.field);
    assertFieldValue(input.field, input.value);
  } catch (error) {
    return Promise.reject(error);
  }
  return inWriteTransaction(exec, async () => {
    const child = await loadGroupChild(exec, input);
    await editTouchpointFullCore(
      exec,
      changedChild(child, input.now, { [input.field]: input.value }),
    );
    await updateFollowFlag(exec, input, input.field, false);
    await bumpDataRevisionCore(exec);
  });
}

/** Reconnect one inheritable field to the current parent value. */
export function clearParticipantOverride(
  exec: SqlExecutor,
  input: ClearParticipantOverrideInput,
): Promise<void> {
  try {
    assertInheritableField(input.field);
  } catch (error) {
    return Promise.reject(error);
  }
  return inWriteTransaction(exec, async () => {
    const child = await loadGroupChild(exec, input);
    const event = await loadGroupEvent(exec, input.groupEventId);
    const value = eventValue(event, input.field);
    await editTouchpointFullCore(
      exec,
      changedChild(child, input.now, { [input.field]: value }),
    );
    await updateFollowFlag(exec, input, input.field, true);
    await bumpDataRevisionCore(exec);
  });
}

/** Persist participant-only Direction, Connected, and note without changing flags. */
export function setParticipantFields(
  exec: SqlExecutor,
  input: SetParticipantFieldsInput,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const child = await loadGroupChild(exec, input);
    await editTouchpointFullCore(
      exec,
      changedChild(child, input.now, input.fields),
    );
    await bumpDataRevisionCore(exec);
  });
}

/**
 * Atomic participant-editor Save. It deliberately composes non-mutexed cores
 * rather than chaining the three single-field DAO operations above.
 */
export function saveParticipantEdits(
  exec: SqlExecutor,
  input: SaveParticipantEditsInput,
): Promise<void> {
  try {
    for (const field of ["channel", "quality", "duration"] as const) {
      const operation = input.follow?.[field];
      if (operation && !operation.follow)
        assertFieldValue(field, operation.value);
    }
  } catch (error) {
    return Promise.reject(error);
  }

  return inWriteTransaction(exec, async () => {
    const child = await loadGroupChild(exec, input);
    const followEntries = (["channel", "quality", "duration"] as const)
      .map((field) => [field, input.follow?.[field]] as const)
      .filter(
        (
          entry,
        ): entry is readonly [InheritableGroupField, ParticipantFollowChange] =>
          entry[1] !== undefined,
      );
    const hasDirectFields =
      input.fields !== undefined && Object.keys(input.fields).length > 0;
    if (followEntries.length === 0 && !hasDirectFields) return;

    // Read exactly once for the save, after membership has been asserted.
    const event = await loadGroupEvent(exec, input.groupEventId);
    const ordinaryChanges: Partial<{
      channel: string;
      quality: string | null;
      duration: number | null;
      direction: string | null;
      connected: number;
      note: string | null;
    }> = {
      ...input.fields,
    };
    for (const [field, operation] of followEntries) {
      ordinaryChanges[field] = operation.follow
        ? (eventValue(event, field) as never)
        : (operation.value as never);
    }
    await editTouchpointFullCore(
      exec,
      changedChild(child, input.now, ordinaryChanges),
    );
    for (const [field, operation] of followEntries) {
      await updateFollowFlag(exec, input, field, operation.follow);
    }
    await bumpDataRevisionCore(exec);
  });
}
