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
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  getContactForEdit,
  getContactHeader,
  isDuplicateName,
  listCategories,
} from "@/db/contact-read";
import type { CustomFieldDef } from "@/db/field-types";
import { upsertValue } from "@/db/field-values-dao";
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

/** Insert a bare contact row (optionally archived / rarely_responds / photo) and return its id. */
async function makeContact(
  name: string,
  opts: {
    archived?: boolean;
    rarelyResponds?: number;
    photo?: string | null;
  } = {},
): Promise<number> {
  const r = await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, interval_days, rarely_responds, photo, archived_at, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      name,
      30,
      opts.rarelyResponds ?? 0,
      opts.photo ?? null,
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
    // The Avatar-backing fields (Plan 05-03): a photo-less contact returns null
    // photo, and modified_at is present (the cross-session cache-bust token).
    expect(header?.photo).toBeNull();
    expect(header?.modified_at).toBe(NOW);
  });

  it("returns the stored relative photo path for a photo-bearing contact (PHOTO-04)", async () => {
    const id = await makeContact("Framed", { photo: "avatars/contact-1.jpg" });
    const header = await getContactHeader(exec, id);
    expect(header?.photo).toBe("avatars/contact-1.jpg");
    expect(header?.modified_at).toBe(NOW);
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

// =============================================================================
// Plan 05 — getContactForEdit: the edit-form initial-values assembly.
// =============================================================================

/** Add a value column directly (independent of Plan 03's createField DDL). */
async function addColumn(col: string): Promise<void> {
  await exec.execAsync(
    `ALTER TABLE contact_custom_values ADD COLUMN "${col}" TEXT`,
  );
}

/** Insert a live custom-field def row; returns nothing (defs are built by hand). */
function makeDef(
  colName: string,
  overrides: Partial<CustomFieldDef> = {},
): CustomFieldDef {
  return {
    id: 1,
    uid: uid(),
    col_name: colName,
    label: colName,
    type: "text",
    options: null,
    show_on_new: 0,
    always_show: 0,
    display_order: 0,
    quarantined_at: null,
    share_with_ai: 0,
    created_at: NOW,
    modified_at: NOW,
    ...overrides,
  };
}

/** Insert a contact with an optional category + last_contact; return its id. */
async function makeContactRow(
  name: string,
  opts: { categoryId?: number | null; lastContact?: string | null } = {},
): Promise<number> {
  const r = await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, category_id, interval_days, last_contact, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      name,
      opts.categoryId ?? null,
      30,
      opts.lastContact ?? null,
      NOW,
      NOW,
    ],
  );
  return r.lastInsertRowId;
}

describe("getContactForEdit — row + category label + custom-value map", () => {
  it("returns the contacts row (incl. last_contact), the category label, and the value map keyed by col_name", async () => {
    const cats = await listCategories(exec);
    const family = cats[0]; // "Family"
    const id = await makeContactRow("Editable", {
      categoryId: family.id,
      lastContact: "2026-08-10 09:00:00",
    });
    await addColumn("nickname");
    const def = makeDef("nickname");
    await upsertValue(exec, id, uid(), "nickname", "Eddie", NOW);

    const result = await getContactForEdit(exec, id, [def]);
    expect(result).not.toBeNull();
    expect(result?.contact.id).toBe(id);
    expect(result?.contact.name).toBe("Editable");
    // last_contact is present so the UI can decide whether to show last-spoke.
    expect(result?.contact.last_contact).toBe("2026-08-10 09:00:00");
    expect(result?.categoryLabel).toBe("Family");
    expect(result?.values.nickname).toBe("Eddie");
  });

  it("returns a null category label when category_id is null", async () => {
    const id = await makeContactRow("NoCat", { categoryId: null });
    const result = await getContactForEdit(exec, id, []);
    expect(result?.categoryLabel).toBeNull();
    expect(result?.contact.category_id).toBeNull();
    expect(result?.values).toEqual({});
  });

  it("returns last_contact NULL for a never-contacted contact", async () => {
    const id = await makeContactRow("NeverSpoke", { lastContact: null });
    const result = await getContactForEdit(exec, id, []);
    expect(result?.contact.last_contact).toBeNull();
  });

  it("returns null for a missing id", async () => {
    expect(await getContactForEdit(exec, 9999, [])).toBeNull();
  });
});

// =============================================================================
// Plan 07 — getContactForEdit now also assembles the contact's links (CRUD-04).
// =============================================================================

/** Insert a link row directly with an explicit display_order. */
async function addLinkRow(
  contactId: number,
  url: string,
  order: number,
  label: string | null = null,
): Promise<void> {
  await exec.runAsync(
    `INSERT INTO contact_links
       (uid, contact_id, url, label, display_order, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uid(), contactId, url, label, order, NOW, NOW],
  );
}

describe("getContactForEdit — links assembly (ORDER BY display_order)", () => {
  it("returns the contact's links ordered by display_order (not insertion order)", async () => {
    const id = await makeContactRow("Linked");
    // Insert out of order: display_order 1 first, then 0.
    await addLinkRow(id, "https://second", 1, "Second");
    await addLinkRow(id, "https://first", 0);
    const result = await getContactForEdit(exec, id, []);
    expect(result?.links.map((l) => l.url)).toEqual([
      "https://first",
      "https://second",
    ]);
    // Optional label round-trips (null for the unlabelled row).
    expect(result?.links[0].label).toBeNull();
    expect(result?.links[1].label).toBe("Second");
  });

  it("returns an empty links array for a contact with no links", async () => {
    const id = await makeContactRow("NoLinks");
    const result = await getContactForEdit(exec, id, []);
    expect(result?.links).toEqual([]);
  });
});
