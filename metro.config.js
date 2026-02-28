const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// On web, replace react-native-reanimated with a safe no-op stub.
// The real package's native initializer calls Object.values(null) in a browser
// environment, crashing the entire app before any component renders.
// react-native-gesture-handler wraps its Reanimated require in a try/catch
// and gracefully falls back when useSharedValue is absent, so this is safe.
const originalResolveRequest = config.resolver?.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "react-native-reanimated") {
    return {
      filePath: path.resolve(__dirname, "lib/reanimated-stub.js"),
      type: "sourceFile",
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
