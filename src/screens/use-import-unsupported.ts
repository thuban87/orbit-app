import { isContactPickerAvailable } from "../../modules/orbit-contact-picker";

export const IMPORT_UNSUPPORTED_TITLE = "Contact import unavailable";
export const IMPORT_UNSUPPORTED_COPY = "Contact import requires Android 17 or later.";

/** Shared capability gate for every Android system-contact entry point. */
export function useImportUnsupported(): boolean {
  return !isContactPickerAvailable();
}
