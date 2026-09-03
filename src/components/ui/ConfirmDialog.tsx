/**
 * ConfirmDialog (THEME-10 / dossier §O, §P) — the shared centered confirmation
 * dialog for yes/no + DESTRUCTIVE confirmations.
 *
 * Destructive-beyond-colour contract (dossier §P / THEME-10). When
 * `destructive`:
 *   - the confirm control is the Destructive `Button` (danger fill + the reserved
 *     `warning` registry glyph + `onDanger` foreground) — colour is never the
 *     only cue;
 *   - a `warning` glyph also heads the dialog and the title NAMES the action;
 *   - the dialog does NOT dismiss on scrim-tap or a stray Android Back (it
 *     requires an explicit button choice) — `dismissable=false` on the shared
 *     `BaseOverlay` (REVIEWS 23-07 MEDIUM).
 * A non-destructive dialog uses a Primary confirm and MAY dismiss on scrim-tap /
 * Back.
 *
 * Shares radius/scrim/spacing/typography with `Modal`/`Sheet` via `overlay-base`.
 * No colour literal (check:colors).
 */
// biome-ignore-all lint/a11y/useValidAriaRole: `role` on AppText (semantic
// typography role) and Button (semantic button role Primary/Secondary/…) is a
// domain prop, NOT an ARIA role — the a11y lint false-fires on the prop name
// (same precedent as ThemePreviewScreen.tsx).
import { StyleSheet, View } from "react-native";
import { Icon } from "@/components/icons/Icon";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { AppText } from "./AppText";
import { Button } from "./Button";
import { BaseOverlay, type OverlayLifecycle } from "./overlay-base";

export interface ConfirmDialogProps extends OverlayLifecycle {
  /** Names the action being confirmed (required — the destructive path names it). */
  title: string;
  /** Optional supporting body copy. */
  message?: string;
  /** Confirm button label (e.g. "Delete"). */
  confirmLabel: string;
  /** Cancel button label; defaults to "Cancel". */
  cancelLabel?: string;
  onConfirm: () => void;
  /** Defaults to `onRequestClose`. */
  onCancel?: () => void;
  /**
   * When true the confirm is a Destructive Button (warning glyph + onDanger) and
   * the dialog requires an explicit choice — no scrim/Back dismissal.
   */
  destructive?: boolean;
}

export function ConfirmDialog({
  visible,
  onRequestClose,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmDialogProps) {
  const { colors } = useTheme();
  const cancel = onCancel ?? onRequestClose;

  return (
    <BaseOverlay
      visible={visible}
      onRequestClose={onRequestClose}
      // Destructive confirmations require an explicit choice: inert scrim + Back
      // no-op. Non-destructive dialogs may dismiss.
      dismissable={!destructive}
      justify="center"
      contentStyle={styles.contentWrap}
      scrimAccessibilityLabel="Dismiss"
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.border,
          },
        ]}
      >
        {destructive ? (
          <View style={styles.header}>
            <Icon name="warning" tone="danger" size="md" />
          </View>
        ) : null}
        <AppText role="heading">{title}</AppText>
        {message ? (
          <AppText role="body" style={{ color: colors.textSecondary }}>
            {message}
          </AppText>
        ) : null}
        <View style={styles.actions}>
          <Button role="secondary" label={cancelLabel} onPress={cancel} />
          <Button
            role={destructive ? "destructive" : "primary"}
            label={confirmLabel}
            onPress={onConfirm}
          />
        </View>
      </View>
    </BaseOverlay>
  );
}

const styles = StyleSheet.create({
  contentWrap: {
    width: "100%",
    paddingHorizontal: SPACING.lg,
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: RADII.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  header: {
    alignItems: "flex-start",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
});
