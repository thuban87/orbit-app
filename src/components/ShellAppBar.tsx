import { useNavigation } from "@react-navigation/native";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { resolveBackIntent } from "@/navigation/back-intent";
import { shellTransientStore } from "@/stores/shell-transient-store";
import { useTheme } from "@/theme";
import { OverflowMenu, type OverflowAction } from "./OverflowMenu";

interface TrailingFitOptions {
  /** True until the complete app bar has measured enough room for labels. */
  compact: boolean;
}

type TrailingContent = ReactNode | ((options: TrailingFitOptions) => ReactNode);

interface ShellAppBarProps {
  variant: "root" | "child";
  title: string;
  overflow?: OverflowAction[];
  /** Existing ReactNode callers remain supported; root chrome can consume fit state. */
  trailing?: TrailingContent;
  /** Expanded labels that this bar measures invisibly at the active OS text scale. */
  trailingLabelProbe?: readonly string[];
}

const ROOT_HORIZONTAL_PADDING = 16;
const OVERFLOW_WIDTH = 44;
const ROOT_GAP_COUNT = 2;
const ROOT_GAP = 8;
const TWO_DESTINATION_CHROME_WIDTH = 64;

/**
 * Shared screen-owned chrome for shell roots and future child surfaces. Root
 * destinations have a branded/title-only bar; child destinations add Back.
 */
export function ShellAppBar({
  variant,
  title,
  overflow,
  trailing,
  trailingLabelProbe,
}: ShellAppBarProps) {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [rootWidth, setRootWidth] = useState(0);
  const [titleWidth, setTitleWidth] = useState(0);
  const [labelWidths, setLabelWidths] = useState<Record<string, number>>({});

  const labelsMeasured = trailingLabelProbe?.every(
    (label) => labelWidths[label] !== undefined,
  ) ?? false;
  const expandedTrailingWidth = trailingLabelProbe
    ? trailingLabelProbe.reduce(
        (total, label) => total + (labelWidths[label] ?? 0),
        TWO_DESTINATION_CHROME_WIDTH,
      )
    : 0;
  const availableTrailingWidth =
    rootWidth -
    ROOT_HORIZONTAL_PADDING * 2 -
    titleWidth -
    (overflow ? OVERFLOW_WIDTH : 0) -
    ROOT_GAP_COUNT * ROOT_GAP;
  // Fail closed before every measurement is available: labels only expand if
  // this bar proves they fit beside the rendered title and overflow affordance.
  const compact = !(
    rootWidth > 0 &&
    titleWidth > 0 &&
    labelsMeasured &&
    availableTrailingWidth >= expandedTrailingWidth
  );
  const trailingContent =
    typeof trailing === "function" ? trailing({ compact }) : trailing;

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
    <View
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        setRootWidth((current) => (current === width ? current : width));
      }}
      style={[styles.root, { borderColor: colors.border }]}
    >
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
        onTextLayout={(event) => {
          const width = Math.max(
            0,
            ...event.nativeEvent.lines.map((line) => line.width),
          );
          setTitleWidth((current) => (current === width ? current : width));
        }}
        style={[styles.title, { color: colors.textPrimary }]}
      >
        {title}
      </Text>
      {trailingContent ? <View style={styles.trailing}>{trailingContent}</View> : null}
      {overflow && overflow.length > 0 ? <OverflowMenu actions={overflow} /> : null}
      {trailingLabelProbe ? (
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={styles.labelProbe}
        >
          {trailingLabelProbe.map((label) => (
            <Text
              key={label}
              onTextLayout={(event) => {
                const width = Math.max(
                  0,
                  ...event.nativeEvent.lines.map((line) => line.width),
                );
                setLabelWidths((current) =>
                  current[label] === width
                    ? current
                    : { ...current, [label]: width },
                );
              }}
              style={styles.labelProbeText}
            >
              {label}
            </Text>
          ))}
        </View>
      ) : null}
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
  labelProbe: {
    position: "absolute",
    left: -10000,
    opacity: 0,
    flexDirection: "row",
  },
  labelProbeText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
