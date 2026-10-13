/**
 * Where a linked entry opens (Phase 38.10 D-37, D-48; checker B5). Pure.
 *
 * The interaction detail is a sheet hosted in `HistorySection`, not a route,
 * so a linked entry opens one of three real routes that exist in every stack
 * (`src/navigation/types.ts`):
 * - a Group Note copy (`group_note`) → `GroupEventDetail`;
 * - a participant's own note in an event → `EditParticipant`;
 * - a standalone note → `EditInteraction`.
 * A link whose interaction no longer exists has no route (null).
 */

export type LinkedEntryLinkSource = "note" | "group_note";

export interface LinkedEntryRouteInput {
  interactionId: number;
  contactId: number;
  groupEventId: number | null;
  linkSource: LinkedEntryLinkSource;
}

export type LinkedEntryRoute =
  | { name: "GroupEventDetail"; params: { groupEventId: number } }
  | {
      name: "EditParticipant";
      params: {
        groupEventId: number;
        interactionId: number;
        contactId: number;
      };
    }
  | {
      name: "EditInteraction";
      params: { contactId: number; interactionId: number };
    };

export function linkedEntryRoute(
  ref: LinkedEntryRouteInput | null,
): LinkedEntryRoute | null {
  if (ref === null) return null;
  if (ref.groupEventId !== null) {
    if (ref.linkSource === "group_note") {
      return {
        name: "GroupEventDetail",
        params: { groupEventId: ref.groupEventId },
      };
    }
    return {
      name: "EditParticipant",
      params: {
        groupEventId: ref.groupEventId,
        interactionId: ref.interactionId,
        contactId: ref.contactId,
      },
    };
  }
  // A Group Note copy whose interaction left its event is unlinked by the
  // detach/dissolve paths; should one survive, its interaction is the target.
  return {
    name: "EditInteraction",
    params: { contactId: ref.contactId, interactionId: ref.interactionId },
  };
}
