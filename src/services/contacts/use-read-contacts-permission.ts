import { PermissionsAndroid } from "react-native";

export interface ContactsPermissionResult {
  granted: boolean;
}

/**
 * Read READ_CONTACTS permission fresh at the import value moment. Permission is
 * OS-owned and can change outside the app, so callers must not cache it.
 */
export async function getContactsPermission(): Promise<ContactsPermissionResult> {
  try {
    return {
      granted: await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
      ),
    };
  } catch {
    return { granted: false };
  }
}

/** Request legacy contact access, treating an OS failure as a denied request. */
export async function requestContactsPermission(): Promise<ContactsPermissionResult> {
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
    );
    return { granted: result === PermissionsAndroid.RESULTS.GRANTED };
  } catch {
    return { granted: false };
  }
}
