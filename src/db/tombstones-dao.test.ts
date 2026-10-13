import { describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import {
  assertTombstoneEntityType,
  deleteTombstoneCore,
  insertTombstoneCore,
  listTombstones,
  type TombstoneEntityType,
} from "@/db/tombstones-dao";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-10-13 12:00:00";

async function freshDb(): Promise<SqlExecutor> {
  const exec = nodeSqliteExecutor(openTestDb());
  let n = 0;
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => `uid-${++n}`,
  });
  return exec;
}

async function revision(exec: SqlExecutor): Promise<number> {
  return (
    (await exec.getFirstAsync<{ data_revision: number }>(
      "SELECT data_revision FROM app_settings WHERE id = 1",
    )) as { data_revision: number }
  ).data_revision;
}

describe("tombstone entity types (38.10)", () => {
  it("accepts off_limits and rejects the retired legacy type", () => {
    expect(() => assertTombstoneEntityType("off_limits")).not.toThrow();
    expect(() => assertTombstoneEntityType("fuel")).toThrow(
      /unsupported tombstone entity type: fuel/,
    );
  });

  it("listTombstones rejects a stored row of the retired type", async () => {
    const exec = await freshDb();
    await exec.runAsync(
      "INSERT INTO tombstones (entity_type, entity_uid, deleted_at) VALUES ('fuel', 'x', ?)",
      [NOW],
    );
    await expect(listTombstones(exec)).rejects.toThrow(/fuel/);
  });
});

describe("insertTombstoneCore", () => {
  it("keeps the newest deleted_at on a conflict and bumps the revision by default", async () => {
    const exec = await freshDb();
    const key = { entityType: "off_limits" as const, entityUid: "ol-1" };
    await insertTombstoneCore(exec, {
      ...key,
      deletedAt: "2026-05-05 00:00:00",
    });
    await insertTombstoneCore(exec, {
      ...key,
      deletedAt: "2026-04-04 00:00:00",
    });
    expect(await listTombstones(exec)).toEqual([
      { ...key, deletedAt: "2026-05-05 00:00:00" },
    ]);
    await insertTombstoneCore(exec, {
      ...key,
      deletedAt: "2026-06-06 00:00:00",
    });
    expect(await listTombstones(exec)).toEqual([
      { ...key, deletedAt: "2026-06-06 00:00:00" },
    ]);
    expect(await revision(exec)).toBe(3);
    await insertTombstoneCore(
      exec,
      { ...key, deletedAt: "2026-07-07 00:00:00" },
      { bumpRevision: false },
    );
    expect(await revision(exec)).toBe(3);
  });

  it("refuses an unknown entity type before writing", async () => {
    const exec = await freshDb();
    await expect(
      insertTombstoneCore(exec, {
        entityType: "fuel" as TombstoneEntityType,
        entityUid: "x",
        deletedAt: NOW,
      }),
    ).rejects.toThrow(/unsupported/);
    expect(await listTombstones(exec)).toEqual([]);
  });
});

describe("deleteTombstoneCore", () => {
  it("removes exactly the matching tombstone and reports the change count", async () => {
    const exec = await freshDb();
    for (const [entityType, entityUid] of [
      ["memory", "m-1"],
      ["off_limits", "m-1"],
      ["memory", "m-2"],
    ] as const) {
      await insertTombstoneCore(
        exec,
        { entityType, entityUid, deletedAt: NOW },
        { bumpRevision: false },
      );
    }

    expect(
      await deleteTombstoneCore(exec, {
        entityType: "memory",
        entityUid: "m-1",
      }),
    ).toBe(1);
    expect(await listTombstones(exec)).toEqual([
      { entityType: "memory", entityUid: "m-2", deletedAt: NOW },
      { entityType: "off_limits", entityUid: "m-1", deletedAt: NOW },
    ]);
    expect(
      await deleteTombstoneCore(exec, {
        entityType: "memory",
        entityUid: "m-1",
      }),
    ).toBe(0);
    expect(await revision(exec)).toBe(0);
  });

  it("refuses an unknown entity type", async () => {
    const exec = await freshDb();
    await expect(
      deleteTombstoneCore(exec, {
        entityType: "fuel" as TombstoneEntityType,
        entityUid: "x",
      }),
    ).rejects.toThrow(/unsupported/);
  });
});
