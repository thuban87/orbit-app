import { formatDurationLabel } from "@/components/touchpoint-refine-logic";
import type {
  GroupEventDetail,
  GroupEventParticipant,
} from "@/db/group-events-read";

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
  };
}
