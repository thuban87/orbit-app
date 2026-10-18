import { describe, expect, it } from "vitest";
import {
  actionableReconcileFields,
  buildDesiredMethodList,
  classifyReconciliation,
  type ReconcileSource,
  serializeMethodFamily,
} from "@/logic/reconcile-diff";

const source = (overrides: Partial<ReconcileSource> = {}): ReconcileSource => ({
  externalContactLinkId: 1,
  displayName: "Source Name",
  methods: [],
  birthday: null,
  ...overrides,
});

const orbit = (overrides = {}) => ({
  name: "Orbit Name",
  birthday: null,
  photo: null,
  methods: [],
  modifiedAt: "2026-08-30 10:00:00",
  ...overrides,
});

describe("classifyReconciliation", () => {
  it("classifies scalar additive, conflict, removed, and reviewed source values", () => {
    expect(
      classifyReconciliation({
        orbit: orbit({ name: null }),
        sources: [source()],
        lastReviewed: {},
      }).fields[0].outcome,
    ).toBe("additive");
    expect(
      classifyReconciliation({
        orbit: orbit(),
        sources: [source()],
        lastReviewed: {},
      }).fields[0].outcome,
    ).toBe("conflict");
    expect(
      classifyReconciliation({
        orbit: orbit(),
        sources: [source({ displayName: null })],
        lastReviewed: {},
      }).fields[0].outcome,
    ).toBe("removed-from-source");
    expect(
      classifyReconciliation({
        orbit: orbit(),
        sources: [source()],
        lastReviewed: { name: "Source Name" },
      }).fields[0].outcome,
    ).toBe("unchanged-since-review");
  });

  it("uses missing-source as a single card state before field removals", () => {
    const result = classifyReconciliation({
      orbit: orbit(),
      sources: [],
      omittedCount: 1,
      lastReviewed: {},
    });
    expect(result.missingSource).toBe(true);
    expect(result.fields).toEqual([
      expect.objectContaining({ outcome: "missing-source" }),
    ]);
  });

  it("uses canonical method values, not raw formatting or labels, for Orbit/source equality", () => {
    const result = classifyReconciliation({
      orbit: orbit({
        methods: [{ type: "phone", value: "(312) 555-1234", label: "Mobile" }],
      }),
      sources: [
        source({ methods: [{ type: "phone", value: "312-555-1234" }] }),
      ],
      lastReviewed: {},
      // National numbers only canonicalize with a region (D-45).
      effectivePhoneRegion: "US",
    });
    expect(
      result.fields.find((field) => field.fieldFamily === "phones"),
    ).toBeUndefined();
  });

  it("combines multiple sources into one deterministic set of options", () => {
    const result = classifyReconciliation({
      orbit: orbit(),
      sources: [
        source({ externalContactLinkId: 2, displayName: "Zed" }),
        source({ externalContactLinkId: 1, displayName: "Amy" }),
      ],
      lastReviewed: {},
    });
    expect(
      result.fields[0].sourceOptions.map((option) => option.value),
    ).toEqual(["Amy", "Zed"]);
  });

  it("re-surfaces a reviewed value when the source changes again", () => {
    const result = classifyReconciliation({
      orbit: orbit(),
      sources: [source({ displayName: "Changed Again" })],
      lastReviewed: { name: "Source Name" },
    });
    expect(result.fields[0].outcome).toBe("conflict");
  });
});

const SEP = "\u001e";
const photoField = (result: ReturnType<typeof classifyReconciliation>) =>
  result.fields.find((field) => field.fieldFamily === "photo");

describe("photo comparable (convergence c4 E-4)", () => {
  it('is "" when the phone has no photo, so an Orbit-only photo can be remembered', () => {
    const removed = classifyReconciliation({
      orbit: orbit({ photo: "contacts/1.jpg" }),
      sources: [source()],
      lastReviewed: {},
    });
    expect(photoField(removed)).toMatchObject({
      outcome: "removed-from-source",
      reviewedComparable: "",
    });
    const kept = classifyReconciliation({
      orbit: orbit({ photo: "contacts/1.jpg" }),
      sources: [source()],
      lastReviewed: { photo: "" },
    });
    expect(photoField(kept)?.outcome).toBe("unchanged-since-review");
  });

  it("is the option value for one phone photo", () => {
    const result = classifyReconciliation({
      orbit: orbit({ photo: "contacts/1.jpg" }),
      sources: [source({ photoContentHash: "fp-a" })],
      lastReviewed: {},
    });
    expect(photoField(result)?.reviewedComparable).toBe("fp-a");
    expect(photoField(result)?.sourceValue).toBe("fp-a");
  });

  it("is the sorted join for two phone photos, like name and birthday", () => {
    const result = classifyReconciliation({
      orbit: orbit({ photo: "contacts/1.jpg" }),
      sources: [
        source({ externalContactLinkId: 1, photoContentHash: "fp-b" }),
        source({ externalContactLinkId: 2, photoContentHash: "fp-a" }),
      ],
      lastReviewed: {},
    });
    expect(photoField(result)?.reviewedComparable).toBe(`fp-a${SEP}fp-b`);
    expect(photoField(result)?.sourceValue).toBeNull();
    expect(
      photoField(
        classifyReconciliation({
          orbit: orbit({ photo: "contacts/1.jpg" }),
          sources: [
            source({ externalContactLinkId: 1, photoContentHash: "fp-b" }),
            source({ externalContactLinkId: 2, photoContentHash: "fp-a" }),
          ],
          lastReviewed: { photo: `fp-a${SEP}fp-b` },
        }),
      )?.outcome,
    ).toBe("unchanged-since-review");
  });
});

describe("unreadable phone birthday (D-45)", () => {
  const birthdayField = (result: ReturnType<typeof classifyReconciliation>) =>
    result.fields.find((field) => field.fieldFamily === "birthday");

  it("is never offered; with no valid option left no birthday field is emitted", () => {
    for (const orbitBirthday of ["1990-01-01", null]) {
      expect(
        birthdayField(
          classifyReconciliation({
            orbit: orbit({ birthday: orbitBirthday }),
            sources: [source({ birthday: "2021-02-29" })],
            lastReviewed: {},
          }),
        ),
      ).toBeUndefined();
    }
  });

  it("keeps only the readable options", () => {
    const field = birthdayField(
      classifyReconciliation({
        orbit: orbit({ birthday: "1990-01-01" }),
        sources: [
          source({ externalContactLinkId: 1, birthday: "2021-02-29" }),
          source({ externalContactLinkId: 2, birthday: "1991-01-01" }),
        ],
        lastReviewed: {},
      }),
    );
    expect(field?.sourceOptions.map((option) => option.value)).toEqual([
      "1991-01-01",
    ]);
  });
});

describe("diff source link ids (convergence c4 E-4)", () => {
  it("lists every read source's link id", () => {
    expect(
      classifyReconciliation({
        orbit: orbit(),
        sources: [
          source({ externalContactLinkId: 4 }),
          source({ externalContactLinkId: 9 }),
        ],
        lastReviewed: {},
      }).sourceLinkIds,
    ).toEqual([4, 9]);
  });
});

describe("actionableReconcileFields", () => {
  it("drops reviewed, unchanged fields and keeps every other outcome (D-45)", () => {
    const result = classifyReconciliation({
      orbit: orbit({ birthday: "1990-01-01" }),
      sources: [source({ birthday: "1991-02-03" })],
      lastReviewed: { name: "Source Name" },
    });
    expect(result.fields.map((field) => field.outcome)).toEqual([
      "unchanged-since-review",
      "conflict",
    ]);
    expect(
      actionableReconcileFields(result).map((field) => field.fieldFamily),
    ).toEqual(["birthday"]);
  });
});

describe("serializeMethodFamily", () => {
  const methods = [
    { type: "phone" as const, value: "312-555-1234", label: "Mobile" },
    { type: "email" as const, value: "orbit@example.com", label: "Personal" },
  ];

  it("is stable across ordering but detects source add/remove/relabel changes", () => {
    const serialized = serializeMethodFamily(methods);
    expect(serializeMethodFamily([...methods].reverse())).toBe(serialized);
    expect(
      serializeMethodFamily([
        ...methods,
        { type: "email", value: "new@example.com", label: null },
      ]),
    ).not.toBe(serialized);
    expect(serializeMethodFamily(methods.slice(1))).not.toBe(serialized);
    expect(
      serializeMethodFamily([{ ...methods[0], label: "Work" }, methods[1]]),
    ).not.toBe(serialized);
  });
});

describe("buildDesiredMethodList", () => {
  it("never drops seeded Orbit methods when accepting an addition", () => {
    const current = [
      { type: "phone" as const, value: "312-555-1234" },
      { type: "email" as const, value: "orbit@example.com" },
    ];
    const desired = buildDesiredMethodList(current, [
      { type: "email", value: "new@example.com" },
    ]);
    expect(desired).toEqual(expect.arrayContaining(current));
    expect(desired).toHaveLength(3);
  });
});

describe("readable Orbit methods (D-47)", () => {
  it("a phones diff lists Orbit's numbers one per method, with labels, never the joined serialization", () => {
    const diff = classifyReconciliation({
      orbit: orbit({
        methods: [
          { type: "phone", value: "(312) 555-0111", label: "Mobile" },
          { type: "phone", value: "(312) 555-0122", label: null },
          { type: "email", value: "a@example.com", label: "Work" },
        ],
      }),
      sources: [
        source({
          displayName: "Orbit Name",
          methods: [
            { type: "phone", value: "(312) 555-0133" },
            { type: "email", value: "b@example.com" },
          ],
        }),
      ],
      lastReviewed: {},
      effectivePhoneRegion: "US",
    });
    const phones = diff.fields.find((field) => field.fieldFamily === "phones");
    const emails = diff.fields.find((field) => field.fieldFamily === "emails");
    expect(phones?.orbitMethods).toEqual([
      { value: "(312) 555-0111", label: "Mobile" },
      { value: "(312) 555-0122", label: null },
    ]);
    expect(emails?.orbitMethods).toEqual([
      { value: "a@example.com", label: "Work" },
    ]);
    // The serialization stays for memory comparison only.
    expect(phones?.orbitBaseline).toContain("\u001f");
  });

  it("scalar fields carry no method list", () => {
    const diff = classifyReconciliation({
      orbit: orbit(),
      sources: [source()],
      lastReviewed: {},
    });
    expect(
      diff.fields.find((field) => field.fieldFamily === "name")?.orbitMethods,
    ).toBeUndefined();
  });
});
