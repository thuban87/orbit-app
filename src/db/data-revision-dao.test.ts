import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { readDataRevision } from "@/db/data-revision-dao";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { migration007 } from "@/db/migrations/007-tombstones";
import { runMigrations } from "@/db/migrations/runner";
import { insertTombstoneCore } from "@/db/tombstones-dao";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-25 12:00:00";
let counter = 0;
const newUid = () => `uid-${++counter}`;
let exec: SqlExecutor;

beforeEach(async () => {
  counter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(
    exec,
    [migration001, migration002, migration003, migration004, migration005, migration006, migration007],
    7,
    { now: NOW, newUid },
  );
});

describe("data revision tombstone integration", () => {
  it("advances exactly once for each same-second tombstone", async () => {
    expect(await readDataRevision(exec)).toBe(0);

    await insertTombstoneCore(exec, {
      entityType: "contact",
      entityUid: "contact-a",
      deletedAt: NOW,
    });
    expect(await readDataRevision(exec)).toBe(1);

    await insertTombstoneCore(exec, {
      entityType: "interaction",
      entityUid: "interaction-a",
      deletedAt: NOW,
    });
    expect(await readDataRevision(exec)).toBe(2);
  });

  it("rejects an entity type outside the closed runtime vocabulary before writing", async () => {
    await expect(
      insertTombstoneCore(exec, {
        entityType: "not-a-real-type" as never,
        entityUid: "bad",
        deletedAt: NOW,
      }),
    ).rejects.toThrow(/unsupported tombstone entity type/i);
    expect(await readDataRevision(exec)).toBe(0);
  });
});
