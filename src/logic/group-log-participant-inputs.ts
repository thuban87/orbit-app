import type { CreateGroupEventParticipant } from "@/db/group-events-dao";

/**
 * Build child inputs for the Group Event fan-out. The parent uid is deliberately
 * minted by the caller separately: every child interaction needs its own unique
 * durable uid.
 */
export function toGroupParticipantInputs(
  contactIds: readonly number[],
  mintUid: () => string,
): CreateGroupEventParticipant[] {
  return contactIds.map((contactId) => ({ contactId, uid: mintUid() }));
}
