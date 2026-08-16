/**
 * channels — idempotent creation of the OS notification channels this app owns.
 *
 * TWO immutable facts drive every value here:
 *
 * 1. IMPORTANCE = `AndroidImportance.LOW` on ALL channels. LOW is the silent,
 *    no-heads-up-peek tier that is STILL visible in the shade and on the lock
 *    screen — exactly the owner's DECIDED "silent, no heads-up" alert feel
 *    (11-CONTEXT §"Alert feel", RATIFIED). Android's `IMPORTANCE_DEFAULT`
 *    actually PLAYS A SOUND, so it is the wrong tier for a calm reminder; using
 *    LOW here is the correct IMPLEMENTATION of that intent, not a reversal of it
 *    (11-REVIEWS H4). Do not "upgrade" this to DEFAULT.
 *
 * 2. A channel's importance and lock-screen visibility are IMMUTABLE at creation
 *    in Android — `setNotificationChannelAsync` on an existing id is a silent
 *    no-op for those properties. So the id carries a `-v1` version suffix
 *    (notification-ids.ts): any future importance/visibility change ships as a
 *    NEW `-v2` channel + migration, NEVER a re-set of an existing id. This module
 *    therefore only ever CREATES; it has no "change an existing channel" path.
 *
 * Lock-screen visibility is expressed by WHICH channel a notification posts to,
 * not by mutating a channel: the two decay channels split PRIVATE/PUBLIC so the
 * scheduler picks one per the user's `lockscreen_public` setting. Birthday is a
 * single PRIVATE channel that does not honour that toggle (OQ-2).
 */
import {
  AndroidImportance,
  AndroidNotificationVisibility,
  setNotificationChannelAsync,
} from "expo-notifications";
import {
  BIRTHDAY_CHANNEL,
  DECAY_PRIVATE_CHANNEL,
  DECAY_PUBLIC_CHANNEL,
} from "./notification-ids";

/**
 * Create (or idempotently re-create) the three notification channels. Safe to
 * call on every launch: for an already-existing id Android keeps the original
 * immutable properties, so repeated calls converge without ever mutating a live
 * channel. No colour, no icon, no custom sound — LOW is silent by tier.
 */
export async function ensureChannels(): Promise<void> {
  await setNotificationChannelAsync(DECAY_PRIVATE_CHANNEL, {
    name: "Reminders",
    importance: AndroidImportance.LOW,
    lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
  });
  await setNotificationChannelAsync(DECAY_PUBLIC_CHANNEL, {
    name: "Reminders (name shown on lock screen)",
    importance: AndroidImportance.LOW,
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
  });
  await setNotificationChannelAsync(BIRTHDAY_CHANNEL, {
    name: "Birthdays",
    importance: AndroidImportance.LOW,
    lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
  });
}
