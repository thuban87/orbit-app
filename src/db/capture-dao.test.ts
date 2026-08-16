/**
 * Share-sheet capture writer — behavioural proof (CAP-02 / CAP-04).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * and the REAL capture DAO, asserting the two load-bearing invariants:
 *   - captureMultiAttach fans N `addFuelCore` inserts into ONE transaction, each
 *     row its own uid + kind='topic'/source='share', and RETURNS the ordered
 *     `{ id, contactId }[]` (A1) — the ids map to the actually-persisted rows;
 *     a throw mid-loop rolls back ALL N (atomic fan-out);
 *   - captureMultiNote recomposes the display `text` of N already-written rows in
 *     ONE transaction (editFuelCore × N, patch-scoped) — url/created_at untouched,
 *     modified_at bumped; a throw mid-loop rolls back ALL N (B1);
 *   - capture is NOT a touchpoint: after a capture onto a never-contacted contact
 *     `last_contact` stays NULL and the interactions table has zero rows (CAP-04).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { captureMultiAttach, captureMultiNote } from "@/db/capture-dao";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import type { NewFuelItem } from "@/db/fuel-dao";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-15 12:00:00";
const LATER = "2026-08-16 09:30:00";

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;

let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, [migration001], 1, { now: NOW, newUid: uid });
});

/** Insert a bare (never-contacted) contact — last_contact stays NULL. */
async function seedContact(name: string): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [uid(), name, 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

type FuelRow = {
  id: number;
  uid: string;
  contact_id: number;
  kind: string;
  text: string | null;
  url: string | null;
  created_at: string;
  source: string;
  modified_at: string;
};

async function allFuel(): Promise<FuelRow[]> {
  return exec.getAllAsync<FuelRow>("SELECT * FROM fuel ORDER BY id");
}

/** A share-captured topic row for `contactId`. */
function shareRow(contactId: number, text: string, url?: string): NewFuelItem {
  return {
    uid: uid(),
    contactId,
    kind: "topic",
    text,
    url: url ?? null,
    createdAt: NOW,
    source: "share",
    now: NOW,
  };
}

describe("captureMultiAttach — N atomic fuel rows, ordered ids returned (A1)", () => {
  it("writes exactly N rows (own uid, topic/share) in one transaction and returns ordered {id, contactId}", async () => {
    const a = await seedContact("Alex");
    const b = await seedContact("Blair");
    const c = await seedContact("Casey");
    const rows = [
      shareRow(a, "for Alex", "https://ex.com/a"),
      shareRow(b, "for Blair", "https://ex.com/b"),
      shareRow(c, "for Casey", "https://ex.com/c"),
    ];

    const result = await captureMultiAttach(exec, rows);

    // Returned in input order, each contactId echoed.
    expect(result.map((r) => r.contactId)).toEqual([a, b, c]);

    const persisted = await allFuel();
    expect(persisted.length).toBe(3);
    // Returned ids map to the actually-persisted rows (id + contact_id).
    for (let i = 0; i < result.length; i++) {
      const row = persisted.find((p) => p.id === result[i]?.id);
      expect(row).toBeDefined();
      expect(row?.contact_id).toBe(result[i]?.contactId);
      expect(row?.kind).toBe("topic");
      expect(row?.source).toBe("share");
    }
    // Each row owns its own uid.
    expect(new Set(persisted.map((p) => p.uid)).size).toBe(3);
  });

  it("rolls back ALL N when a row fails mid-loop (atomic fan-out)", async () => {
    const a = await seedContact("Alex");
    const rows = [
      shareRow(a, "first"),
      // Row 2 references a non-existent contact → FK violation → throw.
      shareRow(999999, "bad row"),
      shareRow(a, "third"),
    ];

    await expect(captureMultiAttach(exec, rows)).rejects.toThrow();

    const persisted = await allFuel();
    expect(persisted.length).toBe(0);
  });

  it("writes exactly one row for a single-contact capture (N=1)", async () => {
    const a = await seedContact("Alex");

    const result = await captureMultiAttach(exec, [shareRow(a, "solo")]);

    expect(result.length).toBe(1);
    const persisted = await allFuel();
    expect(persisted.length).toBe(1);
    expect(persisted[0]?.id).toBe(result[0]?.id);
  });
});

describe("captureMultiAttach — capture is NOT a touchpoint (CAP-04)", () => {
  it("leaves last_contact NULL and writes zero interaction rows", async () => {
    const a = await seedContact("Never Contacted");

    await captureMultiAttach(exec, [shareRow(a, "a link")]);

    const contact = await exec.getFirstAsync<{ last_contact: string | null }>(
      "SELECT last_contact FROM contacts WHERE id = ?",
      [a],
    );
    expect(contact?.last_contact).toBeNull();

    const interactions = await exec.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM interactions WHERE contact_id = ?",
      [a],
    );
    expect(interactions?.n).toBe(0);
  });
});

describe("captureMultiNote — atomic note apply to N rows (B1)", () => {
  it("applies the note text to all N rows, leaving url/created_at untouched and bumping modified_at", async () => {
    const a = await seedContact("Alex");
    const b = await seedContact("Blair");
    const written = await captureMultiAttach(exec, [
      shareRow(a, null as unknown as string, "https://ex.com/a"),
      shareRow(b, null as unknown as string, "https://ex.com/b"),
    ]);

    await captureMultiNote(exec, written, "shared from the browser", LATER);

    const persisted = await allFuel();
    expect(persisted.length).toBe(2);
    for (const row of persisted) {
      expect(row.text).toBe("shared from the browser");
      expect(row.created_at).toBe(NOW); // untouched
      expect(row.modified_at).toBe(LATER); // bumped
    }
    // url stays row-specific and untouched.
    expect(persisted.map((r) => r.url).sort()).toEqual([
      "https://ex.com/a",
      "https://ex.com/b",
    ]);
  });

  it("rolls back ALL N when a (id, contactId) pair is bad mid-loop (no partial note)", async () => {
    const a = await seedContact("Alex");
    const b = await seedContact("Blair");
    const written = await captureMultiAttach(exec, [
      shareRow(a, "orig a"),
      shareRow(b, "orig b"),
    ]);

    await expect(
      captureMultiNote(
        exec,
        [
          written[0] as { id: number; contactId: number },
          // Row 2: a mismatched (id, contactId) pair → editFuelCore changes 0 → throw.
          { id: written[1]?.id ?? 0, contactId: 999999 },
        ],
        "should not stick",
        LATER,
      ),
    ).rejects.toThrow();

    const persisted = await allFuel();
    // Neither row keeps the note; both retain their original text + modified_at.
    expect(persisted.map((r) => r.text).sort()).toEqual(["orig a", "orig b"]);
    for (const row of persisted) {
      expect(row.modified_at).toBe(NOW);
    }
  });
});
