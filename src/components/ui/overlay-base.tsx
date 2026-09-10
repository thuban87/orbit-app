/**
 * overlay-base (THEME-10 / dossier §O) — the shared scaffolding EVERY overlay
 * variant (Modal / Sheet / ConfirmDialog) is built on, so they share ONE scrim,
 * lifecycle and dismissal contract rather than re-implementing three.
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
 * No colour literal here (check:colors); this file is `.tsx` because it renders.
 */
import { type ReactNode, useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Pressable,
  Modal as RNModal,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useTheme } from "@/theme";

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
    >
      {/* Android RN Modal content is a separate native root; RNGH's installed
          and official Modal guidance requires its own full-height root. */}
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
        <View ref={contentRef} collapsable={false} style={contentStyle}>
          {children}
        </View>
        </View>
      </GestureHandlerRootView>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrim: { opacity: SCRIM_OPACITY },
});
