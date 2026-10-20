/**
 * The resolved Default Interaction Channel for one-tap logging (38.14 D-59,
 * D-63).
 *
 * Bulk Quick Log, the widget Mark and the notification Mark record the same
 * channel single Quick Log does: the user's Default Interaction Channel, with
 * Remember last choice reading the channel last saved in Log Interaction
 * (`resolveInitialChannel`). Direction stays outbound on every one-tap route
 * (04-log.md:501-502); this helper only supplies the channel.
 *
 * NEVER REJECTS: a settings-read failure (missing row, closed database) logs a
 * content-free message and returns the documented fallback, Message, so a
 * one-tap write is never dropped (RESEARCH Pitfall 5).
 *
 * READ OUTSIDE THE WRITE MUTEX: callers read the channel BEFORE they open a
 * write transaction or call `recordTouchpoint`. The mutex is non-reentrant
 * (`src/db/transaction.ts`), and a read inside it could not fall back without
 * aborting the write.
 *
 * Kept free of react-native imports so it is unit-tested under vitest in node,
 * like the other `src/services` helpers (a 38.14-03 planning choice, for
 * node-testability; headless JS runs the same bundle, so it is not a headless
 * requirement). The resolver's import chain is RN-free (RESEARCH Pattern 5).
 */
import { getAppSettings } from "@/db/app-settings-dao";
import type { ReadOnlyExecutor } from "@/db/transaction";
import { resolveInitialChannel } from "@/screens/log-interaction-logic";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "resolved-channel";

/** The channel used when the settings cannot be read (REMEMBERED_FALLBACK). */
export const RESOLVED_CHANNEL_FALLBACK = "Message";

export async function readResolvedInteractionChannel(
  exec: ReadOnlyExecutor,
): Promise<string> {
  try {
    const settings = await getAppSettings(exec);
    return resolveInitialChannel(
      settings.defaultInteractionChannel,
      settings.rememberedInteractionChannel,
    );
  } catch {
    // Content-free: no names, notes or settings values in the log.
    Logger.warn(
      LOG_SCOPE,
      "could not read the default interaction channel; using Message",
    );
    return RESOLVED_CHANNEL_FALLBACK;
  }
}
