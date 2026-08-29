import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import {
  findActiveExternalLink,
  scoreImportCandidate,
} from "@/services/import/duplicate-evidence";

const NOW = "2026-08-29 12:00:00";
let exec: SqlExecutor;
let uidCount = 0;
const newUid = () => `duplicate-evidence-${++uidCount}`;

beforeEach(async () => {
  uidCount = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, { now: NOW, newUid });
});

async function seedContact(params: {
  name: string;
  birthday?: string | null;
  methods?: Array<{ type: "phone" | "email"; canonicalValue: string }>;
}): Promise<number> {
  const contact = await exec.runAsync(
    `INSERT INTO contacts (uid, name, tracking_enabled, birthday, created_at, modified_at)
     VALUES (?, ?, 0, ?, ?, ?)`,
    [newUid(), params.name, params.birthday ?? null, NOW, NOW],
  );
  for (const [displayOrder, method] of (params.methods ?? []).entries()) {
    await exec.runAsync(
      `INSERT INTO contact_methods
        (uid, contact_id, method_type, raw_value, display_value, canonical_value,
         is_actionable, is_primary, display_order, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      [
        newUid(),
        contact.lastInsertRowId,
        method.type,
        method.canonicalValue,
        method.canonicalValue,
        method.canonicalValue,
        displayOrder === 0 ? 1 : 0,
        displayOrder,
        NOW,
        NOW,
      ],
    );
  }
  return contact.lastInsertRowId;
}

describe("duplicate-evidence", () => {
  it("reads an active external link with bound provider and opaque external ID", async () => {
    const contactId = await seedContact({ name: "Linked" });
    await exec.runAsync(
      `INSERT INTO external_contact_links
        (uid, contact_id, provider, external_contact_id, is_active, created_at, modified_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [newUid(), contactId, "android", "opaque-contact-id", NOW, NOW],
    );

    await expect(
      findActiveExternalLink(exec, "android", "opaque-contact-id"),
    ).resolves.toBe(contactId);
    await expect(
      findActiveExternalLink(exec, "android", "not-linked"),
    ).resolves.toBeNull();
  });

  it("short-circuits an active external link before any advisory candidate query", async () => {
    const contactId = await seedContact({ name: "Linked" });
    await exec.runAsync(
      `INSERT INTO external_contact_links
        (uid, contact_id, provider, external_contact_id, is_active, created_at, modified_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [newUid(), contactId, "android", "linked-source", NOW, NOW],
    );
    const queries: string[] = [];
    const trackingExec: SqlExecutor = {
      ...exec,
      getFirstAsync: async <T>(sql: string, params?: unknown[]) => {
        queries.push(sql);
        return exec.getFirstAsync<T>(sql, params);
      },
      getAllAsync: async <T>(sql: string, params?: unknown[]) => {
        queries.push(sql);
        return exec.getAllAsync<T>(sql, params);
      },
    };

    await expect(
      scoreImportCandidate(trackingExec, {
        externalContactId: "linked-source",
        methodDrafts: [
          { uid: "source-phone", type: "phone", value: "312 555 1234" },
        ],
        name: "Linked",
        birthday: null,
        effectivePhoneRegion: "US",
      }),
    ).resolves.toMatchObject({
      outcome: "already_linked",
      deterministicContactId: contactId,
      candidates: [],
    });
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain("external_contact_links");
  });

  it("canonicalizes a national-format input before matching stored canonical methods", async () => {
    const contactId = await seedContact({
      name: "Phone Match",
      methods: [{ type: "phone", canonicalValue: "+13125551234" }],
    });

    const result = await scoreImportCandidate(exec, {
      externalContactId: "new-source",
      methodDrafts: [
        { uid: "source-phone", type: "phone", value: "(312) 555-1234" },
      ],
      name: "Different Name",
      birthday: null,
      effectivePhoneRegion: "US",
    });

    expect(result.candidates).toEqual([
      expect.objectContaining({
        contactId,
        signals: ["phoneMatch"],
        sourceMethodIds: { phoneMatch: ["source-phone"], emailMatch: [] },
      }),
    ]);
  });

  it("returns new when canonical, name, and birthday evidence find no candidate", async () => {
    const result = await scoreImportCandidate(exec, {
      externalContactId: "unknown-source",
      methodDrafts: [
        { uid: "source-email", type: "email", value: "new@example.test" },
      ],
      name: "New Person",
      birthday: "1999-01-01",
      effectivePhoneRegion: "US",
    });

    expect(result).toMatchObject({
      outcome: "new",
      deterministicContactId: null,
      candidates: [],
    });
  });

  it("recommends linking a single canonical phone match", async () => {
    const contactId = await seedContact({
      name: "Strong Match",
      methods: [{ type: "phone", canonicalValue: "+13125551234" }],
    });

    await expect(
      scoreImportCandidate(exec, {
        externalContactId: "strong-phone",
        methodDrafts: [
          { uid: "source-phone", type: "phone", value: "312 555 1234" },
        ],
        name: "Different",
        birthday: null,
        effectivePhoneRegion: "US",
      }),
    ).resolves.toMatchObject({
      outcome: "probable",
      candidates: [
        {
          contactId,
          recommendation: "Recommend Link to Existing",
        },
      ],
    });
  });

  it("never recommends a link from name overlap alone", async () => {
    await seedContact({ name: "Alex Rivera" });

    const result = await scoreImportCandidate(exec, {
      externalContactId: "name-only",
      methodDrafts: [],
      name: "Alex Smith",
      birthday: null,
      effectivePhoneRegion: "US",
    });

    expect(["possible", "needs_review"]).toContain(result.outcome);
    expect(result.candidates[0]).toMatchObject({ recommendation: "Review" });
  });

  it("does not count phone and email from one source record more strongly than one phone", async () => {
    await seedContact({
      name: "Correlated Evidence",
      methods: [
        { type: "phone", canonicalValue: "+13125551234" },
        { type: "email", canonicalValue: "person@example.test" },
      ],
    });
    const shared = {
      externalContactId: "correlated-source",
      name: "Different",
      birthday: null,
      effectivePhoneRegion: "US" as const,
    };

    const phoneOnly = await scoreImportCandidate(exec, {
      ...shared,
      methodDrafts: [{ uid: "phone", type: "phone", value: "312 555 1234" }],
    });
    const phoneAndEmail = await scoreImportCandidate(exec, {
      ...shared,
      methodDrafts: [
        { uid: "phone", type: "phone", value: "312 555 1234" },
        { uid: "email", type: "email", value: "person@example.test" },
      ],
    });

    expect(phoneAndEmail.outcome).toBe(phoneOnly.outcome);
    expect(phoneAndEmail.candidates[0]?.recommendation).toBe(
      phoneOnly.candidates[0]?.recommendation,
    );
  });

  it("treats a birthday-only match as supporting evidence, never probable", async () => {
    await seedContact({ name: "Birthday Match", birthday: "1990-01-01" });

    const result = await scoreImportCandidate(exec, {
      externalContactId: "birthday-only",
      methodDrafts: [],
      name: "Different Person",
      birthday: "1990-01-01",
      effectivePhoneRegion: "US",
    });

    expect(result.outcome).not.toBe("probable");
    expect(result.candidates[0]).toMatchObject({
      recommendation: "Import as New",
    });
  });

  it("requires manual review for multiple credible candidates in stable contact-ID order", async () => {
    const firstId = await seedContact({
      name: "First Match",
      methods: [{ type: "phone", canonicalValue: "+13125551234" }],
    });
    const secondId = await seedContact({
      name: "Second Match",
      methods: [{ type: "phone", canonicalValue: "+13125551234" }],
    });

    const result = await scoreImportCandidate(exec, {
      externalContactId: "multiple-credible",
      methodDrafts: [{ uid: "phone", type: "phone", value: "312 555 1234" }],
      name: "Different",
      birthday: null,
      effectivePhoneRegion: "US",
    });

    expect(result).toMatchObject({ outcome: "needs_review" });
    expect(result.candidates.map((candidate) => candidate.contactId)).toEqual([
      firstId,
      secondId,
    ]);
    expect(result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ recommendation: "Manual Review Required" }),
      ]),
    );
  });
});
