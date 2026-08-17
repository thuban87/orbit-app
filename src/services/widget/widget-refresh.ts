/**
 * widget-refresh — event-push freshness for the OrbitFavourites widget (WDG-03).
 *
 * =============================================================================
 * NO POLLING (WDG-03): the widget stays fresh by being PUSHED, not by polling.
 * `pushWidgetUpdate()` re-renders every placed OrbitFavourites instance via the
 * library's `requestWidgetUpdate`; a `widgetNotFound` no-op makes it safe to call
 * when NO instance is placed (it simply does nothing). There are two publishers:
 *
 *   1. `registerWidgetSweep()` plugs `pushWidgetUpdate` into the once-per-launch
 *      launch sweep, so a real foreground launch recomputes + re-pushes. This is
 *      FOREGROUND-ONLY by construction (the sweep fires from its foreground
 *      trigger, launch-sweep.ts:102) and is a SweepHook, never invoked from the
 *      headless tap path. The actual `registerWidgetSweep()` call is made once,
 *      module-guarded, in App.tsx by 12-07.
 *   2. `notifyWidgetDataChanged()` is a fire-and-forget publisher for FOREGROUND
 *      mutation call sites (manual log, favourite toggle/reorder, fuel edits —
 *      wired in 12-07). It calls `void pushWidgetUpdate()` (NOT awaited) so a
 *      successful user write is never blocked or rolled back by a widget-render
 *      failure.
 *
 * ALWAYS RESOLVES, NEVER REJECTS (Claude M3): `pushWidgetUpdate` wraps its ENTIRE
 * body in a Logger-guarded try/catch that SWALLOWS (never rethrows). This is
 * load-bearing: it is registered as a launch-sweep hook, and `runLaunchSweep`
 * awaits hooks in a bare `for (…) { await hook(); }` with NO per-hook isolation
 * (launch-sweep.ts:82). A `requestWidgetUpdate` / render failure that rejected
 * here would reject the whole fire-and-forget sweep — installSweepTrigger calls
 * it with `void`, so that rejection becomes an UNHANDLED rejection and every
 * later hook is skipped. Swallowing here keeps the sweep loop whole.
 * =============================================================================
 */
import { requestWidgetUpdate } from "react-native-android-widget";
import { registerSweepHook } from "@/services/launch-sweep";
import { Logger } from "@/utils/logger";
import { renderFavourites } from "./widget-render";

const LOG_SOURCE = "widget-refresh";

/** The app.config.ts contract string — the placed widget's registered name. */
const WIDGET_NAME = "OrbitFavourites";

/**
 * Re-render every placed OrbitFavourites instance. No-ops (via `widgetNotFound`)
 * when none is placed. Passes NO widgetInfo, so a bare re-render defaults to the
 * small layout (renderFavourites' pickLayout); when a large instance is placed
 * the OS re-fires WIDGET_RESIZED with real size info and the handler re-renders
 * at the correct size.
 *
 * ALWAYS RESOLVES: the whole body is Logger-guarded and never rethrows, so this
 * is safe to register on the un-isolated launch-sweep loop and to fire-and-forget
 * from a foreground write (see file header, Claude M3).
 */
export async function pushWidgetUpdate(): Promise<void> {
  try {
    await requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: renderFavourites,
      // Safe to call with no instance placed: the OS invokes this instead.
      widgetNotFound: () => {},
    });
  } catch (err) {
    // Swallow — a render/requestWidgetUpdate failure must never reject the
    // un-isolated sweep loop or a fire-and-forget foreground publisher.
    Logger.error(LOG_SOURCE, "pushWidgetUpdate failed (swallowed)", err);
  }
}

/**
 * Fire-and-forget freshness publisher for FOREGROUND mutation call sites (wired
 * in 12-07). Kicks a re-push without awaiting, so a successful user write is
 * never blocked or rolled back by a widget-render failure (pushWidgetUpdate
 * already swallows its own errors).
 */
export function notifyWidgetDataChanged(): void {
  void pushWidgetUpdate();
}

/**
 * Register the foreground launch recompute: pushWidgetUpdate runs on each real
 * foreground launch (no polling). Called once, module-guarded, from App.tsx by
 * 12-07 — this is a foreground SweepHook and is never reached from the headless
 * tap path.
 */
export function registerWidgetSweep(): void {
  registerSweepHook(pushWidgetUpdate);
}
