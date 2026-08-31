import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { getExecutor, localDateTime } from "@/db/database";
import type { ReachRoutes } from "@/db/interaction-assist-read";
import { performReachOut } from "@/services/reach-out/handoff";
import { useTheme } from "@/theme";

type ReachOutRouterProps = {
  visible: boolean;
  contactId: number;
  routes: ReachRoutes;
  assistEnabled: boolean;
  onClose: () => void;
};

export function ReachOutRouter({
  visible,
  contactId,
  routes,
  assistEnabled,
  onClose,
}: ReachOutRouterProps) {
  const { colors } = useTheme();

  if (routes.hidden) {
    return null;
  }

  const launch = async (channel: "call" | "text" | "email") => {
    const endpoint =
      channel === "email"
        ? routes.primaryEmail?.canonical_value
        : routes.primaryPhone?.canonical_value;
    if (!endpoint) return;

    await performReachOut(getExecutor(), {
      contactId,
      channel,
      endpoint,
      assistEnabled,
      now: localDateTime(),
    });
    onClose();
  };

  const primaryChannel = routes.call ? "call" : "email";
  const routeButton = (channel: "call" | "text" | "email", label: string) => {
    const primary = channel === primaryChannel;
    return (
      <Pressable
        key={channel}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => void launch(channel)}
        style={[
          styles.route,
          {
            backgroundColor: primary ? colors.accent : colors.background,
            borderColor: colors.accent,
          },
        ]}
      >
        <Text
          style={[
            styles.routeLabel,
            { color: primary ? colors.background : colors.accent },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="Dismiss Reach out"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        >
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.scrim,
              { backgroundColor: colors.background },
            ]}
          />
        </Pressable>

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
        >
          {routes.call ? routeButton("call", "Call") : null}
          {routes.text ? routeButton("text", "Text") : null}
          {routes.email ? routeButton("email", "Email") : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  scrim: {
    opacity: 0.85,
  },
  sheet: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  route: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  routeLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
});
