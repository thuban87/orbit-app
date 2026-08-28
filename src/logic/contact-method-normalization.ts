import parsePhoneNumberFromString, {
  type CountryCode,
  type PhoneNumber,
} from "libphonenumber-js";

export type ContactMethodType = "phone" | "email";

export interface NormalizeContactMethodInput {
  type: ContactMethodType;
  value: string;
  /** Only used for national-format phone values; explicit `+` values ignore it. */
  defaultPhoneRegion: string | null | undefined;
}

export interface NormalizedContactMethod {
  rawValue: string;
  displayValue: string;
  canonicalValue: string | null;
  /** Region used to derive canonical phone identity; null means raw/non-canonical. */
  canonicalRegion: string | null;
  extension: string | null;
  isActionable: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function raw(value: string): NormalizedContactMethod {
  const rawValue = value.trim();
  return {
    rawValue,
    displayValue: rawValue,
    canonicalValue: null,
    canonicalRegion: null,
    extension: null,
    isActionable: false,
  };
}

/**
 * The sole parsing boundary for migration and subsequent method writers. It
 * preserves nonblank malformed values while exposing actionability separately.
 */
export function normalizeContactMethod(
  input: NormalizeContactMethodInput,
): NormalizedContactMethod {
  const value = input.value.trim();
  if (input.type === "email") {
    if (!EMAIL_RE.test(value)) return raw(input.value);
    return {
      rawValue: value,
      displayValue: value,
      canonicalValue: value.toLowerCase(),
      canonicalRegion: null,
      extension: null,
      isActionable: true,
    };
  }

  const explicitInternational = value.startsWith("+");
  if (!explicitInternational && !input.defaultPhoneRegion) return raw(input.value);
  let parsed: PhoneNumber | undefined;
  try {
    parsed = parsePhoneNumberFromString(
      value,
      explicitInternational ? undefined : (input.defaultPhoneRegion as CountryCode | null | undefined) ?? undefined,
    );
  } catch {
    return raw(input.value);
  }
  if (!parsed?.isValid()) return raw(input.value);
  return {
    rawValue: value,
    displayValue: parsed.formatNational(),
    canonicalValue: parsed.number,
    canonicalRegion: parsed.country ?? (explicitInternational ? null : input.defaultPhoneRegion ?? null),
    extension: parsed.ext ?? null,
    isActionable: true,
  };
}
