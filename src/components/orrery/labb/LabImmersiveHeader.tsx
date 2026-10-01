/**
 * ORRERY LAB B — R3 immersive Orrery header (flag `immersiveChrome`).
 *
 * The map used to start BELOW an opaque app bar, so the Orrery read as a
 * picture placed inside an app screen (M1-CRITIQUE, R2-REPORT §5). With this
 * flag the Orrery's canvas fills the whole route (from the safe-area top to
 * the tab bar) and the route's own `ShellAppBar` floats over it on a token
 * scrim that is dense behind the title and fades to nothing a little below the
 * bar — the map bleeds under the header instead of being cut by it.
 *
 * What it does NOT touch (shared shell, COMPROMISES C-72): the status-bar band
 * (the navigator's `SafeAreaView`), the `ShellAppBar` component itself (its
 * hairline and title styling are unchanged — it is passed in as `children`),
 * the tab bar and the universal "+" FAB. The bar's bottom hairline is clipped
 * by a wrapper here (the component itself is unchanged).
 *
 * Geometry: the wrapper is an `OrreryObstacle`, so the camera's usable rect,
 * Home framing, focus framing and card placement all keep clear of the bar
 * exactly as they kept clear of the old layout edge. The bar height is
 * reported so the HUD pills can sit at the same window position as before.
 *
 * Legibility: the scrim behind the title is `background` at
 * `SCRIM_TOP`→`SCRIM_BAR` (≥ 0.84, `labb-header-scrim.ts`), measured in research/R3-REPORT.md §1.
 * Token colours only; decorative views are hidden from accessibility.
 */
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { OrreryObstacle } from "@/components/orrery/OrreryObstacle";
import type { ThemePalette } from "@/theme/theme-types";
import { labHeaderScrimBands, SCRIM_TAIL } from "./labb-header-scrim";

export const LAB_HEADER_OBSTACLE = "orrery-lab-header";

export function LabImmersiveHeader({
  colors,
  barHeight,
  onBarHeight,
  children,
}: {
  colors: ThemePalette;
  barHeight: number;
  onBarHeight: (height: number) => void;
  children: ReactNode;
}) {
  const bands = labHeaderScrimBands(barHeight);
  return (
    <View pointerEvents="box-none" style={styles.root}>
      <View
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={[styles.scrim, { height: barHeight + SCRIM_TAIL }]}
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
      {/* The outer box clips the bar's own bottom hairline (a hard edge
          that re-frames the map; the scrim fade replaces it). The INNER view
          reports the bar's natural height, so clipping cannot feed back. */}
      <OrreryObstacle
        obstacleId={LAB_HEADER_OBSTACLE}
        style={
          barHeight > 0
            ? [styles.clip, { height: barHeight - StyleSheet.hairlineWidth }]
            : undefined
        }
      >
        <View
          onLayout={(event) => {
            const h = event.nativeEvent.layout.height;
            if (h > 0 && Math.abs(h - barHeight) > 0.5) onBarHeight(h);
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
    // Rendered after the canvas container, so it draws above it; no
    // elevation (Android paints an opaque rect under translucent elevation).
    zIndex: 20,
  },
  scrim: { position: "absolute", top: 0, left: 0, right: 0 },
  band: { position: "absolute", top: 0, left: 0, right: 0 },
  clip: { overflow: "hidden" },
});
