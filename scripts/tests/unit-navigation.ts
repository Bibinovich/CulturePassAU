import assert from 'node:assert/strict';
import { createRequire } from 'module';

const modModule = require('module');
const originalRequire = modModule.prototype.require;

let currentOS = 'ios';

modModule.prototype.require = function(request: string) {
  if (request === 'react-native') {
    return {
      get Platform() {
        return { OS: currentOS };
      }
    };
  }
  if (request === 'expo-router') {
    return {
      router: {
        canGoBack: () => false,
        back: () => {},
        replace: () => {},
        push: () => {}
      },
      useLocalSearchParams: () => ({}),
      usePathname: () => '/'
    };
  }
  if (request === 'react') {
    return {
      useCallback: (fn: any) => fn,
    };
  }
  return originalRequire.apply(this, arguments);
};

function runTests() {
  let writeTextCalled = false;
  let copiedText = '';

  const mockNavigator = {
    clipboard: {
      writeText: (text: string) => {
        writeTextCalled = true;
        copiedText = text;
        return Promise.resolve();
      }
    }
  };

  // Re-define navigator properly
  Object.defineProperty(globalThis, 'navigator', {
    value: mockNavigator,
    configurable: true,
    writable: true,
  });

  const { shareEventLink } = require('../../lib/navigation');

  // Test web platform
  currentOS = 'web';
  writeTextCalled = false;
  copiedText = '';
  shareEventLink({ id: 'event-123', title: 'Test Event' });

  assert.equal(writeTextCalled, true, 'clipboard.writeText should be called on web');
  assert.equal(copiedText, 'culturepass://event/event-123', 'Should copy the correct culturepass event URL');

  // Test non-web platform (native)
  currentOS = 'ios';
  writeTextCalled = false;
  copiedText = '';

  shareEventLink({ id: 'event-456', title: 'Test Native Event' });
  assert.equal(writeTextCalled, false, 'clipboard.writeText should NOT be called on native platforms');

  // Test web platform but missing navigator or clipboard
  currentOS = 'web';
  Object.defineProperty(globalThis, 'navigator', {
    value: undefined,
    configurable: true,
    writable: true,
  });
  writeTextCalled = false;
  copiedText = '';

  // This shouldn't throw
  shareEventLink({ id: 'event-789', title: 'Missing Navigator Event' });
  assert.equal(writeTextCalled, false, 'Should not error when navigator is missing');

  Object.defineProperty(globalThis, 'navigator', {
    value: {},
    configurable: true,
    writable: true,
  });
  shareEventLink({ id: 'event-789', title: 'Missing Clipboard Event' });
  assert.equal(writeTextCalled, false, 'Should not error when navigator.clipboard is missing');

  console.log('unit navigation checks passed');

  // Restore require
  modModule.prototype.require = originalRequire;
}

try {
  runTests();
} catch(e) {
  console.error(e);
  process.exit(1);
}
