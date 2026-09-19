import {
  cancelScheduledNotificationAsync,
  dismissNotificationAsync,
  getAllScheduledNotificationsAsync,
  getPresentedNotificationsAsync,
  SchedulableTriggerInputTypes,
  scheduleNotificationAsync,
} from "expo-notifications";
import {
  DIGEST_BODY,
  DIGEST_CHANNEL,
  DIGEST_IDENTIFIER,
  DIGEST_TITLE,
} from "../notification-ids";

const UAT_IDENTIFIER_PREFIX = "digest:uat:";
export const PHASE38_UAT_DELAY_MS = 10_000;

/** Schedule one local, generic-copy Digest notification without touching the weekly singleton. */
export async function schedulePhase38DigestUat(
  now = new Date(),
  delayMs = PHASE38_UAT_DELAY_MS,
): Promise<string> {
  const identifier = `${UAT_IDENTIFIER_PREFIX}${now.getTime()}`;
  await scheduleNotificationAsync({
    identifier,
    content: {
      title: DIGEST_TITLE,
      body: DIGEST_BODY,
      data: { kind: "digest" },
      autoDismiss: true,
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DATE,
      channelId: DIGEST_CHANNEL,
      date: new Date(now.getTime() + delayMs),
    },
  } as Parameters<typeof scheduleNotificationAsync>[0]);
  return identifier;
}

/** Recover an interrupted probe from either the future schedule or the live shade. */
export async function findPhase38DigestUatIdentifier(): Promise<string | null> {
  const [scheduled, presented] = await Promise.all([
    getAllScheduledNotificationsAsync(),
    getPresentedNotificationsAsync(),
  ]);
  const identifiers = [
    ...scheduled.map((request) => request.identifier),
    ...presented.map((notification) => notification.request.identifier),
  ];
  return (
    identifiers.find((identifier) =>
      identifier.startsWith(UAT_IDENTIFIER_PREFIX),
    ) ?? null
  );
}

/** Cancel only an identifier minted by this debug probe. */
export async function cancelPhase38DigestUat(
  identifier: string,
): Promise<void> {
  if (
    identifier === DIGEST_IDENTIFIER ||
    !identifier.startsWith(UAT_IDENTIFIER_PREFIX)
  ) {
    throw new Error("Phase 38 cleanup accepts a UAT-only Digest identifier.");
  }
  await cancelScheduledNotificationAsync(identifier);
  await dismissNotificationAsync(identifier);
}
