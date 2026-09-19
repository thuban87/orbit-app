import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import {
  readYourWeekDateCounts,
  readYourWeekDay,
  readYourWeekMetrics,
} from "@/db/your-week-read";

const NOW = "2026-09-19 12:00:00";
let exec: SqlExecutor;

async function contact(
  uid: string,
  name: string,
  archived = false,
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts(uid,name,interval_days,archived_at,created_at,modified_at)
     VALUES(?,?,?,?,?,?)`,
    [uid, name, 7, archived ? NOW : null, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function interaction(
  uid: string,
  contactId: number,
  occurredAt: string,
  groupEventId: number | null = null,
): Promise<void> {
  await exec.runAsync(
    `INSERT INTO interactions
       (uid,contact_id,occurred_at,recorded_at,channel,connected,source,modified_at,group_event_id)
     VALUES(?,?,?,?,?,1,'manual',?,?)`,
    [
      uid,
      contactId,
      occurredAt,
      occurredAt,
      "In Person",
      occurredAt,
      groupEventId,
    ],
  );
}

async function groupEvent(
  uid: string,
  title: string,
  occurredAt: string,
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO group_events(uid,title,occurred_at,created_at,modified_at)
     VALUES(?,?,?,?,?)`,
    [uid, title, occurredAt, occurredAt, occurredAt],
  );
  return result.lastInsertRowId;
}

beforeEach(async () => {
  let uid = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => `seed-${++uid}`,
  });
});

describe("Your Week app-wide reads", () => {
  it("separates child-inclusive headline metrics from deduplicated activity units", async () => {
    const ada = await contact("ada", "Ada");
    const bea = await contact("bea", "Bea");
    const archived = await contact("cal", "Cal", true);
    const dinner = await groupEvent("dinner", "Dinner", "2026-09-16 19:00:00");
    await interaction("dinner-ada", ada, "2026-09-16 19:00:00", dinner);
    await interaction("dinner-bea", bea, "2026-09-16 19:00:00", dinner);
    await interaction("coffee", ada, "2026-09-16 08:00:00");
    await interaction("archived", archived, "2026-09-17 08:00:00");
    await interaction("outside", bea, "2026-09-08 08:00:00");

    expect(await readYourWeekMetrics(exec, "2026-09-14", "2026-09-20")).toEqual(
      {
        peopleReached: 2,
        interactions: 3,
        events: 1,
      },
    );
    expect(
      await readYourWeekDateCounts(exec, "2026-09-14", "2026-09-20"),
    ).toEqual([{ d: "2026-09-16", n: 2 }]);
    expect(await readYourWeekDay(exec, "2026-09-16")).toEqual([
      expect.objectContaining({ kind: "group_event", title: "Dinner" }),
      expect.objectContaining({ kind: "interaction", contactName: "Ada" }),
    ]);
  });

  it("retains a group event whose participants are all archived as one activity", async () => {
    const archivedA = await contact("arch-a", "Archived A", true);
    const archivedB = await contact("arch-b", "Archived B", true);
    const event = await groupEvent("reunion", "Reunion", "2026-09-18 20:00:00");
    await interaction("reunion-a", archivedA, "2026-09-18 20:00:00", event);
    await interaction("reunion-b", archivedB, "2026-09-18 20:00:00", event);

    expect(await readYourWeekMetrics(exec, "2026-09-14", "2026-09-20")).toEqual(
      {
        peopleReached: 0,
        interactions: 0,
        events: 1,
      },
    );
    expect(
      await readYourWeekDateCounts(exec, "2026-09-14", "2026-09-20"),
    ).toEqual([{ d: "2026-09-18", n: 1 }]);
    expect(await readYourWeekDay(exec, "2026-09-18")).toEqual([
      expect.objectContaining({ kind: "group_event", title: "Reunion" }),
    ]);
  });
});
