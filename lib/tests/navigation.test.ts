import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Module = require('module');
const originalRequire = Module.prototype.require;

let replaceCallArg: string | undefined;

// Hook require to mock expo-router before we import navigation
Module.prototype.require = function(path: string) {
  if (path === 'expo-router') {
    return {
      router: {
        replace: (arg: string) => {
          replaceCallArg = arg;
        },
        canGoBack: () => false,
        back: () => {},
        push: () => {}
      },
      useLocalSearchParams: () => ({}),
      usePathname: () => ''
    };
  }
  if (path === 'react') {
    return { useCallback: (fn: any) => fn };
  }
  if (path === 'react-native') {
    return { Platform: { OS: 'web' } };
  }
  return originalRequire.apply(this, arguments);
};

// Use dynamic import so require hook is active for the import
import('../navigation').then(({ goHome }) => {
  function testGoHome() {
    replaceCallArg = undefined;
    goHome();
    assert.equal(replaceCallArg, '/(tabs)', 'goHome should call router.replace with "/(tabs)"');
  }

  testGoHome();

  // Restore require after tests
  Module.prototype.require = originalRequire;

  console.log('navigation route tests passed');
});
