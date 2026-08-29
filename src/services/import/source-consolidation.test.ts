import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { acceptImportSessionWithRows } from "@/db/import-session-dao";
import { getSessionById, listSessionRows } from "@/db/import-session-read";
import { importContactRecord } from "@/db/imported-contact-dao";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { findActiveExternalLink } from "@/services/import/duplicate-evidence";
import type { ImportedPhotoFs } from "@/services/import/import-photo";
import {
  combineCluster,
  detectSourceClusters,
} from "@/services/import/source-consolidation";

const NOW = "2026-08-29 12:00:00";
let exec: SqlExecutor;
let counter = 0;
const uid = () => `source-consolidation-${++counter}`;

function payload(
  displayName: string | null,
  methods: Array<{ type: "phone" | "email"; value: string }> = [],
  birthday: string | null = null,
): string {
  return JSON.stringify({ displayName, methods, birthday });
}

async function createSession(
  rows: Array<{
    externalContactId: string;
    sourcePayload: string;
    photoRelPath?: string | null;
  }>,
) {
  const accepted = await acceptImportSessionWithRows(exec, {
    session: {
      uid: uid(),
      mode: "bulk",
      batchCategoryId: null,
      batchTrackingEnabled: false,
      phoneRegion: "US",
      now: NOW,
    },
    rows: rows.map((row) => ({
      ...row,
      uid: uid(),
      photoRelPath: row.photoRelPath ?? null,
    })),
  });
  return { ...accepted, rows: await listSessionRows(exec, accepted.sessionId) };
}

function photoFs(overrides: Partial<ImportedPhotoFs> = {}): ImportedPhotoFs {
  return {
    resolveStagedPhotoPath: async (relative) => `file:///documents/${relative}`,
    contactPhotoRelPath: async (contactId) =>
      `avatars/contact-${contactId}.jpg`,
    resizeToMaster: async (uri) => uri,
    persistMaster: async () => "saved",
    setContactPhoto: async () => {},
    deleteImportStaging: () => {},
    ...overrides,
  };
}

beforeEach(async () => {
  counter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
    defaultPhoneRegion: "US",
  });
});

describe("source consolidation", () => {
  it("clusters selected rows by a shared canonical method, never name alone", async () => {
    const session = await createSession([
      {
        externalContactId: "one",
        sourcePayload: payload("Taylor", [
          { type: "phone", value: "(312) 555-0100" },
        ]),
      },
      {
        externalContactId: "two",
        sourcePayload: payload("Taylor", [
          { type: "phone", value: "+1 312 555 0100" },
        ]),
      },
      { externalContactId: "three", sourcePayload: payload("Taylor", []) },
    ]);

    expect(detectSourceClusters(session.rows, { phoneRegion: "US" })).toEqual({
      clusters: [
        expect.arrayContaining([
          expect.objectContaining({ externalContactId: "one" }),
          expect.objectContaining({ externalContactId: "two" }),
        ]),
      ],
      ungroupedRows: [expect.objectContaining({ externalContactId: "three" })],
    });
  });

  it("creates one Unbound contact, resolves every row atomically, and preserves birthday plus source identity", async () => {
    const session = await createSession([
      {
        externalContactId: "one",
        sourcePayload: payload(
          "Taylor",
          [{ type: "phone", value: "312 555 0100" }],
          "02-30",
        ),
      },
      {
        externalContactId: "two",
        sourcePayload: payload(
          "Taylor Jones",
          [
            { type: "phone", value: "+1 312 555 0100" },
            { type: "email", value: "taylor@example.com" },
          ],
          "1990-05-14",
        ),
        photoRelPath: "import-staging/taylor.jpg",
      },
    ]);
    const { clusters } = detectSourceClusters(session.rows, {
      phoneRegion: "US",
    });
    const result = await combineCluster(exec, photoFs(), {
      rows: clusters[0],
      batchCategoryId: null,
      phoneRegion: "US",
      now: NOW,
    });

    expect(clusters).toHaveLength(1);
    expect(result).toEqual({
      contactId: expect.any(Number),
      combined: true,
      sessionComplete: true,
    });
    if (!result.combined) throw new Error("expected a combined contact");
    expect(
      await exec.getFirstAsync<{ birthday: string | null }>(
        "SELECT birthday FROM contacts WHERE id = ?",
        [result.contactId],
      ),
    ).toEqual({ birthday: "1990-05-14" });
    expect(
      await exec.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM external_contact_links WHERE contact_id = ?",
        [result.contactId],
      ),
    ).toEqual({ count: 2 });
    expect(await listSessionRows(exec, session.sessionId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rowStatus: "imported",
          contactId: result.contactId,
        }),
        expect.objectContaining({
          rowStatus: "imported",
          contactId: result.contactId,
        }),
      ]),
    );
    await expect(getSessionById(exec, session.sessionId)).resolves.toEqual(
      expect.objectContaining({ status: "complete" }),
    );
    await expect(findActiveExternalLink(exec, "android", "one")).resolves.toBe(
      result.contactId,
    );
    await expect(findActiveExternalLink(exec, "android", "two")).resolves.toBe(
      result.contactId,
    );
  });

  it("rolls back contact and row resolutions for an in-transaction failure, while photo failure is post-commit only", async () => {
    await importContactRecord(exec, {
      input: {
        uid: uid(),
        name: "Existing",
        intervalDays: null,
        trackingEnabled: false,
        now: NOW,
        categoryId: null,
        methodDrafts: [],
      },
      externalLinks: [
        { provider: "android", externalContactId: "already-linked" },
      ],
      birthday: null,
      now: NOW,
    });
    const duplicate = await createSession([
      { externalContactId: "already-linked", sourcePayload: payload("Taylor") },
      { externalContactId: "other", sourcePayload: payload("Taylor") },
    ]);
    await expect(
      combineCluster(exec, photoFs(), {
        rows: duplicate.rows,
        batchCategoryId: null,
        phoneRegion: "US",
        now: NOW,
      }),
    ).rejects.toThrow();
    expect(
      await exec.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM contacts",
      ),
    ).toEqual({ count: 1 });
    expect(await listSessionRows(exec, duplicate.sessionId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rowStatus: "pending", contactId: null }),
        expect.objectContaining({ rowStatus: "pending", contactId: null }),
      ]),
    );

    const photoFailure = await createSession([
      { externalContactId: "photo-one", sourcePayload: payload("Taylor") },
      {
        externalContactId: "photo-two",
        sourcePayload: payload("Taylor"),
        photoRelPath: "import-staging/taylor.jpg",
      },
    ]);
    const result = await combineCluster(
      exec,
      photoFs({
        resizeToMaster: async () => {
          throw new Error("bad image");
        },
      }),
      {
        rows: photoFailure.rows,
        batchCategoryId: null,
        phoneRegion: "US",
        now: NOW,
      },
    );
    expect(result).toEqual({
      contactId: expect.any(Number),
      combined: true,
      sessionComplete: true,
    });
    expect(await listSessionRows(exec, photoFailure.sessionId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rowStatus: "imported" }),
        expect.objectContaining({ rowStatus: "imported" }),
      ]),
    );
  });

  it("leaves a mixed session pending after a cluster combine", async () => {
    const session = await createSession([
      {
        externalContactId: "one",
        sourcePayload: payload("Taylor", [
          { type: "phone", value: "(312) 555-0100" },
        ]),
      },
      {
        externalContactId: "two",
        sourcePayload: payload("Taylor Jones", [
          { type: "phone", value: "+1 312 555 0100" },
        ]),
      },
      {
        externalContactId: "three",
        sourcePayload: payload("Morgan", [
          { type: "email", value: "morgan@example.com" },
        ]),
      },
    ]);
    const { clusters } = detectSourceClusters(session.rows, {
      phoneRegion: "US",
    });
    const result = await combineCluster(exec, photoFs(), {
      rows: clusters[0],
      batchCategoryId: null,
      phoneRegion: "US",
      now: NOW,
    });

    expect(result).toEqual({
      contactId: expect.any(Number),
      combined: true,
      sessionComplete: false,
    });
    expect(await listSessionRows(exec, session.sessionId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ externalContactId: "one", rowStatus: "imported" }),
        expect.objectContaining({ externalContactId: "two", rowStatus: "imported" }),
        expect.objectContaining({ externalContactId: "three", rowStatus: "pending" }),
      ]),
    );
    await expect(getSessionById(exec, session.sessionId)).resolves.toEqual(
      expect.objectContaining({ status: "pending" }),
    );
  });

  it("refuses an all-nameless cluster and leaves its rows pending", async () => {
    const session = await createSession([
      { externalContactId: "one", sourcePayload: payload(" ") },
      { externalContactId: "two", sourcePayload: payload(null) },
    ]);
    await expect(
      combineCluster(exec, photoFs(), {
        rows: session.rows,
        batchCategoryId: null,
        phoneRegion: "US",
        now: NOW,
      }),
    ).resolves.toEqual({ combined: false, reason: "name-required" });
    expect(
      await exec.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM contacts",
      ),
    ).toEqual({ count: 0 });
    expect(await listSessionRows(exec, session.sessionId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rowStatus: "pending" }),
        expect.objectContaining({ rowStatus: "pending" }),
      ]),
    );
  });
});
