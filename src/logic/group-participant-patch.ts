/**
 * Pure participant-editor patch builders shared by both Group Event
 * participant editors (EditParticipantScreen and the inline editor in
 * EditGroupEventScreen), so the two can never disagree about what a draft
 * means (RG-019, reliability-testing/AUD-REL-006).
 *
 * ADR-125 rule: follow state changes ONLY through the editor's explicit
 * actions — a value edit detaches a field, "Follow event" re-attaches it.
 * These builders never infer follow from value equality: an explicit override
 * whose value equals the parent event's value stays detached
 * (`{ follow: false, value }`), and `{ follow: true }` is emitted only when the
 * draft itself says the field follows.
 *
 * Per inheritable field an op is emitted when the follow flag changed, OR when
 * both the initial and draft states are overridden and the value differs (the
 * false → false edit the previous follow-changed-only builders dropped).
 * Unchanged fields emit nothing, so an untouched draft yields empty patches
 * and `saveParticipantEdits` keeps its empty-patch no-op.
 *
 * Deliberately free of runtime imports: `ParticipantEditDraft` satisfies the
 * local structural `ParticipantPatchDraft` type.
 */

export type ParticipantInheritableField = "channel" | "quality" | "duration";

export interface ParticipantPatchDraft {
  value: {
    channel: string;
    quality: string | null;
    duration: number | null;
    direction: string | null;
    connected: number;
    note: string | null;
  };
  follow: {
    channel: boolean;
    quality: boolean;
    duration: boolean;
  };
}

export type ParticipantFollowOp =
  | { follow: true }
  | { follow: false; value: string | number | null };

export type ParticipantFollowPatch = Partial<
  Record<ParticipantInheritableField, ParticipantFollowOp>
>;

export interface ParticipantFieldPatch {
  direction?: string | null;
  connected?: number;
  note?: string | null;
}

const INHERITABLE_FIELDS: readonly ParticipantInheritableField[] = [
  "channel",
  "quality",
  "duration",
];

/** Build the follow/override ops for Channel, Tone (`quality`) and Duration. */
export function buildParticipantFollowPatch(
  initial: ParticipantPatchDraft,
  draft: ParticipantPatchDraft,
): ParticipantFollowPatch {
  const patch: ParticipantFollowPatch = {};
  for (const field of INHERITABLE_FIELDS) {
    const followChanged = draft.follow[field] !== initial.follow[field];
    const overrideValueChanged =
      !initial.follow[field] &&
      !draft.follow[field] &&
      draft.value[field] !== initial.value[field];
    if (!followChanged && !overrideValueChanged) continue;
    patch[field] = draft.follow[field]
      ? { follow: true }
      : { follow: false, value: draft.value[field] };
  }
  return patch;
}

/** Build the changed subset of the participant-owned Direction/Connected/note. */
export function buildParticipantFieldPatch(
  initial: ParticipantPatchDraft,
  draft: ParticipantPatchDraft,
): ParticipantFieldPatch {
  const patch: ParticipantFieldPatch = {};
  if (draft.value.direction !== initial.value.direction) {
    patch.direction = draft.value.direction;
  }
  if (draft.value.connected !== initial.value.connected) {
    patch.connected = draft.value.connected;
  }
  if (draft.value.note !== initial.value.note) {
    patch.note = draft.value.note;
  }
  return patch;
}
