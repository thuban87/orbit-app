/**
 * MeasuredActionRow — a row of action buttons that measures and stacks
 * (D-11, carried from ADR-174 :38: "Action rows measure and stack; plain
 * flexWrap rejected"). The ConfirmActions pattern for rows that are not a
 * Cancel + confirm pair (38.14 review B-WR-02: event detail's Edit Event /
 * Add participants; A-IN-08: Compose's pinned Copy · Transmit bar).
 *
 * It first lays the actions out in a wrapping row to read each one's natural
 * width, then keeps one row when they all fit, or stacks them full-width when
 * they do not — never the ragged "staircase" a plain wrapping row produces.
 * It re-measures (by remounting the row) whenever the number of actions, the
 * window width or the font scale changes, or the caller's `measureKey` does.
 * Layout only: no colour (check:colors), no animation.
 */
import { Children, type ReactNode, useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { SPACING } from "@/theme/tokens/spacing";
import { actionRowFit } from "./confirm-dialog-layout";

export interface MeasuredActionRowProps {
  children: ReactNode;
  /** Where a single row sits: "end" (dialogs, Compose) or "start". */
  align?: "start" | "end";
  /** Change it to force a fresh measure (e.g. when a label changes). */
  measureKey?: string;
  /** Space between actions, row and stacked (default `SPACING.sm`). */
  gap?: number;
  testID?: string;
}

export function MeasuredActionRow({
  children,
  align = "end",
  measureKey = "",
  gap = SPACING.sm,
  testID,
}: MeasuredActionRowProps) {
  const items = Children.toArray(children);
  const { width, fontScale } = useWindowDimensions();
  const keys = items.map(itemKey).join(",");
  return (
    <MeasuredRow
      key={`${keys}|${width}|${fontScale}|${measureKey}`}
      items={items}
      align={align}
      gap={gap}
      testID={testID}
    />
  );
}

type Layout = "measuring" | "row" | "stacked";

/** `Children.toArray` gives every element a stable key; fall back to its index. */
function itemKey(item: ReactNode, index: number): string {
  return typeof item === "object" && item !== null && "key" in item
    ? String(item.key)
    : String(index);
}

function MeasuredRow({
  items,
  align,
  gap,
  testID,
}: {
  items: ReactNode[];
  align: "start" | "end";
  gap: number;
  testID?: string;
}) {
  const single = items.length <= 1;
  const [layout, setLayout] = useState<Layout>(single ? "row" : "measuring");
  const widths = useRef({ row: 0, items: items.map(() => 0) });
  const settle = () => {
    const fit = actionRowFit({
      items: widths.current.items,
      row: widths.current.row,
      gap,
    });
    if (fit !== null) setLayout(fit ? "row" : "stacked");
  };
  const onRowLayout = (event: LayoutChangeEvent) => {
    if (layout !== "measuring") return;
    widths.current.row = event.nativeEvent.layout.width;
    settle();
  };
  const onItemLayout = (index: number) => (event: LayoutChangeEvent) => {
    if (layout !== "measuring") return;
    widths.current.items[index] = event.nativeEvent.layout.width;
    settle();
  };
  const stacked = layout === "stacked";
  const justify = align === "end" ? styles.justifyEnd : styles.justifyStart;
  return (
    <View
      testID={testID}
      style={
        layout === "measuring"
          ? [styles.measuring, justify, { gap }]
          : stacked
            ? [styles.stacked, { gap }]
            : [styles.row, justify, { gap }]
      }
      onLayout={onRowLayout}
    >
      {items.map((item, index) => (
        <View
          key={itemKey(item, index)}
          style={stacked ? styles.itemStacked : styles.item}
          onLayout={onItemLayout(index)}
        >
          {item}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // The measuring pass only: a wrapping row reads each natural width.
  measuring: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  row: {
    flexDirection: "row",
  },
  stacked: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  justifyEnd: { justifyContent: "flex-end" },
  justifyStart: { justifyContent: "flex-start" },
  item: { maxWidth: "100%" },
  itemStacked: { alignSelf: "stretch" },
});
