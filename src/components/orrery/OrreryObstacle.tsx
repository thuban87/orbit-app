import { useIsFocused } from "@react-navigation/native";
import { View, type ViewProps } from "react-native";
import { useWindowObstacle } from "@/navigation/use-window-measurement";

/** Native, non-collapsable geometry owner for discrete Orrery HUD/panel layout. */
export function OrreryObstacle({
  obstacleId,
  ...props
}: ViewProps & { obstacleId: string }) {
  const focused = useIsFocused();
  const measurement = useWindowObstacle(obstacleId, focused);
  return (
    <View
      {...props}
      ref={measurement.ref}
      collapsable={false}
      onLayout={(event) => {
        measurement.onLayout(event);
        props.onLayout?.(event);
      }}
    />
  );
}
