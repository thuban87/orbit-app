/**
 * Inline-validation logic (38.9 D-19). Pure and react-native-free so the rule
 * is node-tested: an error record keyed by field id, the first blocking field
 * in a form's reveal order, and the clear-on-change step.
 */

/** Field id → the message shown under that field. A missing key = no error. */
export type FieldErrors = Readonly<Record<string, string>>;

/**
 * The first field in `order` that has a non-empty error, or `null`. `order` is
 * the form's top-to-bottom reveal order, so Save scrolls to the topmost
 * problem (D-19).
 */
export function firstBlockingField(
  order: readonly string[],
  errors: FieldErrors,
): string | null {
  for (const field of order) {
    const message = errors[field];
    if (typeof message === "string" && message.length > 0) return field;
  }
  return null;
}

/**
 * `errors` without `field`. Returns the same record when the field had no
 * error, so a keystroke in a clean field does not re-render the form.
 */
export function clearFieldError(
  errors: FieldErrors,
  field: string,
): FieldErrors {
  if (!(field in errors)) return errors;
  const { [field]: _removed, ...rest } = errors;
  return rest;
}

/**
 * Builds the record from a validator's ordered error list. The first message
 * per field wins; an error without a message has nothing to render and is
 * skipped.
 */
export function toFieldErrors(
  errors: readonly { field: string; message?: string }[],
): FieldErrors {
  const out: Record<string, string> = {};
  for (const error of errors) {
    if (error.message && !(error.field in out)) {
      out[error.field] = error.message;
    }
  }
  return out;
}
