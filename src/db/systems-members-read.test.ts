import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import {
  listActiveMemberRows,
  readMemberRowsByIds,
} from "@/db/systems-members-read";

let db: ReturnType<typeof openTestDb>;
let exec: ReturnType<typeof nodeSqliteExecutor>;
let sequence = 0;

beforeEach(async () => {
  db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: "2026-09-08 12:00:00",
    newUid: () => `uid-${++sequence}`,
  });
});

afterEach(() => db.close());

async function contact(input: {
  name: string;
  photo: string | null;
  lastContact?: string | null;
  tracked?: boolean;
  archived?: boolean;
}): Promise<number> {
  const row = await exec.runAsync(
    `INSERT INTO contacts
      (uid, name, photo, interval_days, tracking_enabled, last_contact, archived_at, created_at, modified_at)
     VALUES (?, ?, ?, 14, ?, ?, ?, '2026-01-01', '2026-01-01')`,
    [
      `contact-${++sequence}`,
      input.name,
      input.photo,
      input.tracked === false ? 0 : 1,
      input.lastContact ?? "2026-09-01",
      input.archived ? "2026-09-02" : null,
    ],
  );
  return row.lastInsertRowId;
}

describe("System member display reads", () => {
  it("offers only eligible active contacts to Add People with durable photos", async () => {
    const active = await contact({
      name: "Active",
      photo: "avatars/active.jpg",
    });
    await contact({
      name: "Archived",
      photo: "avatars/archived.jpg",
      archived: true,
    });
    await contact({
      name: "Unbound",
      photo: "avatars/unbound.jpg",
      tracked: false,
    });

    expect(await listActiveMemberRows(exec)).toEqual([
      {
        id: active,
        name: "Active",
        photo: "avatars/active.jpg",
        searchMethods: ["Active"],
        available: true,
      },
    ]);
  });

  it("retains arbitrary archived and never-contacted display rows", async () => {
    const archived = await contact({
      name: "Archived include",
      photo: "avatars/archived.jpg",
      archived: true,
    });
    const neverContacted = await contact({
      name: "Never contacted candidate",
      photo: null,
      lastContact: null,
    });

    expect(await readMemberRowsByIds(exec, [archived, neverContacted])).toEqual(
      [
        {
          id: archived,
          name: "Archived include",
          photo: "avatars/archived.jpg",
          searchMethods: ["Archived include"],
          available: false,
        },
        {
          id: neverContacted,
          name: "Never contacted candidate",
          photo: null,
          searchMethods: ["Never contacted candidate"],
          available: true,
        },
      ],
    );
  });
});
