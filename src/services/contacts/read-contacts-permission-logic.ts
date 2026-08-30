/** The only request results React Native exposes for a dangerous permission. */
export type ContactsPermissionRequestResult =
  | "granted"
  | "denied"
  | "never_ask_again";

export type ContactsPermissionVerdict = "granted" | "denied" | "permanent";

/**
 * Classify only the typed result of PermissionsAndroid.request(). A repeat plain
 * denial stays recoverable; Android's never_ask_again result is the sole
 * permanent-denial signal.
 */
export function classifyPermissionResult(
  result: ContactsPermissionRequestResult,
): ContactsPermissionVerdict {
  if (result === "granted") return "granted";
  if (result === "never_ask_again") return "permanent";
  return "denied";
}
