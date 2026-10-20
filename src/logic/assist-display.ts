/**
 * Display copy for the "Did you send it?" banner and pending list (38.14).
 *
 *   - `assistDestinationLine` — "Text to 555-0101 · 2:14 PM": channel, where it
 *     went and when (D-74, D-79). The destination is the contact method's
 *     display value from the read (`endpoint_display`); it is shown on device
 *     only, never added to History and never transmitted (D-22).
 *   - `assistAnswerSnackbar` — the named confirmation after an answer (D-74),
 *     in the shared logging pattern "Logged <Channel> with <Name>" (D-39). Text
 *     and email log as Message (D-10, ADR-116) through the one vocabulary map.
 *
 * Pure and RN-free (node-testable). Times are compared as local wall-clock
 * strings — never through `toISOString` (CLAUDE.md Conventions).
 */
import { remapLegacyChannel } from "@/db/interaction-vocabulary";
import { loggedInteractionSnackbar } from "@/logic/also-save-to-logic";
import {
  formatDateTimeMinuteOrFallback,
  formatLocalDate,
  formatTimeMinuteOrFallback,
  parseLocalMs,
} from "@/utils/dates";

export type AssistTransportChannel = "call" | "text" | "email";

/** The channel noun on the destination line (D-74 "Text to 555-0101"). */
const CHANNEL_NOUN: Record<AssistTransportChannel, string> = {
  text: "Text",
  call: "Call",
  email: "Email",
};

/** "YYYY-MM-DD" of the local day before a stored local timestamp's day. */
function previousLocalDate(stored: string): string | null {
  try {
    const day = new Date(parseLocalMs(stored));
    return formatLocalDate(
      new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1),
    );
  } catch {
    return null;
  }
}

/**
 * The handoff time, day-aware: pending rows live up to 24 h (D-09), so a
 * handoff on the previous local day reads "Yesterday 2:14 PM", and anything
 * else not today reads with its full date.
 */
function handoffTime(handoffAt: string, now: string): string {
  const handoffDay = handoffAt.slice(0, 10);
  if (handoffDay === now.slice(0, 10)) {
    return formatTimeMinuteOrFallback(handoffAt);
  }
  if (handoffDay === previousLocalDate(now)) {
    return `Yesterday ${formatTimeMinuteOrFallback(handoffAt)}`;
  }
  return formatDateTimeMinuteOrFallback(handoffAt);
}

/**
 * "<Text|Call|Email> to <destination> · <time>"; " to …" is omitted when there
 * is no destination. Callers pass `localDateTime()` as `now`.
 */
export function assistDestinationLine(
  row: {
    channel: AssistTransportChannel;
    endpoint_display: string | null;
    handoff_at: string;
  },
  now: string,
): string {
  const destination = row.endpoint_display?.trim() ?? "";
  const where = destination === "" ? "" : ` to ${destination}`;
  return `${CHANNEL_NOUN[row.channel]}${where} · ${handoffTime(row.handoff_at, now)}`;
}

/** Which answer the snackbar confirms. */
export type AssistAnswer = "logged" | "no-answer" | "dismissed";

/**
 * The named confirmation after a "Did you send it?" answer (D-74, D-43):
 * "Logged Message with Maya", "Logged Call with Maya, no answer",
 * "Didn't log Message with Maya". The last two wordings are Claude's
 * Discretion within the glossary (CONTEXT).
 */
export function assistAnswerSnackbar(input: {
  channel: AssistTransportChannel;
  personName: string | null;
  answer: AssistAnswer;
}): string {
  const channel = remapLegacyChannel(input.channel);
  const logged = loggedInteractionSnackbar({
    channel,
    personName: input.personName,
    section: null,
  });
  switch (input.answer) {
    case "logged":
      return logged;
    case "no-answer":
      return `${logged}, no answer`;
    case "dismissed": {
      const whom = input.personName ? ` with ${input.personName}` : "";
      return `Didn't log ${channel}${whom}`;
    }
  }
}
