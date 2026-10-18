import { describe, expect, it } from "vitest";
import { classifyReconciliation } from "@/logic/reconcile-diff";
import {
  buildReconcileSelections,
  defaultReconcileChoices,
  isReconcileChoiceUnresolved,
  remainingReconcileFields,
  toggleReconcileMethodChoice,
} from "@/logic/reconcile-selection";

function diff(birthday: string | null = "1990-01-01") {
  return classifyReconciliation({
    orbit: { name: "Orbit", birthday, photo: null, methods: [] },
    sources: [
      {
        externalContactLinkId: 1,
        displayName: "First",
        birthday: "1991-01-01",
        methods: [],
      },
      {
        externalContactLinkId: 2,
        displayName: "Second",
        birthday: "1992-01-01",
        methods: [],
      },
    ],
    lastReviewed: {},
  });
}

describe("buildReconcileSelections", () => {
  it("gives every source row a unique choice id and carries the chosen value", () => {
    const classified = diff();
    const birthday = classified.fields.find(
      (field) => field.fieldFamily === "birthday",
    )!;
    expect(
      new Set(birthday.sourceOptions.map((option) => option.optionId)).size,
    ).toBe(2);
    for (const option of birthday.sourceOptions) {
      const [selection] = buildReconcileSelections(classified, {
        birthday: `source:${option.optionId}`,
      });
      expect(selection.sourceValue).toBe(option.value);
      expect(selection.sourceOptionId).toBe(option.optionId);
      expect(selection.reviewedValue).toBe(birthday.reviewedComparable);
      expect(selection.sourceLinkIds).toEqual([1, 2]);
    }
    const [kept] = buildReconcileSelections(classified, { birthday: "orbit" });
    expect(kept.useSource).toBe(false);
    expect(kept.reviewedValue).toBe(birthday.reviewedComparable);
  });

  it("excludes ambiguous scalars from source bulk actions and leaves them for detail review", () => {
    for (const birthday of ["1990-01-01", null]) {
      const classified = diff(birthday);
      for (const mode of ["use-contact-values"] as const) {
        expect(
          buildReconcileSelections(classified, mode).some(
            (item) => item.fieldFamily === "birthday",
          ),
        ).toBe(false);
        expect(
          remainingReconcileFields(mode, classified, []),
        ).toBeGreaterThanOrEqual(1);
      }
      expect(
        buildReconcileSelections(classified, "keep-orbit").find(
          (item) => item.fieldFamily === "birthday",
        )?.reviewedValue,
      ).toBe(
        classified.fields.find((field) => field.fieldFamily === "birthday")
          ?.reviewedComparable,
      );
    }
  });

  it('a zero-option photo field remembers "" on every read link (convergence c4 E-4)', () => {
    const classified = classifyReconciliation({
      orbit: {
        name: "Orbit",
        birthday: null,
        photo: "contacts/1.jpg",
        methods: [],
      },
      sources: [
        {
          externalContactLinkId: 7,
          displayName: "Orbit",
          birthday: null,
          methods: [],
        },
        {
          externalContactLinkId: 8,
          displayName: "Orbit",
          birthday: null,
          methods: [],
        },
      ],
      lastReviewed: {},
    });
    const [photo] = buildReconcileSelections(classified, "keep-orbit").filter(
      (item) => item.fieldFamily === "photo",
    );
    expect(photo.sourceLinkIds).toEqual([7, 8]);
    expect(photo.reviewedValue).toBe("");
    expect(photo.useSource).toBe(false);
  });

  it("Use phone's photo carries the chosen option's own hash and staged copy (convergence c4 E-4)", () => {
    const classified = classifyReconciliation({
      orbit: {
        name: "Orbit",
        birthday: null,
        photo: "contacts/1.jpg",
        methods: [],
      },
      sources: [
        {
          externalContactLinkId: 1,
          displayName: "Orbit",
          birthday: null,
          methods: [],
          photoContentHash: "fp-a",
          stagedPhotoRelative: "reconcile-staging/a.jpg",
        },
        {
          externalContactLinkId: 2,
          displayName: "Orbit",
          birthday: null,
          methods: [],
          photoContentHash: "fp-b",
          stagedPhotoRelative: "reconcile-staging/b.jpg",
        },
      ],
      lastReviewed: {},
    });
    const field = classified.fields.find(
      (item) => item.fieldFamily === "photo",
    )!;
    const second = field.sourceOptions.find(
      (option) => option.value === "fp-b",
    )!;
    const [selection] = buildReconcileSelections(classified, {
      photo: `source:${second.optionId}`,
    });
    expect(selection.photoContentHash).toBe("fp-b");
    expect(selection.stagedPhotoRelative).toBe("reconcile-staging/b.jpg");
    expect(selection.reviewedValue).toBe(field.reviewedComparable);
    expect(selection.sourceLinkIds).toEqual([1, 2]);
  });
});

/** Three phone values, Orbit has none of them (additive) or one other (conflict). */
function phoneDiff(orbitPhones: string[] = []) {
  return classifyReconciliation({
    orbit: {
      name: "Orbit",
      birthday: null,
      photo: null,
      methods: orbitPhones.map((value) => ({ type: "phone" as const, value })),
    },
    sources: [
      {
        externalContactLinkId: 5,
        displayName: "Orbit",
        birthday: null,
        methods: [
          { type: "phone", value: "(312) 555-0144", typeCode: 2 },
          { type: "phone", value: "(312) 555-0122", typeCode: 3 },
          {
            type: "phone",
            value: "(312) 555-0133",
            typeCode: 0,
            customLabel: "Gym",
          },
        ],
      },
    ],
    lastReviewed: {},
    effectivePhoneRegion: "US",
  });
}

describe("phone picks (D-47, D-102; convergence c3 D-1, c4 E-5)", () => {
  const ids = (diff: ReturnType<typeof phoneDiff>) =>
    diff.fields
      .find((field) => field.fieldFamily === "phones")!
      .sourceOptions.map((option) => `source:${option.optionId}` as const);

  it("options keep the canonical key but carry the phone's own value and label", () => {
    const field = phoneDiff().fields.find((f) => f.fieldFamily === "phones")!;
    expect(
      field.sourceOptions.map(({ value, rawValue, label }) => ({
        value,
        rawValue,
        label,
      })),
    ).toEqual([
      { value: "+13125550122", rawValue: "(312) 555-0122", label: "Work" },
      { value: "+13125550133", rawValue: "(312) 555-0133", label: "Gym" },
      { value: "+13125550144", rawValue: "(312) 555-0144", label: "Mobile" },
    ]);
  });

  it("labels never enter review memory", () => {
    const labelled = phoneDiff().fields.find((f) => f.fieldFamily === "phones");
    const plain = classifyReconciliation({
      orbit: { name: "Orbit", birthday: null, photo: null, methods: [] },
      sources: [
        {
          externalContactLinkId: 5,
          displayName: "Orbit",
          birthday: null,
          methods: ["(312) 555-0144", "(312) 555-0122", "(312) 555-0133"].map(
            (value) => ({ type: "phone" as const, value }),
          ),
        },
      ],
      lastReviewed: {},
      effectivePhoneRegion: "US",
    }).fields.find((f) => f.fieldFamily === "phones");
    expect(labelled?.reviewedComparable).toBe(plain?.reviewedComparable);
  });

  it("a detail pick applies exactly the picks in display order and elects the first primary", () => {
    const diff = phoneDiff();
    const [first, , third] = ids(diff);
    const [selection] = buildReconcileSelections(
      diff,
      { phones: [third, first] },
      new Set(["phones"]),
    );
    expect(selection.useSource).toBe(true);
    expect(selection.electPrimary).toBe(true);
    expect(selection.sourceMethods).toEqual([
      { type: "phone", value: "(312) 555-0122", label: "Work" },
      { type: "phone", value: "(312) 555-0144", label: "Mobile" },
    ]);
    expect(selection.sourceOptionIds).toEqual([
      first.slice("source:".length),
      third.slice("source:".length),
    ]);
    // The whole source list is remembered, so untapped values are not re-asked.
    expect(selection.reviewedValue).toBe(
      diff.fields.find((f) => f.fieldFamily === "phones")?.reviewedComparable,
    );
  });

  it("untapped default picks are applied but elect nothing; only a tapped field elects (38.12 D-144)", () => {
    const diff = phoneDiff();
    const defaults = defaultReconcileChoices(diff);
    const [untapped] = buildReconcileSelections(diff, defaults);
    expect(untapped.useSource).toBe(true);
    expect(untapped.sourceMethods).toHaveLength(3);
    expect(untapped.electPrimary).toBeUndefined();
    // A tap on another field does not let this one elect.
    const [otherTapped] = buildReconcileSelections(
      diff,
      defaults,
      new Set(["emails"]),
    );
    expect(otherTapped.electPrimary).toBeUndefined();
    const [tapped] = buildReconcileSelections(
      diff,
      defaults,
      new Set(["phones"]),
    );
    expect(tapped.electPrimary).toBe(true);
  });

  it("bulk Use Contact Values adds every phone value, labelled, and elects nothing", () => {
    const [selection] = buildReconcileSelections(
      phoneDiff(),
      "use-contact-values",
      // Bulk never elects, whatever was tapped (D-102, D-144).
      new Set(["phones"]),
    );
    expect(selection.electPrimary).toBeUndefined();
    expect(selection.sourceMethods?.map((method) => method.label)).toEqual([
      "Work",
      "Gym",
      "Mobile",
    ]);
  });

  it("Keep Orbit adds nothing and remembers the source list", () => {
    const diff = phoneDiff(["+13125550199"]);
    const [selection] = buildReconcileSelections(diff, { phones: "orbit" });
    expect(selection.useSource).toBe(false);
    expect(selection.sourceMethods).toBeUndefined();
    expect(selection.reviewedValue).toBe(
      diff.fields.find((f) => f.fieldFamily === "phones")?.reviewedComparable,
    );
  });

  it("an emptied pick list never reaches Apply", () => {
    expect(buildReconcileSelections(phoneDiff(), { phones: [] })).toEqual([]);
    expect(isReconcileChoiceUnresolved([])).toBe(true);
    expect(isReconcileChoiceUnresolved(undefined)).toBe(true);
    expect(isReconcileChoiceUnresolved("orbit")).toBe(false);
  });

  it("defaults: additive phones → every value; conflict phones → nothing; additive name → first option", () => {
    const additive = phoneDiff();
    expect(defaultReconcileChoices(additive).phones).toEqual(ids(additive));
    expect(defaultReconcileChoices(additive).name).toBeUndefined();
    const conflict = phoneDiff(["+13125550199"]);
    expect(defaultReconcileChoices(conflict).phones).toBeUndefined();
    const named = classifyReconciliation({
      orbit: { name: "", birthday: null, photo: null, methods: [] },
      sources: [
        {
          externalContactLinkId: 1,
          displayName: "Phone Name",
          birthday: null,
          methods: [],
        },
      ],
      lastReviewed: {},
    });
    const nameField = named.fields.find((f) => f.fieldFamily === "name")!;
    expect(defaultReconcileChoices(named).name).toBe(
      `source:${nameField.sourceOptions[0].optionId}`,
    );
  });

  it("toggling: a source value toggles, Orbit clears the picks, the last untick falls back to Orbit", () => {
    const [a, b] = ids(phoneDiff());
    expect(toggleReconcileMethodChoice(undefined, a)).toEqual([a]);
    expect(toggleReconcileMethodChoice("orbit", a)).toEqual([a]);
    expect(toggleReconcileMethodChoice([a], b)).toEqual([a, b]);
    expect(toggleReconcileMethodChoice([a, b], a)).toEqual([b]);
    expect(toggleReconcileMethodChoice([a], a)).toBe("orbit");
    expect(toggleReconcileMethodChoice([a, b], "orbit")).toBe("orbit");
  });
});
