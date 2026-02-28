import assert from 'node:assert/strict';

// Mock expo-router before it's imported by lib/navigation
import module from 'node:module';

const originalRequire = module.prototype.require;
// @ts-ignore - overriding internal require for mocking
module.prototype.require = function(id: string) {
  if (id === 'expo-router') {
    return {
      router: {
        push: (args: any) => {
          (global as any).lastRouterPushArgs = args;
        },
        canGoBack: () => false,
        back: () => {},
        replace: () => {},
      },
      useLocalSearchParams: () => ({}),
      usePathname: () => '/'
    };
  }
  if (id === 'react-native') {
    return {
      Platform: { OS: 'web' }
    };
  }
  if (id === 'react') {
    return {
      useCallback: (cb: any) => cb,
      useState: (init: any) => [init, () => {}],
      useEffect: () => {},
    };
  }
  return originalRequire.apply(this, arguments as any);
};

// Now import navigation
const { navigateToProfile } = require('../../lib/navigation');

console.log('Running unit-navigation tests...');

// Test 1: CP-USER- prefix
(global as any).lastRouterPushArgs = null;
navigateToProfile('CP-USER-123');
assert.deepEqual((global as any).lastRouterPushArgs, { pathname: '/contacts/[cpid]', params: { cpid: 'CP-USER-123' } });

// Test 2: CP-U prefix
(global as any).lastRouterPushArgs = null;
navigateToProfile('CP-U456');
assert.deepEqual((global as any).lastRouterPushArgs, { pathname: '/contacts/[cpid]', params: { cpid: 'CP-U456' } });

// Test 3: @username prefix
(global as any).lastRouterPushArgs = null;
navigateToProfile('@johndoe');
assert.deepEqual((global as any).lastRouterPushArgs, { pathname: '/user/[id]', params: { id: 'johndoe' } });

// Test 4: regular user id
(global as any).lastRouterPushArgs = null;
navigateToProfile('regular-id-789');
assert.deepEqual((global as any).lastRouterPushArgs, { pathname: '/user/[id]', params: { id: 'regular-id-789' } });

console.log('unit navigation checks passed');
