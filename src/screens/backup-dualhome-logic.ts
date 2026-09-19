/**
 * Host identity for the dual-homed Backup screen tree (D-08 / §I). The four
 * Backup screens (`BackupScreen`/`BackupSettingsScreen`/`RestorePreviewScreen`/
 * `RestoreResultScreen`) are one canonical tree now hosted by Settings. The
 * hosting stack threads an explicit `host` prop through
 * per-stack wrapper components rather than inferring the parent tab from nested
 * navigation state (review cycle-1 HIGH: `getParent`/`getState` inference had no
 * parent id, no fail-closed default, and no test). Every host-dependent
 * behaviour is a pure function of this single primitive — unit-testable without
 * a device or a navigator (Task 2 adds those helpers).
 */
export type BackupHost = "backup-tab" | "settings";

/**
 * Legacy fail-closed default retained for compatibility with the canonical
 * Backup screen's optional host prop. The live Settings route always supplies
 * `host="settings"` explicitly.
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
 * Host-aware label for the post-restore return button. Must describe the actual
 * destination `restoreReturnRouteName` resets to: the Backup-tab flow returns to
 * "Backup & Restore" (UNCHANGED), the Settings-entry flow returns to the Settings
 * hub. A single hardcoded "Return to Backup & Restore" misdescribed the Settings
 * destination (review WR-02). Mirrors restoreReturnRouteName's host split.
 */
export function restoreReturnLabel(host: BackupHost): string {
  return host === "settings"
    ? "Return to Settings"
    : "Return to Backup & Restore";
}

/**
 * Whether this mount drains the native shared-backup singleton on focus. After
 * Phase 38 removed the Backup tab, the Settings-hosted screen is the sole live
 * consumer. Native consumption safely returns `{ uri: null }` when nothing is
 * staged, so ordinary Settings navigation remains a no-op.
 */
export function shouldConsumeSharedBackup(host: BackupHost): boolean {
  return host === "settings";
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
