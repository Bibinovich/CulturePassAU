import assert from 'node:assert/strict';
import module from 'node:module';

// ---------------------------------------------------------------------------
// Mock React Native to avoid "Invalid hook call" and esbuild issues in tests
// ---------------------------------------------------------------------------
let currentScheme: 'light' | 'dark' | null | undefined = 'light';
const originalRequire = module.prototype.require;

(module.prototype as any).require = function (id: string) {
  if (id === 'react-native') {
    return {
      useColorScheme: () => currentScheme,
    };
  }
  return originalRequire.call(this, id);
};

// Use an IIFE to dynamically load the hook after patching require
(async () => {
  const { useColors, useColor } = await import('../../hooks/useColors.ts');
  const { light, dark } = await import('../../constants/colors.ts');

  // Test light mode
  currentScheme = 'light';
  const lightColors = useColors();
  assert.deepEqual(lightColors, light, 'useColors should return light theme when scheme is light');
  assert.equal(useColor('primary'), light.primary, 'useColor should correctly return the specific light color token');

  // Test dark mode
  currentScheme = 'dark';
  const darkColors = useColors();
  assert.deepEqual(darkColors, dark, 'useColors should return dark theme when scheme is dark');
  assert.equal(useColor('primary'), dark.primary, 'useColor should correctly return the specific dark color token');

  // Test undefined fallback
  currentScheme = undefined;
  const fallbackColors = useColors();
  assert.deepEqual(fallbackColors, light, 'useColors should return light theme when scheme is undefined');

  console.log('useColors and useColor hook checks passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
