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
import {
  getReviewedSnapshots,
  MISSING_SOURCE_KEPT,
  recordReviewedPhoto,
  rememberMissingSourceKeptCore,
  upsertReviewedSnapshot,
} from "@/db/reconcile-snapshot-dao";
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

function staged(
  entries: Array<[linkId: number, contentHash: string, relative?: string]>,
): Map<number, StagedSourcePhoto> {
  return new Map(
    entries.map(([linkId, contentHash, relative]) => [
      linkId,
      {
        stagedRelative: relative ?? `reconcile-staging/link-${linkId}.jpg`,
        contentHash,
      },
    ]),
  );
}

/** The detail's post-commit Use phone's photo memory write (after promote). */
async function applyPhonePhotoPostCommit(
  contactId: number,
  pending: NonNullable<
    Awaited<ReturnType<typeof applyReconcileSelections>>["pendingPhoto"]
  >,
) {
  await exec.runAsync("UPDATE contacts SET photo = ? WHERE id = ?", [
    `contacts/${contactId}.jpg`,
    contactId,
  ]);
  await recordReviewedPhoto(exec, {
    externalContactLinkIds: pending.sourceLinkIds,
    reviewedValue: pending.reviewedValue,
    reviewedAt: NOW,
  });
}

describe("photo memory (D-45, D-132, convergence c4 E-4)", () => {
  it.each(["detail", "bulk"] as const)(
    "Orbit photo, phone none → Keep Orbit (%s) → no card; the phone gains a photo → the card returns",
    async (path) => {
      const contactId = await seedContact({
        name: "Phone Name",
        photo: "contacts/1.jpg",
      });
      const linkId = await seedLink(contactId, "lk-1");
      const provider = [picked("lk-1")];
      const [card] = await gridScan(provider);
      expect(card.diff.fields).toEqual([
        expect.objectContaining({
          fieldFamily: "photo",
          outcome: "removed-from-source",
        }),
      ]);
      if (path === "detail") {
        const { diff } = await detailRead(contactId, provider);
        await detailApply(contactId, diff, keepOrbit);
      } else {
        await bulkApply(contactId, card.diff, "keep-orbit");
      }
      expect(await gridScan(provider)).toEqual([]);

      const withPhoto = [picked("lk-1", { photoFingerprint: "fp-new" })];
      const returned = await gridScan(
        withPhoto,
        staged([[linkId, "bytes-new"]]),
      );
      expect(returned).toHaveLength(1);
      expect(returned[0].diff.fields[0]).toMatchObject({
        fieldFamily: "photo",
        outcome: "conflict",
        reviewedComparable: "fp-new",
      });
    },
  );

  it.each(["keep", "use-second"] as const)(
    "two links with different phone photos → %s → no card",
    async (choice) => {
      const contactId = await seedContact({
        name: "Phone Name",
        photo: "contacts/1.jpg",
      });
      const first = await seedLink(contactId, "lk-1");
      const second = await seedLink(contactId, "lk-2");
      const provider = [
        picked("lk-1", { photoFingerprint: "fp-a" }),
        picked("lk-2", { photoFingerprint: "fp-b" }),
      ];
      const photos = staged([
        [first, "bytes-a", "reconcile-staging/a.jpg"],
        [second, "bytes-b", "reconcile-staging/b.jpg"],
      ]);
      const { diff } = await detailRead(contactId, provider, photos);
      const photo = diff.fields.find((field) => field.fieldFamily === "photo")!;
      expect(photo.sourceOptions.map((option) => option.value)).toEqual([
        "fp-a",
        "fp-b",
      ]);
      if (choice === "keep") {
        await detailApply(contactId, diff, keepOrbit);
      } else {
        const option = photo.sourceOptions[1];
        const result = await detailApply(
          contactId,
          diff,
          () => `source:${option.optionId}`,
        );
        expect(result.pendingPhoto?.stagedPhotoRelative).toBe(
          "reconcile-staging/b.jpg",
        );
        expect(result.pendingPhoto?.photoContentHash).toBe("fp-b");
        await applyPhonePhotoPostCommit(contactId, result.pendingPhoto!);
      }
      expect(await gridScan(provider, photos)).toEqual([]);
    },
  );

  it("compares by the bridge fingerprint, so new bytes with the same fingerprint are not a difference", async () => {
    const contactId = await seedContact({
      name: "Phone Name",
      photo: "contacts/1.jpg",
    });
    const linkId = await seedLink(contactId, "lk-1");
    // What import records when it adopts the phone photo (38.12-02).
    await upsertReviewedSnapshot(exec, {
      externalContactLinkId: linkId,
      fieldFamily: "photo",
      reviewedValue: "fp-1",
      reviewedAt: NOW,
    });
    const provider = [picked("lk-1", { photoFingerprint: "fp-1" })];
    expect(await gridScan(provider, staged([[linkId, "bytes-thumb"]]))).toEqual(
      [],
    );
    expect(await gridScan(provider, staged([[linkId, "bytes-full"]]))).toEqual(
      [],
    );
    // No fingerprint from the bridge: the staged-bytes hash is the fallback.
    expect(
      await gridScan([picked("lk-1")], staged([[linkId, "bytes-full"]])),
    ).toHaveLength(1);
  });
});

describe("impossible phone birthday (D-45)", () => {
  it("is not offered, so it never holds a card open", async () => {
    const contactId = await seedContact({
      name: "Orbit Name",
      birthday: "1990-01-01",
    });
    await seedLink(contactId, "lk-1");
    const provider = [picked("lk-1", { birthday: "2021-02-29" })];
    const [card] = await gridScan(provider);
    expect(card.diff.fields.map((field) => field.fieldFamily)).toEqual([
      "name",
    ]);
    const { diff } = await detailRead(contactId, provider);
    const result = await detailApply(contactId, diff, useFirstSource);
    expect(result.staleFields).toEqual([]);
    expect(await gridScan(provider)).toEqual([]);
  });
});

describe("missing source (D-45)", () => {
  it("Keep as is → rescan → no card; the source reads again → memory cleared; it disappears again → card", async () => {
    const contactId = await seedContact({ name: "Phone Name" });
    const linkId = await seedLink(contactId, "lk-1");
    const [card] = await gridScan([]);
    expect(card.diff.missingSource).toBe(true);
    expect(card.diff.missingLinkIds).toEqual([linkId]);

    // The detail's Keep as is (the same write the screen makes).
    await inWriteTransaction(exec, () =>
      rememberMissingSourceKeptCore(exec, {
        externalContactLinkIds: card.diff.missingLinkIds ?? [],
        now: NOW,
      }),
    );
    expect(await getReviewedSnapshots(exec, linkId)).toEqual({
      source: MISSING_SOURCE_KEPT,
    });
    expect(await gridScan([])).toEqual([]);
    expect((await detailRead(contactId, [])).diff.fields).toEqual([]);

    expect(await gridScan([picked("lk-1")])).toEqual([]);
    expect(await getReviewedSnapshots(exec, linkId)).toEqual({});

    const [again] = await gridScan([]);
    expect(again.diff.missingSource).toBe(true);
  });

  it("the grid's bulk Keep Orbit on a missing-source card is remembered too", async () => {
    const contactId = await seedContact({ name: "Phone Name" });
    await seedLink(contactId, "lk-1");
    const [card] = await gridScan([]);
    // The grid's bulk transaction: apply, then remember the kept missing source.
    await inWriteTransaction(exec, async () => {
      await applyReconcileSelections(exec, {
        contactId,
        now: NOW,
        selections: buildReconcileSelections(card.diff, "keep-orbit"),
        effectivePhoneRegion: "US",
      });
      await rememberMissingSourceKeptCore(exec, {
        externalContactLinkIds: card.diff.missingLinkIds ?? [],
        now: NOW,
      });
    });
    expect(await gridScan([])).toEqual([]);
  });

  it("a kept missing link does not hide the other link's differences", async () => {
    const contactId = await seedContact({ name: "Orbit Name" });
    const missing = await seedLink(contactId, "lk-1");
    await seedLink(contactId, "lk-2");
    await upsertReviewedSnapshot(exec, {
      externalContactLinkId: missing,
      fieldFamily: "source",
      reviewedValue: MISSING_SOURCE_KEPT,
      reviewedAt: NOW,
    });
    const [card] = await gridScan([picked("lk-2")]);
    expect(card.diff.missingSource).toBe(false);
    expect(card.diff.fields.map((field) => field.fieldFamily)).toEqual([
      "name",
    ]);
  });
});

describe("several links: one review holds across every read link (38.12 review B-CR-02)", () => {
  it("divergent photo memory on two read links: Keep Orbit once → rescan → no card", async () => {
    const contactId = await seedContact({
      name: "Phone Name",
      photo: "contacts/1.jpg",
    });
    const first = await seedLink(contactId, "lk-1");
    const second = await seedLink(contactId, "lk-2");
    // A import-recorded fingerprint on L1; an earlier "Keep Orbit" on L2
    // (whose phone contact has no photo) — e.g. after a D-99 merge.
    await upsertReviewedSnapshot(exec, {
      externalContactLinkId: first,
      fieldFamily: "photo",
      reviewedValue: "fp-1",
      reviewedAt: NOW,
    });
    await upsertReviewedSnapshot(exec, {
      externalContactLinkId: second,
      fieldFamily: "photo",
      reviewedValue: "",
      reviewedAt: NOW,
    });
    const provider = [
      picked("lk-1", { photoFingerprint: "fp-1" }),
      picked("lk-2"),
    ];
    const photos = staged([[first, "bytes-1"]]);
    const [card] = await gridScan(provider, photos);
    expect(card.diff.fields.map((field) => field.fieldFamily)).toEqual([
      "photo",
    ]);
    const { diff } = await detailRead(contactId, provider, photos);
    await detailApply(contactId, diff, keepOrbit);
    expect((await getReviewedSnapshots(exec, second)).photo).toBe("fp-1");
    expect(await gridScan(provider, photos)).toEqual([]);
    expect((await detailRead(contactId, provider, photos)).diff.fields).toEqual(
      [],
    );
  });

  it("a kept-missing link's stale memory does not decide the comparison", async () => {
    const contactId = await seedContact({ name: "Orbit Name" });
    const reads = await seedLink(contactId, "lk-1");
    const kept = await seedLink(contactId, "lk-2");
    await upsertReviewedSnapshot(exec, {
      externalContactLinkId: reads,
      fieldFamily: "name",
      reviewedValue: "Phone Name",
      reviewedAt: NOW,
    });
    // The unread, kept-as-is link holds an older name review (higher id).
    await upsertReviewedSnapshot(exec, {
      externalContactLinkId: kept,
      fieldFamily: "name",
      reviewedValue: "Old Name",
      reviewedAt: NOW,
    });
    await upsertReviewedSnapshot(exec, {
      externalContactLinkId: kept,
      fieldFamily: "source",
      reviewedValue: MISSING_SOURCE_KEPT,
      reviewedAt: NOW,
    });
    expect(await gridScan([picked("lk-1")])).toEqual([]);
  });
});
