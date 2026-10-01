/**
 * ORRERY LAB B — WP-2.2 instrument HUD treatment for the Orrery chrome (flag
 * `hudChrome`). Four hairline corner brackets in the instrument (accent) token
 * drawn over a glass plate — the same "lock bracket" language as the canvas
 * focus reticle — so the selector, view options, controls and the focus card
 * read as one edge-anchored HUD rather than dashboard widgets.
 *
 * Decorative only: `pointerEvents="none"`, hidden from accessibility, no text.
 * Colours come from the theme (`accent` used as a border FILL, not as a text
 * foreground — ADR-084 roles unaffected). Orrery screen only.
 */
import { StyleSheet, type TextStyle, View, type ViewStyle } from "react-native";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";

/** HUD plate geometry: a tighter instrument radius than the default card. */
export const HUD_PLATE: ViewStyle = { borderRadius: RADII.sm };
/** HUD caption type: tracked caps for fixed chrome words (visual only — a11y
 * names unchanged). Never applied to user content (System names). */
export const HUD_LABEL: TextStyle = {
  letterSpacing: 1.2,
  textTransform: "uppercase",
};
/** HUD user-content type (System name): lightly tracked, case preserved. */
export const HUD_NAME: TextStyle = { letterSpacing: 0.4 };

/** Corner arm length and stroke (dp). */
const ARM = 7;
const STROKE = 1.5;
/** Inset from the plate edge (dp) — inside the plate's rounded corner. */
const INSET = 3;
/** Bracket opacity (decorative; the plate's own border carries the edge). */
const BRACKET_OPACITY = 0.85;

export function OrreryHudCorners() {
  const { colors } = useTheme();
  const c = { borderColor: colors.accent };
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={styles.fill}
    >
      <View style={[styles.corner, styles.tl, c]} />
      <View style={[styles.corner, styles.tr, c]} />
      <View style={[styles.corner, styles.bl, c]} />
      <View style={[styles.corner, styles.br, c]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: BRACKET_OPACITY,
  },
  corner: { position: "absolute", width: ARM, height: ARM },
  tl: {
    top: INSET,
    left: INSET,
    borderTopWidth: STROKE,
    borderLeftWidth: STROKE,
  },
  tr: {
    top: INSET,
    right: INSET,
    borderTopWidth: STROKE,
    borderRightWidth: STROKE,
  },
  bl: {
    bottom: INSET,
    left: INSET,
    borderBottomWidth: STROKE,
    borderLeftWidth: STROKE,
  },
  br: {
    bottom: INSET,
    right: INSET,
    borderBottomWidth: STROKE,
    borderRightWidth: STROKE,
  },
});
