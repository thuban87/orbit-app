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
