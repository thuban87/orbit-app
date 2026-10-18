import {
  type FlowHost,
  type FlowNavigator,
  finishFlow,
} from "@/navigation/flow-host";

/**
 * Host identity for the Backup screen tree (`BackupScreen` / `RestorePreview`
 * / `RestoreResult`), 38.12 D-68. The host travels as an optional `host` route
 * param on those routes (absent = `DEFAULT_RESTORE_HOST`), the same idiom as
 * the import / merge flows (`flow-host.ts`, D-110), instead of a React prop
 * each stack injected. Phase 39 D-96 passes `{ kind: "digest" }` for its
 * first-run restore.
 *
 * A Profile never opens Backup or Restore, so `profile` is excluded at the
 * type level rather than mapped (38.12-18, convergence c2 B-8). Every helper
 * below is an exhaustive switch on `host.kind`: a new `FlowHost` kind fails
 * tsc here instead of falling through.
 */
export type RestoreHost = Exclude<FlowHost, { kind: "profile" }>;

/** Settings → Data & Backup, the only entry outside first run. */
export const DEFAULT_RESTORE_HOST: RestoreHost = { kind: "settings" };

/**
 * The route the restore's success reset leaves beneath Backup restored, for
 * every host: the Settings hub, so Back from the result lands on it (today's
 * behaviour). A digest host's return then leaves the Settings tab on its hub.
 */
export const RESTORE_SUCCESS_BASE_ROUTE = "Settings";

function unreachable(host: never): never {
  throw new Error(`backup-dualhome: unknown restore host ${String(host)}`);
}

/**
 * The post-restore return button's label: it names where
 * `returnFromRestore` goes.
 */
export function restoreReturnLabel(
  host: RestoreHost,
): "Return to Settings" | "Return to Digest" {
  switch (host.kind) {
    case "settings":
      return "Return to Settings";
    case "digest":
      return "Return to Digest";
    default:
      return unreachable(host);
  }
}

/**
 * The post-restore return (the result page's button):
 * - settings: reset the Settings stack to its hub, as before (the shape of
 *   `CommonActions.reset`, so this module stays node-testable);
 * - digest: `finishFlow(navigation, { kind: "digest" })`: switch to Digest
 *   without a Back-history entry and pop the restore routes off the Settings
 *   stack (they are flow routes, `FLOW_ROUTE_NAMES`).
 */
export function returnFromRestore(
  navigation: FlowNavigator,
  host: RestoreHost,
): void {
  switch (host.kind) {
    case "settings":
      navigation.dispatch({
        type: "RESET",
        payload: { index: 0, routes: [{ name: RESTORE_SUCCESS_BASE_ROUTE }] },
      } as never);
      return;
    case "digest":
      finishFlow(navigation, { kind: "digest" });
      return;
    default:
      unreachable(host);
  }
}

/**
 * Whether this Backup mount drains the native shared-backup singleton on
 * focus. Both hosts are Settings-stack mounts and the sole live consumer;
 * native consumption returns `{ uri: null }` when nothing is staged.
 */
export function shouldConsumeSharedBackup(host: RestoreHost): boolean {
  switch (host.kind) {
    case "settings":
      return true;
    case "digest":
      return true;
    default:
      return unreachable(host);
  }
}

/**
 * The Backup page's app bar: a pushed child page with a Back for both hosts
 * (`ShellAppBar variant="child"`).
 */
export function backupAppBarVariant(host: RestoreHost): "child" {
  switch (host.kind) {
    case "settings":
      return "child";
    case "digest":
      return "child";
    default:
      return unreachable(host);
  }
}
