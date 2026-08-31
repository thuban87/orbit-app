import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ContactMethodRow } from "@/db/contact-methods-dao";
import { useTheme } from "@/theme";

type EndpointSelectorProps = {
  type: "phone" | "email";
  endpoints: ContactMethodRow[];
  onPick: (endpoint: ContactMethodRow) => void;
  onCancel: () => void;
};

/** The third Reach out routing tap for contacts with multiple usable methods. */
export function EndpointSelector({
  type,
  endpoints,
  onPick,
  onCancel,
}: EndpointSelectorProps) {
  const { colors } = useTheme();
  const actionableEndpoints = endpoints.filter(
    (endpoint) => endpoint.is_actionable === 1,
  );

  return (
    <View>
      <Text style={[styles.heading, { color: colors.textPrimary }]}>
        {type === "phone" ? "Choose a number" : "Choose an email"}
      </Text>
      <ScrollView contentContainerStyle={styles.list}>
        {actionableEndpoints.map((endpoint) => {
          const primary = endpoint.is_primary === 1;
          return (
            <Pressable
              key={endpoint.id}
              accessibilityRole="button"
              accessibilityLabel={endpoint.display_value}
              onPress={() => onPick(endpoint)}
              style={[
                styles.endpoint,
                {
                  backgroundColor: primary ? colors.accent : colors.background,
                  borderColor: colors.accent,
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.endpointLabel,
                  { color: primary ? colors.background : colors.accent },
                ]}
              >
                {endpoint.display_value}
              </Text>
              {primary ? (
                <Text
                  style={[
                    styles.primary,
                    {
                      color: primary ? colors.background : colors.textSecondary,
                    },
                  ]}
                >
                  Primary
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancel endpoint selection"
        onPress={onCancel}
        style={[styles.cancel, { borderColor: colors.border }]}
      >
        <Text style={[styles.cancelLabel, { color: colors.textSecondary }]}>
          Cancel
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 12,
  },
  list: {
    gap: 12,
  },
  endpoint: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  endpointLabel: {
    fontSize: 15,
    lineHeight: 21,
  },
  primary: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: 2,
  },
  cancel: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 12,
    minHeight: 44,
    justifyContent: "center",
  },
  cancelLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
});
