// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography variant.
import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/icon-registry";
import { AppText } from "@/components/ui/AppText";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";

const MENU_EDGE = SPACING.base;
const DEFAULT_WIDTH = 224;

export interface AnchoredMenuItem {
  id: string;
  label: string;
  icon?: IconName;
  danger?: boolean;
  separatorBefore?: boolean;
  onPress: () => void;
}

export interface AnchorRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AnchoredMenuPlacementInput {
  anchor: AnchorRectangle;
  window: { width: number; height: number };
  menu: { width: number; height: number };
  insets: { top: number; right: number; bottom: number; left: number };
  alignment: "start" | "end";
}

export interface AnchoredMenuPlacement {
  left: number;
  top: number;
  maxHeight: number;
  placement: "above" | "below";
}

export function placeAnchoredMenu({
  anchor,
  window,
  menu,
  insets,
  alignment,
}: AnchoredMenuPlacementInput): AnchoredMenuPlacement {
  const minLeft = insets.left + MENU_EDGE;
  const maxRight = window.width - insets.right - MENU_EDGE;
  const preferredLeft =
    alignment === "end" ? anchor.x + anchor.width - menu.width : anchor.x;
  const left = Math.max(
    minLeft,
    Math.min(preferredLeft, Math.max(minLeft, maxRight - menu.width)),
  );
  const minTop = insets.top + MENU_EDGE;
  const maxBottom = window.height - insets.bottom - MENU_EDGE;
  const belowSpace = Math.max(0, maxBottom - (anchor.y + anchor.height));
  const aboveSpace = Math.max(0, anchor.y - minTop);
  if (menu.height <= belowSpace || belowSpace >= aboveSpace) {
    return {
      left,
      top: anchor.y + anchor.height,
      maxHeight: belowSpace,
      placement: "below",
    };
  }
  return {
    left,
    top: Math.max(minTop, anchor.y - menu.height),
    maxHeight: aboveSpace,
    placement: "above",
  };
}

interface AnchoredMenuProps {
  anchorRef: RefObject<View | null>;
  visible: boolean;
  accessibilityLabel: string;
  items: readonly AnchoredMenuItem[];
  alignment?: "start" | "end";
  onRequestClose: () => void;
}

export function AnchoredMenu({
  anchorRef,
  visible,
  accessibilityLabel,
  items,
  alignment = "end",
  onRequestClose,
}: AnchoredMenuProps) {
  const { colors } = useTheme();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const firstItemRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<AnchorRectangle | null>(null);
  const [menuHeight, setMenuHeight] = useState(0);

  const measureAnchor = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
    });
  }, [anchorRef]);

  // Viewport changes invalidate window-coordinate placement and require a new measure.
  // biome-ignore lint/correctness/useExhaustiveDependencies: dimensions intentionally re-trigger measurement.
  useEffect(() => {
    if (!visible) return;
    measureAnchor();
  }, [measureAnchor, visible, window.height, window.width]);

  useEffect(() => {
    if (!visible || !anchor) return;
    const frame = requestAnimationFrame(() => {
      const handle = findNodeHandle(firstItemRef.current);
      if (handle !== null) AccessibilityInfo.setAccessibilityFocus(handle);
    });
    return () => cancelAnimationFrame(frame);
  }, [anchor, visible]);

  if (!visible || !anchor) return null;
  const placement = placeAnchoredMenu({
    anchor,
    window,
    menu: { width: DEFAULT_WIDTH, height: menuHeight },
    insets,
    alignment,
  });

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
      onShow={measureAnchor}
    >
      <View style={styles.root} accessibilityViewIsModal>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss menu"
          style={StyleSheet.absoluteFill}
          onPress={onRequestClose}
        />
        <View
          accessibilityRole="menu"
          accessibilityLabel={accessibilityLabel}
          onLayout={(event) => setMenuHeight(event.nativeEvent.layout.height)}
          style={[
            styles.menu,
            {
              left: placement.left,
              top: placement.top,
              width: DEFAULT_WIDTH,
              maxHeight: placement.maxHeight,
            },
          ]}
        >
          <GlassSurface density="dense">
            <ScrollView showsVerticalScrollIndicator>
              {items.map((item, index) => (
                <Pressable
                  key={item.id}
                  ref={index === 0 ? firstItemRef : undefined}
                  collapsable={false}
                  accessibilityRole="menuitem"
                  accessibilityLabel={item.label}
                  onPress={() => {
                    onRequestClose();
                    requestAnimationFrame(item.onPress);
                  }}
                  style={[
                    styles.item,
                    item.separatorBefore
                      ? [styles.separator, { borderColor: colors.border }]
                      : null,
                  ]}
                >
                  {item.icon ? (
                    <Icon
                      name={item.icon}
                      size="sm"
                      tone={item.danger ? "danger" : "textPrimary"}
                    />
                  ) : null}
                  <AppText
                    role="label"
                    style={item.danger ? { color: colors.danger } : undefined}
                  >
                    {item.label}
                  </AppText>
                </Pressable>
              ))}
            </ScrollView>
          </GlassSurface>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  menu: { position: "absolute", borderRadius: RADII.md, overflow: "hidden" },
  item: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
    minHeight: 44,
    paddingHorizontal: SPACING.base,
  },
  separator: { borderTopWidth: StyleSheet.hairlineWidth },
});
