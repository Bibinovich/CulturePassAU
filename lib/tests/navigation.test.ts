import assert from 'node:assert/strict';

// Override default resolution of expo-router and other troublesome modules
import Module from 'node:module';
const originalLoad = (Module as any)._load;

(globalThis as any).__mockRouterPush = null;

(Module as any)._load = function (request: string, parent: any, isMain: boolean) {
  if (request === 'expo-router') {
    return {
      router: {
        push: (route: any) => { (globalThis as any).__mockRouterPush = route; },
        replace: () => {},
        back: () => {},
        canGoBack: () => true,
      },
      useLocalSearchParams: () => ({}),
      usePathname: () => '/',
    };
  }
  if (request === 'react') {
    return { useCallback: (cb: any) => cb };
  }
  if (request === 'react-native') {
    return { Platform: { OS: 'web' } };
  }
  return originalLoad.apply(this, arguments);
};

// Use dynamic import so `_load` overrides apply before evaluating target code
async function runTests() {
  const { navigateToEvent } = await import('../navigation');

  console.log('Running unit tests for lib/navigation.ts...\n');
  console.log('  Testing navigateToEvent...');

  // Reset mock state
  (globalThis as any).__mockRouterPush = null;

  // Act
  const eventId = 'test-event-123';
  navigateToEvent(eventId);

  // Assert
  assert.ok((globalThis as any).__mockRouterPush, 'router.push was not called');
  assert.deepEqual((globalThis as any).__mockRouterPush, {
    pathname: '/event/[id]',
    params: { id: eventId },
  });

  console.log('  ✅ navigateToEvent works correctly');
  console.log('\nAll navigation tests passed! 🎉');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
