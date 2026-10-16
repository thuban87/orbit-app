// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
/**
 * The Profile's Birthday sheet (38.11 D-56, D-59, D-61), opened from the
 * Relationship Overview's Birthday tile like the other Overview sheets. It
 * reuses the shared `BirthdayField` (38.11-04): the date row opens the native
 * picker (capped at today), the Year unknown switch never stores the 2000
 * placeholder (D-61: switching it off asks for the year, a cancel leaves it
 * on), and Clear. Every change saves at once through `onSave` (D-59); the sheet
 * owns no DAO.
 *
 * The shown value always follows the STORED value (`birthday`): after a save
 * the host reloads and passes the new value; after a failed save nothing
 * changed, so the sheet keeps showing what is stored. A year-unknown birthday
 * therefore shows its 2000 placeholder on the date row (every month/day stays
 * pickable under the today cap), and switching Year unknown off asks on
 * `yearAskSeed` (review V-10).
 *
 * Feedback (38.9 feedback rule): "Birthday saved", or "Birthday cleared" for
 * Clear, which also closes the sheet because the tile hides. Clear, and Year
 * unknown ON when it drops a stored year, are reversible data losses, so per
 * the destructive-action rule (38.9 D-30) their snackbar carries Undo, which
 * restores the previous stored value through the same `onSave`; Undo confirms
 * with "Birthday restored" (38.9 D-39). A failure keeps the sheet open and
 * shows "Couldn't save the birthday. Try again.".
 */
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { BirthdayField } from "@/components/BirthdayField";
import {
  type BirthdayFieldState,
  birthdayFieldStateFromStored,
  birthdayStorage,
} from "@/components/birthday-field-logic";
import { AppText, Button } from "@/components/ui";
import { Sheet } from "@/components/ui/Sheet";
import { showSnackbar } from "@/stores/snackbar-store";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "birthday-sheet";

export const BIRTHDAY_SAVED = "Birthday saved";
export const BIRTHDAY_CLEARED = "Birthday cleared";
export const BIRTHDAY_RESTORED = "Birthday restored";
export const BIRTHDAY_SAVE_ERROR = "Couldn't save the birthday. Try again.";

/** What a sheet change does to the stored birthday. */
export type BirthdayChangeKind = "none" | "saved" | "year-dropped" | "cleared";

/**
 * Classify a change from the stored value to the value the control would
 * store. `year-dropped` is Year unknown ON over a known year (`YYYY-MM-DD` →
 * its `MM-DD`); it and `cleared` lose data, so they offer Undo.
 */
export function classifyBirthdayChange(
  previous: string | null,
  next: string | null,
): BirthdayChangeKind {
  if (next === previous) return "none";
  if (next === null) return "cleared";
  if (previous !== null && previous.length === 10 && next === previous.slice(5))
    return "year-dropped";
  return "saved";
}

/** Undo restores the previous stored value through the same setter. */
function undoTo(
  previous: string | null,
  onSave: (birthday: string | null) => Promise<void>,
): void {
  void (async () => {
    try {
      await onSave(previous);
    } catch (cause) {
      Logger.error(LOG_SCOPE, "failed to undo a birthday change", cause);
      showSnackbar({ kind: "error", label: BIRTHDAY_SAVE_ERROR });
      return;
    }
    showSnackbar({ kind: "success", label: BIRTHDAY_RESTORED });
  })();
}

export interface BirthdaySheetProps {
  visible: boolean;
  /** The stored birthday (`YYYY-MM-DD`, `MM-DD`) or null. */
  birthday: string | null;
  /** Saves the birthday (null clears); rejects on failure. */
  onSave: (birthday: string | null) => Promise<void>;
  onClose: () => void;
}

export function BirthdaySheet({
  visible,
  birthday,
  onSave,
  onClose,
}: BirthdaySheetProps) {
  const [pending, setPending] = useState(false);
  // Synchronous mirror so a second change in the same frame is ignored.
  const pendingRef = useRef(false);
  const value = birthdayFieldStateFromStored(birthday);

  const commit = async (next: BirthdayFieldState) => {
    if (pendingRef.current) return;
    const previous = birthday;
    const stored = birthdayStorage(next);
    const kind = classifyBirthdayChange(previous, stored);
    if (kind === "none") return;
    pendingRef.current = true;
    setPending(true);
    try {
      await onSave(stored);
    } catch (cause) {
      Logger.error(LOG_SCOPE, "failed to save the birthday", cause);
      showSnackbar({ kind: "error", label: BIRTHDAY_SAVE_ERROR });
      return;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
    const undo = {
      label: "Undo",
      onPress: () => undoTo(previous, onSave),
    };
    if (kind === "cleared") {
      showSnackbar({
        kind: "warning",
        label: BIRTHDAY_CLEARED,
        action: { ...undo, accessibilityLabel: "Undo clear birthday" },
      });
      // The tile hides once the birthday is gone, so the sheet closes too.
      onClose();
      return;
    }
    showSnackbar(
      kind === "year-dropped"
        ? {
            kind: "success",
            label: BIRTHDAY_SAVED,
            action: { ...undo, accessibilityLabel: "Undo year unknown" },
          }
        : { kind: "success", label: BIRTHDAY_SAVED },
    );
  };

  const close = () => {
    if (pendingRef.current) return;
    onClose();
  };

  return (
    <Sheet visible={visible} onRequestClose={close} variant="compact">
      <View style={styles.content}>
        <AppText role="heading" accessibilityRole="header">
          Birthday
        </AppText>
        <View
          testID="profile-birthday-body"
          pointerEvents={pending ? "none" : "auto"}
          accessibilityState={{ busy: pending }}
        >
          <BirthdayField
            testID="profile-birthday"
            value={value}
            onChange={(next) => void commit(next)}
            showLabel={false}
          />
        </View>
        {pending ? <AppText role="caption">Saving…</AppText> : null}
        <View style={styles.close}>
          <Button
            testID="profile-birthday-close"
            role="tertiary"
            label="Close"
            onPress={close}
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: SPACING.sm, paddingBottom: SPACING.base },
  close: { marginTop: SPACING.sm },
});
