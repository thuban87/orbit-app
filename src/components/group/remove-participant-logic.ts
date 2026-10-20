/**
 * Remove from event (38.14 D-70, D-27; enforces phase-11 :730).
 *
 * The owner's order puts the safe choice first: Keep as individual
 * interaction, then Delete interaction, then Cancel. Delete is irreversible,
 * so it runs only after the standard destructive confirm, and the confirm is
 * single-flight so a double tap cannot open two dialogs or delete twice.
 *
 * Pure: no React, no react-native, no store.
 */
import {
  beginInFlight,
  endInFlight,
  type InFlightRef,
} from "@/utils/single-flight";

export type RemoveParticipantChoiceKey = "keep" | "delete" | "cancel";

export interface RemoveParticipantChoice {
  readonly key: RemoveParticipantChoiceKey;
  readonly label: string;
  /** The Orbit Button role the sheet draws it with. */
  readonly role: "secondary" | "destructive" | "tertiary";
}

/** D-70: Keep, then Delete, then Cancel. */
export const REMOVE_PARTICIPANT_CHOICES: readonly RemoveParticipantChoice[] = [
  { key: "keep", label: "Keep as individual interaction", role: "secondary" },
  { key: "delete", label: "Delete interaction", role: "destructive" },
  { key: "cancel", label: "Cancel", role: "tertiary" },
];

/**
 * Ask first, then delete. `confirmFn` is the standard destructive confirm;
 * `onDelete` runs only when it resolves true. A call while one is in flight
 * returns "busy" without asking again. The latch is released in `finally`.
 */
export async function confirmThenDelete(
  latch: InFlightRef,
  confirmFn: () => Promise<boolean>,
  onDelete: () => void | Promise<void>,
): Promise<"deleted" | "cancelled" | "busy"> {
  if (!beginInFlight(latch)) return "busy";
  try {
    if (!(await confirmFn())) return "cancelled";
    await onDelete();
    return "deleted";
  } finally {
    endInFlight(latch);
  }
}
