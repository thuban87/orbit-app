module.exports = (api) => {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Reanimated 4 moved its Babel plugin into react-native-worklets; the old
    // `react-native-reanimated/plugin` is now a thin re-export of this one
    // (verified against react-native-reanimated 4.5.1 / react-native-worklets
    // 0.10.4). It MUST be the LAST plugin — the worklets transform has to run
    // after every other plugin has finished rewriting the tree, or worklets
    // capture stale/undefined references.
    plugins: ["react-native-worklets/plugin"],
  };
};
