import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { EndpointSelector } from "@/components/EndpointSelector";
import type { ContactMethodGroups } from "@/db/contact-methods-read";
import { getExecutor, localDateTime } from "@/db/database";
import type { ReachRoutes } from "@/db/interaction-assist-read";
import { performReachOut } from "@/services/reach-out/handoff";
import { useTheme } from "@/theme";

type ReachOutRouterProps = {
  visible: boolean;
  contactId: number;
  routes: ReachRoutes;
  methodGroups: ContactMethodGroups;
  assistEnabled: boolean;
  onClose: () => void;
};

export function ReachOutRouter({
  visible,
  contactId,
  routes,
  methodGroups,
  assistEnabled,
  onClose,
}: ReachOutRouterProps) {
  const { colors } = useTheme();
  const [selecting, setSelecting] = useState<"call" | "text" | "email" | null>(
    null,
  );

  if (routes.hidden) {
    return null;
  }

  const launch = async (
    channel: "call" | "text" | "email",
    endpoint: string | null,
  ) => {
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

  const chooseChannel = (channel: "call" | "text" | "email") => {
    const type = channel === "email" ? "email" : "phone";
    const endpoints = methodGroups[type].filter(
      (endpoint) => endpoint.is_actionable === 1,
    );
    if (endpoints.length === 1) {
      void launch(channel, endpoints[0].canonical_value);
      return;
    }
    if (endpoints.length >= 2) {
      setSelecting(channel);
    }
  };

  const primaryChannel = routes.call ? "call" : "email";
  const routeButton = (channel: "call" | "text" | "email", label: string) => {
    const primary = channel === primaryChannel;
    return (
      <Pressable
        key={channel}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => chooseChannel(channel)}
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
          {selecting ? (
            <EndpointSelector
              type={selecting === "email" ? "email" : "phone"}
              endpoints={
                methodGroups[selecting === "email" ? "email" : "phone"]
              }
              onCancel={() => setSelecting(null)}
              onPick={(endpoint) => {
                void launch(selecting, endpoint.canonical_value);
              }}
            />
          ) : (
            <>
              {routes.call ? routeButton("call", "Call") : null}
              {routes.text ? routeButton("text", "Text") : null}
              {routes.email ? routeButton("email", "Email") : null}
            </>
          )}
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
