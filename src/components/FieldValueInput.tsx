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
 */
import type { CustomFieldDef } from "@/db/field-types";
import { DateFieldWidget } from "./field-widgets/DateFieldWidget";
import { DropdownFieldWidget } from "./field-widgets/DropdownFieldWidget";
import { NumberFieldWidget } from "./field-widgets/NumberFieldWidget";
import { PhotoFieldWidget } from "./field-widgets/PhotoFieldWidget";
import { TextAreaFieldWidget } from "./field-widgets/TextAreaFieldWidget";
import { TextFieldWidget } from "./field-widgets/TextFieldWidget";
import { ToggleFieldWidget } from "./field-widgets/ToggleFieldWidget";

/** The minimal DEFS shape the dispatcher reads. */
type FieldSpec = Pick<CustomFieldDef, "type" | "label" | "options">;

export interface FieldValueInputProps {
  field: FieldSpec;
  value: string | null;
  onChange: (value: string) => void;
  testID?: string;
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
  testID,
}: FieldValueInputProps) {
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
      return <DateFieldWidget {...shared} />;
    case "toggle":
      return <ToggleFieldWidget {...shared} />;
    case "number":
      return <NumberFieldWidget {...shared} />;
    case "photo":
      return <PhotoFieldWidget {...shared} />;
    default:
      return <TextFieldWidget {...shared} />;
  }
}
