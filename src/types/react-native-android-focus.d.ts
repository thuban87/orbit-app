import "react-native";

/**
 * Android keyboard/D-pad focus-order props that React Native supports at
 * runtime but omits from its TypeScript `ViewProps`.
 *
 * `ViewPropTypes.js` declares them, `BaseViewConfig.android.js` forwards them,
 * and `ReactViewManager` maps each native view tag onto
 * `View.setNextFocus*Id`. Pressable forwards its rest props to that View. The
 * FAB speed dial uses them for its open-state keyboard focus cycle (38.4 D-31).
 */
declare module "react-native" {
  interface ViewPropsAndroid {
    nextFocusForward?: number | undefined;
    nextFocusUp?: number | undefined;
    nextFocusDown?: number | undefined;
  }
}
