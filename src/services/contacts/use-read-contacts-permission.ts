import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, Linking, PermissionsAndroid } from "react-native";
import {
  classifyPermissionResult,
  type ContactsPermissionVerdict,
} from "./read-contacts-permission-logic";

const PERMANENT_DENIAL_KEY = "contacts_permission_permanent_v1";
const REQUESTED_BEFORE_KEY = "hasRequestedReadContacts";
const DENY_COUNT_KEY = "contacts_deny_count";

export interface ContactsPermissionState {
  denialCount: number;
  verdict: ContactsPermissionVerdict | "priming";
}

export interface ContactsPermissionRequestState extends ContactsPermissionState {
  granted: boolean;
}

export interface ContactsPermissionResult {
  granted: boolean;
}

async function readFlag(key: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key)) === "true";
  } catch {
    return false;
  }
}

async function readDenyCount(): Promise<number> {
  try {
    const value = Number.parseInt((await AsyncStorage.getItem(DENY_COUNT_KEY)) ?? "0", 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

async function clearDeniedPresentation(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      PERMANENT_DENIAL_KEY,
      REQUESTED_BEFORE_KEY,
      DENY_COUNT_KEY,
    ]);
  } catch {
    // OS permission remains the source of truth even if local presentation cleanup fails.
  }
}

/**
 * Read READ_CONTACTS permission fresh at the import value moment. Permission is
 * OS-owned and can change outside the app, so callers must not cache it.
 */
export async function getContactsPermission(): Promise<ContactsPermissionResult> {
  try {
    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
    );
    if (granted) await clearDeniedPresentation();
    return { granted };
  } catch {
    return { granted: false };
  }
}

/**
 * Freshly resolve the screen presentation after an OS-owned permission check.
 * A cached permanent verdict only restores presentation after this fresh check
 * confirms that access is still absent.
 */
export async function getContactsPermissionState(): Promise<ContactsPermissionState> {
  const { granted } = await getContactsPermission();
  if (granted) return { verdict: "granted", denialCount: 0 };

  const [permanent, requestedBefore, denialCount] = await Promise.all([
    readFlag(PERMANENT_DENIAL_KEY),
    readFlag(REQUESTED_BEFORE_KEY),
    readDenyCount(),
  ]);
  if (permanent) return { verdict: "permanent", denialCount };
  return { verdict: requestedBefore ? "denied" : "priming", denialCount };
}

/**
 * Request legacy contact access only after an intentional user tap. The typed
 * request outcome—not a rationale or repeat-count heuristic—determines whether
 * denial is permanent.
 */
export async function requestContactsPermission(): Promise<ContactsPermissionRequestState> {
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
    );
    const verdict = classifyPermissionResult(result);
    await AsyncStorage.setItem(REQUESTED_BEFORE_KEY, "true");

    if (verdict === "granted") {
      await clearDeniedPresentation();
      return { granted: true, verdict, denialCount: 0 };
    }
    if (verdict === "permanent") {
      await AsyncStorage.setItem(PERMANENT_DENIAL_KEY, "true");
      return { granted: false, verdict, denialCount: await readDenyCount() };
    }

    const denialCount = (await readDenyCount()) + 1;
    await AsyncStorage.setItem(DENY_COUNT_KEY, String(denialCount));
    return { granted: false, verdict, denialCount };
  } catch {
    return {
      granted: false,
      verdict: "denied",
      denialCount: await readDenyCount(),
    };
  }
}

/** Open Orbit's app-info settings, with a calm fallback for unusual OEMs. */
export async function openContactsSettings(): Promise<boolean> {
  try {
    await Linking.openSettings();
    return true;
  } catch {
    Alert.alert(
      "Open Settings manually",
      "Open Orbit's app settings and allow Contacts access.",
    );
    return false;
  }
}
