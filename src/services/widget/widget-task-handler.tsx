/**
 * widget-task-handler — the headless brain of the OrbitFavourites widget (WDG-02).
 *
 * =============================================================================
 * WHAT THIS IS: the function `registerWidgetTaskHandler` (index.ts) expects. The
 * OS invokes it in a HEADLESS JS context for every widget lifecycle/click event —
 * React never mounts, App.tsx's effects never run, all inside a ~30s budget. It
 * mirrors the proven Phase-11 notification headless mark (notification-actions.ts):
 * openAndMigrate BEFORE getExecutor, single-writer DAO, Logger-guarded try/catch.
 *
 * TWO ROUTES off `props.widgetAction` (spellings confirmed first-hand against the
 * installed types at node_modules/react-native-android-widget —
 * register-widget-task-handler.d.ts, addresses Claude L1):
 *   - RENDER events (WIDGET_ADDED / WIDGET_UPDATE / WIDGET_RESIZED) redraw the
 *     tree via props.renderWidget(await renderFavourites(props.widgetInfo)).
 *     PASSING props.widgetInfo lets WIDGET_RESIZED select small vs large layout
 *     (12-05 pickLayout); a plain WIDGET_UPDATE carries no size → small default.
 *   - WIDGET_CLICK + clickAction "WIDGET_MARK" is the headless mark.
 *   - WIDGET_DELETED is a no-op.
 *
 * THE MARK IS THE DURABLE ACTION, AND IT COMMITS BEFORE THE RE-RENDER (codex MED
 * x2): read contactId from props.clickActionData and guard with
 * `Number.isSafeInteger(id) && id > 0` (NOT bare Number.isInteger — rejects
 * negative, zero, and unsafe-integer ids, matching the resolveWidgetUri boundary
 * in 12-04) BEFORE opening SQLite; a failing id is ignored. Then await
 * openAndMigrate() BEFORE getExecutor() (getExecutor throws pre-open, and in a
 * killed-app launch React never mounts so App.tsx's open effect never runs — H1),
 * compute now, and call widgetMarkContacted (12-05 single-writer DAO) — WHICH
 * COMMITS HERE. Only THEN await pushWidgetUpdate() to refresh. Because the mark is
 * fully committed first and pushWidgetUpdate swallows its own errors (12-06
 * Task 1), a slow / failed / OS-30s-budget-killed render can NEVER roll back or
 * throw past the committed mark — a refresh failure is non-fatal to the mark.
 *
 * NO SWEEP (T-12-07 / launch-sweep.ts:10-14): this handler imports NOTHING that
 * reaches the foreground launch-sweep runner or its foreground trigger — a
 * headless tap must never fire quarantine expiry / archived-purge / reconcile. It
 * imports only the mark seam, the render, the refresh wrapper, and the DB
 * bootstrap. (widget-refresh is import-safe here: launch-sweep has ZERO
 * module-scope side effects, and this file imports only pushWidgetUpdate from it,
 * never the sweep runner or its trigger. The grep gate asserts 0 refs to either
 * symbol in THIS file; the invariant additionally rests on that import purity —
 * never add an import that transitively reaches the foreground sweep entry points.)
 *
 * GUARDED SO A FAILURE NEVER CRASHES THE HEADLESS CONTEXT: the whole body is a
 * Logger-guarded try/catch that never rethrows (headless-task.ts shape).
 * =============================================================================
 */
import type { WidgetTaskHandler } from "react-native-android-widget";
import { getExecutor, localDateTime, openAndMigrate } from "@/db/database";
import { Logger } from "@/utils/logger";
import { widgetMarkContacted } from "./widget-mark";
import { pushWidgetUpdate } from "./widget-refresh";
import { renderFavourites } from "./widget-render";

const LOG_SOURCE = "widget-task-handler";

/** The clickAction the mark tiles/buttons emit (widget-render.tsx, 12-05). */
const CLICK_MARK = "WIDGET_MARK";

/**
 * The library headless entry (registered at module scope in index.ts). Routes
 * render events to renderFavourites(props.widgetInfo) and WIDGET_MARK clicks to
 * the committed headless mark, all inside a Logger-guarded try/catch that never
 * rethrows so a failure cannot crash the headless context.
 */
export const widgetTaskHandler: WidgetTaskHandler = async (props) => {
  try {
    switch (props.widgetAction) {
      case "WIDGET_ADDED":
      case "WIDGET_UPDATE":
      case "WIDGET_RESIZED":
        // Pass widgetInfo so WIDGET_RESIZED selects the small vs large layout;
        // a plain WIDGET_UPDATE carries no size and defaults to small (12-05).
        props.renderWidget(await renderFavourites(props.widgetInfo));
        break;

      case "WIDGET_CLICK": {
        if (props.clickAction !== CLICK_MARK) {
          // OPEN_URI and any other click are handled by the deep-link path, not
          // the headless mark — nothing to write here.
          return;
        }
        // Guard the id BEFORE opening SQLite: reject negative, zero, non-numeric,
        // and unsafe-integer ids (codex MED — matches resolveWidgetUri, 12-04).
        const contactId = Number(props.clickActionData?.contactId);
        if (!(Number.isSafeInteger(contactId) && contactId > 0)) {
          Logger.debug(LOG_SOURCE, "WIDGET_MARK ignored: invalid contactId");
          return;
        }
        // H1: open + migrate BEFORE getExecutor(). In a killed-app headless
        // launch this await is the ONLY thing that opens the DB.
        await openAndMigrate();
        const now = localDateTime();
        // THE DURABLE ACTION — commits here via the single-writer DAO.
        await widgetMarkContacted(getExecutor(), contactId, now);
        // Refresh AFTER the commit. pushWidgetUpdate swallows its own errors, so
        // a failed/timed-out render can never roll back or throw past the mark.
        await pushWidgetUpdate();
        break;
      }

      case "WIDGET_DELETED":
        // Nothing to do — no per-widget state to tear down.
        break;
    }
  } catch (err) {
    // A thrown error must not crash the headless context (headless-task.ts shape).
    Logger.error(LOG_SOURCE, "widget task handler failed", err);
  }
};
