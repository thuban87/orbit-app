/**
 * The tap-to-fix explanation for a flagged custom-field value (38.12 D-70;
 * enforces D-24 / HANDOFF §14.4). Edit Contact shows it under the field's
 * input: what is wrong with the stored value and what the field expects.
 *
 * "Flagged" is decided only by `isFlaggedCustomValue` (convergence c1 C-4),
 * the same predicate behind the Profile's "Needs attention" marker and the
 * "Review now" list, so the three never disagree. Display only: nothing here
 * rewrites, clears or coerces the stored value (CLAUDE.md custom-field
 * invariants, ADR-001). Node-pure.
 */
import { isFlaggedCustomValue, parsers } from "@/db/field-parsers";
import type { CustomFieldDef } from "@/db/field-types";
import type { FieldType } from "@/schemas/types";

export interface FieldValueError {
  /** What is wrong with the stored value. */
  problem: string;
  /** What the field expects instead. */
  expectedFormat: string;
}

/** The dropdown's out-of-options problem (C-4). */
export const NOT_AN_OPTION_PROBLEM = "This is no longer one of the options";

/**
 * Per-type text for a value the type's parser rejects. Types whose parser
 * accepts everything (text, textarea, photo, dropdown) never reach this; they
 * keep a neutral fallback so the record stays exhaustive.
 */
const PARSER_ERRORS: Readonly<Record<FieldType, FieldValueError>> = {
  date: {
    problem: "This isn't a valid date",
    expectedFormat: "Use YYYY-MM-DD",
  },
  number: {
    problem: "This isn't a number",
    expectedFormat: "Use digits, for example 42 or 1,250.5",
  },
  url: {
    problem: "This isn't a valid link",
    expectedFormat: "Use a web address, for example example.com",
  },
  email: {
    problem: "This isn't a valid email address",
    expectedFormat: "Use name@example.com",
  },
  phone: {
    problem: "This isn't a valid phone number",
    expectedFormat: "Use at least 3 digits, for example +1 555 123 4567",
  },
  toggle: {
    problem: "This isn't Yes or No",
    expectedFormat: "Turn the switch on for Yes or off for No",
  },
  text: { problem: "This value needs attention", expectedFormat: "Use text" },
  textarea: {
    problem: "This value needs attention",
    expectedFormat: "Use text",
  },
  photo: {
    problem: "This value needs attention",
    expectedFormat: "Choose a photo",
  },
  dropdown: {
    problem: NOT_AN_OPTION_PROBLEM,
    expectedFormat: "Choose one of the options",
  },
};

function optionList(options: string | null): string[] {
  if (options == null) return [];
  try {
    const parsed: unknown = JSON.parse(options);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

/** The error to show for `raw` under the field's current type and options, or null. */
export function customFieldValueError(
  field: Pick<CustomFieldDef, "type" | "options">,
  raw: string | null,
): FieldValueError | null {
  if (!isFlaggedCustomValue(field, raw)) return null;
  if (!parsers[field.type](raw).ok) return PARSER_ERRORS[field.type];
  // The parser accepted it, so the flag is option membership (dropdown).
  const options = optionList(field.options);
  return {
    problem: NOT_AN_OPTION_PROBLEM,
    expectedFormat:
      options.length > 0
        ? `Choose one of: ${options.join(", ")}`
        : "Choose one of the options",
  };
}
