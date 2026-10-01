/**
 * ORRERY LAB C — raise Android minSdk to 26 for react-native-webgpu.
 *
 * react-native-webgpu 0.10.4's Android C++ (SurfaceRegistry / AndroidPlatformContext)
 * calls the AHardwareBuffer_* NDK API, which is "introduced in Android 26"; with
 * Expo SDK 57's default minSdk 24 the CMake build fails. Expo's root-project
 * plugin reads the `android.minSdkVersion` gradle property into the version
 * catalog, so this writes that property at prebuild. Experiment-only: shipping
 * it would raise the real app's minSdk (an owner decision for V2).
 */
const { withGradleProperties } = require("expo/config-plugins");

const MIN_SDK = "26";

module.exports = function withLabCMinSdk(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter(
      (item) => !(item.type === "property" && item.key === "android.minSdkVersion"),
    );
    cfg.modResults.push({ type: "property", key: "android.minSdkVersion", value: MIN_SDK });
    return cfg;
  });
};
