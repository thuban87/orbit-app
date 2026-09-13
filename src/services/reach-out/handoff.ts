import * as SMS from "expo-sms";
import { Alert, Linking } from "react-native";
import {
  createPendingAssist,
  type InteractionAssistChannel,
  markAssistFailed,
} from "@/db/interaction-assist-dao";
import type { SqlExecutor } from "@/db/types";

type ReachOutInput = {
  contactId: number;
  channel: InteractionAssistChannel;
  endpoint: string;
  assistEnabled: boolean;
  now: string;
  messageBody?: string;
  /**
   * Optional email Subject. Carried into the `mailto` query string (encoded) for
   * the email arm ONLY; ignored by the text/call arms. Empty → the `subject`
   * query param is omitted entirely.
   */
  subject?: string;
};

/**
 * Percent-encode a `mailto` recipient so the address itself can never open or
 * pollute the query string. `EMAIL_RE` admits `?`, `&`, and `#` in the local
 * part, so a stored/imported address like `bob?subject=x@example.com` would
 * otherwise inject a `subject=` param and override the composed Subject (WR-01).
 * The single `@` separating local part from domain is preserved (both sides are
 * encoded independently); EMAIL_RE guarantees exactly one `@`, and lastIndexOf
 * is defensive for anything that slipped past it. Encoding — rather than
 * rejecting — keeps a malformed address a working (if literal) recipient instead
 * of a silent no-op.
 */
function encodeMailtoRecipient(endpoint: string): string {
  const at = endpoint.lastIndexOf("@");
  if (at === -1) return encodeURIComponent(endpoint);
  return `${encodeURIComponent(endpoint.slice(0, at))}@${encodeURIComponent(
    endpoint.slice(at + 1),
  )}`;
}

/**
 * Build the email handoff URL, carrying the composed Subject + Body through an
 * encoded `mailto` query string. The recipient, subject, and body are ALL
 * `encodeURIComponent`-escaped (the recipient via `encodeMailtoRecipient`, which
 * preserves its single `@`) so `?`, `&`, `#`, newlines, and other reserved
 * characters in ANY of the three can never break out of the query string or
 * inject extra params (T-35-04, WR-01). Empty params are omitted so a bare
 * recipient stays `mailto:<encoded-endpoint>`. No-dependency path: mailto via
 * `Linking.openURL`, never a native mail-composer package (that richer composer
 * stays a deferred owner opt-in; none is installed here).
 */
function buildMailtoUrl(endpoint: string, subject: string, body: string): string {
  const params: string[] = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  const query = params.length > 0 ? `?${params.join("&")}` : "";
  return `mailto:${encodeMailtoRecipient(endpoint)}${query}`;
}

const HANDOFF_ERROR_COPY: Record<
  InteractionAssistChannel,
  readonly [title: string, message: string]
> = {
  call: ["Couldn't start the call", "No app on this device can place calls."],
  text: [
    "Couldn't open your messages app",
    "No app on this device can send texts.",
  ],
  email: [
    "Couldn't open your email app",
    "No app on this device can send email.",
  ],
};

/**
 * The structured outcome of a reach-out handoff (HIGH-1). `handoffStarted` is true
 * only when the native launch request resolved; `assistUid` is the created pending
 * assist's UID (non-null ONLY when `assistEnabled` was true AND createPendingAssist
 * succeeded — null when assists are opted out). Callers gate the Compose
 * "Did you send it?" confirmation on `handoffStarted === true && assistUid !== null`
 * and log THAT specific assist, never re-querying the table by contact+timestamp.
 */
export type ReachOutOutcome = {
  handoffStarted: boolean;
  assistUid: string | null;
};

/**
 * Write the optional confirmation prompt before handing the user's chosen
 * contact method to the operating system. A resolved native handoff is only a
 * successful launch request; it is never evidence that communication happened.
 *
 * Returns the handoff outcome so the caller (the Compose confirmation panel) can
 * log the EXACT created assist. A thrown native launch keeps the existing Alert +
 * markAssistFailed and reports `handoffStarted: false`, so a failed launch never
 * surfaces the confirmation panel (T-35-21).
 */
export async function performReachOut(
  exec: SqlExecutor,
  {
    contactId,
    channel,
    endpoint,
    assistEnabled,
    now,
    messageBody = "",
    subject = "",
  }: ReachOutInput,
): Promise<ReachOutOutcome> {
  const assistUid = assistEnabled
    ? await createPendingAssist(exec, {
        contactId,
        channel,
        endpointValue: endpoint,
        now,
      })
    : null;

  try {
    if (channel === "text") {
      await SMS.sendSMSAsync(endpoint, messageBody);
    } else if (channel === "call") {
      await Linking.openURL(`tel:${endpoint}`);
    } else {
      // Email: carry the composed Subject + Body via an encoded mailto query
      // string (no-dependency Linking path). Text arm byte-unchanged above.
      await Linking.openURL(buildMailtoUrl(endpoint, subject, messageBody));
    }
  } catch {
    if (assistUid) {
      await markAssistFailed(exec, { assistUid, now });
    }
    Alert.alert(...HANDOFF_ERROR_COPY[channel]);
    return { handoffStarted: false, assistUid: null };
  }

  return { handoffStarted: true, assistUid };
}
