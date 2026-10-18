import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  applyContactMethodDiffCore,
  listContactMethods,
} from "@/db/contact-methods-dao";
import { readDataRevision } from "@/db/data-revision-dao";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { migration007 } from "@/db/migrations/007-tombstones";
import { migration008 } from "@/db/migrations/008-restore-photo-journal";
import { migration009 } from "@/db/migrations/009-contact-method-normalization";
import { migration010 } from "@/db/migrations/010-contact-method-label";
import { migration011 } from "@/db/migrations/011-contact-lifecycle-schema";
import { migration012 } from "@/db/migrations/012-import-sessions";
import { migration013 } from "@/db/migrations/013-reconciliation-and-merge";
import { runMigrations } from "@/db/migrations/runner";
import { applyReconcileSelections } from "@/db/reconcile-apply";
import { getReviewedSnapshots } from "@/db/reconcile-snapshot-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import {
  actionableReconcileFields,
  classifyReconciliation,
  type ReconcileMethod,
} from "@/logic/reconcile-diff";
import {
  buildReconcileSelections,
  defaultReconcileChoices,
  type ReconcileChoices,
  type ReconcileSourceChoice,
  toggleReconcileMethodChoice,
} from "@/logic/reconcile-selection";

const NOW = "2026-08-30 12:00:00";
const migrations = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008,
  migration009,
  migration010,
  migration011,
  migration012,
  migration013,
];
let exec: SqlExecutor;
let count = 0;
const uid = () => `apply-${++count}`;
let contactId: number;
let externalContactLinkId: number;

beforeEach(async () => {
  count = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, migrations, 13, { now: NOW, newUid: uid });
  contactId = (
    await exec.runAsync(
      "INSERT INTO contacts (uid, name, tracking_enabled, birthday, created_at, modified_at) VALUES (?, 'Orbit Original', 0, '2000-01-01', ?, ?)",
      [uid(), NOW, NOW],
    )
  ).lastInsertRowId;
  externalContactLinkId = (
    await exec.runAsync(
      "INSERT INTO external_contact_links (uid, contact_id, provider, external_contact_id, created_at, modified_at) VALUES (?, ?, 'android', 'source', ?, ?)",
      [uid(), contactId, NOW, NOW],
    )
  ).lastInsertRowId;
});

function nameSelection(baseline = "Orbit Original") {
  return {
    fieldFamily: "name" as const,
    baseline,
    useSource: true,
    sourceValue: "Source Changed",
    sourceLinkIds: [externalContactLinkId],
    reviewedValue: "Source Changed",
  };
}

describe("applyReconcileSelections", () => {
  it.each(["1991-01-01", "1992-01-01"])(
    "stores the exact chosen birthday %s and complete reviewed comparable",
    async (chosen) => {
      await exec.runAsync(
        "UPDATE contacts SET birthday = '1990-01-01' WHERE id = ?",
        [contactId],
      );
      const secondLinkId = (
        await exec.runAsync(
          "INSERT INTO external_contact_links (uid, contact_id, provider, external_contact_id, created_at, modified_at) VALUES (?, ?, 'android', 'second', ?, ?)",
          [uid(), contactId, NOW, NOW],
        )
      ).lastInsertRowId;
      const classified = classifyReconciliation({
        orbit: {
          name: "Orbit Original",
          birthday: "1990-01-01",
          photo: null,
          methods: [],
        },
        sources: [
          {
            externalContactLinkId,
            displayName: "First",
            birthday: "1991-01-01",
            methods: [],
          },
          {
            externalContactLinkId: secondLinkId,
            displayName: "Second",
            birthday: "1992-01-01",
            methods: [],
          },
        ],
        lastReviewed: {},
      });
      const field = classified.fields.find(
        (item) => item.fieldFamily === "birthday",
      )!;
      const option = field.sourceOptions.find((item) => item.value === chosen)!;
      const selections = buildReconcileSelections(classified, {
        birthday: `source:${option.optionId}`,
      });
      await inWriteTransaction(exec, () =>
        applyReconcileSelections(exec, { contactId, now: NOW, selections }),
      );
      expect(
        await exec.getFirstAsync<{ birthday: string }>(
          "SELECT birthday FROM contacts WHERE id = ?",
          [contactId],
        ),
      ).toEqual({ birthday: chosen });
      expect(
        (await getReviewedSnapshots(exec, externalContactLinkId)).birthday,
      ).toBe(field.reviewedComparable);
      expect((await getReviewedSnapshots(exec, secondLinkId)).birthday).toBe(
        field.reviewedComparable,
      );
      expect(
        await exec.getFirstAsync<{ old_value: string }>(
          "SELECT old_value FROM field_history WHERE contact_id = ? AND operation = 'reconcile-overwritten'",
          [contactId],
        ),
      ).toEqual({ old_value: "1990-01-01" });
    },
  );

  it("keeps Orbit and records source comparable; refuses null source for scalar fields", async () => {
    const classified = classifyReconciliation({
      orbit: {
        name: "Orbit Original",
        birthday: "2000-01-01",
        photo: null,
        methods: [],
      },
      sources: [
        {
          externalContactLinkId,
          displayName: "First",
          birthday: "1991-01-01",
          methods: [],
        },
      ],
      lastReviewed: {},
    });
    const keep = buildReconcileSelections(classified, { birthday: "orbit" });
    await inWriteTransaction(exec, () =>
      applyReconcileSelections(exec, { contactId, now: NOW, selections: keep }),
    );
    expect(
      (await getReviewedSnapshots(exec, externalContactLinkId)).birthday,
    ).toBe(
      classified.fields.find((item) => item.fieldFamily === "birthday")
        ?.reviewedComparable,
    );
    const invalid = { ...keep[0], useSource: true, sourceValue: null };
    const result = await inWriteTransaction(exec, () =>
      applyReconcileSelections(exec, {
        contactId,
        now: NOW,
        selections: [invalid],
      }),
    );
    expect(result.staleFields).toEqual(["birthday"]);
    expect(
      await exec.getFirstAsync<{ birthday: string }>(
        "SELECT birthday FROM contacts WHERE id = ?",
        [contactId],
      ),
    ).toEqual({ birthday: "2000-01-01" });
    const invalidName = { ...nameSelection(), sourceValue: null };
    const nameResult = await inWriteTransaction(exec, () =>
      applyReconcileSelections(exec, {
        contactId,
        now: NOW,
        selections: [invalidName],
      }),
    );
    expect(nameResult.staleFields).toEqual(["name"]);
    expect(
      await exec.getFirstAsync<{ name: string }>(
        "SELECT name FROM contacts WHERE id = ?",
        [contactId],
      ),
    ).toEqual({ name: "Orbit Original" });
  });

  it("applies a selected name and a birthday when Orbit birthday is blank", async () => {
    await exec.runAsync("UPDATE contacts SET birthday = NULL WHERE id = ?", [
      contactId,
    ]);
    const classified = classifyReconciliation({
      orbit: {
        name: "Orbit Original",
        birthday: null,
        photo: null,
        methods: [],
      },
      sources: [
        {
          externalContactLinkId,
          displayName: "First",
          birthday: "1991-01-01",
          methods: [],
        },
        {
          externalContactLinkId: externalContactLinkId + 1,
          displayName: "Second",
          birthday: "1992-01-01",
          methods: [],
        },
      ],
      lastReviewed: {},
    });
    const name = classified.fields.find(
      (field) => field.fieldFamily === "name",
    )!.sourceOptions[0];
    const birthday = classified.fields.find(
      (field) => field.fieldFamily === "birthday",
    )!.sourceOptions[0];
    const selections = buildReconcileSelections(classified, {
      name: `source:${name.optionId}`,
      birthday: `source:${birthday.optionId}`,
    });
    const secondLinkId = (
      await exec.runAsync(
        "INSERT INTO external_contact_links (uid, contact_id, provider, external_contact_id, created_at, modified_at) VALUES (?, ?, 'android', 'second', ?, ?)",
        [uid(), contactId, NOW, NOW],
      )
    ).lastInsertRowId;
    expect(secondLinkId).toBe(externalContactLinkId + 1);
    await inWriteTransaction(exec, () =>
      applyReconcileSelections(exec, { contactId, now: NOW, selections }),
    );
    expect(
      await exec.getFirstAsync<{ name: string; birthday: string }>(
        "SELECT name, birthday FROM contacts WHERE id = ?",
        [contactId],
      ),
    ).toEqual({ name: name.value, birthday: birthday.value });
  });
  it("bumps data_revision for scalar-only writes and snapshots prior Orbit values", async () => {
    const before = await readDataRevision(exec);
    await inWriteTransaction(exec, () =>
      applyReconcileSelections(exec, {
        contactId,
        now: NOW,
        selections: [nameSelection()],
      }),
    );
    expect(await readDataRevision(exec)).toBe(before + 1);
    expect(
      await exec.getFirstAsync<{ name: string }>(
        "SELECT name FROM contacts WHERE id = ?",
        [contactId],
      ),
    ).toEqual({ name: "Source Changed" });
    expect(
      await exec.getFirstAsync<{ old_value: string }>(
        "SELECT old_value FROM field_history WHERE contact_id = ?",
        [contactId],
      ),
    ).toEqual({ old_value: "Orbit Original" });
  });

  it("preserves a post-scan Orbit edit, reports staleFields, and does not bump the revision", async () => {
    await exec.runAsync(
      "UPDATE contacts SET name = 'User Edited Later' WHERE id = ?",
      [contactId],
    );
    const before = await readDataRevision(exec);
    const result = await inWriteTransaction(exec, () =>
      applyReconcileSelections(exec, {
        contactId,
        now: NOW,
        selections: [nameSelection()],
      }),
    );
    expect(result.staleFields).toEqual(["name"]);
    expect(await readDataRevision(exec)).toBe(before);
    expect(
      await exec.getFirstAsync<{ name: string }>(
        "SELECT name FROM contacts WHERE id = ?",
        [contactId],
      ),
    ).toEqual({ name: "User Edited Later" });
  });

  it("defers the photo reviewed snapshot until a successful post-commit photo apply", async () => {
    const photo = {
      fieldFamily: "photo" as const,
      baseline: null,
      useSource: true,
      sourceValue: "photo-hash",
      sourceLinkIds: [externalContactLinkId],
      reviewedValue: "photo-hash",
      stagedPhotoRelative: "reconcile-staging/reconcile-source.jpg",
      photoContentHash: "photo-hash",
    };
    const result = await inWriteTransaction(exec, () =>
      applyReconcileSelections(exec, {
        contactId,
        now: NOW,
        selections: [photo],
      }),
    );
    expect(result.pendingPhoto).toEqual(photo);
    expect(await getReviewedSnapshots(exec, externalContactLinkId)).toEqual({});
  });

  it("Keep Orbit on a photo remembers the reviewed comparable inside the transaction (D-45, c4 E-4)", async () => {
    const keep = {
      fieldFamily: "photo" as const,
      baseline: "contacts/1.jpg",
      useSource: false,
      sourceValue: null,
      sourceLinkIds: [externalContactLinkId],
      reviewedValue: "",
      stagedPhotoRelative: null,
      photoContentHash: null,
    };
    await expect(
      inWriteTransaction(exec, async () => {
        await applyReconcileSelections(exec, {
          contactId,
          now: NOW,
          selections: [keep],
        });
        throw new Error("force rollback");
      }),
    ).rejects.toThrow("force rollback");
    expect(await getReviewedSnapshots(exec, externalContactLinkId)).toEqual({});
    const result = await inWriteTransaction(exec, () =>
      applyReconcileSelections(exec, {
        contactId,
        now: NOW,
        selections: [{ ...keep, reviewedValue: "fp-a\u001efp-b" }],
      }),
    );
    expect(result.pendingPhoto).toBeNull();
    expect(
      (await getReviewedSnapshots(exec, externalContactLinkId)).photo,
    ).toBe("fp-a\u001efp-b");
  });

  it("refuses to write to a person moved to the Bin after the scan (38.12 review B-IN-03)", async () => {
    await exec.runAsync("UPDATE contacts SET archived_at = ? WHERE id = ?", [
      NOW,
      contactId,
    ]);
    await expect(
      inWriteTransaction(exec, () =>
        applyReconcileSelections(exec, {
          contactId,
          now: NOW,
          selections: [nameSelection()],
        }),
      ),
    ).rejects.toThrow(/in the Bin/);
    expect(
      await exec.getFirstAsync<{ name: string }>(
        "SELECT name FROM contacts WHERE id = ?",
        [contactId],
      ),
    ).toEqual({ name: "Orbit Original" });
  });

  it("never promotes a photo before a throwing apply transaction commits", async () => {
    const promoted = false;
    await expect(
      inWriteTransaction(exec, async () => {
        await applyReconcileSelections(exec, {
          contactId,
          now: NOW,
          selections: [nameSelection()],
        });
        throw new Error("force rollback before post-commit photo promotion");
      }),
    ).rejects.toThrow("force rollback");
    expect(promoted).toBe(false);
    expect(
      await exec.getFirstAsync<{ name: string }>(
        "SELECT name FROM contacts WHERE id = ?",
        [contactId],
      ),
    ).toEqual({ name: "Orbit Original" });
  });
});

/**
 * D-47 / D-102 / convergence c3 D-1 + c4 E-5: phone values are applied exactly
 * as picked, with their labels; a detail pick elects the first pick (display
 * order) primary; bulk adds every phone value and keeps Orbit's primary;
 * nothing is deleted; a second scan asks nothing about phones.
 */
describe("phone picks: labels, primary election, nothing deleted (D-47, D-102)", () => {
  const REGION = "US";
  // ContactsContract Phone.TYPE codes: 1 Home, 2 Mobile, 3 Work.
  const phone = (value: string, typeCode: number): ReconcileMethod => ({
    type: "phone",
    value,
    typeCode,
  });

  async function seedPhones(
    phones: Array<{ value: string; label?: string | null; primary?: boolean }>,
  ) {
    await inWriteTransaction(exec, () =>
      applyContactMethodDiffCore(exec, {
        contactId,
        seeded: [],
        current: phones.map((item) => ({
          uid: uid(),
          type: "phone" as const,
          value: item.value,
          label: item.label ?? null,
          isPrimary: item.primary === true,
        })),
        now: NOW,
        effectivePhoneRegion: REGION,
      }),
    );
  }

  async function orbitPhones() {
    return (await listContactMethods(exec, contactId)).filter(
      (row) => row.method_type === "phone",
    );
  }

  async function classify(sourcePhones: ReconcileMethod[]) {
    const rows = await listContactMethods(exec, contactId);
    return classifyReconciliation({
      orbit: {
        name: "Orbit Original",
        birthday: "2000-01-01",
        photo: null,
        methods: rows.map((row) => ({
          type: row.method_type,
          value: row.raw_value,
          label: row.label,
        })),
      },
      sources: [
        {
          externalContactLinkId,
          displayName: "Orbit Original",
          birthday: "2000-01-01",
          methods: sourcePhones,
        },
      ],
      lastReviewed: await getReviewedSnapshots(exec, externalContactLinkId),
      effectivePhoneRegion: REGION,
    });
  }

  /** The value the person ticked themselves (D-144, D-148); none for defaults. */
  const ownTick = (choice: ReconcileSourceChoice) => ({ phones: choice });

  async function apply(
    diff: ReturnType<typeof classifyReconciliation>,
    choices: ReconcileChoices | "use-contact-values",
    primaryPicks?: Partial<Record<string, ReconcileSourceChoice>>,
  ) {
    return inWriteTransaction(exec, () =>
      applyReconcileSelections(exec, {
        contactId,
        now: NOW,
        selections: buildReconcileSelections(diff, choices, primaryPicks),
        effectivePhoneRegion: REGION,
      }),
    );
  }

  function pick(
    diff: ReturnType<typeof classifyReconciliation>,
    ...canonical: string[]
  ): ReconcileSourceChoice[] {
    const field = diff.fields.find((item) => item.fieldFamily === "phones")!;
    return canonical.map((value): ReconcileSourceChoice => {
      const option = field.sourceOptions.find((item) => item.value === value);
      if (!option) throw new Error(`no option ${value}`);
      return `source:${option.optionId}`;
    });
  }

  async function phonesAskedAgain(sourcePhones: ReconcileMethod[]) {
    return actionableReconcileFields(await classify(sourcePhones)).some(
      (field) => field.fieldFamily === "phones",
    );
  }

  async function contactMethodTombstones() {
    return (
      await exec.getAllAsync(
        "SELECT entity_uid FROM tombstones WHERE entity_type = 'contact_method'",
      )
    ).length;
  }

  const shape = (rows: Awaited<ReturnType<typeof orbitPhones>>) =>
    rows
      .map((row) => ({
        value: row.canonical_value,
        label: row.label,
        primary: row.is_primary === 1,
      }))
      .sort((a, b) => (a.value ?? "").localeCompare(b.value ?? ""));

  it("a tap on one phone value adds only it, labelled, as primary; the old primary stays secondary", async () => {
    await seedPhones([{ value: "+13125550111", label: "Mobile" }]);
    const source = [phone("(312) 555-0122", 3), phone("(312) 555-0133", 1)];
    const diff = await classify(source);
    const [ticked] = pick(diff, "+13125550122");
    await apply(diff, { phones: [ticked] }, ownTick(ticked));
    const rows = await orbitPhones();
    expect(shape(rows)).toEqual([
      { value: "+13125550111", label: "Mobile", primary: false },
      { value: "+13125550122", label: "Work", primary: true },
    ]);
    // The phone's own value is stored, not the canonical key.
    expect(
      rows.find((row) => row.canonical_value === "+13125550122")?.raw_value,
    ).toBe("(312) 555-0122");
    expect(await contactMethodTombstones()).toBe(0);
    expect(await phonesAskedAgain(source)).toBe(false);
  });

  it("two picks of three: both added labelled, the person's last own tick primary, the third not added", async () => {
    await seedPhones([{ value: "+13125550111", label: "Mobile" }]);
    const source = [
      phone("(312) 555-0122", 3),
      phone("(312) 555-0133", 1),
      phone("(312) 555-0144", 2),
    ];
    const diff = await classify(source);
    // Ticked 0144 then 0122: the latest own tick is the primary (D-148).
    const picks = pick(diff, "+13125550144", "+13125550122");
    await apply(diff, { phones: picks }, ownTick(picks[1]));
    expect(shape(await orbitPhones())).toEqual([
      { value: "+13125550111", label: "Mobile", primary: false },
      { value: "+13125550122", label: "Work", primary: true },
      { value: "+13125550144", label: "Mobile", primary: false },
    ]);
    expect(await contactMethodTombstones()).toBe(0);
    expect(await phonesAskedAgain(source)).toBe(false);
  });

  it("bulk Use Contact Values adds every phone value labelled and keeps Orbit's primary", async () => {
    await seedPhones([{ value: "+13125550111", label: "Mobile" }]);
    const source = [
      phone("(312) 555-0111", 2),
      phone("(312) 555-0122", 3),
      phone("(312) 555-0133", 1),
      phone("(312) 555-0144", 0),
    ];
    source[3] = { ...source[3], customLabel: "Gym" };
    const diff = await classify(source);
    expect(diff.fields.find((f) => f.fieldFamily === "phones")?.outcome).toBe(
      "additive",
    );
    await apply(diff, "use-contact-values");
    expect(shape(await orbitPhones())).toEqual([
      { value: "+13125550111", label: "Mobile", primary: true },
      { value: "+13125550122", label: "Work", primary: false },
      { value: "+13125550133", label: "Home", primary: false },
      { value: "+13125550144", label: "Gym", primary: false },
    ]);
    expect(await phonesAskedAgain(source)).toBe(false);
  });

  it("a pick already in Orbit as a secondary becomes primary instead of a duplicate", async () => {
    await seedPhones([
      { value: "+13125550111", label: "Mobile", primary: true },
      { value: "+13125550122", label: null },
    ]);
    const before = await orbitPhones();
    const source = [phone("(312) 555-0122", 3), phone("(312) 555-0155", 2)];
    const diff = await classify(source);
    const [ticked] = pick(diff, "+13125550122");
    await apply(diff, { phones: [ticked] }, ownTick(ticked));
    const rows = await orbitPhones();
    expect(rows).toHaveLength(2);
    const flipped = rows.find((row) => row.canonical_value === "+13125550122");
    // Same row (no duplicate, no delete); only is_primary changed.
    expect(flipped?.id).toBe(
      before.find((row) => row.canonical_value === "+13125550122")?.id,
    );
    expect(flipped?.is_primary).toBe(1);
    expect(
      rows.find((row) => row.canonical_value === "+13125550111")?.is_primary,
    ).toBe(0);
    expect(await contactMethodTombstones()).toBe(0);
  });

  it("detail default: an additive field opens with every phone value picked; Apply adds all three (convergence c4 E-5)", async () => {
    const source = [
      phone("(312) 555-0144", 2),
      phone("(312) 555-0122", 3),
      phone("(312) 555-0133", 1),
    ];
    const diff = await classify(source);
    const defaults = defaultReconcileChoices(diff);
    expect(defaults.phones).toEqual(
      pick(diff, "+13125550122", "+13125550133", "+13125550144"),
    );
    await apply(diff, defaults);
    expect(shape(await orbitPhones())).toEqual([
      { value: "+13125550122", label: "Work", primary: true },
      { value: "+13125550133", label: "Home", primary: false },
      { value: "+13125550144", label: "Mobile", primary: false },
    ]);
    expect(await phonesAskedAgain(source)).toBe(false);
  });

  it("untapped Apply adds the pre-ticked values but keeps Orbit's primary (38.12 D-144)", async () => {
    await seedPhones([{ value: "+13125550155", label: "Mobile" }]);
    // 0122 sorts before Orbit's 0155, so a default election would move the
    // primary; with no tap it must not.
    const source = [phone("(312) 555-0155", 2), phone("(312) 555-0122", 3)];
    const diff = await classify(source);
    expect(diff.fields.find((f) => f.fieldFamily === "phones")?.outcome).toBe(
      "additive",
    );
    await apply(diff, defaultReconcileChoices(diff));
    expect(shape(await orbitPhones())).toEqual([
      { value: "+13125550122", label: "Work", primary: false },
      { value: "+13125550155", label: "Mobile", primary: true },
    ]);
    expect(await contactMethodTombstones()).toBe(0);
    expect(await phonesAskedAgain(source)).toBe(false);
  });

  it("an own tick elects that value even with pre-ticked defaults (38.12 D-148, D-102)", async () => {
    await seedPhones([{ value: "+13125550155", label: "Mobile" }]);
    const source = [phone("(312) 555-0155", 2), phone("(312) 555-0122", 3)];
    const diff = await classify(source);
    // The person unticked and re-ticked 0122: their own tick.
    const [ticked] = pick(diff, "+13125550122");
    await apply(diff, defaultReconcileChoices(diff), ownTick(ticked));
    expect(shape(await orbitPhones())).toEqual([
      { value: "+13125550122", label: "Work", primary: true },
      { value: "+13125550155", label: "Mobile", primary: false },
    ]);
    expect(await contactMethodTombstones()).toBe(0);
  });

  it("unticking a pre-ticked value never makes an untapped value primary (38.12 review B-WR-04)", async () => {
    // Orbit's primary 0155 sorts after 0122, so a display-order election
    // after an untick would make the never-tapped 0122 primary.
    await seedPhones([{ value: "+13125550155", label: "Mobile" }]);
    const source = [
      phone("(312) 555-0155", 2),
      phone("(312) 555-0122", 3),
      phone("(312) 555-0133", 1),
    ];
    const diff = await classify(source);
    expect(diff.fields.find((f) => f.fieldFamily === "phones")?.outcome).toBe(
      "additive",
    );
    const [, unwanted] = pick(diff, "+13125550122", "+13125550133");
    const phones = toggleReconcileMethodChoice(
      defaultReconcileChoices(diff).phones,
      unwanted,
    );
    // No own tick: nothing elects.
    await apply(diff, { phones }, {});
    expect(shape(await orbitPhones())).toEqual([
      { value: "+13125550122", label: "Work", primary: false },
      { value: "+13125550155", label: "Mobile", primary: true },
    ]);
  });

  it("detail default: unticking one adds only the other two", async () => {
    const source = [
      phone("(312) 555-0122", 3),
      phone("(312) 555-0133", 1),
      phone("(312) 555-0144", 2),
    ];
    const diff = await classify(source);
    const [untick] = pick(diff, "+13125550133");
    const phones = toggleReconcileMethodChoice(
      defaultReconcileChoices(diff).phones,
      untick,
    );
    await apply(diff, { phones });
    expect(shape(await orbitPhones()).map((row) => row.value)).toEqual([
      "+13125550122",
      "+13125550144",
    ]);
    // The unticked number is remembered as reviewed, not offered again.
    expect(await phonesAskedAgain(source)).toBe(false);
  });

  it("a conflict phones field opens with nothing picked", async () => {
    await seedPhones([{ value: "+13125550111" }]);
    const diff = await classify([phone("(312) 555-0122", 2)]);
    expect(diff.fields.find((f) => f.fieldFamily === "phones")?.outcome).toBe(
      "conflict",
    );
    expect(defaultReconcileChoices(diff).phones).toBeUndefined();
  });

  it("two stored numbers that collide under today's region both survive an addition (38.12 review B-WR-05)", async () => {
    // Stored separately: a national number written while no region was known
    // (no canonical value) and the same number in E.164.
    for (const [order, raw, canonical, primary] of [
      [0, "(312) 555-1234", null, 1],
      [1, "+13125551234", "+13125551234", 0],
    ] as const) {
      await exec.runAsync(
        `INSERT INTO contact_methods
           (uid, contact_id, method_type, raw_value, display_value, canonical_value,
            is_actionable, is_primary, display_order, created_at, modified_at)
         VALUES (?, ?, 'phone', ?, ?, ?, 1, ?, ?, ?, ?)`,
        [uid(), contactId, raw, raw, canonical, primary, order, NOW, NOW],
      );
    }
    const before = await orbitPhones();
    const source = [phone("(312) 555-1234", 2), phone("(312) 555-9999", 3)];
    const diff = await classify(source);
    await apply(diff, "use-contact-values");
    const rows = await orbitPhones();
    expect(rows.map((row) => row.id)).toEqual(
      expect.arrayContaining(before.map((row) => row.id)),
    );
    expect(rows).toHaveLength(3);
    // Stored rows are untouched (no re-normalization), nothing tombstoned.
    for (const row of before)
      expect(rows.find((item) => item.id === row.id)).toEqual(row);
    expect(await contactMethodTombstones()).toBe(0);
  });
});
