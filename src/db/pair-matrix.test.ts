import { describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import { completeGlobalPairsCore } from "@/db/pair-matrix";

async function fixture() {
  const exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: "2026-09-01 00:00:00",
    newUid: () => crypto.randomUUID(),
  });
  const contact = async (uid: string, createdAt: string, archived = false) =>
    (
      await exec.runAsync(
        "INSERT INTO contacts(uid,name,interval_days,archived_at,created_at,modified_at) VALUES(?,?,30,?,?,?)",
        [uid, uid, archived ? createdAt : null, createdAt, createdAt],
      )
    ).lastInsertRowId;
  const def = async (
    uid: string,
    colName: string,
    createdAt: string,
    scope = "global",
    quarantined = false,
  ) =>
    (
      await exec.runAsync(
        "INSERT INTO custom_field_defs(uid,col_name,label,type,show_on_new,always_show,display_order,share_with_ai,scope,quarantined_at,created_at,modified_at) VALUES(?,?,?,'text',0,0,0,0,?,?,?,?)",
        [
          uid,
          colName,
          colName,
          scope,
          quarantined ? createdAt : null,
          createdAt,
          createdAt,
        ],
      )
    ).lastInsertRowId;
  return { exec, contact, def };
}

describe("global pair completion", () => {
  it("seeds all global pairs including archived/quarantined, excluding contact scope, with later creation stamp", async () => {
    const { exec, contact, def } = await fixture();
    await contact("a:b", "2026-09-01 00:00:00", true);
    await contact("a", "2026-09-04 00:00:00");
    await def("c", "first", "2026-09-03 00:00:00", "global", true);
    await def("b:c", "second", "2026-09-02 00:00:00");
    await def("scoped", "scoped", "2026-09-02 00:00:00", "contact");
    expect(
      (await exec.getFirstAsync<{ encoding: string }>("PRAGMA encoding"))
        ?.encoding,
    ).toBe("UTF-8");
    const contactSchema = await exec.getAllAsync<{
      name: string;
      notnull: number;
    }>("PRAGMA table_info(contacts)");
    const defSchema = await exec.getAllAsync<{ name: string; notnull: number }>(
      "PRAGMA table_info(custom_field_defs)",
    );
    expect(
      contactSchema.find((column) => column.name === "created_at")?.notnull,
    ).toBe(1);
    expect(
      defSchema.find((column) => column.name === "created_at")?.notnull,
    ).toBe(1);
    expect(await completeGlobalPairsCore(exec)).toBe(4);
    const rows = await exec.getAllAsync<{
      uid: string;
      value: string | null;
      created_at: string;
      modified_at: string;
    }>(
      "SELECT uid,value,created_at,modified_at FROM custom_field_values ORDER BY uid",
    );
    expect(rows).toHaveLength(4);
    expect(new Set(rows.map((row) => row.uid)).size).toBe(4);
    expect(
      rows.every(
        (row) => row.value === null && row.created_at === row.modified_at,
      ),
    ).toBe(true);
    const target = `pair:${Buffer.from("a:b").toString("hex").toUpperCase()}:${Buffer.from("c").toString("hex").toUpperCase()}`;
    expect(rows.find((row) => row.uid === target)?.created_at).toBe(
      "2026-09-03 00:00:00",
    );
    expect(await completeGlobalPairsCore(exec)).toBe(0);
  });

  it("encodes UTF-8 bytes and uses a fallback when another pair owns the deterministic slot", async () => {
    const { exec, contact, def } = await fixture();
    const firstContact = await contact("first", "2026-09-01 00:00:00");
    const secondContact = await contact("é😀", "2026-09-01 00:00:00");
    const firstDef = await def("first-def", "first", "2026-09-01 00:00:00");
    const secondDef = await def("🔑", "second", "2026-09-01 00:00:00");
    const occupied = `pair:${Buffer.from("é😀").toString("hex").toUpperCase()}:${Buffer.from("🔑").toString("hex").toUpperCase()}`;
    await exec.runAsync(
      "INSERT INTO custom_field_values(uid,contact_id,field_def_id,value,created_at,modified_at) VALUES(?,?,?,?,?,?)",
      [
        occupied,
        firstContact,
        firstDef,
        "preserve",
        "2026-09-01 00:00:00",
        "2026-09-01 00:00:00",
      ],
    );
    expect(await completeGlobalPairsCore(exec)).toBe(3);
    const original = await exec.getFirstAsync<{ uid: string; value: string }>(
      "SELECT uid,value FROM custom_field_values WHERE contact_id=? AND field_def_id=?",
      [firstContact, firstDef],
    );
    expect(original).toEqual({ uid: occupied, value: "preserve" });
    const fallback = await exec.getFirstAsync<{
      uid: string;
      value: string | null;
    }>(
      "SELECT uid,value FROM custom_field_values WHERE contact_id=? AND field_def_id=?",
      [secondContact, secondDef],
    );
    expect(fallback?.uid).toMatch(/^pairx:[0-9a-f]{32}$/);
    expect(fallback?.value).toBeNull();
  });
});
