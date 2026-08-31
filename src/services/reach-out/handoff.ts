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
 * Write the optional confirmation prompt before handing the user's chosen
 * contact method to the operating system. A resolved native handoff is only a
 * successful launch request; it is never evidence that communication happened.
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
): Promise<void> {
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
  }
}
