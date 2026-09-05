import { useIsFocused } from "@react-navigation/native";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  AppState,
  findNodeHandle,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { SPACING } from "@/theme/tokens/spacing";
import { MOTION } from "@/theme/tokens/motion";
import { useReducedMotion } from "@/theme/use-reduced-motion";
import { useTheme } from "@/theme";
import { shellTransientStore } from "@/stores/shell-transient-store";
import { clampAnchorPosition, type AnchorRect } from "./anchor-position";

export type PanelSize = "compact" | "medium" | "large";

const PANEL_DIMENSIONS: Record<PanelSize, { width: number; height: number }> = {
  compact: { width: 280, height: 300 },
  medium: { width: 300, height: 480 },
  large: { width: 328, height: 560 },
};

export interface AnchoredPanelProps {
  anchorRect: AnchorRect;
  size: PanelSize;
  visible: boolean;
  onDismiss: () => void;
  children: ReactNode;
}

/** The in-tree, swappable presentation container for dashboard control content. */
export function AnchoredPanel({
  anchorRect,
  size,
  visible,
  onDismiss,
  children,
}: AnchoredPanelProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const contentRef = useRef<View>(null);
  const progress = useSharedValue(visible ? 1 : 0);
  const { width, height } = useWindowDimensions();
  const position = clampAnchorPosition(anchorRect, PANEL_DIMENSIONS[size], { width, height }, SPACING.base);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => setAppActive(state === "active"));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!visible) {
      shellTransientStore.getState().closeTransient("dashboard-panel");
      return;
    }
    shellTransientStore.getState().openTransient("dashboard-panel", onDismiss);
    const handle = findNodeHandle(contentRef.current);
    if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
    return () => shellTransientStore.getState().closeTransient("dashboard-panel");
  }, [visible, onDismiss]);

  useEffect(() => {
    const canAnimate = isFocused && appActive && !reducedMotion;
    progress.value = canAnimate
      ? withTiming(visible ? 1 : 0, { duration: MOTION.base, easing: Easing.out(Easing.ease) })
      : visible
        ? 1
        : 0;
  }, [appActive, isFocused, progress, reducedMotion, visible]);

  const panelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * SPACING.sm }],
  }));

  if (!visible) return null;

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss dashboard controls"
        onPress={onDismiss}
        style={styles.scrim}
      >
        <View style={[styles.scrimTint, { backgroundColor: colors.background }]} />
      </Pressable>
      <Animated.View
        ref={contentRef}
        collapsable={false}
        style={[styles.panel, { left: position.left, top: position.top, width: position.width }, panelStyle]}
      >
        <GlassSurface density="dense" style={styles.surface}>
          {children}
        </GlassSurface>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 10, elevation: 10 },
  scrim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  scrimTint: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: 0.45 },
  panel: { position: "absolute", maxHeight: "60%" },
  surface: { padding: SPACING.base },
});
