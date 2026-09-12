import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { readDataRevision } from "@/db/data-revision-dao";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  addParticipant,
  clearParticipantOverride,
  createGroupEvent,
  deleteGroupChild,
  detachParticipant,
  saveParticipantEdits,
  setParticipantFields,
  setParticipantOverride,
  updateGroupEvent,
} from "@/db/group-events-dao";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-12 12:00:00";
let counter = 0;
const uid = () => `group-event-${++counter}`;
let exec: SqlExecutor;

beforeEach(async () => {
  counter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
  });
});

describe("group participant lifecycle", () => {
  it("adds an archived participant at the event wall-clock with resolved shared values", async () => {
    const { groupEventId } = await groupWithThreeChildren();
    const archived = await contact("Archived");
    await exec.runAsync("UPDATE contacts SET archived_at = ? WHERE id = ?", [
      NOW,
      archived,
    ]);
    const revision = await readDataRevision(exec);

    await addParticipant(exec, {
      groupEventId,
      contactId: archived,
      uid: uid(),
      direction: "mutual",
      connected: 0,
      note: "private participant note",
      now: "2026-09-12 13:00:00",
    });

    expect(
      await exec.getFirstAsync(
        "SELECT occurred_at, channel, quality, duration, direction, connected, note, ge_follow_channel, ge_follow_quality, ge_follow_duration FROM interactions WHERE contact_id = ?",
        [archived],
      ),
    ).toEqual({
      occurred_at: "2026-09-10 18:00:00",
      channel: "Call",
      quality: "Positive",
      duration: 3600,
      direction: "mutual",
      connected: 0,
      note: "private participant note",
      ge_follow_channel: 1,
      ge_follow_quality: 1,
      ge_follow_duration: 1,
    });
    expect(
      await exec.getFirstAsync<{ last_contact: string }>(
        "SELECT last_contact FROM contacts WHERE id = ?",
        [archived],
      ),
    ).toEqual({ last_contact: "2026-09-10 18:00:00" });
    expect(await readDataRevision(exec)).toBe(revision + 1);
  });

  it("rejects a duplicate participant without writing a second child", async () => {
    const { groupEventId, alex } = await groupWithThreeChildren();
    const before = await count("interactions");
    await expect(
      addParticipant(exec, {
        groupEventId,
        contactId: alex,
        uid: uid(),
        now: NOW,
      }),
    ).rejects.toThrow();
    expect(await count("interactions")).toBe(before);
  });

  it("deletes only a scoped participant through its tombstone and detaches without copying Group Note", async () => {
    const { groupEventId, alex, sam, jordan } = await groupWithThreeChildren();
    const children = await groupChildren(groupEventId);
    const samChild = children.find((child) => child.contact_id === sam)!;
    const alexChild = children.find((child) => child.contact_id === alex)!;
    const revision = await readDataRevision(exec);

    await deleteGroupChild(exec, {
      groupEventId,
      interactionId: samChild.id,
      contactId: sam,
      now: NOW,
    });
    expect(await groupChildren(groupEventId)).toHaveLength(2);
    expect(
      await exec.getFirstAsync<{ entity_type: string }>(
        "SELECT entity_type FROM tombstones WHERE entity_uid = ?",
        [(await exec.getFirstAsync<{ uid: string }>("SELECT uid FROM interactions WHERE id = ?", [alexChild.id]))!.uid],
      ),
    ).toBeUndefined();

    await detachParticipant(exec, {
      groupEventId,
      interactionId: alexChild.id,
      now: NOW,
    });
    expect(
      await exec.getFirstAsync(
        "SELECT group_event_id, ge_follow_channel, ge_follow_quality, ge_follow_duration, note FROM interactions WHERE id = ?",
        [alexChild.id],
      ),
    ).toEqual({
      group_event_id: null,
      ge_follow_channel: null,
      ge_follow_quality: null,
      ge_follow_duration: null,
      note: "Alex note",
    });
    expect(await groupChildren(groupEventId)).toHaveLength(1);
    expect((await groupChildren(groupEventId))[0]?.contact_id).toBe(jordan);
    expect(await readDataRevision(exec)).toBe(revision + 2);
  });

  it("rejects delete and detach for a child outside the supplied event", async () => {
    const { groupEventId, alex } = await groupWithThreeChildren();
    const child = (await groupChildren(groupEventId)).find(
      (row) => row.contact_id === alex,
    )!;
    const other = await createGroupEvent(exec, {
      uid: uid(),
      title: "Other",
      occurredAt: NOW,
      now: NOW,
      participants: [],
    });
    const before = await exec.getFirstAsync(
      "SELECT group_event_id, note FROM interactions WHERE id = ?",
      [child.id],
    );
    await expect(
      deleteGroupChild(exec, {
        groupEventId: other.groupEventId,
        interactionId: child.id,
        contactId: alex,
        now: NOW,
      }),
    ).rejects.toThrow(/not a member/);
    await expect(
      detachParticipant(exec, {
        groupEventId: other.groupEventId,
        interactionId: child.id,
        now: NOW,
      }),
    ).rejects.toThrow(/not a member/);
    expect(
      await exec.getFirstAsync(
        "SELECT group_event_id, note FROM interactions WHERE id = ?",
        [child.id],
      ),
    ).toEqual(before);
  });
});

async function contact(name = "Alex"): Promise<number> {
  const result = await exec.runAsync(
    "INSERT INTO contacts (uid, name, interval_days, created_at, modified_at) VALUES (?, ?, 30, ?, ?)",
    [uid(), name, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function count(table: "group_events" | "interactions"): Promise<number> {
  return (
    (
      await exec.getFirstAsync<{ n: number }>(
        `SELECT COUNT(*) AS n FROM ${table}`,
      )
    )?.n ?? 0
  );
}

async function groupWithThreeChildren(): Promise<{
  groupEventId: number;
  alex: number;
  sam: number;
  jordan: number;
}> {
  const alex = await contact("Alex");
  const sam = await contact("Sam");
  const jordan = await contact("Jordan");
  const { groupEventId } = await createGroupEvent(exec, {
    uid: uid(),
    title: "Dinner",
    occurredAt: "2026-09-10 18:00:00",
    now: NOW,
    channel: "Call",
    quality: "Positive",
    duration: 3600,
    groupNote: "Original shared note",
    participants: [
      {
        contactId: alex,
        uid: uid(),
        direction: "outbound",
        connected: 1,
        note: "Alex note",
      },
      {
        contactId: sam,
        uid: uid(),
        direction: "inbound",
        connected: 0,
        note: "Sam note",
      },
      {
        contactId: jordan,
        uid: uid(),
        direction: null,
        connected: 1,
        note: "Jordan note",
      },
    ],
  });
  return { groupEventId, alex, sam, jordan };
}

async function groupChildren(groupEventId: number) {
  return exec.getAllAsync<{
    id: number;
    contact_id: number;
    group_event_id: number | null;
    occurred_at: string;
    channel: string;
    quality: string | null;
    duration: number | null;
    direction: string | null;
    connected: number;
    note: string | null;
    ge_follow_channel: number | null;
    ge_follow_quality: number | null;
    ge_follow_duration: number | null;
  }>(
    `SELECT id, contact_id, group_event_id, occurred_at, channel, quality,
            duration, direction, connected, note, ge_follow_channel,
            ge_follow_quality, ge_follow_duration
       FROM interactions WHERE group_event_id = ? ORDER BY contact_id`,
    [groupEventId],
  );
}

describe("createGroupEvent", () => {
  it("persists a valid zero-participant parent without an interaction", async () => {
    const result = await createGroupEvent(exec, {
      uid: uid(),
      title: "Book club",
      occurredAt: NOW,
      now: NOW,
      participants: [],
    });
    expect(result.groupEventId).toBeGreaterThan(0);
    expect(await count("group_events")).toBe(1);
    expect(await count("interactions")).toBe(0);
    expect(
      await exec.getFirstAsync<{ channel: string }>(
        "SELECT channel FROM group_events WHERE id = ?",
        [result.groupEventId],
      ),
    ).toEqual({ channel: "In Person" });
  });

  it("fans out canonical children and recomputes each participant recency", async () => {
    const alex = await contact("Alex");
    const sam = await contact("Sam");
    const occurredAt = "2026-09-10 18:00:00";
    const { groupEventId } = await createGroupEvent(exec, {
      uid: uid(),
      title: "Dinner",
      occurredAt,
      now: NOW,
      channel: "Call",
      quality: "Positive",
      duration: 3600,
      participants: [
        {
          contactId: alex,
          uid: uid(),
          direction: "outbound",
          connected: 1,
          note: "Alex note",
        },
        { contactId: sam, uid: uid(), direction: "inbound", connected: 0 },
      ],
    });
    const rows = await exec.getAllAsync<{
      contact_id: number;
      group_event_id: number;
      ge_follow_channel: number;
      ge_follow_quality: number;
      ge_follow_duration: number;
      direction: string;
      connected: number;
    }>(
      "SELECT contact_id, group_event_id, ge_follow_channel, ge_follow_quality, ge_follow_duration, direction, connected FROM interactions ORDER BY contact_id",
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.group_event_id)).toEqual([
      groupEventId,
      groupEventId,
    ]);
    expect(
      rows.every(
        (row) =>
          row.ge_follow_channel === 1 &&
          row.ge_follow_quality === 1 &&
          row.ge_follow_duration === 1,
      ),
    ).toBe(true);
    expect(rows.find((row) => row.contact_id === alex)).toMatchObject({
      direction: "outbound",
      connected: 1,
    });
    expect(
      await exec.getFirstAsync<{ last_contact: string }>(
        "SELECT last_contact FROM contacts WHERE id = ?",
        [alex],
      ),
    ).toEqual({ last_contact: occurredAt });
    // Sam's unconnected row does not qualify as recency only if their contact is rarely-responds;
    // here it remains the sole normal-contact interaction.
    expect(
      await exec.getFirstAsync<{ last_contact: string }>(
        "SELECT last_contact FROM contacts WHERE id = ?",
        [sam],
      ),
    ).toEqual({ last_contact: occurredAt });
  });

  it("rejects duplicate membership atomically", async () => {
    const alex = await contact();
    await expect(
      createGroupEvent(exec, {
        uid: uid(),
        title: "Dinner",
        occurredAt: NOW,
        now: NOW,
        participants: [
          { contactId: alex, uid: uid() },
          { contactId: alex, uid: uid() },
        ],
      }),
    ).rejects.toThrow();
    expect(await count("group_events")).toBe(0);
    expect(await count("interactions")).toBe(0);
  });

  it("rejects future, blank-title, and blank-uid inputs before writing", async () => {
    await expect(
      createGroupEvent(exec, {
        uid: uid(),
        title: "Future",
        occurredAt: "2026-09-12 12:00:01",
        now: NOW,
        participants: [],
      }),
    ).rejects.toThrow();
    await expect(
      createGroupEvent(exec, {
        uid: uid(),
        title: "  ",
        occurredAt: NOW,
        now: NOW,
        participants: [],
      }),
    ).rejects.toThrow();
    await expect(
      createGroupEvent(exec, {
        uid: "",
        title: "Valid",
        occurredAt: NOW,
        now: NOW,
        participants: [],
      }),
    ).rejects.toThrow();
    expect(await count("group_events")).toBe(0);
  });
});

describe("updateGroupEvent", () => {
  it("atomically fans date and all shared values only to following children", async () => {
    const { groupEventId, alex, sam, jordan } = await groupWithThreeChildren();
    // Sam's Tone stays intentionally detached, even though it could equal the event.
    await exec.runAsync(
      "UPDATE interactions SET quality = 'Negative', ge_follow_quality = 0 WHERE contact_id = ? AND group_event_id = ?",
      [sam, groupEventId],
    );

    await updateGroupEvent(exec, {
      groupEventId,
      now: NOW,
      occurredAt: "2026-09-11 19:00:00",
      patch: {
        channel: { value: "Message" },
        quality: { value: null },
        duration: { value: null },
        groupNote: { value: "Changed shared note" },
      },
    });

    expect(
      await exec.getFirstAsync(
        "SELECT occurred_at, channel, quality, duration, group_note FROM group_events WHERE id = ?",
        [groupEventId],
      ),
    ).toEqual({
      occurred_at: "2026-09-11 19:00:00",
      channel: "Message",
      quality: null,
      duration: null,
      group_note: "Changed shared note",
    });
    const children = await groupChildren(groupEventId);
    expect(children).toHaveLength(3);
    expect(
      children.every(
        (child) =>
          child.occurred_at === "2026-09-11 19:00:00" &&
          child.channel === "Message" &&
          child.duration === null,
      ),
    ).toBe(true);
    expect(children.find((child) => child.contact_id === sam)?.quality).toBe(
      "Negative",
    );
    expect(
      children
        .filter((child) => child.contact_id !== sam)
        .every((child) => child.quality === null),
    ).toBe(true);
    expect(children.map((child) => child.note)).toEqual([
      "Alex note",
      "Sam note",
      "Jordan note",
    ]);
    expect(
      await exec.getFirstAsync<{ last_contact: string }>(
        "SELECT last_contact FROM contacts WHERE id = ?",
        [alex],
      ),
    ).toEqual({ last_contact: "2026-09-11 19:00:00" });
    expect(
      await exec.getFirstAsync<{ last_contact: string }>(
        "SELECT last_contact FROM contacts WHERE id = ?",
        [jordan],
      ),
    ).toEqual({ last_contact: "2026-09-11 19:00:00" });
  });

  it("writes a Group Note only on its parent and keeps omitted fields intact", async () => {
    const { groupEventId } = await groupWithThreeChildren();
    const before = await groupChildren(groupEventId);
    await updateGroupEvent(exec, {
      groupEventId,
      now: NOW,
      patch: { groupNote: { value: null } },
    });
    expect(
      await exec.getFirstAsync<{ group_note: string | null }>(
        "SELECT group_note FROM group_events WHERE id = ?",
        [groupEventId],
      ),
    ).toEqual({ group_note: null });
    expect(await groupChildren(groupEventId)).toEqual(before);
    expect(
      await exec.getFirstAsync<{
        channel: string;
        quality: string;
        duration: number;
      }>("SELECT channel, quality, duration FROM group_events WHERE id = ?", [
        groupEventId,
      ]),
    ).toEqual({ channel: "Call", quality: "Positive", duration: 3600 });
  });

  it("rejects a future date before opening a transaction", async () => {
    const { groupEventId } = await groupWithThreeChildren();
    const revision = await readDataRevision(exec);
    await expect(
      updateGroupEvent(exec, {
        groupEventId,
        now: NOW,
        occurredAt: "2026-09-12 12:00:01",
        patch: {},
      }),
    ).rejects.toThrow(/future/);
    expect(await readDataRevision(exec)).toBe(revision);
  });

  it("asserts parent existence first and treats an empty existing patch as a no-op", async () => {
    const { groupEventId } = await groupWithThreeChildren();
    const revision = await readDataRevision(exec);
    const before = await groupChildren(groupEventId);
    await updateGroupEvent(exec, { groupEventId, now: NOW, patch: {} });
    expect(await groupChildren(groupEventId)).toEqual(before);
    expect(await readDataRevision(exec)).toBe(revision);

    await exec.runAsync("DELETE FROM group_events WHERE id = ?", [
      groupEventId,
    ]);
    await expect(
      updateGroupEvent(exec, {
        groupEventId,
        now: NOW,
        patch: { groupNote: { value: "cannot write" } },
      }),
    ).rejects.toThrow(/no longer exists/);
    expect(await readDataRevision(exec)).toBe(revision);
  });

  it("rolls every date/shared/note write back when a late child write fails", async () => {
    const { groupEventId } = await groupWithThreeChildren();
    const beforeParent = await exec.getFirstAsync(
      "SELECT occurred_at, channel, quality, duration, group_note FROM group_events WHERE id = ?",
      [groupEventId],
    );
    const beforeChildren = await groupChildren(groupEventId);
    const revision = await readDataRevision(exec);
    const baseRun = exec.runAsync.bind(exec);
    let interactionWrites = 0;
    const failingExec: SqlExecutor = {
      ...exec,
      runAsync: async (sql, params) => {
        if (sql.startsWith("UPDATE interactions")) {
          interactionWrites += 1;
          if (interactionWrites === 2) throw new Error("forced child failure");
        }
        return baseRun(sql, params);
      },
    };
    await expect(
      updateGroupEvent(failingExec, {
        groupEventId,
        now: NOW,
        occurredAt: "2026-09-11 19:00:00",
        patch: {
          channel: { value: "Message" },
          groupNote: { value: "Changed" },
        },
      }),
    ).rejects.toThrow(/forced child failure/);
    expect(
      await exec.getFirstAsync(
        "SELECT occurred_at, channel, quality, duration, group_note FROM group_events WHERE id = ?",
        [groupEventId],
      ),
    ).toEqual(beforeParent);
    expect(await groupChildren(groupEventId)).toEqual(beforeChildren);
    expect(await readDataRevision(exec)).toBe(revision);
  });
});

describe("participant override primitives", () => {
  it("detaches an override, reattaches on clear, and preserves equal-value detachment", async () => {
    const { groupEventId, alex, sam } = await groupWithThreeChildren();
    const children = await groupChildren(groupEventId);
    const alexChild = children.find((child) => child.contact_id === alex)!;
    const samChild = children.find((child) => child.contact_id === sam)!;

    await setParticipantOverride(exec, {
      interactionId: alexChild.id,
      contactId: alex,
      groupEventId,
      now: NOW,
      field: "quality",
      value: "Negative",
    });
    // Equal values are still an explicit detached override.
    await setParticipantOverride(exec, {
      interactionId: samChild.id,
      contactId: sam,
      groupEventId,
      now: NOW,
      field: "quality",
      value: "Positive",
    });
    await updateGroupEvent(exec, {
      groupEventId,
      now: NOW,
      patch: { quality: { value: "Neutral" } },
    });
    expect(
      await exec.getFirstAsync(
        "SELECT quality, ge_follow_quality FROM interactions WHERE id = ?",
        [alexChild.id],
      ),
    ).toEqual({ quality: "Negative", ge_follow_quality: 0 });
    expect(
      await exec.getFirstAsync(
        "SELECT quality, ge_follow_quality FROM interactions WHERE id = ?",
        [samChild.id],
      ),
    ).toEqual({ quality: "Positive", ge_follow_quality: 0 });

    await clearParticipantOverride(exec, {
      interactionId: alexChild.id,
      contactId: alex,
      groupEventId,
      now: NOW,
      field: "quality",
    });
    expect(
      await exec.getFirstAsync(
        "SELECT quality, ge_follow_quality FROM interactions WHERE id = ?",
        [alexChild.id],
      ),
    ).toEqual({ quality: "Neutral", ge_follow_quality: 1 });
    await updateGroupEvent(exec, {
      groupEventId,
      now: NOW,
      patch: { quality: { value: "Positive" } },
    });
    expect(
      await exec.getFirstAsync(
        "SELECT quality FROM interactions WHERE id = ?",
        [alexChild.id],
      ),
    ).toEqual({ quality: "Positive" });
    expect(
      await exec.getFirstAsync(
        "SELECT quality FROM interactions WHERE id = ?",
        [samChild.id],
      ),
    ).toEqual({ quality: "Positive" });
    expect(
      await exec.getFirstAsync<{ ge_follow_quality: number }>(
        "SELECT ge_follow_quality FROM interactions WHERE id = ?",
        [samChild.id],
      ),
    ).toEqual({ ge_follow_quality: 0 });
  });

  it("rolls back value and flag together when the scoped flag update fails", async () => {
    const { groupEventId, alex } = await groupWithThreeChildren();
    const child = (await groupChildren(groupEventId)).find(
      (row) => row.contact_id === alex,
    )!;
    const revision = await readDataRevision(exec);
    const baseRun = exec.runAsync.bind(exec);
    const failingExec: SqlExecutor = {
      ...exec,
      runAsync: async (sql, params) => {
        if (sql.includes("SET ge_follow_quality"))
          throw new Error("forced flag failure");
        return baseRun(sql, params);
      },
    };
    await expect(
      setParticipantOverride(failingExec, {
        interactionId: child.id,
        contactId: alex,
        groupEventId,
        now: NOW,
        field: "quality",
        value: "Negative",
      }),
    ).rejects.toThrow(/forced flag failure/);
    expect(
      await exec.getFirstAsync(
        "SELECT quality, ge_follow_quality FROM interactions WHERE id = ?",
        [child.id],
      ),
    ).toEqual({ quality: "Positive", ge_follow_quality: 1 });
    expect(await readDataRevision(exec)).toBe(revision);
  });

  it("writes participant-only fields without changing follow state", async () => {
    const { groupEventId, alex } = await groupWithThreeChildren();
    const child = (await groupChildren(groupEventId)).find(
      (row) => row.contact_id === alex,
    )!;
    await setParticipantFields(exec, {
      interactionId: child.id,
      contactId: alex,
      groupEventId,
      now: NOW,
      fields: {
        direction: "mutual",
        connected: 0,
        note: "private participant note",
      },
    });
    expect(
      await exec.getFirstAsync(
        "SELECT direction, connected, note, ge_follow_channel, ge_follow_quality, ge_follow_duration FROM interactions WHERE id = ?",
        [child.id],
      ),
    ).toEqual({
      direction: "mutual",
      connected: 0,
      note: "private participant note",
      ge_follow_channel: 1,
      ge_follow_quality: 1,
      ge_follow_duration: 1,
    });
  });

  it("rejects malformed group membership for every participant primitive", async () => {
    const { groupEventId, alex } = await groupWithThreeChildren();
    const other = await createGroupEvent(exec, {
      uid: uid(),
      title: "Other",
      occurredAt: NOW,
      now: NOW,
      participants: [],
    });
    const child = (await groupChildren(groupEventId)).find(
      (row) => row.contact_id === alex,
    )!;
    const before = await exec.getFirstAsync(
      "SELECT channel, direction, connected, note, ge_follow_channel FROM interactions WHERE id = ?",
      [child.id],
    );
    await expect(
      setParticipantOverride(exec, {
        interactionId: child.id,
        contactId: alex,
        groupEventId: other.groupEventId,
        now: NOW,
        field: "channel",
        value: "Message",
      }),
    ).rejects.toThrow(/not a member/);
    await expect(
      clearParticipantOverride(exec, {
        interactionId: child.id,
        contactId: alex,
        groupEventId: other.groupEventId,
        now: NOW,
        field: "channel",
      }),
    ).rejects.toThrow(/not a member/);
    await expect(
      setParticipantFields(exec, {
        interactionId: child.id,
        contactId: alex,
        groupEventId: other.groupEventId,
        now: NOW,
        fields: { note: "cannot write" },
      }),
    ).rejects.toThrow(/not a member/);
    expect(
      await exec.getFirstAsync(
        "SELECT channel, direction, connected, note, ge_follow_channel FROM interactions WHERE id = ?",
        [child.id],
      ),
    ).toEqual(before);
  });

  it("rejects non-inheritable override targets instead of inventing a follow flag", async () => {
    const { groupEventId, alex } = await groupWithThreeChildren();
    const child = (await groupChildren(groupEventId)).find(
      (row) => row.contact_id === alex,
    )!;
    await expect(
      setParticipantOverride(exec, {
        interactionId: child.id,
        contactId: alex,
        groupEventId,
        now: NOW,
        field: "direction" as never,
        value: "outbound",
      }),
    ).rejects.toThrow(/cannot follow/);
    await expect(
      clearParticipantOverride(exec, {
        interactionId: child.id,
        contactId: alex,
        groupEventId,
        now: NOW,
        field: "connected" as never,
      }),
    ).rejects.toThrow(/cannot follow/);
  });
});

describe("saveParticipantEdits", () => {
  it("commits a follow-field override and participant note together with one bump", async () => {
    const { groupEventId, alex } = await groupWithThreeChildren();
    const child = (await groupChildren(groupEventId)).find(
      (row) => row.contact_id === alex,
    )!;
    const revision = await readDataRevision(exec);
    await saveParticipantEdits(exec, {
      interactionId: child.id,
      contactId: alex,
      groupEventId,
      now: NOW,
      follow: { quality: { follow: false, value: "Negative" } },
      fields: { note: "private changed note" },
    });
    expect(
      await exec.getFirstAsync(
        "SELECT quality, ge_follow_quality, note FROM interactions WHERE id = ?",
        [child.id],
      ),
    ).toEqual({
      quality: "Negative",
      ge_follow_quality: 0,
      note: "private changed note",
    });
    expect(await readDataRevision(exec)).toBe(revision + 1);
  });

  it("rolls all field classes back when a flag write fails after the core edit", async () => {
    const { groupEventId, alex } = await groupWithThreeChildren();
    const child = (await groupChildren(groupEventId)).find(
      (row) => row.contact_id === alex,
    )!;
    const revision = await readDataRevision(exec);
    const baseRun = exec.runAsync.bind(exec);
    const failingExec: SqlExecutor = {
      ...exec,
      runAsync: async (sql, params) => {
        if (sql.includes("SET ge_follow_quality"))
          throw new Error("forced save flag failure");
        return baseRun(sql, params);
      },
    };
    await expect(
      saveParticipantEdits(failingExec, {
        interactionId: child.id,
        contactId: alex,
        groupEventId,
        now: NOW,
        follow: { quality: { follow: false, value: "Negative" } },
        fields: { note: "must roll back" },
      }),
    ).rejects.toThrow(/forced save flag failure/);
    expect(
      await exec.getFirstAsync(
        "SELECT quality, ge_follow_quality, note FROM interactions WHERE id = ?",
        [child.id],
      ),
    ).toEqual({ quality: "Positive", ge_follow_quality: 1, note: "Alex note" });
    expect(await readDataRevision(exec)).toBe(revision);
  });

  it("re-resolves a follow field from the current event and scopes the composite save to membership", async () => {
    const { groupEventId, alex } = await groupWithThreeChildren();
    const child = (await groupChildren(groupEventId)).find(
      (row) => row.contact_id === alex,
    )!;
    await setParticipantOverride(exec, {
      interactionId: child.id,
      contactId: alex,
      groupEventId,
      now: NOW,
      field: "duration",
      value: 600,
    });
    await updateGroupEvent(exec, {
      groupEventId,
      now: NOW,
      patch: { duration: { value: 7200 } },
    });
    await saveParticipantEdits(exec, {
      interactionId: child.id,
      contactId: alex,
      groupEventId,
      now: NOW,
      follow: { duration: { follow: true } },
    });
    expect(
      await exec.getFirstAsync(
        "SELECT duration, ge_follow_duration FROM interactions WHERE id = ?",
        [child.id],
      ),
    ).toEqual({ duration: 7200, ge_follow_duration: 1 });

    const other = await createGroupEvent(exec, {
      uid: uid(),
      title: "Other",
      occurredAt: NOW,
      now: NOW,
      participants: [],
    });
    const before = await exec.getFirstAsync(
      "SELECT direction, connected, note FROM interactions WHERE id = ?",
      [child.id],
    );
    await expect(
      saveParticipantEdits(exec, {
        interactionId: child.id,
        contactId: alex,
        groupEventId: other.groupEventId,
        now: NOW,
        fields: { direction: "mutual", note: "cannot write" },
      }),
    ).rejects.toThrow(/not a member/);
    expect(
      await exec.getFirstAsync(
        "SELECT direction, connected, note FROM interactions WHERE id = ?",
        [child.id],
      ),
    ).toEqual(before);
  });

  it("persists direct-only participant edits without changing follow flags", async () => {
    const { groupEventId, alex } = await groupWithThreeChildren();
    const child = (await groupChildren(groupEventId)).find(
      (row) => row.contact_id === alex,
    )!;
    const revision = await readDataRevision(exec);
    await saveParticipantEdits(exec, {
      interactionId: child.id,
      contactId: alex,
      groupEventId,
      now: NOW,
      fields: { direction: null, connected: 0, note: "direct only" },
    });
    expect(
      await exec.getFirstAsync(
        "SELECT direction, connected, note, ge_follow_channel, ge_follow_quality, ge_follow_duration FROM interactions WHERE id = ?",
        [child.id],
      ),
    ).toEqual({
      direction: null,
      connected: 0,
      note: "direct only",
      ge_follow_channel: 1,
      ge_follow_quality: 1,
      ge_follow_duration: 1,
    });
    expect(await readDataRevision(exec)).toBe(revision + 1);
  });
});
