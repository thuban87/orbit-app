/**
 * Capture picker read — behavioural proof (CAP-01; 38.10 D-30, D-108).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the full migration chain
 * (the share-recency join reads migration 033 columns) and the REAL
 * `listCapturePickContacts` read, asserting the picker ordering contract:
 *   - favourites (favourite_rank NOT NULL) sort before recently-shared non-favs;
 *   - among non-favourites, share recency DESC, never-shared last;
 *   - a share moved to Last Talked About or Off Limits (from_share 1) still
 *     counts; a typed Last Talked About entry, a typed memory and a trashed
 *     share memory do not;
 *   - a never-contacted contact (last_contact NULL) is INCLUDED;
 *   - an archived contact (archived_at NOT NULL) is EXCLUDED;
 *   - ties inside a band break by name COLLATE NOCASE ASC;
 *   - each row carries the PickerOrderRow fields plus photo, modified_at and
 *     last_captured.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  type CapturePickRow,
  listCapturePickContacts,
} from "@/db/capture-read";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import type { PickerOrderRow } from "@/logic/contact-picker-order";

const NOW = "2026-08-15 12:00:00";

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;

let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
  });
});

/** Insert a contact with optional favourite_rank / archived_at / photo. */
async function seedContact(opts: {
  name: string;
  favouriteRank?: number | null;
  archivedAt?: string | null;
  photo?: string | null;
  lastContact?: string | null;
  snoozeUntil?: string | null;
}): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, interval_days, favourite_rank, archived_at, photo,
        last_contact, snooze_until, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      opts.name,
      30,
      opts.favouriteRank ?? null,
      opts.archivedAt ?? null,
      opts.photo ?? null,
      opts.lastContact ?? null,
      opts.snoozeUntil ?? null,
      NOW,
      NOW,
    ],
  );
  return result.lastInsertRowId;
}

/** A memory row; `provenance` 'share' makes it count toward share recency. */
async function seedMemory(
  contactId: number,
  createdAt: string,
  opts: { provenance?: string; deletedAt?: string | null } = {},
): Promise<void> {
  await exec.runAsync(
    `INSERT INTO memories
       (uid, contact_id, type, value, provenance, allow_ai, created_at,
        modified_at, deleted_at)
     VALUES (?, ?, 'thought_of_them', 'a shared link', ?, 0, ?, ?, ?)`,
    [
      uid(),
      contactId,
      opts.provenance ?? "share",
      createdAt,
      createdAt,
      opts.deletedAt ?? null,
    ],
  );
}

/** A Last Talked About entry; `fromShare` 1 marks a share moved there. */
async function seedLastTalkedAbout(
  contactId: number,
  createdAt: string,
  fromShare: 0 | 1,
): Promise<void> {
  await exec.runAsync(
    `INSERT INTO current_state_entries
       (uid, contact_id, field_key, value, entry_date, from_share, created_at,
        modified_at)
     VALUES (?, ?, 'last_talked_about', 'a topic', ?, ?, ?, ?)`,
    [uid(), contactId, createdAt.slice(0, 10), fromShare, createdAt, createdAt],
  );
}

/** An Off Limits entry; `fromShare` 1 marks a share moved there. */
async function seedOffLimits(
  contactId: number,
  createdAt: string,
  fromShare: 0 | 1,
): Promise<void> {
  await exec.runAsync(
    `INSERT INTO off_limits
       (uid, contact_id, text, from_share, created_at, modified_at)
     VALUES (?, ?, 'a private note', ?, ?, ?)`,
    [uid(), contactId, fromShare, createdAt, createdAt],
  );
}

describe("listCapturePickContacts — favourites → share recency → rest", () => {
  it("orders favourites (by rank) before every non-favourite", async () => {
    const fav2 = await seedContact({ name: "Fav Two", favouriteRank: 2 });
    const fav1 = await seedContact({ name: "Fav One", favouriteRank: 1 });
    const recent = await seedContact({ name: "Recent Share" });
    await seedMemory(recent, "2026-08-14 10:00:00");

    const rows = await listCapturePickContacts(exec);
    expect(rows.map((r) => r.id)).toEqual([fav1, fav2, recent]);
  });

  it("orders non-favourites by share recency DESC, never-shared last (name tiebreak)", async () => {
    const older = await seedContact({ name: "Older" });
    await seedMemory(older, "2026-08-10 09:00:00");
    const newer = await seedContact({ name: "Newer" });
    await seedMemory(newer, "2026-08-14 18:00:00");
    // Two never-shared contacts to prove the name COLLATE NOCASE tiebreak.
    const beta = await seedContact({ name: "beta" });
    const alpha = await seedContact({ name: "Alpha" });

    const rows = await listCapturePickContacts(exec);
    expect(rows.map((r) => r.id)).toEqual([newer, older, alpha, beta]);
  });

  it("D-108: a share moved to Last Talked About or Off Limits still counts; typed entries do not", async () => {
    const movedToTalk = await seedContact({ name: "Moved To Talk" });
    await seedLastTalkedAbout(movedToTalk, "2026-08-14 09:00:00", 1);
    const movedToOffLimits = await seedContact({ name: "Moved To Off Limits" });
    await seedOffLimits(movedToOffLimits, "2026-08-13 09:00:00", 1);
    const memoryShare = await seedContact({ name: "Memory Share" });
    await seedMemory(memoryShare, "2026-08-12 09:00:00");

    // None of these is a share, so none earns a recency place.
    const typedTalk = await seedContact({ name: "Typed Talk" });
    await seedLastTalkedAbout(typedTalk, "2026-08-15 09:00:00", 0);
    const typedOffLimits = await seedContact({ name: "Typed Off Limits" });
    await seedOffLimits(typedOffLimits, "2026-08-15 09:00:00", 0);
    const typedMemory = await seedContact({ name: "Typed Memory" });
    await seedMemory(typedMemory, "2026-08-15 09:00:00", {
      provenance: "user",
    });
    const trashedShare = await seedContact({ name: "Trashed Share" });
    await seedMemory(trashedShare, "2026-08-15 09:00:00", {
      deletedAt: "2026-08-15 10:00:00",
    });

    const rows = await listCapturePickContacts(exec);
    expect(rows.map((r) => r.id)).toEqual([
      movedToTalk,
      movedToOffLimits,
      memoryShare,
      // Never shared: name order.
      trashedShare,
      typedMemory,
      typedOffLimits,
      typedTalk,
    ]);
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(movedToTalk)?.last_captured).toBe("2026-08-14 09:00:00");
    expect(byId.get(movedToOffLimits)?.last_captured).toBe(
      "2026-08-13 09:00:00",
    );
    expect(byId.get(typedTalk)?.last_captured).toBeNull();
  });

  it("takes the newest share across all three homes for one contact", async () => {
    const c = await seedContact({ name: "Many Homes" });
    await seedMemory(c, "2026-08-10 09:00:00");
    await seedOffLimits(c, "2026-08-11 09:00:00", 1);
    await seedLastTalkedAbout(c, "2026-08-12 09:00:00", 1);

    const rows = await listCapturePickContacts(exec);
    expect(rows[0]?.last_captured).toBe("2026-08-12 09:00:00");
  });

  it("INCLUDES a never-contacted contact (last_contact NULL)", async () => {
    const never = await seedContact({ name: "Never", lastContact: null });

    const rows = await listCapturePickContacts(exec);
    expect(rows.map((r) => r.id)).toContain(never);
  });

  it("EXCLUDES an archived contact, even one with a recent share", async () => {
    const live = await seedContact({ name: "Live" });
    const archived = await seedContact({
      name: "Archived",
      archivedAt: "2026-08-01 00:00:00",
    });
    await seedMemory(archived, "2026-08-14 09:00:00");

    const rows = await listCapturePickContacts(exec);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(live);
    expect(ids).not.toContain(archived);
  });

  it("carries the PickerOrderRow fields plus photo, modified_at and last_captured", async () => {
    const c = await seedContact({
      name: "Full Row",
      favouriteRank: 1,
      photo: "photo.jpg",
      lastContact: "2026-08-01",
      snoozeUntil: "2026-09-01",
    });
    await seedMemory(c, "2026-08-12 08:00:00");

    const rows = await listCapturePickContacts(exec);
    expect(rows[0]).toEqual({
      id: c,
      name: "Full Row",
      photo: "photo.jpg",
      modified_at: NOW,
      favourite_rank: 1,
      last_contact: "2026-08-01",
      snooze_until: "2026-09-01",
      archived_at: null,
      last_captured: "2026-08-12 08:00:00",
    });
    // Compile-time: a capture row is usable wherever a picker row is.
    const asPickerRow: PickerOrderRow = rows[0] as CapturePickRow;
    expect(asPickerRow.id).toBe(c);
  });

  it("reports last_captured NULL for a never-shared contact", async () => {
    await seedContact({ name: "Unshared" });

    const rows = await listCapturePickContacts(exec);
    expect(rows[0]?.last_captured).toBeNull();
  });
});
