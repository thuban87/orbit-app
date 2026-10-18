// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
/**
 * Edit Contact's Custom Fields section and its open-at-a-field reveal
 * (38.12 D-70; convergence c1 C-4, C-5). Extracted from EditContactScreen so
 * the section and the reveal can be render-tested without the whole form.
 *
 * - `EditCustomFieldsSection` renders every non-quarantined field through
 *   `FieldValueInput`. A field whose input still holds its saved value, and
 *   whose saved value is flagged (`isFlaggedCustomValue`, through
 *   `customFieldValueError`), shows the problem and the expected format. The
 *   error goes once the user changes the value. Nothing rewrites the stored
 *   value (CLAUDE.md custom-field invariants).
 * - `useFocusFieldReveal` handles `focusFieldDefId`. The section starts
 *   collapsed, and `AccordionSection` mounts its body only when expanded, so
 *   the target row does not exist yet. Once the form has hydrated it expands
 *   the section, waits for the target row's `onLayout` (it mounts only after
 *   the expand), and then reveals that row with the form's reveal helper. It
 *   runs once per opened field id. Best-effort: a failed measure leaves the
 *   section open, just not scrolled.
 */
import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { FieldValueInput } from "@/components/FieldValueInput";
import { customFieldValueError } from "@/components/field-value-error";
import { AccordionSection } from "@/components/ui/AccordionSection";
import { AppText } from "@/components/ui/AppText";
import type { CustomFieldDef } from "@/db/field-types";
import { useTheme } from "@/theme";

export const CUSTOM_SECTION_ID = "custom";

/**
 * The error for one field: only while the input still holds the saved value,
 * so a value the user has just fixed (not yet saved) stops showing it.
 */
export function editCustomFieldError(
  def: Pick<CustomFieldDef, "type" | "options">,
  draft: string | null | undefined,
  saved: string | null | undefined,
) {
  const value = draft ?? null;
  if (value !== (saved ?? null)) return null;
  return customFieldValueError(def, value);
}

export interface FocusFieldRevealOptions {
  /** The field to open at, from the route (D-70). */
  focusFieldDefId: number | undefined;
  /** True once the form has hydrated and the field is among the form's defs. */
  ready: boolean;
  /** Expands the Custom Fields section. */
  expand: () => void;
  /** The form's reveal helper (useFirstErrorReveal): scrolls a node into view. */
  reveal: (node: View | null) => void;
}

export function useFocusFieldReveal({
  focusFieldDefId,
  ready,
  expand,
  reveal,
}: FocusFieldRevealOptions) {
  // The field id whose expand has run, and the one already revealed, so each
  // opened field is handled once.
  const expandedForRef = useRef<number | null>(null);
  const revealedForRef = useRef<number | null>(null);
  const rowsRef = useRef(new Map<number, View | null>());
  const rowRefSetters = useRef(new Map<number, (node: View | null) => void>());

  useEffect(() => {
    if (!ready || focusFieldDefId === undefined) return;
    if (expandedForRef.current === focusFieldDefId) return;
    expandedForRef.current = focusFieldDefId;
    revealedForRef.current = null;
    expand();
  }, [ready, focusFieldDefId, expand]);

  const registerRow = useCallback((defId: number) => {
    let setter = rowRefSetters.current.get(defId);
    if (!setter) {
      setter = (node: View | null) => {
        rowsRef.current.set(defId, node);
      };
      rowRefSetters.current.set(defId, setter);
    }
    return setter;
  }, []);

  const onRowLayout = useCallback(
    (defId: number) => {
      if (defId !== focusFieldDefId) return;
      // Never before hydration's expand, and once per opened field.
      if (expandedForRef.current !== defId) return;
      if (revealedForRef.current === defId) return;
      revealedForRef.current = defId;
      reveal(rowsRef.current.get(defId) ?? null);
    },
    [focusFieldDefId, reveal],
  );

  return { registerRow, onRowLayout };
}

export interface EditCustomFieldsSectionProps {
  defs: readonly CustomFieldDef[];
  /** The form's draft values, keyed by `col_name`. */
  values: Readonly<Record<string, string | null>>;
  /** The saved values, keyed by `col_name` (the error baseline). */
  savedValues: Readonly<Record<string, string | null>>;
  contactId: number;
  expanded: boolean;
  onExpandedChange: (next: boolean) => void;
  containerRef?: (node: View | null) => void;
  onChange: (colName: string, value: string | null) => void;
  registerRow: (defId: number) => (node: View | null) => void;
  onRowLayout: (defId: number) => void;
}

export function EditCustomFieldsSection({
  defs,
  values,
  savedValues,
  contactId,
  expanded,
  onExpandedChange,
  containerRef,
  onChange,
  registerRow,
  onRowLayout,
}: EditCustomFieldsSectionProps) {
  const { colors } = useTheme();
  return (
    <AccordionSection
      sectionId={CUSTOM_SECTION_ID}
      title="Custom Fields"
      expanded={expanded}
      onExpandedChange={onExpandedChange}
      containerRef={containerRef}
    >
      <View testID="edit-contact-custom-block" style={styles.customBlock}>
        {defs.map((def) => (
          <View
            key={def.id}
            ref={registerRow(def.id)}
            testID={`edit-contact-custom-row-${def.id}`}
            onLayout={() => onRowLayout(def.id)}
            style={styles.field}
          >
            <AppText role="label" style={{ color: colors.textSecondary }}>
              {def.label}
            </AppText>
            <FieldValueInput
              testID={`edit-contact-custom-${def.col_name}`}
              field={def}
              contactId={contactId}
              value={values[def.col_name] ?? null}
              onChange={(value) => onChange(def.col_name, value)}
              error={editCustomFieldError(
                def,
                values[def.col_name],
                savedValues[def.col_name],
              )}
            />
          </View>
        ))}
      </View>
    </AccordionSection>
  );
}

const styles = StyleSheet.create({
  customBlock: { gap: 16 },
  field: { gap: 8 },
});
