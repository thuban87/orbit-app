import { getLocales } from "expo-localization";

/**
 * Platform-only device-region reader. Database modules remain node-testable and
 * callers pass null when the platform provides no usable region.
 */
export function getDeviceRegion(): string | null {
  const region = getLocales()[0]?.regionCode;
  return typeof region === "string" && /^[A-Za-z]{2}$/.test(region)
    ? region.toUpperCase()
    : null;
}
