/**
 * Update Contact chooser — pure, React-Native-free row assembly and session
 * model (CAPT-12, dossier §Y/§Z/§AA).
 *
 * This module owns two responsibilities the screen must NOT re-implement inline:
 *
 *   1. Row assembly + applicability filtering. The chooser is driven by the
 *      semantic Contact Knowledge registry (dossier §Y [DERIVED]), NOT by
 *      hardcoding storage tables into navigation. Built-in rows always render in
 *      a fixed order; applicable named custom fields surface directly by their
 *      user-facing label (dossier §Z); a generic "Custom Fields" row is always
 *      present for less-prominent/one-off fields. Category is NEVER a row — it
 *      stays in Edit Contact (dossier §X/§Y).
 *
 *   2. The repeated-update session (dossier §AA). Saving one item does not exit
 *      the route: after a successful focused edit the session returns to the
 *      chooser with the SAME contact targeted and a subtle recent-success cue;
 *      the user exits only via Done. Each inner save persists independently — the
 *      session is a selector over UI position, never one giant transaction.
 *
 * Kept dependency-light on purpose (only a type + registry constants) so the row
 * model and session transitions are node-testable without a renderer or DB.
 */
import type { CustomFieldDef } from "@/db/field-types";
import {
  CURRENT_STATE_FIELD_REGISTRY,
  PROVISIONAL_MEMORY_LABEL,
  RELATIONSHIPS_GROUP,
} from "@/db/memory-registry";

/** The semantic family a chooser row edits. Category is deliberately absent. */
export type ChooserRowKind =
  | "last_talked_about"
  | "key_people"
  | "current_location"
  | "memory"
  | "off_limits"
  | "contact_method"
  | "contact_frequency"
  | "custom_field"
  | "custom_fields";

export interface ChooserRow {
  /** Stable identity across re-entry within a session. */
  key: string;
  kind: ChooserRowKind;
  /** User-facing row label (registry display name / canonical field label). */
  label: string;
  /** Present only for a `custom_field` row — the canonical definition it edits. */
  fieldDefId?: number;
  colName?: string;
  fieldType?: CustomFieldDef["type"];
}

/** The minimal contact identity the row model needs; screens pass more. */
export interface ChooserContact {
  id: number;
}

/** Labels for the three built-in rows without a Contact Knowledge registry entry. */
export const OFF_LIMITS_LABEL = "Off Limits";
export const CONTACT_METHOD_LABEL = "Contact Method";
export const CONTACT_FREQUENCY_LABEL = "Contact Frequency";
/** The always-present generic entry for less-prominent / one-off fields (§Z). */
export const GENERIC_CUSTOM_FIELDS_LABEL = "Custom Fields";

/**
 * The fixed built-in chooser rows, in their canonical order (dossier §Y). The
 * two current-state rows, Key People, and Memory draw their labels from the
 * shared registry so the chooser cannot drift from the knowledge model; the
 * three first-class rows use the labels above. Category is intentionally omitted.
 */
export function buildBuiltInRows(): ChooserRow[] {
  return [
    {
      key: "last_talked_about",
      kind: "last_talked_about",
      label: CURRENT_STATE_FIELD_REGISTRY.last_talked_about.displayName,
    },
    {
      key: "key_people",
      kind: "key_people",
      label: RELATIONSHIPS_GROUP.displayName,
    },
    {
      key: "current_location",
      kind: "current_location",
      label: CURRENT_STATE_FIELD_REGISTRY.current_location.displayName,
    },
    { key: "memory", kind: "memory", label: PROVISIONAL_MEMORY_LABEL },
    { key: "off_limits", kind: "off_limits", label: OFF_LIMITS_LABEL },
    {
      key: "contact_method",
      kind: "contact_method",
      label: CONTACT_METHOD_LABEL,
    },
    {
      key: "contact_frequency",
      kind: "contact_frequency",
      label: CONTACT_FREQUENCY_LABEL,
    },
  ];
}

/**
 * Filter the contact's custom-field definitions to those APPLICABLE for direct
 * surfacing in the chooser (dossier §Z): a live (non-quarantined) definition
 * that either always shows or already holds a value for this contact. This is a
 * discoverability presentation over the canonical definitions — it never creates
 * a duplicate field or a separate schema. Ordered by `display_order` so the row
 * order is deterministic and stable across re-entry.
 */
export function selectApplicableDefs(
  defs: CustomFieldDef[],
  values: Record<string, string | null>,
): CustomFieldDef[] {
  return [...defs]
    .filter(
      (def) =>
        def.quarantined_at === null &&
        (def.always_show === 1 || values[def.col_name] != null),
    )
    .sort((a, b) => a.display_order - b.display_order);
}

/**
 * Assemble the full chooser: fixed built-ins, then the applicable named custom
 * fields (already filtered + ordered by `selectApplicableDefs`), then the
 * always-present generic Custom Fields row. The result is never empty (built-ins
 * always render) and never contains Category.
 */
export function buildChooserRows(
  _contact: ChooserContact,
  applicableDefs: CustomFieldDef[],
): ChooserRow[] {
  const customRows: ChooserRow[] = applicableDefs.map((def) => ({
    key: `custom_field:${def.id}`,
    kind: "custom_field",
    label: def.label,
    fieldDefId: def.id,
    colName: def.col_name,
    fieldType: def.type,
  }));
  return [
    ...buildBuiltInRows(),
    ...customRows,
    {
      key: "custom_fields",
      kind: "custom_fields",
      label: GENERIC_CUSTOM_FIELDS_LABEL,
    },
  ];
}

/**
 * The repeated-update session position (dossier §AA). `activeRowKey === null`
 * means the chooser is showing; a non-null value means a focused editor is open.
 * `lastSavedRowKey` drives the subtle recent-success cue after a save. `done`
 * marks the explicit Done exit. The contact stays targeted across saves.
 */
export interface ChooserSession {
  contactId: number | null;
  activeRowKey: string | null;
  lastSavedRowKey: string | null;
  done: boolean;
}

/** Begin a session, optionally pre-targeting a contact (CAPT-13 preselection). */
export function startSession(contactId: number | null): ChooserSession {
  return {
    contactId,
    activeRowKey: null,
    lastSavedRowKey: null,
    done: false,
  };
}

/** Resolve the target contact once the untargeted picker returns one. */
export function targetContact(
  session: ChooserSession,
  contactId: number,
): ChooserSession {
  return { ...session, contactId };
}

/** Open a focused editor for one row (leaves the chooser). */
export function openRow(
  session: ChooserSession,
  rowKey: string,
): ChooserSession {
  return { ...session, activeRowKey: rowKey };
}

/**
 * A successful inner save: return to the chooser with the same contact targeted
 * and remember which row just succeeded (recent-success cue). The session does
 * NOT exit — the user keeps updating until Done (dossier §AA).
 */
export function completeSave(session: ChooserSession): ChooserSession {
  return {
    ...session,
    lastSavedRowKey: session.activeRowKey,
    activeRowKey: null,
  };
}

/** Abandon the open editor without recording a save (failure-safe / cancel). */
export function cancelRow(session: ChooserSession): ChooserSession {
  return { ...session, activeRowKey: null };
}

/** The explicit Done exit ends the session. */
export function finishSession(session: ChooserSession): ChooserSession {
  return { ...session, done: true };
}

/** The chooser row list is showing (contact targeted, no editor open, not done). */
export function isChooserVisible(session: ChooserSession): boolean {
  return (
    session.contactId !== null && session.activeRowKey === null && !session.done
  );
}
