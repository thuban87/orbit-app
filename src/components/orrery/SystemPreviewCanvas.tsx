import { useIsFocused } from "@react-navigation/native";
import { Canvas, Circle, Fill, Group } from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  runOnJS,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import {
  buildPreviewMarkers,
  type PreviewMarker,
} from "@/components/orrery/system-preview-logic";
import type { ProvisionalOrreryScene } from "@/services/orrery-scene";
import { useTheme } from "@/theme";

const MIN_ZOOM = 0.45;
const MAX_ZOOM = 3;
const PREVIEW_HIT_PADDING = 12;

/** Preview bodies only identify a marker; navigation stays outside this workflow. */
export function focusPreviewBody(
  contactId: number,
  focus: (contactId: number) => void,
): void {
  focus(contactId);
}

function markerAt(
  markers: readonly PreviewMarker[],
  x: number,
  y: number,
): PreviewMarker | null {
  "worklet";
  let nearest: PreviewMarker | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const marker of markers) {
    const current = Math.hypot(marker.x - x, marker.y - y);
    if (current <= marker.size + PREVIEW_HIT_PADDING && current < distance) {
      nearest = marker;
      distance = current;
    }
  }
  return nearest;
}

function previewHomeZoom(
  extent: number,
  width: number,
  height: number,
): number {
  const usableDiameter = Math.max(1, Math.min(width, height) - 48);
  return Math.max(MIN_ZOOM, Math.min(1, usableDiameter / (extent * 2)));
}

function ActiveSystemPreviewCanvas({
  scene,
  focusedId,
  onFocusBody,
}: {
  scene: ProvisionalOrreryScene;
  focusedId: number | null;
  onFocusBody: (contactId: number) => void;
}) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const markers = useMemo(() => buildPreviewMarkers(scene), [scene]);
  const reportFocusBody = useCallback(
    (contactId: number) => focusPreviewBody(contactId, onFocusBody),
    [onFocusBody],
  );
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const initialZoom = previewHomeZoom(scene.extent, width, height);
  const zoom = useSharedValue(initialZoom);
  const zoomStart = useSharedValue(initialZoom);
  useEffect(() => {
    panX.value = 0;
    panY.value = 0;
    zoom.value = initialZoom;
  }, [initialZoom, panX, panY, zoom]);
  const transform = useDerivedValue(() => [
    { translateX: width / 2 + panX.value },
    { translateY: height / 2 + panY.value },
    { scale: zoom.value },
  ]);
  const pan = Gesture.Pan()
    .maxPointers(1)
    .onBegin(() => {
      "worklet";
      panStartX.value = panX.value;
      panStartY.value = panY.value;
    })
    .onUpdate((event) => {
      "worklet";
      panX.value = panStartX.value + event.translationX;
      panY.value = panStartY.value + event.translationY;
    });
  const pinch = Gesture.Pinch()
    .onBegin(() => {
      "worklet";
      zoomStart.value = zoom.value;
    })
    .onUpdate((event) => {
      "worklet";
      zoom.value = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, zoomStart.value * event.scale),
      );
    });
  const tap = Gesture.Tap().onEnd((event, success) => {
    "worklet";
    if (!success || markers.kind === "empty") return;
    const marker = markerAt(
      markers.markers,
      (event.x - width / 2 - panX.value) / zoom.value,
      (event.y - height / 2 - panY.value) / zoom.value,
    );
    if (marker) runOnJS(reportFocusBody)(marker.id);
  });
  const gesture = Gesture.Race(tap, Gesture.Simultaneous(pan, pinch));

  return (
    <GestureDetector gesture={gesture}>
      <Canvas
        testID="system-preview-canvas"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.canvas}
      >
        <Fill color={colors.background} />
        <Group clip={{ x: 0, y: 0, width, height }}>
          <Group transform={transform}>
            <Circle cx={0} cy={0} r={30} color={colors.starPalette[0]} />
            {markers.kind === "ready"
              ? markers.markers.map((marker) => (
                  <Circle
                    key={`rail-${marker.id}`}
                    cx={0}
                    cy={0}
                    r={marker.ringRadius}
                    color={colors.border}
                    style="stroke"
                    strokeWidth={1}
                  />
                ))
              : null}
            {markers.kind === "ready"
              ? markers.markers.map((marker) => (
                  <Circle
                    key={marker.id}
                    cx={marker.x}
                    cy={marker.y}
                    r={marker.size}
                    color={
                      marker.id === focusedId
                        ? colors.accent
                        : colors.textSecondary
                    }
                  />
                ))
              : null}
          </Group>
        </Group>
      </Canvas>
    </GestureDetector>
  );
}

/**
 * Mirrors OrreryCanvas's lifecycle guarantee: no Skia canvas remains mounted
 * while this builder route is blurred or the app is backgrounded.
 */
export function SystemPreviewCanvas({
  scene,
  focusedId,
  onFocusBody,
}: {
  scene: ProvisionalOrreryScene;
  focusedId: number | null;
  onFocusBody: (contactId: number) => void;
}) {
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(
    AppState.currentState === "active",
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setAppActive(state === "active");
    });
    return () => subscription.remove();
  }, []);

  if (!focused || !appActive) return null;
  return (
    <View style={styles.root} pointerEvents="box-none">
      <ActiveSystemPreviewCanvas
        scene={scene}
        focusedId={focusedId}
        onFocusBody={onFocusBody}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill },
  canvas: { flex: 1 },
});
