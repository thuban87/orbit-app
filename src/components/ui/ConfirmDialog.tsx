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
 * Back, unless the caller passes `dismissable={false}` (a Cancel with a side
 * effect). The effective policy is `effectiveDismissable` (confirm-store):
 * `!destructive && (dismissable ?? true)`, so a destructive confirm can never
 * be made dismissable (D-06, ADR-086; 38.9 D-24).
 *
 * Look (38.9 D-43, DLG-B): the elevated card with a 2dp `borderStrong` border.
 * `headingGlyph` (default `destructive`) controls the warning glyph above the
 * title; the "Discard changes?" prompt turns it off and keeps the ⚠ on its
 * button only (D-52). `variant="notice"` is the one-button notice: a single
 * Primary acknowledge button in the same actions container (D-24, D-27).
 *
 * Large text (RG-034 / ui-accessibility/AUD-UIA-011, confirmed on device at
 * font_scale 2.0 on ≈320dp and ≈349dp): the choices are first laid out in a
 * wrapping row to read their natural widths (each capped at the card width).
 * If both fit, the original single right-aligned row is kept; otherwise they
 * stack full-width in reading order, so a long destructive label can no
 * longer crush Cancel off the card. The title and message scroll inside a
 * card that shrinks to the window between the system bars, so both explicit
 * choices always stay on-screen.
 *
 * Shares radius/scrim/spacing/typography with `Sheet` via `overlay-base`.
 * No colour literal (check:colors).
 */
// biome-ignore-all lint/a11y/useValidAriaRole: `role` on AppText (semantic
// typography role) and Button (semantic button role Primary/Secondary/…) is a
// domain prop, NOT an ARIA role — the a11y lint false-fires on the prop name
// (same precedent as ThemePreviewScreen.tsx).
import { useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/icons/Icon";
import { effectiveDismissable } from "@/stores/confirm-store";
import { useUnscopedTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { AppText } from "./AppText";
import { Button } from "./Button";
import { confirmActionsFit } from "./confirm-dialog-layout";
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
  confirmDisabled?: boolean;
  /**
   * Back/scrim dismissal (default true). Never applies to a destructive
   * dialog: `effectiveDismissable` keeps it non-dismissable (ADR-086).
   */
  dismissable?: boolean;
  /** Warning glyph above the title; defaults to `destructive` (D-52). */
  headingGlyph?: boolean;
  /**
   * "confirm" (default): Cancel + confirm. "notice": one Primary button
   * labelled `confirmLabel` (the acknowledge label); `onCancel` is unused.
   */
  variant?: "confirm" | "notice";
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
  confirmDisabled = false,
  dismissable,
  headingGlyph = destructive,
  variant = "confirm",
}: ConfirmDialogProps) {
  // The dialog is an opaque surface: read the ROOT palette so its body text
  // keeps the secondary role even when opened from a glass scope (RG-029).
  const { colors } = useUnscopedTheme();
  const insets = useSafeAreaInsets();
  const cancel = onCancel ?? onRequestClose;

  return (
    <BaseOverlay
      visible={visible}
      onRequestClose={onRequestClose}
      // Destructive confirmations require an explicit choice: inert scrim + Back
      // no-op. Non-destructive dialogs may dismiss unless the caller opts out.
      dismissable={effectiveDismissable({ destructive, dismissable })}
      overlayKind="dialog"
      justify="center"
      contentStyle={[
        styles.contentWrap,
        {
          paddingTop: insets.top + SPACING.lg,
          paddingBottom: insets.bottom + SPACING.lg,
        },
      ]}
      scrimAccessibilityLabel="Dismiss"
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.borderStrong,
          },
        ]}
      >
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
        >
          {headingGlyph ? (
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
        </ScrollView>
        <ConfirmActions
          notice={variant === "notice"}
          cancelLabel={cancelLabel}
          confirmLabel={confirmLabel}
          destructive={destructive}
          confirmDisabled={confirmDisabled}
          onCancel={cancel}
          onConfirm={onConfirm}
        />
      </View>
    </BaseOverlay>
  );
}

type ActionsLayout = "measuring" | "row" | "stacked";

/**
 * The two explicit choices. Rendered inside the overlay, so it remounts (and
 * re-measures) every time the dialog opens. Exported for other overlays with a
 * Cancel + confirm pair that must stack at large text (38.4 D-72:
 * GroupTitlePromptSheet). `notice` renders the one-button notice: a single
 * Primary `confirmLabel` button, right-aligned like the row layout.
 * `cancelDisabled` draws Cancel with the Button disabled look (D-26) for a
 * host that holds its exits while work runs (38.9 fix-pass WR-01).
 */
export function ConfirmActions({
  notice = false,
  cancelLabel,
  confirmLabel,
  destructive,
  confirmDisabled,
  cancelDisabled = false,
  onCancel,
  onConfirm,
}: {
  notice?: boolean;
  cancelLabel: string;
  confirmLabel: string;
  destructive: boolean;
  confirmDisabled: boolean;
  cancelDisabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [layout, setLayout] = useState<ActionsLayout>("measuring");
  const widths = useRef({ row: 0, cancel: 0, confirm: 0 });
  const measure =
    (key: "row" | "cancel" | "confirm") => (event: LayoutChangeEvent) => {
      if (layout !== "measuring") return;
      widths.current[key] = event.nativeEvent.layout.width;
      const fit = confirmActionsFit({ ...widths.current, gap: SPACING.sm });
      if (fit !== null) setLayout(fit ? "row" : "stacked");
    };
  const stacked = layout === "stacked";
  const actionStyle = stacked ? styles.actionStacked : styles.action;

  if (notice) {
    // One choice: nothing to fit, so no measuring pass.
    return (
      <View style={styles.actionsRow}>
        <View style={styles.action}>
          <Button
            role="primary"
            label={confirmLabel}
            disabled={confirmDisabled}
            onPress={onConfirm}
          />
        </View>
      </View>
    );
  }

  return (
    <View
      style={
        layout === "measuring"
          ? styles.actions
          : stacked
            ? styles.actionsStacked
            : styles.actionsRow
      }
      onLayout={measure("row")}
    >
      <View style={actionStyle} onLayout={measure("cancel")}>
        <Button
          role="secondary"
          label={cancelLabel}
          disabled={cancelDisabled}
          onPress={onCancel}
        />
      </View>
      <View style={actionStyle} onLayout={measure("confirm")}>
        <Button
          role={destructive ? "destructive" : "primary"}
          label={confirmLabel}
          disabled={confirmDisabled}
          onPress={onConfirm}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Shrinks to the overlay root so the card never outgrows the window.
  contentWrap: {
    width: "100%",
    flexShrink: 1,
    paddingHorizontal: SPACING.lg,
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    flexShrink: 1,
    borderRadius: RADII.lg,
    // D-43 (DLG-B): the stronger themed-dialog border, colour borderStrong.
    borderWidth: 2,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  // Title + message give up height first; the actions below never scroll away.
  body: {
    flexGrow: 0,
    flexShrink: 1,
  },
  bodyContent: {
    gap: SPACING.md,
  },
  header: {
    alignItems: "flex-start",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  // The original layout, kept whenever both choices fit on one line.
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  actionsStacked: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  action: {
    maxWidth: "100%",
  },
  actionStacked: {
    alignSelf: "stretch",
  },
});
