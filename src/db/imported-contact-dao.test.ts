import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import type { CreateContactFullInput } from "@/db/contacts-dao";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { acceptImportSessionWithRows } from "@/db/import-session-dao";
import {
  importContactRecord,
  linkExistingContactToRow,
  NameRequiredError,
} from "@/db/imported-contact-dao";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-29 12:00:00";
let exec: SqlExecutor;
let uidCounter = 0;
const uid = () => `imported-contact-test-${++uidCounter}`;

beforeEach(async () => {
  uidCounter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
    defaultPhoneRegion: "US",
  });
});

async function acceptRow(
  externalContactId = "android-contact-1",
): Promise<number> {
  const accepted = await acceptImportSessionWithRows(exec, {
    session: {
      uid: uid(),
      mode: "bulk",
      batchCategoryId: null,
      batchTrackingEnabled: false,
      phoneRegion: "US",
      now: NOW,
    },
    rows: [
      {
        uid: uid(),
        externalContactId,
        sourcePayload: "{}",
        photoRelPath: null,
      },
    ],
  });
  return accepted.rowIds[0];
}

function unboundInput(name = "Imported Person"): CreateContactFullInput {
  return {
    uid: uid(),
    name,
    intervalDays: null,
    trackingEnabled: false,
    now: NOW,
    methodDrafts: [
      { uid: uid(), type: "phone" as const, value: "312 555 0100" },
      { uid: uid(), type: "email" as const, value: "imported@example.test" },
    ],
    methodNormalization: { effectivePhoneRegion: "US" },
  };
}

async function count(table: string): Promise<number> {
  const row = await exec.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM ${table}`,
  );
  return row?.count ?? 0;
}

describe("importContactRecord", () => {
  it("atomically creates an Unbound contact, source link, provenance, and resolved row", async () => {
    const rowId = await acceptRow();
    const { contactId } = await importContactRecord(exec, {
      input: unboundInput(),
      externalLinks: [
        { provider: "android", externalContactId: "android-contact-1" },
      ],
      birthday: "1990-05-14",
      now: NOW,
      resolveRow: { rowId, matchOutcome: "new" },
    });

    expect(
      await exec.getFirstAsync<{
        tracking_enabled: number;
        interval_days: number | null;
        birthday: string | null;
      }>(
        "SELECT tracking_enabled, interval_days, birthday FROM contacts WHERE id = ?",
        [contactId],
      ),
    ).toEqual({
      tracking_enabled: 0,
      interval_days: null,
      birthday: "1990-05-14",
    });
    expect(
      await exec.getFirstAsync<{
        row_status: string;
        match_outcome: string;
        contact_id: number;
      }>(
        "SELECT row_status, match_outcome, contact_id FROM import_session_rows WHERE id = ?",
        [rowId],
      ),
    ).toEqual({
      row_status: "imported",
      match_outcome: "new",
      contact_id: contactId,
    });
    expect(await count("contact_methods")).toBe(2);
    expect(await count("external_contact_links")).toBe(1);
    expect(
      await exec.getAllAsync<{
        external_contact_link_id: number;
        source_method_id: string | null;
      }>(
        "SELECT external_contact_link_id, source_method_id FROM contact_method_provenance",
      ),
    ).toEqual([
      expect.objectContaining({
        external_contact_link_id: expect.any(Number),
        source_method_id: null,
      }),
      expect.objectContaining({
        external_contact_link_id: expect.any(Number),
        source_method_id: null,
      }),
    ]);
    expect(await count("custom_field_values")).toBe(
      await count("custom_field_defs"),
    );
  });

  it("rolls back contact, link, provenance, and row transition on a composition failure", async () => {
    const rowId = await acceptRow("bad-method");
    const input = unboundInput();
    input.methodDrafts = [
      { id: 99999, uid: uid(), type: "phone", value: "312 555 0100" },
    ];

    await expect(
      importContactRecord(exec, {
        input,
        externalLinks: [
          { provider: "android", externalContactId: "bad-method" },
        ],
        birthday: null,
        now: NOW,
        resolveRow: { rowId, matchOutcome: "new" },
      }),
    ).rejects.toThrow("was not seeded");
    expect(await count("contacts")).toBe(0);
    expect(await count("external_contact_links")).toBe(0);
    expect(await count("contact_method_provenance")).toBe(0);
    expect(
      await exec.getFirstAsync<{
        row_status: string;
        contact_id: number | null;
      }>(
        "SELECT row_status, contact_id FROM import_session_rows WHERE id = ?",
        [rowId],
      ),
    ).toEqual({ row_status: "pending", contact_id: null });
  });

  it.each(["", "   "])(
    "rejects blank name %j before any write",
    async (name) => {
      const rowId = await acceptRow(`blank-${name.length}`);
      await expect(
        importContactRecord(exec, {
          input: unboundInput(name),
          externalLinks: [
            { provider: "android", externalContactId: `blank-${name.length}` },
          ],
          birthday: null,
          now: NOW,
          resolveRow: { rowId, matchOutcome: "new" },
        }),
      ).rejects.toBeInstanceOf(NameRequiredError);
      expect(await count("contacts")).toBe(0);
      expect(await count("external_contact_links")).toBe(0);
      expect(
        await exec.getFirstAsync<{ row_status: string }>(
          "SELECT row_status FROM import_session_rows WHERE id = ?",
          [rowId],
        ),
      ).toEqual({ row_status: "pending" });
    },
  );
});

describe("linkExistingContactToRow", () => {
  it("links a row to an existing contact without overwriting its Orbit name", async () => {
    const existing = await exec.runAsync(
      `INSERT INTO contacts (uid, name, tracking_enabled, created_at, modified_at)
       VALUES (?, ?, 0, ?, ?)`,
      [uid(), "Orbit Name", NOW, NOW],
    );
    const rowId = await acceptRow("existing-source");

    await linkExistingContactToRow(exec, {
      rowId,
      contactId: existing.lastInsertRowId,
      provider: "android",
      externalContactId: "existing-source",
      matchOutcome: "probable",
      now: NOW,
    });

    expect(
      await exec.getFirstAsync<{ name: string }>(
        "SELECT name FROM contacts WHERE id = ?",
        [existing.lastInsertRowId],
      ),
    ).toEqual({ name: "Orbit Name" });
    expect(await count("external_contact_links")).toBe(1);
    expect(
      await exec.getFirstAsync<{
        row_status: string;
        contact_id: number;
        match_outcome: string;
      }>(
        "SELECT row_status, contact_id, match_outcome FROM import_session_rows WHERE id = ?",
        [rowId],
      ),
    ).toEqual({
      row_status: "linked",
      contact_id: existing.lastInsertRowId,
      match_outcome: "probable",
    });
  });
});
