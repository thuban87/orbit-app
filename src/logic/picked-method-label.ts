/**
 * Maps a phone contact's raw ContactsContract TYPE code (DATA2) and custom
 * LABEL (DATA3), read by the bridge (38.12-02), onto Orbit's method label set
 * (`METHOD_LABELS`, contact-methods-editor-model.ts: Mobile, Home, Work, Main,
 * Other) so Check linked contacts adds a phone value with its label (D-47,
 * D-102).
 *
 * - Phone: TYPE 2 → Mobile, 1 → Home, 3 → Work, 12 → Main.
 * - Email: TYPE 1 → Home, 2 → Work, 4 → Mobile.
 * - TYPE 0 (custom) with a non-blank LABEL → that text, trimmed.
 * - Any other code (or 0 without a label) → Other.
 * - No code at all (the provider returned none) → null: no label is invented.
 *
 * Pure; the returned text is stored through the method draft path, which
 * stores an empty label as NULL (contact-methods-dao.ts).
 */
import type { ContactMethodType } from "@/logic/contact-method-normalization";

/** ContactsContract.CommonDataKinds.*.TYPE_CUSTOM */
const TYPE_CUSTOM = 0;

const PHONE_LABELS: Readonly<Record<number, string>> = {
  1: "Home",
  2: "Mobile",
  3: "Work",
  12: "Main",
};

const EMAIL_LABELS: Readonly<Record<number, string>> = {
  1: "Home",
  2: "Work",
  4: "Mobile",
};

export function pickedMethodLabel(
  type: ContactMethodType,
  typeCode: number | null | undefined,
  customLabel: string | null | undefined,
): string | null {
  if (typeCode == null) return null;
  if (typeCode === TYPE_CUSTOM) {
    const custom = customLabel?.trim();
    return custom ? custom : "Other";
  }
  const labels = type === "phone" ? PHONE_LABELS : EMAIL_LABELS;
  return labels[typeCode] ?? "Other";
}
