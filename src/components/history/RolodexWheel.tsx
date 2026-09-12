/**
 * RolodexWheel (HIST-08/18) — ONE gesture-driven roller column of the History
 * Browser (Month, Day, or Year). The animated surface of Phase 32.
 *
 * RENDER-LOOP DISCIPLINE (CLAUDE.md / HANDOFF §7 / UI-SPEC Motion Contract):
 *   • Scroll is a Reanimated SHARED VALUE (`offset`) driven by a Gesture-Handler
 *     pan — NEVER React `setState` per frame. The committed selection is lifted
 *     to the parent's React state only ON RELEASE via `runOnJS(onStep)` (allowed:
 *     that is a settle-time state write, not a per-frame one).
 *   • Neighbor rows fade/scale with distance from the centre through a single
 *     `useAnimatedStyle` per row; the depth worklet `rowDepthStyle` is defined
 *     ABOVE its `WheelRow` caller (worklet-forward-ref hazard, MEMORY fix
 *     f979263 — a helper worklet below its caller is undefined-on-device on
 *     Hermes and vitest cannot catch it).
 *   • Reduced Motion (`useReducedMotionShared`, read in the worklet) flattens the
 *     depth/scale WITHOUT removing navigation.
 *   • Non-gesture a11y path: explicit +/- steppers call `onStep` directly, so the
 *     wheel is fully operable without a drag gesture (HIST-18).
 *
 * NO SKIA: the optional Galaxy Skia glow is DROPPED (UI-SPEC allows "MAY add" and
 * the plan says drop rather than hardcode). Mechanics are identical across
 * themes; every colour resolves through `useTheme().colors.*` — no literal, no
 * Skia draw to token (check:colors).
 *
 * PARENT-OWNED: this column is purely presentational. It renders the supplied
 * `items` + `selectedIndex` and reports a signed step delta; RolodexBrowser owns
 * the date math (rolodex-logic), the focus/AppState mount lifecycle, and the
 * drawer.
 */
import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  type SharedValue,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import type { WheelMarker } from "@/components/history/rolodex-logic";
import { AppText } from "@/components/ui/AppText";
import type { ThemePalette } from "@/theme/theme-types";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";

// --- Tunable geometry (single-number edits, CLAUDE.md) -----------------------
const WHEEL_GEOMETRY = {
  itemHeight: 44, // 44px touch-target floor per visible row
  neighbors: 2, // rows shown above/below the centre (=> 5 visible)
  markerDot: 8,
} as const;

const VISIBLE_ROWS = WHEEL_GEOMETRY.neighbors * 2 + 1;
const VIEWPORT_HEIGHT = VISIBLE_ROWS * WHEEL_GEOMETRY.itemHeight;
/** Screen-space top of the centred slot within the viewport. */
const CENTRE_Y = VIEWPORT_HEIGHT / 2 - WHEEL_GEOMETRY.itemHeight / 2;

/** One selectable wheel value: its label + (Day wheel only) a pre-selection marker. */
export interface WheelItem {
  readonly key: string;
  readonly label: string;
  /** Marker for this date (Day wheel); omitted for Month/Year columns. */
  readonly marker?: WheelMarker;
}

/**
 * Depth worklet — MUST stay ABOVE `WheelRow` (worklet-forward-ref hazard). Maps a
 * row's signed distance from the centre to an opacity + scale. Under reduced
 * motion the scale is pinned to 1 and the opacity falls off more gently, so
 * navigation reads without the parallax depth.
 */
function rowDepthStyle(distance: number, reduced: boolean) {
  "worklet";
  const abs = Math.abs(distance);
  if (reduced) {
    return { opacity: Math.max(0.35, 1 - abs * 0.2), transform: [{ scale: 1 }] };
  }
  return {
    opacity: Math.max(0.15, 1 - abs * 0.34),
    transform: [{ scale: Math.max(0.72, 1 - abs * 0.12) }],
  };
}

interface WheelRowProps {
  item: WheelItem;
  rowIndex: number;
  selectedIndex: number;
  offset: SharedValue<number>;
  reduced: SharedValue<boolean>;
  colors: ThemePalette;
  testID: string;
}

/** One row. Its depth style is a worklet fn of the live `offset` (no setState). */
const WheelRow = memo(function WheelRow({
  item,
  rowIndex,
  selectedIndex,
  offset,
  reduced,
  colors,
  testID,
}: WheelRowProps) {
  const depth = useAnimatedStyle(() => {
    // Centred fractional row = selectedIndex - offset/itemHeight; a row's distance
    // from the centre is therefore rowIndex - selectedIndex + offset/itemHeight.
    const distance =
      rowIndex - selectedIndex + offset.value / WHEEL_GEOMETRY.itemHeight;
    return rowDepthStyle(distance, reduced.value);
  });

  // The committed selected row is emphasised with the accent-as-text tone (a
  // static, non-per-frame choice keyed on the React selectedIndex).
  const isSelected = rowIndex === selectedIndex;
  const textColor = isSelected ? colors.accentText : colors.textPrimary;

  const marker = item.marker;
  const a11yLabel =
    marker && marker.kind !== "none"
      ? `${item.label}, ${marker.a11yLabel}`
      : item.label;

  return (
    <Animated.View
      testID={testID}
      accessibilityLabel={a11yLabel}
      style={[styles.row, depth]}
    >
      <AppText role="body" style={{ color: textColor }}>
        {item.label}
      </AppText>
      {marker ? <Marker marker={marker} colors={colors} /> : null}
    </Animated.View>
  );
});

/** Silhouette-primary date marker: filled dot / ring / filled + count. */
function Marker({ marker, colors }: { marker: WheelMarker; colors: ThemePalette }) {
  if (marker.kind === "none") {
    return <View style={styles.markerSlot} />;
  }
  const dot = {
    width: WHEEL_GEOMETRY.markerDot,
    height: WHEEL_GEOMETRY.markerDot,
    borderRadius: WHEEL_GEOMETRY.markerDot / 2,
  } as const;
  if (marker.kind === "lifecycle") {
    // Ring / outline — lifecycle-only date.
    return (
      <View style={styles.markerSlot}>
        {/* Ring: no background fill (default) so the silhouette reads as an
            outline distinct from the filled interaction dot. */}
        <View
          style={[dot, { borderWidth: 1.5, borderColor: colors.markerLifecycle }]}
        />
      </View>
    );
  }
  // interaction / multiple -> filled dot; multiple also shows the numeric count.
  return (
    <View style={styles.markerSlot}>
      <View style={[dot, { backgroundColor: colors.markerInteraction }]} />
      {marker.kind === "multiple" ? (
        <AppText role="caption" style={{ color: colors.textSecondary }}>
          {marker.interactionCount}
        </AppText>
      ) : null}
    </View>
  );
}

export interface RolodexWheelProps {
  /** Axis name for accessibility ("Month" / "Day" / "Year"). */
  label: string;
  items: readonly WheelItem[];
  selectedIndex: number;
  /** Commit a signed step delta (+1 = toward the next/larger value). */
  onStep: (delta: number) => void;
  /** OS reduced-motion flag, read inside the depth worklet. */
  reduced: SharedValue<boolean>;
  colors: ThemePalette;
  testID?: string;
}

export function RolodexWheel({
  label,
  items,
  selectedIndex,
  onStep,
  reduced,
  colors,
  testID = "rolodex-wheel",
}: RolodexWheelProps) {
  const offset = useSharedValue(0);
  const start = useSharedValue(0);

  // translateY = centre - selectedIndex*itemHeight + drag offset. `selectedIndex`
  // and CENTRE_Y are React values closed over by the worklet — it re-runs when
  // the parent commits a new selection (state), not per frame.
  const strip = useAnimatedStyle(() => ({
    transform: [
      { translateY: CENTRE_Y - selectedIndex * WHEEL_GEOMETRY.itemHeight + offset.value },
    ],
  }));

  const pan = Gesture.Pan()
    .onStart(() => {
      start.value = offset.value;
    })
    .onUpdate((e) => {
      offset.value = start.value + e.translationY;
    })
    .onEnd(() => {
      // Nearest-slot snap. Dragging down (positive offset) brings smaller indices
      // to the centre, so the committed delta is the negative of the step count.
      const steps = Math.round(offset.value / WHEEL_GEOMETRY.itemHeight);
      offset.value = 0; // instant re-centre; the state commit shifts the baseline
      if (steps !== 0) {
        runOnJS(onStep)(-steps);
      }
    });

  return (
    <View style={styles.column} testID={testID}>
      <Pressable
        testID={`${testID}-inc`}
        accessibilityRole="button"
        accessibilityLabel={`Next ${label}`}
        hitSlop={8}
        onPress={() => onStep(1)}
        style={styles.stepper}
      >
        <AppText role="label" style={{ color: colors.textSecondary }}>
          ▲
        </AppText>
      </Pressable>

      <GestureDetector gesture={pan}>
        <View
          style={[styles.viewport, { borderColor: colors.border }]}
          accessibilityLabel={`${label} wheel`}
        >
          <Animated.View style={strip}>
            {items.map((item, rowIndex) => (
              <WheelRow
                key={item.key}
                item={item}
                rowIndex={rowIndex}
                selectedIndex={selectedIndex}
                offset={offset}
                reduced={reduced}
                colors={colors}
                testID={`${testID}-row-${item.key}`}
              />
            ))}
          </Animated.View>
          {/* Structural selection frame over the centre slot (borderStrong, not a
              second hue) — a fixed overlay, never animated. */}
          <View
            pointerEvents="none"
            style={[
              styles.selectionFrame,
              { top: CENTRE_Y, borderColor: colors.borderStrong },
            ]}
          />
        </View>
      </GestureDetector>

      <Pressable
        testID={`${testID}-dec`}
        accessibilityRole="button"
        accessibilityLabel={`Previous ${label}`}
        hitSlop={8}
        onPress={() => onStep(-1)}
        style={styles.stepper}
      >
        <AppText role="label" style={{ color: colors.textSecondary }}>
          ▼
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    alignItems: "center",
    gap: SPACING.xs,
  },
  stepper: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  viewport: {
    height: VIEWPORT_HEIGHT,
    minWidth: 72,
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: RADII.md,
  },
  row: {
    height: WHEEL_GEOMETRY.itemHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
  },
  markerSlot: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    minWidth: WHEEL_GEOMETRY.markerDot,
  },
  selectionFrame: {
    position: "absolute",
    left: 0,
    right: 0,
    height: WHEEL_GEOMETRY.itemHeight,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
});
