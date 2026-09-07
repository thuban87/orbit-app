import { ScrollView, type ScrollViewProps } from "react-native";
import { OrreryObstacle } from "./OrreryObstacle";

/** Feedback participates in framing just like panels; its full text can scroll. */
export function OrreryFeedback({
  obstacleId,
  style,
  ...props
}: ScrollViewProps & { obstacleId: string }) {
  return (
    <OrreryObstacle obstacleId={obstacleId} style={style}>
      <ScrollView {...props} style={{ flexShrink: 1 }} />
    </OrreryObstacle>
  );
}
