import { isContactPickerAvailable } from "../../modules/orbit-contact-picker";

export type ContactImportMode = "system" | "legacy";

/** The sole SDK-routing seam for system and legacy contact acquisition. */
export function contactImportMode(): ContactImportMode {
  return isContactPickerAvailable() ? "system" : "legacy";
}
