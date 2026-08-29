import type { CreateContactFullInput } from "@/db/contacts-dao";
import { newUid } from "@/db/uid";
import { isValidStoredBirthday } from "@/logic/birthday-logic";
import { buildBirthdayForStorage } from "@/screens/edit-contact-logic";
import type { PickedContact } from "../../modules/orbit-contact-picker";

export interface MapPickedContactOptions {
  categoryId: number | null;
  effectivePhoneRegion: string | null;
}

export interface PickedContactMapResult {
  input: CreateContactFullInput;
  nameRequired: boolean;
  externalContactId: string;
  photoTempUri: string | null;
  /** Validated stored birthday; CreateContactFullInput has no birthday field. */
  birthday: string | null;
}

/** Local wall-clock timestamp without importing the Expo-backed DB bootstrap. */
function localDateTime(): string {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function mapBirthdayForStorage(birthday: string | null): string | null {
  if (birthday == null || birthday.trim() === "") return null;

  const trimmed = birthday.trim();
  const yearUnknown = trimmed.startsWith("--") || /^\d{2}-\d{2}$/.test(trimmed);
  const birthdayInput = yearUnknown
    ? `2000-${trimmed.replace(/^--/, "")}`
    : trimmed;
  const stored = buildBirthdayForStorage(birthdayInput, yearUnknown);
  return isValidStoredBirthday(stored) ? stored : null;
}

/**
 * Convert the picker snapshot to the only fields Orbit imports. Deliberately
 * excludes arbitrary Android contact metadata such as addresses and notes.
 */
export function mapPickedContact(
  picked: PickedContact,
  opts: MapPickedContactOptions,
): PickedContactMapResult {
  const name = picked.displayName?.trim() ?? "";
  const methodDrafts = picked.methods
    .filter(
      (method): method is { type: "phone" | "email"; value: string } =>
        method.type === "phone" || method.type === "email",
    )
    .map((method) => ({
      uid: newUid(),
      type: method.type,
      value: method.value,
    }));

  return {
    input: {
      uid: newUid(),
      name,
      intervalDays: null,
      trackingEnabled: false,
      now: localDateTime(),
      categoryId: opts.categoryId,
      methodDrafts,
      methodNormalization: {
        effectivePhoneRegion: opts.effectivePhoneRegion,
      },
    },
    nameRequired: name === "",
    externalContactId: picked.lookupKey,
    photoTempUri: picked.photoTempUri,
    birthday: mapBirthdayForStorage(picked.birthday),
  };
}
