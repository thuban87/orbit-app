/**
 * Participant wording that names its fields (38.14 D-29; phase-12 :292, :296
 * "remain compact"). Pure: no React, no react-native.
 *
 * - `followLineLabel`: one line per event-owned field in the participant
 *   editor ("Channel: same as event" / "Tone: changed for this person").
 * - `participantChangeSummary`: the ParticipantCard caption, naming what is
 *   changed for that person, or "Same as event" when nothing is.
 */
import type { GroupInheritanceDisplay } from "@/logic/group-inheritance";

export function followLineLabel(label: string, following: boolean): string {
  return following
    ? `${label}: same as event`
    : `${label}: changed for this person`;
}

export function participantChangeSummary(
  display: Pick<GroupInheritanceDisplay, "channel" | "quality" | "duration">,
): string {
  const changed = [display.channel, display.quality, display.duration]
    .filter((field) => !field.following)
    .map((field) => field.label);
  return changed.length === 0
    ? "Same as event"
    : `Changed for this person: ${changed.join(", ")}`;
}
