module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // If you have other plugins, put them here first!
      'react-native-reanimated/plugin',
    ],
  };
};