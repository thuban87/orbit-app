import { describe, expect, it, vi } from "vitest";
import {
  REVIEW_MATCH_CHOICES,
  resolveExistingContactChoices,
} from "./existing-contact-choices";

/**
 * The import duplicate choices name an existing Orbit contact. Each choice
 * carries that contact's stored RELATIVE photo path from its header read, so
 * the choice row renders it through Avatar (38.6 D-25 F-1, D-01).
 */

type Header = { name: string; photo: string | null };

const HEADERS: Record<number, Header | null> = {
  1: { name: "Ada Lovelace", photo: "avatars/contact-1.jpg" },
  2: null,
  3: { name: "Grace Hopper", photo: null },
};

describe("resolveExistingContactChoices (38.6 D-25 F-1)", () => {
  it("drops a gone contact and adds name and photo in input order", async () => {
    const readHeader = vi.fn(async (contactId: number) => HEADERS[contactId]);
    const result = await resolveExistingContactChoices(
      [
        { contactId: 1, signals: ["phoneMatch"] },
        { contactId: 2, signals: ["emailMatch"] },
        { contactId: 3, signals: ["nameOverlap"] },
      ],
      readHeader,
    );
    expect(result).toEqual([
      {
        contactId: 1,
        signals: ["phoneMatch"],
        name: "Ada Lovelace",
        photo: "avatars/contact-1.jpg",
      },
      {
        contactId: 3,
        signals: ["nameOverlap"],
        name: "Grace Hopper",
        photo: null,
      },
    ]);
    expect(readHeader.mock.calls.map(([id]) => id)).toEqual([1, 2, 3]);
  });

  it("reads every header before awaiting any (concurrent)", async () => {
    const started: number[] = [];
    const resolvers: Array<() => void> = [];
    const readHeader = (contactId: number) =>
      new Promise<Header | null>((resolve) => {
        started.push(contactId);
        resolvers.push(() => resolve(HEADERS[contactId] ?? null));
      });
    const pending = resolveExistingContactChoices(
      [{ contactId: 3 }, { contactId: 1 }],
      readHeader,
    );
    expect(started).toEqual([3, 1]);
    for (const resolve of [...resolvers].reverse()) resolve();
    expect((await pending).map((choice) => choice.contactId)).toEqual([3, 1]);
  });

  it("returns an empty list for no candidates", async () => {
    expect(await resolveExistingContactChoices([], vi.fn())).toEqual([]);
  });
});

describe("Review matches order and minimum strength (38.12 D-52)", () => {
  const NAMES: Record<number, Header> = {
    1: { name: "Ann Lane", photo: null },
    2: { name: "Ann Leigh", photo: null },
    3: { name: "Ann Low", photo: null },
    4: { name: "Ann Lea", photo: null },
    5: { name: "Ann Loy", photo: null },
  };
  const read = async (contactId: number) => NAMES[contactId] ?? null;
  const ids = (choices: readonly { contactId: number }[]) =>
    choices.map((choice) => choice.contactId);

  it("lists phone/email matches first, each group in the given (score) order", async () => {
    const result = await resolveExistingContactChoices(
      [
        { contactId: 1, signals: ["nameOverlap"] },
        { contactId: 2, signals: ["phoneMatch"] },
        { contactId: 3, signals: ["nameOverlap", "birthdayMatch"] },
        { contactId: 4, signals: ["emailMatch", "nameOverlap"] },
      ],
      read,
      REVIEW_MATCH_CHOICES,
    );
    expect(ids(result)).toEqual([2, 4, 1, 3]);
  });

  it("does not offer a candidate scored below 'possible' (birthday only, or no evidence)", async () => {
    const readHeader = vi.fn(read);
    const result = await resolveExistingContactChoices(
      [
        { contactId: 1, signals: ["nameOverlap"] },
        { contactId: 2, signals: ["phoneMatch"] },
        { contactId: 3, signals: ["birthdayMatch"] },
        { contactId: 5, signals: [] },
      ],
      readHeader,
      REVIEW_MATCH_CHOICES,
    );
    expect(ids(result)).toEqual([2, 1]);
    // A dropped candidate's header is never read.
    expect(readHeader.mock.calls.map(([id]) => id).sort()).toEqual([1, 2]);
  });

  it("returns nothing when no candidate reaches 'possible'", async () => {
    expect(
      await resolveExistingContactChoices(
        [{ contactId: 3, signals: ["birthdayMatch"] }],
        read,
        REVIEW_MATCH_CHOICES,
      ),
    ).toEqual([]);
  });

  it("without the option keeps every candidate in input order (Import review unchanged)", async () => {
    const result = await resolveExistingContactChoices(
      [
        { contactId: 3, signals: ["birthdayMatch"] },
        { contactId: 1, signals: ["nameOverlap"] },
        { contactId: 2, signals: ["phoneMatch"] },
      ],
      read,
    );
    expect(ids(result)).toEqual([3, 1, 2]);
  });
});

describe("a person in the Bin is never offered (38.12 D-145)", () => {
  it("drops a candidate whose contact was binned after scoring", async () => {
    const result = await resolveExistingContactChoices(
      [
        { contactId: 1, signals: ["phoneMatch"] },
        { contactId: 9, signals: ["phoneMatch"] },
      ],
      async (contactId) =>
        contactId === 9
          ? { name: "Binned", photo: null, archived_at: "2026-10-01 10:00:00" }
          : { name: "Live", photo: null, archived_at: null },
    );
    expect(result.map((choice) => choice.contactId)).toEqual([1]);
  });
});
