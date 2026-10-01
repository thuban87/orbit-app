// biome-ignore-all lint/a11y/useValidAriaRole: AppText uses typography roles.
import { type ReactNode, useState } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { GlassSurface } from "@/components/ui/GlassSurface";
import {
  type OrrerySatelliteTarget,
  type ProjectedFrame,
  usableCameraRect,
} from "@/logic/orrery-camera-logic";
import type { OrreryContactTarget } from "@/logic/orrery-focus-logic";
import { bodyKey } from "@/logic/orrery-frame";
import { DETAIL_EXIT } from "@/logic/orrery-label-logic";
import { SPACING } from "@/theme/tokens/spacing";
import { TYPOGRAPHY } from "@/theme/tokens/typography";
import { useDeepFieldEnabled } from "./lab/deep-field-mode";
import {
  focusCardPlacement,
  focusCardRoom,
  focusLabelBlock,
} from "./lab/focus-card";

/** ORRERY LAB A (pass 3): plate metrics mirrored from OrreryLabel (plain numbers). */
const PLATE_LINE_HEIGHT = TYPOGRAPHY.label.lineHeight;
const PLATE_PADDING = SPACING.xs;

import { OrreryNotice } from "./OrreryFeedback";

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
  target: OrreryContactTarget | OrrerySatelliteTarget;
  name: string;
  frame: SharedValue<ProjectedFrame | null>;
  blocked: boolean;
  onClear: () => void;
  onProfile?: () => void;
  relationshipContext?: ReactNode;
  contextState?: "loading" | "ready" | "error";
  onReloadContext?: () => void | Promise<void>;
}) {
  const [height, setHeight] = useState(180);
  const deepFieldOn = useDeepFieldEnabled();
  // ORRERY LAB A (pass 3): the card also clears the focused body's label
  // plate (moons have none). Font scale is the same one the labels use.
  const { fontScale } = useWindowDimensions();
  const hasLabel = target.kind !== "satellite";
  const position = useAnimatedStyle(() => {
    const current = frame.value;
    const region = current ? usableCameraRect(current.viewport) : null;
    // Perf pass: the target key is built once, not once per body per frame.
    const targetKey =
      target.kind === "satellite"
        ? bodyKey({ id: -1, kind: "satellite", satelliteTarget: target })
        : "";
    const body = current?.bodies.find((item) =>
      target.kind === "satellite"
        ? bodyKey(item) === targetKey
        : item.kind !== "satellite" && item.id === target.id,
    );
    if (!current || !region || !body) return { opacity: 0 };
    const width = Math.min(280, region.width);
    const limit = Math.min(height, region.height / 2);
    const left = Math.max(
      region.x,
      Math.min(region.x + region.width - width, body.x - width / 2),
    );
    // ORRERY LAB A (pass 2/3): clear the drawn body, reticle and label plate;
    // flip above the body, or cap the card height to the free room (it
    // scrolls), instead of clamping it up over the focused body. The room is
    // bounded only by obstacles under the card's own x-span (pass 3).
    // Framing/usable rect untouched.
    const placed = deepFieldOn
      ? focusCardPlacement(
          focusCardRoom(
            current.viewport,
            region,
            left,
            width,
            body.y,
            SPACING.sm,
          ),
          body.y,
          body.radius,
          limit,
          SPACING.sm,
          hasLabel
            ? focusLabelBlock(
                fontScale,
                PLATE_LINE_HEIGHT,
                PLATE_PADDING,
                (current?.pose.zoom ?? 1) >= DETAIL_EXIT,
              )
            : undefined,
        )
      : null;
    return {
      opacity: 1,
      width,
      maxHeight: placed ? placed.maxHeight : region.height / 2,
      left,
      top: placed
        ? placed.top
        : Math.max(
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
    if (!region) return { maxHeight: 180 };
    if (!deepFieldOn) return { maxHeight: region.height / 2 };
    // ORRERY LAB A: the same placement as the card (scroll inside the room).
    // Perf pass: the target key is built once, not once per body per frame.
    const targetKey =
      target.kind === "satellite"
        ? bodyKey({ id: -1, kind: "satellite", satelliteTarget: target })
        : "";
    const body = current?.bodies.find((item) =>
      target.kind === "satellite"
        ? bodyKey(item) === targetKey
        : item.kind !== "satellite" && item.id === target.id,
    );
    if (!current || !body) return { maxHeight: region.height / 2 };
    const limit = Math.min(height, region.height / 2);
    const width = Math.min(280, region.width);
    const left = Math.max(
      region.x,
      Math.min(region.x + region.width - width, body.x - width / 2),
    );
    return {
      maxHeight: focusCardPlacement(
        focusCardRoom(
          current.viewport,
          region,
          left,
          width,
          body.y,
          SPACING.sm,
        ),
        body.y,
        body.radius,
        limit,
        SPACING.sm,
        hasLabel
          ? focusLabelBlock(
              fontScale,
              PLATE_LINE_HEIGHT,
              PLATE_PADDING,
              (current?.pose.zoom ?? 1) >= DETAIL_EXIT,
            )
          : undefined,
      ).maxHeight,
    };
  });
  return (
    <Animated.View
      style={[styles.root, position]}
      pointerEvents={blocked ? "none" : "auto"}
      importantForAccessibility={blocked ? "no-hide-descendants" : "auto"}
      onLayout={(event) => {
        // ORRERY LAB A: the lab caps the card to the free room, so its laid-
        // out height is not its natural height; that comes from the content.
        if (!deepFieldOn) setHeight(event.nativeEvent.layout.height);
      }}
    >
      <GlassSurface density="dense" treatment="orrery-overlay">
        <Animated.ScrollView
          style={scrollBounds}
          contentContainerStyle={styles.content}
          onContentSizeChange={(_, contentHeight) => {
            if (deepFieldOn) setHeight(contentHeight);
          }}
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
