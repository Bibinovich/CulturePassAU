import assert from 'node:assert/strict';
import Module from 'node:module';
import path from 'node:path';

let currentScheme: 'light' | 'dark' | null | undefined = 'light';
const reactNativeMock = {
  useColorScheme: () => currentScheme,
};

const originalRequire = Module.prototype.require;
Module.prototype.require = function (id: string) {
  if (id === 'react-native') {
    return reactNativeMock;
  }
  // mock the alias
  if (id === '@/constants/colors' || id.startsWith('@/constants/colors')) {
    const p = path.join(process.cwd(), 'constants/colors.ts');
    return originalRequire.apply(this, [p] as any);
  }
  return originalRequire.apply(this, arguments as any);
};

async function runTests() {
  try {
    const hooksMod = await import('../../hooks/useColors.ts');
    const colorsMod = await import('../../constants/colors.ts');

    const { useColors, useColor } = hooksMod;
    const { light, dark } = colorsMod;

    // Test Light Mode
    currentScheme = 'light';
    assert.deepEqual(useColors(), light, 'useColors should return light theme when scheme is light');
    assert.equal(useColor('background'), light.background, 'useColor should return light background token');

    // Test Dark Mode
    currentScheme = 'dark';
    assert.deepEqual(useColors(), dark, 'useColors should return dark theme when scheme is dark');
    assert.equal(useColor('background'), dark.background, 'useColor should return dark background token');

    // Test Null/Fallback Mode
    currentScheme = null;
    assert.deepEqual(useColors(), light, 'useColors should default to light theme when scheme is null');

    // Test Undefined/Fallback Mode
    currentScheme = undefined;
    assert.deepEqual(useColors(), light, 'useColors should default to light theme when scheme is undefined');

    console.log('unit hooks checks passed');
    process.exit(0);
  } catch (e) {
    console.error('unit hooks checks failed:', e);
    process.exit(1);
  } finally {
    Module.prototype.require = originalRequire;
  }
}

runTests();
