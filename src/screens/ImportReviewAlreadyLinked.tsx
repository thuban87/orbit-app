// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button/AppText `role` is a domain prop, not ARIA.
/**
 * The single import review's already-linked state (38.12 D-53).
 *
 * A pick whose phone contact is already actively linked to an Orbit person
 * never shows an editable form: the review's load resolves the row as
 * already linked and finalizes the session (the same writes onImport's
 * already_linked branch makes, which stays as a race fallback), then shows
 * "Already in Orbit as <name>" with Open and Done. No paused import is left.
 *
 * 38.12 D-154: when that Orbit person is in the Bin, the pick is never
 * imported as a duplicate either. The row is resolved the same way (with the
 * 'in-bin' reason, so Import complete counts it under "In the Bin") and the
 * view shows "In the Bin: <name>" with Restore and Done. Restore brings the
 * person back with the Bin list's effects and Undo; the existing phone link
 * is kept, and the view then reads "Already in Orbit as <name>" with Open.
 *
 * No colour literal (check:colors).
 */
import { StyleSheet, View } from "react-native";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { getContactHeader } from "@/db/contact-read";
import {
  finalizeSessionIfTerminal,
  resolveAlreadyLinked,
} from "@/db/import-session-dao";
import type { SqlExecutor } from "@/db/types";
import { findActiveExternalLinkTarget } from "@/services/import/duplicate-evidence";
import { SPACING } from "@/theme/tokens/spacing";

export interface AlreadyLinkedReview {
  contactId: number;
  name: string;
  /** The linked person is in the Bin (D-154). */
  inBin: boolean;
}

/**
 * When the row's phone contact is already actively linked, resolve the row
 * and finalize the session, and return the Orbit person; otherwise null and
 * nothing is written.
 */
export async function resolveAlreadyLinkedReview(
  exec: SqlExecutor,
  input: {
    sessionId: number;
    rowId: number;
    externalContactId: string;
    now: string;
  },
): Promise<AlreadyLinkedReview | null> {
  // The deterministic lookup scoreImportCandidate runs first (its
  // already_linked outcome), without the duplicate scoring.
  const linked = await findActiveExternalLinkTarget(
    exec,
    "android",
    input.externalContactId,
  );
  if (linked == null) return null;
  const { contactId, inBin } = linked;
  const header = await getContactHeader(exec, contactId);
  await resolveAlreadyLinked(exec, input.rowId, contactId, input.now, inBin);
  await finalizeSessionIfTerminal(exec, input.sessionId, input.now);
  return { contactId, name: header?.name ?? "", inBin };
}

export function ImportReviewAlreadyLinked({
  name,
  inBin = false,
  restoring = false,
  onOpen,
  onRestore,
  onDone,
}: {
  name: string;
  /** D-154: the linked person is in the Bin. */
  inBin?: boolean;
  /** A Restore is in flight: the button is disabled. */
  restoring?: boolean;
  onOpen: () => void;
  onRestore?: () => void;
  onDone: () => void;
}) {
  return (
    <View testID="import-review-already-linked" style={styles.root}>
      <ShellAppBar variant="child" title="Review import" onBack={onDone} />
      <View style={styles.content}>
        <AppText role="body" testID="import-review-already-linked-message">
          {inBin ? `In the Bin: ${name}` : `Already in Orbit as ${name}`}
        </AppText>
        <View style={styles.actions}>
          {inBin ? (
            <Button
              role="primary"
              label="Restore"
              accessibilityLabel={`Restore ${name}`}
              disabled={restoring}
              onPress={() => onRestore?.()}
            />
          ) : (
            <Button role="primary" label="Open" onPress={onOpen} />
          )}
          <Button role="secondary" label="Done" onPress={onDone} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACING.base, gap: SPACING.base },
  actions: { gap: SPACING.sm },
});
