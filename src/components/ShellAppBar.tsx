import { useNavigation } from "@react-navigation/native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { resolveBackIntent } from "@/navigation/back-intent";
import { shellTransientStore } from "@/stores/shell-transient-store";
import { useTheme } from "@/theme";
import { OverflowMenu, type OverflowAction } from "./OverflowMenu";

interface ShellAppBarProps {
  variant: "root" | "child";
  title: string;
  overflow?: OverflowAction[];
  trailing?: ReactNode;
}

/**
 * Shared screen-owned chrome for shell roots and future child surfaces. Root
 * destinations have a branded/title-only bar; child destinations add Back.
 */
export function ShellAppBar({
  variant,
  title,
  overflow,
  trailing,
}: ShellAppBarProps) {
  const { colors } = useTheme();
  const navigation = useNavigation();

  const onBack = () => {
    const intent = resolveBackIntent({
      anyTransientOpen: shellTransientStore.getState().isAnyOpen(),
    });

    if (intent === "dismiss-transient") {
      shellTransientStore.getState().dismissTop();
      return;
    }

    navigation.goBack();
  };

  return (
    <View style={[styles.root, { borderColor: colors.border }]}>
      {variant === "child" ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          onPress={onBack}
          style={styles.back}
        >
          <Text style={[styles.backLabel, { color: colors.textSecondary }]}>Back</Text>
        </Pressable>
      ) : null}
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[styles.title, { color: colors.textPrimary }]}
      >
        {title}
      </Text>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      {overflow && overflow.length > 0 ? <OverflowMenu actions={overflow} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
  },
  backLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
  },
  trailing: {
    flexDirection: "row",
    alignItems: "center",
  },
});
