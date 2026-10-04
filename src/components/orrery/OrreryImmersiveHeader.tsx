/**
 * 38.7-12 (D-39): the map runs up under the Orrery title. Ported from Lab B's
 * IMMERSE header (`LabImmersiveHeader.tsx`, lab commit 13c706ad).
 *
 * The Orrery's canvas fills the whole route, from the top of the Orrery root
 * to the tab bar. The route's own, unchanged `ShellAppBar` (passed in as
 * `children`) floats over it on a token scrim that is dense behind the title
 * and fades to nothing `HEADER_SCRIM_TAIL` dp below the bar.
 *
 * What it does NOT touch (D-39, Scope Out):
 * - the status-bar band: RootNavigator's `TabNavigatorContainer` SafeAreaView
 *   (edges top) already lays every tab screen out below the status bar, so
 *   this overlay sits at `top: 0` of the Orrery root and adds no inset of its
 *   own (M9: no double inset, no status-bar overlap);
 * - `ShellAppBar` itself and every other screen's header. The bar's bottom
 *   hairline is clipped here by a wrapper one hairline shorter than the bar,
 *   as Lab B did; the INNER view reports the bar's natural height, so the clip
 *   cannot feed back;
 * - the tab bar and the "+" button.
 *
 * Geometry: the clip box is an `OrreryObstacle` (`ORRERY_HEADER_OBSTACLE`), so
 * the camera's usable rect, Home framing, focus framing, labels and the HUD
 * panels keep clear of the title exactly as they kept clear of the old layout
 * edge. The bar height is reported so the HUD triggers can sit below it.
 *
 * Decorative scrim views are not touchable and are hidden from accessibility.
 * Colours come from theme tokens only; no `elevation` (Android paints an
 * opaque rect under a translucent elevated view).
 */
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme";
import { OrreryObstacle } from "./OrreryObstacle";
import { HEADER_SCRIM_TAIL, headerScrimBands } from "./orrery-header-scrim";

export const ORRERY_HEADER_OBSTACLE = "orrery-immersive-header";

export function OrreryImmersiveHeader({
  barHeight,
  onBarHeight,
  children,
}: {
  /** The bar's natural height (dp), 0 until measured. */
  barHeight: number;
  /** Reports a new natural bar height. */
  onBarHeight: (height: number) => void;
  /** The unchanged `<ShellAppBar variant="root" title="Orrery" />`. */
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const bands = headerScrimBands(barHeight);
  return (
    <View pointerEvents="box-none" style={styles.root}>
      <View
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={[styles.scrim, { height: barHeight + HEADER_SCRIM_TAIL }]}
      >
        {bands.map(([height, opacity]) => (
          <View
            key={height}
            style={[
              styles.band,
              { height, opacity, backgroundColor: colors.background },
            ]}
          />
        ))}
      </View>
      <OrreryObstacle
        obstacleId={ORRERY_HEADER_OBSTACLE}
        style={
          barHeight > 0
            ? [styles.clip, { height: barHeight - StyleSheet.hairlineWidth }]
            : undefined
        }
      >
        <View
          onLayout={(event) => {
            const height = event.nativeEvent.layout.height;
            if (height > 0 && Math.abs(height - barHeight) > 0.5)
              onBarHeight(height);
          }}
        >
          {children}
        </View>
      </OrreryObstacle>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    // Rendered after the canvas container, so it draws above it.
    zIndex: 20,
  },
  scrim: { position: "absolute", top: 0, left: 0, right: 0 },
  band: { position: "absolute", top: 0, left: 0, right: 0 },
  clip: { overflow: "hidden" },
});
