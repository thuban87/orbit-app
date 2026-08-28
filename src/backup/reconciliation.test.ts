import { describe, expect, it } from "vitest";
import {
  ENTITY_POLICIES,
  reconcileEntity,
  referenceOrFallback,
  sameFileSurvivorUids,
} from "@/backup/reconciliation";
import {
  RESERVED_CATEGORY_UIDS,
  RESERVED_PROFILE_UID,
} from "@/db/migrations/007-tombstones";

const old = "2026-08-24 10:00:00";
const newer = "2026-08-24 10:00:01";
const row = (uid: string, modified_at = old, fields: Record<string, unknown> = {}) => ({
  uid,
  modified_at,
  ...fields,
});
const tombstone = (entity_uid: string, deleted_at = old) => ({ entity_uid, deleted_at });

describe("reconciliation", () => {
  it("uses one survivor rule: newer live rows restore, while equal timestamps and newer tombstones delete", () => {
    expect(sameFileSurvivorUids([row("contact", newer)], [tombstone("contact", old)])).toEqual(
      new Set(["contact"]),
    );
    expect(sameFileSurvivorUids([row("contact", old)], [tombstone("contact", old)])).toEqual(
      new Set(),
    );
    expect(sameFileSurvivorUids([row("contact", old)], [tombstone("contact", newer)])).toEqual(
      new Set(),
    );
  });

  it("keeps live-row and tombstone UID uniqueness domains independent", () => {
    expect(() => sameFileSurvivorUids([row("same"), row("same")], [])).toThrow(/duplicate live/i);
    expect(() => sameFileSurvivorUids([], [tombstone("same"), tombstone("same")])).toThrow(
      /duplicate tombstone/i,
    );
    expect(sameFileSurvivorUids([row("same", newer)], [tombstone("same", old)])).toEqual(
      new Set(["same"]),
    );
  });

  it("returns LWW actions, preserving null custom-value clears and omitting contacts.last_contact", () => {
    const result = reconcileEntity({
      entityType: "custom_field_values",
      localRows: [row("value", old, { contactUid: "contact", fieldDefUid: "field", value: "old" })],
      incomingRows: [row("value", newer, { contactUid: "contact", fieldDefUid: "field", value: null })],
      parentSurvivors: { contacts: new Set(["contact"]), custom_field_defs: new Set(["field"]) },
    });
    expect(result.actions).toEqual([
      expect.objectContaining({ kind: "update", uid: "value", row: expect.objectContaining({ value: null }) }),
    ]);
    expect(
      reconcileEntity({
        entityType: "contacts",
        localRows: [row("contact", old, { last_contact: "derived", name: "Local" })],
        incomingRows: [row("contact", newer, { last_contact: "must-not-merge", name: "Incoming" })],
      }).actions[0]?.row,
    ).not.toHaveProperty("last_contact");
  });

  it("blocks every mandatory contact child and both custom-field-value parents when a parent did not survive", () => {
    expect(
      reconcileEntity({
        entityType: "interactions",
        localRows: [row("local-interaction", old, { contactUid: "lost-contact" })],
        incomingRows: [],
        parentSurvivors: { contacts: new Set() },
      }).actions,
    ).toEqual([expect.objectContaining({ kind: "blocked", uid: "local-interaction" })]);
    for (const entityType of ["interactions", "events", "fuel", "contact_links", "contact_methods", "external_contact_links"] as const) {
      expect(
        reconcileEntity({
          entityType,
          localRows: [],
          incomingRows: [row(`${entityType}-1`, newer, { contactUid: "lost-contact" })],
          parentSurvivors: { contacts: new Set() },
        }).actions,
      ).toEqual([expect.objectContaining({ kind: "blocked" })]);
    }
    for (const fields of [
      { contactUid: "lost-contact", fieldDefUid: "field" },
      { contactUid: "contact", fieldDefUid: "lost-field" },
    ]) {
      expect(
        reconcileEntity({
          entityType: "custom_field_values",
          localRows: [],
          incomingRows: [row("value", newer, fields)],
          parentSurvivors: { contacts: new Set(["contact"]), custom_field_defs: new Set(["field"]) },
        }).actions,
      ).toEqual([expect.objectContaining({ kind: "blocked" })]);
    }
  });

  it("reports pair and col_name collisions as whole-restore incompatibilities with no colliding actions", () => {
    const values = reconcileEntity({
      entityType: "custom_field_values",
      localRows: [row("local-value", old, { contactUid: "contact", fieldDefUid: "field", value: null })],
      incomingRows: [row("incoming-value", newer, { contactUid: "contact", fieldDefUid: "field", value: "new" })],
      parentSurvivors: { contacts: new Set(["contact"]), custom_field_defs: new Set(["field"]) },
    });
    expect(values.incompatibilities).toEqual([
      expect.objectContaining({ kind: "pair-key-collision", localUid: "local-value", incomingUid: "incoming-value" }),
    ]);
    expect(values.actions).toEqual([]);

    const definitions = reconcileEntity({
      entityType: "custom_field_defs",
      localRows: [row("local-def", old, { col_name: "nickname" })],
      incomingRows: [row("incoming-def", newer, { col_name: "nickname" })],
    });
    expect(definitions.incompatibilities).toEqual([
      expect.objectContaining({ kind: "col-name-collision", localUid: "local-def", incomingUid: "incoming-def" }),
    ]);
    expect(definitions.actions).toEqual([]);
  });

  it("exposes every mergeable entity policy and fixed singleton seed identities", () => {
    expect(Object.keys(ENTITY_POLICIES).sort()).toEqual([
      "categories",
      "contact_links",
      "contact_method_provenance",
      "contact_methods",
      "contacts",
      "custom_field_defs",
      "custom_field_values",
      "events",
      "external_contact_links",
      "fuel",
      "interactions",
      "profile",
    ]);
    expect(ENTITY_POLICIES.profile.reservedUids).toEqual([RESERVED_PROFILE_UID]);
    expect(ENTITY_POLICIES.categories.reservedUids).toEqual(Object.values(RESERVED_CATEGORY_UIDS));
    expect(ENTITY_POLICIES.events.writeMode).toBe("insert-if-missing");
    const categoryRows = Object.values(RESERVED_CATEGORY_UIDS).map((uid) => row(uid, old));
    expect(
      reconcileEntity({
        entityType: "categories",
        localRows: categoryRows,
        incomingRows: categoryRows,
      }).actions.map((action) => action.kind),
    ).toEqual(["retain", "retain", "retain", "retain"]);
    expect(
      reconcileEntity({
        entityType: "profile",
        localRows: [row(RESERVED_PROFILE_UID, old)],
        incomingRows: [row(RESERVED_PROFILE_UID, old)],
      }).actions,
    ).toEqual([expect.objectContaining({ kind: "retain", uid: RESERVED_PROFILE_UID })]);
  });

  it("falls back from a reference to a parent that did not survive", () => {
    expect(referenceOrFallback("contact", new Set(["other"]), null)).toBeNull();
    expect(referenceOrFallback("category", new Set(["other"]), null)).toBeNull();
    expect(referenceOrFallback(null, new Set(["contact"]), "fallback")).toBeNull();
  });
});
