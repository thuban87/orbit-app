import { beforeEach, describe, expect, it, vi } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  applyContactMethodDiff,
  type ContactMethodDraft,
  listContactMethods,
  setContactMethodPrimary,
} from "@/db/contact-methods-dao";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { migration007 } from "@/db/migrations/007-tombstones";
import { migration009 } from "@/db/migrations/009-contact-method-normalization";
import { migration010 } from "@/db/migrations/010-contact-method-label";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { Logger } from "@/utils/logger";

const NOW = "2026-08-28 10:00:00";
let counter = 0;
const uid = () => `method-${++counter}`;
let exec: SqlExecutor;

beforeEach(async () => {
  counter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(
    exec,
    [
      migration001,
      migration002,
      migration003,
      migration004,
      migration005,
      migration006,
      migration007,
      migration009,
      migration010,
    ],
    10,
    { now: NOW, newUid: uid, defaultPhoneRegion: "US" },
  );
});

async function contact(name = "Method owner"): Promise<number> {
  const result = await exec.runAsync(
    "INSERT INTO contacts (uid, name, interval_days, created_at, modified_at) VALUES (?, ?, ?, ?, ?)",
    [uid(), name, 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

const phone = (
  value: string,
  overrides: Partial<ContactMethodDraft> = {},
): ContactMethodDraft => ({ uid: uid(), type: "phone", value, ...overrides });
const email = (
  value: string,
  overrides: Partial<ContactMethodDraft> = {},
): ContactMethodDraft => ({ uid: uid(), type: "email", value, ...overrides });

describe("applyContactMethodDiff", () => {
  it("stores ordered normalized rows with canonical_region and treats a singleton as primary", async () => {
    const contactId = await contact();
    await applyContactMethodDiff(exec, {
      contactId,
      seeded: [],
      current: [phone("(312) 555-1234"), email("Person@Example.com")],
      now: NOW,
      effectivePhoneRegion: "US",
    });
    expect(await listContactMethods(exec, contactId)).toMatchObject([
      {
        method_type: "email",
        canonical_value: "person@example.com",
        canonical_region: null,
        is_actionable: 1,
        is_primary: 1,
        display_order: 0,
      },
      {
        method_type: "phone",
        canonical_value: "+13125551234",
        canonical_region: "US",
        is_actionable: 1,
        is_primary: 1,
        display_order: 0,
      },
    ]);
  });

  it("persists standard and custom labels through create, edit, collision collapse, and reload", async () => {
    const contactId = await contact();
    const first = phone("312 555 1234", { label: "Mobile" });
    const duplicate = phone("+1 312 555 1234", { label: "After hours" });
    await applyContactMethodDiff(exec, {
      contactId,
      seeded: [],
      current: [first, duplicate, email("person@example.com", { label: "Work" })],
      now: NOW,
      effectivePhoneRegion: "US",
    });
    const created = await listContactMethods(exec, contactId);
    expect(created).toMatchObject([
      { method_type: "email", label: "Work" },
      { uid: first.uid, method_type: "phone", label: "Mobile" },
    ]);

    await applyContactMethodDiff(exec, {
      contactId,
      seeded: created,
      current: created.map((row) => ({
        id: row.id,
        uid: row.uid,
        type: row.method_type,
        value: row.raw_value,
        extension: row.extension,
        label: row.method_type === "phone" ? "After hours" : row.label,
        isPrimary: row.is_primary === 1,
      })),
      now: "2026-08-28 10:01:00",
      effectivePhoneRegion: "US",
    });
    expect(await listContactMethods(exec, contactId)).toMatchObject([
      { method_type: "email", label: "Work" },
      { uid: first.uid, method_type: "phone", label: "After hours" },
    ]);
  });

  it("keeps raw/non-actionable values with a NULL canonical_region", async () => {
    const contactId = await contact();
    await applyContactMethodDiff(exec, {
      contactId,
      seeded: [],
      current: [phone("not a phone")],
      now: NOW,
      effectivePhoneRegion: "US",
    });
    expect(await listContactMethods(exec, contactId)).toMatchObject([
      {
        raw_value: "not a phone",
        canonical_value: null,
        canonical_region: null,
        is_actionable: 0,
      },
    ]);
  });

  it("collapses same-contact canonical duplicates and returns the surviving draft uid", async () => {
    const contactId = await contact();
    const first = phone("312 555 1234");
    const duplicate = phone("+1 312 555 1234");
    const result = await applyContactMethodDiff(exec, {
      contactId,
      seeded: [],
      current: [first, duplicate],
      now: NOW,
      effectivePhoneRegion: "US",
    });
    expect(result).toMatchObject({
      status: "canonicalDuplicate",
      methodType: "phone",
      survivingDraftUid: first.uid,
    });
    expect(await listContactMethods(exec, contactId)).toHaveLength(1);
  });

  it("does not treat a canonical match owned by another contact as a collision", async () => {
    const first = await contact("First");
    const second = await contact("Second");
    await applyContactMethodDiff(exec, {
      contactId: first,
      seeded: [],
      current: [phone("312 555 1234")],
      now: NOW,
      effectivePhoneRegion: "US",
    });
    expect(
      (
        await applyContactMethodDiff(exec, {
          contactId: second,
          seeded: [],
          current: [phone("+1 312 555 1234")],
          now: NOW,
          effectivePhoneRegion: "US",
        })
      ).status,
    ).toBe("saved");
    expect(await listContactMethods(exec, second)).toHaveLength(1);
  });

  it("promotes the next stored row of a type when its primary is removed", async () => {
    const contactId = await contact();
    await applyContactMethodDiff(exec, {
      contactId,
      seeded: [],
      current: [phone("312 555 1234"), phone("773 555 1234")],
      now: NOW,
      effectivePhoneRegion: "US",
    });
    const seeded = await listContactMethods(exec, contactId);
    await applyContactMethodDiff(exec, {
      contactId,
      seeded,
      current: [
        {
          id: seeded[1].id,
          uid: seeded[1].uid,
          type: "phone",
          value: seeded[1].raw_value,
        },
      ],
      now: NOW,
      effectivePhoneRegion: "US",
    });
    expect(await listContactMethods(exec, contactId)).toMatchObject([
      { id: seeded[1].id, is_primary: 1 },
    ]);
  });

  it("rolls back inserts and tombstones when a later seeded deletion cannot match", async () => {
    const contactId = await contact();
    await applyContactMethodDiff(exec, {
      contactId,
      seeded: [],
      current: [phone("312 555 1234")],
      now: NOW,
      effectivePhoneRegion: "US",
    });
    const [stored] = await listContactMethods(exec, contactId);
    await expect(
      applyContactMethodDiff(exec, {
        contactId,
        seeded: [
          ...(await listContactMethods(exec, contactId)),
          { ...stored, id: 99999, uid: "phantom" },
        ],
        current: [phone("773 555 1234")],
        now: NOW,
        effectivePhoneRegion: "US",
      }),
    ).rejects.toThrow();
    expect(await listContactMethods(exec, contactId)).toHaveLength(1);
    expect(
      await exec.getAllAsync(
        "SELECT * FROM tombstones WHERE entity_type = 'contact_method'",
      ),
    ).toEqual([]);
  });
});

async function readDataRevision(e: SqlExecutor): Promise<number> {
  const row = await e.getFirstAsync<{ data_revision: number }>(
    "SELECT data_revision FROM app_settings WHERE id = 1",
  );
  return row?.data_revision ?? -1;
}

/** Seed a contact with two phones (first is primary) + one email (primary). */
async function seedTwoPhonesOneEmail(contactId: number) {
  await applyContactMethodDiff(exec, {
    contactId,
    seeded: [],
    current: [
      phone("312 555 1234"),
      phone("773 555 1234"),
      email("person@example.com"),
    ],
    now: NOW,
    effectivePhoneRegion: "US",
  });
  const rows = await listContactMethods(exec, contactId);
  const phones = rows.filter((r) => r.method_type === "phone");
  const emails = rows.filter((r) => r.method_type === "email");
  return {
    primaryPhone: phones.find((r) => r.is_primary === 1)!,
    otherPhone: phones.find((r) => r.is_primary === 0)!,
    primaryEmail: emails[0],
  };
}

describe("setContactMethodPrimary (HIGH-7 / A3 single-method primary writer)", () => {
  it("swaps the primary of a type (clear-before-promote) with NO UNIQUE violation", async () => {
    const contactId = await contact();
    const { primaryPhone, otherPhone } = await seedTwoPhonesOneEmail(contactId);

    await setContactMethodPrimary(exec, {
      contactId,
      methodId: otherPhone.id,
      methodType: "phone",
      now: NOW,
    });

    const rows = await listContactMethods(exec, contactId);
    const byId = new Map(rows.map((r) => [r.id, r]));
    // Prior primary cleared, target promoted — exactly one phone primary.
    expect(byId.get(primaryPhone.id)?.is_primary).toBe(0);
    expect(byId.get(otherPhone.id)?.is_primary).toBe(1);
    expect(
      rows.filter((r) => r.method_type === "phone" && r.is_primary === 1),
    ).toHaveLength(1);
  });

  it("does not touch the other method_type's primary", async () => {
    const contactId = await contact();
    const { otherPhone, primaryEmail } = await seedTwoPhonesOneEmail(contactId);

    await setContactMethodPrimary(exec, {
      contactId,
      methodId: otherPhone.id,
      methodType: "phone",
      now: NOW,
    });

    const rows = await listContactMethods(exec, contactId);
    expect(rows.find((r) => r.id === primaryEmail.id)?.is_primary).toBe(1);
    expect(
      rows.filter((r) => r.method_type === "email" && r.is_primary === 1),
    ).toHaveLength(1);
  });

  it("rejects a method id that does not belong to the contact — no write", async () => {
    const owner = await contact("Owner");
    const stranger = await contact("Stranger");
    const { primaryPhone } = await seedTwoPhonesOneEmail(owner);
    await applyContactMethodDiff(exec, {
      contactId: stranger,
      seeded: [],
      current: [phone("415 555 9999")],
      now: NOW,
      effectivePhoneRegion: "US",
    });
    const [strangerPhone] = await listContactMethods(exec, stranger);

    await expect(
      setContactMethodPrimary(exec, {
        contactId: owner,
        methodId: strangerPhone.id,
        methodType: "phone",
        now: NOW,
      }),
    ).rejects.toThrow();

    // Owner's phone primary is untouched.
    const rows = await listContactMethods(exec, owner);
    expect(rows.find((r) => r.id === primaryPhone.id)?.is_primary).toBe(1);
  });

  it("rejects a method id whose stored method_type disagrees with the passed methodType — NO write, both primaries intact (#5)", async () => {
    const contactId = await contact();
    const { primaryPhone, primaryEmail } =
      await seedTwoPhonesOneEmail(contactId);

    // An email method id passed with methodType:'phone' matches no row → throw
    // BEFORE any clear, so neither the phone nor the email primary is orphaned.
    await expect(
      setContactMethodPrimary(exec, {
        contactId,
        methodId: primaryEmail.id,
        methodType: "phone",
        now: NOW,
      }),
    ).rejects.toThrow();

    const rows = await listContactMethods(exec, contactId);
    expect(rows.find((r) => r.id === primaryPhone.id)?.is_primary).toBe(1);
    expect(rows.find((r) => r.id === primaryEmail.id)?.is_primary).toBe(1);
    expect(
      rows.filter((r) => r.method_type === "phone" && r.is_primary === 1),
    ).toHaveLength(1);
  });

  it("bumps data_revision on a real swap (matching the diff path)", async () => {
    const contactId = await contact();
    const { otherPhone } = await seedTwoPhonesOneEmail(contactId);
    const before = await readDataRevision(exec);

    await setContactMethodPrimary(exec, {
      contactId,
      methodId: otherPhone.id,
      methodType: "phone",
      now: NOW,
    });

    expect(await readDataRevision(exec)).toBe(before + 1);
  });

  it("is a no-op when the target is already primary — state unchanged, no spurious data_revision bump", async () => {
    const contactId = await contact();
    const { primaryPhone } = await seedTwoPhonesOneEmail(contactId);
    const before = await readDataRevision(exec);

    await setContactMethodPrimary(exec, {
      contactId,
      methodId: primaryPhone.id,
      methodType: "phone",
      now: NOW,
    });

    expect(await readDataRevision(exec)).toBe(before);
    const rows = await listContactMethods(exec, contactId);
    expect(rows.find((r) => r.id === primaryPhone.id)?.is_primary).toBe(1);
  });
});

describe("applyContactMethodDiff (extra)", () => {
  it("never sends invalid, duplicate, or failed-save method values to Logger (guard)", async () => {
    const contactId = await contact();
    const error = vi.spyOn(Logger, "error");
    const warn = vi.spyOn(Logger, "warn");
    const debug = vi.spyOn(Logger, "debug");
    const invalid = "not a valid phone";
    const canonical = "+13125551234";

    try {
      await applyContactMethodDiff(exec, {
        contactId,
        seeded: [],
        current: [phone(invalid)],
        now: NOW,
        effectivePhoneRegion: "US",
      });
      const duplicate = await applyContactMethodDiff(exec, {
        contactId,
        seeded: await listContactMethods(exec, contactId),
        current: [phone("312 555 1234"), phone("+1 312 555 1234")],
        now: NOW,
        effectivePhoneRegion: "US",
      });
      expect(duplicate.status).toBe("canonicalDuplicate");
      const [stored] = await listContactMethods(exec, contactId);
      await expect(applyContactMethodDiff(exec, {
        contactId,
        seeded: [{ ...stored, id: 99999, uid: "missing-seeded-method" }],
        current: [phone("773 555 1234")],
        now: NOW,
        effectivePhoneRegion: "US",
      })).rejects.toThrow();

      const logged = [error, warn, debug].flatMap((spy) => spy.mock.calls.flat());
      expect(logged).not.toContain(invalid);
      expect(logged).not.toContain(canonical);
    } finally {
      vi.restoreAllMocks();
    }
  });
});
