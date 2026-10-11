/**
 * Dropdown value widget (FLD-04). RN rewrite of the plugin `FormRenderer`
 * `dropdown` case WITHOUT a picker dependency. Since 38.9 D-28 it opens the
 * one themed `OptionSheet` from an `OptionSelectRow` trigger, like every other
 * single choice in the app ("Met via" and every other custom dropdown).
 *
 * Out-of-list preservation (CONTEXT; CLAUDE.md custom-field invariants): if
 * the current value is NOT in `options` (e.g. an options edit dropped it), it
 * is STILL listed as a selectable raw entry and stays selected, so no data is
 * lost, cleared or coerced. The prepend lives in the shared `selectorItems`
 * helper (RG-030). `CustomFieldValue` surfaces such a value as the SAME
 * tap-to-fix error state via `isValueInOptions`. The widget emits only what
 * the user picks; storage stays raw TEXT.
 *
 * Accessibility (38.4 RG-030, ui-accessibility/AUD-UIA-005): the trigger names
 * the field (`label`) AND exposes the current value (`selectorAccessibilityValue`
 * inside `OptionSelectRow`); the selected option carries
 * `accessibilityState.selected` plus a filled `select` glyph (inside
 * `OptionSheet`), so selection never depends on colour alone.
 */
import { useState } from "react";
import { selectorItems } from "@/components/selector-a11y";
import { OptionSelectRow } from "@/components/ui/OptionSelectRow";
import { OptionSheet } from "@/components/ui/OptionSheet";
import type { FieldWidgetProps } from "./types";

export function DropdownFieldWidget({
  value,
  onChange,
  label,
  options = [],
  testID,
}: FieldWidgetProps) {
  const [open, setOpen] = useState(false);
  const selected = value ?? "";
  // Preserve an out-of-list value by prepending it to the option set.
  const items = selectorItems(selected, options);
  const sheetOptions = items.map((item) => ({ value: item, label: item }));

  return (
    <>
      <OptionSelectRow
        testID={testID}
        label={label}
        currentLabel={selected}
        onPress={() => setOpen(true)}
      />
      <OptionSheet
        visible={open}
        title={label}
        options={sheetOptions}
        selected={selected}
        onSelect={(item) => onChange(item)}
        onRequestClose={() => setOpen(false)}
      />
    </>
  );
}
