import { describe, expect, it } from "vitest";
import {
  addMethodDraft,
  canonicalDuplicateCopy,
  choosePrimary,
  collapseCanonicalDuplicate,
  discardBlankMethodDrafts,
  emptyMethodDraft,
  type MethodGroups,
  removeMethodDraft,
  resolveEffectivePhoneRegion,
  toMethodDrafts,
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
