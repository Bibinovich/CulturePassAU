import assert from 'node:assert/strict';
import Module from 'node:module';

// Polyfill require to override react-native BEFORE any imports resolve
// This works around tsx/esbuild issues when parsing flow syntax inside the react-native package
const originalRequire = Module.prototype.require;
let currentScheme: 'light' | 'dark' | null | undefined = 'light';

Module.prototype.require = function(id) {
  if (id === 'react-native') {
    return {
      useColorScheme: () => currentScheme
    };
  }
  return originalRequire.apply(this, arguments as any);
};

// Now import the hook and constants
// We must use require() so that the override takes effect before ES module static resolution
const { useColors, useColor } = require('../../hooks/useColors');
const { light, dark } = require('../../constants/colors');

// Test useColors
currentScheme = 'light';
assert.deepEqual(useColors(), light, 'useColors should return light theme for light scheme');

currentScheme = 'dark';
assert.deepEqual(useColors(), dark, 'useColors should return dark theme for dark scheme');

currentScheme = null;
assert.deepEqual(useColors(), light, 'useColors should default to light theme for null scheme');

// Test useColor
currentScheme = 'light';
assert.equal(useColor('primary'), light.primary, 'useColor should return light primary');

currentScheme = 'dark';
assert.equal(useColor('primary'), dark.primary, 'useColor should return dark primary');

console.log('unit hooks/useColors checks passed');
