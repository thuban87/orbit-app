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
import { findActiveExternalLink } from "@/services/import/duplicate-evidence";
import { SPACING } from "@/theme/tokens/spacing";

export interface AlreadyLinkedReview {
  contactId: number;
  name: string;
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
  const contactId = await findActiveExternalLink(
    exec,
    "android",
    input.externalContactId,
  );
  if (contactId == null) return null;
  const header = await getContactHeader(exec, contactId);
  await resolveAlreadyLinked(exec, input.rowId, contactId, input.now);
  await finalizeSessionIfTerminal(exec, input.sessionId, input.now);
  return { contactId, name: header?.name ?? "" };
}

export function ImportReviewAlreadyLinked({
  name,
  onOpen,
  onDone,
}: {
  name: string;
  onOpen: () => void;
  onDone: () => void;
}) {
  return (
    <View testID="import-review-already-linked" style={styles.root}>
      <ShellAppBar variant="child" title="Review import" onBack={onDone} />
      <View style={styles.content}>
        <AppText role="body" testID="import-review-already-linked-message">
          {`Already in Orbit as ${name}`}
        </AppText>
        <View style={styles.actions}>
          <Button role="primary" label="Open" onPress={onOpen} />
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
