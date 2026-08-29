import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));
vi.mock("expo-file-system", () => ({
  Paths: { document: { uri: "file:///doc" } },
  Directory: class {
    create() {}
    get exists() {
      return false;
    }
    list() {
      return [];
    }
  },
  File: class {},
}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { getSessionById, listSessionRows } from "@/db/import-session-read";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import {
  acceptPickedContacts,
  commitSingleImport,
} from "@/services/import/import-acquire";

const NOW = "2026-08-29 12:00:00";
let exec: SqlExecutor;
let counter = 0;
const uid = () => `acquire-test-${++counter}`;

beforeEach(async () => {
  counter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
    defaultPhoneRegion: "US",
  });
});

describe("import acquisition", () => {
  it("single pick → one session + one row → one Unbound contact + row resolved imported + session complete", async () => {
    const sessionId = await acceptPickedContacts(
      exec,
      [
        {
          lookupKey: "android-1",
          displayName: "Ada Import",
          methods: [{ type: "phone", value: "312 555 0100" }],
          birthday: null,
          photoTempUri: null,
        },
      ],
      {
        mode: "single",
        batchCategoryId: null,
        effectivePhoneRegion: "US",
        now: NOW,
      },
    );
    const rows = await listSessionRows(exec, sessionId);
    expect(rows).toHaveLength(1);
    const contactId = await commitSingleImport(exec, {
      sessionId,
      rowId: rows[0].id,
      input: {
        uid: uid(),
        name: "Ada Import",
        intervalDays: null,
        trackingEnabled: false,
        now: NOW,
        methodDrafts: [{ uid: uid(), type: "phone", value: "312 555 0100" }],
        methodNormalization: { effectivePhoneRegion: "US" },
      },
      externalLinks: [{ provider: "android", externalContactId: "android-1" }],
      birthday: null,
      now: NOW,
    });
    expect(
      await exec.getFirstAsync<{ tracking_enabled: number }>(
        "SELECT tracking_enabled FROM contacts WHERE id = ?",
        [contactId],
      ),
    ).toEqual({ tracking_enabled: 0 });
    expect(await listSessionRows(exec, sessionId)).toEqual([
      expect.objectContaining({
        contactId,
        rowStatus: "imported",
        matchOutcome: "new",
      }),
    ]);
    expect(await getSessionById(exec, sessionId)).toEqual(
      expect.objectContaining({ status: "complete" }),
    );
  });
});
