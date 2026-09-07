// biome-ignore-all lint/a11y/useValidAriaRole: AppText uses typography roles.
import { type ReactNode, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { GlassSurface } from "@/components/ui/GlassSurface";
import {
  type ProjectedFrame,
  usableCameraRect,
} from "@/logic/orrery-camera-logic";
import type { OrreryContactTarget } from "@/logic/orrery-focus-logic";
import { SPACING } from "@/theme/tokens/spacing";

/** Lightweight identity follows the authoritative frame on the UI thread.
 * Optional relationship content belongs to the qualified parent (D-11).
 */
export function OrreryFocusContext({
  target,
  name,
  frame,
  blocked,
  onClear,
  onProfile,
  relationshipContext,
  contextState = "ready",
  onReloadContext,
}: {
  target: OrreryContactTarget;
  name: string;
  frame: SharedValue<ProjectedFrame | null>;
  blocked: boolean;
  onClear: () => void;
  onProfile: () => void;
  relationshipContext?: ReactNode;
  contextState?: "loading" | "ready" | "error";
  onReloadContext?: () => void;
}) {
  const [height, setHeight] = useState(180);
  const position = useAnimatedStyle(() => {
    const current = frame.value;
    const region = current ? usableCameraRect(current.viewport) : null;
    const body = current?.bodies.find((item) => item.id === target.id);
    if (!region || !body) return { opacity: 0 };
    const width = Math.min(280, region.width);
    const limit = Math.min(height, region.height / 2);
    return {
      opacity: 1,
      width,
      maxHeight: region.height / 2,
      left: Math.max(
        region.x,
        Math.min(region.x + region.width - width, body.x - width / 2),
      ),
      top: Math.max(
        region.y,
        Math.min(
          region.y + region.height - limit,
          body.y + body.radius + SPACING.sm,
        ),
      ),
    };
  });
  const scrollBounds = useAnimatedStyle(() => {
    const current = frame.value;
    const region = current ? usableCameraRect(current.viewport) : null;
    return { maxHeight: region ? region.height / 2 : 180 };
  });
  return (
    <Animated.View
      style={[styles.root, position]}
      pointerEvents={blocked ? "none" : "auto"}
      importantForAccessibility={blocked ? "no-hide-descendants" : "auto"}
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
    >
      <GlassSurface density="dense">
        <Animated.ScrollView
          style={scrollBounds}
          contentContainerStyle={styles.content}
        >
          <AppText>{name}</AppText>
          <Button role="secondary" label="Clear focus" onPress={onClear} />
          <Button
            role="secondary"
            label="Open Profile"
            accessibilityLabel={`Open Profile: ${name}`}
            onPress={onProfile}
          />
          {contextState === "ready" ? relationshipContext : null}
          {contextState === "error" ? (
            <>
              <AppText>
                Couldn't load relationship satellites. Your contacts are still
                available.
              </AppText>
              {onReloadContext ? (
                <Button
                  role="secondary"
                  label="Reload satellites"
                  onPress={onReloadContext}
                />
              ) : null}
            </>
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
