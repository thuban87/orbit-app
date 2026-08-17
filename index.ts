import { registerRootComponent } from "expo";
import { registerWidgetTaskHandler } from "react-native-android-widget";

import App from "./App";
import { widgetTaskHandler } from "./src/services/widget/widget-task-handler";

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// The library's own headless entry (12-06): a widget lifecycle/click event loads
// the JS bundle and invokes widgetTaskHandler in a headless context — React never
// mounts, so this MUST be registered at module scope (mirrors the notification
// headless-task registration). We do NOT call TaskManager.defineTask ourselves for
// the widget; registerWidgetTaskHandler is the library's own entry.
registerWidgetTaskHandler(widgetTaskHandler);
