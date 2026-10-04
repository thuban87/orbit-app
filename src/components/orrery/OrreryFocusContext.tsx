// biome-ignore-all lint/a11y/useValidAriaRole: AppText uses typography roles.
import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { GlassSurface } from "@/components/ui/GlassSurface";
import type { OrrerySatelliteTarget } from "@/logic/orrery-camera-logic";
import type { FocusCardRect } from "@/logic/orrery-focus-card-logic";
import type { OrreryContactTarget } from "@/logic/orrery-focus-logic";
import { SPACING } from "@/theme/tokens/spacing";
import { OrreryNotice } from "./OrreryFeedback";
import { HUD_PLATE, OrreryHudCorners } from "./OrreryHudCorners";

/** GlassSurface's 1 dp border, top + bottom (read inside a worklet). */
const GLASS_BORDER_PX = 2;

/**
 * Lightweight identity, docked at the canvas bottom below the focused body
 * (38.7-11, D-19). Its position comes from `placement` — the UI-thread
 * `focusCardRect` (`focusCardPlacement` over the shared frame) that the
 * Orrery's occlusion dim and label exclusion read too, so card, dim and
 * labels move together. The card's measured window rect is never published as
 * a camera obstacle (C-M2): only its height leaves here, through `cardHeight`
 * (the placement) and `onHeight` (the screen's framing refit).
 * Optional relationship content belongs to the qualified parent (D-11).
 */
export function OrreryFocusContext({
  target,
  name,
  placement,
  cardHeight,
  onHeight,
  blocked,
  onClear,
  onProfile,
  relationshipContext,
  contextState = "ready",
  onReloadContext,
}: {
  target: OrreryContactTarget | OrrerySatelliteTarget;
  name: string;
  /** The docked rect (canvas coordinates), shared with the canvas. */
  placement: SharedValue<FocusCardRect>;
  /** The card's measured height (feeds `placement`). */
  cardHeight: SharedValue<number>;
  /** JS notice of a new measured height (the framing refit, C3-M1). */
  onHeight?: (height: number) => void;
  blocked: boolean;
  onClear: () => void;
  onProfile?: () => void;
  relationshipContext?: ReactNode;
  contextState?: "loading" | "ready" | "error";
  onReloadContext?: () => void | Promise<void>;
}) {
  const position = useAnimatedStyle(() => {
    const rect = placement.value;
    if (!rect.visible) return { opacity: 0 };
    return {
      opacity: 1,
      width: rect.width,
      maxHeight: rect.maxHeight,
      left: rect.x,
      top: rect.y,
    };
  });
  // The scroll viewport fits INSIDE the glass border, so the outer box's
  // maxHeight never clips its last row (38.7-12; as OrreryControls does).
  const scrollBounds = useAnimatedStyle(() => {
    const rect = placement.value;
    return {
      maxHeight: (rect.visible ? rect.maxHeight : 180) - GLASS_BORDER_PX,
    };
  });
  return (
    <Animated.View
      style={[styles.root, position]}
      pointerEvents={blocked ? "none" : "auto"}
      importantForAccessibility={blocked ? "no-hide-descendants" : "auto"}
      onLayout={(event) => {
        const height = event.nativeEvent.layout.height;
        if (!(height > 0)) return;
        cardHeight.value = height;
        onHeight?.(height);
      }}
    >
      <GlassSurface
        density="dense"
        treatment="orrery-overlay"
        style={HUD_PLATE}
      >
        <OrreryHudCorners />
        <Animated.ScrollView
          style={scrollBounds}
          contentContainerStyle={styles.content}
        >
          <AppText>{name}</AppText>
          <Button role="secondary" label="Clear focus" onPress={onClear} />
          {target.kind !== "satellite" ? (
            <Button
              role="secondary"
              label="Open Profile"
              accessibilityLabel={`Open Profile: ${name}`}
              onPress={onProfile}
            />
          ) : null}
          {contextState === "ready" ? relationshipContext : null}
          {contextState === "error" ? (
            <OrreryNotice kind="satellites" onAction={onReloadContext} />
          ) : null}
        </Animated.ScrollView>
      </GlassSurface>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  root: { position: "absolute", overflow: "hidden" },
  content: { padding: SPACING.sm, gap: SPACING.sm },
});
