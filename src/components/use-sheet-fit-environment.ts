/**
 * The window and inset facts a sized sheet reads when it opens (38.13 D-85,
 * D-87). One hook, so the sized sheets read the same values the Sheet lays
 * itself out against.
 */
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { SheetFitEnvironment } from "./bulk-sheet-fit";

export function useSheetFitEnvironment(): SheetFitEnvironment {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return {
    windowHeight: window.height,
    windowWidth: window.width,
    fontScale: window.fontScale,
    bottomInset: insets.bottom,
  };
}
