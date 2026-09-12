import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  createGroupEvent,
  setParticipantOverride,
} from "@/db/group-events-dao";
import {
  listGroupEvents,
  readGroupEventDetail,
  resolveParticipants,
  searchGroupEvents,
} from "@/db/group-events-read";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-12 12:00:00";
let sequence = 0;
let exec: SqlExecutor;

const uid = () => `group-events-read-${++sequence}`;

beforeEach(async () => {
  sequence = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
  });
});

async function contact(
  name: string,
  photo: string | null = null,
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, photo, created_at, modified_at)
     VALUES (?, ?, 30, ?, ?, ?)`,
    [uid(), name, photo, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function event(input: {
  title: string;
  occurredAt: string;
  participants?: Array<{
    contactId: number;
    direction?: string | null;
    connected?: number;
    note?: string | null;
  }>;
  channel?: string;
  quality?: string | null;
  duration?: number | null;
  groupNote?: string | null;
}): Promise<number> {
  const { groupEventId } = await createGroupEvent(exec, {
    uid: uid(),
    title: input.title,
    occurredAt: input.occurredAt,
    now: NOW,
    channel: input.channel,
    quality: input.quality,
    duration: input.duration,
    groupNote: input.groupNote,
    participants: (input.participants ?? []).map((participant) => ({
      ...participant,
      uid: uid(),
    })),
  });
  return groupEventId;
}

describe("Group Event browse and search reads", () => {
  it("lists reverse-chronologically with deterministic id ties and counts participants", async () => {
    const alex = await contact("Alex");
    const older = await event({
      title: "Older dinner",
      occurredAt: "2026-09-09 18:00:00",
      participants: [{ contactId: alex }],
    });
    const firstTie = await event({
      title: "Same time first",
      occurredAt: "2026-09-10 18:00:00",
      participants: [{ contactId: alex }],
    });
    const secondTie = await event({
      title: "Same time second",
      occurredAt: "2026-09-10 18:00:00",
      participants: [{ contactId: alex }],
      channel: "Call",
      quality: "Positive",
      duration: 3600,
      groupNote: "Shared note",
    });

    await expect(listGroupEvents(exec, {})).resolves.toEqual([
      expect.objectContaining({
        id: secondTie,
        title: "Same time second",
        occurredAt: "2026-09-10 18:00:00",
        channel: "Call",
        quality: "Positive",
        duration: 3600,
        groupNote: "Shared note",
        participantCount: 1,
      }),
      expect.objectContaining({ id: firstTie, title: "Same time first" }),
      expect.objectContaining({ id: older, title: "Older dinner" }),
    ]);
    await expect(
      listGroupEvents(exec, { limit: 1, offset: 1 }),
    ).resolves.toEqual([expect.objectContaining({ id: firstTie })]);
  });

  it("returns an empty browse when no events exist", async () => {
    await expect(listGroupEvents(exec, {})).resolves.toEqual([]);
  });

  it("searches titles and participant names once per event, while blank terms browse all", async () => {
    const alex = await contact("Alex");
    const sam = await contact("Sam");
    const both = await event({
      title: "Alex gathering",
      occurredAt: "2026-09-11 18:00:00",
      participants: [{ contactId: alex }],
    });
    const participantOnly = await event({
      title: "Board games",
      occurredAt: "2026-09-10 18:00:00",
      participants: [{ contactId: alex }, { contactId: sam }],
    });
    await event({
      title: "Dinner",
      occurredAt: "2026-09-09 18:00:00",
      participants: [{ contactId: sam }],
    });

    await expect(searchGroupEvents(exec, { term: "Alex" })).resolves.toEqual([
      expect.objectContaining({ id: both }),
      expect.objectContaining({ id: participantOnly }),
    ]);
    await expect(searchGroupEvents(exec, { term: "   " })).resolves.toEqual(
      await listGroupEvents(exec, {}),
    );
  });

  it("treats percent, underscore, and backslash search characters literally", async () => {
    const percent = await event({
      title: "100% attendance",
      occurredAt: "2026-09-11 18:00:00",
    });
    const underscore = await event({
      title: "under_score",
      occurredAt: "2026-09-10 18:00:00",
    });
    const slash = await event({
      title: "path\\to",
      occurredAt: "2026-09-09 18:00:00",
    });
    await event({ title: "ordinary title", occurredAt: "2026-09-08 18:00:00" });

    await expect(searchGroupEvents(exec, { term: "%" })).resolves.toEqual([
      expect.objectContaining({ id: percent }),
    ]);
    await expect(searchGroupEvents(exec, { term: "_" })).resolves.toEqual([
      expect.objectContaining({ id: underscore }),
    ]);
    await expect(searchGroupEvents(exec, { term: "\\" })).resolves.toEqual([
      expect.objectContaining({ id: slash }),
    ]);
  });
});

describe("Group Event detail and participant resolution reads", () => {
  it("returns parent detail with resolved participants and exactly three follow flags", async () => {
    const alex = await contact("Alex", "avatars/alex.jpg");
    const sam = await contact("Sam");
    const groupEventId = await event({
      title: "Dinner",
      occurredAt: "2026-09-10 18:00:00",
      participants: [
        {
          contactId: alex,
          direction: "outbound",
          connected: 1,
          note: "Alex note",
        },
        {
          contactId: sam,
          direction: "inbound",
          connected: 0,
          note: "Sam note",
        },
      ],
      channel: "Call",
      quality: "Positive",
      duration: 3600,
      groupNote: "Shared note",
    });
    const samChild = await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM interactions WHERE group_event_id = ? AND contact_id = ?",
      [groupEventId, sam],
    );
    if (!samChild) throw new Error("expected Sam child");
    await setParticipantOverride(exec, {
      interactionId: samChild.id,
      contactId: sam,
      groupEventId,
      now: NOW,
      field: "quality",
      value: "Negative",
    });

    await expect(readGroupEventDetail(exec, { groupEventId })).resolves.toEqual(
      {
        id: groupEventId,
        uid: expect.any(String),
        title: "Dinner",
        occurredAt: "2026-09-10 18:00:00",
        channel: "Call",
        quality: "Positive",
        duration: 3600,
        groupNote: "Shared note",
        participants: [
          expect.objectContaining({
            contactId: alex,
            contactName: "Alex",
            contactPhoto: "avatars/alex.jpg",
            channel: "Call",
            quality: "Positive",
            duration: 3600,
            direction: "outbound",
            connected: 1,
            geFollowChannel: 1,
            geFollowQuality: 1,
            geFollowDuration: 1,
            note: "Alex note",
          }),
          expect.objectContaining({
            contactId: sam,
            contactName: "Sam",
            contactPhoto: null,
            channel: "Call",
            quality: "Negative",
            duration: 3600,
            direction: "inbound",
            connected: 0,
            geFollowChannel: 1,
            geFollowQuality: 0,
            geFollowDuration: 1,
            note: "Sam note",
          }),
        ],
      },
    );
    await expect(resolveParticipants(exec, { groupEventId })).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ contactId: alex }),
        expect.objectContaining({ contactId: sam }),
      ]),
    );
    const participants = await resolveParticipants(exec, { groupEventId });
    expect(participants[0]).not.toHaveProperty("geFollowDirection");
    expect(participants[0]).not.toHaveProperty("geFollowConnected");
  });

  it("returns null for a missing parent and an empty list for a zero-participant event", async () => {
    const groupEventId = await event({
      title: "Planning",
      occurredAt: "2026-09-10 18:00:00",
    });

    await expect(resolveParticipants(exec, { groupEventId })).resolves.toEqual(
      [],
    );
    await expect(readGroupEventDetail(exec, { groupEventId })).resolves.toEqual(
      expect.objectContaining({ participants: [] }),
    );
    await expect(
      readGroupEventDetail(exec, { groupEventId: 9999 }),
    ).resolves.toBeNull();
  });
});
