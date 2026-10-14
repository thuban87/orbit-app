/**
 * EntryTextField — the shared entry text field (38.10 D-66).
 *
 * - Wraps as multi-line, grows to about 3 lines, then scrolls with the cursor
 *   in view (`maxHeight` = 3 body lines + vertical padding).
 * - The keyboard's action key (Done by default) fires `onSubmit` and inserts
 *   no newline: `multiline` with the submit `submitBehavior` (RESEARCH A3,
 *   confirmed in RN 0.86.2). The field blurs first, so the keyboard closes
 *   even when the host unmounts it. The host keeps a visible Save button too.
 * - While typing, each change goes through `sanitizeEntryChange`: a newly
 *   typed or pasted line break becomes a space, a line break already in the
 *   value is kept (D-129), and nothing is trimmed, so a typed trailing space
 *   survives. Hosts trim with `normalizeEntryText` only at save
 *   (convergence c1 F-U2, Codex C-05).
 * - On focus and on blur it tells the nearest `KeyboardCenteringProvider`, if
 *   any, so the host centres it above the keyboard. With no provider it works
 *   the same minus centring (D-66 scope; convergence c1 F-U1).
 *
 * Colours and typography come from theme tokens only (CLAUDE.md).
 */
import { useRef } from "react";
import {
  type BlurEvent,
  type FocusEvent,
  type ReturnKeyTypeOptions,
  StyleSheet,
  TextInput,
} from "react-native";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { resolveFontFamily, TYPOGRAPHY } from "@/theme/tokens/typography";
import { sanitizeEntryChange } from "./entry-text-logic";
import { useKeyboardCenteringContext } from "./KeyboardCenteringProvider";

/** Lines shown before the field scrolls (D-66: "about 3 lines"). */
export const ENTRY_VISIBLE_LINES = 3;

const BODY = TYPOGRAPHY.body;
const VERTICAL_PADDING = SPACING.sm;
const MAX_HEIGHT = ENTRY_VISIBLE_LINES * BODY.lineHeight + 2 * VERTICAL_PADDING;

export interface EntryTextFieldProps {
  value: string;
  /**
   * Receives the sanitized value: no newly typed or pasted line break (stored
   * ones are kept, D-129), never trimmed.
   */
  onChangeText: (value: string) => void;
  /** Fires on the keyboard's action key; the host saves. */
  onSubmit: () => void;
  placeholder?: string;
  accessibilityLabel: string;
  returnKeyType?: ReturnKeyTypeOptions;
  editable?: boolean;
  /** Focuses the field when it mounts (the share card's note, 38.10 D-136 S5). */
  autoFocus?: boolean;
  onFocus?: (event: FocusEvent) => void;
  onBlur?: (event: BlurEvent) => void;
  testID?: string;
}

export function EntryTextField({
  value,
  onChangeText,
  onSubmit,
  placeholder,
  accessibilityLabel,
  returnKeyType = "done",
  editable,
  autoFocus,
  onFocus,
  onBlur,
  testID,
}: EntryTextFieldProps) {
  const { colors } = useTheme();
  const centering = useKeyboardCenteringContext();
  const inputRef = useRef<TextInput>(null);

  const handleFocus = (event: FocusEvent) => {
    centering?.onFieldFocus(inputRef);
    onFocus?.(event);
  };
  const handleBlur = (event: BlurEvent) => {
    centering?.onFieldBlur(inputRef);
    onBlur?.(event);
  };

  return (
    <TextInput
      ref={inputRef}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      value={value}
      onChangeText={(text) => onChangeText(sanitizeEntryChange(value, text))}
      onSubmitEditing={() => {
        // Blur first: the host usually closes the form on submit, and a field
        // that unmounts while focused leaves Android's keyboard up with no
        // field, covering the screen's Save (38.10-19 device pass).
        inputRef.current?.blur();
        onSubmit();
      }}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      placeholderTextColor={colors.textPlaceholder}
      returnKeyType={returnKeyType}
      editable={editable}
      autoFocus={autoFocus}
      multiline
      submitBehavior="submit"
      scrollEnabled
      style={[
        styles.input,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
          color: colors.textPrimary,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: SPACING.sm,
    borderWidth: StyleSheet.hairlineWidth,
    fontFamily: resolveFontFamily(BODY.family, BODY.weight),
    fontSize: BODY.size,
    lineHeight: BODY.lineHeight,
    maxHeight: MAX_HEIGHT,
    minHeight: 44,
    paddingHorizontal: SPACING.sm,
    paddingVertical: VERTICAL_PADDING,
    textAlignVertical: "top",
  },
});
