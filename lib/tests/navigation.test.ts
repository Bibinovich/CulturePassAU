import assert from 'node:assert/strict';
import module from 'node:module';

// Override require to mock expo-router BEFORE any imports happen
const originalRequire = module.prototype.require;
let mockRouter = {
  canGoBack: () => false,
  back: () => {},
  replace: (href: any) => {},
  push: (href: any) => {}
};

module.prototype.require = function(id) {
  if (id === 'expo-router') {
    return {
      router: mockRouter,
      useLocalSearchParams: () => ({}),
      usePathname: () => ''
    };
  }
  if (id === 'react-native') {
    return {
      Platform: { OS: 'web' }
    };
  }
  if (id === 'react') {
    return {
      useCallback: (fn: any) => fn
    };
  }
  return originalRequire.apply(this, arguments as any);
};

// Now we can require our actual code instead of using import
// which would hoist above the mock
const { goBackOrReplace } = require('../navigation');

function testGoBackOrReplace() {
  let canGoBackResult = false;
  let backCalled = false;
  let replaceCalledWith: any = null;

  mockRouter.canGoBack = () => canGoBackResult;
  mockRouter.back = () => { backCalled = true; };
  mockRouter.replace = (href: any) => { replaceCalledWith = href; };

  // Test 1: canGoBack is true
  canGoBackResult = true;
  backCalled = false;
  replaceCalledWith = null;
  goBackOrReplace('/fallback');
  assert.equal(backCalled, true, 'router.back() should be called when canGoBack() is true');
  assert.equal(replaceCalledWith, null, 'router.replace() should not be called when canGoBack() is true');

  // Test 2: canGoBack is false
  canGoBackResult = false;
  backCalled = false;
  replaceCalledWith = null;
  goBackOrReplace('/fallback');
  assert.equal(backCalled, false, 'router.back() should not be called when canGoBack() is false');
  assert.equal(replaceCalledWith, '/fallback', 'router.replace() should be called with fallback when canGoBack() is false');

  console.log('✅ goBackOrReplace tests passed');
}

testGoBackOrReplace();
