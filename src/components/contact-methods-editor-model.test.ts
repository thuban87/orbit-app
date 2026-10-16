import { describe, expect, it } from "vitest";
import {
  addMethodDraft,
  canonicalDuplicateCopy,
  choosePrimary,
  collapseCanonicalDuplicate,
  discardBlankMethodDrafts,
  emptyMethodDraft,
  METHOD_LABELS,
  type MethodGroups,
  methodLabelChoice,
  nextMethodLabel,
  removeMethodDraft,
  resolveEffectivePhoneRegion,
  toMethodDrafts,
  updateMethodDraft,
} from "./contact-methods-editor-model";

function groups(): MethodGroups {
  return {
    phone: [
      {
        uid: "p1",
        type: "phone",
        value: "555 1000",
        extension: "12",
        label: "Mobile",
        isPrimary: true,
      },
      {
        uid: "p2",
        type: "phone",
        value: "555 2000",
        extension: "",
        label: "Work",
      },
    ],
    email: [
      {
        uid: "e1",
        type: "email",
        value: "a@example.com",
        extension: "",
        label: "Home",
      },
    ],
  };
}

describe("contact method editor model", () => {
  it("discards blank rows but preserves nonblank invalid drafts for the aggregate write", () => {
    const drafts = [
      emptyMethodDraft("phone", "blank"),
      { ...emptyMethodDraft("phone", "invalid"), value: "not a number" },
    ];
    expect(discardBlankMethodDrafts(drafts).map((row) => row.uid)).toEqual([
      "invalid",
    ]);
    expect(toMethodDrafts({ phone: drafts, email: [] })).toEqual([
      {
        uid: "invalid",
        type: "phone",
        value: "not a number",
        extension: undefined,
        label: "Main",
        isPrimary: undefined,
      },
    ]);
  });

  it("keeps stable order, extension and labels while adding or promoting primaries", () => {
    const initial = groups();
    const expanded = addMethodDraft(initial, "email", "e2");
    expect(expanded.email.map((row) => row.uid)).toEqual(["e1", "e2"]);
    expect(toMethodDrafts(initial)[0]).toMatchObject({
      uid: "p1",
      extension: "12",
      isPrimary: true,
    });
    expect(
      choosePrimary(initial, "p2").phone.map((row) => row.isPrimary),
    ).toEqual([false, true]);
    expect(removeMethodDraft(initial, "p1").phone).toMatchObject([
      { uid: "p2", isPrimary: true },
    ]);
  });

  it("uses a saved override before the device fallback without rewriting existing draft identity", () => {
    expect(resolveEffectivePhoneRegion("GB", "US")).toBe("GB");
    expect(resolveEffectivePhoneRegion(null, "US")).toBe("US");
    const before = groups().phone[0]?.uid;
    resolveEffectivePhoneRegion("CA", "US");
    expect(groups().phone[0]?.uid).toBe(before);
  });

  it("uses the exact same-contact collision helper copy", () => {
    expect(canonicalDuplicateCopy("phone")).toBe(
      "This matches an existing phone number; only one will be kept.",
    );
    expect(canonicalDuplicateCopy("email")).toBe(
      "This matches an existing email address; only one will be kept.",
    );
  });

  it("collapses only the DAO-reported same-contact duplicate and leaves cross-contact drafts alone", () => {
    const withDuplicate: MethodGroups = {
      phone: [
        {
          uid: "p1",
          type: "phone",
          value: "555",
          extension: "",
          label: "Main",
          isPrimary: true,
        },
        {
          uid: "p2",
          type: "phone",
          value: "555",
          extension: "",
          label: "Work",
        },
      ],
      email: [],
    };
    expect(
      collapseCanonicalDuplicate(withDuplicate, "phone", "p1").phone.map(
        (row) => row.uid,
      ),
    ).toEqual(["p1"]);
    expect(
      collapseCanonicalDuplicate(withDuplicate, "phone", "missing"),
    ).toEqual(withDuplicate);
  });
});

describe("method label option sheet rule (38.9 D-28)", () => {
  it("shows a custom or empty label as Other", () => {
    expect(methodLabelChoice("Mobile")).toBe("Mobile");
    expect(methodLabelChoice("Pager")).toBe("Other");
    expect(methodLabelChoice("")).toBe("Other");
    expect(methodLabelChoice(null)).toBe("Other");
    expect(METHOD_LABELS).toEqual(["Mobile", "Home", "Work", "Main", "Other"]);
  });

  it("never clears a typed custom label when Other is picked again", () => {
    expect(nextMethodLabel("Pager", "Other")).toBeNull();
    expect(nextMethodLabel("", "Other")).toBeNull();
    expect(nextMethodLabel("Work", "Work")).toBeNull();
  });

  it("stores the picked standard label, and an empty label for Other", () => {
    expect(nextMethodLabel("Pager", "Home")).toBe("Home");
    expect(nextMethodLabel("Mobile", "Other")).toBe("");
  });
});

describe("updateMethodDraft recomputes the live warning (38.11 D-30; warn only, D-17)", () => {
  const phone = (g: MethodGroups, uid: string) =>
    [...g.phone, ...g.email].find((row) => row.uid === uid);

  it("typing an unusable phone number marks the row not actionable", () => {
    const next = updateMethodDraft(groups(), "p1", { value: "12" }, "US");
    expect(phone(next, "p1")?.isActionable).toBe(false);
  });

  it("a valid E.164 number is actionable", () => {
    const next = updateMethodDraft(
      groups(),
      "p1",
      { value: "+1 415 555 2671" },
      "US",
    );
    expect(phone(next, "p1")?.isActionable).toBe(true);
  });

  it("a national number uses the effective region", () => {
    const next = updateMethodDraft(
      groups(),
      "p2",
      { value: "(415) 555-2671" },
      "US",
    );
    expect(phone(next, "p2")?.isActionable).toBe(true);
    const noRegion = updateMethodDraft(
      groups(),
      "p2",
      { value: "(415) 555-2671" },
      null,
    );
    expect(phone(noRegion, "p2")?.isActionable).toBe(false);
  });

  it("clearing the value removes the warning (undefined, not false)", () => {
    const typed = updateMethodDraft(groups(), "p1", { value: "12" }, "US");
    const cleared = updateMethodDraft(typed, "p1", { value: "   " }, "US");
    expect(phone(cleared, "p1")?.isActionable).toBeUndefined();
  });

  it("an email row recomputes too", () => {
    const bad = updateMethodDraft(groups(), "e1", { value: "nope@" }, "US");
    expect(phone(bad, "e1")?.isActionable).toBe(false);
    const good = updateMethodDraft(bad, "e1", { value: "b@example.org" }, "US");
    expect(phone(good, "e1")?.isActionable).toBe(true);
  });

  it("a patch without a value (label, extension) leaves the warning as it was", () => {
    const typed = updateMethodDraft(groups(), "p1", { value: "12" }, "US");
    const relabelled = updateMethodDraft(typed, "p1", { label: "Home" }, "US");
    expect(phone(relabelled, "p1")?.isActionable).toBe(false);
  });

  it("without a region argument the row keeps its stored warning (other hosts unchanged)", () => {
    const seeded: MethodGroups = {
      phone: [{ ...groups().phone[0], isActionable: true }],
      email: [],
    };
    const next = updateMethodDraft(seeded, "p1", { value: "12" });
    expect(phone(next, "p1")?.isActionable).toBe(true);
  });

  it("never blocks the save path: an unusable draft still reaches the DAO input", () => {
    const typed = updateMethodDraft(groups(), "p1", { value: "12" }, "US");
    expect(toMethodDrafts(typed).map((draft) => draft.value)).toContain("12");
  });
});
