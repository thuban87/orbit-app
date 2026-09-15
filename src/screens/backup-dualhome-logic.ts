/**
 * Host identity for the dual-homed Backup screen tree (D-08 / §I). The four
 * Backup screens (`BackupScreen`/`BackupSettingsScreen`/`RestorePreviewScreen`/
 * `RestoreResultScreen`) are ONE canonical tree reachable from two entry points —
 * the Backup bottom tab (`BackupStack`) and Settings → Data & Backup
 * (`SettingsStack`). The hosting stack threads an EXPLICIT `host` prop through
 * per-stack wrapper components rather than inferring the parent tab from nested
 * navigation state (review cycle-1 HIGH: `getParent`/`getState` inference had no
 * parent id, no fail-closed default, and no test). Every host-dependent
 * behaviour is a pure function of this single primitive — unit-testable without
 * a device or a navigator (Task 2 adds those helpers).
 */
export type BackupHost = "backup-tab" | "settings";

/**
 * Fail-closed default: an un-anticipated `host`-less mount preserves the shipped
 * single-consumer / reset-to-Backup behaviour (review cycle-1 CONTESTED — the
 * opposite default, `"settings"`/non-consuming, risks a shared backup NEVER
 * being consumed by ANY mount, a worse failure than a rare double-home).
 * Flipping this default is an owner risk-posture call, never a silent change.
 */
export const DEFAULT_BACKUP_HOST: BackupHost = "backup-tab";

/**
 * Origin-aware post-restore return target. The Backup-TAB flow resets to the
 * `Backup` root (UNCHANGED shipped behaviour); the Settings-entry flow returns
 * to the `Settings` hub. Applied at EVERY reset-to-Backup site across the tree
 * (`RestoreResultScreen`'s "Return to Backup & Restore" and the
 * `RestorePreviewScreen` success-reset BASE) so a Settings-hosted restore never
 * strands the user on a `Backup` route inside the Settings stack.
 */
export function restoreReturnRouteName(
  host: BackupHost,
): "Backup" | "Settings" {
  return host === "settings" ? "Settings" : "Backup";
}

/**
 * Whether this mount drains the native shared-backup singleton
 * (`consumeSharedBackup`) on focus. Only the BACKUP-TAB copy does: the
 * share-intent gate routes a shared backup to `BackupTab › Backup`
 * (linking.ts:67), so a Settings-mounted copy that also consumed on focus would
 * DOUBLE-DRAIN the single native resource (RESEARCH Pitfall 3 hazard 2, T-37-02).
 */
export function shouldConsumeSharedBackup(host: BackupHost): boolean {
  return host === "backup-tab";
}

/**
 * Host-aware Backup app-bar chrome (review cycle-2 MEDIUM / §M). The
 * Settings-hosted copy renders `variant="child"` (a Back affordance that returns
 * to the Settings hub via ShellAppBar's `onBack`); the Backup-tab root stays
 * `variant="root"` (title-only, UNCHANGED). Reusing `root` under Settings would
 * strand the back affordance.
 */
export function backupAppBarVariant(host: BackupHost): "root" | "child" {
  return host === "settings" ? "child" : "root";
}
