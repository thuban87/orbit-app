/**
 * 38.7-12 (D-22): Lab B's instrument corner brackets on the Orrery HUD
 * (Lab B `OrreryHudCorners.tsx`, WP-2.2 `hudChrome`; values as drawn there).
 * Four hairline brackets in the instrument token (`orreryInstrument`, which
 * follows the user's accent) inside a HUD glass plate — the same lock-bracket
 * language as the canvas focus reticle — so the System selector, view
 * options, camera controls, cluster panel and focus card read as one
 * edge-anchored instrument rather than dashboard widgets.
 *
 * Decorative only: not touchable, hidden from accessibility, no text. The
 * token paints a border (a fill), never a text foreground (ADR-084 roles
 * unaffected). Place it as the FIRST child of the plate's `GlassSurface`, so
 * it sits inside the glass content box and under the plate's content. Card
 * glass is unchanged (D-35): only the plate radius tightens (`HUD_PLATE`).
 */
import { StyleSheet, View, type ViewStyle } from "react-native";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";

// ── Tunables (Lab B values) ────────────────────────────────────────────────

/** Bracket arm length, dp (Lab B `ARM` 7). */
export const HUD_CORNER_ARM = 7;
/** Bracket stroke, dp (Lab B `STROKE` 1.5). */
export const HUD_CORNER_STROKE = 1.5;
/** Inset from the plate edge, dp — inside the plate's rounded corner (Lab B `INSET` 3). */
export const HUD_CORNER_INSET = 3;
/** Bracket opacity; the plate's own border carries the edge (Lab B `BRACKET_OPACITY` 0.85). */
export const HUD_CORNER_OPACITY = 0.85;
/** HUD plate geometry: Lab B's tighter instrument radius than the default card (`RADII.sm`). */
export const HUD_PLATE: ViewStyle = { borderRadius: RADII.sm };

export const ORRERY_HUD_CORNERS_TEST_ID = "orrery-hud-corners";

export function OrreryHudCorners() {
  const { colors } = useTheme();
  const ink = { borderColor: colors.orreryInstrument };
  return (
    <View
      testID={ORRERY_HUD_CORNERS_TEST_ID}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={styles.fill}
    >
      <View style={[styles.corner, styles.topLeft, ink]} />
      <View style={[styles.corner, styles.topRight, ink]} />
      <View style={[styles.corner, styles.bottomLeft, ink]} />
      <View style={[styles.corner, styles.bottomRight, ink]} />
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
    opacity: HUD_CORNER_OPACITY,
  },
  corner: {
    position: "absolute",
    width: HUD_CORNER_ARM,
    height: HUD_CORNER_ARM,
  },
  topLeft: {
    top: HUD_CORNER_INSET,
    left: HUD_CORNER_INSET,
    borderTopWidth: HUD_CORNER_STROKE,
    borderLeftWidth: HUD_CORNER_STROKE,
  },
  topRight: {
    top: HUD_CORNER_INSET,
    right: HUD_CORNER_INSET,
    borderTopWidth: HUD_CORNER_STROKE,
    borderRightWidth: HUD_CORNER_STROKE,
  },
  bottomLeft: {
    bottom: HUD_CORNER_INSET,
    left: HUD_CORNER_INSET,
    borderBottomWidth: HUD_CORNER_STROKE,
    borderLeftWidth: HUD_CORNER_STROKE,
  },
  bottomRight: {
    bottom: HUD_CORNER_INSET,
    right: HUD_CORNER_INSET,
    borderBottomWidth: HUD_CORNER_STROKE,
    borderRightWidth: HUD_CORNER_STROKE,
  },
});
