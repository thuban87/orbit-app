// biome-ignore-all lint/a11y/useValidAriaRole: AppText uses typography roles.
import { type ReactNode, useEffect, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
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
import { SPACING } from "@/theme/tokens/spacing";
import {
  labCardChannel,
  NO_CARD,
  writeCardRect,
} from "./labb/labb-card-channel";
import { OrreryNotice } from "./OrreryFeedback";
import { HUD_PLATE, OrreryHudCorners } from "./OrreryHudCorners";
import { focusCardPlacement } from "./orrery-focus-placement";

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
  anchor = false,
  hud = false,
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
  /** ORRERY LAB B (WP-2.2, flag `focusCardAnchor`): keep clear of the locked
   * body and its label (orrery-focus-placement.ts). Off = the legacy rule. */
  anchor?: boolean;
  /** ORRERY LAB B (WP-2.2, flag `hudChrome`): instrument HUD plate. */
  hud?: boolean;
}) {
  const [height, setHeight] = useState(180);
  // Natural content height (independent of the placement's height cap, so a
  // docked, capped card can grow back when room returns).
  const [contentHeight, setContentHeight] = useState(0);
  const { fontScale } = useWindowDimensions();
  // ORRERY LAB B R1: publish the card's rect for the canvas occlusion
  // (labb-card-channel.ts); cleared when the card goes away.
  const card = labCardChannel();
  useEffect(
    () => () => {
      if (card) card.value = NO_CARD;
    },
    [card],
  );
  const position = useAnimatedStyle(() => {
    const current = frame.value;
    const region = current ? usableCameraRect(current.viewport) : null;
    const body = current?.bodies.find((item) =>
      target.kind === "satellite"
        ? bodyKey(item) ===
          bodyKey({ id: -1, kind: "satellite", satelliteTarget: target })
        : item.kind !== "satellite" && item.id === target.id,
    );
    if (!region || !body) {
      if (card && card.value[4] === 1) card.value = NO_CARD;
      return { opacity: 0 };
    }
    const width = Math.min(280, region.width);
    if (anchor) {
      const natural = Math.min(
        contentHeight > 0 ? contentHeight + 2 : height,
        region.height / 2,
      );
      const place = focusCardPlacement(
        region,
        body,
        { width, height: natural },
        fontScale,
      );
      writeCardRect(
        card,
        place.left,
        place.top,
        width,
        Math.min(natural, region.height / 2, place.maxHeight),
      );
      return {
        opacity: 1,
        width,
        maxHeight: Math.min(region.height / 2, place.maxHeight),
        left: place.left,
        top: place.top,
      };
    }
    const limit = Math.min(height, region.height / 2);
    const left = Math.max(
      region.x,
      Math.min(region.x + region.width - width, body.x - width / 2),
    );
    const top = Math.max(
      region.y,
      Math.min(
        region.y + region.height - limit,
        body.y + body.radius + SPACING.sm,
      ),
    );
    writeCardRect(card, left, top, width, limit);
    return {
      opacity: 1,
      width,
      maxHeight: region.height / 2,
      left,
      top,
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
      <GlassSurface
        density="dense"
        treatment="orrery-overlay"
        style={hud ? HUD_PLATE : undefined}
      >
        {hud ? <OrreryHudCorners /> : null}
        <Animated.ScrollView
          style={scrollBounds}
          contentContainerStyle={styles.content}
          onContentSizeChange={(_w: number, h: number) => setContentHeight(h)}
        >
          <AppText>{name}</AppText>
          {/* WP-2.2 HUD: the same two actions share one row (they wrap at
              large font scales), so the target panel stays short and clear
              of the locked body. */}
          <View style={hud ? styles.actions : styles.stack}>
            <View style={hud ? styles.action : undefined}>
              <Button role="secondary" label="Clear focus" onPress={onClear} />
            </View>
            {target.kind !== "satellite" ? (
              <View style={hud ? styles.action : undefined}>
                <Button
                  role="secondary"
                  label="Open Profile"
                  accessibilityLabel={`Open Profile: ${name}`}
                  onPress={onProfile}
                />
              </View>
            ) : null}
          </View>
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
  stack: { gap: SPACING.sm },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  action: { flexGrow: 1, flexBasis: 0, minWidth: 112 },
});
