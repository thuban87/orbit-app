/**
 * Shared contact reads — behavioural proof (CRUD-01 / CRUD-02 form backing).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * and the REAL read helpers:
 *   - `isDuplicateName` finds a LIVE same-name contact case-insensitively
 *     (COLLATE NOCASE), excludes archived rows, and excludes self on edit
 *     (`excludeId`) — the create/edit duplicate-warning source (Pitfall 6);
 *   - `listCategories` returns the 4 seeded categories in display_order (the
 *     category-picker source);
 *   - `getContactHeader` is a by-id seek returning the light Profile fields (and
 *     null for a missing id), archived-reachable by design (no archived filter).
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  getContactHeader,
  isDuplicateName,
  listCategories,
} from "@/db/contact-read";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-14 12:00:00";

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;

let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, [migration001], 1, { now: NOW, newUid: uid });
});

/** Insert a bare contact row (optionally archived / rarely_responds) and return its id. */
async function makeContact(
  name: string,
  opts: { archived?: boolean; rarelyResponds?: number } = {},
): Promise<number> {
  const r = await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, interval_days, rarely_responds, archived_at, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      name,
      30,
      opts.rarelyResponds ?? 0,
      opts.archived ? NOW : null,
      NOW,
      NOW,
    ],
  );
  return r.lastInsertRowId;
}

describe("isDuplicateName — live, case-insensitive, self-excluding (Pitfall 6)", () => {
  it("returns true for an existing live same-name contact", async () => {
    await makeContact("Chris");
    expect(await isDuplicateName(exec, "Chris")).toBe(true);
  });

  it("matches case-insensitively (COLLATE NOCASE): 'chris' hits 'Chris'", async () => {
    await makeContact("Chris");
    expect(await isDuplicateName(exec, "chris")).toBe(true);
  });

  it("returns false when the only same-name match is archived", async () => {
    await makeContact("Archie", { archived: true });
    expect(await isDuplicateName(exec, "Archie")).toBe(false);
  });

  it("returns false for the row itself when excludeId is passed (edit self-exclusion)", async () => {
    const id = await makeContact("Solo");
    expect(await isDuplicateName(exec, "Solo", id)).toBe(false);
    // A DIFFERENT live row with the same name still trips the duplicate check.
    await makeContact("Solo");
    expect(await isDuplicateName(exec, "Solo", id)).toBe(true);
  });

  it("returns false when no contact has the name", async () => {
    expect(await isDuplicateName(exec, "Nobody")).toBe(false);
  });
});

describe("listCategories — the 4 seeded categories in display_order", () => {
  it("returns Family/Friends/Work/Community in order", async () => {
    const cats = await listCategories(exec);
    expect(cats.map((c) => c.name)).toEqual([
      "Family",
      "Friends",
      "Work",
      "Community",
    ]);
    expect(cats.every((c) => typeof c.id === "number")).toBe(true);
  });
});

describe("getContactHeader — by-id light read (archived-reachable by design)", () => {
  it("returns the header fields for an existing contact", async () => {
    const id = await makeContact("Priya", { rarelyResponds: 1 });
    const header = await getContactHeader(exec, id);
    expect(header).not.toBeNull();
    expect(header?.id).toBe(id);
    expect(header?.name).toBe("Priya");
    expect(header?.rarely_responds).toBe(1);
    expect(header?.archived_at).toBeNull();
  });

  it("loads an archived contact by id (no archived filter on this by-id seek)", async () => {
    const id = await makeContact("Gone", { archived: true });
    const header = await getContactHeader(exec, id);
    expect(header?.id).toBe(id);
    expect(header?.archived_at).toBe(NOW);
  });

  it("returns null for a missing id", async () => {
    expect(await getContactHeader(exec, 9999)).toBeNull();
  });
});
