/**
 * Publish a committed interaction or group-event write (38.14 D-27, D-81).
 *
 * The widget is told (`notifyWidgetDataChanged`) and the shell refresh ticks
 * (`bumpShellRefresh`), the same pair `InteractionDetail`'s delete runs, so
 * Home, Profile, History, Digest and the widget converge without a manual
 * refresh. Call it once after the write resolved, never on a failed write.
 *
 * Each step runs in its own try/catch (the `publishAssistCommit` isolation,
 * `assist-commit.ts`): one failure never suppresses the other, and nothing is
 * rethrown into a write that already committed. Log messages carry no user
 * content.
 */
import { notifyWidgetDataChanged } from "@/services/widget/widget-refresh";
import { bumpShellRefresh } from "@/stores/shell-refresh-store";
import { Logger } from "@/utils/logger";

const LOG_SOURCE = "publish-interaction-write";

export function publishInteractionWrite(): void {
  try {
    notifyWidgetDataChanged();
  } catch (error) {
    Logger.error(LOG_SOURCE, "widget notify after a write failed", error);
  }
  try {
    bumpShellRefresh();
  } catch (error) {
    Logger.error(LOG_SOURCE, "shell refresh after a write failed", error);
  }
}
