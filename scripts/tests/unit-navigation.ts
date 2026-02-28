import assert from 'node:assert/strict';

// Mock expo-router using require.cache
let lastPushedRoute: any = null;
const mockRouter = {
  push: (route: any) => {
    lastPushedRoute = route;
  },
  replace: () => {},
  back: () => {},
  canGoBack: () => true,
};

const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id: string) {
  if (id === 'expo-router') {
    return {
      router: mockRouter,
      useLocalSearchParams: () => ({}),
      usePathname: () => '/',
    };
  }
  if (id === 'react-native') {
    return { Platform: { OS: 'web' } };
  }
  if (id === 'react') {
    return { useCallback: (fn: any) => fn };
  }
  return originalRequire.apply(this, arguments);
};

// Now dynamic import the module to test, so tsx doesn't resolve it statically
async function runTests() {
  const { navigateToProfile } = require('../../lib/navigation');
  console.log('Running navigateToProfile tests...');

  // Branch 1: CP-USER- or CP-U
  navigateToProfile('CP-USER-123');
  assert.deepEqual(lastPushedRoute, { pathname: '/contacts/[cpid]', params: { cpid: 'CP-USER-123' } });

  navigateToProfile('CP-U456');
  assert.deepEqual(lastPushedRoute, { pathname: '/contacts/[cpid]', params: { cpid: 'CP-U456' } });

  // Branch 2: @username
  navigateToProfile('@johndoe');
  assert.deepEqual(lastPushedRoute, { pathname: '/user/[id]', params: { id: 'johndoe' } });

  // Branch 3: Fallback (id)
  navigateToProfile('user-789');
  assert.deepEqual(lastPushedRoute, { pathname: '/user/[id]', params: { id: 'user-789' } });

  console.log('unit navigation checks passed');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
