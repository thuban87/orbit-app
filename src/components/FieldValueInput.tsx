/**
 * FieldValueInput — the type→widget dispatcher (FLD-04).
 *
 * RN equivalent of the plugin `FormRenderer` `renderField` switch: it selects
 * the matching value widget for a field's `type` and passes the controlled
 * `value` / `onChange` (plus parsed `options` for dropdown). Phase 4's contact
 * forms and the CustomFieldsScreen preview render fields through this single
 * dispatcher rather than switching on type themselves.
 *
 * `field.options` is the DEFS row's JSON TEXT column (`string | null`); it is
 * parsed to a `string[]` here so the widget contract stays a plain array.
 *
 * `error` (38.12 D-70): a flagged stored value shows its problem and the
 * expected format under the widget, in the danger colour. The widget still
 * shows the stored value as-is; a switch cannot show text, so a toggle also
 * names the saved text. Nothing here rewrites the value (CLAUDE.md
 * custom-field invariants).
 */
import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import type { CustomFieldDef } from "@/db/field-types";
import { useTheme } from "@/theme";
import type { FieldValueError } from "./field-value-error";
import { DateFieldWidget } from "./field-widgets/DateFieldWidget";
import { DropdownFieldWidget } from "./field-widgets/DropdownFieldWidget";
import { NumberFieldWidget } from "./field-widgets/NumberFieldWidget";
import { PhotoFieldWidget } from "./field-widgets/PhotoFieldWidget";
import { TextAreaFieldWidget } from "./field-widgets/TextAreaFieldWidget";
import { TextFieldWidget } from "./field-widgets/TextFieldWidget";
import { ToggleFieldWidget } from "./field-widgets/ToggleFieldWidget";

/**
 * The minimal DEFS shape the dispatcher reads. `col_name` is OPTIONAL: the edit/
 * create forms pass a full `CustomFieldDef` (which has it, and the photo case
 * needs it), but `FieldDefForm`'s throwaway `previewField` literal has no
 * col_name — keeping it optional lets that preview keep compiling unchanged.
 */
type FieldSpec = Pick<CustomFieldDef, "type" | "label" | "options"> & {
  col_name?: string;
};

export interface FieldValueInputProps {
  field: FieldSpec;
  value: string | null;
  /** `string | null` so the photo widget's Remove can clear via `onChange(null)`. */
  onChange: (value: string | null) => void;
  /** The contact being edited — forwarded to the photo widget ONLY (edit-only). */
  contactId?: number;
  testID?: string;
  /** A flagged stored value's problem and expected format (38.12 D-70). */
  error?: FieldValueError | null;
}

/**
 * Parses the DEFS `options` JSON TEXT into a `string[]`. A null / malformed /
 * non-array / non-string-item value degrades to `[]` (never throws) — the
 * dropdown then relies solely on out-of-list preservation.
 */
function parseOptions(options: string | null): string[] {
  if (options == null) return [];
  try {
    const parsed: unknown = JSON.parse(options);
    return Array.isArray(parsed)
      ? parsed.filter((o): o is string => typeof o === "string")
      : [];
  } catch {
    return [];
  }
}

export function FieldValueInput({
  field,
  value,
  onChange,
  contactId,
  testID,
  error,
}: FieldValueInputProps) {
  const { colors } = useTheme();
  const widget = (
    <FieldWidget
      field={field}
      value={value}
      onChange={onChange}
      contactId={contactId}
      testID={testID}
      showOwnInvalidCaption={!error}
    />
  );
  if (!error) return widget;
  const danger = { color: colors.danger };
  return (
    <View style={styles.withError}>
      {widget}
      {field.type === "toggle" && value != null && value !== "" ? (
        <AppText
          role="caption"
          style={danger}
          testID={testID ? `${testID}-saved` : undefined}
        >
          {`Saved as "${value}"`}
        </AppText>
      ) : null}
      <AppText
        role="caption"
        style={danger}
        accessibilityLiveRegion="polite"
        testID={testID ? `${testID}-problem` : undefined}
      >
        {error.problem}
      </AppText>
      <AppText
        role="caption"
        style={danger}
        testID={testID ? `${testID}-expected` : undefined}
      >
        {error.expectedFormat}
      </AppText>
    </View>
  );
}

function FieldWidget({
  field,
  value,
  onChange,
  contactId,
  testID,
  showOwnInvalidCaption,
}: Omit<FieldValueInputProps, "error"> & { showOwnInvalidCaption: boolean }) {
  const shared = { value, onChange, label: field.label, testID };

  switch (field.type) {
    case "textarea":
      return <TextAreaFieldWidget {...shared} />;
    case "dropdown":
      return (
        <DropdownFieldWidget
          {...shared}
          options={parseOptions(field.options)}
        />
      );
    case "date":
      // With an `error` shown, the date widget's own "Not a date" caption
      // would repeat the problem line, so it is turned off.
      return (
        <DateFieldWidget
          {...shared}
          showInvalidCaption={showOwnInvalidCaption}
        />
      );
    case "toggle":
      return <ToggleFieldWidget {...shared} />;
    case "number":
      return <NumberFieldWidget {...shared} />;
    case "url":
      return <TextFieldWidget {...shared} keyboardType="url" />;
    case "email":
      return <TextFieldWidget {...shared} keyboardType="email-address" />;
    case "phone":
      return <TextFieldWidget {...shared} keyboardType="phone-pad" />;
    case "photo":
      // Photo ONLY: thread contactId + col_name so the widget is edit-gated and
      // can derive its stable `cv-` filename. Every other case ignores them.
      return (
        <PhotoFieldWidget
          {...shared}
          contactId={contactId}
          colName={field.col_name}
        />
      );
    default:
      return <TextFieldWidget {...shared} />;
  }
}

const styles = StyleSheet.create({
  withError: { gap: 4 },
});
