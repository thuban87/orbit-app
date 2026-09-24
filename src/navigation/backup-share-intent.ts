/** The native backup receiver reports pending JSON shares before copying.
 * The general share receiver ignores non-text input. */
export function shouldRouteBackupShare(
  backupPending: boolean,
  hasTextShare: boolean,
): boolean {
  return backupPending && !hasTextShare;
}
