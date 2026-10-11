/**
 * FieldError — the inline-validation message (38.9 D-19, D-40).
 *
 * Caption text in the theme's `danger` colour, placed directly under its
 * field. Renders nothing when there is no message. The owning screen clears
 * the message when the field changes, and Save stays pressable (CAPT-14).
 * `accessibilityLiveRegion="polite"` lets TalkBack read the error when it
 * appears. Colour resolves through `useTheme()` (check:colors).
 */
import { useTheme } from "@/theme";
import { AppText } from "./AppText";

export interface FieldErrorProps {
  message?: string | null;
  testID?: string;
}

export function FieldError({ message, testID }: FieldErrorProps) {
  const { colors } = useTheme();
  if (!message) return null;
  return (
    <AppText
      role="caption"
      testID={testID}
      accessibilityLiveRegion="polite"
      style={{ color: colors.danger }}
    >
      {message}
    </AppText>
  );
}
