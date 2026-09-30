import { describe, expect, it, vi } from "vitest";
import { resolveExistingContactChoices } from "./existing-contact-choices";

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
