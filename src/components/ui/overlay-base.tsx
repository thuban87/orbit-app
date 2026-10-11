/**
 * overlay-base (THEME-10 / dossier §O) — the shared scaffolding EVERY overlay
 * variant (Sheet / ConfirmDialog, plus CardContextMenu) is built on, so they
 * share ONE scrim, lifecycle and dismissal contract rather than re-implementing
 * it. (The full-screen `ui/Modal` variant had no consumer and was removed in
 * 38.9.)
 *
 * Scrim idiom (dossier §O): `colors.background` at a fixed opacity — NEVER a
 * colour literal — matching the existing `DropdownFieldWidget` pattern.
 *
 * Android lifecycle contract (REVIEWS 23-07 MEDIUM). Every overlay declares:
 *   - `visible` + `onRequestClose` (RN `Modal.onRequestClose` is the Android
 *     hardware-Back hook), so a reusable overlay NEVER silently traps Back;
 *   - focus handling on open (a11y focus moves onto the overlay content);
 *   - an explicit dismissal policy via `dismissable`:
 *       dismissable=true  → scrim-tap AND Android Back call `onRequestClose`
 *                           (non-destructive Modal/Sheet);
 *       dismissable=false → scrim is INERT and Back is a no-op, so a destructive
 *                           ConfirmDialog requires an explicit button choice.
 *
 * Glass scope boundary (RG-029 / D-24): overlay content renders inside
 * `UnscopedTheme`, so an overlay opened from a Standard-Light glass card or the
 * app bar does not inherit the glass foreground palette.
 *
 * Open-overlay registry + in-window snackbar (38.9 D-24, D-40, D-51): the
 * window is a `RegisteredModal`, so it registers as a "sheet" or "dialog"
 * while visible, and a `<Snackbar host={hostId} />` renders as the LAST child
 * of the root View inside the GestureHandlerRootView. A snackbar fired while
 * this overlay is the topmost window shows inside it, above the nav bar.
 *
 * No colour literal here (check:colors); this file is `.tsx` because it renders.
 */
import { type ReactNode, useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Snackbar } from "@/components/Snackbar";
import { UnscopedTheme, useTheme } from "@/theme";
// 38.9 D-24/D-40: the window registers in the open-overlay registry while
// visible and carries its own snackbar host. Imported under the historical
// local name so the gesture-root contract reads unchanged.
import { RegisteredModal as RNModal } from "./RegisteredModal";

/** Scrim opacity applied to `colors.background` (the DropdownFieldWidget idiom). */
export const SCRIM_OPACITY = 0.85;

/**
 * The shared Android overlay lifecycle props EVERY variant exposes (REVIEWS
 * 23-07 MEDIUM). `onRequestClose` is wired to Android system Back.
 */
export interface OverlayLifecycle {
  /** Whether the overlay is shown. */
  visible: boolean;
  /** Android Back / scrim-tap dismissal handler (a no-op when non-dismissable). */
  onRequestClose: () => void;
}

export interface BaseOverlayProps extends OverlayLifecycle {
  children: ReactNode;
  /**
   * Dismissal policy. `true` (default) — scrim-tap AND Android Back dismiss.
   * `false` — inert scrim + Back no-op (destructive confirmation, explicit
   * choice only).
   */
  dismissable?: boolean;
  /** Vertical placement of the content region. */
  justify?: "center" | "flex-end";
  /** Extra style for the content wrapper (e.g. dialog horizontal padding). */
  contentStyle?: StyleProp<ViewStyle>;
  /** Accessible label for the dismiss-scrim (dismissable overlays). */
  scrimAccessibilityLabel?: string;
  /**
   * How this window reports in the open-overlay registry (38.9 D-24).
   * Defaults to "sheet"; ConfirmDialog passes "dialog".
   */
  overlayKind?: "sheet" | "dialog";
}

const noop = () => {};

export function BaseOverlay({
  visible,
  onRequestClose,
  children,
  dismissable = true,
  justify = "center",
  contentStyle,
  scrimAccessibilityLabel,
  overlayKind = "sheet",
}: BaseOverlayProps) {
  const { colors } = useTheme();
  const contentRef = useRef<View>(null);

  // Focus handling on open: land screen-reader focus INSIDE the overlay so it is
  // not read behind the scrim.
  useEffect(() => {
    if (!visible) return;
    const handle = findNodeHandle(contentRef.current);
    if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
  }, [visible]);

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      // Declared on EVERY variant so Back is never trapped; a no-op only for a
      // non-dismissable (destructive) overlay, which requires an explicit choice.
      onRequestClose={dismissable ? onRequestClose : noop}
      overlayKind={overlayKind}
      // The in-window snackbar host is placed below, inside the gesture root.
      renderSnackbarHost={false}
    >
      {/* Android RN Modal content is a separate native root; RNGH's installed
          and official Modal guidance requires its own full-height root. */}
      {(hostId) => (
        <GestureHandlerRootView style={styles.root}>
          <View style={[styles.root, { justifyContent: justify }]}>
            {dismissable ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={scrimAccessibilityLabel ?? "Dismiss"}
                style={StyleSheet.absoluteFill}
                onPress={onRequestClose}
              >
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    styles.scrim,
                    { backgroundColor: colors.background },
                  ]}
                />
              </Pressable>
            ) : (
              // Inert scrim (no onPress): a scrim-tap cannot dismiss a destructive
              // confirmation.
              <View
                style={[
                  StyleSheet.absoluteFill,
                  styles.scrim,
                  { backgroundColor: colors.background },
                ]}
              />
            )}
            {/* box-none: a full-height content frame (the Sheet's flex: 1
                wrapper) must not swallow taps on the empty area above the
                surface, or the scrim beneath it never receives them (ADR-174 /
                D-06: a non-destructive overlay dismisses on scrim tap). The
                surface's own Views still take touches. */}
            <View
              ref={contentRef}
              collapsable={false}
              pointerEvents="box-none"
              style={contentStyle}
            >
              {/* Overlays are opaque surfaces: reset any glass foreground scope
                  they were opened from so sheets/dialogs keep the normal text
                  hierarchy (RG-029 / D-24). A GlassSurface card inside an overlay
                  re-enters its own scope. */}
              <UnscopedTheme>{children}</UnscopedTheme>
            </View>
            {/* Last child: renders only while this window is the topmost
                registered overlay (D-40). */}
            <Snackbar host={hostId} />
          </View>
        </GestureHandlerRootView>
      )}
    </RNModal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrim: { opacity: SCRIM_OPACITY },
});
