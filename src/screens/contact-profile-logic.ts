import type { ContactMethodRow } from "@/db/contact-methods-dao";
import type { ContactMethodGroups } from "@/db/contact-methods-read";
import type { ProfileCollapseMap } from "@/profile/persisted-contract";

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

export type ProfileOverlay =
  | "overflow"
  | "snooze"
  | "layout"
  | "templates"
  | "background"
  | null;

export type ProfileOverflowEntry =
  | "edit"
  | "snooze"
  | "unsnooze"
  | "archive"
  | "separator"
  | "layout"
  | "background"
  | "save-layout-template"
  | "reset";

/** One compact Profile app-bar row and the shared minimum icon target. */
export const PROFILE_APP_BAR = Object.freeze({ height: 56, touchTarget: 44 });

/** The screen presents exactly one modal surface, so Back never leaks to its underlay. */
export function closeTopmostProfileOverlay(_overlay: ProfileOverlay): null {
  return null;
}

/** Keep the product-mandated overflow order independent from view rendering. */
export function profileOverflowEntries(input: {
  snoozed: boolean;
  hasFreeformLayout: boolean;
  hasContactPresentationOverride: boolean;
}): ProfileOverflowEntry[] {
  return [
    "edit",
    input.snoozed ? "unsnooze" : "snooze",
    "archive",
    "separator",
    "layout",
    "background",
    ...(input.hasFreeformLayout ? (["save-layout-template"] as const) : []),
    ...(input.hasContactPresentationOverride ? (["reset"] as const) : []),
  ];
}

export type ProfileOrigin =
  | "dashboard"
  | "orrery"
  | "settings"
  | "widget"
  | "notification";

/**
 * All origins retain the stack's own Back semantics. Widget and notification
 * reset construction happens at the linking/notification boundary, not here.
 */
export function profileOriginIntent(
  origin: ProfileOrigin,
  contactId: number,
  openReachOut?: boolean,
): {
  origin: ProfileOrigin;
  route: { contactId: number; openReachOut?: boolean };
  back: "native-go-back";
} {
  return {
    origin,
    route: openReachOut ? { contactId, openReachOut: true } : { contactId },
    back: "native-go-back",
  };
}

/**
 * Consume the widget-only Reach out intent exactly once. A methodless contact
 * still clears the flag so returning to Profile cannot replay stale intent.
 */
export function consumeProfileReachOutIntent(input: {
  openReachOut?: boolean;
  hasReachRoute: boolean;
}): { clear: boolean; open: boolean } {
  const clear = input.openReachOut === true;
  return { clear, open: clear && input.hasReachRoute };
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

export function unbindConfirmation(name: string): {
  title: string;
  message: string;
} {
  return {
    title: `Unbind ${name}?`,
    message:
      "This removes them from your active orbit, reminders, favourites, and widgets. Their history, details, and saved cadence stay.",
  };
}

export function canStartLifecycleTransition(input: {
  pending: boolean;
  bindEnabled: boolean;
}): boolean {
  return !input.pending && input.bindEnabled;
}

/**
 * Persist-first collapse publication: the screen changes only after a durable
 * readback confirms the value, and retains the prior state on any failure.
 */
export async function commitProfileOverviewToggle(input: {
  currentExpanded: boolean;
  write: (expanded: boolean) => Promise<void>;
  read: () => Promise<ProfileCollapseMap>;
  publish: (expanded: boolean) => void;
}): Promise<{ ok: boolean; expanded: boolean }> {
  try {
    await input.write(!input.currentExpanded);
    const persisted = await input.read();
    const expanded =
      persisted["relationship-overview"] ?? input.currentExpanded;
    input.publish(expanded);
    return { ok: true, expanded };
  } catch {
    return { ok: false, expanded: input.currentExpanded };
  }
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
