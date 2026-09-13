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
};

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
    } else {
      await Linking.openURL(
        `${channel === "call" ? "tel" : "mailto"}:${endpoint}`,
      );
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
