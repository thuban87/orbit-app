// biome-ignore-all lint/a11y/useValidAriaRole: AppText roles are typography.
import { ScrollView, StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { GlassSurface } from "@/components/ui/GlassSurface";
import type { CameraViewport } from "@/logic/orrery-camera-logic";
import type { OrreryContactTarget } from "@/logic/orrery-focus-logic";
import type { OrrerySceneSnapshot } from "@/services/orrery-scene";
import { SPACING } from "@/theme/tokens/spacing";
import { OrreryNotice } from "./OrreryFeedback";
import { OrreryObstacle } from "./OrreryObstacle";
import { clusterCount, clusterRegion } from "./orrery-overlay-logic";

export const CLUSTER_OBSTACLE = "orrery-cluster-panel";
export function OrreryClusterPanel({
  targets,
  scene,
  viewport,
  stale,
  blocked,
  onClose,
  onAction,
  onReload,
}: {
  targets: readonly OrreryContactTarget[];
  scene: OrrerySceneSnapshot;
  viewport: CameraViewport;
  stale: boolean;
  blocked: boolean;
  onClose: () => void;
  onAction: (kind: "focus" | "profile", target: OrreryContactTarget) => void;
  onReload: () => void | Promise<void>;
}) {
  const region = clusterRegion(viewport);
  if (!targets.length || !region) return null;
  return (
    <OrreryObstacle
      obstacleId={CLUSTER_OBSTACLE}
      pointerEvents={blocked ? "none" : "auto"}
      importantForAccessibility={blocked ? "no-hide-descendants" : "auto"}
      style={{
        position: "absolute",
        left: region.x,
        bottom: viewport.height - region.y - region.height,
        width: region.width,
        maxHeight: region.height,
      }}
    >
      <GlassSurface density="dense">
        <ScrollView
          style={{ maxHeight: region.height }}
          contentContainerStyle={styles.content}
        >
          <AppText role="heading">Contacts here</AppText>
          <AppText>{clusterCount(targets.length)}</AppText>
          <Button
            role="secondary"
            label="Close contact group"
            onPress={onClose}
          />
          {stale ? <OrreryNotice kind="stale" onAction={onReload} /> : null}
          {targets.map((target) => {
            const member = scene.systemSnapshot.members.find(
              (item) => item.id === target.id && item.uid === target.uid,
            );
            const name = member?.name ?? scene.sun.sunContactName;
            return (
              <View key={`${target.id}:${target.uid}`} style={styles.row}>
                <AppText>{name}</AppText>
                <Button
                  role="secondary"
                  label="Focus in Orrery"
                  accessibilityLabel={`Focus in Orrery: ${name}`}
                  onPress={() => onAction("focus", target)}
                />
                <Button
                  role="secondary"
                  label="Open Profile"
                  accessibilityLabel={`Open Profile: ${name}`}
                  onPress={() => onAction("profile", target)}
                />
              </View>
            );
          })}
        </ScrollView>
      </GlassSurface>
    </OrreryObstacle>
  );
}
const styles = StyleSheet.create({
  content: { padding: SPACING.base, gap: SPACING.sm },
  row: { gap: SPACING.sm },
});
