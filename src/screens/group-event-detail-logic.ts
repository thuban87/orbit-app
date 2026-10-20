import { formatDurationLabel } from "@/components/touchpoint-refine-logic";
import type {
  GroupEventDetail,
  GroupEventParticipant,
} from "@/db/group-events-read";

interface ParticipantProfileCommand {
  close: () => void;
  navigate: (route: "Profile", params: { contactId: number }) => void;
  contactId: number;
}

/** Close the modal surface before pushing Profile onto the current Events stack. */
export function closeThenOpenParticipantProfile({
  close,
  navigate,
  contactId,
}: ParticipantProfileCommand): void {
  close();
  navigate("Profile", { contactId });
}

interface ParticipantEditorCommand {
  close: () => void;
  navigate: (
    route: "EditParticipant",
    params: { groupEventId: number; interactionId: number; contactId: number },
  ) => void;
  groupEventId: number;
  interactionId: number;
  contactId: number;
}

/**
 * Close the modal interaction sheet before pushing Edit participant (38.14
 * review B-CR-01): the sheet is an RN `Modal`, so a push under it stays hidden
 * until the sheet is dismissed. The target ids are taken as arguments, so the
 * caller captures them before `close()` clears the sheet's participant.
 */
export function closeThenOpenParticipantEditor({
  close,
  navigate,
  groupEventId,
  interactionId,
  contactId,
}: ParticipantEditorCommand): void {
  close();
  navigate("EditParticipant", { groupEventId, interactionId, contactId });
}

interface EventEditorCommand {
  close: () => void;
  navigate: (route: "EditGroupEvent", params: { groupEventId: number }) => void;
  groupEventId: number;
}

/** Close the modal interaction sheet before pushing Edit Event (B-CR-01). */
export function closeThenOpenEventEditor({
  close,
  navigate,
  groupEventId,
}: EventEditorCommand): void {
  close();
  navigate("EditGroupEvent", { groupEventId });
}

/** The existing duration vocabulary, applied to stored whole seconds. */
export function groupEventDurationLabel(
  duration: number | null,
): string | null {
  return duration == null ? null : formatDurationLabel(duration);
}

/** Project the parent and its canonical child into the existing Detail shape. */
export function buildGroupEventDetailInteraction(
  event: GroupEventDetail,
  participant: GroupEventParticipant,
) {
  return {
    id: participant.interactionId,
    occurredAt: event.occurredAt,
    date: event.occurredAt.slice(0, 10),
    channel: participant.channel,
    direction: participant.direction,
    connected: participant.connected,
    quality: participant.quality,
    note: participant.note,
    duration: participant.duration,
    allowAi: participant.allowAi,
    groupEventId: event.id,
    groupTitle: event.title,
    groupNote: event.groupNote,
    groupLinked: true as const,
    // HistoryInteractionRecord field; the event detail shows no section tags.
    linkedSections: [],
  };
}

/**
 * The event-detail interaction sheet's participant, re-derived from the
 * refreshed event on every render (38.14 D-28): an edit shows at once, and a
 * participant who left the event, or whose remove committed this session, is
 * gone (null), so the sheet closes instead of acting on a stale snapshot.
 */
export function resolveDetailParticipant(
  event: GroupEventDetail | null,
  committedRemovedIds: readonly number[],
  interactionId: number | null,
): GroupEventParticipant | null {
  if (event === null || interactionId === null) return null;
  if (committedRemovedIds.includes(interactionId)) return null;
  return (
    event.participants.find(
      (participant) => participant.interactionId === interactionId,
    ) ?? null
  );
}
