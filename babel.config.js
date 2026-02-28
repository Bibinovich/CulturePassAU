module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
    plugins: [
      // React Compiler — matches experiments.reactCompiler: true in app.json
      // Auto-memoises components and hooks; requires babel-plugin-react-compiler
      'babel-plugin-react-compiler',
      // react-native-reanimated 4.x uses react-native-worklets for worklet
      // transforms. This plugin MUST be listed last.
      'react-native-worklets/plugin',
    ],
  };
};
