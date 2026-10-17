// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button/AppText `role` is a domain prop, not ARIA.
/**
 * PhotoBudgetSheet (38.12 D-133) — asked before an import whose photos may not
 * fit in the encrypted backup (or whose size could not be checked, convergence
 * c4 E-1). Four choices, in this order: Import with smaller photos (primary),
 * Import without photos, Continue anyway (with the backup warning), Go back.
 * `confirm-store`'s `choose()` has only three outcomes, so this is a Sheet.
 *
 * `usePhotoBudgetPrompt()` returns the `sheet` element a screen renders and the
 * `ask` promise it passes as `decidePhotoBudget`; dismissing resolves "back".
 *
 * No colour literal (check:colors).
 */
import {
  type ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import {
  type PhotoBudgetChoice,
  type PhotoBudgetEstimate,
  photoBudgetBody,
} from "@/services/import/import-photo-budget";
import { SPACING } from "@/theme/tokens/spacing";

export const PHOTO_BUDGET_TITLE = "These photos may not fit in your backups";
export const PHOTO_BUDGET_CONTINUE_WARNING =
  "Backups will stop working until some photos are removed.";

export interface PhotoBudgetSheetProps {
  visible: boolean;
  estimate: PhotoBudgetEstimate;
  onChoose: (choice: PhotoBudgetChoice) => void;
  /** Scrim tap and system Back: the same as "Go back". */
  onRequestClose: () => void;
}

export function PhotoBudgetSheet({
  visible,
  estimate,
  onChoose,
  onRequestClose,
}: PhotoBudgetSheetProps) {
  return (
    <Sheet visible={visible} onRequestClose={onRequestClose} variant="compact">
      <AppText role="heading" accessibilityRole="header">
        {PHOTO_BUDGET_TITLE}
      </AppText>
      <AppText role="body" testID="photo-budget-body" style={styles.body}>
        {photoBudgetBody(estimate)}
      </AppText>
      <View style={styles.options}>
        <Button
          role="primary"
          label="Import with smaller photos"
          onPress={() => onChoose("smaller")}
        />
        <Button
          role="secondary"
          label="Import without photos"
          onPress={() => onChoose("without")}
        />
        <View style={styles.choice}>
          <Button
            role="secondary"
            label="Continue anyway"
            onPress={() => onChoose("continue")}
          />
          <AppText role="caption" testID="photo-budget-continue-warning">
            {PHOTO_BUDGET_CONTINUE_WARNING}
          </AppText>
        </View>
        <Button
          role="tertiary"
          label="Go back"
          onPress={() => onChoose("back")}
        />
      </View>
    </Sheet>
  );
}

interface PendingAsk {
  estimate: PhotoBudgetEstimate;
  resolve: (choice: PhotoBudgetChoice) => void;
}

/** The sheet plus a promise-returning `ask` for routePickedImport (D-133). */
export function usePhotoBudgetPrompt(): {
  sheet: ReactElement;
  ask: (estimate: PhotoBudgetEstimate) => Promise<PhotoBudgetChoice>;
} {
  const [pending, setPending] = useState<PendingAsk | null>(null);
  const pendingRef = useRef<PendingAsk | null>(null);

  const settle = useCallback((choice: PhotoBudgetChoice) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    current?.resolve(choice);
  }, []);

  const ask = useCallback(
    (estimate: PhotoBudgetEstimate) =>
      new Promise<PhotoBudgetChoice>((resolve) => {
        // A second ask supersedes the first, which goes back.
        pendingRef.current?.resolve("back");
        const next = { estimate, resolve };
        pendingRef.current = next;
        setPending(next);
      }),
    [],
  );

  // Leaving the screen with the sheet up is "Go back": nothing is imported.
  useEffect(
    () => () => {
      pendingRef.current?.resolve("back");
      pendingRef.current = null;
    },
    [],
  );

  const sheet = (
    <PhotoBudgetSheet
      visible={pending !== null}
      estimate={pending?.estimate ?? null}
      onChoose={settle}
      onRequestClose={() => settle("back")}
    />
  );
  return { sheet, ask };
}

const styles = StyleSheet.create({
  body: { marginTop: SPACING.sm },
  options: { marginTop: SPACING.base, gap: SPACING.sm },
  choice: { gap: SPACING.xs },
});
