/**
 * D-45 (enforcing D-22): after every difference is resolved, a second Check
 * linked contacts produces no cards. Integration harness: a fake provider read
 * (plain PickedContact-shaped data) over node:sqlite with the full migration
 * chain, driven through the same shared functions the grid and the detail
 * screen call.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { applyContactMethodDiffCore } from "@/db/contact-methods-dao";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import { applyReconcileSelections } from "@/db/reconcile-apply";
import {
  classifyLinkedContact,
  getReconcileContact,
  listLinkedContactsForScan,
  loadReviewMemory,
  type ReconcilePickedSource,
  type ReviewMemorySettings,
  type StagedSourcePhoto,
  scanLinkedContacts,
} from "@/db/reconcile-memory-read";
import { upsertReviewedSnapshot } from "@/db/reconcile-snapshot-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import {
  actionableReconcileFields,
  type ReconcileDiffResult,
  type ReconcileFieldDiff,
} from "@/logic/reconcile-diff";
import {
  buildReconcileSelections,
  type ReconcileBulkMode,
  type ReconcileChoice,
} from "@/logic/reconcile-selection";

const NOW = "2026-10-17 12:00:00";
const SETTINGS: ReviewMemorySettings = {
  phoneRegionOverride: null,
  deviceRegion: "US",
};
let exec: SqlExecutor;
let uidCount = 0;
const newUid = () => `second-scan-${++uidCount}`;

beforeEach(async () => {
  uidCount = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, { now: NOW, newUid });
});

async function seedContact(input: {
  name: string;
  birthday?: string | null;
  photo?: string | null;
  phones?: string[];
}): Promise<number> {
  const contactId = (
    await exec.runAsync(
      `INSERT INTO contacts (uid, name, tracking_enabled, birthday, photo, created_at, modified_at)
       VALUES (?, ?, 0, ?, ?, ?, ?)`,
      [
        newUid(),
        input.name,
        input.birthday ?? null,
        input.photo ?? null,
        NOW,
        NOW,
      ],
    )
  ).lastInsertRowId;
  if (input.phones?.length) {
    await inWriteTransaction(exec, () =>
      applyContactMethodDiffCore(exec, {
        contactId,
        seeded: [],
        current: (input.phones ?? []).map((value) => ({
          uid: newUid(),
          type: "phone" as const,
          value,
        })),
        now: NOW,
        effectivePhoneRegion: "US",
      }),
    );
  }
  return contactId;
}

async function seedLink(contactId: number, lookupKey: string): Promise<number> {
  return (
    await exec.runAsync(
      `INSERT INTO external_contact_links (uid, contact_id, provider, external_contact_id, created_at, modified_at)
       VALUES (?, ?, 'android', ?, ?, ?)`,
      [newUid(), contactId, lookupKey, NOW, NOW],
    )
  ).lastInsertRowId;
}

function picked(
  lookupKey: string,
  overrides: Partial<ReconcilePickedSource> = {},
): ReconcilePickedSource {
  return {
    lookupKey,
    displayName: "Phone Name",
    methods: [],
    birthday: null,
    ...overrides,
  };
}

/** The grid's scan: provider read in, cards out. */
async function gridScan(
  provider: readonly ReconcilePickedSource[],
  stagedPhotos: ReadonlyMap<number, StagedSourcePhoto> = new Map(),
) {
  return (
    await scanLinkedContacts(exec, {
      linked: await listLinkedContactsForScan(exec),
      picked: provider,
      stagedPhotos,
      settings: SETTINGS,
    })
  ).cards;
}

/** The detail screen's read: same memory loader, same classifier entry. */
async function detailRead(
  contactId: number,
  provider: readonly ReconcilePickedSource[],
  stagedPhotos: ReadonlyMap<number, StagedSourcePhoto> = new Map(),
) {
  const { contact, links } = await getReconcileContact(exec, contactId);
  const memory = await loadReviewMemory(exec, contactId, SETTINGS);
  const diff = await classifyLinkedContact(exec, {
    contact: contact!,
    links,
    pickedByKey: new Map(provider.map((item) => [item.lookupKey, item])),
    stagedPhotos,
    memory,
  });
  return {
    diff: { ...diff, fields: actionableReconcileFields(diff) },
    memory,
  };
}

/** The detail screen's Apply (in-transaction part) with the scan's region. */
async function detailApply(
  contactId: number,
  diff: ReconcileDiffResult,
  choose: (field: ReconcileFieldDiff) => ReconcileChoice,
) {
  const memory = await loadReviewMemory(exec, contactId, SETTINGS);
  const choices = Object.fromEntries(
    diff.fields.map((field) => [field.fieldFamily, choose(field)]),
  );
  return inWriteTransaction(exec, () =>
    applyReconcileSelections(exec, {
      contactId,
      now: NOW,
      selections: buildReconcileSelections(diff, choices),
      effectivePhoneRegion: memory.effectivePhoneRegion,
    }),
  );
}

/** The grid's bulk apply. */
async function bulkApply(
  contactId: number,
  diff: ReconcileDiffResult,
  mode: ReconcileBulkMode,
) {
  return inWriteTransaction(exec, () =>
    applyReconcileSelections(exec, {
      contactId,
      now: NOW,
      selections: buildReconcileSelections(diff, mode),
      effectivePhoneRegion: "US",
    }),
  );
}

const useFirstSource = (field: ReconcileFieldDiff): ReconcileChoice =>
  `source:${field.sourceOptions[0]?.optionId ?? ""}`;
const keepOrbit = (): ReconcileChoice => "orbit";

describe("second scan after resolving everything (D-45)", () => {
  it.each([
    ["Use the phone's values", useFirstSource],
    ["Keep Orbit", keepOrbit],
  ])(
    "name + national-format phone: %s → rescan → no cards",
    async (_label, choose) => {
      const contactId = await seedContact({
        name: "Orbit Name",
        phones: ["+13125551234"],
      });
      await seedLink(contactId, "lk-1");
      const provider = [
        picked("lk-1", {
          displayName: "Phone Name",
          // Same number as Orbit in national format, plus a new one.
          methods: [
            { type: "phone", value: "(312) 555-1234" },
            { type: "phone", value: "(312) 555-9876" },
          ],
        }),
      ];

      const first = await gridScan(provider);
      expect(first).toHaveLength(1);
      expect(first[0].diff.fields.map((field) => field.fieldFamily)).toEqual([
        "name",
        "phones",
      ]);
      expect(first[0].unresolvedCount).toBe(2);

      const { diff } = await detailRead(contactId, provider);
      const result = await detailApply(contactId, diff, choose);
      expect(result.staleFields).toEqual([]);

      expect(await gridScan(provider)).toEqual([]);
      expect((await detailRead(contactId, provider)).diff.fields).toEqual([]);
    },
  );

  it("bulk Keep Orbit on the grid's card also leaves nothing to ask", async () => {
    const contactId = await seedContact({
      name: "Orbit Name",
      phones: ["+13125551234"],
    });
    await seedLink(contactId, "lk-1");
    const provider = [
      picked("lk-1", {
        methods: [{ type: "phone", value: "(312) 555-9876" }],
      }),
    ];
    const [card] = await gridScan(provider);
    await bulkApply(contactId, card.diff, "keep-orbit");
    expect(await gridScan(provider)).toEqual([]);
  });

  it("the detail reads memory exactly like the grid: every link merged, override ?? device region", async () => {
    const contactId = await seedContact({ name: "Orbit Name" });
    const first = await seedLink(contactId, "lk-1");
    const second = await seedLink(contactId, "lk-2");
    // Memory on the second link only (the old detail read only the first).
    await upsertReviewedSnapshot(exec, {
      externalContactLinkId: second,
      fieldFamily: "name",
      reviewedValue: "Phone Name",
      reviewedAt: NOW,
    });
    const provider = [picked("lk-1"), picked("lk-2")];

    const grid = await gridScan(provider);
    const detail = await detailRead(contactId, provider);
    expect(grid).toEqual([]);
    expect(detail.diff.fields).toEqual([]);
    expect(detail.memory.snapshots).toEqual({ name: "Phone Name" });
    expect(detail.memory.effectivePhoneRegion).toBe("US");
    expect(
      (
        await loadReviewMemory(exec, contactId, {
          phoneRegionOverride: "GB",
          deviceRegion: "US",
        })
      ).effectivePhoneRegion,
    ).toBe("GB");
    expect(first).toBeLessThan(second);
  });

  it("grid card and detail view show the same actionable fields", async () => {
    const contactId = await seedContact({
      name: "Orbit Name",
      birthday: "1990-01-01",
    });
    await seedLink(contactId, "lk-1");
    const provider = [picked("lk-1", { birthday: "1991-02-03" })];
    await upsertReviewedSnapshot(exec, {
      externalContactLinkId: (await getReconcileContact(exec, contactId))
        .links[0].id,
      fieldFamily: "name",
      reviewedValue: "Phone Name",
      reviewedAt: NOW,
    });
    const [card] = await gridScan(provider);
    const detail = await detailRead(contactId, provider);
    expect(card.diff.fields).toEqual(detail.diff.fields);
    expect(card.diff.fields.map((field) => field.fieldFamily)).toEqual([
      "birthday",
    ]);
    expect(card.unresolvedCount).toBe(1);
  });
});
