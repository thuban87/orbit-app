import OrbitContactPickerModule from "./src/OrbitContactPickerModule";

export interface PickedMethod {
  readonly type: "phone" | "email";
  readonly value: string;
}

export interface PickedContact {
  readonly lookupKey: string;
  readonly displayName: string | null;
  readonly methods: PickedMethod[];
  readonly birthday: string | null;
  /**
   * App-private cache copy of a picker-granted photo. This `file://` value is
   * intentionally evictable and must be moved to durable staging by the
   * import-session acceptance flow before it is persisted.
   */
  readonly photoTempUri: string | null;
}

export interface PickContactsOptions {
  readonly multiple: boolean;
}

/** True only on Android 17 (API 37) or newer. */
export function isContactPickerAvailable(): boolean {
  return OrbitContactPickerModule.isContactPickerAvailable();
}

/**
 * Opens Android's privacy-preserving system Contact Picker. The native module
 * snapshots the temporary picker grant before resolving and returns an empty
 * list when the user cancels or the picker is unavailable.
 */
export function pickContacts(
  options: PickContactsOptions,
): Promise<PickedContact[]> {
  return OrbitContactPickerModule.pickContacts(options);
}

/**
 * Reads Contacts Provider data for Orbit's legacy (API <= 36) in-app picker.
 * The native module rejects read failures so callers never mistake one for a
 * cancelled picker.
 */
export function readAllContacts(): Promise<PickedContact[]> {
  return OrbitContactPickerModule.readAllContacts();
}
