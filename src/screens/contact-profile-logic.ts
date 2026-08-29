import type { ContactMethodRow } from "@/db/contact-methods-dao";
import type { ContactMethodGroups } from "@/db/contact-methods-read";

export type ProfileMethodType = "phone" | "email";

export interface ProfileMethodRow {
  id: number;
  label: string;
  displayValue: string;
  extension: string | null;
  isPrimary: boolean;
  helper: string | null;
  accessibilityLabel: string;
}

export interface ProfileMethodGroup {
  type: ProfileMethodType;
  title: string;
  rows: ProfileMethodRow[];
}

export type ProfileLifecycleKind =
  | "bound"
  | "unbound-dormant"
  | "unbound-never-assigned";

export interface ProfileLifecycleView {
  kind: ProfileLifecycleKind;
  showCadenceTreatment: boolean;
  showFrequencyPicker: boolean;
  bindEnabled: boolean;
}

/**
 * Lifecycle-only presentation state. Cadence stays durable data; this model
 * decides only which participation controls may be rendered around it.
 */
export function profileLifecycleView(input: {
  trackingEnabled: number;
  intervalDays: number | null;
}): ProfileLifecycleView {
  if (input.trackingEnabled === 1) {
    return {
      kind: "bound",
      showCadenceTreatment: true,
      showFrequencyPicker: false,
      bindEnabled: false,
    };
  }
  if (input.intervalDays !== null) {
    return {
      kind: "unbound-dormant",
      showCadenceTreatment: false,
      showFrequencyPicker: false,
      bindEnabled: true,
    };
  }
  return {
    kind: "unbound-never-assigned",
    showCadenceTreatment: false,
    showFrequencyPicker: true,
    bindEnabled: false,
  };
}

const typePresentation: Record<ProfileMethodType, string> = {
  phone: "Phone number",
  email: "Email address",
};

const typeTitle: Record<ProfileMethodType, string> = {
  phone: "Phone numbers",
  email: "Email addresses",
};

const invalidMethodHelper: Record<ProfileMethodType, string> = {
  phone: "This number can’t be used for calls or messages yet.",
  email: "This email address can’t be used yet.",
};

function profileMethodRow(row: ContactMethodRow): ProfileMethodRow {
  const type = row.method_type;
  const label = row.label ?? typePresentation[type];
  const extension = type === "phone" ? row.extension : null;
  const helper = row.is_actionable === 1 ? null : invalidMethodHelper[type];
  const details = [label, row.display_value];
  if (extension) details.push(`extension ${extension}`);
  if (row.is_primary === 1) details.push("Primary");
  const accessibilityLabel = helper
    ? `${details.join(", ")}. ${helper}`
    : details.join(", ");

  return {
    id: row.id,
    label,
    displayValue: row.display_value,
    extension,
    isPrimary: row.is_primary === 1,
    helper,
    accessibilityLabel,
  };
}

/**
 * Shape the stored method read for Profile presentation only. This deliberately
 * uses the DAO-provided formatted display and actionability state: it does not
 * parse raw values or reinterpret phone regions in the UI.
 */
export function profileMethodGroups(
  groups: ContactMethodGroups,
): ProfileMethodGroup[] {
  return (["phone", "email"] as const).flatMap((type) => {
    const rows = groups[type];
    return rows.length === 0
      ? []
      : [{ type, title: typeTitle[type], rows: rows.map(profileMethodRow) }];
  });
}
