// biome-ignore-all lint/a11y/useValidAriaRole: Button roles are semantic project variants.
import { useEffect, useMemo, useState } from "react";
import { ScrollView, type ScrollViewProps, View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { OrreryObstacle } from "./OrreryObstacle";
import {
  createFeedbackRetry,
  feedbackCopy,
  type OrreryFeedbackKind,
} from "./orrery-feedback-logic";

/** Inline content also serves sheet/panel surfaces that already own scrolling. */
export function OrreryNotice({
  kind,
  onAction,
  busy = false,
}: {
  kind: OrreryFeedbackKind;
  onAction?: () => void | Promise<void>;
  busy?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const retry = useMemo(() => createFeedbackRetry(setPending), []);
  useEffect(() => {
    retry.activate();
    return () => retry.dispose();
  }, [retry]);
  const copy = feedbackCopy(kind);
  return (
    <View accessibilityState={{ busy: busy || pending }}>
      <AppText>{copy.message}</AppText>
      {copy.action && onAction ? (
        <Button
          role="secondary"
          label={copy.action}
          disabled={busy || pending}
          onPress={() => {
            void retry.run(onAction);
          }}
        />
      ) : null}
    </View>
  );
}

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
