/**
 * Per-contact custom-value DAO — behavioural proof (FLD-01 / FLD-07).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture,
 * adding value columns via direct `ALTER TABLE contact_custom_values ADD COLUMN`
 * (independent of Plan 03's DDL). Asserts: dynamic read returns written values;
 * an EMPTY defs array reads `{}` (the fresh-install case, no malformed SELECT);
 * UPSERT creates-or-updates keyed on contact_id and always bumps modified_at; a
 * per-contact uid works for multiple contacts without colliding on UNIQUE(uid);
 * and the three §14.7 visibility selectors resolve exactly (quarantined fields
 * hidden everywhere).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import type { CustomFieldDef } from "@/db/field-types";
import {
  defsForCreateForm,
  defsForEditForm,
  getValuesForContact,
  upsertValue,
  visibleDefsForProfile,
} from "@/db/field-values-dao";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-14 12:00:00";
const LATER = "2026-08-20 09:00:00";

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;
let idCounter = 0;

let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  idCounter = 0;
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, [migration001], 1, { now: NOW, newUid: uid });
});

/** Build a CustomFieldDef literal for the pure selectors + dynamic read. */
function def(
  overrides: Partial<CustomFieldDef> & { col_name: string },
): CustomFieldDef {
  return {
    id: ++idCounter,
    uid: uid(),
    label: overrides.col_name,
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

/** Add a value column directly (independent of Plan 03's createField DDL). */
async function addColumn(col: string): Promise<void> {
  await exec.execAsync(
    `ALTER TABLE contact_custom_values ADD COLUMN "${col}" TEXT`,
  );
}

/** Insert a bare contact row and return its id. */
async function makeContact(name = "Alex"): Promise<number> {
  const r = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [uid(), name, 30, NOW, NOW],
  );
  return r.lastInsertRowId;
}

async function readValueRow(
  contactId: number,
): Promise<Record<string, unknown> | null> {
  return exec.getFirstAsync<Record<string, unknown>>(
    "SELECT * FROM contact_custom_values WHERE contact_id = ?",
    [contactId],
  );
}

async function rowCount(): Promise<number> {
  const r = await exec.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM contact_custom_values",
  );
  return r?.n ?? 0;
}

describe("upsertValue — INSERT-or-UPDATE keyed on contact_id (FLD-01)", () => {
  it("creates the row on first value (no silent no-op — Pitfall 3)", async () => {
    const c = await makeContact();
    await addColumn("nickname");
    const contactUid = uid();

    await upsertValue(exec, c, contactUid, "nickname", "Ace", NOW);

    const row = await readValueRow(c);
    expect(row).not.toBeNull();
    expect(row?.nickname).toBe("Ace");
    expect(row?.uid).toBe(contactUid);
    expect(row?.modified_at).toBe(NOW);
    expect(await rowCount()).toBe(1);
  });

  it("updates in place on re-UPSERT, bumps modified_at, never rewrites uid", async () => {
    const c = await makeContact();
    await addColumn("nickname");
    const contactUid = uid();

    await upsertValue(exec, c, contactUid, "nickname", "Ace", NOW);
    // A second UPSERT with a DIFFERENT uid must NOT change the stored uid.
    await upsertValue(exec, c, "some-other-uid", "nickname", "Bee", LATER);

    const row = await readValueRow(c);
    expect(row?.nickname).toBe("Bee");
    expect(row?.modified_at).toBe(LATER);
    expect(row?.uid).toBe(contactUid); // INSERT-only; DO UPDATE never touches uid
    expect(await rowCount()).toBe(1); // still one row (keyed on contact_id)
  });

  it("UPSERTs a second field on the same row without disturbing the first", async () => {
    const c = await makeContact();
    await addColumn("nickname");
    await addColumn("city");
    const contactUid = uid();

    await upsertValue(exec, c, contactUid, "nickname", "Ace", NOW);
    await upsertValue(exec, c, contactUid, "city", "Leeds", LATER);

    const row = await readValueRow(c);
    expect(row?.nickname).toBe("Ace");
    expect(row?.city).toBe("Leeds");
    expect(row?.modified_at).toBe(LATER);
    expect(await rowCount()).toBe(1);
  });

  it("a per-contact uid works for MULTIPLE contacts (no UNIQUE(uid) collision)", async () => {
    const c1 = await makeContact("Alex");
    const c2 = await makeContact("Blair");
    await addColumn("nickname");

    // Each contact gets its OWN per-contact uid — the correct caller contract.
    await upsertValue(exec, c1, uid(), "nickname", "Ace", NOW);
    await expect(
      upsertValue(exec, c2, uid(), "nickname", "Bee", NOW),
    ).resolves.toBeUndefined();

    expect(await rowCount()).toBe(2);
    expect((await readValueRow(c1))?.nickname).toBe("Ace");
    expect((await readValueRow(c2))?.nickname).toBe("Bee");
  });

  it("rejects an unsafe col_name before it reaches SQL (T-03-01)", async () => {
    const c = await makeContact();
    await expect(
      upsertValue(
        exec,
        c,
        uid(),
        'nickname"; DROP TABLE contacts;--',
        "x",
        NOW,
      ),
    ).rejects.toThrow(/unsafe custom-field col_name/);
  });
});

describe("getValuesForContact — dynamic whitelist-built read (FLD-01)", () => {
  it("returns the written values keyed by col_name", async () => {
    const c = await makeContact();
    await addColumn("nickname");
    await addColumn("city");
    const contactUid = uid();
    await upsertValue(exec, c, contactUid, "nickname", "Ace", NOW);
    await upsertValue(exec, c, contactUid, "city", "Leeds", NOW);

    const values = await getValuesForContact(exec, c, [
      def({ col_name: "nickname" }),
      def({ col_name: "city" }),
    ]);

    expect(values).toEqual({ nickname: "Ace", city: "Leeds" });
  });

  it("returns {} for an EMPTY defs array (fresh install — no malformed SELECT)", async () => {
    const c = await makeContact();
    await expect(getValuesForContact(exec, c, [])).resolves.toEqual({});
  });

  it("returns {} when the contact has no value row yet", async () => {
    const c = await makeContact();
    await addColumn("nickname");
    const values = await getValuesForContact(exec, c, [
      def({ col_name: "nickname" }),
    ]);
    expect(values).toEqual({});
  });

  it("maps an unset (NULL) column to null", async () => {
    const c = await makeContact();
    await addColumn("nickname");
    await addColumn("city");
    // Only nickname written; the row exists, city stays NULL.
    await upsertValue(exec, c, uid(), "nickname", "Ace", NOW);

    const values = await getValuesForContact(exec, c, [
      def({ col_name: "nickname" }),
      def({ col_name: "city" }),
    ]);
    expect(values).toEqual({ nickname: "Ace", city: null });
  });

  it("rejects an unsafe col_name in the def list (T-03-01)", async () => {
    const c = await makeContact();
    await expect(
      getValuesForContact(exec, c, [def({ col_name: "bad-name!" })]),
    ).rejects.toThrow(/unsafe custom-field col_name/);
  });
});

describe("visibility selectors — the three §14.7 surfaces (FLD-07)", () => {
  // A representative def set: one show_on_new, one always_show, one plain, and
  // one quarantined — spanning every visibility axis, deliberately out of order
  // to prove the selectors sort by display_order.
  const onNew = def({ col_name: "nickname", show_on_new: 1, display_order: 2 });
  const alwaysShown = def({
    col_name: "birthday",
    always_show: 1,
    display_order: 0,
  });
  const plain = def({ col_name: "city", display_order: 1 });
  const quarantined = def({
    col_name: "old_field",
    show_on_new: 1,
    always_show: 1,
    display_order: 3,
    quarantined_at: NOW,
  });
  const allDefs = [onNew, alwaysShown, plain, quarantined];
  const cols = (defs: CustomFieldDef[]) => defs.map((d) => d.col_name);

  it("defsForCreateForm returns only non-quarantined show_on_new, ordered", () => {
    // onNew is show_on_new; quarantined is show_on_new too but excluded.
    expect(cols(defsForCreateForm(allDefs))).toEqual(["nickname"]);
  });

  it("defsForEditForm returns every non-quarantined field, ordered by display_order", () => {
    expect(cols(defsForEditForm(allDefs))).toEqual([
      "birthday",
      "city",
      "nickname",
    ]);
  });

  it("visibleDefsForProfile shows value-present OR always_show, hides empty non-always", () => {
    // city has a value; birthday is always_show (no value); nickname is empty
    // and not always_show → hidden; old_field is quarantined → hidden.
    const values = { city: "Leeds", nickname: null } as Record<
      string,
      string | null
    >;
    expect(cols(visibleDefsForProfile(allDefs, values))).toEqual([
      "birthday",
      "city",
    ]);
  });

  it("visibleDefsForProfile treats an always_show field with no value as visible", () => {
    expect(cols(visibleDefsForProfile([alwaysShown], {}))).toEqual([
      "birthday",
    ]);
  });

  it("visibleDefsForProfile hides an empty non-always_show field", () => {
    expect(visibleDefsForProfile([plain], {})).toEqual([]);
    expect(visibleDefsForProfile([plain], { city: null })).toEqual([]);
  });

  it("a quarantined field appears in NONE of the three surfaces", () => {
    const q = [quarantined];
    expect(defsForCreateForm(q)).toEqual([]);
    expect(defsForEditForm(q)).toEqual([]);
    // Even with a value AND always_show, quarantine wins.
    expect(visibleDefsForProfile(q, { old_field: "x" })).toEqual([]);
  });

  it("does not mutate the input defs array", () => {
    const input = [onNew, alwaysShown, plain];
    const snapshot = cols(input);
    defsForEditForm(input);
    expect(cols(input)).toEqual(snapshot);
  });
});
