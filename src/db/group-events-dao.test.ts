import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { readDataRevision } from "@/db/data-revision-dao";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  addParticipant,
  addParticipants,
  clearParticipantOverride,
  convertInteractionToGroupEvent,
  createGroupEvent,
  deleteGroupChild,
  deleteGroupEventAndInteractions,
  detachParticipant,
  dissolveGroupEvent,
  saveParticipantEdits,
  setParticipantFields,
  setParticipantOverride,
  updateGroupEvent,
  updateGroupEventCore,
} from "@/db/group-events-dao";
import {
  insertLinkedEntryCore,
  LinkedNoteBlankError,
  type LinkedSection,
} from "@/db/linked-entry-dao";
import { editMemory } from "@/db/memories-dao";
import { runMigrations } from "@/db/migrations/runner";
import { recordTouchpoint } from "@/db/recency-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { resolveDisplay } from "@/logic/group-inheritance";
import {
  buildParticipantFieldPatch,
  buildParticipantFollowPatch,
  type ParticipantPatchDraft,
} from "@/logic/group-participant-patch";

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

describe("convertInteractionToGroupEvent", () => {
  it("preserves the source interaction identity and returns its new parent id", async () => {
    const alex = await contact("Alex");
    const source = await recordTouchpoint(exec, {
      contactId: alex,
      uid: "child-uid",
      occurredAt: "2026-09-10 18:00:00",
      now: NOW,
      channel: "Call",
      quality: "Positive",
      duration: 1800,
      direction: "inbound",
      connected: 0,
      note: null,
    });
    const revision = await readDataRevision(exec);

    const { groupEventId } = await convertInteractionToGroupEvent(exec, {
      interactionId: source.interactionId,
      contactId: alex,
      title: "  Supper  ",
      uid: "parent-uid",
      now: NOW,
    });

    expect(
      await exec.getFirstAsync(
        "SELECT uid, title, occurred_at, channel, quality, duration FROM group_events WHERE id = ?",
        [groupEventId],
      ),
    ).toEqual({
      uid: "parent-uid",
      title: "Supper",
      occurred_at: "2026-09-10 18:00:00",
      channel: "Call",
      quality: "Positive",
      duration: 1800,
    });
    expect(
      await exec.getFirstAsync(
        "SELECT id, uid, group_event_id, ge_follow_channel, ge_follow_quality, ge_follow_duration, direction, connected FROM interactions WHERE id = ?",
        [source.interactionId],
      ),
    ).toEqual({
      id: source.interactionId,
      uid: "child-uid",
      group_event_id: groupEventId,
      ge_follow_channel: 1,
      ge_follow_quality: 1,
      ge_follow_duration: 1,
      direction: "inbound",
      connected: 0,
    });
    expect(await readDataRevision(exec)).toBe(revision + 1);
  });

  it("rejects blank parent metadata before writing and cannot convert a linked child", async () => {
    const alex = await contact("Alex");
    const source = await recordTouchpoint(exec, {
      contactId: alex,
      uid: "standalone-child",
      occurredAt: NOW,
      now: NOW,
    });
    await expect(
      convertInteractionToGroupEvent(exec, {
        interactionId: source.interactionId,
        contactId: alex,
        title: "  ",
        uid: "parent-blank-title",
        now: NOW,
      }),
    ).rejects.toThrow(/title must not be blank/);
    await expect(
      convertInteractionToGroupEvent(exec, {
        interactionId: source.interactionId,
        contactId: alex,
        title: "Valid",
        uid: "",
        now: NOW,
      }),
    ).rejects.toThrow(/uid must not be blank/);
    expect(await count("group_events")).toBe(0);

    const { groupEventId } = await createGroupEvent(exec, {
      uid: "existing-parent",
      title: "Already linked",
      occurredAt: NOW,
      now: NOW,
      participants: [{ contactId: alex, uid: "linked-child" }],
    });
    const linked = (await groupChildren(groupEventId))[0]!;
    const before = await count("group_events");
    await expect(
      convertInteractionToGroupEvent(exec, {
        interactionId: linked.id,
        contactId: alex,
        title: "Should not mint",
        uid: "unexpected-parent",
        now: NOW,
      }),
    ).rejects.toThrow(/standalone/);
    expect(await count("group_events")).toBe(before);
    expect(
      await exec.getFirstAsync<{ group_event_id: number }>(
        "SELECT group_event_id FROM interactions WHERE id = ?",
        [linked.id],
      ),
    ).toEqual({ group_event_id: groupEventId });
  });
});

describe("group event lifecycle", () => {
  it("dissolves every child to a standalone interaction and tombstones the fetched parent uid", async () => {
    const { groupEventId } = await groupWithThreeChildren();
    const parent = await exec.getFirstAsync<{ uid: string }>(
      "SELECT uid FROM group_events WHERE id = ?",
      [groupEventId],
    );
    const revision = await readDataRevision(exec);

    await dissolveGroupEvent(exec, { groupEventId, now: NOW });

    expect(await count("group_events")).toBe(0);
    expect(
      await exec.getAllAsync(
        "SELECT group_event_id, ge_follow_channel, ge_follow_quality, ge_follow_duration, note FROM interactions",
      ),
    ).toEqual([
      {
        group_event_id: null,
        ge_follow_channel: null,
        ge_follow_quality: null,
        ge_follow_duration: null,
        note: "Alex note",
      },
      {
        group_event_id: null,
        ge_follow_channel: null,
        ge_follow_quality: null,
        ge_follow_duration: null,
        note: "Sam note",
      },
      {
        group_event_id: null,
        ge_follow_channel: null,
        ge_follow_quality: null,
        ge_follow_duration: null,
        note: "Jordan note",
      },
    ]);
    expect(
      await exec.getFirstAsync(
        "SELECT entity_type, entity_uid FROM tombstones WHERE entity_uid = ?",
        [parent!.uid],
      ),
    ).toEqual({ entity_type: "group_event", entity_uid: parent!.uid });
    expect(await readDataRevision(exec)).toBe(revision + 1);
  });

  it("deletes every child through interaction tombstones before removing the parent", async () => {
    const { groupEventId, alex, sam, jordan } = await groupWithThreeChildren();
    const parent = await exec.getFirstAsync<{ uid: string }>(
      "SELECT uid FROM group_events WHERE id = ?",
      [groupEventId],
    );
    const childUids = await exec.getAllAsync<{ uid: string }>(
      "SELECT uid FROM interactions WHERE group_event_id = ?",
      [groupEventId],
    );
    const revision = await readDataRevision(exec);

    await deleteGroupEventAndInteractions(exec, { groupEventId, now: NOW });

    expect(await count("interactions")).toBe(0);
    expect(await count("group_events")).toBe(0);
    expect(
      await exec.getAllAsync<{ entity_type: string; entity_uid: string }>(
        "SELECT entity_type, entity_uid FROM tombstones ORDER BY entity_uid",
      ),
    ).toEqual(
      expect.arrayContaining([
        ...childUids.map(({ uid }) => ({
          entity_type: "interaction",
          entity_uid: uid,
        })),
        { entity_type: "group_event", entity_uid: parent!.uid },
      ]),
    );
    for (const contactId of [alex, sam, jordan]) {
      expect(
        await exec.getFirstAsync<{ last_contact: string | null }>(
          "SELECT last_contact FROM contacts WHERE id = ?",
          [contactId],
        ),
      ).toEqual({ last_contact: null });
    }
    expect(await readDataRevision(exec)).toBe(revision + 1);
  });

  it("handles zero participants and rejects a nonexistent parent without a tombstone", async () => {
    const { groupEventId } = await createGroupEvent(exec, {
      uid: uid(),
      title: "Empty",
      occurredAt: NOW,
      now: NOW,
      participants: [],
    });
    await dissolveGroupEvent(exec, { groupEventId, now: NOW });
    expect(await count("interactions")).toBe(0);
    const tombstones = await exec.getAllAsync("SELECT * FROM tombstones");
    await expect(
      deleteGroupEventAndInteractions(exec, { groupEventId: 9999, now: NOW }),
    ).rejects.toThrow(/no longer exists/);
    expect(await exec.getAllAsync("SELECT * FROM tombstones")).toEqual(
      tombstones,
    );
  });

  it("rolls a deletion loop back when a child delete fails", async () => {
    const { groupEventId } = await groupWithThreeChildren();
    const revision = await readDataRevision(exec);
    const baseRun = exec.runAsync.bind(exec);
    let deletes = 0;
    const failingExec: SqlExecutor = {
      ...exec,
      runAsync: async (sql, params) => {
        if (sql.startsWith("DELETE FROM interactions")) {
          deletes += 1;
          if (deletes === 2) throw new Error("forced child delete failure");
        }
        return baseRun(sql, params);
      },
    };
    await expect(
      deleteGroupEventAndInteractions(failingExec, { groupEventId, now: NOW }),
    ).rejects.toThrow(/forced child delete failure/);
    expect(await count("interactions")).toBe(3);
    expect(await count("group_events")).toBe(1);
    expect(await readDataRevision(exec)).toBe(revision);
  });
});

describe("group participant lifecycle", () => {
  it("adds a saved participant batch atomically with parent values and one revision bump", async () => {
    const { groupEventId } = await groupWithThreeChildren();
    const taylor = await contact("Taylor");
    const morgan = await contact("Morgan");
    const revision = await readDataRevision(exec);

    await addParticipants(exec, {
      groupEventId,
      participants: [
        {
          contactId: taylor,
          uid: uid(),
          direction: "outbound",
          note: "Taylor note",
        },
        { contactId: morgan, uid: uid(), connected: 0, note: "Morgan note" },
      ],
      now: NOW,
    });

    expect(
      await exec.getAllAsync(
        "SELECT contact_id, occurred_at, channel, quality, duration, ge_follow_channel, ge_follow_quality, ge_follow_duration FROM interactions WHERE group_event_id = ? AND contact_id IN (?, ?) ORDER BY contact_id",
        [groupEventId, taylor, morgan],
      ),
    ).toEqual([
      expect.objectContaining({
        occurred_at: "2026-09-10 18:00:00",
        channel: "Call",
        quality: "Positive",
        duration: 3600,
        ge_follow_channel: 1,
        ge_follow_quality: 1,
        ge_follow_duration: 1,
      }),
      expect.objectContaining({
        occurred_at: "2026-09-10 18:00:00",
        channel: "Call",
        quality: "Positive",
        duration: 3600,
        ge_follow_channel: 1,
        ge_follow_quality: 1,
        ge_follow_duration: 1,
      }),
    ]);
    expect(await readDataRevision(exec)).toBe(revision + 1);
  });

  it("rolls a late saved participant batch write back without recency or revision changes", async () => {
    const { groupEventId } = await groupWithThreeChildren();
    const taylor = await contact("Taylor");
    const morgan = await contact("Morgan");
    const revision = await readDataRevision(exec);
    const baseRun = exec.runAsync.bind(exec);
    let interactionWrites = 0;
    const failingExec: SqlExecutor = {
      ...exec,
      runAsync: async (sql, params) => {
        if (sql.startsWith("INSERT INTO interactions")) {
          interactionWrites += 1;
          if (interactionWrites === 2)
            throw new Error("forced later child failure");
        }
        return baseRun(sql, params);
      },
    };

    await expect(
      addParticipants(failingExec, {
        groupEventId,
        participants: [
          { contactId: taylor, uid: uid() },
          { contactId: morgan, uid: uid() },
        ],
        now: NOW,
      }),
    ).rejects.toThrow(/later child failure/);
    expect(await count("interactions")).toBe(3);
    for (const contactId of [taylor, morgan]) {
      expect(
        await exec.getFirstAsync<{ last_contact: string | null }>(
          "SELECT last_contact FROM contacts WHERE id = ?",
          [contactId],
        ),
      ).toEqual({ last_contact: null });
    }
    expect(await readDataRevision(exec)).toBe(revision);
  });

  it("rejects a duplicate batch input or existing member before any batch prefix writes", async () => {
    const { groupEventId, alex } = await groupWithThreeChildren();
    const taylor = await contact("Taylor");
    const before = await count("interactions");
    await expect(
      addParticipants(exec, {
        groupEventId,
        participants: [
          { contactId: taylor, uid: uid() },
          { contactId: taylor, uid: uid() },
        ],
        now: NOW,
      }),
    ).rejects.toThrow(/duplicate contact/);
    await expect(
      addParticipants(exec, {
        groupEventId,
        participants: [
          { contactId: taylor, uid: uid() },
          { contactId: alex, uid: uid() },
        ],
        now: NOW,
      }),
    ).rejects.toThrow(/already a group participant/);
    expect(await count("interactions")).toBe(before);
  });

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
    const samUid = (await exec.getFirstAsync<{ uid: string }>(
      "SELECT uid FROM interactions WHERE id = ?",
      [samChild.id],
    ))!.uid;
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
        [samUid],
      ),
    ).toEqual({ entity_type: "interaction" });

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

/**
 * RG-019 / reliability-testing/AUD-REL-006: prove the shared patch builder
 * through the real coordinator — build → saveParticipantEdits → re-read —
 * rather than asserting on source strings.
 */
describe("participant patch builder round-trip (RG-019)", () => {
  /** Mirror `participantDraft`: resolve the child against its parent event. */
  async function initialDraft(
    groupEventId: number,
    contactId: number,
  ): Promise<{ interactionId: number; draft: ParticipantPatchDraft }> {
    const event = (await exec.getFirstAsync<{
      channel: string | null;
      quality: string | null;
      duration: number | null;
    }>("SELECT channel, quality, duration FROM group_events WHERE id = ?", [
      groupEventId,
    ]))!;
    const child = (await groupChildren(groupEventId)).find(
      (row) => row.contact_id === contactId,
    )!;
    const display = resolveDisplay(
      {
        channel: child.channel,
        quality: child.quality,
        duration: child.duration,
        direction: child.direction,
        connected: child.connected,
        geFollowChannel: child.ge_follow_channel,
        geFollowQuality: child.ge_follow_quality,
        geFollowDuration: child.ge_follow_duration,
      },
      {
        channel: event.channel ?? "In Person",
        quality: event.quality,
        duration: event.duration,
      },
    );
    return {
      interactionId: child.id,
      draft: {
        value: {
          channel: display.channel.value,
          quality: display.quality.value,
          duration: display.duration.value,
          direction: child.direction,
          connected: child.connected,
          note: child.note,
        },
        follow: {
          channel: display.channel.following,
          quality: display.quality.following,
          duration: display.duration.following,
        },
      },
    };
  }

  async function overriddenAlex(
    field: "channel" | "quality" | "duration",
    value: string | number | null,
  ) {
    const { groupEventId, alex } = await groupWithThreeChildren();
    const child = (await groupChildren(groupEventId)).find(
      (row) => row.contact_id === alex,
    )!;
    await setParticipantOverride(exec, {
      interactionId: child.id,
      contactId: alex,
      groupEventId,
      now: NOW,
      field,
      value,
    });
    return { groupEventId, alex, ...(await initialDraft(groupEventId, alex)) };
  }

  async function saveDraft(
    groupEventId: number,
    contactId: number,
    interactionId: number,
    initial: ParticipantPatchDraft,
    draft: ParticipantPatchDraft,
  ) {
    await saveParticipantEdits(exec, {
      interactionId,
      contactId,
      groupEventId,
      now: NOW,
      follow: buildParticipantFollowPatch(initial, draft),
      fields: buildParticipantFieldPatch(initial, draft),
    });
    return exec.getFirstAsync(
      `SELECT channel, quality, duration, ge_follow_channel, ge_follow_quality,
              ge_follow_duration
         FROM interactions WHERE id = ?`,
      [interactionId],
    );
  }

  function edit(
    draft: ParticipantPatchDraft,
    value: Partial<ParticipantPatchDraft["value"]>,
  ): ParticipantPatchDraft {
    return { value: { ...draft.value, ...value }, follow: { ...draft.follow } };
  }

  it("persists a Channel edit on an already-overridden participant (follow stays 0)", async () => {
    const { groupEventId, alex, interactionId, draft } = await overriddenAlex(
      "channel",
      "Message",
    );
    expect(draft.follow.channel).toBe(false);
    const revision = await readDataRevision(exec);
    expect(
      await saveDraft(
        groupEventId,
        alex,
        interactionId,
        draft,
        edit(draft, { channel: "In Person" }),
      ),
    ).toMatchObject({ channel: "In Person", ge_follow_channel: 0 });
    expect(await readDataRevision(exec)).toBe(revision + 1);
  });

  it("persists a Duration edit on an already-overridden participant (follow stays 0)", async () => {
    const { groupEventId, alex, interactionId, draft } = await overriddenAlex(
      "duration",
      600,
    );
    expect(
      await saveDraft(
        groupEventId,
        alex,
        interactionId,
        draft,
        edit(draft, { duration: 1200 }),
      ),
    ).toMatchObject({ duration: 1200, ge_follow_duration: 0 });
  });

  it("persists an overridden Tone → null and null → value", async () => {
    const { groupEventId, alex, interactionId, draft } = await overriddenAlex(
      "quality",
      "Negative",
    );
    const cleared = edit(draft, { quality: null });
    expect(
      await saveDraft(groupEventId, alex, interactionId, draft, cleared),
    ).toMatchObject({ quality: null, ge_follow_quality: 0 });

    const reloaded = (await initialDraft(groupEventId, alex)).draft;
    expect(reloaded.value.quality).toBeNull();
    expect(reloaded.follow.quality).toBe(false);
    expect(
      await saveDraft(
        groupEventId,
        alex,
        interactionId,
        reloaded,
        edit(reloaded, { quality: "Neutral" }),
      ),
    ).toMatchObject({ quality: "Neutral", ge_follow_quality: 0 });
  });

  it("an override edited to equal the parent value persists and stays detached (ADR-125)", async () => {
    const { groupEventId, alex, interactionId, draft } = await overriddenAlex(
      "quality",
      "Negative",
    );
    // Parent Tone is "Positive" (groupWithThreeChildren).
    expect(
      await saveDraft(
        groupEventId,
        alex,
        interactionId,
        draft,
        edit(draft, { quality: "Positive" }),
      ),
    ).toMatchObject({ quality: "Positive", ge_follow_quality: 0 });

    // Still detached: a later parent Tone change must not fan out to Alex.
    await updateGroupEvent(exec, {
      groupEventId,
      now: NOW,
      patch: { quality: { value: "Neutral" } },
    });
    expect(
      await exec.getFirstAsync(
        "SELECT quality, ge_follow_quality FROM interactions WHERE id = ?",
        [interactionId],
      ),
    ).toEqual({ quality: "Positive", ge_follow_quality: 0 });
  });

  it("a 'Follow event' draft re-attaches with the parent value", async () => {
    const { groupEventId, alex, interactionId, draft } = await overriddenAlex(
      "duration",
      600,
    );
    const following: ParticipantPatchDraft = {
      value: { ...draft.value, duration: 3600 },
      follow: { ...draft.follow, duration: true },
    };
    expect(
      await saveDraft(groupEventId, alex, interactionId, draft, following),
    ).toMatchObject({ duration: 3600, ge_follow_duration: 1 });
  });

  it("an unchanged draft is a no-op save (no revision bump)", async () => {
    const { groupEventId, alex, interactionId, draft } = await overriddenAlex(
      "channel",
      "Message",
    );
    const revision = await readDataRevision(exec);
    await saveDraft(groupEventId, alex, interactionId, draft, edit(draft, {}));
    expect(await readDataRevision(exec)).toBe(revision);
  });
});

describe("updateGroupEvent revision bumps (checker cycle 5 W-3)", () => {
  it("a changed Group Note advances data_revision by exactly 1", async () => {
    const { groupEventId } = await groupWithThreeChildren();
    const before = await readDataRevision(exec);
    await updateGroupEvent(exec, {
      groupEventId,
      now: NOW,
      patch: { groupNote: { value: "New shared note" } },
    });
    expect(await readDataRevision(exec)).toBe(before + 1);
  });

  it("an empty patch advances data_revision by 0", async () => {
    const { groupEventId } = await groupWithThreeChildren();
    const before = await readDataRevision(exec);
    await updateGroupEvent(exec, { groupEventId, now: NOW, patch: {} });
    expect(await readDataRevision(exec)).toBe(before);
  });
});

// --- Group Note copies (D-96, D-98, D-102, D-113, D-117) ----------------------

const LATER = "2026-09-12 15:30:00";

interface CopyRow {
  tbl: "memories" | "current_state_entries";
  id: number;
  contact_id: number;
  value: string;
  allow_ai: number | null;
  interaction_id: number | null;
  link_source: string | null;
  group_note_copy: number;
  modified_at: string;
  entry_date: string | null;
  entry_time: string | null;
}

async function copyRows(): Promise<CopyRow[]> {
  return exec.getAllAsync<CopyRow>(
    `SELECT 'memories' AS tbl, id, contact_id, value, allow_ai, interaction_id,
            link_source, group_note_copy, modified_at,
            NULL AS entry_date, NULL AS entry_time
       FROM memories
     UNION ALL
     SELECT 'current_state_entries' AS tbl, id, contact_id, value,
            NULL AS allow_ai, interaction_id, link_source, group_note_copy,
            modified_at, entry_date, entry_time
       FROM current_state_entries
     ORDER BY contact_id, tbl, id`,
  );
}

async function eventWithCopies(
  alsoSaveTo: LinkedSection | null | "absent" = "memory",
  groupNote: string | null = "Reunion plans",
): Promise<{ groupEventId: number; contacts: number[] }> {
  const contacts = [
    await contact("Alex"),
    await contact("Sam"),
    await contact("Jordan"),
  ];
  const { groupEventId } = await createGroupEvent(exec, {
    uid: uid(),
    title: "Dinner",
    occurredAt: "2026-09-10 18:00:00",
    now: NOW,
    groupNote,
    participants: contacts.map((contactId) => ({
      contactId,
      uid: uid(),
      note: `Own note ${contactId}`,
    })),
    ...(alsoSaveTo === "absent" ? {} : { alsoSaveTo }),
  });
  return { groupEventId, contacts };
}

async function childOf(groupEventId: number, contactId: number) {
  const row = await exec.getFirstAsync<{ id: number }>(
    "SELECT id FROM interactions WHERE group_event_id = ? AND contact_id = ?",
    [groupEventId, contactId],
  );
  if (!row) throw new Error("no child");
  return row.id;
}

describe("createGroupEvent with Also save to (D-96, D-98, D-102)", () => {
  it("gives every participant a linked, AI-off copy", async () => {
    const { groupEventId, contacts } = await eventWithCopies("memory");
    const rows = await copyRows();
    expect(rows).toHaveLength(3);
    for (const [index, contactId] of contacts.entries()) {
      expect(rows[index]).toMatchObject({
        tbl: "memories",
        contact_id: contactId,
        value: "Reunion plans",
        allow_ai: 0,
        interaction_id: await childOf(groupEventId, contactId),
        link_source: "group_note",
        group_note_copy: 1,
      });
    }
  });

  it("alsoSaveTo null or absent makes no copy in either table", async () => {
    await eventWithCopies(null);
    await eventWithCopies("absent");
    expect(await copyRows()).toEqual([]);
    expect(await count("group_events")).toBe(2);
    expect(await count("interactions")).toBe(6);
  });

  it("a blank Group Note makes no copy", async () => {
    await eventWithCopies("memory", "   ");
    expect(await copyRows()).toEqual([]);
  });
});

describe("Group Note propagation (D-96, D-113)", () => {
  it("a Group Note edit updates every copy", async () => {
    const { groupEventId } = await eventWithCopies("thought_of_them");
    await updateGroupEvent(exec, {
      groupEventId,
      now: LATER,
      patch: { groupNote: { value: "New plans" } },
    });
    expect((await copyRows()).map((r) => [r.value, r.modified_at])).toEqual([
      ["New plans", LATER],
      ["New plans", LATER],
      ["New plans", LATER],
    ]);
  });

  it("a date edit moves each Last Talked About copy's date and keeps its text", async () => {
    const { groupEventId } = await eventWithCopies("last_talked_about");
    expect((await copyRows())[0]).toMatchObject({
      entry_date: "2026-09-10",
      entry_time: "18:00:00",
    });
    await updateGroupEvent(exec, {
      groupEventId,
      now: LATER,
      occurredAt: "2026-09-11 07:05:00",
      patch: {},
    });
    for (const row of await copyRows()) {
      expect(row).toMatchObject({
        value: "Reunion plans",
        entry_date: "2026-09-11",
        entry_time: "07:05:00",
        link_source: "group_note",
      });
    }
  });

  it("a date edit does not clobber a memory copy's text", async () => {
    const { groupEventId } = await eventWithCopies("memory");
    await updateGroupEvent(exec, {
      groupEventId,
      now: LATER,
      occurredAt: "2026-09-11 07:05:00",
      patch: {},
    });
    expect((await copyRows()).map((r) => r.value)).toEqual([
      "Reunion plans",
      "Reunion plans",
      "Reunion plans",
    ]);
  });

  it("D-113: clearing the Group Note detaches every copy with its text kept", async () => {
    const { groupEventId } = await eventWithCopies("memory");
    await expect(
      updateGroupEvent(exec, {
        groupEventId,
        now: LATER,
        patch: { groupNote: { value: "  " } },
      }),
    ).resolves.toBeUndefined();
    for (const row of await copyRows()) {
      expect(row).toMatchObject({
        value: "Reunion plans",
        interaction_id: null,
        link_source: null,
        group_note_copy: 1,
        allow_ai: 0,
        modified_at: LATER,
      });
    }
    expect(
      await exec.getFirstAsync(
        "SELECT group_note FROM group_events WHERE id = ?",
        [groupEventId],
      ),
    ).toEqual({ group_note: "  " });

    await updateGroupEvent(exec, {
      groupEventId,
      now: NOW,
      patch: { groupNote: { value: "Back again" } },
    });
    expect((await copyRows()).map((r) => r.value)).toEqual([
      "Reunion plans",
      "Reunion plans",
      "Reunion plans",
    ]);
    const newcomer = await contact("Riley");
    await addParticipants(exec, {
      groupEventId,
      now: NOW,
      participants: [{ contactId: newcomer, uid: uid() }],
    });
    expect(await copyRows()).toHaveLength(3);
  });

  it("a participant's own linked note cleared to blank still throws LinkedNoteBlankError", async () => {
    const { groupEventId, contacts } = await eventWithCopies("memory");
    const alex = contacts[0];
    const interactionId = await childOf(groupEventId, alex);
    await inWriteTransaction(exec, () =>
      insertLinkedEntryCore(exec, {
        interactionId,
        contactId: alex,
        section: "gift_idea",
        text: `Own note ${alex}`,
        linkSource: "note",
        occurredAt: "2026-09-10 18:00:00",
        now: NOW,
      }),
    );
    await expect(
      setParticipantFields(exec, {
        groupEventId,
        interactionId,
        contactId: alex,
        now: LATER,
        fields: { note: "" },
      }),
    ).rejects.toBeInstanceOf(LinkedNoteBlankError);
  });

  it("D-117: a copy edited from the entry side detaches; later Group Note edits reach only linked copies", async () => {
    const { groupEventId } = await eventWithCopies("memory");
    const [edited, ...others] = await copyRows();
    await editMemory(exec, {
      id: edited.id,
      contactId: edited.contact_id,
      value: "My version",
      now: LATER,
    });
    expect(
      await exec.getFirstAsync(
        "SELECT group_note FROM group_events WHERE id = ?",
        [groupEventId],
      ),
    ).toEqual({ group_note: "Reunion plans" });
    await updateGroupEvent(exec, {
      groupEventId,
      now: LATER,
      patch: { groupNote: { value: "Second draft" } },
    });
    const rows = await copyRows();
    expect(rows.find((r) => r.id === edited.id)).toMatchObject({
      value: "My version",
      interaction_id: null,
      link_source: null,
      group_note_copy: 1,
      allow_ai: 0,
    });
    for (const other of others) {
      expect(rows.find((r) => r.id === other.id)).toMatchObject({
        value: "Second draft",
        link_source: "group_note",
      });
    }
  });
});

describe("Group Note copies on participant and event lifecycle (D-102, F-D12)", () => {
  it("detachParticipant unlinks only that participant's copy", async () => {
    const { groupEventId, contacts } = await eventWithCopies("memory");
    const sam = contacts[1];
    await detachParticipant(exec, {
      groupEventId,
      interactionId: await childOf(groupEventId, sam),
      now: LATER,
    });
    const rows = await copyRows();
    expect(rows.find((r) => r.contact_id === sam)).toMatchObject({
      interaction_id: null,
      link_source: null,
      group_note_copy: 1,
      allow_ai: 0,
      modified_at: LATER,
      value: "Reunion plans",
    });
    expect(
      rows
        .filter((r) => r.link_source === "group_note")
        .map((r) => r.contact_id),
    ).toEqual([contacts[0], contacts[2]]);
  });

  it("dissolveGroupEvent unlinks every copy, marker and text kept", async () => {
    const { groupEventId } = await eventWithCopies("last_talked_about");
    await dissolveGroupEvent(exec, { groupEventId, now: LATER });
    for (const row of await copyRows()) {
      expect(row).toMatchObject({
        interaction_id: null,
        link_source: null,
        group_note_copy: 1,
        modified_at: LATER,
        value: "Reunion plans",
      });
    }
  });

  it("deleteGroupEventAndInteractions leaves standalone, still-locked copies (FK SET NULL)", async () => {
    const { groupEventId } = await eventWithCopies("memory");
    await deleteGroupEventAndInteractions(exec, { groupEventId, now: LATER });
    for (const row of await copyRows()) {
      expect(row).toMatchObject({
        interaction_id: null,
        group_note_copy: 1,
        allow_ai: 0,
        value: "Reunion plans",
      });
    }
  });

  it("deleteGroupChild leaves that copy standalone and still locked", async () => {
    const { groupEventId, contacts } = await eventWithCopies("memory");
    const jordan = contacts[2];
    await deleteGroupChild(exec, {
      groupEventId,
      interactionId: await childOf(groupEventId, jordan),
      contactId: jordan,
      now: LATER,
    });
    expect(
      (await copyRows()).find((r) => r.contact_id === jordan),
    ).toMatchObject({ interaction_id: null, group_note_copy: 1, allow_ai: 0 });
  });

  it("an added participant gets a copy in the same section as the existing copies", async () => {
    const { groupEventId } = await eventWithCopies("gift_idea");
    const riley = await contact("Riley");
    await addParticipants(exec, {
      groupEventId,
      now: LATER,
      participants: [{ contactId: riley, uid: uid() }],
    });
    const added = await exec.getFirstAsync(
      `SELECT type, value, allow_ai, link_source, group_note_copy, interaction_id
         FROM memories WHERE contact_id = ?`,
      [riley],
    );
    expect(added).toEqual({
      type: "gift_idea",
      value: "Reunion plans",
      allow_ai: 0,
      link_source: "group_note",
      group_note_copy: 1,
      interaction_id: await childOf(groupEventId, riley),
    });
  });

  it("an added participant gets no copy when the event has none", async () => {
    const { groupEventId } = await eventWithCopies(null);
    const riley = await contact("Riley");
    await addParticipants(exec, {
      groupEventId,
      now: LATER,
      participants: [{ contactId: riley, uid: uid() }],
    });
    expect(await copyRows()).toEqual([]);
  });
});

// --- Event title rename (38.14 D-69, D-48) -----------------------------------

describe("updateGroupEvent title (38.14 D-69, D-48)", () => {
  const EDIT_NOW = "2026-09-12 13:00:00";

  async function eventRow(groupEventId: number) {
    return exec.getFirstAsync<{
      title: string;
      modified_at: string;
      group_note: string | null;
    }>("SELECT title, modified_at, group_note FROM group_events WHERE id = ?", [
      groupEventId,
    ]);
  }

  async function childStamps(groupEventId: number) {
    return exec.getAllAsync<{ id: number; modified_at: string }>(
      "SELECT id, modified_at FROM interactions WHERE group_event_id = ? ORDER BY id",
      [groupEventId],
    );
  }

  it("stores the trimmed title, stamps modified_at, bumps the revision once and leaves children unchanged", async () => {
    const { groupEventId } = await groupWithThreeChildren();
    const children = await groupChildren(groupEventId);
    const stamps = await childStamps(groupEventId);
    const revision = await readDataRevision(exec);

    await updateGroupEvent(exec, {
      groupEventId,
      now: EDIT_NOW,
      patch: { title: { value: "  Brunch  " } },
    });

    expect(await eventRow(groupEventId)).toMatchObject({
      title: "Brunch",
      modified_at: EDIT_NOW,
    });
    expect(await readDataRevision(exec)).toBe(revision + 1);
    expect(await groupChildren(groupEventId)).toEqual(children);
    expect(await childStamps(groupEventId)).toEqual(stamps);
  });

  it.each(["", "   "])(
    "refuses the blank title %j before any write: title kept, no revision bump",
    async (blank) => {
      const { groupEventId } = await groupWithThreeChildren();
      const before = await eventRow(groupEventId);
      const revision = await readDataRevision(exec);

      await expect(
        updateGroupEvent(exec, {
          groupEventId,
          now: EDIT_NOW,
          patch: { title: { value: blank } },
        }),
      ).rejects.toThrow("updateGroupEvent: title must not be blank");

      expect(await eventRow(groupEventId)).toEqual(before);
      expect(await readDataRevision(exec)).toBe(revision);
    },
  );

  it("guards the exported core too: a blank title throws and writes nothing", async () => {
    const { groupEventId } = await groupWithThreeChildren();
    const before = await eventRow(groupEventId);
    const revision = await readDataRevision(exec);

    await expect(
      inWriteTransaction(exec, () =>
        updateGroupEventCore(exec, {
          groupEventId,
          now: EDIT_NOW,
          patch: { title: { value: "  " }, groupNote: { value: "not saved" } },
        }),
      ),
    ).rejects.toThrow("updateGroupEventCore: title must not be blank");

    expect(await eventRow(groupEventId)).toEqual(before);
    expect(await readDataRevision(exec)).toBe(revision);
  });

  it("rejects a title for an unknown event and changes nothing", async () => {
    const revision = await readDataRevision(exec);
    await expect(
      updateGroupEvent(exec, {
        groupEventId: 9999,
        now: EDIT_NOW,
        patch: { title: { value: "Brunch" } },
      }),
    ).rejects.toThrow(/no longer exists/);
    expect(await readDataRevision(exec)).toBe(revision);
  });

  it("rolls the title back when a later write in the same save fails", async () => {
    const { groupEventId } = await groupWithThreeChildren();
    const before = await eventRow(groupEventId);
    const revision = await readDataRevision(exec);
    const baseRun = exec.runAsync.bind(exec);
    const failingExec: SqlExecutor = {
      ...exec,
      runAsync: async (sql, params) => {
        if (sql.startsWith("UPDATE group_events SET group_note")) {
          throw new Error("forced note failure");
        }
        return baseRun(sql, params);
      },
    };

    await expect(
      updateGroupEvent(failingExec, {
        groupEventId,
        now: EDIT_NOW,
        patch: {
          title: { value: "Brunch" },
          groupNote: { value: "Changed" },
        },
      }),
    ).rejects.toThrow(/forced note failure/);

    expect(await eventRow(groupEventId)).toEqual(before);
    expect(await readDataRevision(exec)).toBe(revision);
  });
});
